<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WarningTrend extends Model
{
    protected $fillable = [
        'trend_id', 'patient_label', 'patient_id', 'metric', 'current_value',
        'predicted_value', 'within_minutes', 'note',
    ];

    protected $casts = [
        'current_value' => 'decimal:2',
        'predicted_value' => 'decimal:2',
        'within_minutes' => 'integer',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class, 'patient_id', 'patient_id');
    }
}
