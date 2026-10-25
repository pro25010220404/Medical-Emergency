<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DrPostService extends JsonResource
{
    /** category 整数 → 字符串码；§4.1 */
    private const CATEGORY_CODES = [0 => 'FEEDBACK', 1 => 'ISSUE'];

    private const CATEGORY_LABELS = [0 => '基层反馈', 1 => '问题上报'];

    /** status 整数 → 字符串码；§4.3 */
    private const STATUS_CODES = [0 => 'PENDING', 1 => 'REPLIED', 2 => 'RESOLVED'];

    private const STATUS_LABELS = [0 => '待处理', 1 => '已回复', 2 => '已办结'];

    /** priority 整数 → 显示文本；§4.2 */
    private const PRIORITY_LABELS = [0 => '普通', 1 => '紧急'];

    public function toArray(Request $request): array
    {
        $category = (int) $this->category;
        $status = (int) $this->status;
        $priority = (int) $this->priority;

        return [
            'postId' => $this->post_id,
            'category' => self::CATEGORY_CODES[$category] ?? 'UNKNOWN',
            'categoryLabel' => self::CATEGORY_LABELS[$category] ?? '未知',
            'title' => $this->title,
            'content' => $this->content,
            'institutionId' => $this->institution_id,
            'institutionName' => $this->institution_name,
            'department' => $this->department,
            'reporterId' => $this->reporter_id,
            'reporterName' => $this->reporter_name,
            'contact' => $this->contact,
            'priority' => $priority,
            'priorityLabel' => self::PRIORITY_LABELS[$priority] ?? '普通',
            'status' => self::STATUS_CODES[$status] ?? 'UNKNOWN',
            'statusLabel' => self::STATUS_LABELS[$status] ?? '未知',
            'reply' => $this->reply,
            'repliedAt' => $this->replied_at?->toIso8601String(),
            'attachments' => $this->attachments,
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
