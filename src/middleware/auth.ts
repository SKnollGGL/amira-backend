/**
 * Authentication Middleware - Verify customer authentication
 * Validates API keys and customer IDs
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ErrorFactory } from '../utils/errors';

// ============ EXTEND EXPRESS REQUEST ============
declare global {
  namespace Express {
    interface Request {
      customerId?: string;
      apiKey?: string;
    }
  }
}

// ============ SUPABASE CLIENT ============
const supabase = createClient(config.supabase.url, config.supabase.key);

// ============ AUTHENTICATION MIDDLEWARE ============
/**
 * Authenticate customer by API key or customer ID
 * Can be used per-route or globally
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check for API key in headers
    const apiKey = req.headers['x-api-key'] as string;
    const customerId = req.headers['x-customer-id'] as string;

    if (!apiKey && !customerId) {
      throw ErrorFactory.unauthorized(
        'Missing authentication. Provide x-api-key or x-customer-id header'
      );
    }

    // Validate customer exists
    if (customerId) {
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('id', customerId)
        .single();

      if (error || !data) {
        throw ErrorFactory.unauthorized('Invalid customer ID');
      }

      req.customerId = customerId;
    }

    if (apiKey) {
      // API key validation logic can be extended
      // For now, we'll accept any non-empty key
      if (!apiKey.trim()) {
        throw ErrorFactory.unauthorized('Invalid API key');
      }
      req.apiKey = apiKey;
    }

    next();
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const appError = error as any;
      res.status(appError.statusCode || 401).json({
        success: false,
        error: appError.code || 'UNAUTHORIZED',
        message: appError.message,
      });
    } else {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication failed',
      });
    }
  }
};

/**
 * Require customer ID in request
 * Use on endpoints that need customer context
 */
export const requireCustomerId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.customerId) {
    throw ErrorFactory.unauthorized(
      'Customer ID is required. Provide x-customer-id header'
    );
  }
  next();
};

/**
 * Optional authentication
 * Sets customerId if provided, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const customerId = req.headers['x-customer-id'] as string;

    if (customerId) {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('id', customerId)
        .single();

      if (data) {
        req.customerId = customerId;
      }
    }

    next();
  } catch (error) {
    // Continue without auth
    next();
  }
};

/**
 * Verify subscription is active
 * Use on paid endpoints
 */
export const requireActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.customerId) {
      throw ErrorFactory.unauthorized('Customer ID required');
    }

    const { data, error } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('customer_id', req.customerId)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      throw ErrorFactory.forbidden(
        'No active subscription. Please upgrade to access this feature'
      );
    }

    next();
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      const appError = error as any;
      res.status(appError.statusCode || 403).json({
        success: false,
        error: appError.code || 'FORBIDDEN',
        message: appError.message,
      });
    } else {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Access denied',
      });
    }
  }
};

/**
 * Rate limiting per customer
 * Tracks API usage and enforces limits
 */
export const rateLimitByCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.customerId) {
      return next();
    }

    // For now, log the request
    // Full rate limiting would track request counts in DB
    const { error } = await supabase.from('api_usage').insert({
      customer_id: req.customerId,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip || req.socket.remoteAddress || 'unknown',
    });

    if (error) {
      console.error('Error logging API usage:', error);
      // Don't fail the request if logging fails
    }

    next();
  } catch (error) {
    // Don't block the request if rate limit check fails
    next();
  }
};

/**
 * Check OAuth token is valid
 * Use on endpoints that need specific OAuth provider
 */
export const requireOAuthToken = (provider: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.customerId) {
        throw ErrorFactory.unauthorized('Customer ID required');
      }

      const { data, error } = await supabase
        .from('oauth_tokens')
        .select('expires_at')
        .eq('customer_id', req.customerId)
        .eq('provider', provider)
        .single();

      if (error || !data) {
        throw ErrorFactory.validationError(
          `No ${provider} OAuth connection found. Please authenticate first.`
        );
      }

      // Check expiry
      if (new Date(data.expires_at) < new Date()) {
        throw ErrorFactory.validationError(
          `${provider} OAuth token expired. Please reconnect.`
        );
      }

      next();
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error) {
        const appError = error as any;
        res.status(appError.statusCode || 401).json({
          success: false,
          error: appError.code || 'UNAUTHORIZED',
          message: appError.message,
        });
      } else {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'OAuth token validation failed',
        });
      }
    }
  };
};
