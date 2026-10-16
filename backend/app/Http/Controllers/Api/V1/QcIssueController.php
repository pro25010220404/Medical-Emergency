<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreQcIssueRequest;
use App\Http\Requests\UpdateQcIssueRequest;
use App\Services\QcIssueService;
use App\Models\QcIssue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class QcIssueController extends Controller
{
    /**
     * 质控问题列表（整改台账）
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = QcIssue::query()->with('owner');

        $query->when($request->input('qc_status'), fn ($q, $v) => $q->where('qc_status', $v))
            ->when($request->input('severity'), fn ($q, $v) => $q->where('severity', $v))
            ->when($request->input('owner_user_id'), fn ($q, $v) => $q->where('owner_user_id', $v))
            ->when($request->input('event_id'), fn ($q, $v) => $q->where('event_id', $v))
            // 超期预警：未关闭且已过整改期限
            ->when($request->boolean('overdue'), fn ($q) => $q->where('qc_status', '!=', 'QC_CLOSED')->where('due_at', '<', now()))
            ->when($request->input('keyword'), function ($q, $v) {
                $q->where(function ($sub) use ($v) {
                    $sub->where('qc_code', 'like', "%{$v}%")
                        ->orWhere('issue_title', 'like', "%{$v}%")
                        ->orWhere('supervise_target', 'like', "%{$v}%");
                });
            });

        $issues = $query->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 15))
            ->appends($request->query());

        return QcIssueService::collection($issues);
    }

    /**
     * 登记质控问题
     */
    public function store(StoreQcIssueRequest $request): JsonResponse
    {
        $issue = QcIssue::create($request->validated());
        $issue->refresh();
        $issue->load('owner');

        return (new QcIssueService($issue))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * 整改单详情
     */
    public function show(QcIssue $qcIssue): QcIssueService
    {
        $qcIssue->load(['owner', 'event']);

        return new QcIssueService($qcIssue);
    }

    /**
     * 更新整改单（乐观锁：state_version 不一致返回 409）
     */
    public function update(UpdateQcIssueRequest $request, QcIssue $qcIssue): JsonResponse|QcIssueService
    {
        $data = $request->validated();
        $version = $data['state_version'];
        unset($data['state_version']);
        $data['state_version'] = $version + 1;

        $affected = QcIssue::whereKey($qcIssue->id)
            ->where('state_version', $version)
            ->update($data);

        if ($affected === 0) {
            return response()->json(['message' => '数据已被他人修改，请刷新后重试'], 409);
        }

        $qcIssue->refresh();
        $qcIssue->load('owner');

        return new QcIssueService($qcIssue);
    }

    /**
     * 销号（整改闭环）：QC_OPEN / QC_RECTIFYING → QC_CLOSED
     */
    public function close(Request $request, QcIssue $qcIssue): JsonResponse|QcIssueService
    {
        $validated = $request->validate([
            'check_result' => ['required', 'string', 'max:200'],
            'state_version' => ['required', 'integer', 'min:1'],
        ], [], ['check_result' => '检查结果', 'state_version' => '状态版本']);

        // 是否按期完成：当前时间不超过整改期限
        $onTime = $qcIssue->due_at === null || now()->lte($qcIssue->due_at);

        $affected = QcIssue::whereKey($qcIssue->id)
            ->where('state_version', $validated['state_version'])
            ->where('qc_status', '!=', 'QC_CLOSED')
            ->update([
                'qc_status' => 'QC_CLOSED',
                'check_result' => $validated['check_result'],
                'is_on_time_completed' => $onTime,
                'state_version' => $validated['state_version'] + 1,
                'updated_at' => now(),
            ]);

        if ($affected === 0) {
            return response()->json(['message' => '数据已被他人修改或已销号，请刷新后重试'], 409);
        }

        $qcIssue->refresh();
        $qcIssue->load('owner');

        return new QcIssueService($qcIssue);
    }

    /**
     * 质控报表统计（/medical-quality/reports：级别分布 / 状态分布 / 机构统计）
     */
    public function report(): JsonResponse
    {
        $base = QcIssue::query();

        $bySeverity = (clone $base)->selectRaw('severity, COUNT(*) as total')
            ->groupBy('severity')->pluck('total', 'severity');

        $byStatus = (clone $base)->selectRaw('qc_status, COUNT(*) as total')
            ->groupBy('qc_status')->pluck('total', 'qc_status');

        // 机构统计：按督查对象分组，含按期完成率
        $byOrg = (clone $base)->whereNotNull('supervise_target')
            ->selectRaw("supervise_target, COUNT(*) as total,
                SUM(CASE WHEN qc_status = 'QC_CLOSED' THEN 1 ELSE 0 END) as closed,
                SUM(CASE WHEN is_on_time_completed THEN 1 ELSE 0 END) as on_time,
                SUM(CASE WHEN qc_status != 'QC_CLOSED' AND due_at < NOW() THEN 1 ELSE 0 END) as overdue")
            ->groupBy('supervise_target')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'supervise_target' => $row->supervise_target,
                'total' => (int) $row->total,
                'closed' => (int) $row->closed,
                'overdue' => (int) $row->overdue,
                'on_time_rate' => $row->closed > 0 ? round($row->on_time / $row->closed, 4) : null,
            ]);

        return response()->json([
            'updatedAt' => now()->toIso8601String(),
            'total' => (clone $base)->count(),
            'by_severity' => $bySeverity,
            'by_status' => $byStatus,
            'by_org' => $byOrg,
        ]);
    }

    /**
     * 整改台账导出 CSV
     */
    public function export(): StreamedResponse
    {
        $headers = ['质控编号', '问题标题', '严重程度', '督查对象', '质控状态', '整改期限', '是否按期完成', '检查结果', '发现日期'];

        return response()->streamDownload(function () use ($headers) {
            $out = fopen('php://output', 'w');
            // UTF-8 BOM，避免 Excel 打开乱码
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $headers);

            QcIssue::query()->with('owner')->orderByDesc('created_at')->chunk(200, function ($issues) use ($out) {
                foreach ($issues as $issue) {
                    fputcsv($out, [
                        $issue->qc_code,
                        $issue->issue_title,
                        $issue->severity,
                        $issue->supervise_target,
                        $issue->qc_status,
                        $issue->due_at?->toDateTimeString(),
                        $issue->is_on_time_completed === null ? '' : ($issue->is_on_time_completed ? '是' : '否'),
                        $issue->check_result,
                        $issue->discovered_at?->toDateString(),
                    ]);
                }
            });

            fclose($out);
        }, 'qc-issues-'.now()->format('YmdHis').'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * 删除整改单（软删除）
     */
    public function destroy(QcIssue $qcIssue): Response
    {
        $qcIssue->delete();

        return response()->noContent();
    }
}
