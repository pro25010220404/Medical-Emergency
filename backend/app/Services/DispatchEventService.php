<?php

namespace App\Services;

use App\Enums\ResponseCode;
use App\Models\EmergencyEvent;
use App\Models\Vehicle;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DispatchEventService extends Service
{
    /** 事件来源：120 接警建档 */
    private const EVENT_SOURCE = 'SOURCE_120';

    private const STATUS_MAP = [
        'STANDBY' => 0,
        'DISPATCHING' => 1,
        'ON_SCENE' => 2,
        'RETURNING' => 3,
    ];

    private const STATUS_LABELS = [
        0 => '待命',
        1 => '出警中',
        2 => '现场处置',
        3 => '返院途中',
    ];

    private const LEVEL_MAP = [
        'CRITICAL' => 0,
        'ACUTE' => 1,
        'GENERAL' => 2,
    ];

    private const LEVEL_LABELS = [
        0 => '重症',
        1 => '急症',
        2 => '一般',
    ];

    /**
     * 急救事件列表（当日；status 支持逗号分隔的枚举名过滤）
     */
    public function paginate(array $filters): array
    {
        $date = ! empty($filters['date']) ? (string) $filters['date'] : now()->toDateString();
        $pageNum = max(1, (int) ($filters['pageNum'] ?? 1));
        $pageSize = min(200, max(1, (int) ($filters['pageSize'] ?? 50)));

        $base = EmergencyEvent::query()->whereDate('occurred_at', $date);
        $activeCount = (clone $base)->where('status', '>', self::STATUS_MAP['STANDBY'])->count();

        $query = clone $base;
        $statuses = $this->parseStatuses($filters['status'] ?? null);
        if ($statuses !== null) {
            $query->whereIn('status', $statuses);
        }

        $total = (clone $query)->count();
        $items = $query->orderBy('status')
            ->orderBy('started_at')
            ->forPage($pageNum, $pageSize)
            ->get();

        return [
            'updatedAt' => now()->toIso8601String(),
            'activeCount' => $activeCount,
            'total' => $total,
            'list' => $items->map(fn (EmergencyEvent $event) => $this->item($event))->values()->all(),
            'pageNum' => $pageNum,
            'pageSize' => $pageSize,
        ];
    }

    /**
     * 接警建档：创建急救事件，初始状态为出警中
     */
    public function create(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $user = auth()->user();
            $level = self::LEVEL_MAP[$data['level'] ?? 'GENERAL'] ?? self::LEVEL_MAP['GENERAL'];
            $startedAt = ! empty($data['startedAt']) ? Carbon::parse($data['startedAt']) : now();

            $event = EmergencyEvent::create([
                'event_code' => $this->nextEventCode(),
                'task120_id' => $data['task120Id'],
                'level' => $level,
                'chief' => $data['chiefComplaint'],
                'scene_address' => $data['pickupAddress'],
                'destination' => $data['destination'] ?? '',
                'status' => self::STATUS_MAP['DISPATCHING'],
                'started_at' => $startedAt,
                'occurred_at' => now(),
                'event_source' => self::EVENT_SOURCE,
                'accept_org_id' => $user?->org_id ?? 0,
                'accepted_by_user_id' => $user?->id,
                'event_status' => 'EVENT_ACTIVE',
            ]);

            return [
                'eventId' => $event->event_code,
                'task120Id' => $event->task120_id,
                'status' => $this->statusName((int) $event->status),
            ];
        });
    }

    /**
     * 事件详情（按事件编号）
     */
    public function detail(string $eventId): array
    {
        $event = EmergencyEvent::query()->where('event_code', $eventId)->first();
        $this->assert($event !== null, ResponseCode::NOT_FOUND, '事件不存在');

        return $this->item($event);
    }

    /**
     * 事件状态流转（出警中 → 现场处置 → 返院途中），并同步车辆状态
     */
    public function updateStatus(string $eventId, string $status): array
    {
        return DB::transaction(function () use ($eventId, $status) {
            $event = EmergencyEvent::query()->where('event_code', $eventId)->first();
            $this->assert($event !== null, ResponseCode::NOT_FOUND, '事件不存在');

            $target = self::STATUS_MAP[$status] ?? null;
            $this->assert($target !== null, ResponseCode::BAD_REQUEST, '目标状态不合法');

            // 非法回退：目标序号小于当前序号（如 RETURNING → DISPATCHING）
            $this->assert($target >= (int) $event->status, ResponseCode::BAD_REQUEST, '非法状态流转');

            $event->status = $target;
            $event->save();

            if ($event->vehicle_id) {
                Vehicle::query()->where('vehicle_id', $event->vehicle_id)->update(['status' => $target]);
            }

            return [
                'eventId' => $event->event_code,
                'status' => $this->statusName($target),
                'statusLabel' => self::STATUS_LABELS[$target] ?? '',
            ];
        });
    }

    /**
     * 解析逗号分隔的状态枚举名，返回 tinyint 集合；未传返回 null（不过滤）
     */
    private function parseStatuses(mixed $raw): ?array
    {
        if ($raw === null || $raw === '') {
            return null;
        }

        $names = array_filter(array_map('trim', explode(',', (string) $raw)));
        $mapped = [];
        foreach ($names as $name) {
            if (isset(self::STATUS_MAP[$name])) {
                $mapped[] = self::STATUS_MAP[$name];
            }
        }

        return array_values(array_unique($mapped));
    }

    private function statusName(int $status): string
    {
        return array_search($status, self::STATUS_MAP, true) ?: '';
    }

    /**
     * 生成事件编号 EVT-{Ymd}-{两位序号}
     */
    private function nextEventCode(): string
    {
        $prefix = 'EVT-'.now()->format('Ymd').'-';
        $seq = EmergencyEvent::withTrashed()->where('event_code', 'like', $prefix.'%')->count() + 1;

        do {
            $code = $prefix.str_pad((string) $seq, 2, '0', STR_PAD_LEFT);
            $seq++;
        } while (EmergencyEvent::withTrashed()->where('event_code', $code)->exists());

        return $code;
    }

    private function item(EmergencyEvent $event): array
    {
        $level = (int) $event->level;

        return [
            'eventId' => $event->event_code,
            'task120Id' => $event->task120_id,
            'level' => array_search($level, self::LEVEL_MAP, true) ?: 'GENERAL',
            'levelLabel' => self::LEVEL_LABELS[$level] ?? '',
            'chiefComplaint' => $event->chief,
            'pickupAddress' => $event->scene_address,
            'destination' => $event->destination,
            'vehicleId' => $event->vehicle_id ?: null,
            'vehiclePlate' => $event->vehicle_plate ?: null,
            'status' => $this->statusName((int) $event->status),
            'statusLabel' => self::STATUS_LABELS[(int) $event->status] ?? '',
            'startedAt' => $event->started_at?->toIso8601String(),
            'etaHospitalMinutes' => (int) $event->eta_hospital_minutes,
            'etaPatientMinutes' => $event->eta_patient_minutes !== null ? (int) $event->eta_patient_minutes : null,
            'scorePlan' => $event->score_plan,
            'treatPlan' => $event->treat_plan,
        ];
    }
}
