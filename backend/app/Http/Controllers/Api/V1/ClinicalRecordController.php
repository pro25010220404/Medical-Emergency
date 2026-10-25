<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreClinicalRecordRequest;
use App\Http\Requests\UpdateClinicalRecordRequest;
use App\Services\ClinicalRecordService;
use App\Models\ClinicalRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class ClinicalRecordController extends Controller
{
    /**
     * 诊疗记录列表（按患者 / 医生 / 机构 / 类型 / 时间筛选）
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = ClinicalRecord::query()->with(['patient', 'doctor', 'organization']);

        $query->when($request->input('patient_id'), fn ($q, $v) => $q->where('patient_id', $v))
            ->when($request->input('doctor_user_id'), fn ($q, $v) => $q->where('doctor_user_id', $v))
            ->when($request->input('org_id'), fn ($q, $v) => $q->where('org_id', $v))
            ->when($request->input('record_type'), fn ($q, $v) => $q->where('record_type', $v))
            ->when($request->input('visit_from'), fn ($q, $v) => $q->where('visit_at', '>=', $v))
            ->when($request->input('visit_to'), fn ($q, $v) => $q->where('visit_at', '<=', $v))
            ->when($request->input('keyword'), function ($q, $v) {
                $q->where(function ($sub) use ($v) {
                    $sub->where('record_code', 'like', "%{$v}%")
                        ->orWhere('chief_complaint', 'like', "%{$v}%")
                        ->orWhere('diagnosis', 'like', "%{$v}%");
                });
            });

        $records = $query->orderByDesc('visit_at')
            ->paginate($request->integer('per_page', 15))
            ->appends($request->query());

        return ClinicalRecordService::collection($records);
    }

    /**
     * 新增诊疗记录（基层医生接诊录入）
     */
    public function store(StoreClinicalRecordRequest $request): JsonResponse
    {
        $record = ClinicalRecord::create($request->validated());
        $record->refresh();
        $record->load(['patient', 'doctor', 'organization']);

        return (new ClinicalRecordService($record))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * 诊疗记录详情
     */
    public function show(ClinicalRecord $clinicalRecord): ClinicalRecordService
    {
        $clinicalRecord->load(['patient', 'doctor', 'organization']);

        return new ClinicalRecordService($clinicalRecord);
    }

    /**
     * 更新诊疗记录
     */
    public function update(UpdateClinicalRecordRequest $request, ClinicalRecord $clinicalRecord): ClinicalRecordService
    {
        $clinicalRecord->update($request->validated());
        $clinicalRecord->load(['patient', 'doctor', 'organization']);

        return new ClinicalRecordService($clinicalRecord);
    }

    /**
     * 删除诊疗记录（软删除）
     */
    public function destroy(ClinicalRecord $clinicalRecord): Response
    {
        $clinicalRecord->delete();

        return response()->noContent();
    }
}
