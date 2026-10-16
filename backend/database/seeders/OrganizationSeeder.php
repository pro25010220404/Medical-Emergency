<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * 机构与科室基础数据
 *
 * 机构层级：center 中心 / city 市级 / county 县级 / township 乡镇 / village 村级
 * tier：0中心 1市级 2县级 3乡镇 4村级
 */
class OrganizationSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        // 机构：固定 ID 1~6，供其他表跨表引用
        DB::table('organizations')->insert([
            [
                'id' => 1, 'org_code' => 'HX001', 'org_name' => '四川大学华西医院', 'org_type' => '急救中心',
                'county_name' => '武侯区', 'address' => '四川省成都市武侯区国学巷37号',
                'lng' => 104.064000, 'lat' => 30.659000, 'contact_phone' => '028-85422114',
                'short_name' => '华西医院', 'level' => 'center', 'province' => '四川省', 'city' => '成都市',
                'town' => '玉林街道', 'verified' => 1, 'current_operation_verified' => 1,
                'verification_scope' => '省级急危重症协同中心', 'tier' => 0,
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 2, 'org_code' => 'WY001', 'org_name' => '威远县人民医院', 'org_type' => '县医院',
                'county_name' => '威远县', 'address' => '四川省内江市威远县严陵镇建设街1号',
                'lng' => 104.668000, 'lat' => 29.527000, 'contact_phone' => '0832-8222100',
                'short_name' => '威远县医院', 'level' => 'county', 'province' => '四川省', 'city' => '内江市',
                'town' => '严陵镇', 'verified' => 1, 'current_operation_verified' => 1,
                'verification_scope' => '县域急救调度中心', 'tier' => 2,
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 3, 'org_code' => 'LJ001', 'org_name' => '连界镇中心卫生院', 'org_type' => '乡镇卫生院',
                'county_name' => '威远县', 'address' => '四川省内江市威远县连界镇连界街128号',
                'lng' => 104.540000, 'lat' => 29.640000, 'contact_phone' => '0832-8525100',
                'short_name' => '连界卫生院', 'level' => 'township', 'province' => '四川省', 'city' => '内江市',
                'town' => '连界镇', 'verified' => 1, 'current_operation_verified' => 1,
                'verification_scope' => '县域医共体成员单位', 'tier' => 3,
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 4, 'org_code' => 'XC001', 'org_name' => '新场镇卫生院', 'org_type' => '乡镇卫生院',
                'county_name' => '威远县', 'address' => '四川省内江市威远县新场镇兴新街56号',
                'lng' => 104.600000, 'lat' => 29.560000, 'contact_phone' => '0832-8530100',
                'short_name' => '新场卫生院', 'level' => 'township', 'province' => '四川省', 'city' => '内江市',
                'town' => '新场镇', 'verified' => 1, 'current_operation_verified' => 1,
                'verification_scope' => '县域医共体成员单位', 'tier' => 3,
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 5, 'org_code' => 'YX001', 'org_name' => '越溪镇村卫生室', 'org_type' => '村卫生室',
                'county_name' => '威远县', 'address' => '四川省内江市威远县越溪镇越溪村',
                'lng' => 104.580000, 'lat' => 29.500000, 'contact_phone' => '0832-8541100',
                'short_name' => '越溪卫生室', 'level' => 'village', 'province' => '四川省', 'city' => '内江市',
                'town' => '越溪镇', 'verified' => 0, 'current_operation_verified' => 1,
                'verification_scope' => '村级卫生服务点', 'tier' => 4,
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'id' => 6, 'org_code' => 'NJ001', 'org_name' => '内江市第一人民医院', 'org_type' => '市级医院',
                'county_name' => '市中区', 'address' => '四川省内江市市中区交通路1号',
                'lng' => 105.067000, 'lat' => 29.587000, 'contact_phone' => '0832-2205500',
                'short_name' => '内江一院', 'level' => 'city', 'province' => '四川省', 'city' => '内江市',
                'town' => '城西街道', 'verified' => 1, 'current_operation_verified' => 1,
                'verification_scope' => '川南区域协同医院', 'tier' => 1,
                'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now,
            ],
        ]);

        // 科室：dept_code 与各业务表的 department_id 对应
        DB::table('departments')->insert([
            ['id' => 1, 'org_id' => 1, 'dept_code' => 'EMERGENCY', 'dept_name' => '急诊科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 2, 'org_id' => 1, 'dept_code' => 'ICU', 'dept_name' => '重症医学科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 3, 'org_id' => 1, 'dept_code' => 'CARDIO', 'dept_name' => '心血管内科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 4, 'org_id' => 1, 'dept_code' => 'NEURO', 'dept_name' => '神经内科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 5, 'org_id' => 1, 'dept_code' => 'SURGERY', 'dept_name' => '普外科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 6, 'org_id' => 2, 'dept_code' => 'EMERGENCY', 'dept_name' => '急诊科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 7, 'org_id' => 2, 'dept_code' => 'ICU', 'dept_name' => '重症医学科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 8, 'org_id' => 2, 'dept_code' => 'CARDIO', 'dept_name' => '心血管内科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 9, 'org_id' => 2, 'dept_code' => 'NEURO', 'dept_name' => '神经内科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 10, 'org_id' => 2, 'dept_code' => 'RESP', 'dept_name' => '呼吸内科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 11, 'org_id' => 3, 'dept_code' => 'EMERGENCY', 'dept_name' => '急诊科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 12, 'org_id' => 3, 'dept_code' => 'GEN', 'dept_name' => '全科医学科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 13, 'org_id' => 4, 'dept_code' => 'EMERGENCY', 'dept_name' => '急诊科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 14, 'org_id' => 6, 'dept_code' => 'EMERGENCY', 'dept_name' => '急诊科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 15, 'org_id' => 6, 'dept_code' => 'ICU', 'dept_name' => '重症医学科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
            // 连界镇中心卫生院住院床位所在科室（前端 lianjie 机构公开科室仅含消化内科）
            ['id' => 16, 'org_id' => 3, 'dept_code' => 'GASTRO', 'dept_name' => '消化内科', 'is_deleted' => 0, 'deleted_at' => null, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }
}
