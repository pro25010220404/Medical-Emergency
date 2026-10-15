<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 床位：科室床位台账 / 床位明细 / 床旁巡检
 *
 * beds.status：0空床 1占用 2预留 3维护
 */
class BedSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $ymd = now()->format('Ymd');
        $day = now()->copy()->startOfDay();
        $at = fn (int $hour, int $minute) => $day->copy()->addHours($hour)->addMinutes($minute);

        // 科室床位台账：hospital_id=机构编码，dept_id=科室编码
        DB::table('department_beds')->insert([
            ['id' => 1, 'hospital_id' => 'WY001', 'dept_id' => 'EMERGENCY', 'name' => '急诊科', 'total' => 20, 'occupied' => 12, 'reserved' => 3, 'free' => 5, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'hospital_id' => 'WY001', 'dept_id' => 'ICU', 'name' => '重症医学科', 'total' => 10, 'occupied' => 8, 'reserved' => 0, 'free' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'hospital_id' => 'WY001', 'dept_id' => 'CARDIO', 'name' => '心血管内科', 'total' => 30, 'occupied' => 22, 'reserved' => 4, 'free' => 4, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'hospital_id' => 'WY001', 'dept_id' => 'NEURO', 'name' => '神经内科', 'total' => 25, 'occupied' => 18, 'reserved' => 2, 'free' => 5, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 5, 'hospital_id' => 'LJ001', 'dept_id' => 'EMERGENCY', 'name' => '急诊科', 'total' => 8, 'occupied' => 3, 'reserved' => 1, 'free' => 4, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 6, 'hospital_id' => 'XC001', 'dept_id' => 'EMERGENCY', 'name' => '急诊科', 'total' => 6, 'occupied' => 2, 'reserved' => 0, 'free' => 4, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 7, 'hospital_id' => 'HX001', 'dept_id' => 'ICU', 'name' => '重症医学科', 'total' => 40, 'occupied' => 34, 'reserved' => 3, 'free' => 3, 'created_at' => $now, 'updated_at' => $now],
        ]);

        $p1 = 'PAT-'.$ymd.'-001';
        $p2 = 'PAT-'.$ymd.'-002';
        $p3 = 'PAT-'.$ymd.'-003';
        $p5 = 'PAT-'.$ymd.'-005';

        DB::table('beds')->insert([
            ['id' => 1, 'bed_id' => 'WY001-EMERGENCY-01', 'label' => '急诊-01', 'institution_id' => 'WY001', 'department_id' => 'EMERGENCY', 'status' => 1, 'patient_id' => $p1, 'reserve_reason' => '', 'reserved_until' => null, 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'bed_id' => 'WY001-EMERGENCY-05', 'label' => '急诊-05', 'institution_id' => 'WY001', 'department_id' => 'EMERGENCY', 'status' => 1, 'patient_id' => $p5, 'reserve_reason' => '', 'reserved_until' => null, 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'bed_id' => 'WY001-EMERGENCY-09', 'label' => '急诊-09', 'institution_id' => 'WY001', 'department_id' => 'EMERGENCY', 'status' => 0, 'patient_id' => null, 'reserve_reason' => '', 'reserved_until' => null, 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'bed_id' => 'WY001-EMERGENCY-10', 'label' => '急诊-10', 'institution_id' => 'WY001', 'department_id' => 'EMERGENCY', 'status' => 2, 'patient_id' => null, 'reserve_reason' => '预留给转诊患者', 'reserved_until' => $at(20, 0), 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 5, 'bed_id' => 'WY001-EMERGENCY-11', 'label' => '急诊-11', 'institution_id' => 'WY001', 'department_id' => 'EMERGENCY', 'status' => 3, 'patient_id' => null, 'reserve_reason' => '设备检修', 'reserved_until' => null, 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 6, 'bed_id' => 'WY001-ICU-01', 'label' => 'ICU-01', 'institution_id' => 'WY001', 'department_id' => 'ICU', 'status' => 1, 'patient_id' => $p3, 'reserve_reason' => '', 'reserved_until' => null, 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 7, 'bed_id' => 'WY001-ICU-02', 'label' => 'ICU-02', 'institution_id' => 'WY001', 'department_id' => 'ICU', 'status' => 1, 'patient_id' => $p1, 'reserve_reason' => '', 'reserved_until' => null, 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 8, 'bed_id' => 'WY001-ICU-03', 'label' => 'ICU-03', 'institution_id' => 'WY001', 'department_id' => 'ICU', 'status' => 0, 'patient_id' => null, 'reserve_reason' => '', 'reserved_until' => null, 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 9, 'bed_id' => 'WY001-CARDIO-12', 'label' => '心内-12', 'institution_id' => 'WY001', 'department_id' => 'CARDIO', 'status' => 1, 'patient_id' => $p1, 'reserve_reason' => '', 'reserved_until' => null, 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 10, 'bed_id' => 'WY001-NEURO-08', 'label' => '神内-08', 'institution_id' => 'WY001', 'department_id' => 'NEURO', 'status' => 1, 'patient_id' => $p2, 'reserve_reason' => '', 'reserved_until' => null, 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 11, 'bed_id' => 'LJ001-EMERGENCY-02', 'label' => '急诊-02', 'institution_id' => 'LJ001', 'department_id' => 'EMERGENCY', 'status' => 1, 'patient_id' => $p2, 'reserve_reason' => '', 'reserved_until' => null, 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 12, 'bed_id' => 'XC001-EMERGENCY-03', 'label' => '急诊-03', 'institution_id' => 'XC001', 'department_id' => 'EMERGENCY', 'status' => 2, 'patient_id' => null, 'reserve_reason' => '等床位患者预留', 'reserved_until' => $at(18, 0), 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 13, 'bed_id' => 'HX001-ICU-01', 'label' => 'ICU-01', 'institution_id' => 'HX001', 'department_id' => 'ICU', 'status' => 1, 'patient_id' => $p3, 'reserve_reason' => '', 'reserved_until' => null, 'enabled' => 1, 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('bed_inspections')->insert([
            ['id' => 1, 'inspection_id' => "BI-{$ymd}-001", 'bed_id' => 'WY001-EMERGENCY-01', 'institution_id' => 'WY001', 'department_id' => 'EMERGENCY', 'inspector_id' => 'nurse_chen', 'inspector_name' => '陈静', 'kind' => 'routine', 'inspect_at' => $at(8, 0), 'items' => json_encode([['name' => '床单位整洁', 'ok' => true], ['name' => '设备完好', 'ok' => true]], JSON_UNESCAPED_UNICODE), 'result' => 'normal', 'remark' => '常规巡检正常', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'inspection_id' => "BI-{$ymd}-002", 'bed_id' => 'WY001-ICU-01', 'institution_id' => 'WY001', 'department_id' => 'ICU', 'inspector_id' => 'nurse_chen', 'inspector_name' => '陈静', 'kind' => 'routine', 'inspect_at' => $at(9, 0), 'items' => json_encode([['name' => '监护仪报警设置', 'ok' => true], ['name' => '输液通路', 'ok' => true]], JSON_UNESCAPED_UNICODE), 'result' => 'normal', 'remark' => '', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'inspection_id' => "BI-{$ymd}-003", 'bed_id' => 'WY001-EMERGENCY-11', 'institution_id' => 'WY001', 'department_id' => 'EMERGENCY', 'inspector_id' => 'nurse_chen', 'inspector_name' => '陈静', 'kind' => 'handover', 'inspect_at' => $at(10, 30), 'items' => json_encode([['name' => '护栏功能', 'ok' => false]], JSON_UNESCAPED_UNICODE), 'result' => 'abnormal', 'remark' => '护栏松动，已报修', 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'inspection_id' => "BI-{$ymd}-004", 'bed_id' => 'LJ001-EMERGENCY-02', 'institution_id' => 'LJ001', 'department_id' => 'EMERGENCY', 'inspector_id' => 'doctor_li', 'inspector_name' => '李明', 'kind' => 'routine', 'inspect_at' => $at(11, 20), 'items' => json_encode([['name' => '氧气装置', 'ok' => true]], JSON_UNESCAPED_UNICODE), 'result' => 'normal', 'remark' => '', 'created_at' => $now, 'updated_at' => $now],
        ]);
    }
}
