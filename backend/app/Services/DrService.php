<?php

namespace App\Services;

use App\Services\DrMessageService;
use App\Services\DrPostService;
use App\Models\DrMessage;
use App\Models\DrPost;

/**
 * 基层医声 Dr：基层反馈 / 问题上报 + 协作消息（04-会诊协同 §3.1~§3.4）
 */
class DrService extends Service
{
    /** 字符串码 ↔ 存储整数映射（§4） */
    private const CATEGORY_CODES = ['FEEDBACK' => 0, 'ISSUE' => 1];
    private const STATUS_CODES = ['PENDING' => 0, 'REPLIED' => 1, 'RESOLVED' => 2];
    private const STATUS_NAMES = [0 => 'PENDING', 1 => 'REPLIED', 2 => 'RESOLVED'];
    private const STATUS_LABELS = [0 => '待处理', 1 => '已回复', 2 => '已办结'];
    private const KIND_CODES = ['TEXT' => 0, 'VOICE' => 1, 'IMAGE' => 2, 'FILE' => 3];
    private const KIND_NAMES = [0 => 'TEXT', 1 => 'VOICE', 2 => 'IMAGE', 3 => 'FILE'];

    /**
     * §3.1 获取基层反馈列表
     */
    public function posts(array $filters): array
    {
        $pageNum = max((int) ($filters['pageNum'] ?? 1), 1);
        $pageSize = min(max((int) ($filters['pageSize'] ?? 20), 1), 100);

        $query = DrPost::query();

        $category = $this->code($filters['category'] ?? null, self::CATEGORY_CODES);
        if ($category !== null) {
            $query->where('category', $category);
        }

        $statusList = $this->codes($filters['status'] ?? null, self::STATUS_CODES);
        if ($statusList) {
            $query->whereIn('status', $statusList);
        }

        if (! empty($filters['institutionId'])) {
            $query->where('institution_id', $filters['institutionId']);
        }

        if (! empty($filters['keyword'])) {
            $keyword = $filters['keyword'];
            $query->where(fn ($sub) => $sub->where('title', 'like', "%{$keyword}%")
                ->orWhere('content', 'like', "%{$keyword}%"));
        }

        $paginator = $query->orderByDesc('created_at')->paginate($pageSize, ['*'], 'pageNum', $pageNum);

        return [
            'total' => $paginator->total(),
            'list' => DrPostService::collection($paginator->items())->resolve(),
        ];
    }

    /**
     * §3.2 问题上报
     */
    public function storePost(array $data): array
    {
        $post = DrPost::create([
            'category' => $data['category'],
            'title' => $data['title'],
            'content' => $data['content'],
            'institution_id' => $data['institutionId'],
            'institution_name' => $data['institutionName'] ?? '',
            'department' => $data['department'] ?? '',
            'reporter_id' => $data['reporterId'] ?? '',
            'reporter_name' => $data['reporterName'] ?? '',
            'contact' => $data['contact'] ?? '',
            'priority' => $data['priority'] ?? 0,
            'attachments' => $data['attachments'] ?? null,
            'status' => self::STATUS_CODES['PENDING'],
        ]);

        return [
            'postId' => $post->post_id,
            'status' => self::STATUS_NAMES[0],
            'statusLabel' => self::STATUS_LABELS[0],
            'createdAt' => $post->created_at?->toIso8601String(),
        ];
    }

    /**
     * §3.3 获取协作消息（倒序，beforeId 游标翻页）
     */
    public function messages(array $filters): array
    {
        $pageSize = min(max((int) ($filters['pageSize'] ?? 20), 1), 100);

        $query = DrMessage::query();

        if (! empty($filters['threadId'])) {
            $query->where('thread_id', $filters['threadId']);
        }

        if (! empty($filters['institutionId'])) {
            $query->where('institution_id', $filters['institutionId']);
        }

        $kind = $this->code($filters['kind'] ?? null, self::KIND_CODES);
        if ($kind !== null) {
            $query->where('kind', $kind);
        }

        // beforeId 游标：取该消息之前的消息
        if (! empty($filters['beforeId'])) {
            $anchor = DrMessage::query()->where('message_id', $filters['beforeId'])->first();
            if ($anchor) {
                $query->where('created_at', '<', $anchor->created_at);
            }
        }

        $paginator = $query->orderByDesc('created_at')->paginate($pageSize);

        return [
            'total' => $paginator->total(),
            'list' => DrMessageService::collection($paginator->items())->resolve(),
        ];
    }

    /**
     * §3.4 发送消息（首条缺省新建链路）
     *
     * dr_messages 无 receiver 列（§2.2），接收机构按链路语义落地：
     * 新建链路时以 receiverInstitutionId 构造 thread_id（如 thread-weiyuan-01）；
     * 已有 threadId 时接收方由协作链路隐含。
     */
    public function storeMessage(array $data): array
    {
        $threadId = $data['threadId'] ?? '';
        if ($threadId === '') {
            $threadId = $this->newThreadId($data['receiverInstitutionId'] ?? '');
        }

        $message = DrMessage::create([
            'thread_id' => $threadId,
            'institution_id' => $data['institutionId'] ?? '',
            'institution_name' => $data['institutionName'] ?? '',
            'sender_id' => $data['senderId'] ?? '',
            'sender_name' => $data['senderName'] ?? '',
            'kind' => $data['kind'],
            'content' => $data['content'] ?? '',
            'media_url' => $data['mediaUrl'] ?? '',
            'duration_sec' => $data['durationSec'] ?? 0,
            // 发送方自身消息视为已读
            'is_read' => 1,
        ]);

        return [
            'messageId' => $message->message_id,
            'threadId' => $message->thread_id,
            'kind' => self::KIND_NAMES[$message->kind] ?? 'TEXT',
            'createdAt' => $message->created_at?->toIso8601String(),
        ];
    }

    /**
     * 新建协作链路编号（携带接收机构，对齐文档 thread-wy-01 命名）
     */
    private function newThreadId(string $receiverInstitutionId): string
    {
        $base = $receiverInstitutionId !== '' ? $receiverInstitutionId : 'dr';
        return 'thread-'.$base.'-'.str_pad((string) random_int(1, 99), 2, '0', STR_PAD_LEFT);
    }

    /**
     * 单值字符串码 / 数字 → 存储整数，无法识别时返回 null
     */
    private function code(mixed $value, array $map): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_numeric($value)) {
            return (int) $value;
        }
        return $map[strtoupper((string) $value)] ?? null;
    }

    /**
     * 逗号分隔的字符串码列表 → 存储整数数组
     */
    private function codes(mixed $value, array $map): array
    {
        if ($value === null || $value === '') {
            return [];
        }
        $items = is_array($value) ? $value : explode(',', (string) $value);
        $codes = [];
        foreach ($items as $item) {
            $code = $this->code(trim((string) $item), $map);
            if ($code !== null) {
                $codes[] = $code;
            }
        }
        return array_values(array_unique($codes));
    }
}
