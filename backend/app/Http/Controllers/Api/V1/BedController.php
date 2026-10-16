<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\BedService;
use App\Support\Result;
use Illuminate\Http\Request;

class BedController extends Controller
{
    public function __construct(private readonly BedService $service)
    {
    }

    /** 床位明细列表（床位全景页数据源） */
    public function index(Request $request): array
    {
        return Result::success('获取成功', $this->service->index($request->only(['institutionId', 'departmentId', 'status'])));
    }

    /** 科室床位统计（§3.1） */
    public function byDept(Request $request): array
    {
        return Result::success('获取成功', $this->service->byDept($request->query('hospitalId')));
    }

    /** 县域床位总览（§3.2） */
    public function overview(Request $request): array
    {
        return Result::success('获取成功', $this->service->overview($request->query('hospitalId')));
    }

    /** 床位详情（§3.3） */
    public function show(string $id): array
    {
        return Result::success('获取成功', $this->service->show($id));
    }

    /** 床位绑定设备（§3.4） */
    public function devices(string $id): array
    {
        return Result::success('获取成功', $this->service->devices($id));
    }

    /** 床旁巡检记录（§3.5） */
    public function inspections(Request $request, string $id): array
    {
        return Result::success('获取成功', $this->service->inspections($id, $request->only(['pageNum', 'pageSize'])));
    }

    /** 预留床位（§3.6） */
    public function reserved(Request $request): array
    {
        return Result::success('获取成功', $this->service->reserved($request->only(['institutionId', 'pageNum', 'pageSize'])));
    }

    /** 机构床位分布（§3.7） */
    public function distribution(Request $request): array
    {
        return Result::success('获取成功', $this->service->distribution($request->query('institutionId')));
    }
}
