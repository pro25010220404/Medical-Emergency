<?php

namespace App\Services;

use App\Enums\ResponseCode;
use App\Exceptions\BusinessException;
use App\Models\Department;
use App\Models\Organization;
use App\Models\OrganizationMember;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * 机构名录、科室结构与权限范围
 * 同时作为机构 JSON 资源输出（原 OrganizationResource）。
 */
class OrganizationService extends JsonResource
{
    public function __construct($resource = null)
    {
        parent::__construct($resource);
    }

    /**
     * 业务断言，条件不满足时抛出业务异常
     */
    protected function assert(bool $condition, ResponseCode $code, ?string $message = null): void
    {
        if (! $condition) {
            throw new BusinessException($code, $message);
        }
    }

    /**
     * 机构 JSON 资源输出（嵌套于事件 / 医生 / 诊疗记录等场景）
     */
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

    private const LEVEL_LABELS = [
        'center' => '中心医院',
        'city' => '市级医院',
        'county' => '县级医院',
        'township' => '乡镇卫生院',
        'village' => '村卫生室',
    ];

    /**
     * 机构列表（§3.1）
     */
    public function list(array $filters): array
    {
        $query = Organization::query();

        $levels = trim((string) ($filters['level'] ?? ''));
        if ($levels !== '') {
            $query->whereIn('level', array_filter(array_map('trim', explode(',', $levels))));
        }

        $keyword = trim((string) ($filters['keyword'] ?? ''));
        if ($keyword !== '') {
            $query->where(function ($q) use ($keyword) {
                $q->where('org_name', 'like', "%{$keyword}%")
                    ->orWhere('short_name', 'like', "%{$keyword}%");
            });
        }

        $list = $query->orderBy('org_code')->get()
            ->map(fn (Organization $org) => $this->summary($org))
            ->values()->all();

        return ['total' => count($list), 'list' => $list];
    }

    /**
     * 科室结构（§3.4）
     */
    public function departments(string $id): array
    {
        $org = $this->findOrg($id);

        $departments = Department::query()
            ->where('org_id', $org->id)
            ->orderBy('dept_code')
            ->get()
            ->map(fn (Department $d) => [
                'deptId' => $d->dept_code,
                'name' => $d->dept_name,
                'parentDeptId' => null,
            ])->values()->all();

        if ($departments === []) {
            // 乡镇 / 村级机构通常无科室，返回演示工作单元
            $departments = [[
                'deptId' => $org->org_code,
                'name' => $org->org_name,
                'parentDeptId' => null,
            ]];
        }

        return [
            'orgId' => $org->org_code,
            'departments' => $departments,
        ];
    }

    /**
     * 机构权限范围（§3.5）
     *
     * 项目无权限表，按文档示例返回固定权限字典。
     */
    public function permissions(string $id): array
    {
        $org = $this->findOrg($id);

        $permissions = [
            ['permId' => "PERM-{$org->org_code}-view", 'permKey' => 'patient.view', 'scope' => 'LOCAL', 'remark' => '查看本院患者'],
            ['permId' => "PERM-{$org->org_code}-transfer", 'permKey' => 'transfer.accept', 'scope' => 'LOWER', 'remark' => '接收下级转诊'],
            ['permId' => "PERM-{$org->org_code}-consult", 'permKey' => 'consult.join', 'scope' => 'PARTNER', 'remark' => '参与协作会诊'],
        ];

        return ['orgId' => $org->org_code, 'permissions' => $permissions];
    }

    /**
     * 新增机构（§3.2）
     */
    public function store(array $data): array
    {
        $org = Organization::create($this->mapOrgData($data));

        return ['orgId' => $org->org_code];
    }

    /**
     * 更新机构（§3.3，仅更新传入字段）
     */
    public function update(string $id, array $data): array
    {
        $org = $this->findOrg($id);
        $org->update($this->mapOrgData($data));

        return ['orgId' => $org->org_code, 'verified' => (bool) $org->verified];
    }

    /**
     * 机构成员（§3.6，可选按科室/职业过滤）
     */
    public function members(string $id, array $filters): array
    {
        $org = $this->findOrg($id);

        $members = OrganizationMember::query()
            ->where('org_code', $org->org_code)
            ->when(! empty($filters['deptId']), fn ($q, $v) => $q->where('dept_id', $v))
            ->when(! empty($filters['profession']), fn ($q, $v) => $q->where('profession', $v))
            ->orderBy('member_id')
            ->get();

        $deptNames = Department::query()
            ->whereIn('dept_code', $members->pluck('dept_id')->all())
            ->pluck('dept_name', 'dept_code')->all();

        $list = $members->map(fn (OrganizationMember $m) => [
            'memberId' => $m->member_id,
            'name' => $m->name,
            'title' => $m->title,
            'profession' => $m->profession,
            'deptId' => $m->dept_id,
            'deptName' => $deptNames[$m->dept_id] ?? '',
            'evidenceAsOf' => $m->evidence_as_of ?: null,
        ])->values()->all();

        return ['orgId' => $org->org_code, 'total' => count($list), 'list' => $list];
    }

    /**
     * 请求字段（camelCase）→ 模型字段（snake_case）
     */
    private function mapOrgData(array $data): array
    {
        $map = [
            'orgId' => 'org_code',
            'name' => 'org_name',
            'shortName' => 'short_name',
            'level' => 'level',
            'province' => 'province',
            'city' => 'city',
            'county' => 'county_name',
            'town' => 'town',
            'verified' => 'verified',
        ];

        $out = [];
        foreach ($map as $camel => $snake) {
            if (array_key_exists($camel, $data)) {
                $out[$snake] = $data[$camel];
            }
        }

        return $out;
    }

    /**
     * 机构列表项字段
     */
    public function summary(Organization $org): array
    {
        return [
            'orgId' => $org->org_code,
            'name' => $org->org_name,
            'shortName' => $org->short_name,
            'level' => $org->level,
            'levelLabel' => self::LEVEL_LABELS[$org->level] ?? '',
            'province' => $org->province,
            'city' => $org->city,
            'county' => $org->county_name,
            'town' => $org->town,
            'verified' => (bool) $org->verified,
            'currentOperationVerified' => (bool) $org->current_operation_verified,
            'verificationScope' => $org->verification_scope,
        ];
    }

    /**
     * 按机构编码取机构，不存在则 404
     */
    private function findOrg(string $id): Organization
    {
        $org = Organization::query()->where('org_code', $id)->first();
        $this->assert($org !== null, ResponseCode::NOT_FOUND, '机构不存在');

        return $org;
    }
}
