<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CriticalValue extends Model
{
    protected $fillable = [
        'critical_no', 'patient_id', 'patient_label', 'item_name', 'result_value',
        'unit', 'ref_range', 'critical_range', 'specimen', 'level', 'status',
        'institution_id', 'department_id', 'reported_at',
    ];

    protected $casts = [
        'reported_at' => 'datetime',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class, 'patient_id', 'patient_id');
    }
}
