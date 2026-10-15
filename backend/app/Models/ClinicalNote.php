<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * 患者临床记录（clinical_notes）
 */
class ClinicalNote extends Model
{
    protected $table = 'clinical_notes';

    public $timestamps = false;

    protected $casts = [
        'at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class, 'patient_id', 'patient_id');
    }
}
