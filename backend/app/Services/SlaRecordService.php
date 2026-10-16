<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SlaRecordService extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->sla_code,
            'kind' => $this->kind,
            'ruleId' => $this->rule_id,
            'subject' => $this->subject,
            'owner' => $this->owner,
            'roleView' => $this->role_view,
            'startedAt' => $this->started_at?->toIso8601String(),
            'arrivedAt' => $this->arrived_at?->toIso8601String(),
            'limitMinutes' => $this->limit_minutes,
            'usedMinutes' => $this->used_minutes,
            'overtime' => $this->overtime,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
