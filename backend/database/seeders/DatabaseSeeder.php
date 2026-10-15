<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * 按依赖顺序注册各领域 Seeder。
     */
    public function run(): void
    {
        $this->call([
            // 基础域：机构 → 科室 → 用户 → 车辆 → 患者
            OrganizationSeeder::class,
            UserSeeder::class,
            VehicleSeeder::class,
            PatientSeeder::class,

            // 调度域：急救事件 → 转运 → 病历 → 会诊 → 监控流
            EmergencyDispatchSeeder::class,
            TransferSeeder::class,
            ClinicalRecordSeeder::class,
            ClinicalNoteSeeder::class,
            ConsultationSeeder::class,
            MonitoringSeeder::class,

            // 监控域：预警 → 床位 → 设备 → 重症护理
            WarningSeeder::class,
            BedSeeder::class,
            DeviceSeeder::class,
            CareSeeder::class,

            // 其余：质控 → 时限 → 消息
            QualitySeeder::class,
            SlaSeeder::class,
            MessageSeeder::class,

            // 基层医声（04-会诊协同）：基层反馈 / 问题上报 + 协作消息
            DrSeeder::class,
        ]);
    }
}
