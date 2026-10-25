<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 患者临床记录（clinical_notes）
 *
 * kind：护理记录 / 用药记录 / 检验记录 / 评估记录（患者详情 §3.3 按 kind 合并展示）
 */
class ClinicalNoteSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $ymd = now()->format('Ymd');
        $day = now()->copy()->startOfDay();
        $at = fn (int $hour, int $minute) => $day->copy()->addHours($hour)->addMinutes($minute);

        $p = fn (int $no) => sprintf('PAT-%s-%03d', $ymd, $no);

        $notes = [
            // 护理记录
            ['note_id' => "NOTE-{$ymd}-001", 'patient_id' => $p(1), 'kind' => '护理记录', 'title' => '晨间护理评估', 'text' => '患者夜间睡眠可，胸痛较前缓解，生命体征平稳，继续心电监护。', 'at' => $at(7, 30), 'actor_id' => 'nurse_chen'],
            ['note_id' => "NOTE-{$ymd}-002", 'patient_id' => $p(1), 'kind' => '护理记录', 'title' => '翻身拍背记录', 'text' => '协助翻身一次，皮肤完好无压红，骶尾部无破损。', 'at' => $at(13, 0), 'actor_id' => 'nurse_chen'],
            ['note_id' => "NOTE-{$ymd}-003", 'patient_id' => $p(3), 'kind' => '护理记录', 'title' => '意识状态评估', 'text' => 'GCS 11 分，瞳孔等大等圆，对光反射迟钝，加强床旁巡视。', 'at' => $at(8, 15), 'actor_id' => 'nurse_wang'],
            ['note_id' => "NOTE-{$ymd}-004", 'patient_id' => $p(8), 'kind' => '护理记录', 'title' => '心电监护护理', 'text' => '监护示房颤律，心室率波动在 90-110 次/分，无不适主诉。', 'at' => $at(10, 30), 'actor_id' => 'nurse_chen'],

            // 用药记录
            ['note_id' => "NOTE-{$ymd}-005", 'patient_id' => $p(1), 'kind' => '用药记录', 'title' => '抗血小板治疗', 'text' => '阿司匹林 300mg 嚼服，氯吡格雷 300mg 负荷量口服。', 'at' => $at(8, 40), 'actor_id' => 'doctor_zhang'],
            ['note_id' => "NOTE-{$ymd}-006", 'patient_id' => $p(1), 'kind' => '用药记录', 'title' => '抗凝治疗', 'text' => '低分子肝素 4000IU 皮下注射 q12h，监测凝血功能。', 'at' => $at(20, 0), 'actor_id' => 'doctor_zhang'],
            ['note_id' => "NOTE-{$ymd}-007", 'patient_id' => $p(2), 'kind' => '用药记录', 'title' => '降压治疗', 'text' => '乌拉地尔 12.5mg 静脉泵入，根据血压调整速率。', 'at' => $at(9, 50), 'actor_id' => 'doctor_liu'],
            ['note_id' => "NOTE-{$ymd}-008", 'patient_id' => $p(3), 'kind' => '用药记录', 'title' => '脱水降颅压', 'text' => '20% 甘露醇 125ml 静滴 q8h，记录出入量。', 'at' => $at(8, 40), 'actor_id' => 'doctor_wang'],
            ['note_id' => "NOTE-{$ymd}-009", 'patient_id' => $p(6), 'kind' => '用药记录', 'title' => '平喘治疗', 'text' => '多索茶碱 0.2g 静滴 bid，沙丁胺醇雾化吸入 q6h。', 'at' => $at(11, 20), 'actor_id' => 'doctor_he'],

            // 检验记录
            ['note_id' => "NOTE-{$ymd}-010", 'patient_id' => $p(1), 'kind' => '检验记录', 'title' => '心肌标志物复查', 'text' => 'cTnI 0.45 ng/mL 较前下降，CK-MB 正常范围。', 'at' => $at(14, 0), 'actor_id' => 'system'],
            ['note_id' => "NOTE-{$ymd}-011", 'patient_id' => $p(2), 'kind' => '检验记录', 'title' => '血常规', 'text' => 'WBC 11.2×10⁹/L，中性粒细胞 82%，血红蛋白 135 g/L。', 'at' => $at(9, 30), 'actor_id' => 'system'],
            ['note_id' => "NOTE-{$ymd}-012", 'patient_id' => $p(6), 'kind' => '检验记录', 'title' => '血气分析复查', 'text' => 'PaO2 68 mmHg，PaCO2 52 mmHg，pH 7.35，较前改善。', 'at' => $at(14, 30), 'actor_id' => 'system'],

            // 评估记录
            ['note_id' => "NOTE-{$ymd}-013", 'patient_id' => $p(2), 'kind' => '评估记录', 'title' => '跌倒风险评估', 'text' => 'Morse 跌倒风险评分 55 分（高危），已悬挂警示标识并留陪。', 'at' => $at(10, 0), 'actor_id' => 'nurse_chen'],
            ['note_id' => "NOTE-{$ymd}-014", 'patient_id' => $p(8), 'kind' => '评估记录', 'title' => '血栓风险评估', 'text' => 'Caprini 评分 5 分（高危），建议早期活动，必要时药物预防。', 'at' => $at(11, 0), 'actor_id' => 'doctor_zhang'],
        ];

        foreach ($notes as $index => $note) {
            $notes[$index] = array_merge([
                'id' => $index + 1,
                'created_at' => $now,
            ], $note);
        }

        DB::table('clinical_notes')->insert($notes);
    }
}
