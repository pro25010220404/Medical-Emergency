<?php

namespace App\Exceptions;

use App\Enums\ResponseCode;
use App\Support\Result;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * API 请求统一渲染为 {code,message,data}；非 API 请求保持框架默认行为
     */
    public function render($request, Throwable $e)
    {
        if ($request instanceof Request && ($request->is('api/*') || $request->expectsJson())) {
            return $this->renderApi($request, $e);
        }

        return parent::render($request, $e);
    }

    protected function renderApi(Request $request, Throwable $e): JsonResponse
    {
        if ($e instanceof BusinessException) {
            $code = $e->responseCode();

            return response()->json(Result::error($code, $e->getMessage(), $e->data()), $code->value);
        }

        if ($e instanceof ValidationException) {
            return response()->json(
                Result::error(ResponseCode::BAD_REQUEST, $e->getMessage(), ['errors' => $e->errors()]),
                ResponseCode::BAD_REQUEST->value
            );
        }

        if ($e instanceof AuthenticationException) {
            return response()->json(
                Result::error(ResponseCode::UNAUTHORIZED),
                ResponseCode::UNAUTHORIZED->value
            );
        }

        if ($e instanceof ModelNotFoundException || $e instanceof NotFoundHttpException) {
            $path = $request->getPathInfo();
            $method = $request->getMethod();
            $message = "接口不存在 {$method} {$path}";

            return response()->json(
                Result::error(ResponseCode::NOT_FOUND, $message),
                ResponseCode::NOT_FOUND->value
            );
        }

        if ($e instanceof HttpExceptionInterface) {
            $status = $e->getStatusCode();
            $code = ResponseCode::tryFrom($status) ?? ResponseCode::SERVER_ERROR;
            $message = $e->getMessage() !== '' ? $e->getMessage() : $code->message();

            return response()->json(Result::error($code, $message), $status);
        }

        return response()->json(
            Result::error(
                ResponseCode::SERVER_ERROR,
                config('app.debug') ? $e->getMessage() : null
            ),
            ResponseCode::SERVER_ERROR->value
        );
    }
}
