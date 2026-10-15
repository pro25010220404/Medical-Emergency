<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bed extends Model
{
    protected $fillable = [
        'bed_id', 'label', 'institution_id', 'department_id', 'status',
        'patient_id', 'reserve_reason', 'reserved_until', 'enabled',
    ];

    protected $casts = [
        'status' => 'integer',
        'reserved_until' => 'datetime',
        'enabled' => 'boolean',
    ];
}
