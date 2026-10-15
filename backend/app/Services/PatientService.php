<?php

namespace App\Services;

use App\Enums\ResponseCode;
use App\Models\Bed;
use App\Models\ClinicalNote;
use App\Models\ConsultMaterial;
use App\Models\CriticalValue;
use App\Models\Department;
use App\Models\IcuBed;
use App\Models\Organization;
use App\Models\Patient;
use App\Models\PatientVital;
use App\Models\Warning;
use App\Models\WarningDisposeRecord;
use App\Models\WarningTrend;
use Illuminate\Database\Eloquent\Builder;

/**
 * 患者列表 / 详情 / 更新（03-患者与床位/02-患者管理接口 §3.2/§3.3/§3.7）
 */
class PatientService extends Service
{
    /** 性别：MALE/FEMALE/UNKNOWN ↔ 0/1/2 */
    private const GENDER_CODES = [
        0 => 'MALE',
        1 => 'FEMALE',
        2 => 'UNKNOWN',
    ];

    private const GENDER_LABELS = [
        0 => '男',
        1 => '女',
        2 => '未知',
    ];

    /** 患者阶段字典（§4.1） */
    private const STAGE_LABELS = [
        'registered' => '待诊',
        'consulting' => '会诊中',
        'accepted' => '已接收',
        'admitted' => '在治',
        'transfer-requested' => '转诊中',
        'in-transit' => '转运中',
        'local-closed' => '出院',
    ];

    /** 患者来源字典（§4.2） */
    private const SOURCE_LABELS = [
        'manual' => '手动登记',
        '120' => '120院前急救',
    ];

    /** 危重程度字典 */
    private const SEVERITY_LABELS = [
        'critical' => '危重',
        'acute' => '重症',
        'general' => '一般',
    ];

    /** 预警等级字典 */
    private const WARNING_LEVEL_LABELS = [
        'urgent' => '紧急',
        'warning' => '关注',
    ];

    /** 预警状态字典 */
    private const WARNING_STATUS_LABELS = [
        'new' => '待确认',
        'acknowledged' => '已确认',
        'treating' => '处置中',
        'resolved' => '已闭环',
    ];

    /** 危急值等级/状态字典 */
    private const CRITICAL_LEVEL_LABELS = [
        'urgent' => '紧急',
        'warning' => '关注',
    ];

    private const CRITICAL_STATUS_LABELS = [
        'pending' => '待通知',
        'notified' => '已通知',
        'handled' => '已处理',
    ];

    /** 列表入参 → 数据库列映射（camelCase → snake_case） */
    private const COLUMN_MAP = [
        'name' => 'name',
        'gender' => 'gender',
        'age' => 'age',
        'phone' => 'phone',
        'idCard' => 'id_card',
        'chiefComplaint' => 'chief_complaint',
        'symptoms' => 'symptoms',
        'stage' => 'stage',
        'institutionId' => 'institution_id',
        'departmentId' => 'department_id',
        'notes' => 'notes',
        'isDraft' => 'is_draft',
    ];

    /**
     * 患者列表（§3.2）：{total, list}
     */
    public function index(array $filters): array
    {
        $paginator = $this->filteredQuery($filters)
            ->orderByDesc('created_at')
            ->paginate($this->pageSize($filters), ['*'], 'pageNum', $this->pageNum($filters));

        $items = $paginator->items();
        $orgNames = $this->orgNames(collect($items)->pluck('institution_id')->all());
        $deptNames = $this->deptNames(collect($items)->pluck('department_id')->all());
        $beds = $this->bedsByPatient(collect($items)->pluck('patient_id')->all());

        $list = collect($items)
            ->map(fn (Patient $patient) => $this->listItem($patient, $orgNames, $deptNames, $beds))
            ->all();

        return [
            'total' => $paginator->total(),
            'list' => $list,
        ];
    }

    /**
     * 患者详情（§3.3）
     */
    public function show(string $patientId): array
    {
        $patient = $this->findPatient($patientId);
        $orgNames = $this->orgNames([$patient->institution_id]);
        $deptNames = $this->deptNames([$patient->department_id]);

        return [
            'patientId' => $patient->patient_id,
            'name' => $patient->name,
            'gender' => $this->genderCode($patient->gender),
            'genderLabel' => $this->genderLabel($patient->gender),
            'age' => $patient->age === null ? null : (int) $patient->age,
            'idCard' => $patient->id_card,
            'phone' => $patient->phone,
            'institutionId' => $patient->institution_id,
            'institutionName' => $orgNames[$patient->institution_id] ?? '',
            'departmentId' => $patient->department_id,
            'departmentName' => $deptNames[$patient->department_id] ?? '',
            'assignedTo' => $patient->assigned_to ?? [],
            'stage' => $patient->stage,
            'stageLabel' => self::STAGE_LABELS[$patient->stage] ?? $patient->stage,
            'chiefComplaint' => $patient->chief_complaint,
            'symptoms' => $patient->symptoms ?? [],
            'notes' => $patient->notes,
            'source' => $patient->source,
            'sourceLabel' => self::SOURCE_LABELS[$patient->source] ?? $patient->source,
            'admittedAt' => optional($patient->admitted_at)->toIso8601String(),
            'bed' => $this->bed($patient->patient_id),
            'prehospital' => $patient->prehospital ?? [],
            'consultation' => [
                'token' => $patient->consultation_token,
                'doctorId' => $patient->consultation_doctor_id,
                'doctorName' => null,
                'requestId' => $patient->consultation_request_id,
            ],
            'createdAt' => optional($patient->created_at)->toIso8601String(),
            'updatedAt' => optional($patient->updated_at)->toIso8601String(),

            // 监护模块：概览 / 护理 / 用药 / 危急值 / 检验 / 病程 / 管控 / 辅助分析
            'overview' => $this->overview($patient->patient_id),
            'nursingRecords' => $this->mergedRecords($patient->patient_id, '护理记录'),
            'medicationRecords' => $this->mergedRecords($patient->patient_id, '用药记录'),
            'criticalValues' => $this->criticalValues($patient->patient_id),
            'labRecords' => $this->mergedRecords($patient->patient_id, '检验记录'),
            'courseRecords' => $this->courseRecords($patient->patient_id),
            'controlRecords' => $this->controlRecords($patient->patient_id),
            'auxiliaryAnalysis' => $this->auxiliaryAnalysis($patient->patient_id),
        ];
    }

    /**
     * 更新患者信息（§3.7）：返回更新后的详情对象
     */
    public function update(string $patientId, array $data): array
    {
        $patient = $this->findPatient($patientId);
        $patient->update($this->columnPayload($data));

        return $this->show($patient->patient_id);
    }

    /**
     * 删除患者（软删除）
     */
    public function delete(string $patientId): void
    {
        $this->findPatient($patientId)->delete();
    }

    /**
     * 列表项（§3.2 字段）
     */
    private function listItem(Patient $patient, array $orgNames, array $deptNames, $beds): array
    {
        $bed = $beds[$patient->patient_id] ?? null;

        return [
            'patientId' => $patient->patient_id,
            'name' => $patient->name,
            'gender' => $this->genderCode($patient->gender),
            'genderLabel' => $this->genderLabel($patient->gender),
            'age' => $patient->age === null ? null : (int) $patient->age,
            'phone' => $patient->phone,
            'stage' => $patient->stage,
            'stageLabel' => self::STAGE_LABELS[$patient->stage] ?? $patient->stage,
            'institutionId' => $patient->institution_id,
            'institutionName' => $orgNames[$patient->institution_id] ?? '',
            'departmentId' => $patient->department_id,
            'departmentName' => $deptNames[$patient->department_id] ?? '',
            'bedId' => $bed?->bed_id,
            'bedLabel' => $bed?->label,
            'chiefComplaint' => $patient->chief_complaint,
            'admittedAt' => optional($patient->admitted_at)->toIso8601String(),
            'source' => $patient->source,
            'sourceLabel' => self::SOURCE_LABELS[$patient->source] ?? $patient->source,
            'createdAt' => optional($patient->created_at)->toIso8601String(),
        ];
    }

    /**
     * 机构 org_code => org_name
     */
    private function orgNames(iterable $codes): array
    {
        $codes = collect($codes)->filter(fn ($c) => $c !== null && $c !== '')->unique()->all();

        return $codes === [] ? [] : Organization::query()->whereIn('org_code', $codes)->pluck('org_name', 'org_code')->all();
    }

    /**
     * 科室 dept_code => dept_name
     */
    private function deptNames(iterable $codes): array
    {
        $codes = collect($codes)->filter(fn ($c) => $c !== null && $c !== '')->unique()->all();

        return $codes === [] ? [] : Department::query()->whereIn('dept_code', $codes)->pluck('dept_name', 'dept_code')->all();
    }

    /**
     * 患者编号 => 床位（批量反查，避免逐行查询）
     */
    private function bedsByPatient(iterable $patientIds): array
    {
        $ids = collect($patientIds)->filter(fn ($c) => $c !== null && $c !== '')->unique()->all();

        return $ids === [] ? [] : Bed::query()->whereIn('patient_id', $ids)->get()->keyBy('patient_id')->all();
    }

    /**
     * 列表筛选（§3.2）：stage / keyword / institutionId / departmentId
     */
    private function filteredQuery(array $filters): Builder
    {
        $query = Patient::query();

        if (! empty($filters['stage'])) {
            $stages = array_values(array_filter(array_map('trim', explode(',', (string) $filters['stage']))));
            $query->whereIn('stage', $stages);
        }

        if (! empty($filters['keyword'])) {
            $kw = (string) $filters['keyword'];
            $query->where(function (Builder $q) use ($kw) {
                $q->where('name', 'like', "%{$kw}%")
                    ->orWhere('patient_id', 'like', "%{$kw}%")
                    ->orWhere('id_card', 'like', "%{$kw}%")
                    ->orWhere('phone', 'like', "%{$kw}%");
            });
        }

        if (! empty($filters['institutionId'])) {
            $query->where('institution_id', $filters['institutionId']);
        }

        if (! empty($filters['departmentId'])) {
            $query->where('department_id', $filters['departmentId']);
        }

        return $query;
    }

    /**
     * 床号反查（可为 null）：beds.patient_id = patients.patient_id
     */
    private function bed(?string $patientId): ?array
    {
        if ($patientId === null || $patientId === '') {
            return null;
        }

        $bed = Bed::query()->where('patient_id', $patientId)->first();

        return $bed === null ? null : [
            'bedId' => $bed->bed_id,
            'label' => $bed->label,
        ];
    }

    /**
     * 概览：ICU 床位 + 最新一条床旁体征
     */
    private function overview(string $pid): array
    {
        $icuBed = IcuBed::query()->where('patient_id', $pid)->first();
        $vital = PatientVital::query()->where('patient_id', $pid)->orderByDesc('measured_at')->first();

        return [
            'bedId' => $icuBed?->bed_id,
            'bedLabel' => $icuBed?->label,
            'severity' => $icuBed?->severity,
            'severityLabel' => $icuBed ? (self::SEVERITY_LABELS[$icuBed->severity] ?? $icuBed->severity) : null,
            'vital' => $vital === null ? null : [
                'heartRate' => (int) $vital->heart_rate,
                'spo2' => (int) $vital->spo2,
                'resp' => (int) $vital->resp,
                'temp' => (float) $vital->temp,
                'systolic' => (int) $vital->systolic,
                'diastolic' => (int) $vital->diastolic,
                'news' => $vital->news,
                'newsLabel' => $this->newsLabel($vital->news),
                'alert' => $this->isVitalAlert($vital),
                'measuredAt' => $vital->measured_at?->toIso8601String(),
            ],
        ];
    }

    /**
     * 合并临床记录（clinical_notes）与会诊共享资料（consult_materials）中指定 kind 的记录
     */
    private function mergedRecords(string $pid, string $kind): array
    {
        $notes = ClinicalNote::query()
            ->where('patient_id', $pid)
            ->where('kind', $kind)
            ->orderByDesc('at')
            ->get()
            ->map(fn (ClinicalNote $n) => [
                'id' => $n->note_id,
                'kind' => $n->kind,
                'title' => $n->title,
                'text' => $n->text,
                'at' => $n->at?->toIso8601String(),
                'actorId' => $n->actor_id,
                'actorName' => null,
            ]);

        $materials = ConsultMaterial::query()
            ->where('patient_id', $pid)
            ->where('kind', $kind)
            ->orderByDesc('shared_at')
            ->get()
            ->map(fn (ConsultMaterial $m) => [
                'id' => 'MAT-'.$m->id,
                'kind' => $m->kind,
                'title' => $m->title,
                'text' => $m->content,
                'at' => $m->shared_at?->toIso8601String(),
                'actorId' => $m->author_id,
                'actorName' => $m->author_name,
            ]);

        return $notes->concat($materials)
            ->sortByDesc(fn (array $r) => $r['at'] ?? '')
            ->values()
            ->all();
    }

    /**
     * 病程记录：来自会诊共享资料 consult_materials（kind=病程记录）
     */
    private function courseRecords(string $pid): array
    {
        return ConsultMaterial::query()
            ->where('patient_id', $pid)
            ->where('kind', '病程记录')
            ->orderByDesc('shared_at')
            ->get()
            ->map(fn (ConsultMaterial $m) => [
                'id' => 'MAT-'.$m->id,
                'kind' => $m->kind,
                'title' => $m->title,
                'text' => $m->content,
                'at' => $m->shared_at?->toIso8601String(),
                'actorId' => $m->author_id,
                'actorName' => $m->author_name,
            ])
            ->all();
    }

    /**
     * 检验危急值记录
     */
    private function criticalValues(string $pid): array
    {
        return CriticalValue::query()
            ->where('patient_id', $pid)
            ->orderByDesc('reported_at')
            ->get()
            ->map(fn (CriticalValue $c) => [
                'criticalNo' => $c->critical_no,
                'itemName' => $c->item_name,
                'resultValue' => $c->result_value,
                'unit' => $c->unit,
                'refRange' => $c->ref_range,
                'criticalRange' => $c->critical_range,
                'specimen' => $c->specimen,
                'level' => $c->level,
                'levelLabel' => self::CRITICAL_LEVEL_LABELS[$c->level] ?? $c->level,
                'status' => $c->status,
                'statusLabel' => self::CRITICAL_STATUS_LABELS[$c->status] ?? $c->status,
                'reportedAt' => $c->reported_at?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * 管控记录：预警 + 处置闭环记录
     */
    private function controlRecords(string $pid): array
    {
        $warnings = Warning::query()
            ->where('patient_id', $pid)
            ->with('disposeRecords')
            ->orderByDesc('occurred_at')
            ->get();

        return $warnings->map(fn (Warning $w) => [
            'warningNo' => $w->warning_no,
            'title' => $w->title,
            'metric' => $w->metric,
            'currentValue' => $w->current_value === null ? null : (float) $w->current_value,
            'level' => $w->level,
            'levelLabel' => self::WARNING_LEVEL_LABELS[$w->level] ?? $w->level,
            'status' => $w->status,
            'statusLabel' => self::WARNING_STATUS_LABELS[$w->status] ?? $w->status,
            'occurredAt' => $w->occurred_at?->toIso8601String(),
            'records' => $w->disposeRecords
                ->sortBy('acted_at')
                ->map(fn (WarningDisposeRecord $d) => [
                    'stage' => $d->stage,
                    'note' => $d->note,
                    'actorId' => $d->actor_id,
                    'actorName' => $d->actor_name,
                    'actedAt' => $d->acted_at?->toIso8601String(),
                ])
                ->values()
                ->all(),
        ])->all();
    }

    /**
     * 辅助分析：体征时序趋势 + 预警趋势预测（AI 辅助分析）
     */
    private function auxiliaryAnalysis(string $pid): array
    {
        $vitalTrend = PatientVital::query()
            ->where('patient_id', $pid)
            ->orderBy('measured_at')
            ->get()
            ->map(fn (PatientVital $v) => [
                'at' => $v->measured_at?->toIso8601String(),
                'heartRate' => (int) $v->heart_rate,
                'spo2' => (int) $v->spo2,
                'resp' => (int) $v->resp,
                'temp' => (float) $v->temp,
                'systolic' => (int) $v->systolic,
                'diastolic' => (int) $v->diastolic,
                'news' => $v->news,
            ])
            ->values()
            ->all();

        $predictions = WarningTrend::query()
            ->where('patient_id', $pid)
            ->orderBy('id')
            ->get()
            ->map(fn (WarningTrend $t) => [
                'id' => $t->trend_id,
                'patientLabel' => $t->patient_label,
                'metric' => $t->metric,
                'currentValue' => (float) $t->current_value,
                'predictedValue' => (float) $t->predicted_value,
                'withinMinutes' => (int) $t->within_minutes,
                'note' => $t->note,
            ])
            ->all();

        return [
            'vitalTrend' => $vitalTrend,
            'predictions' => $predictions,
        ];
    }

    /**
     * NEWS 评分标签：0–4 低风险 / 5–6 预警关注 / ≥7 高危
     */
    private function newsLabel(?int $news): string
    {
        if ($news === null) {
            return '正常';
        }
        if ($news >= 7) {
            return '高危';
        }
        if ($news >= 5) {
            return '预警关注';
        }

        return '低风险';
    }

    /**
     * 体征预警判定：news ≥ 5 或 SpO₂ < 93 或心率 > 100
     */
    private function isVitalAlert(PatientVital $vital): bool
    {
        if ($vital->news !== null && $vital->news >= 5) {
            return true;
        }
        if ((int) $vital->spo2 > 0 && (int) $vital->spo2 < 93) {
            return true;
        }

        return (int) $vital->heart_rate > 100;
    }

    /**
     * 入参 → 数据库列载荷（仅取校验通过的字段，gender 转 int）
     */
    private function columnPayload(array $data): array
    {
        $payload = [];

        foreach (self::COLUMN_MAP as $input => $column) {
            if (! array_key_exists($input, $data)) {
                continue;
            }

            $value = $data[$input];
            if ($input === 'gender') {
                $value = $this->genderToInt($value);
            }

            $payload[$column] = $value;
        }

        return $payload;
    }

    /**
     * 按患者编号取患者，不存在则 404
     */
    private function findPatient(string $patientId): Patient
    {
        $patient = Patient::query()->where('patient_id', $patientId)->first();
        $this->assert($patient !== null, ResponseCode::NOT_FOUND, '患者不存在');

        return $patient;
    }

    private function genderCode(?int $gender): string
    {
        return self::GENDER_CODES[$gender] ?? 'UNKNOWN';
    }

    private function genderLabel(?int $gender): string
    {
        return self::GENDER_LABELS[$gender] ?? '未知';
    }

    private function genderToInt(?string $gender): int
    {
        return match (strtoupper((string) $gender)) {
            'MALE' => 0,
            'FEMALE' => 1,
            default => 2,
        };
    }

    private function pageSize(array $filters): int
    {
        return max(1, (int) ($filters['pageSize'] ?? 20));
    }

    private function pageNum(array $filters): int
    {
        return max(1, (int) ($filters['pageNum'] ?? 1));
    }
}
