<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 患者基础数据（含院前上报明细）
 *
 * gender：0男 1女 2未知
 * stage：registered / transfer-requested / admitted
 * source：manual / 120
 */
class PatientSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $ymd = now()->format('Ymd');
        $at = fn (int $hour, int $minute) => now()->startOfDay()->copy()->addHours($hour)->addMinutes($minute);

        $patients = [
            [
                'id' => 1, 'name' => '王秀兰', 'gender' => 1, 'age' => 68, 'id_card' => '511024195803120012', 'phone' => '13600000001',
                'institution_id' => 'WY001', 'department_id' => 'CARDIO',
                'assigned_to' => ['WY001-CARDIO-doctor'],
                'stage' => 'admitted', 'chief_complaint' => '突发胸痛1小时',
                'symptoms' => ['胸痛', '大汗', '恶心'],
                'notes' => '本地虚构演示记录，不是真实病历，不用于临床判断。',
                'source' => 'manual',
                'prehospital' => ['complaint' => '突发胸痛1小时', 'symptoms' => ['胸痛', '大汗', '恶心']],
                'consultation_token' => 'xun-2026-0001', 'consultation_doctor_id' => 'weiyuan-emergency-doctor', 'consultation_request_id' => 'CR-F-001',
                'admitted_at' => $at(8, 30), 'is_draft' => 0,
            ],
            [
                'id' => 2, 'name' => '李国强', 'gender' => 0, 'age' => 63, 'id_card' => '511024196304120013', 'phone' => '13600000002',
                'institution_id' => 'WY001', 'department_id' => 'NEURO',
                'assigned_to' => ['WY001-NEURO-doctor'],
                'stage' => 'admitted', 'chief_complaint' => '意识模糊伴呕吐2小时',
                'symptoms' => ['意识模糊', '呕吐'],
                'notes' => null,
                'source' => 'manual',
                'prehospital' => ['complaint' => '意识模糊伴呕吐2小时', 'symptoms' => ['意识模糊', '呕吐']],
                'consultation_token' => null, 'consultation_doctor_id' => null, 'consultation_request_id' => null,
                'admitted_at' => $at(9, 40), 'is_draft' => 0,
            ],
            [
                'id' => 3, 'name' => '张桂英', 'gender' => 1, 'age' => 56, 'id_card' => '511024197008200014', 'phone' => '13600000003',
                'institution_id' => 'WY001', 'department_id' => 'ICU',
                'assigned_to' => ['WY001-ICU-doctor'],
                'stage' => 'admitted', 'chief_complaint' => '言语不清、右侧肢体无力1小时',
                'symptoms' => ['言语不清', '肢体无力'],
                'notes' => null,
                'source' => 'manual',
                'prehospital' => ['complaint' => '言语不清、右侧肢体无力1小时', 'symptoms' => ['言语不清', '肢体无力']],
                'consultation_token' => 'xun-2026-0003', 'consultation_doctor_id' => 'weiyuan-emergency-doctor', 'consultation_request_id' => 'CR-F-003',
                'admitted_at' => $at(8, 30), 'is_draft' => 0,
            ],
            [
                'id' => 4, 'name' => '陈建军', 'gender' => 0, 'age' => 41, 'id_card' => '511024198511020015', 'phone' => '13600000004',
                'institution_id' => 'WY001', 'department_id' => 'EMERGENCY',
                'assigned_to' => ['WY001-EMERGENCY-doctor'],
                'stage' => 'registered', 'chief_complaint' => '车祸外伤、左下肢疼痛',
                'symptoms' => ['外伤', '疼痛'],
                'notes' => null,
                'source' => 'manual',
                'prehospital' => ['complaint' => '车祸外伤、左下肢疼痛', 'symptoms' => ['外伤', '疼痛']],
                'consultation_token' => null, 'consultation_doctor_id' => null, 'consultation_request_id' => null,
                'admitted_at' => null, 'is_draft' => 0,
            ],
            [
                'id' => 5, 'name' => '刘芳', 'gender' => 1, 'age' => 34, 'id_card' => '511024199206180016', 'phone' => '13600000005',
                'institution_id' => 'LJ001', 'department_id' => 'GEN',
                'assigned_to' => ['LJ001-GEN-doctor'],
                'stage' => 'transfer-requested', 'chief_complaint' => '孕晚期腹痛、阴道流血',
                'symptoms' => ['腹痛', '阴道流血'],
                'notes' => null,
                'source' => '120',
                'prehospital' => ['complaint' => '孕晚期腹痛、阴道流血', 'symptoms' => ['腹痛', '阴道流血']],
                'consultation_token' => null, 'consultation_doctor_id' => null, 'consultation_request_id' => null,
                'admitted_at' => null, 'is_draft' => 0,
            ],
            [
                'id' => 6, 'name' => '赵德海', 'gender' => 0, 'age' => 71, 'id_card' => '511024195501300017', 'phone' => '13600000006',
                'institution_id' => 'XC001', 'department_id' => 'RESP',
                'assigned_to' => ['XC001-RESP-doctor'],
                'stage' => 'transfer-requested', 'chief_complaint' => '呼吸困难加重2天',
                'symptoms' => ['呼吸困难', '咳嗽'],
                'notes' => null,
                'source' => '120',
                'prehospital' => ['complaint' => '呼吸困难加重2天', 'symptoms' => ['呼吸困难', '咳嗽']],
                'consultation_token' => null, 'consultation_doctor_id' => null, 'consultation_request_id' => null,
                'admitted_at' => null, 'is_draft' => 0,
            ],
            [
                'id' => 7, 'name' => '周敏', 'gender' => 1, 'age' => 28, 'id_card' => '511024199809090018', 'phone' => '13600000007',
                'institution_id' => 'LJ001', 'department_id' => 'EMERGENCY',
                'assigned_to' => ['LJ001-EMERGENCY-doctor'],
                'stage' => 'registered', 'chief_complaint' => '高热惊厥',
                'symptoms' => ['发热', '抽搐'],
                'notes' => null,
                'source' => 'manual',
                'prehospital' => ['complaint' => '高热惊厥', 'symptoms' => ['发热', '抽搐']],
                'consultation_token' => null, 'consultation_doctor_id' => null, 'consultation_request_id' => null,
                'admitted_at' => null, 'is_draft' => 1,
            ],
            [
                'id' => 8, 'name' => '孙志强', 'gender' => 0, 'age' => 77, 'id_card' => '511024194912250019', 'phone' => '13600000008',
                'institution_id' => 'WY001', 'department_id' => 'CARDIO',
                'assigned_to' => ['WY001-CARDIO-doctor'],
                'stage' => 'admitted', 'chief_complaint' => '心悸、黑矇',
                'symptoms' => ['心悸', '黑矇'],
                'notes' => null,
                'source' => 'manual',
                'prehospital' => ['complaint' => '心悸、黑矇', 'symptoms' => ['心悸', '黑矇']],
                'consultation_token' => null, 'consultation_doctor_id' => null, 'consultation_request_id' => null,
                'admitted_at' => $at(10, 15), 'is_draft' => 0,
            ],
        ];

        // —— 在院占床患者：与 BedSeeder 的「占用床位」一一对应，保证床位/患者同源 ——
        // [机构, 科室, 姓名, 性别, 年龄, 主诉, 症状, 预警级别]
        $bedded = [
            ['WY001', 'EMERGENCY', '陈志明', 0, 57, '突发上腹痛3小时', ['腹痛', '恶心']],
            ['WY001', 'EMERGENCY', '罗秀英', 1, 64, '头晕伴呕吐1天', ['头晕', '呕吐']],
            ['WY001', 'EMERGENCY', '黄建平', 0, 45, '车祸致右小腿疼痛', ['外伤', '疼痛']],
            ['WY001', 'ICU', '刘振华', 0, 72, '重症肺炎、呼吸衰竭', ['呼吸困难', '发热']],
            ['WY001', 'ICU', '曾丽华', 1, 61, '感染性休克', ['低血压', '发热']],
            ['WY001', 'ICU', '王大明', 0, 55, '急性心肌梗死溶栓后', ['胸痛', '心悸']],
            ['WY001', 'ICU', '李桂芳', 1, 78, '脑出血术后监护', ['意识障碍']],
            ['WY001', 'ICU', '杨建国', 0, 66, '重症急性胰腺炎', ['腹痛', '腹胀']],
            ['WY001', 'ICU', '邓小燕', 1, 49, '多发伤术后', ['外伤', '疼痛']],
            ['HX001', 'ICU', '周文彬', 0, 58, '主动脉夹层术后', ['胸痛']],
            ['HX001', 'ICU', '吴海燕', 1, 63, '脓毒症休克', ['发热', '低血压']],
            ['HX001', 'ICU', '郑国强', 0, 70, '重症肺炎 ECMO 辅助', ['呼吸困难']],
            ['HX001', 'EMERGENCY', '冯雪梅', 1, 39, '转移性右下腹痛1天', ['腹痛']],
            ['HX001', 'EMERGENCY', '何志强', 0, 52, '急性缺血性脑卒中', ['言语不清', '肢体无力']],
            ['HX001', 'EMERGENCY', '唐小丽', 1, 31, '高热伴抽搐', ['发热', '抽搐']],
            ['NJ001', 'ICU', '曹建华', 0, 67, '慢阻肺急性加重', ['呼吸困难', '咳嗽']],
            ['NJ001', 'ICU', '谢明芳', 1, 74, '急性心力衰竭', ['气促', '双下肢浮肿']],
            ['NJ001', 'ICU', '韩伟东', 0, 46, '急性重症胰腺炎', ['腹痛']],
            ['NJ001', 'ICU', '潘桂兰', 1, 69, '糖尿病酮症酸中毒', ['乏力', '恶心']],
            ['NJ001', 'ICU', '汪志远', 0, 53, '上消化道大出血', ['呕血', '黑便']],
            ['NJ001', 'ICU', '卢晓燕', 1, 44, '重症哮喘发作', ['喘息', '呼吸困难']],
            ['NJ001', 'EMERGENCY', '谭志诚', 0, 62, '胸痛待查', ['胸痛']],
            ['NJ001', 'EMERGENCY', '白秀珍', 1, 71, '晕厥待查', ['晕厥']],
            ['NJ001', 'EMERGENCY', '石俊杰', 0, 35, '急性酒精中毒', ['意识模糊']],
            ['NJ001', 'EMERGENCY', '龚美华', 1, 58, '急性胆囊炎', ['腹痛', '发热']],
            ['LJ001', 'GASTRO', '尹国平', 0, 60, '呕血2小时', ['呕血', '黑便']],
            ['LJ001', 'GASTRO', '邹玉兰', 1, 55, '腹痛腹泻3天', ['腹痛', '腹泻']],
            ['LJ001', 'GASTRO', '方海涛', 0, 48, '急性胰腺炎', ['腹痛', '呕吐']],
            // 威远心血管内科 / 神经内科住院患者（对应 WY001-CARDIO-xx、WY001-NEURO-xx 占用床位）
            ['WY001', 'CARDIO', '龚淑芬', 1, 73, '冠心病、不稳定型心绞痛', ['胸痛', '气促']],
            ['WY001', 'CARDIO', '范建军', 0, 59, '高血压急症', ['头晕', '头痛']],
            ['WY001', 'NEURO', '崔玉兰', 1, 68, '急性缺血性脑卒中', ['言语不清', '肢体无力']],
            // 补足 ICU 占床：威远 ICU-02、华西 ICU-01
            ['WY001', 'ICU', '孙宝国', 0, 64, '重症急性胰腺炎、呼吸机辅助', ['腹胀', '呼吸困难']],
            ['HX001', 'ICU', '钱学明', 0, 57, '主动脉夹层术后监护', ['胸痛']],
        ];

        foreach ($bedded as $offset => [$org, $dept, $name, $gender, $age, $complaint, $symptoms]) {
            $seq = 9 + $offset; // 接续上表 001~008，生成 009~041
            $patients[] = [
                'id' => $seq,
                'name' => $name, 'gender' => $gender, 'age' => $age,
                'id_card' => sprintf('511024%s%04d', str_pad((string) (1960 + ($seq % 30)), 4, '0', STR_PAD_LEFT), 20 + $seq),
                'phone' => sprintf('1360000%04d', $seq),
                'institution_id' => $org, 'department_id' => $dept,
                'assigned_to' => ["{$org}-{$dept}-doctor"],
                'stage' => 'admitted', 'chief_complaint' => $complaint,
                'symptoms' => $symptoms,
                'notes' => '本地虚构演示记录，不是真实病历，不用于临床判断。',
                'source' => $seq % 3 === 0 ? '120' : 'manual',
                'prehospital' => ['complaint' => $complaint, 'symptoms' => $symptoms],
                'consultation_token' => null, 'consultation_doctor_id' => null, 'consultation_request_id' => null,
                'admitted_at' => $at(7 + ($seq % 4), ($seq * 7) % 60), 'is_draft' => 0,
            ];
        }

        foreach ($patients as $index => $patient) {
            // json 列需手动编码，DB 门面 insert 不会自动转换数组
            foreach (['assigned_to', 'symptoms', 'prehospital'] as $jsonColumn) {
                if (isset($patient[$jsonColumn]) && is_array($patient[$jsonColumn])) {
                    $patient[$jsonColumn] = json_encode($patient[$jsonColumn], JSON_UNESCAPED_UNICODE);
                }
            }

            $patients[$index] = array_merge([
                'patient_id' => sprintf('PAT-%s-%03d', $ymd, $index + 1),
                'source_record_id' => sprintf('MOBILE-PAT-%03d', $index + 1),
                'is_deleted' => 0, 'deleted_at' => null,
                'created_at' => $now, 'updated_at' => $now,
            ], $patient);
        }

        DB::table('patients')->insert($patients);
    }
}
