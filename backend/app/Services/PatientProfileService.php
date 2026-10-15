<?php

namespace App\Services;

use App\Enums\ResponseCode;
use App\Models\ClinicalNote;
use App\Models\ConsultMaterial;
use App\Models\ConsultSession;
use App\Models\Patient;
use App\Models\PatientEvent;
use App\Models\Warning;
use App\Models\WarningDisposeRecord;
use Illuminate\Database\Eloquent\Builder;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * 患者详情扩展：临床时间轴 / 会诊记录 / 关联预警 / 阶段字典 / 列表导出
 * （03-患者与床位/02-患者管理接口 §3.4~3.6、§3.9~3.10）
 */
class PatientProfileService extends Service
{
    /** 时间轴事件类型字典（§4.3） */
    private const EVENT_TYPE_LABELS = [
        'registered' => '已登记',
        'admitted' => '入科',
        'consultation' => '会诊',
        'transfer' => '转诊',
        'handover' => '交接',
        'discharge' => '出院',
    ];

    /** 会诊会话状态（consult_sessions.status：0待接诊1会诊中2已结束） */
    private const CONSULT_STATUS_CODES = [
        0 => 'PENDING',
        1 => 'IN_CALL',
        2 => 'CLOSED',
    ];

    private const CONSULT_STATUS_LABELS = [
        0 => '待接诊',
        1 => '会诊中',
        2 => '已结束',
    ];

    /** 预警级别/状态字典（与 02-预警与重症 §4 口径一致） */
    private const WARNING_LEVEL_LABELS = [
        'urgent' => '紧急',
        'warning' => '关注',
    ];

    private const WARNING_STATUS_LABELS = [
        'new' => '待确认',
        'acknowledged' => '已确认',
        'treating' => '处置中',
        'resolved' => '已闭环',
    ];

    /** 患者阶段字典（§4.1，顺序固定） */
    private const STAGE_LABELS = [
        'registered' => '待诊',
        'consulting' => '会诊中',
        'accepted' => '已接收',
        'admitted' => '在治',
        'transfer-requested' => '转诊中',
        'in-transit' => '转运中',
        'local-closed' => '出院',
    ];

    /**
     * 临床时间轴（§3.4）：临床记录 + 时间轴事件，按 at 倒序合并
     */
    public function timeline(string $patientCode): array
    {
        $patient = $this->findPatient($patientCode);

        $notes = ClinicalNote::query()
            ->where('patient_id', $patient->patient_id)
            ->get()
            ->map(fn (ClinicalNote $n) => [
                'id' => $n->note_id,
                'category' => 'note',
                'kind' => $n->kind,
                'title' => $n->title,
                'text' => $n->text,
                'at' => optional($n->at)->toIso8601String(),
                'actorId' => $n->actor_id,
                'actorName' => null,
            ]);

        $events = PatientEvent::query()
            ->where('patient_id', $patient->patient_id)
            ->get()
            ->map(fn (PatientEvent $e) => [
                'id' => $e->event_id,
                'category' => 'event',
                'type' => $e->type,
                'title' => self::EVENT_TYPE_LABELS[$e->type] ?? $e->type,
                'text' => $e->note,
                'at' => optional($e->at)->toIso8601String(),
                'actorId' => $e->actor_id,
                'actorName' => null,
            ]);

        // 病程记录：来自会诊共享资料 consult_materials（kind=病程记录）
        $courseNotes = ConsultMaterial::query()
            ->where('patient_id', $patient->patient_id)
            ->where('kind', '病程记录')
            ->get()
            ->map(fn (ConsultMaterial $m) => [
                'id' => 'MAT-'.$m->id,
                'category' => 'note',
                'kind' => $m->kind,
                'title' => $m->title,
                'text' => $m->content,
                'at' => optional($m->shared_at)->toIso8601String(),
                'actorId' => $m->author_id,
                'actorName' => $m->author_name,
            ]);

        $timeline = $notes->concat($events)->concat($courseNotes)
            ->sortByDesc(fn (array $item) => $item['at'] ?? '')
            ->values()
            ->all();

        return [
            'patientId' => $patient->patient_id,
            'timeline' => $timeline,
        ];
    }

    /**
     * 患者历史会诊记录（§3.5）
     */
    public function consultations(string $patientCode): array
    {
        $patient = $this->findPatient($patientCode);

        $list = ConsultSession::query()
            ->where('patient_id', $patient->patient_id)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (ConsultSession $s) => [
                'token' => $s->token,
                'requestId' => null,
                'doctorId' => $s->accepted_by,
                'doctorName' => $s->accepted_by_name,
                'status' => self::CONSULT_STATUS_CODES[$s->status] ?? '',
                'statusLabel' => self::CONSULT_STATUS_LABELS[$s->status] ?? '',
                'subject' => $s->chief_complaint,
                'createdAt' => optional($s->created_at)->toIso8601String(),
            ])->values()->all();

        return [
            'patientId' => $patient->patient_id,
            'total' => count($list),
            'list' => $list,
        ];
    }

    /**
     * 关联预警与处置（§3.6）
     */
    public function warnings(string $patientCode): array
    {
        $patient = $this->findPatient($patientCode);

        $list = Warning::query()
            ->where('patient_id', $patient->patient_id)
            ->orderByDesc('occurred_at')
            ->get()
            ->map(fn (Warning $w) => [
                'id' => $w->warning_no,
                'title' => $w->title,
                'level' => $w->level,
                'levelLabel' => self::WARNING_LEVEL_LABELS[$w->level] ?? $w->level,
                'status' => $w->status,
                'statusLabel' => self::WARNING_STATUS_LABELS[$w->status] ?? $w->status,
                'createdAt' => optional($w->occurred_at)->toIso8601String(),
                'records' => $w->disposeRecords()
                    ->orderBy('acted_at')
                    ->get()
                    ->map(fn (WarningDisposeRecord $r) => [
                        'stage' => $r->stage,
                        'note' => $r->note,
                        'actorName' => $r->actor_name,
                        'actedAt' => optional($r->acted_at)->toIso8601String(),
                    ])->values()->all(),
            ])->values()->all();

        return [
            'patientId' => $patient->patient_id,
            'total' => count($list),
            'list' => $list,
        ];
    }

    /**
     * 患者阶段字典（§3.10）：固定枚举 + 各阶段计数
     */
    public function stages(): array
    {
        $counts = Patient::query()
            ->where('is_draft', false)
            ->selectRaw('stage, COUNT(*) AS total')
            ->groupBy('stage')
            ->pluck('total', 'stage');

        $stages = collect(self::STAGE_LABELS)->map(fn (string $label, string $value) => [
            'value' => $value,
            'label' => $label,
            'count' => (int) ($counts[$value] ?? 0),
        ])->values()->all();

        return ['stages' => $stages];
    }

    /**
     * 患者列表导出（§3.9）：按列表筛选条件流式返回 CSV
     */
    public function export(array $filters): StreamedResponse
    {
        $patients = $this->filteredQuery($filters)->orderBy('patient_id')->limit(10000)->get();
        $filename = 'patients_'.now()->format('Ymd').'.csv';

        return response()->streamDownload(function () use ($patients) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // BOM，Excel 兼容
            fputcsv($out, ['patientId', 'name', 'gender', 'age', 'phone', 'stage', 'institutionId', 'departmentId', 'chiefComplaint', 'admittedAt']);
            foreach ($patients as $p) {
                fputcsv($out, [
                    $p->patient_id,
                    $p->name,
                    $this->gender($p->gender),
                    $p->age,
                    $p->phone,
                    $p->stage,
                    $p->institution_id,
                    $p->department_id,
                    $p->chief_complaint,
                    optional($p->admitted_at)->toIso8601String(),
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * 列表筛选（与 §3.2 同口径）：stage / keyword / institutionId / departmentId
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
     * 按患者编号取患者，不存在则 404
     */
    private function findPatient(string $patientCode): Patient
    {
        $patient = Patient::query()->where('patient_id', $patientCode)->first();
        $this->assert($patient !== null, ResponseCode::NOT_FOUND, '患者不存在');

        return $patient;
    }

    private function gender(?int $gender): string
    {
        return match ($gender) {
            0 => 'MALE',
            1 => 'FEMALE',
            default => 'UNKNOWN',
        };
    }
}
