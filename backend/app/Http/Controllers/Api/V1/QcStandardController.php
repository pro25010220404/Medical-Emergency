<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreQcStandardRequest;
use App\Http\Requests\UpdateQcStandardRequest;
use App\Services\QcStandardService;
use App\Models\QcIssue;
use App\Models\QcStandard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class QcStandardController extends Controller
{
    /**
     * 标准列表（可按版本筛选）
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $standards = QcStandard::query()
            ->when($request->input('version'), fn ($q, $v) => $q->where('version', $v))
            ->when($request->has('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('version')
            ->orderBy('sort')
            ->paginate($request->integer('per_page', 50))
            ->appends($request->query());

        return QcStandardService::collection($standards);
    }

    /**
     * 新增标准
     */
    public function store(StoreQcStandardRequest $request): JsonResponse
    {
        $standard = QcStandard::create($request->validated());

        return (new QcStandardService($standard))
            ->response()
            ->setStatusCode(201);
    }

    public function show(QcStandard $qcStandard): QcStandardService
    {
        return new QcStandardService($qcStandard);
    }

    public function update(UpdateQcStandardRequest $request, QcStandard $qcStandard): QcStandardService
    {
        $qcStandard->update($request->validated());

        return new QcStandardService($qcStandard);
    }

    public function destroy(QcStandard $qcStandard): Response
    {
        $qcStandard->delete();

        return response()->noContent();
    }

    /**
     * 质控标准汇总（对齐前端 qc-standards.json 契约）
     * version / standards[].complianceRate / recentEvents[]
     */
    public function summary(): JsonResponse
    {
        // 取最新启用版本
        $version = QcStandard::query()->where('is_active', true)->max('version');

        $standards = QcStandard::query()
            ->where('is_active', true)
            ->when($version, fn ($q) => $q->where('version', $version))
            ->orderBy('sort')
            ->get();

        // 各标准合规率：关联整改单中按期完成占比，无关联单时回退目标值
        $stats = QcIssue::query()
            ->where('related_type', 'QC_STANDARD')
            ->whereIn('related_id', $standards->pluck('id'))
            ->where('qc_status', 'QC_CLOSED')
            ->selectRaw('related_id, COUNT(*) as total, SUM(CASE WHEN is_on_time_completed THEN 1 ELSE 0 END) as on_time')
            ->groupBy('related_id')
            ->get()
            ->keyBy('related_id');

        $standardList = $standards->map(function (QcStandard $s) use ($stats) {
            $stat = $stats->get($s->id);
            $rate = $stat && $stat->total > 0
                ? round($stat->on_time / $stat->total, 4)
                : $s->target_rate;

            return [
                'id' => (string) $s->id,
                'name' => $s->standard_name,
                'target' => $s->category,
                'samplePeriod' => '月',
                'complianceRate' => $rate,
            ];
        });

        // 近期抽检：最新 10 条质控问题
        $recentEvents = QcIssue::query()
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn (QcIssue $issue) => [
                'at' => ($issue->discovered_at ?? $issue->created_at)?->toIso8601String(),
                'standardId' => $issue->related_type === 'QC_STANDARD' ? (string) $issue->related_id : null,
                'ok' => $issue->check_result === '达标' || $issue->is_on_time_completed === true,
                'note' => $issue->issue_title,
            ]);

        return response()->json([
            'version' => $version,
            'updatedAt' => now()->toIso8601String(),
            'standards' => $standardList,
            'recentEvents' => $recentEvents,
        ]);
    }
}
