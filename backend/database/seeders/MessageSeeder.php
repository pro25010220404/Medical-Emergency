<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 消息中心：站内消息 / 服务通知 / 待办提醒
 */
class MessageSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $ymd = now()->format('Ymd');
        $p1 = 'PAT-'.$ymd.'-001';
        $p2 = 'PAT-'.$ymd.'-002';
        $p40 = 'PAT-'.$ymd.'-040';

        // 站内消息 category：alert/consult/transfer
        DB::table('messages')->insert([
            ['id' => 1, 'message_id' => "MSG-{$ymd}-001", 'title' => '危急值预警', 'text' => '心内科 12床 NEWS 评分 7 分，请立即处置', 'is_read' => 0, 'patient_id' => $p1, 'patient_name' => '王秀兰', 'category' => 'alert', 'link' => '/warning/WARN-'.$ymd.'-001', 'at' => now()->subMinutes(28), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'message_id' => "MSG-{$ymd}-002", 'title' => '远程会诊申请', 'text' => '连界镇中心卫生院申请胸痛会诊', 'is_read' => 0, 'patient_id' => $p1, 'patient_name' => '王秀兰', 'category' => 'consult', 'link' => '/consult/consult-'.$ymd.'-001', 'at' => now()->subMinutes(18), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'message_id' => "MSG-{$ymd}-003", 'title' => '转运任务已确认', 'text' => '威远县人民医院已接收转诊单 TR-'.$ymd.'-001', 'is_read' => 1, 'patient_id' => $p1, 'patient_name' => '王秀兰', 'category' => 'transfer', 'link' => '/transfer/TR-'.$ymd.'-001', 'at' => now()->subMinutes(15), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'message_id' => "MSG-{$ymd}-004", 'title' => '检验危急值通知', 'text' => '神经内科 08床 收缩压 186 mmHg', 'is_read' => 0, 'patient_id' => $p2, 'patient_name' => '李国强', 'category' => 'alert', 'link' => '/critical/CV-'.$ymd.'-001', 'at' => now()->subMinutes(9), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 5, 'message_id' => "MSG-{$ymd}-005", 'title' => '会诊已接诊', 'text' => '刘敏医生已接诊卒中会诊', 'is_read' => 1, 'patient_id' => $p2, 'patient_name' => '李国强', 'category' => 'consult', 'link' => '/consult/consult-'.$ymd.'-002', 'at' => now()->subMinutes(24), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 6, 'message_id' => "MSG-{$ymd}-006", 'title' => '转诊单待确认', 'text' => '新场镇卫生院转诊单 TR-'.$ymd.'-002 待接收', 'is_read' => 0, 'patient_id' => null, 'patient_name' => null, 'category' => 'transfer', 'link' => '/transfer/TR-'.$ymd.'-002', 'at' => now()->subMinutes(6), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 7, 'message_id' => "MSG-{$ymd}-007", 'title' => '床位预警', 'text' => '重症医学科床位占用率已达 80%', 'is_read' => 1, 'patient_id' => null, 'patient_name' => null, 'category' => 'alert', 'link' => '/beds/WY001', 'at' => now()->subHours(2), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 8, 'message_id' => "MSG-{$ymd}-008", 'title' => '设备报警', 'text' => 'ICU-02 监护仪报警，请检查', 'is_read' => 0, 'patient_id' => $p40, 'patient_name' => '孙宝国', 'category' => 'alert', 'link' => '/device/DEV-MON-002', 'at' => now()->subMinutes(12), 'created_at' => $now, 'updated_at' => $now],
        ]);

        // 服务通知 channel：wechat/sms
        DB::table('notifications')->insert([
            ['id' => 1, 'notification_id' => "NOTIF-{$ymd}-001", 'title' => '出院随访提醒', 'text' => '王秀兰患者出院后第 3 天随访', 'is_read' => 0, 'patient_name' => '王秀兰', 'channel' => 'wechat', 'token' => 'wx-token-abc001', 'at' => now()->subMinutes(40), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'notification_id' => "NOTIF-{$ymd}-002", 'title' => '复查提醒', 'text' => '李国强患者需复查头颅 CT', 'is_read' => 1, 'patient_name' => '李国强', 'channel' => 'sms', 'token' => null, 'at' => now()->subHours(3), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'notification_id' => "NOTIF-{$ymd}-003", 'title' => '用药提醒', 'text' => '张桂英患者抗血小板药物治疗提醒', 'is_read' => 0, 'patient_name' => '张桂英', 'channel' => 'wechat', 'token' => 'wx-token-abc003', 'at' => now()->subMinutes(20), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'notification_id' => "NOTIF-{$ymd}-004", 'title' => '转诊结果通知', 'text' => '您的转诊申请已被接收', 'is_read' => 0, 'patient_name' => '王秀兰', 'channel' => 'sms', 'token' => null, 'at' => now()->subMinutes(14), 'created_at' => $now, 'updated_at' => $now],
        ]);

        // 待办提醒 priority：P0/P1；status：open/done
        DB::table('todos')->insert([
            ['id' => 1, 'todo_id' => "TODO-{$ymd}-001", 'title' => '处置 NEWS 高危预警', 'hint' => '心内科 12床 待确认', 'tone' => 'danger', 'go' => '/warning/WARN-'.$ymd.'-001', 'priority' => 'P0', 'status' => 'open', 'at' => now()->subMinutes(28), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'todo_id' => "TODO-{$ymd}-002", 'title' => '接收待确认转诊单', 'hint' => 'TR-'.$ymd.'-002 待接收', 'tone' => 'warn', 'go' => '/transfer/TR-'.$ymd.'-002', 'priority' => 'P0', 'status' => 'open', 'at' => now()->subMinutes(6), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'todo_id' => "TODO-{$ymd}-003", 'title' => '处理会诊申请', 'hint' => 'consult-'.$ymd.'-001 待接诊', 'tone' => 'warn', 'go' => '/consult/consult-'.$ymd.'-001', 'priority' => 'P1', 'status' => 'open', 'at' => now()->subMinutes(18), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'todo_id' => "TODO-{$ymd}-004", 'title' => '设备报警核查', 'hint' => 'ICU-02 监护仪报警', 'tone' => 'danger', 'go' => '/device/DEV-MON-002', 'priority' => 'P0', 'status' => 'open', 'at' => now()->subMinutes(12), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 5, 'todo_id' => "TODO-{$ymd}-005", 'title' => '质控问题整改', 'hint' => '出警响应超时待整改', 'tone' => 'warn', 'go' => '/qc/QC-'.$ymd.'-001', 'priority' => 'P1', 'status' => 'open', 'at' => now()->subHours(2), 'created_at' => $now, 'updated_at' => $now],
            ['id' => 6, 'todo_id' => "TODO-{$ymd}-006", 'title' => '查房记录补录', 'hint' => 'WR-'.$ymd.'-003 待开始', 'tone' => 'default', 'go' => '/wards/WR-'.$ymd.'-003', 'priority' => 'P1', 'status' => 'done', 'at' => now()->subHours(4), 'created_at' => $now, 'updated_at' => $now],
        ]);
    }
}
