<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmergencyEvent extends BaseModel
{
    protected $fillable = [
        'event_code', 'event_source', 'occurred_at', 'accept_org_id', 'accepted_by_user_id',
        'eta', 'scene_address', 'scene_phone', 'symptom_duration', 'consciousness',
        'provisional_dx', 'triage_level', 'channel_type', 'target_dept_name', 'transport_mode',
        'scene_hr', 'scene_sbp', 'scene_dbp', 'scene_spo2', 'scene_rr', 'scene_temp',
        'patient_id', 'patient_mode', 'temp_gender', 'temp_summary', 'chief',
        'risk_level', 'event_stage', 'event_status',
        'close_reason', 'close_check_result', 'closed_at', 'closed_by_user_id',
        'task120_id', 'level', 'destination', 'vehicle_id', 'vehicle_plate', 'status',
        'started_at', 'eta_hospital_minutes', 'eta_patient_minutes', 'score_plan', 'treat_plan',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'eta' => 'datetime',
        'closed_at' => 'datetime',
        'started_at' => 'datetime',
        'close_check_result' => 'array',
        'level' => 'integer',
        'status' => 'integer',
        'is_deleted' => 'boolean',
    ];

    /**
     * 自动生成事件编号
     */
    protected static function booted(): void
    {
        parent::booted();

        static::creating(function (self $model) {
            if (empty($model->event_code)) {
                // 与 DispatchEventService::nextEventCode 保持一致：EVT-{Ymd}-{两位序号}
                $prefix = 'EVT-'.now()->format('Ymd').'-';
                $seq = static::withTrashed()->where('event_code', 'like', $prefix.'%')->count() + 1;

                do {
                    $code = $prefix.str_pad((string) $seq, 2, '0', STR_PAD_LEFT);
                    $seq++;
                } while (static::withTrashed()->where('event_code', $code)->exists());

                $model->event_code = $code;
            }
        });
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class, 'patient_id');
    }

    public function acceptOrg(): BelongsTo
    {
        return $this->belongsTo(Organization::class, 'accept_org_id');
    }

    public function timelines(): HasMany
    {
        return $this->hasMany(EventTimeline::class, 'event_id')->orderBy('occurred_at');
    }

    public function transfers(): HasMany
    {
        return $this->hasMany(Transfer::class, 'event_id');
    }
}
