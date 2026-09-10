package com.airbank.common.exception;

import com.airbank.common.api.Result;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 全局异常处理：业务错误一律 HTTP 200 + 错误码（docs/design/07 §2）。
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BizException.class)
    public Result<Void> biz(BizException e) {
        return Result.fail(e.getCode(), e.getMessage());
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    public Result<Void> invalid(BindException e) {
        FieldError fe = e.getBindingResult().getFieldError();
        String msg = fe == null ? "参数校验失败" : fe.getField() + " " + fe.getDefaultMessage();
        return Result.fail(ErrorCodes.PARAM_INVALID, msg);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public Result<Void> constraint(ConstraintViolationException e) {
        String msg = e.getConstraintViolations().stream().findFirst()
                .map(v -> v.getMessage()).orElse("参数校验失败");
        return Result.fail(ErrorCodes.PARAM_INVALID, msg);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class})
    public Result<Void> unreadable(HttpMessageNotReadableException e) {
        return Result.fail(ErrorCodes.JSON_INVALID, "请求体格式错误");
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    public Result<Void> missingParam(Exception e) {
        return Result.fail(ErrorCodes.PARAM_INVALID, "缺少或非法的请求参数");
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public Result<Void> notFound(NoResourceFoundException e) {
        return Result.fail(ErrorCodes.NOT_FOUND, "资源不存在");
    }

    @ExceptionHandler(Exception.class)
    public Result<Void> unknown(Exception e) {
        log.error("system error", e);
        return Result.fail(ErrorCodes.SYSTEM_ERROR, "系统繁忙，请稍后重试");
    }
}
