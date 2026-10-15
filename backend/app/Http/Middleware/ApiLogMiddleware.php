<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Log;

/**
 * API请求日志：记录所有 HTTP API 请求到 api 通道
 *
 * 记录请求参数、响应状态码、接口耗时，用于性能分析与接口监控。
 * 不记录敏感信息（password / token / 身份证等）。
 */
class ApiLogMiddleware
{
    /**
     * 不记录到日志的敏感字段
     */
    protected array $sensitiveFields = [
        'password',
        'password_confirmation',
        'old_password',
        'new_password',
        'token',
        'authorization',
        'id_card',
        'id_number',
    ];

    public function handle($request, Closure $next)
    {
        $start = microtime(true);

        $response = $next($request);

        $durationMs = round((microtime(true) - $start) * 1000, 2);

        Log::channel('api')->info('API请求记录', [
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'ip' => $request->ip(),
            'user_id' => auth()->id(),
            'request' => $this->filterSensitive($request->all()),
            'response_status' => $response->status(),
            'duration_ms' => $durationMs,
        ]);

        return $response;
    }

    /**
     * 过滤敏感字段，避免明文落盘
     */
    protected function filterSensitive(array $data): array
    {
        foreach (array_keys($data) as $key) {
            if (in_array(strtolower((string) $key), $this->sensitiveFields, true)) {
                $data[$key] = '***';
            }
        }

        return $data;
    }
}
