<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreOrganizationRequest;
use App\Http\Requests\UpdateOrganizationRequest;
use App\Services\OrganizationService;
use App\Models\Organization;
use App\Support\Result;
use Illuminate\Http\Request;

class OrganizationController extends Controller
{
    public function __construct(private readonly OrganizationService $service)
    {
    }

    /**
     * 机构列表（医共体成员机构名录，§3.1）
     */
    public function index(Request $request): array
    {
        $filters = [
            'level' => $request->query('level'),
            'keyword' => $request->query('keyword'),
        ];

        return Result::success('获取成功', $this->service->list($filters));
    }

    /**
     * 机构详情
     */
    public function show(Organization $organization): OrganizationService
    {
        return new OrganizationService($organization);
    }

    /**
     * 获取科室结构（科室树，§3.4）
     */
    public function departments(string $id): array
    {
        return Result::success('获取成功', $this->service->departments($id));
    }

    /**
     * 获取机构权限范围（§3.5）
     */
    public function permissions(string $id): array
    {
        return Result::success('获取成功', $this->service->permissions($id));
    }

    /**
     * 新增机构（§3.2）
     */
    public function store(StoreOrganizationRequest $request): array
    {
        return Result::success('新增成功', $this->service->store($request->validated()));
    }

    /**
     * 更新机构（§3.3）
     */
    public function update(UpdateOrganizationRequest $request, string $id): array
    {
        return Result::success('更新成功', $this->service->update($id, $request->validated()));
    }

    /**
     * 机构成员（§3.6）
     */
    public function users(Request $request, string $id): array
    {
        return Result::success('获取成功', $this->service->members($id, $request->query()));
    }
}
