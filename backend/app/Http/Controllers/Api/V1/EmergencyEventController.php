<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEmergencyEventRequest;
use App\Http\Requests\StoreEventTimelineRequest;
use App\Http\Requests\UpdateEmergencyEventRequest;
use App\Services\EmergencyEventService;
use App\Services\EventTimelineService;
use App\Models\EmergencyEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class EmergencyEventController extends Controller
{
    /**
     * 急救事件列表（急救事件页 / 实时出警页）
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = EmergencyEvent::query()->with(['acceptOrg', 'patient']);

        // 实时出警：进行中事件
        if ($request->boolean('active')) {
            $query->where('event_status', 'EVENT_ACTIVE');
        }

        $query->when($request->input('event_status'), fn ($q, $v) => $q->where('event_status', $v))
            ->when($request->input('event_stage'), fn ($q, $v) => $q->where('event_stage', $v))
            ->when($request->input('triage_level'), fn ($q, $v) => $q->where('triage_level', $v))
            ->when($request->input('risk_level'), fn ($q, $v) => $q->where('risk_level', $v))
            ->when($request->input('accept_org_id'), fn ($q, $v) => $q->where('accept_org_id', $v))
            ->when($request->input('occurred_from'), fn ($q, $v) => $q->where('occurred_at', '>=', $v))
            ->when($request->input('occurred_to'), fn ($q, $v) => $q->where('occurred_at', '<=', $v))
            ->when($request->input('keyword'), function ($q, $v) {
                $q->where(function ($sub) use ($v) {
                    $sub->where('event_code', 'like', "%{$v}%")
                        ->orWhere('scene_address', 'like', "%{$v}%")
                        ->orWhere('chief', 'like', "%{$v}%");
                });
            });

        $events = $query->orderByDesc('occurred_at')
            ->paginate($request->integer('per_page', 15))
            ->appends($request->query());

        return EmergencyEventService::collection($events);
    }

    /**
     * 创建急救事件（患者登记 / 接警录入）
     */
    public function store(StoreEmergencyEventRequest $request): JsonResponse
    {
        $event = EmergencyEvent::create($request->validated());
        // 刷新以取回数据库默认值（event_status / event_stage 等）
        $event->refresh();
        $event->load(['acceptOrg', 'patient']);

        return (new EmergencyEventService($event))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * 事件详情（含时间线）
     */
    public function show(EmergencyEvent $emergencyEvent): EmergencyEventService
    {
        $emergencyEvent->load(['acceptOrg', 'patient', 'timelines']);

        return new EmergencyEventService($emergencyEvent);
    }

    /**
     * 更新事件（分诊 / 状态流转 / 补充信息）
     */
    public function update(UpdateEmergencyEventRequest $request, EmergencyEvent $emergencyEvent): EmergencyEventService
    {
        $emergencyEvent->update($request->validated());
        $emergencyEvent->load(['acceptOrg', 'patient']);

        return new EmergencyEventService($emergencyEvent);
    }

    /**
     * 关闭事件
     */
    public function close(Request $request, EmergencyEvent $emergencyEvent): EmergencyEventService
    {
        $validated = $request->validate([
            'close_reason' => ['required', 'string'],
            'closed_by_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ], [], ['close_reason' => '关闭原因']);

        $emergencyEvent->update([
            'event_status' => 'EVENT_CLOSED',
            'closed_at' => now(),
            'close_reason' => $validated['close_reason'],
            'closed_by_user_id' => $validated['closed_by_user_id'] ?? null,
        ]);

        return new EmergencyEventService($emergencyEvent);
    }

    /**
     * 实时出警聚合（对齐前端 dispatch-live.json 契约）
     */
    public function dispatchLive(): JsonResponse
    {
        $events = EmergencyEvent::query()
            ->where('event_status', 'EVENT_ACTIVE')
            ->with(['acceptOrg', 'transfers.vehicle'])
            ->orderByDesc('occurred_at')
            ->get()
            ->map(function (EmergencyEvent $event) {
                // 取最近一张已派车的转诊单获取车辆
                $transfer = $event->transfers->whereNotNull('transport_vehicle_id')->sortByDesc('created_at')->first();

                return [
                    'id' => $event->event_code,
                    'task120Id' => $event->event_code,
                    'level' => $event->risk_level ?? $event->triage_level,
                    'chiefComplaint' => $event->chief,
                    'pickupAddress' => $event->scene_address,
                    'destination' => $event->target_dept_name ?? $event->acceptOrg?->org_name,
                    'vehicleId' => $transfer?->transport_vehicle_id,
                    'vehiclePlate' => $transfer?->vehicle?->plate_number,
                    'status' => $event->event_stage,
                    'startedAt' => $event->occurred_at?->toIso8601String(),
                    'etaHospitalMinutes' => $event->eta ? (int) now()->diffInMinutes($event->eta, false) : null,
                    'etaPatientMinutes' => null,
                    'scorePlan' => $event->channel_type,
                    'treatPlan' => $event->provisional_dx,
                ];
            });

        return response()->json([
            'updatedAt' => now()->toIso8601String(),
            'activeCount' => $events->count(),
            'events' => $events->values(),
        ]);
    }

    /**
     * 追加事件时间线节点（阶段推进记录）
     */
    public function storeTimeline(StoreEventTimelineRequest $request, EmergencyEvent $emergencyEvent): JsonResponse
    {
        $timeline = $emergencyEvent->timelines()->create($request->validated());

        return (new EventTimelineService($timeline))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * 删除事件（软删除）
     */
    public function destroy(EmergencyEvent $emergencyEvent): Response
    {
        $emergencyEvent->delete();

        return response()->noContent();
    }
}
