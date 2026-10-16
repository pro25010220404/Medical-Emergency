<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VehicleService extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'plate_number' => $this->plate_number,
            'vehicle_type' => $this->vehicle_type,
            'vehicle_status' => $this->vehicle_status,
            'driver_name' => $this->driver_name,
            'driver_phone' => $this->driver_phone,
            'latest_lng' => $this->latest_lng,
            'latest_lat' => $this->latest_lat,
            'latest_at' => $this->latest_at?->toIso8601String(),
            'organization' => new OrganizationResourceService($this->whenLoaded('organization')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
