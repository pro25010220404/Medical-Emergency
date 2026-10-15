<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 急救事件 / 事件时间线 / 院前患者登记
 *
 * status：0待命 1出警中 2现场处置 3返院途中；level：0重症 1急症 2一般
 * occurred_at 使用「今天」的时间，供 whereDate(occurred_at, today) 列表过滤
 */
class EmergencyDispatchSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $ymd = now()->format('Ymd');
        $day = now()->copy()->startOfDay();

        // 今日相对时间（同一日期，分钟级错开）
        $at = fn (int $hour, int $minute) => $day->copy()->addHours($hour)->addMinutes($minute);

        DB::table('emergency_events')->insert([
            [
                'id' => 1, 'event_code' => "EVT-{$ymd}-01", 'event_source' => 'SOURCE_120',
                'occurred_at' => $at(8, 12), 'accept_org_id' => 2, 'accepted_by_user_id' => 6,
                'eta' => $at(8, 40), 'scene_address' => '威远县严陵镇建设街12号',
                'scene_phone' => '13600000001', 'symptom_duration' => '1小时',
                'consciousness' => 'CONSCIOUSNESS_CLEAR', 'provisional_dx' => '急性冠脉综合征',
                'triage_level' => 'TRIAGE_II', 'channel_type' => 'CHANNEL_120', 'target_dept_name' => '心血管内科',
                'transport_mode' => 'TRANSPORT_AMBULANCE', 'scene_hr' => '118', 'scene_sbp' => '92',
                'scene_dbp' => '58', 'scene_spo2' => '91', 'scene_rr' => '24', 'scene_temp' => '36.7',
                'patient_id' => null, 'patient_mode' => 'PATIENT_MODE_TEMP', 'temp_gender' => 'GENDER_FEMALE',
                'temp_summary' => '女性老年患者，突发胸痛大汗', 'chief' => '突发胸痛1小时',
                'risk_level' => 'RISK_HIGH', 'event_stage' => 'STAGE_ENROUTE', 'event_status' => 'EVENT_ACTIVE',
                'close_reason' => null, 'close_check_result' => null, 'closed_at' => null, 'closed_by_user_id' => null,
                'task120_id' => "120-{$ymd}-01", 'level' => 0, 'destination' => '威远县人民医院',
                'vehicle_id' => 'AMB-1', 'vehicle_plate' => '川K1201', 'status' => 1,
                'started_at' => $at(8, 16), 'eta_hospital_minutes' => 12, 'eta_patient_minutes' => 4,
                'score_plan' => '院前急救评分 A 套', 'treat_plan' => '吸氧、心电监护、建立静脉通路、阿司匹林嚼服',
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now->copy()->subMinutes(40), 'updated_at' => $now,
            ],
            [
                'id' => 2, 'event_code' => "EVT-{$ymd}-02", 'event_source' => 'SOURCE_120',
                'occurred_at' => $at(9, 5), 'accept_org_id' => 3, 'accepted_by_user_id' => 7,
                'eta' => $at(9, 30), 'scene_address' => '威远县连界镇连界街88号',
                'scene_phone' => '13600000002', 'symptom_duration' => '2小时',
                'consciousness' => 'CONSCIOUSNESS_CONFUSED', 'provisional_dx' => '急性脑血管病',
                'triage_level' => 'TRIAGE_I', 'channel_type' => 'CHANNEL_120', 'target_dept_name' => '神经内科',
                'transport_mode' => 'TRANSPORT_AMBULANCE', 'scene_hr' => '96', 'scene_sbp' => '186',
                'scene_dbp' => '104', 'scene_spo2' => '94', 'scene_rr' => '20', 'scene_temp' => '36.9',
                'patient_id' => 2, 'patient_mode' => 'PATIENT_MODE_REGISTERED', 'temp_gender' => 'GENDER_UNKNOWN',
                'temp_summary' => null, 'chief' => '意识模糊伴呕吐2小时',
                'risk_level' => 'RISK_HIGH', 'event_stage' => 'STAGE_SCENE', 'event_status' => 'EVENT_ACTIVE',
                'close_reason' => null, 'close_check_result' => null, 'closed_at' => null, 'closed_by_user_id' => null,
                'task120_id' => "120-{$ymd}-02", 'level' => 1, 'destination' => '威远县人民医院',
                'vehicle_id' => 'AMB-2', 'vehicle_plate' => '川K1202', 'status' => 2,
                'started_at' => $at(9, 10), 'eta_hospital_minutes' => 18, 'eta_patient_minutes' => 6,
                'score_plan' => '卒中评分 NIHSS', 'treat_plan' => '保持气道通畅、控制血压、建立静脉通道',
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now->copy()->subMinutes(30), 'updated_at' => $now,
            ],
            [
                'id' => 3, 'event_code' => "EVT-{$ymd}-03", 'event_source' => 'SOURCE_120',
                'occurred_at' => $at(10, 22), 'accept_org_id' => 4, 'accepted_by_user_id' => null,
                'eta' => null, 'scene_address' => '威远县新场镇兴新街6号',
                'scene_phone' => '13600000003', 'symptom_duration' => '30分钟',
                'consciousness' => 'CONSCIOUSNESS_CLEAR', 'provisional_dx' => '眩晕待查',
                'triage_level' => 'TRIAGE_III', 'channel_type' => 'CHANNEL_NORMAL', 'target_dept_name' => '急诊科',
                'transport_mode' => 'TRANSPORT_AMBULANCE', 'scene_hr' => '84', 'scene_sbp' => '132',
                'scene_dbp' => '80', 'scene_spo2' => '97', 'scene_rr' => '18', 'scene_temp' => '36.5',
                'patient_id' => null, 'patient_mode' => 'PATIENT_MODE_TEMP', 'temp_gender' => 'GENDER_MALE',
                'temp_summary' => '中年男性，眩晕', 'chief' => '头晕伴恶心30分钟',
                'risk_level' => 'RISK_LOW', 'event_stage' => 'STAGE_CREATED', 'event_status' => 'EVENT_ACTIVE',
                'close_reason' => null, 'close_check_result' => null, 'closed_at' => null, 'closed_by_user_id' => null,
                'task120_id' => "120-{$ymd}-03", 'level' => 2, 'destination' => '',
                'vehicle_id' => '', 'vehicle_plate' => '', 'status' => 0,
                'started_at' => null, 'eta_hospital_minutes' => 0, 'eta_patient_minutes' => null,
                'score_plan' => '', 'treat_plan' => null,
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now->copy()->subMinutes(20), 'updated_at' => $now,
            ],
            [
                'id' => 4, 'event_code' => "EVT-{$ymd}-04", 'event_source' => 'SOURCE_120',
                'occurred_at' => $at(7, 40), 'accept_org_id' => 2, 'accepted_by_user_id' => 2,
                'eta' => $at(8, 20), 'scene_address' => '威远县新场镇兴新街6号',
                'scene_phone' => '13600000003', 'symptom_duration' => '1小时',
                'consciousness' => 'CONSCIOUSNESS_CLEAR', 'provisional_dx' => '脑梗死',
                'triage_level' => 'TRIAGE_II', 'channel_type' => 'CHANNEL_120', 'target_dept_name' => '神经内科',
                'transport_mode' => 'TRANSPORT_AMBULANCE', 'scene_hr' => '88', 'scene_sbp' => '150',
                'scene_dbp' => '90', 'scene_spo2' => '95', 'scene_rr' => '19', 'scene_temp' => '36.6',
                'patient_id' => 3, 'patient_mode' => 'PATIENT_MODE_REGISTERED', 'temp_gender' => 'GENDER_UNKNOWN',
                'temp_summary' => null, 'chief' => '言语不清、右侧肢体无力1小时',
                'risk_level' => 'RISK_MEDIUM', 'event_stage' => 'STAGE_TRANSPORT', 'event_status' => 'EVENT_CLOSED',
                'close_reason' => '已到院交接完成', 'close_check_result' => null,
                'closed_at' => $at(8, 25), 'closed_by_user_id' => 2,
                'task120_id' => "120-{$ymd}-04", 'level' => 1, 'destination' => '威远县人民医院',
                'vehicle_id' => 'AMB-4', 'vehicle_plate' => '川K1204', 'status' => 3,
                'started_at' => $at(7, 45), 'eta_hospital_minutes' => 15, 'eta_patient_minutes' => 5,
                'score_plan' => '卒中评分 NIHSS', 'treat_plan' => '溶栓评估、维持血压稳定',
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now->copy()->subMinutes(90), 'updated_at' => $now,
            ],
            [
                'id' => 5, 'event_code' => "EVT-{$ymd}-05", 'event_source' => 'SOURCE_120',
                'occurred_at' => $at(11, 3), 'accept_org_id' => 6, 'accepted_by_user_id' => 9,
                'eta' => $at(11, 35), 'scene_address' => '内江市市中区交通路18号',
                'scene_phone' => '13600000005', 'symptom_duration' => '2天',
                'consciousness' => 'CONSCIOUSNESS_CLEAR', 'provisional_dx' => '重症肺炎',
                'triage_level' => 'TRIAGE_II', 'channel_type' => 'CHANNEL_120', 'target_dept_name' => '重症医学科',
                'transport_mode' => 'TRANSPORT_AMBULANCE', 'scene_hr' => '108', 'scene_sbp' => '102',
                'scene_dbp' => '64', 'scene_spo2' => '89', 'scene_rr' => '28', 'scene_temp' => '38.6',
                'patient_id' => 5, 'patient_mode' => 'PATIENT_MODE_REGISTERED', 'temp_gender' => 'GENDER_UNKNOWN',
                'temp_summary' => null, 'chief' => '孕晚期腹痛、阴道流血',
                'risk_level' => 'RISK_HIGH', 'event_stage' => 'STAGE_ENROUTE', 'event_status' => 'EVENT_ACTIVE',
                'close_reason' => null, 'close_check_result' => null, 'closed_at' => null, 'closed_by_user_id' => null,
                'task120_id' => "120-{$ymd}-05", 'level' => 0, 'destination' => '内江市第一人民医院',
                'vehicle_id' => 'AMB-6', 'vehicle_plate' => '川K1206', 'status' => 1,
                'started_at' => $at(11, 10), 'eta_hospital_minutes' => 20, 'eta_patient_minutes' => 7,
                'score_plan' => '危重孕产妇评分', 'treat_plan' => '吸氧、监护、开通绿色通道',
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now->copy()->subMinutes(12), 'updated_at' => $now,
            ],
            [
                'id' => 6, 'event_code' => "EVT-{$ymd}-06", 'event_source' => 'SOURCE_120',
                'occurred_at' => $at(12, 18), 'accept_org_id' => 2, 'accepted_by_user_id' => 2,
                'eta' => $at(12, 50), 'scene_address' => '威远县越溪镇越溪村3组',
                'scene_phone' => '13600000004', 'symptom_duration' => '40分钟',
                'consciousness' => 'CONSCIOUSNESS_CLEAR', 'provisional_dx' => '左下肢骨折',
                'triage_level' => 'TRIAGE_III', 'channel_type' => 'CHANNEL_NORMAL', 'target_dept_name' => '普外科',
                'transport_mode' => 'TRANSPORT_AMBULANCE', 'scene_hr' => '92', 'scene_sbp' => '126',
                'scene_dbp' => '78', 'scene_spo2' => '98', 'scene_rr' => '18', 'scene_temp' => '36.8',
                'patient_id' => 6, 'patient_mode' => 'PATIENT_MODE_REGISTERED', 'temp_gender' => 'GENDER_UNKNOWN',
                'temp_summary' => null, 'chief' => '车祸外伤、左下肢疼痛',
                'risk_level' => 'RISK_MEDIUM', 'event_stage' => 'STAGE_SCENE', 'event_status' => 'EVENT_ACTIVE',
                'close_reason' => null, 'close_check_result' => null, 'closed_at' => null, 'closed_by_user_id' => null,
                'task120_id' => "120-{$ymd}-06", 'level' => 2, 'destination' => '威远县人民医院',
                'vehicle_id' => '', 'vehicle_plate' => '', 'status' => 2,
                'started_at' => $at(12, 22), 'eta_hospital_minutes' => 25, 'eta_patient_minutes' => 8,
                'score_plan' => '创伤评分 GCS', 'treat_plan' => '夹板固定、止痛、转运',
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now->copy()->subMinutes(5), 'updated_at' => $now,
            ],
        ]);

        DB::table('event_timelines')->insert([
            ['id' => 1, 'event_id' => 1, 'node_type' => '接警', 'node_title' => '120 接警受理', 'content' => '受理人：赵强', 'occurred_at' => $at(8, 12), 'operator_user_id' => 6, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'event_id' => 1, 'node_type' => '派车', 'node_title' => '指派 AMB-1 出警', 'content' => '随车：王建国 / 陈静', 'occurred_at' => $at(8, 16), 'operator_user_id' => 6, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'event_id' => 2, 'node_type' => '接警', 'node_title' => '120 接警受理', 'content' => '连界镇中心卫生院受理', 'occurred_at' => $at(9, 5), 'operator_user_id' => 7, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'event_id' => 2, 'node_type' => '到现场', 'node_title' => '抵达现场处置', 'content' => '生命体征已采集', 'occurred_at' => $at(9, 22), 'operator_user_id' => 7, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 5, 'event_id' => 4, 'node_type' => '到院', 'node_title' => '到达威远县人民医院', 'content' => '完成交接', 'occurred_at' => $at(8, 20), 'operator_user_id' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 6, 'event_id' => 4, 'node_type' => '关闭', 'node_title' => '事件关闭', 'content' => '已到院交接完成', 'occurred_at' => $at(8, 25), 'operator_user_id' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 7, 'event_id' => 5, 'node_type' => '接警', 'node_title' => '120 接警受理', 'content' => '内江市第一人民医院受理', 'occurred_at' => $at(11, 3), 'operator_user_id' => 9, 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('emergency_patients')->insert([
            [
                'id' => 1, 'patient_no' => sprintf('EP-%s-001', $ymd), 'event_id' => "EVT-{$ymd}-01", 'task120_id' => "120-{$ymd}-01",
                'vehicle_id' => 'AMB-1', 'vehicle_plate' => '川K1201', 'name' => '王秀兰', 'gender' => 1, 'age' => 68,
                'phone' => '13600000001', 'chief_complaint' => '突发胸痛1小时', 'is_draft' => 0,
                'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 2, 'patient_no' => sprintf('EP-%s-002', $ymd), 'event_id' => "EVT-{$ymd}-02", 'task120_id' => "120-{$ymd}-02",
                'vehicle_id' => 'AMB-2', 'vehicle_plate' => '川K1202', 'name' => '李国强', 'gender' => 0, 'age' => 63,
                'phone' => '13600000002', 'chief_complaint' => '意识模糊伴呕吐2小时', 'is_draft' => 0,
                'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 3, 'patient_no' => sprintf('EP-%s-003', $ymd), 'event_id' => "EVT-{$ymd}-05", 'task120_id' => "120-{$ymd}-05",
                'vehicle_id' => 'AMB-6', 'vehicle_plate' => '川K1206', 'name' => '刘芳', 'gender' => 1, 'age' => 34,
                'phone' => '13600000005', 'chief_complaint' => '孕晚期腹痛、阴道流血', 'is_draft' => 0,
                'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 4, 'patient_no' => sprintf('EP-%s-004', $ymd), 'event_id' => "EVT-{$ymd}-06", 'task120_id' => "120-{$ymd}-06",
                'vehicle_id' => null, 'vehicle_plate' => '', 'name' => '陈建军', 'gender' => 0, 'age' => 41,
                'phone' => '13600000004', 'chief_complaint' => '车祸外伤、左下肢疼痛', 'is_draft' => 1,
                'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now,
            ],
        ]);
    }
}
