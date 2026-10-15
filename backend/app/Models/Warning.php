<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Warning extends Model
{
    protected $fillable = [
        'warning_no', 'patient_id', 'patient_label', 'category', 'title', 'metric',
        'current_value', 'threshold', 'level', 'status',
        'institution_id', 'department_id', 'occurred_at',
    ];

    protected $casts = [
        'current_value' => 'decimal:2',
        'occurred_at' => 'datetime',
    ];

    public function disposeRecords(): HasMany
    {
        return $this->hasMany(WarningDisposeRecord::class, 'warning_id', 'id');
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class, 'patient_id', 'patient_id');
    }
}
