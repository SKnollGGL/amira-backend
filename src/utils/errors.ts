/**
 * Comprehensive Error Handling Framework
 * Provides typed errors, error logging, and error recovery
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';

// ============ ERROR CODES ============
export enum ErrorCode {
  // Client errors (4xx)
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  STRIPE_ERROR = 'STRIPE_ERROR',
  N8N_ERROR = 'N8N_ERROR',
  TWILIO_ERROR = 'TWILIO_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // Auth errors
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',
  OAUTH_FAILED = 'OAUTH_FAILED',
}

// ============ ERROR FACTORY ============
export class ErrorFactory {
  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.INVALID_REQUEST, message, 400, details);
  }

  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message, 401);
  }

  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403);
  }

  static notFound(resource: string): AppError {
    return new AppError(ErrorCode.NOT_FOUND, `${resource} not found`, 404);
  }

  static conflict(message: string): AppError {
    return new AppError(ErrorCode.CONFLICT, message, 409);
  }

  static validationError(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, 400, details);
  }

  static rateLimited(message: string = 'Too many requests'): AppError {
    return new AppError(ErrorCode.RATE_LIMITED, message, 429);
  }

  static internalError(message: string = 'Internal server error', originalError?: Error): AppError {
    console.error('Internal error:', originalError);
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500, {
      originalMessage: originalError?.message,
    });
  }

  static databaseError(originalError?: Error): AppError {
    console.error('Database error:', originalError);
    return new AppError(
      ErrorCode.DATABASE_ERROR,
      'Database operation failed',
      500,
      { originalMessage: originalError?.message }
    );
  }

  static stripeError(message: string, originalError?: Error): AppError {
    console.error('Stripe error:', originalError);
    return new AppError(ErrorCode.STRIPE_ERROR, message, 500, {
      originalMessage: originalError?.message,
    });
  }

  static n8nError(message: string, originalError?: Error): AppError {
    console.error('n8n error:', originalError);
    return new AppError(ErrorCode.N8N_ERROR, message, 500, {
      originalMessage: originalError?.message,
    });
  }

  static twilioError(message: string, originalError?: Error): AppError {
    console.error('Twilio error:', originalError);
    return new AppError(ErrorCode.TWILIO_ERROR, message, 500, {
      originalMessage: originalError?.message,
    });
  }

  static serviceUnavailable(service: string): AppError {
    return new AppError(
      ErrorCode.SERVICE_UNAVAILABLE,
      `${service} service is currently unavailable`,
      503
    );
  }

  static oauthFailed(message: string, originalError?: Error): AppError {
    console.error('OAuth failed:', originalError);
    return new AppError(ErrorCode.OAUTH_FAILED, message, 400, {
      originalMessage: originalError?.message,
    });
  }
}

// ============ ERROR LOGGER ============
export class ErrorLogger {
  static log(
    error: Error | AppError,
    context: {
      endpoint?: string;
      method?: string;
      userId?: string;
      timestamp?: string;
      body?: unknown;
    } = {}
  ): void {
    const timestamp = new Date().toISOString();
    const errorEntry = {
      timestamp,
      name: error.name,
      message: error.message,
      code: (error as AppError).code || 'UNKNOWN',
      statusCode: (error as AppError).statusCode || 500,
      context,
      stack: error.stack,
    };

    console.error('[ERROR]', JSON.stringify(errorEntry, null, 2));
  }

  static logWarning(message: string, context?: Record<string, unknown>): void {
    console.warn('[WARNING]', { timestamp: new Date().toISOString(), message, context });
  }

  static logInfo(message: string, context?: Record<string, unknown>): void {
    console.log('[INFO]', { timestamp: new Date().toISOString(), message, context });
  }
}

// ============ GLOBAL ERROR HANDLER MIDDLEWARE ============
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Ensure it's an AppError
  let appError: AppError;

  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    // JSON parse error
    appError = new AppError(
      ErrorCode.INVALID_REQUEST,
      'Invalid JSON in request body',
      400
    );
  } else {
    appError = new AppError(
      ErrorCode.INTERNAL_ERROR,
      err.message || 'Unknown error occurred',
      500,
      { originalMessage: err.message }
    );
  }

  // Log error
  ErrorLogger.log(appError, {
    endpoint: req.path,
    method: req.method,
    userId: (req as any).userId,
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

// ============ ASYNC ERROR WRAPPER ============
/**
 * Wraps async route handlers to catch errors automatically
 * @param fn - Async route handler
 * @returns Express route handler
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ============ VALIDATION UTILITIES ============
export const Validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  uuid: (uuid: string): boolean => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  phone: (phone: string): boolean => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
  },

  isString: (value: unknown): boolean => typeof value === 'string',
  isNumber: (value: unknown): boolean => typeof value === 'number',
  isBoolean: (value: unknown): boolean => typeof value === 'boolean',
  isArray: (value: unknown): boolean => Array.isArray(value),
  isObject: (value: unknown): boolean => value !== null && typeof value === 'object',

  notEmpty: (value: unknown): boolean => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined;
  },
};
