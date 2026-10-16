<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreVehicleRequest;
use App\Http\Requests\UpdateVehicleRequest;
use App\Services\VehicleService;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class VehicleController extends Controller
{
    /**
     * 救护车列表（车辆绑定与状态）
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Vehicle::query()->with('organization');

        $query->when($request->input('vehicle_status'), fn ($q, $v) => $q->where('vehicle_status', $v))
            ->when($request->input('org_id'), fn ($q, $v) => $q->where('org_id', $v))
            ->when($request->input('keyword'), fn ($q, $v) => $q->where('plate_number', 'like', "%{$v}%"));

        $vehicles = $query->orderBy('plate_number')
            ->paginate($request->integer('per_page', 15))
            ->appends($request->query());

        return VehicleService::collection($vehicles);
    }

    /**
     * 新增车辆
     */
    public function store(StoreVehicleRequest $request): JsonResponse
    {
        $vehicle = Vehicle::create($request->validated());
        $vehicle->refresh();
        $vehicle->load('organization');

        return (new VehicleService($vehicle))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * 车辆详情
     */
    public function show(Vehicle $vehicle): VehicleService
    {
        $vehicle->load('organization');

        return new VehicleService($vehicle);
    }

    /**
     * 更新车辆
     */
    public function update(UpdateVehicleRequest $request, Vehicle $vehicle): VehicleService
    {
        $vehicle->update($request->validated());
        $vehicle->load('organization');

        return new VehicleService($vehicle);
    }

    /**
     * 删除车辆（软删除）
     */
    public function destroy(Vehicle $vehicle): Response
    {
        $vehicle->delete();

        return response()->noContent();
    }

    /**
     * 全部车辆实时位置（调度地图 / GPS 轮询，对齐 vehicles-gps.json 契约）
     */
    public function gps(): JsonResponse
    {
        $vehicles = Vehicle::query()
            ->whereNotNull('latest_lng')
            ->whereNotNull('latest_lat')
            ->get()
            ->map(fn (Vehicle $v) => [
                'id' => (string) $v->id,
                'plate' => $v->plate_number,
                'status' => $v->vehicle_status,
                'lng' => (float) $v->latest_lng,
                'lat' => (float) $v->latest_lat,
                'etaMinutes' => null,
                'route' => [],
            ])
            ->values();

        return response()->json([
            'updatedAt' => now()->toIso8601String(),
            'vehicles' => $vehicles,
        ]);
    }

    /**
     * 单车历史轨迹
     */
    public function tracks(Request $request, Vehicle $vehicle): JsonResponse
    {
        $tracks = $vehicle->tracks()
            ->orderByDesc('recorded_at')
            ->limit($request->integer('limit', 100))
            ->get(['lng', 'lat', 'speed', 'heading', 'recorded_at'])
            ->reverse()
            ->values();

        return response()->json(['data' => $tracks]);
    }
}
