<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDoctorRequest;
use App\Http\Requests\UpdateDoctorRequest;
use App\Services\DoctorService;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;

class DoctorController extends Controller
{
    /**
     * 基层医生列表（users 表 identity_type = DOCTOR）
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = User::query()
            ->where('identity_type', 'DOCTOR')
            ->with('organization');

        $query->when($request->input('org_id'), fn ($q, $v) => $q->where('org_id', $v))
            ->when($request->input('user_status'), fn ($q, $v) => $q->where('user_status', $v))
            ->when($request->input('keyword'), function ($q, $v) {
                $q->where(function ($sub) use ($v) {
                    $sub->where('real_name', 'like', "%{$v}%")
                        ->orWhere('username', 'like', "%{$v}%")
                        ->orWhere('phone', 'like', "%{$v}%");
                });
            });

        $doctors = $query->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 15))
            ->appends($request->query());

        return DoctorService::collection($doctors);
    }

    /**
     * 录入基层医生
     */
    public function store(StoreDoctorRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['password_hash'] = Hash::make($data['password']);
        unset($data['password']);
        $data['identity_type'] = 'DOCTOR';

        $doctor = User::create($data);
        // 刷新以取回数据库默认值（user_status 等）
        $doctor->refresh();
        $doctor->load('organization');

        return (new DoctorService($doctor))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * 医生详情
     */
    public function show(User $doctor): DoctorService
    {
        abort_unless($doctor->identity_type === 'DOCTOR', 404);
        $doctor->load('organization');

        return new DoctorService($doctor);
    }

    /**
     * 更新医生信息（密码可选，修改时重新哈希）
     */
    public function update(UpdateDoctorRequest $request, User $doctor): DoctorService
    {
        abort_unless($doctor->identity_type === 'DOCTOR', 404);

        $data = $request->validated();
        if (array_key_exists('password', $data)) {
            $data['password_hash'] = Hash::make($data['password']);
            unset($data['password']);
        }

        $doctor->update($data);
        $doctor->load('organization');

        return new DoctorService($doctor);
    }

    /**
     * 删除医生（软删除）
     */
    public function destroy(User $doctor): Response
    {
        abort_unless($doctor->identity_type === 'DOCTOR', 404);
        $doctor->delete();

        return response()->noContent();
    }
}
