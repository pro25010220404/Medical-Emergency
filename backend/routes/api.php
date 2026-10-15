<?php

use App\Http\Controllers\Api\V1\AmbulanceController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BedController;
use App\Http\Controllers\Api\V1\CareBindingController;
use App\Http\Controllers\Api\V1\CareCenterController;
use App\Http\Controllers\Api\V1\ClinicalRecordController;
use App\Http\Controllers\Api\V1\ConsultationController;
use App\Http\Controllers\Api\V1\ConsultRoomController;
use App\Http\Controllers\Api\V1\CountyMapController;
use App\Http\Controllers\Api\V1\CriticalCareController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DashboardLayoutController;
use App\Http\Controllers\Api\V1\DemoController;
use App\Http\Controllers\Api\V1\DepartmentController;
use App\Http\Controllers\Api\V1\DeviceController;
use App\Http\Controllers\Api\V1\DispatchCasePushController;
use App\Http\Controllers\Api\V1\DispatchEventController;
use App\Http\Controllers\Api\V1\DispatchHandoverController;
use App\Http\Controllers\Api\V1\DispatchPatientController;
use App\Http\Controllers\Api\V1\DispatchTaskController;
use App\Http\Controllers\Api\V1\DoctorController;
use App\Http\Controllers\Api\V1\DrMessageController;
use App\Http\Controllers\Api\V1\DrPostController;
use App\Http\Controllers\Api\V1\EmergencyEventController;
use App\Http\Controllers\Api\V1\MessageController;
use App\Http\Controllers\Api\V1\MonitoringStreamController;
use App\Http\Controllers\Api\V1\OrganizationController;
use App\Http\Controllers\Api\V1\PatientController;
use App\Http\Controllers\Api\V1\PatientProfileController;
use App\Http\Controllers\Api\V1\PatientRegistrationController;
use App\Http\Controllers\Api\V1\QcIssueController;
use App\Http\Controllers\Api\V1\QcStandardController;
use App\Http\Controllers\Api\V1\SlaRecordController;
use App\Http\Controllers\Api\V1\TransferController;
use App\Http\Controllers\Api\V1\TransferTrackController;
use App\Http\Controllers\Api\V1\VehicleController;
use App\Http\Controllers\Api\V1\VehicleGpsController;
use App\Http\Controllers\Api\V1\WarningController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
| V1 业务接口
| 鉴权范围：仅登录免鉴权，其余接口需 Authorization: Bearer {jwt}
*/
Route::prefix('v1')->group(function () {

    // 登录（免鉴权，§3.2）
    Route::post('auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:api')->group(function () {

        // 认证：登出 / 当前用户 /
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);

        /*
        |======================================================================
        | 10-急救调度与监控专项
        |======================================================================
        */

        // 急救事件 & 任务分派（01 §3.1~3.7）
        Route::get('dispatch/events', [DispatchEventController::class, 'index']);
        Route::post('dispatch/events', [DispatchEventController::class, 'store']);
        Route::get('dispatch/events/{eventId}', [DispatchEventController::class, 'show']);
        Route::put('dispatch/events/{eventId}', [DispatchEventController::class, 'update']);
        Route::post('dispatch/tasks', [DispatchTaskController::class, 'assign']);

        // 患者登记 / 到院交接 / 院前病例推送（01 §3.4、§3.9、§3.10）
        Route::get('dispatch/case-push', [DispatchCasePushController::class, 'index']);
        Route::post('dispatch/patients', [DispatchPatientController::class, 'store']);
        Route::post('dispatch/handover', [DispatchHandoverController::class, 'store']);

        // 救护车台账 / 在途 GPS（01 §3.3、§3.8、§8）
        // 注：vehicles/gps 必须注册在下方 apiResource('vehicles') 之前，否则被 {vehicle} 捕获
        Route::get('ambulances', [AmbulanceController::class, 'index']);
        Route::get('ambulances/{vehicleId}', [AmbulanceController::class, 'show']);
        Route::get('vehicles/gps', [VehicleGpsController::class, 'index']);

        // 转诊协同静态段（03-转诊协同 §3.5~3.6）
        // 须先于下方 transfers/{transferNo} 动态段注册，否则被 [A-Za-z]... 约束捕获
        Route::get('transfers/green-channel', [TransferController::class, 'greenChannel']);
        Route::get('transfers/response-time', [TransferController::class, 'responseTime']);

        // 转运任务详情 & 车载监护 / 轨迹回放 / 交接清单（01 §3.11、§3.1~3.3）
        // 须注册在 apiResource('transfers') 之前；约束单号以字母开头，避免吞掉数字主键
        Route::get('transfers/{transferNo}/monitor', [TransferTrackController::class, 'monitor'])
            ->where('transferNo', '[A-Za-z][A-Za-z0-9\-_]*');
        Route::get('transfers/{transferNo}/track', [TransferTrackController::class, 'track'])
            ->where('transferNo', '[A-Za-z][A-Za-z0-9\-_]*');
        Route::get('transfers/{transferNo}/handover-list', [TransferTrackController::class, 'handoverList'])
            ->where('transferNo', '[A-Za-z][A-Za-z0-9\-_]*');
        Route::get('transfers/{transferNo}', [TransferTrackController::class, 'show'])
            ->where('transferNo', '[A-Za-z][A-Za-z0-9\-_]*');

        // 远程会诊 & 会诊室（01 §5.1~5.9、§3.1）
        // 静态段必须先于 {sessionId} 注册
        Route::get('consultations/admission', [ConsultationController::class, 'admission']);
        Route::get('consultations/workspace', [ConsultationController::class, 'workspace']);
        Route::get('consultations/summary', [ConsultationController::class, 'summary']);
        Route::get('consultations/doctors', [ConsultationController::class, 'doctors']);
        Route::get('consultations', [ConsultationController::class, 'index']);
        Route::post('consultations', [ConsultationController::class, 'store']);
        Route::get('consultations/{sessionId}/members', [ConsultationController::class, 'members']);
        Route::post('consultations/{sessionId}/members', [ConsultationController::class, 'addMember']);
        Route::get('consultations/{sessionId}/join-link', [ConsultationController::class, 'joinLink']);
        Route::put('consultations/{sessionId}/claim', [ConsultationController::class, 'claim']);
        Route::put('consultations/{sessionId}/status', [ConsultationController::class, 'updateStatus']);
        Route::put('consultations/{sessionId}/assign', [ConsultationController::class, 'assign']);
        Route::put('consultations/{sessionId}', [ConsultationController::class, 'update']);
        Route::post('consultations/{sessionId}/accept', [ConsultationController::class, 'accept']);
        Route::get('consultations/{sessionId}', [ConsultationController::class, 'show']);

        Route::get('rooms/{token}/materials', [ConsultRoomController::class, 'materials']);
        Route::post('rooms/{token}/opinions', [ConsultRoomController::class, 'opinions']);
        Route::post('rooms/{token}/join', [ConsultRoomController::class, 'join']);
        Route::get('rooms/{token}', [ConsultRoomController::class, 'show']);

        // 监控流 & 云台（01 §3.4~3.6）
        Route::get('monitoring/streams', [MonitoringStreamController::class, 'index']);
        Route::get('monitoring/streams/{streamId}', [MonitoringStreamController::class, 'show']);
        Route::post('monitoring/ptz', [MonitoringStreamController::class, 'ptz']);

        // 2.1 预警通知（02 §3.1~3.7）
        // 静态段必须先于 {id} 注册
        Route::get('warnings/summary', [WarningController::class, 'summary']);
        Route::get('warnings/statistics', [WarningController::class, 'statistics']);
        Route::get('warnings/critical-values', [WarningController::class, 'criticalValues']);
        Route::get('warnings/closed-loop', [WarningController::class, 'closedLoop']);
        Route::get('warnings', [WarningController::class, 'index']);
        Route::get('warnings/{id}', [WarningController::class, 'show']);
        Route::post('warnings/{id}/dispose', [WarningController::class, 'dispose']);

        // 2.1 消息中心（02 §3.1~3.3）
        Route::get('messages', [MessageController::class, 'index']);
        Route::get('messages/notifications', [MessageController::class, 'notifications']);
        Route::get('messages/todos', [MessageController::class, 'todos']);

        // 2.2 / 2.4 床位监控（02 §3.1~3.7）静态段必须先于 {id} 注册
        Route::get('beds/by-dept', [BedController::class, 'byDept']);
        Route::get('beds/overview', [BedController::class, 'overview']);
        Route::get('beds/reserved', [BedController::class, 'reserved']);
        Route::get('beds/distribution', [BedController::class, 'distribution']);
        Route::get('beds/{id}', [BedController::class, 'show']);
        Route::get('beds/{id}/devices', [BedController::class, 'devices']);
        Route::get('beds/{id}/inspections', [BedController::class, 'inspections']);

        // 指挥大屏总览（01-指挥大屏 §3.1~3.7）
        Route::get('dashboard/overview', [DashboardController::class, 'overview']);
        Route::get('dashboard/kpi', [DashboardController::class, 'kpi']);
        Route::get('dashboard/event-stream', [DashboardController::class, 'eventStream']);
        Route::get('dashboard/dispatch-overview', [DashboardController::class, 'dispatchOverview']);
        Route::get('dashboard/layout', [DashboardLayoutController::class, 'layout']);
        Route::post('dashboard/layout', [DashboardLayoutController::class, 'saveLayout']);

        // 2.3 县域地图 & 2.2 四元绑定（02 §11）
        Route::get('dashboard/county-map', [CountyMapController::class, 'index']);
        Route::get('care-bindings', [CareBindingController::class, 'index']);

        // 2.5 床旁设备绑定（02 §12、§5）静态段必须先于 {id} 注册
        Route::get('devices/inspections', [DeviceController::class, 'inspections']);
        Route::get('devices', [DeviceController::class, 'index']);
        Route::post('devices', [DeviceController::class, 'store']);
        Route::put('devices/{deviceId}/binding', [DeviceController::class, 'updateBinding']);
        Route::put('devices/{id}', [DeviceController::class, 'update']);

        // 2.6 五大中心（02 §13）
        Route::get('centers', [CareCenterController::class, 'index']);
        Route::get('centers/{id}/profile', [CareCenterController::class, 'profile']);
        Route::put('centers/{id}/profile', [CareCenterController::class, 'updateProfile']);

        // 2.7 基层重症监护（02 §14）
        Route::get('critical/beds', [CriticalCareController::class, 'beds']);
        Route::get('critical/wards', [CriticalCareController::class, 'wards']);
        Route::get('critical/vitals', [CriticalCareController::class, 'vitals']);
        Route::get('critical/alerts', [CriticalCareController::class, 'alerts']);
        Route::get('critical/patients/{id}/vitals', [CriticalCareController::class, 'patientVitals']);
        Route::post('critical/wards/{id}/note', [CriticalCareController::class, 'wardNote']);

        /*
        |======================================================================
        | 既有接口
        |======================================================================
        */

        // 机构（转诊双方 / 受理机构选项）+ 机构科室结构 / 权限范围（02 §3.1/3.4/3.5）
        Route::apiResource('organizations', OrganizationController::class)->only(['index', 'show']);
        Route::get('organizations/{id}/departments', [OrganizationController::class, 'departments']);
        Route::get('organizations/{id}/permissions', [OrganizationController::class, 'permissions']);

        // 患者建档：POST /patients 由患者登记接口接管，其余方法沿用
        Route::post('patients', [PatientRegistrationController::class, 'store']);
        Route::post('patients/ocr-id', [PatientRegistrationController::class, 'ocrId']);
        Route::post('patients/pre-admission', [PatientRegistrationController::class, 'preAdmission']);

        // 患者扩展（03-患者与床位 §3.4~3.6、§3.9~3.10）：静态段 export/stages 必须先于 apiResource('patients')
        Route::get('patients/export', [PatientProfileController::class, 'export']);
        Route::get('patients/stages', [PatientProfileController::class, 'stages']);
        Route::get('patients/{id}/timeline', [PatientProfileController::class, 'timeline']);
        Route::get('patients/{id}/consultations', [PatientProfileController::class, 'consultations']);
        Route::get('patients/{id}/warnings', [PatientProfileController::class, 'warnings']);

        Route::apiResource('patients', PatientController::class)->except(['store']);

        // 急救事件（实时出警 / 急救事件 / 患者登记）
        Route::get('dispatch-live', [EmergencyEventController::class, 'dispatchLive']);
        Route::apiResource('emergency-events', EmergencyEventController::class);
        Route::post('emergency-events/{emergency_event}/close', [EmergencyEventController::class, 'close']);
        Route::post('emergency-events/{emergency_event}/timelines', [EmergencyEventController::class, 'storeTimeline']);

        // 基层调度链：转诊单
        Route::apiResource('transfers', TransferController::class);
        Route::post('transfers/{transfer}/confirm', [TransferController::class, 'confirm']);
        Route::post('transfers/{transfer}/reject', [TransferController::class, 'reject']);

        // 基层转诊演示流程（03-转诊协同 §3.1）
        Route::get('demo/transfer-steps', [DemoController::class, 'transferSteps']);

        // 救护车
        Route::apiResource('vehicles', VehicleController::class);
        Route::get('vehicles-gps', [VehicleController::class, 'gps']);
        Route::get('vehicles/{vehicle}/tracks', [VehicleController::class, 'tracks']);

        // 医院质控：标准（summary 需在 apiResource 之前注册，避免被 show 捕获）
        Route::get('qc-standards/summary', [QcStandardController::class, 'summary']);
        Route::apiResource('qc-standards', QcStandardController::class);

        // 医院质控：整改单（report/export 需在 apiResource 之前注册）
        Route::get('qc-issues-report', [QcIssueController::class, 'report']);
        Route::get('qc-issues-export', [QcIssueController::class, 'export']);
        Route::apiResource('qc-issues', QcIssueController::class);
        Route::post('qc-issues/{qc_issue}/close', [QcIssueController::class, 'close']);

        // 医院质控：环节时限 SLA 台账
        Route::apiResource('sla-records', SlaRecordController::class);

        // 科室（机构管理页「科室结构」模块）
        Route::apiResource('departments', DepartmentController::class)->only(['index', 'show']);

        // 基层医生 Dr：医生管理 + 诊疗记录
        Route::apiResource('doctors', DoctorController::class);
        Route::apiResource('clinical-records', ClinicalRecordController::class);

        // 基层医声 Dr（04-会诊协同 §3.1~§3.4）：基层反馈 / 问题上报 + 协作消息
        Route::get('dr/posts', [DrPostController::class, 'index']);
        Route::post('dr/posts', [DrPostController::class, 'store']);
        Route::get('dr/messages', [DrMessageController::class, 'index']);
        Route::post('dr/messages', [DrMessageController::class, 'store']);
    });
});
