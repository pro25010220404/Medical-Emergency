<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * 患者档案（patients，03-患者与床位/02-患者管理接口 §2.1）
 */
class Patient extends BaseModel
{
    protected $fillable = [
        'patient_id', 'name', 'gender', 'age', 'id_card', 'phone',
        'institution_id', 'department_id', 'assigned_to', 'stage',
        'chief_complaint', 'symptoms', 'notes', 'source', 'source_record_id',
        'prehospital', 'consultation_token', 'consultation_doctor_id',
        'consultation_request_id', 'admitted_at', 'is_draft',
    ];

    protected $casts = [
        'gender' => 'integer',
        'age' => 'integer',
        'assigned_to' => 'array',
        'symptoms' => 'array',
        'prehospital' => 'array',
        'is_draft' => 'boolean',
        'admitted_at' => 'datetime',
        'is_deleted' => 'boolean',
    ];

    /**
     * 自动生成患者编号
     */
    protected static function booted(): void
    {
        parent::booted();

        static::creating(function (self $model) {
            if (empty($model->patient_id)) {
                $model->patient_id = self::generatePatientId();
            }
        });
    }

    /**
     * 生成唯一患者编号：PAT-YYYYMMDD-NNN
     */
    public static function generatePatientId(): string
    {
        $prefix = 'PAT-'.now()->format('Ymd').'-';
        $seq = (int) self::withTrashed()->where('patient_id', 'like', $prefix.'%')->count();

        do {
            $seq++;
            $code = $prefix.str_pad((string) $seq, 3, '0', STR_PAD_LEFT);
        } while (self::withTrashed()->where('patient_id', $code)->exists());

        return $code;
    }

    public function emergencyEvents(): HasMany
    {
        return $this->hasMany(EmergencyEvent::class, 'patient_id');
    }

    public function transfers(): HasMany
    {
        return $this->hasMany(Transfer::class, 'patient_id', 'patient_id');
    }
}
