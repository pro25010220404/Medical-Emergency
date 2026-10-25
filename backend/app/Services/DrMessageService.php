<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DrMessageService extends JsonResource
{
    /** kind 整数 → 字符串码；§4.4 */
    private const KIND_CODES = [0 => 'TEXT', 1 => 'VOICE', 2 => 'IMAGE', 3 => 'FILE'];

    private const KIND_LABELS = [0 => '文字', 1 => '语音', 2 => '图片', 3 => '文件'];

    public function toArray(Request $request): array
    {
        $kind = (int) $this->kind;

        return [
            'messageId' => $this->message_id,
            'threadId' => $this->thread_id,
            'institutionId' => $this->institution_id,
            'institutionName' => $this->institution_name,
            'senderId' => $this->sender_id,
            'senderName' => $this->sender_name,
            'kind' => self::KIND_CODES[$kind] ?? 'UNKNOWN',
            'kindLabel' => self::KIND_LABELS[$kind] ?? '未知',
            'content' => $this->content,
            'mediaUrl' => $this->media_url,
            'durationSec' => (int) $this->duration_sec,
            'isRead' => (bool) $this->is_read,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
