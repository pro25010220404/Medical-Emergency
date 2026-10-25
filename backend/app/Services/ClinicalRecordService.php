<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ClinicalRecordService extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'record_code' => $this->record_code,
            'patient_id' => $this->patient_id,
            'patient' => new PatientService($this->whenLoaded('patient')),
            'doctor_user_id' => $this->doctor_user_id,
            'doctor_name' => $this->whenLoaded('doctor', fn () => $this->doctor?->real_name),
            'org_id' => $this->org_id,
            'org' => new OrganizationService($this->whenLoaded('organization')),
            'record_type' => $this->record_type,
            'chief_complaint' => $this->chief_complaint,
            'present_history' => $this->present_history,
            'diagnosis' => $this->diagnosis,
            'treatment' => $this->treatment,
            'visit_at' => $this->visit_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
