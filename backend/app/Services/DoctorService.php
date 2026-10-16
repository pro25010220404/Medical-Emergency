<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DoctorService extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'real_name' => $this->real_name,
            'username' => $this->username,
            'org_id' => $this->org_id,
            'org' => new OrganizationService($this->whenLoaded('organization')),
            'phone' => $this->phone,
            'email' => $this->email,
            'identity_type' => $this->identity_type,
            'home_route' => $this->home_route,
            'user_status' => $this->user_status,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
