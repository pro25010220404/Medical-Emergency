<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\DepartmentService;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DepartmentController extends Controller
{
    /**
     * 科室列表（可按机构筛选，供机构管理页「科室结构」模块使用）
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $departments = Department::query()
            ->when($request->input('org_id'), fn ($q, $v) => $q->where('org_id', $v))
            ->orderBy('org_id')
            ->orderBy('dept_code')
            ->paginate($request->integer('per_page', 50))
            ->appends($request->query());

        return DepartmentService::collection($departments);
    }

    public function show(Department $department): DepartmentService
    {
        return new DepartmentService($department);
    }
}
