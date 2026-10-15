<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AcceptConsultationRequest;
use App\Http\Requests\StoreConsultationRequest;
use App\Services\ConsultationService;
use App\Support\Result;
use Illuminate\Http\Request;

class ConsultationController extends Controller
{
    public function __construct(private readonly ConsultationService $service)
    {
    }

    /** 会诊队列 */
    public function index(Request $request): array
    {
        return Result::success('获取成功', $this->service->index($request->query()));
    }

    /** 会诊队列状态计数 */
    public function summary(Request $request): array
    {
        return Result::success('获取成功', $this->service->summary($request->query()));
    }

    /** 会诊工作台首屏聚合（队列 + 发起表单数据），减少 php -S 单进程下的串行请求排队 */
    public function workspace(Request $request): array
    {
        return Result::success('获取成功', $this->service->workspace($request->query()));
    }

    /** 发起会诊 */
    public function store(StoreConsultationRequest $request): array
    {
        return Result::success('获取成功', $this->service->store($request->validated()));
    }

    /** 入院会诊会话 */
    public function admission(): array
    {
        return Result::success('获取成功', $this->service->admission());
    }

    /** 会诊详情 */
    public function show(string $sessionId): array
    {
        return Result::success('获取成功', $this->service->show($sessionId));
    }

    /** 可选接诊医生 */
    public function doctors(Request $request): array
    {
        return Result::success('获取成功', $this->service->doctors($request->query()));
    }

    /** 医生接诊 */
    public function accept(AcceptConsultationRequest $request, string $sessionId): array
    {
        return Result::success('获取成功', $this->service->accept($sessionId, $request->validated()));
    }

    /** 领取会诊（与 accept 同义，全模块 V1.0 §3.45） */
    public function claim(AcceptConsultationRequest $request, string $sessionId): array
    {
        return Result::success('获取成功', $this->service->claim($sessionId, $request->validated()));
    }

    /** 会诊状态流转（§3.46） */
    public function updateStatus(Request $request, string $sessionId): array
    {
        $data = $request->validate([
            'status' => ['nullable', 'string', 'max:32'],
            'consultStatus' => ['nullable', 'integer', 'min:0', 'max:3'],
        ]);

        return Result::success('获取成功', $this->service->updateStatus($sessionId, $data));
    }

    /** 指定接诊医生（§3.61） */
    public function assign(Request $request, string $sessionId): array
    {
        $data = $request->validate([
            'assignUserId' => ['nullable', 'string', 'max:64'],
            'doctorId' => ['nullable', 'string', 'max:64'],
            'nominatedDoctorId' => ['nullable', 'string', 'max:64'],
        ]);

        return Result::success('获取成功', $this->service->assign($sessionId, $data));
    }

    /** 更新会诊单（§3.64） */
    public function update(Request $request, string $sessionId): array
    {
        $data = $request->validate([
            'chiefComplaint' => ['nullable', 'string', 'max:255'],
            'targetHospital' => ['nullable', 'string', 'max:64'],
            'targetDepartment' => ['nullable', 'string', 'max:64'],
            'sourceHospital' => ['nullable', 'string', 'max:64'],
            'sourceDepartment' => ['nullable', 'string', 'max:64'],
            'note' => ['nullable', 'string', 'max:255'],
            'nominatedDoctorId' => ['nullable', 'string', 'max:64'],
        ]);

        return Result::success('获取成功', $this->service->update($sessionId, $data));
    }

    /** 会诊参与人 */
    public function members(string $sessionId): array
    {
        return Result::success('获取成功', $this->service->members($sessionId));
    }

    /** 添加会诊参与人 */
    public function addMember(Request $request, string $sessionId): array
    {
        $data = $request->validate([
            'role' => ['nullable', 'string', 'max:32'],
            'name' => ['required', 'string', 'max:64'],
            'online' => ['nullable', 'boolean'],
            'deviceType' => ['nullable', 'string', 'max:32'],
            'joinMode' => ['nullable', 'string', 'max:32'],
            'joinedAt' => ['nullable', 'date'],
        ]);

        return Result::success('获取成功', $this->service->addMember($sessionId, $data));
    }

    /** 入会链接：跳转远程会诊系统的地址（未对接时返回本地占位会诊室） */
    public function joinLink(Request $request, string $sessionId): array
    {
        return Result::success('获取成功', $this->service->joinLink($sessionId, $request->query()));
    }
}
