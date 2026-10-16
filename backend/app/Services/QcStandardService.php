<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class QcStandardService extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'version' => $this->version,
            'standard_name' => $this->standard_name,
            'category' => $this->category,
            'target_rate' => $this->target_rate,
            'sort' => $this->sort,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
