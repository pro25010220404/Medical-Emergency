<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrganizationResourceService extends JsonResource
{
    private const LEVEL_LABELS = [
        'center' => '中心医院',
        'city' => '市级医院',
        'county' => '县级医院',
        'township' => '乡镇卫生院',
        'village' => '村卫生室',
    ];

    public function toArray(Request $request): array
    {
        return [
            'orgId' => $this->org_code,
            'name' => $this->org_name,
            'shortName' => $this->short_name,
            'level' => $this->level,
            'levelLabel' => self::LEVEL_LABELS[$this->level] ?? '',
            'province' => $this->province,
            'city' => $this->city,
            'county' => $this->county_name,
            'town' => $this->town,
            'verified' => (bool) $this->verified,
            'currentOperationVerified' => (bool) $this->current_operation_verified,
            'verificationScope' => $this->verification_scope,
        ];
    }
}
