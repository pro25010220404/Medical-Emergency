<?php

namespace App\Services;

use App\Enums\ResponseCode;
use App\Models\Bed;
use App\Models\BedInspection;
use App\Models\CareBinding;
use App\Models\DepartmentBed;
use App\Models\MedicalDevice;
use App\Models\Organization;
use App\Models\Patient;

/**
 * 床位监控：科室统计、县域总览、单床详情、绑定设备、床旁巡检、预留床位、机构分布
 */
class BedService extends Service
{
    /** 床位状态：0空床1占用2预留3维护 */
    private const STATUS_CODES = [
        0 => 'free',
        1 => 'occupied',
        2 => 'reserved',
        3 => 'maintenance',
    ];

    private const STATUS_LABELS = [
        0 => '空床',
        1 => '占用',
        2 => '预留',
        3 => '维护',
    ];

    private const KIND_LABELS = [
        'routine' => '常规巡检',
        'handover' => '交接巡检',
    ];

    private const STAGE_LABELS = [
        'registered' => '已登记',
        'transfer-requested' => '转诊申请',
        'admitted' => '在治',
    ];

    /**
     * 床位明细列表（床位全景页数据源）
     * 支持 institutionId / departmentId / status(free|occupied|reserved|maintenance) 过滤
     */
    public function index(array $filters): array
    {
        $statusCodes = array_flip(self::STATUS_CODES);
        $status = $filters['status'] ?? null;

        $beds = Bed::query()
            ->when(
                ! empty($filters['institutionId']),
                fn ($q) => $q->where('institution_id', $filters['institutionId'])
            )
            ->when(
                ! empty($filters['departmentId']),
                fn ($q) => $q->where('department_id', $filters['departmentId'])
            )
            ->when(
                $status !== null && $status !== '' && isset($statusCodes[$status]),
                fn ($q) => $q->where('status', $statusCodes[$status])
            )
            ->orderBy('institution_id')
            ->orderBy('department_id')
            ->orderBy('bed_id')
            ->get();

        $orgNames = Organization::query()
            ->whereIn('org_code', $beds->pluck('institution_id')->unique()->all())
            ->pluck('org_name', 'org_code');

        $deptNames = DepartmentBed::query()
            ->get()
            ->mapWithKeys(fn (DepartmentBed $d) => [$d->hospital_id.'|'.$d->dept_id => $d->name]);

        $patients = Patient::query()
            ->whereIn('patient_id', $beds->pluck('patient_id')->filter()->unique()->all())
            ->get()
            ->keyBy('patient_id');

        $list = $beds->map(function (Bed $bed) use ($orgNames, $deptNames, $patients) {
            $patient = $bed->patient_id !== null && $bed->patient_id !== ''
                ? ($patients[$bed->patient_id] ?? null)
                : null;

            return [
                'bedId' => $bed->bed_id,
                'label' => $bed->label,
                'institutionId' => $bed->institution_id,
                'institutionName' => $orgNames[$bed->institution_id] ?? '',
                'departmentId' => $bed->department_id,
                'departmentName' => $deptNames[$bed->institution_id.'|'.$bed->department_id] ?? '',
                'status' => self::STATUS_CODES[$bed->status] ?? 'unknown',
                'statusLabel' => self::STATUS_LABELS[$bed->status] ?? '',
                'patient' => $patient === null ? null : [
                    'patientId' => $patient->patient_id,
                    'name' => $patient->name,
                    'genderLabel' => $this->genderLabel($patient->gender),
                    'age' => $patient->age === null ? null : (int) $patient->age,
                ],
            ];
        })->values()->all();

        return [
            'updatedAt' => now()->toIso8601String(),
            'total' => count($list),
            'list' => $list,
        ];
    }

    /**
     * 科室床位统计（§3.1）
     */
    public function byDept(?string $hospitalId): array
    {
        if ($hospitalId !== null && $hospitalId !== '') {
            $this->assert(
                Organization::query()->where('org_code', $hospitalId)->exists(),
                ResponseCode::NOT_FOUND,
                '医院不存在'
            );
        }

        $departments = DepartmentBed::query()
            ->when($hospitalId, fn ($q, $v) => $q->where('hospital_id', $v))
            ->orderBy('dept_id')
            ->get()
            ->map(fn (DepartmentBed $d) => [
                'id' => $d->dept_id,
                'name' => $d->name,
                'total' => (int) $d->total,
                'occupied' => (int) $d->occupied,
                'reserved' => (int) $d->reserved,
                'free' => (int) $d->free,
            ])->values()->all();

        return [
            'updatedAt' => now()->toIso8601String(),
            'hospitalId' => $hospitalId ?? '',
            'departments' => $departments,
        ];
    }

    /**
     * 县域床位总览（§3.2）
     */
    public function overview(?string $hospitalId): array
    {
        $beds = Bed::query()
            ->when(
                $hospitalId !== null && $hospitalId !== '',
                fn ($q) => $q->where('institution_id', $hospitalId)
            )
            ->get();

        $total = $beds->count();
        $occupied = $beds->where('status', 1)->count();
        $reserved = $beds->where('status', 2)->count();
        $free = $beds->where('status', 0)->count();

        $orgNames = Organization::query()
            ->whereIn('org_code', $beds->pluck('institution_id')->unique()->all())
            ->pluck('org_name', 'org_code');

        $hospitals = $beds->groupBy('institution_id')->map(function ($group, $institutionId) use ($orgNames) {
            $t = $group->count();
            $o = $group->where('status', 1)->count();

            return [
                'institutionId' => (string) $institutionId,
                'institutionName' => $orgNames[$institutionId] ?? '',
                'total' => $t,
                'occupied' => $o,
                'reserved' => $group->where('status', 2)->count(),
                'free' => $group->where('status', 0)->count(),
                'occupancyRate' => $this->rate($o, $t),
            ];
        })->values()->all();

        return [
            'updatedAt' => now()->toIso8601String(),
            'totalBeds' => $total,
            'occupiedBeds' => $occupied,
            'reservedBeds' => $reserved,
            'freeBeds' => $free,
            'occupancyRate' => $this->rate($occupied, $total),
            'hospitals' => $hospitals,
        ];
    }

    /**
     * 床位详情（§3.3）
     */
    public function show(string $bedId): array
    {
        $bed = $this->findBed($bedId);

        $institutionName = Organization::query()
            ->where('org_code', $bed->institution_id)
            ->value('org_name') ?? '';
        $departmentName = $this->departmentName($bed->institution_id, $bed->department_id);

        $patient = null;
        if ($bed->patient_id !== null && $bed->patient_id !== '') {
            $patient = Patient::query()->where('patient_id', $bed->patient_id)->first();
        }

        $binding = CareBinding::query()->where('bed_id', $bed->bed_id)->orderBy('bound_at')->first();

        return [
            'bedId' => $bed->bed_id,
            'label' => $bed->label,
            'institutionId' => $bed->institution_id,
            'institutionName' => $institutionName,
            'departmentId' => $bed->department_id,
            'departmentName' => $departmentName,
            'wardName' => $departmentName,
            'status' => self::STATUS_CODES[$bed->status] ?? 'unknown',
            'statusLabel' => self::STATUS_LABELS[$bed->status] ?? '',
            'patient' => $patient === null ? null : [
                'patientId' => $patient->patient_id,
                'name' => $patient->name,
                'gender' => $this->gender($patient->gender),
                'genderLabel' => $this->genderLabel($patient->gender),
                'age' => $patient->age === null ? null : (int) $patient->age,
                'stage' => $patient->stage,
                'stageLabel' => self::STAGE_LABELS[$patient->stage] ?? $patient->stage,
                'chiefComplaint' => $patient->prehospital['complaint'] ?? null,
            ],
            'device' => $binding === null ? null : [
                'deviceId' => $binding->device_id,
                'deviceName' => $binding->device_name,
                'cameraId' => $binding->camera_id,
            ],
        ];
    }

    /**
     * 床位绑定设备（§3.4）
     */
    public function devices(string $bedId): array
    {
        $bed = $this->findBed($bedId);

        $bindings = CareBinding::query()->where('bed_id', $bed->bed_id)->orderBy('bound_at')->get();

        $online = MedicalDevice::query()
            ->whereIn('device_id', $bindings->pluck('device_id')->filter()->all())
            ->pluck('online', 'device_id');

        return [
            'bedId' => $bed->bed_id,
            'updatedAt' => now()->toIso8601String(),
            'devices' => $bindings->map(fn (CareBinding $b) => [
                'deviceId' => $b->device_id,
                'deviceName' => $b->device_name,
                'cameraId' => $b->camera_id,
                'boundAt' => optional($b->bound_at)->toIso8601String(),
                'online' => (bool) ($online[$b->device_id] ?? false),
            ])->values()->all(),
        ];
    }

    /**
     * 床旁巡检记录（§3.5）
     */
    public function inspections(string $bedId, array $filters): array
    {
        $bed = $this->findBed($bedId);

        $paginator = BedInspection::query()
            ->where('bed_id', $bed->bed_id)
            ->orderByDesc('inspect_at')
            ->paginate($this->pageSize($filters), ['*'], 'pageNum', $this->pageNum($filters));

        $list = collect($paginator->items())->map(fn (BedInspection $i) => [
            'inspectionId' => $i->inspection_id,
            'inspectorId' => $i->inspector_id,
            'inspectorName' => $i->inspector_name,
            'kind' => $i->kind,
            'kindLabel' => self::KIND_LABELS[$i->kind] ?? $i->kind,
            'inspectAt' => optional($i->inspect_at)->toIso8601String(),
            'items' => $i->items ?? [],
            'result' => $i->result,
            'remark' => $i->remark,
        ])->values()->all();

        return [
            'total' => $paginator->total(),
            'list' => $list,
        ];
    }

    /**
     * 预留床位（§3.6）
     */
    public function reserved(array $filters): array
    {
        $paginator = Bed::query()
            ->where('status', 2)
            ->when(
                ! empty($filters['institutionId']),
                fn ($q) => $q->where('institution_id', $filters['institutionId'])
            )
            ->orderBy('bed_id')
            ->paginate($this->pageSize($filters), ['*'], 'pageNum', $this->pageNum($filters));

        $items = collect($paginator->items());

        $orgNames = Organization::query()
            ->whereIn('org_code', $items->pluck('institution_id')->unique()->all())
            ->pluck('org_name', 'org_code');

        $list = $items->map(fn (Bed $bed) => [
            'bedId' => $bed->bed_id,
            'label' => $bed->label,
            'institutionId' => $bed->institution_id,
            'institutionName' => $orgNames[$bed->institution_id] ?? '',
            'departmentId' => $bed->department_id,
            'departmentName' => $this->departmentName($bed->institution_id, $bed->department_id),
            'reserveReason' => $bed->reserve_reason,
            'reservedUntil' => optional($bed->reserved_until)->toIso8601String(),
        ])->values()->all();

        return [
            'updatedAt' => now()->toIso8601String(),
            'total' => $paginator->total(),
            'list' => $list,
        ];
    }

    /**
     * 机构床位分布（§3.7）
     */
    public function distribution(?string $institutionId): array
    {
        $beds = Bed::query()
            ->when(
                $institutionId !== null && $institutionId !== '',
                fn ($q) => $q->where('institution_id', $institutionId)
            )
            ->get();

        $orgs = Organization::query()
            ->whereIn('org_code', $beds->pluck('institution_id')->unique()->all())
            ->get(['org_code', 'org_name', 'tier'])
            ->keyBy('org_code');

        $institutions = $beds->groupBy('institution_id')->map(function ($group, $institutionId) use ($orgs) {
            $t = $group->count();
            $o = $group->where('status', 1)->count();

            $departments = DepartmentBed::query()
                ->where('hospital_id', $institutionId)
                ->orderBy('dept_id')
                ->get()
                ->map(fn (DepartmentBed $d) => [
                    'departmentId' => $d->dept_id,
                    'name' => $d->name,
                    'total' => (int) $d->total,
                    'occupied' => (int) $d->occupied,
                    'reserved' => (int) $d->reserved,
                    'free' => (int) $d->free,
                ])->values()->all();

            return [
                'institutionId' => (string) $institutionId,
                'institutionName' => $orgs[$institutionId]->org_name ?? '',
                'tier' => (int) ($orgs[$institutionId]->tier ?? 0),
                'total' => $t,
                'occupied' => $o,
                'reserved' => $group->where('status', 2)->count(),
                'free' => $group->where('status', 0)->count(),
                'occupancyRate' => $this->rate($o, $t),
                'departments' => $departments,
            ];
        })->values()->all();

        return [
            'updatedAt' => now()->toIso8601String(),
            'institutions' => $institutions,
        ];
    }

    /**
     * 按床位编号取床位，不存在则 404
     */
    private function findBed(string $bedId): Bed
    {
        $bed = Bed::query()->where('bed_id', $bedId)->first();
        $this->assert($bed !== null, ResponseCode::NOT_FOUND, '床位不存在');

        return $bed;
    }

    /**
     * 科室名称：优先取科室床位台账
     */
    private function departmentName(string $institutionId, string $departmentId): string
    {
        return DepartmentBed::query()
            ->where('hospital_id', $institutionId)
            ->where('dept_id', $departmentId)
            ->value('name') ?? '';
    }

    private function rate(int $occupied, int $total): float
    {
        return $total > 0 ? round($occupied / $total * 100, 1) : 0.0;
    }

    private function gender(?int $gender): string
    {
        return $gender === 1 ? 'FEMALE' : 'MALE';
    }

    private function genderLabel(?int $gender): string
    {
        return $gender === 1 ? '女' : '男';
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
