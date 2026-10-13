"use strict";
/**
 * Comprehensive Error Handling Framework
 * Provides typed errors, error logging, and error recovery
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validators = exports.asyncHandler = exports.errorHandler = exports.ErrorLogger = exports.ErrorFactory = exports.ErrorCode = void 0;
const types_1 = require("../types");
// ============ ERROR CODES ============
var ErrorCode;
(function (ErrorCode) {
    // Client errors (4xx)
    ErrorCode["INVALID_REQUEST"] = "INVALID_REQUEST";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["CONFLICT"] = "CONFLICT";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    // Server errors (5xx)
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["STRIPE_ERROR"] = "STRIPE_ERROR";
    ErrorCode["N8N_ERROR"] = "N8N_ERROR";
    ErrorCode["TWILIO_ERROR"] = "TWILIO_ERROR";
    ErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
    // Auth errors
    ErrorCode["INVALID_TOKEN"] = "INVALID_TOKEN";
    ErrorCode["EXPIRED_TOKEN"] = "EXPIRED_TOKEN";
    ErrorCode["MISSING_CREDENTIALS"] = "MISSING_CREDENTIALS";
    ErrorCode["OAUTH_FAILED"] = "OAUTH_FAILED";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
// ============ ERROR FACTORY ============
class ErrorFactory {
    static badRequest(message, details) {
        return new types_1.AppError(ErrorCode.INVALID_REQUEST, message, 400, details);
    }
    static unauthorized(message = 'Unauthorized') {
        return new types_1.AppError(ErrorCode.UNAUTHORIZED, message, 401);
    }
    static forbidden(message = 'Forbidden') {
        return new types_1.AppError(ErrorCode.FORBIDDEN, message, 403);
    }
    static notFound(resource) {
        return new types_1.AppError(ErrorCode.NOT_FOUND, `${resource} not found`, 404);
    }
    static conflict(message) {
        return new types_1.AppError(ErrorCode.CONFLICT, message, 409);
    }
    static validationError(message, details) {
        return new types_1.AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
    }
    static rateLimited(message = 'Too many requests') {
        return new types_1.AppError(ErrorCode.RATE_LIMITED, message, 429);
    }
    static internalError(message = 'Internal server error', originalError) {
        console.error('Internal error:', originalError);
        return new types_1.AppError(ErrorCode.INTERNAL_ERROR, message, 500, {
            originalMessage: originalError?.message,
        });
    }
    static databaseError(originalError) {
        console.error('Database error:', originalError);
        return new types_1.AppError(ErrorCode.DATABASE_ERROR, 'Database operation failed', 500, { originalMessage: originalError?.message });
    }
    static stripeError(message, originalError) {
        console.error('Stripe error:', originalError);
        return new types_1.AppError(ErrorCode.STRIPE_ERROR, message, 500, {
            originalMessage: originalError?.message,
        });
    }
    static n8nError(message, originalError) {
        console.error('n8n error:', originalError);
        return new types_1.AppError(ErrorCode.N8N_ERROR, message, 500, {
            originalMessage: originalError?.message,
        });
    }
    static twilioError(message, originalError) {
        console.error('Twilio error:', originalError);
        return new types_1.AppError(ErrorCode.TWILIO_ERROR, message, 500, {
            originalMessage: originalError?.message,
        });
    }
    static serviceUnavailable(service) {
        return new types_1.AppError(ErrorCode.SERVICE_UNAVAILABLE, `${service} service is currently unavailable`, 503);
    }
    static oauthFailed(message, originalError) {
        console.error('OAuth failed:', originalError);
        return new types_1.AppError(ErrorCode.OAUTH_FAILED, message, 400, {
            originalMessage: originalError?.message,
        });
    }
}
exports.ErrorFactory = ErrorFactory;
// ============ ERROR LOGGER ============
class ErrorLogger {
    static log(error, context = {}) {
        const timestamp = new Date().toISOString();
        const errorEntry = {
            timestamp,
            name: error.name,
            message: error.message,
            code: error.code || 'UNKNOWN',
            statusCode: error.statusCode || 500,
            context,
            stack: error.stack,
        };
        console.error('[ERROR]', JSON.stringify(errorEntry, null, 2));
    }
    static logWarning(message, context) {
        console.warn('[WARNING]', { timestamp: new Date().toISOString(), message, context });
    }
    static logInfo(message, context) {
        console.log('[INFO]', { timestamp: new Date().toISOString(), message, context });
    }
}
exports.ErrorLogger = ErrorLogger;
// ============ GLOBAL ERROR HANDLER MIDDLEWARE ============
const errorHandler = (err, req, res, next) => {
    // Ensure it's an AppError
    let appError;
    if (err instanceof types_1.AppError) {
        appError = err;
    }
    else if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
        // JSON parse error
        appError = new types_1.AppError(ErrorCode.INVALID_REQUEST, 'Invalid JSON in request body', 400);
    }
    else {
        appError = new types_1.AppError(ErrorCode.INTERNAL_ERROR, err.message || 'Unknown error occurred', 500, { originalMessage: err.message });
    }
    // Log error
    ErrorLogger.log(appError, {
        endpoint: req.path,
        method: req.method,
        userId: req.userId,
        timestamp: new Date().toISOString(),
    });
    // Set error status code
    const statusCode = appError.statusCode || 500;
    // Send response
    res.status(statusCode).json({
        success: false,
        error: appError.code,
        message: appError.message,
        ...(process.env.NODE_ENV === 'development' && {
            details: appError.details,
            stack: appError.stack,
        }),
    });
};
exports.errorHandler = errorHandler;
// ============ ASYNC ERROR WRAPPER ============
/**
 * Wraps async route handlers to catch errors automatically
 * @param fn - Async route handler
 * @returns Express route handler
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
exports.asyncHandler = asyncHandler;
// ============ VALIDATION UTILITIES ============
exports.Validators = {
    email: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    uuid: (uuid) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    },
    phone: (phone) => {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
    },
    isString: (value) => typeof value === 'string',
    isNumber: (value) => typeof value === 'number',
    isBoolean: (value) => typeof value === 'boolean',
    isArray: (value) => Array.isArray(value),
    isObject: (value) => value !== null && typeof value === 'object',
    notEmpty: (value) => {
        if (typeof value === 'string')
            return value.trim().length > 0;
        if (Array.isArray(value))
            return value.length > 0;
        return value !== null && value !== undefined;
    },
};
//# sourceMappingURL=errors.js.map