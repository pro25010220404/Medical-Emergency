<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSlaRecordRequest;
use App\Http\Requests\UpdateSlaRecordRequest;
use App\Services\SlaRecordService;
use App\Models\SlaRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SlaRecordController extends Controller
{
    /**
     * 时限规则（对齐 qc-sla.json，规则为系统约定常量）
     */
    private const RULES = [
        ['id' => 'SLA-ALERT', 'name' => '预警后到床', 'limitMinutes' => 10, 'audience' => '当班医生 · 看自己负责患者是否超时'],
        ['id' => 'SLA-DISPATCH', 'name' => '出警后到院', 'limitMinutes' => 30, 'audience' => '护士长 / 院长 · 看出车环节超时'],
    ];

    /**
     * 环节时限台账（对齐前端 qc-sla.json 契约：rules + records）
     */
    public function index(Request $request): JsonResponse
    {
        $query = SlaRecord::query()
            ->when($request->input('rule_id'), fn ($q, $v) => $q->where('rule_id', $v))
            ->when($request->input('role_view'), fn ($q, $v) => $q->where('role_view', $v))
            ->when($request->has('overtime'), fn ($q) => $q->where('overtime', $request->boolean('overtime')))
            ->orderByDesc('started_at');

        $records = $query->get();

        return response()->json([
            'updatedAt' => now()->toIso8601String(),
            'rules' => self::RULES,
            'records' => SlaRecordService::collection($records),
        ]);
    }

    /**
     * 登记时限记录（自动计算已用分钟与是否超时）
     */
    public function store(StoreSlaRecordRequest $request): JsonResponse
    {
        $record = SlaRecord::create($this->withUsage($request->validated()));

        return (new SlaRecordService($record))
            ->response()
            ->setStatusCode(201);
    }

    public function show(SlaRecord $slaRecord): SlaRecordService
    {
        return new SlaRecordService($slaRecord);
    }

    /**
     * 更新时限记录（如补登到达时间，重算超时）
     */
    public function update(UpdateSlaRecordRequest $request, SlaRecord $slaRecord): SlaRecordService
    {
        $data = array_merge($slaRecord->only(['started_at', 'arrived_at', 'limit_minutes']), $request->validated());
        $slaRecord->update($this->withUsage($data));

        return new SlaRecordService($slaRecord);
    }

    public function destroy(SlaRecord $slaRecord): Response
    {
        $slaRecord->delete();

        return response()->noContent();
    }

    /**
     * 计算已用分钟数与超时标记：到达则按实际用时，未到达按当前计时
     */
    private function withUsage(array $data): array
    {
        $startedAt = \Carbon\Carbon::parse($data['started_at']);
        $endAt = isset($data['arrived_at']) && $data['arrived_at'] ? \Carbon\Carbon::parse($data['arrived_at']) : now();

        $used = (int) $startedAt->diffInMinutes($endAt, false);
        $data['used_minutes'] = max(0, $used);
        $data['overtime'] = $data['used_minutes'] > ($data['limit_minutes'] ?? PHP_INT_MAX);

        return $data;
    }
}
