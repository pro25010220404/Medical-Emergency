<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventTimelineService extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'node_type' => $this->node_type,
            'node_title' => $this->node_title,
            'content' => $this->content,
            'occurred_at' => $this->occurred_at?->toIso8601String(),
            'operator_user_id' => $this->operator_user_id,
        ];
    }
}
