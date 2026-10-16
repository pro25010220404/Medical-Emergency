<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 预警 / 预警趋势 / 处置闭环统计 / 处置记录 / 检验危急值
 *
 * level：urgent紧急 warning关注
 * status：new/acknowledged/treating/resolved
 */
class WarningSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $ymd = now()->format('Ymd');
        $today = now()->toDateString();
        $yesterday = now()->subDay()->toDateString();
        $day = now()->copy()->startOfDay();
        $at = fn (int $hour, int $minute) => $day->copy()->addHours($hour)->addMinutes($minute);

        DB::table('warnings')->insert([
            [
                'id' => 1, 'warning_no' => "WARN-{$ymd}-001", 'patient_id' => 'PAT-'.now()->format('Ymd').'-001', 'patient_label' => '心内科 12床',
                'category' => 'NEWS', 'title' => 'NEWS 评分升高', 'metric' => 'NEWS', 'current_value' => 7,
                'threshold' => '≥5', 'level' => 'urgent', 'status' => 'new',
                'institution_id' => 'WY001', 'department_id' => 'CARDIO', 'occurred_at' => $at(8, 20),
                'created_at' => $now->copy()->subMinutes(30), 'updated_at' => $now,
            ],
            [
                'id' => 2, 'warning_no' => "WARN-{$ymd}-002", 'patient_id' => 'PAT-'.now()->format('Ymd').'-002', 'patient_label' => '神经内科 08床',
                'category' => 'CRITICAL_VALUE', 'title' => '血压危急值', 'metric' => '收缩压', 'current_value' => 186,
                'threshold' => '≥180', 'level' => 'urgent', 'status' => 'acknowledged',
                'institution_id' => 'WY001', 'department_id' => 'NEURO', 'occurred_at' => $at(9, 10),
                'created_at' => $now->copy()->subMinutes(26), 'updated_at' => $now,
            ],
            [
                'id' => 3, 'warning_no' => "WARN-{$ymd}-003", 'patient_id' => 'PAT-'.now()->format('Ymd').'-005', 'patient_label' => '全科 03床',
                'category' => 'VASOACTIVE', 'title' => '血管活性药物使用后血压偏低', 'metric' => '收缩压', 'current_value' => 88,
                'threshold' => '≤90', 'level' => 'warning', 'status' => 'treating',
                'institution_id' => 'LJ001', 'department_id' => 'GEN', 'occurred_at' => $at(11, 15),
                'created_at' => $now->copy()->subMinutes(15), 'updated_at' => $now,
            ],
            [
                'id' => 4, 'warning_no' => "WARN-{$ymd}-004", 'patient_id' => 'PAT-'.now()->format('Ymd').'-008', 'patient_label' => '心内科 08床',
                'category' => 'COAG', 'title' => '凝血指标异常', 'metric' => 'D-二聚体', 'current_value' => 12.50,
                'threshold' => '≥5.0', 'level' => 'warning', 'status' => 'resolved',
                'institution_id' => 'WY001', 'department_id' => 'CARDIO', 'occurred_at' => $at(7, 45),
                'created_at' => $now->copy()->subMinutes(200), 'updated_at' => $now,
            ],
            [
                'id' => 5, 'warning_no' => "WARN-{$ymd}-005", 'patient_id' => 'PAT-'.now()->format('Ymd').'-003', 'patient_label' => 'ICU 01床',
                'category' => 'NEWS', 'title' => 'SpO₂ 持续偏低', 'metric' => 'SpO2', 'current_value' => 89,
                'threshold' => '<93', 'level' => 'urgent', 'status' => 'treating',
                'institution_id' => 'WY001', 'department_id' => 'icu', 'occurred_at' => $at(8, 50),
                'created_at' => $now->copy()->subMinutes(20), 'updated_at' => $now,
            ],
            [
                'id' => 6, 'warning_no' => "WARN-{$ymd}-006", 'patient_id' => 'PAT-'.now()->format('Ymd').'-006', 'patient_label' => '呼吸内科 05床',
                'category' => 'CRITICAL_VALUE', 'title' => '动脉血氧分压危急值', 'metric' => 'PaO2', 'current_value' => 58.00,
                'threshold' => '<60', 'level' => 'urgent', 'status' => 'new',
                'institution_id' => 'WY001', 'department_id' => 'RESP', 'occurred_at' => $at(12, 25),
                'created_at' => $now->copy()->subMinutes(10), 'updated_at' => $now,
            ],
            [
                'id' => 7, 'warning_no' => "WARN-{$ymd}-007", 'patient_id' => 'PAT-'.now()->format('Ymd').'-040', 'patient_label' => 'ICU 02床',
                'category' => 'NEWS', 'title' => '心率增快预警', 'metric' => 'HR', 'current_value' => 118.00,
                'threshold' => '>100', 'level' => 'warning', 'status' => 'acknowledged',
                'institution_id' => 'WY001', 'department_id' => 'icu', 'occurred_at' => $at(9, 40),
                'created_at' => $now->copy()->subMinutes(24), 'updated_at' => $now,
            ],
            [
                'id' => 8, 'warning_no' => "WARN-{$ymd}-008", 'patient_id' => 'PAT-'.now()->format('Ymd').'-013', 'patient_label' => 'ICU 05床',
                'category' => 'COAG', 'title' => '血小板计数下降', 'metric' => 'PLT', 'current_value' => 45.00,
                'threshold' => '<50', 'level' => 'urgent', 'status' => 'new',
                'institution_id' => 'WY001', 'department_id' => 'icu', 'occurred_at' => $at(10, 5),
                'created_at' => $now->copy()->subMinutes(18), 'updated_at' => $now,
            ],
        ]);

        DB::table('warning_trends')->insert([
            ['id' => 1, 'trend_id' => 'TR-01', 'patient_id' => "PAT-{$ymd}-001", 'patient_label' => '心内科 12床', 'metric' => 'NEWS', 'current_value' => 7.00, 'predicted_value' => 9.00, 'within_minutes' => 30, 'note' => '预计 30 分钟内病情恶化', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'trend_id' => 'TR-02', 'patient_id' => "PAT-{$ymd}-003", 'patient_label' => 'ICU 01床', 'metric' => 'SpO2', 'current_value' => 89.00, 'predicted_value' => 85.00, 'within_minutes' => 15, 'note' => '血氧持续下降', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'trend_id' => 'TR-03', 'patient_id' => "PAT-{$ymd}-002", 'patient_label' => '神经内科 08床', 'metric' => '收缩压', 'current_value' => 186.00, 'predicted_value' => 195.00, 'within_minutes' => 45, 'note' => '血压进行性升高', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'trend_id' => 'TR-04', 'patient_id' => "PAT-{$ymd}-006", 'patient_label' => '呼吸内科 05床', 'metric' => 'PaO2', 'current_value' => 58.00, 'predicted_value' => 52.00, 'within_minutes' => 20, 'note' => '呼吸衰竭风险', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 5, 'trend_id' => 'TR-05', 'patient_id' => "PAT-{$ymd}-008", 'patient_label' => '心内科 08床', 'metric' => 'D-二聚体', 'current_value' => 12.50, 'predicted_value' => 14.00, 'within_minutes' => 60, 'note' => '血栓风险升高', 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('warning_closed_loop')->insert([
            ['id' => 1, 'stage' => '预警触发', 'count' => 12, 'stat_date' => $today, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'stage' => '护士确认', 'count' => 10, 'stat_date' => $today, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'stage' => '医生到床', 'count' => 9, 'stat_date' => $today, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'stage' => '干预完成', 'count' => 8, 'stat_date' => $today, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 5, 'stage' => '预警触发', 'count' => 15, 'stat_date' => $yesterday, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 6, 'stage' => '护士确认', 'count' => 14, 'stat_date' => $yesterday, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 7, 'stage' => '医生到床', 'count' => 12, 'stat_date' => $yesterday, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 8, 'stage' => '干预完成', 'count' => 11, 'stat_date' => $yesterday, 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('warning_dispose_records')->insert([
            ['id' => 1, 'warning_id' => 2, 'warning_no' => "WARN-{$ymd}-002", 'stage' => '预警触发', 'note' => '系统自动触发血压危急值预警', 'actor_id' => 'system', 'actor_name' => '系统', 'acted_at' => $at(9, 10), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'warning_id' => 2, 'warning_no' => "WARN-{$ymd}-002", 'stage' => '护士确认', 'note' => '当班护士已确认并复测血压', 'actor_id' => 'nurse_chen', 'actor_name' => '陈静', 'acted_at' => $at(9, 14), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'warning_id' => 3, 'warning_no' => "WARN-{$ymd}-003", 'stage' => '预警触发', 'note' => '血管活性药物相关血压预警', 'actor_id' => 'system', 'actor_name' => '系统', 'acted_at' => $at(11, 15), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'warning_id' => 3, 'warning_no' => "WARN-{$ymd}-003", 'stage' => '护士确认', 'note' => '已通知值班医生', 'actor_id' => 'nurse_chen', 'actor_name' => '陈静', 'acted_at' => $at(11, 18), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 5, 'warning_id' => 4, 'warning_no' => "WARN-{$ymd}-004", 'stage' => '预警触发', 'note' => '凝血指标触发预警', 'actor_id' => 'system', 'actor_name' => '系统', 'acted_at' => $at(7, 45), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 6, 'warning_id' => 4, 'warning_no' => "WARN-{$ymd}-004", 'stage' => '医生到床', 'note' => '张伟医生到达床旁评估', 'actor_id' => 'doctor_zhang', 'actor_name' => '张伟', 'acted_at' => $at(8, 0), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 7, 'warning_id' => 4, 'warning_no' => "WARN-{$ymd}-004", 'stage' => '干预完成', 'note' => '调整抗凝方案，指标回落', 'actor_id' => 'doctor_zhang', 'actor_name' => '张伟', 'acted_at' => $at(8, 30), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 8, 'warning_id' => 5, 'warning_no' => "WARN-{$ymd}-005", 'stage' => '预警触发', 'note' => 'SpO₂ 持续偏低', 'actor_id' => 'system', 'actor_name' => '系统', 'acted_at' => $at(8, 50), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 9, 'warning_id' => 5, 'warning_no' => "WARN-{$ymd}-005", 'stage' => '护士确认', 'note' => '已调整氧流量', 'actor_id' => 'nurse_chen', 'actor_name' => '陈静', 'acted_at' => $at(8, 55), 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('critical_values')->insert([
            [
                'id' => 1, 'critical_no' => "CV-{$ymd}-001", 'patient_id' => 'PAT-'.now()->format('Ymd').'-002', 'patient_label' => '神经内科 08床',
                'item_name' => '收缩压', 'result_value' => '186', 'unit' => 'mmHg', 'ref_range' => '90-140', 'critical_range' => '≥180',
                'specimen' => '床旁', 'level' => 'urgent', 'status' => 'notified',
                'institution_id' => 'WY001', 'department_id' => 'NEURO', 'reported_at' => $at(9, 8),
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 2, 'critical_no' => "CV-{$ymd}-002", 'patient_id' => 'PAT-'.now()->format('Ymd').'-006', 'patient_label' => '呼吸内科 05床',
                'item_name' => '动脉血氧分压', 'result_value' => '58', 'unit' => 'mmHg', 'ref_range' => '80-100', 'critical_range' => '<60',
                'specimen' => '动脉血', 'level' => 'urgent', 'status' => 'pending',
                'institution_id' => 'WY001', 'department_id' => 'RESP', 'reported_at' => $at(12, 20),
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 3, 'critical_no' => "CV-{$ymd}-003", 'patient_id' => 'PAT-'.now()->format('Ymd').'-003', 'patient_label' => 'ICU 01床',
                'item_name' => '血小板计数', 'result_value' => '45', 'unit' => '10^9/L', 'ref_range' => '125-350', 'critical_range' => '<50',
                'specimen' => '静脉血', 'level' => 'urgent', 'status' => 'handled',
                'institution_id' => 'WY001', 'department_id' => 'icu', 'reported_at' => $at(10, 0),
                'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 4, 'critical_no' => "CV-{$ymd}-004", 'patient_id' => 'PAT-'.now()->format('Ymd').'-008', 'patient_label' => '心内科 06床',
                'item_name' => 'D-二聚体', 'result_value' => '12.50', 'unit' => 'mg/L', 'ref_range' => '0-0.5', 'critical_range' => '≥5.0',
                'specimen' => '静脉血', 'level' => 'warning', 'status' => 'handled',
                'institution_id' => 'WY001', 'department_id' => 'CARDIO', 'reported_at' => $at(7, 40),
                'created_at' => $now, 'updated_at' => $now,
            ],
        ]);
    }
}
