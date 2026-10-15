<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * 为每个请求生成唯一TraceId，用于全链路日志追踪
 */
class TraceIdMiddleware
{
    public function handle($request, Closure $next)
    {
        $traceId = (string) Str::uuid();

        // 存入当前Request对象，供 Result / 异常处理 / 业务日志取用
        $request->attributes->set('trace_id', $traceId);

        // 写入日志上下文，后续所有日志自动携带 trace_id
        Log::withContext([
            'trace_id' => $traceId,
        ]);

        return $next($request);
    }
}
