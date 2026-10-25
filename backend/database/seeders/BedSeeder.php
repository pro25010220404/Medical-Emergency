<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 床位：科室床位台账 / 床位明细 / 床旁巡检
 *
 * beds.status：0空床 1占用 2预留 3维护
 *
 * 占用床位的 patient_id 与 PatientSeeder 的在院占床患者一一对应（PAT-{Ymd}-001 ~ 036），
 * 科室床位台账（department_beds）由同一份床位计划推导，三张表的占用口径保持一致。
 */
class BedSeeder extends Seeder
{
    /** 床位计划：[机构, 科室, 床号前缀, 全部床号, 占用床号, 预留床号] */
    private const PLAN = [
        ['WY001', 'EMERGENCY', '急诊', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [1, 2, 5], [3]],
        ['WY001', 'ICU', 'ICU', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [1, 2, 4, 5, 6, 7, 8, 9], []],
        // 王秀兰（PAT-001）住心内-12、李国强（PAT-002）住神内-08，与各业务表的床位标注一致
        ['WY001', 'CARDIO', '心内', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [2, 5, 8, 12], []],
        ['WY001', 'NEURO', '神内', [1, 2, 3, 4, 5, 6, 7, 8], [3, 8], []],
        ['HX001', 'ICU', 'ICU', [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4], []],
        ['HX001', 'EMERGENCY', '急诊', [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3], []],
        ['NJ001', 'ICU', 'ICU', [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6], []],
        ['NJ001', 'EMERGENCY', '急诊', [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4], [5]],
        ['LJ001', 'GASTRO', '消化', [1, 2, 3, 4], [1, 2, 3], []],
        ['XC001', 'EMERGENCY', '急诊', [3], [], [3]],
    ];

    /** 占用床位 → 患者序号（PatientSeeder 的 001~036 序号） */
    private const BED_PATIENT = [
        'WY001-EMERGENCY-01' => 9,
        'WY001-EMERGENCY-02' => 10,
        'WY001-EMERGENCY-05' => 11,
        // 患者 1/2/3/8 为上表 001~008 的住院患者，其机构+科室必须与床位一致，
        // 否则前端按 ui(session, patient) 过滤后会查不到患者、卡片退化成「空床」
        'WY001-CARDIO-08' => 8,
        'WY001-CARDIO-12' => 1,
        'WY001-NEURO-08' => 2,
        'WY001-CARDIO-02' => 37,
        'WY001-CARDIO-05' => 38,
        'WY001-NEURO-03' => 39,
        'WY001-ICU-01' => 3,
        'WY001-ICU-02' => 40,
        'WY001-ICU-04' => 12,
        'WY001-ICU-05' => 13,
        'WY001-ICU-06' => 14,
        'WY001-ICU-07' => 15,
        'WY001-ICU-08' => 16,
        'WY001-ICU-09' => 17,
        'HX001-ICU-01' => 41,
        'HX001-ICU-02' => 18,
        'HX001-ICU-03' => 19,
        'HX001-ICU-04' => 20,
        'HX001-EMERGENCY-01' => 21,
        'HX001-EMERGENCY-02' => 22,
        'HX001-EMERGENCY-03' => 23,
        'NJ001-ICU-01' => 24,
        'NJ001-ICU-02' => 25,
        'NJ001-ICU-03' => 26,
        'NJ001-ICU-04' => 27,
        'NJ001-ICU-05' => 28,
        'NJ001-ICU-06' => 29,
        'NJ001-EMERGENCY-01' => 30,
        'NJ001-EMERGENCY-02' => 31,
        'NJ001-EMERGENCY-03' => 32,
        'NJ001-EMERGENCY-04' => 33,
        'LJ001-GASTRO-01' => 34,
        'LJ001-GASTRO-02' => 35,
        'LJ001-GASTRO-03' => 36,
    ];

    public function run(): void
    {
        $now = now();
        $ymd = now()->format('Ymd');
        $day = now()->copy()->startOfDay();
        $at = fn (int $hour, int $minute) => $day->copy()->addHours($hour)->addMinutes($minute);

        $bedRows = [];
        $ledgerRows = [];
        $bedId = 0;
        $ledgerId = 0;

        foreach (self::PLAN as [$org, $dept, $prefix, $numbers, $occupiedNos, $reservedNos]) {
            $occupied = $free = $reserved = 0;

            foreach ($numbers as $no) {
                $bedCode = sprintf('%s-%s-%02d', $org, $dept, $no);
                if (in_array($no, $reservedNos, true)) {
                    $status = 2;
                    $reserved++;
                } elseif (in_array($no, $occupiedNos, true)) {
                    $status = 1;
                    $occupied++;
                } else {
                    $status = 0;
                    $free++;
                }

                $bedRows[] = [
                    'id' => ++$bedId,
                    'bed_id' => $bedCode,
                    'label' => sprintf('%s-%02d', $prefix, $no),
                    'institution_id' => $org,
                    'department_id' => $dept,
                    'status' => $status,
                    'patient_id' => $status === 1
                        ? sprintf('PAT-%s-%03d', $ymd, self::BED_PATIENT[$bedCode])
                        : null,
                    'reserve_reason' => $status === 2 ? '预留给转诊/待入院患者' : '',
                    'reserved_until' => $status === 2 ? $at(20, 0) : null,
                    'enabled' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            $ledgerRows[] = [
                'id' => ++$ledgerId,
                'hospital_id' => $org,
                'dept_id' => $dept,
                'name' => self::DEPT_NAMES[$dept] ?? $dept,
                'total' => count($numbers),
                'occupied' => $occupied,
                'reserved' => $reserved,
                'free' => $free,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('department_beds')->insert($ledgerRows);
        DB::table('beds')->insert($bedRows);

        DB::table('bed_inspections')->insert([
            ['id' => 1, 'inspection_id' => "BI-{$ymd}-001", 'bed_id' => 'WY001-EMERGENCY-01', 'institution_id' => 'WY001', 'department_id' => 'EMERGENCY', 'inspector_id' => 'nurse_chen', 'inspector_name' => '陈静', 'kind' => 'routine', 'inspect_at' => $at(8, 0), 'items' => json_encode([['name' => '床单位整洁', 'ok' => true], ['name' => '设备完好', 'ok' => true]], JSON_UNESCAPED_UNICODE), 'result' => 'normal', 'remark' => '常规巡检正常', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'inspection_id' => "BI-{$ymd}-002", 'bed_id' => 'WY001-ICU-01', 'institution_id' => 'WY001', 'department_id' => 'ICU', 'inspector_id' => 'nurse_chen', 'inspector_name' => '陈静', 'kind' => 'routine', 'inspect_at' => $at(9, 0), 'items' => json_encode([['name' => '监护仪报警设置', 'ok' => true], ['name' => '输液通路', 'ok' => true]], JSON_UNESCAPED_UNICODE), 'result' => 'normal', 'remark' => '', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'inspection_id' => "BI-{$ymd}-003", 'bed_id' => 'WY001-EMERGENCY-11', 'institution_id' => 'WY001', 'department_id' => 'EMERGENCY', 'inspector_id' => 'nurse_chen', 'inspector_name' => '陈静', 'kind' => 'handover', 'inspect_at' => $at(10, 30), 'items' => json_encode([['name' => '护栏功能', 'ok' => false]], JSON_UNESCAPED_UNICODE), 'result' => 'abnormal', 'remark' => '护栏松动，已报修', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'inspection_id' => "BI-{$ymd}-004", 'bed_id' => 'LJ001-GASTRO-01', 'institution_id' => 'LJ001', 'department_id' => 'GASTRO', 'inspector_id' => 'doctor_li', 'inspector_name' => '李明', 'kind' => 'routine', 'inspect_at' => $at(11, 20), 'items' => json_encode([['name' => '氧气装置', 'ok' => true]], JSON_UNESCAPED_UNICODE), 'result' => 'normal', 'remark' => '', 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    /** 科室名称：与 OrganizationSeeder 的 departments.dept_name 一致 */
    private const DEPT_NAMES = [
        'EMERGENCY' => '急诊科',
        'ICU' => '重症医学科',
        'CARDIO' => '心血管内科',
        'NEURO' => '神经内科',
        'GASTRO' => '消化内科',
    ];
}
