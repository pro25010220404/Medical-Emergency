<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConsultMaterial extends Model
{
    /**
     * 表仅含 created_at（无 updated_at）
     */
    public const UPDATED_AT = null;

    protected $fillable = [
        'room_token', 'session_id', 'patient_id', 'kind', 'title', 'content',
        'source', 'author_id', 'author_name', 'shared_at',
    ];

    protected $casts = [
        'shared_at' => 'datetime',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(ConsultRoom::class, 'room_token', 'token');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(ConsultSession::class, 'session_id', 'session_id');
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class, 'patient_id', 'patient_id');
    }
}
