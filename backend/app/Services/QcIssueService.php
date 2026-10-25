<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QcIssueService extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'qc_code' => $this->qc_code,
            'issue_title' => $this->issue_title,
            'severity' => $this->severity,
            'issue_source' => $this->issue_source,
            'owner_user_id' => $this->owner_user_id,
            'owner_name' => $this->whenLoaded('owner', fn () => $this->owner?->real_name),
            'current_stage' => $this->current_stage,
            'qc_status' => $this->qc_status,
            'state_version' => $this->state_version,
            'due_at' => $this->due_at?->toIso8601String(),
            'related_type' => $this->related_type,
            'related_id' => $this->related_id,
            'supervise_target' => $this->supervise_target,
            'check_method' => $this->check_method,
            'check_item' => $this->check_item,
            'check_result' => $this->check_result,
            'discovered_at' => $this->discovered_at?->toDateString(),
            'is_on_time_completed' => $this->is_on_time_completed,
            'event_id' => $this->event_id,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
