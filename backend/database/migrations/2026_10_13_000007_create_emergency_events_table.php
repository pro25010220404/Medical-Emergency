<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 按原系统表结构还原
        Schema::create('emergency_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_code', 50)->unique()->comment('事件编号');
            $table->string('event_source', 50)->index()->comment('事件来源');
            $table->dateTime('occurred_at')->index()->comment('发生时间');
            $table->unsignedBigInteger('accept_org_id')->index()->comment('受理机构');
            $table->unsignedBigInteger('accepted_by_user_id')->nullable()->index()->comment('受理人');
            $table->dateTime('eta')->nullable()->comment('预计到达时间');
            $table->string('scene_address', 500)->nullable()->comment('现场地址');
            $table->string('scene_phone', 50)->nullable()->comment('现场联系电话');
            $table->string('symptom_duration', 100)->nullable()->comment('症状持续时间');
            $table->string('consciousness', 50)->default('CONSCIOUSNESS_CLEAR')->comment('意识状态');
            $table->string('provisional_dx', 200)->nullable()->comment('初步诊断');
            $table->string('triage_level', 20)->default('TRIAGE_III')->index()->comment('分诊级别');
            $table->string('channel_type', 50)->default('CHANNEL_NORMAL')->comment('通道类型');
            $table->string('target_dept_name', 100)->nullable()->comment('目标科室');
            $table->string('transport_mode', 50)->default('TRANSPORT_AMBULANCE')->comment('转运方式');
            $table->string('scene_hr', 20)->nullable()->comment('现场心率');
            $table->string('scene_sbp', 20)->nullable()->comment('现场收缩压');
            $table->string('scene_dbp', 20)->nullable()->comment('现场舒张压');
            $table->string('scene_spo2', 20)->nullable()->comment('现场血氧');
            $table->string('scene_rr', 20)->nullable()->comment('现场呼吸');
            $table->string('scene_temp', 20)->nullable()->comment('现场体温');
            $table->unsignedBigInteger('patient_id')->nullable()->index()->comment('关联患者');
            $table->string('patient_mode', 32)->default('PATIENT_MODE_TEMP')->comment('患者模式：临时/建档');
            $table->string('temp_gender', 20)->default('GENDER_UNKNOWN')->comment('临时患者性别');
            $table->text('temp_summary')->nullable()->comment('临时患者摘要');
            $table->text('chief')->comment('主诉');
            $table->string('risk_level', 20)->default('RISK_MEDIUM')->index()->comment('风险等级');
            $table->string('event_stage', 50)->default('STAGE_CREATED')->index()->comment('事件阶段');
            $table->string('event_status', 30)->default('EVENT_ACTIVE')->index()->comment('事件状态');
            $table->text('close_reason')->nullable()->comment('关闭原因');
            $table->json('close_check_result')->nullable()->comment('关闭检查结果');
            $table->dateTime('closed_at')->nullable();
            $table->unsignedBigInteger('closed_by_user_id')->nullable();
            $table->string('task120_id', 32)->nullable()->unique()->comment('120 任务号');
            $table->unsignedTinyInteger('level')->default(1)->comment('等级：0重症1急症2一般');
            $table->string('destination', 64)->default('')->comment('目标医院');
            $table->string('vehicle_id', 32)->default('')->index()->comment('车辆编号');
            $table->string('vehicle_plate', 16)->default('')->comment('车牌');
            $table->unsignedTinyInteger('status')->default(1)->index()->comment('状态：0待命1出警中2现场处置3返院途中');
            $table->dateTime('started_at')->nullable()->index()->comment('出警时间');
            $table->unsignedInteger('eta_hospital_minutes')->default(0)->comment('预计到院分钟');
            $table->unsignedInteger('eta_patient_minutes')->nullable()->comment('预计到患者分钟');
            $table->string('score_plan', 255)->default('')->comment('院前评分方案');
            $table->text('treat_plan')->nullable()->comment('救治方案');
            $table->boolean('is_deleted')->default(false);
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('emergency_events');
    }
};
