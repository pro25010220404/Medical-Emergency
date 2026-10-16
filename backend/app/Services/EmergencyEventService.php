<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EmergencyEventService extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event_code' => $this->event_code,
            'event_source' => $this->event_source,
            'occurred_at' => $this->occurred_at?->toIso8601String(),
            'eta' => $this->eta?->toIso8601String(),
            'scene_address' => $this->scene_address,
            'scene_phone' => $this->scene_phone,
            'symptom_duration' => $this->symptom_duration,
            'consciousness' => $this->consciousness,
            'provisional_dx' => $this->provisional_dx,
            'triage_level' => $this->triage_level,
            'channel_type' => $this->channel_type,
            'target_dept_name' => $this->target_dept_name,
            'transport_mode' => $this->transport_mode,
            'scene_vitals' => [
                'hr' => $this->scene_hr,
                'sbp' => $this->scene_sbp,
                'dbp' => $this->scene_dbp,
                'spo2' => $this->scene_spo2,
                'rr' => $this->scene_rr,
                'temp' => $this->scene_temp,
            ],
            /** 业务编号 PAT-xxx（非 emergency_events.patient_id 外键整数） */
            'patient_id' => $this->relationLoaded('patient') && $this->patient
                ? $this->patient->patient_id
                : null,
            'patient_name' => $this->relationLoaded('patient') && $this->patient
                ? $this->patient->name
                : null,
            'patient_mode' => $this->patient_mode,
            'temp_gender' => $this->temp_gender,
            'temp_summary' => $this->temp_summary,
            'chief' => $this->chief,
            'risk_level' => $this->risk_level,
            'event_stage' => $this->event_stage,
            'event_status' => $this->event_status,
            'close_reason' => $this->close_reason,
            'closed_at' => $this->closed_at?->toIso8601String(),
            'accept_org' => new OrganizationService($this->whenLoaded('acceptOrg')),
            'patient' => new PatientService($this->whenLoaded('patient')),
            'timelines' => EventTimelineService::collection($this->whenLoaded('timelines')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
