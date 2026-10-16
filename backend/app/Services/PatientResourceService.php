<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PatientResourceService extends JsonResource
{
    /** 性别：0男1女2未知 ↔ MALE/FEMALE/UNKNOWN */
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

    public function toArray(Request $request): array
    {
        return [
            'patientId' => $this->patient_id,
            'name' => $this->name,
            'gender' => self::GENDER_CODES[$this->gender] ?? 'UNKNOWN',
            'genderLabel' => self::GENDER_LABELS[$this->gender] ?? '未知',
            'age' => $this->age === null ? null : (int) $this->age,
            'idCard' => $this->id_card,
            'phone' => $this->phone,
            'institutionId' => $this->institution_id,
            'departmentId' => $this->department_id,
            'stage' => $this->stage,
            'stageLabel' => self::STAGE_LABELS[$this->stage] ?? $this->stage,
            'chiefComplaint' => $this->chief_complaint,
            'symptoms' => $this->symptoms ?? [],
            'notes' => $this->notes,
            'source' => $this->source,
            'createdAt' => $this->created_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
        ];
    }
}
