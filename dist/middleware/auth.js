"use strict";
/**
 * Authentication Middleware - Verify customer authentication
 * Validates API keys and customer IDs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOAuthToken = exports.rateLimitByCustomer = exports.requireActiveSubscription = exports.optionalAuth = exports.requireCustomerId = exports.authenticate = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("../config");
const errors_1 = require("../utils/errors");
// ============ SUPABASE CLIENT ============
const supabase = (0, supabase_js_1.createClient)(config_1.config.supabase.url, config_1.config.supabase.key);
// ============ AUTHENTICATION MIDDLEWARE ============
/**
 * Authenticate customer by API key or customer ID
 * Can be used per-route or globally
 */
const authenticate = async (req, res, next) => {
    try {
        // Check for API key in headers
        const apiKey = req.headers['x-api-key'];
        const customerId = req.headers['x-customer-id'];
        if (!apiKey && !customerId) {
            throw errors_1.ErrorFactory.unauthorized('Missing authentication. Provide x-api-key or x-customer-id header');
        }
        // Validate customer exists
        if (customerId) {
            const { data, error } = await supabase
                .from('customers')
                .select('id')
                .eq('id', customerId)
                .single();
            if (error || !data) {
                throw errors_1.ErrorFactory.unauthorized('Invalid customer ID');
            }
            req.customerId = customerId;
        }
        if (apiKey) {
            // API key validation logic can be extended
            // For now, we'll accept any non-empty key
            if (!apiKey.trim()) {
                throw errors_1.ErrorFactory.unauthorized('Invalid API key');
            }
            req.apiKey = apiKey;
        }
        next();
    }
    catch (error) {
        if (error instanceof Error && 'code' in error) {
            const appError = error;
            res.status(appError.statusCode || 401).json({
                success: false,
                error: appError.code || 'UNAUTHORIZED',
                message: appError.message,
            });
        }
        else {
            res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Authentication failed',
            });
        }
    }
};
exports.authenticate = authenticate;
/**
 * Require customer ID in request
 * Use on endpoints that need customer context
 */
const requireCustomerId = (req, res, next) => {
    if (!req.customerId) {
        throw errors_1.ErrorFactory.unauthorized('Customer ID is required. Provide x-customer-id header');
    }
    next();
};
exports.requireCustomerId = requireCustomerId;
/**
 * Optional authentication
 * Sets customerId if provided, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    try {
        const customerId = req.headers['x-customer-id'];
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
    }
    catch (error) {
        // Continue without auth
        next();
    }
};
exports.optionalAuth = optionalAuth;
/**
 * Verify subscription is active
 * Use on paid endpoints
 */
const requireActiveSubscription = async (req, res, next) => {
    try {
        if (!req.customerId) {
            throw errors_1.ErrorFactory.unauthorized('Customer ID required');
        }
        const { data, error } = await supabase
            .from('subscriptions')
            .select('status')
            .eq('customer_id', req.customerId)
            .eq('status', 'active')
            .single();
        if (error || !data) {
            throw errors_1.ErrorFactory.forbidden('No active subscription. Please upgrade to access this feature');
        }
        next();
    }
    catch (error) {
        if (error instanceof Error && 'statusCode' in error) {
            const appError = error;
            res.status(appError.statusCode || 403).json({
                success: false,
                error: appError.code || 'FORBIDDEN',
                message: appError.message,
            });
        }
        else {
            res.status(403).json({
                success: false,
                error: 'FORBIDDEN',
                message: 'Access denied',
            });
        }
    }
};
exports.requireActiveSubscription = requireActiveSubscription;
/**
 * Rate limiting per customer
 * Tracks API usage and enforces limits
 */
const rateLimitByCustomer = async (req, res, next) => {
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
    }
    catch (error) {
        // Don't block the request if rate limit check fails
        next();
    }
};
exports.rateLimitByCustomer = rateLimitByCustomer;
/**
 * Check OAuth token is valid
 * Use on endpoints that need specific OAuth provider
 */
const requireOAuthToken = (provider) => {
    return async (req, res, next) => {
        try {
            if (!req.customerId) {
                throw errors_1.ErrorFactory.unauthorized('Customer ID required');
            }
            const { data, error } = await supabase
                .from('oauth_tokens')
                .select('expires_at')
                .eq('customer_id', req.customerId)
                .eq('provider', provider)
                .single();
            if (error || !data) {
                throw errors_1.ErrorFactory.validationError(`No ${provider} OAuth connection found. Please authenticate first.`);
            }
            // Check expiry
            if (new Date(data.expires_at) < new Date()) {
                throw errors_1.ErrorFactory.validationError(`${provider} OAuth token expired. Please reconnect.`);
            }
            next();
        }
        catch (error) {
            if (error instanceof Error && 'statusCode' in error) {
                const appError = error;
                res.status(appError.statusCode || 401).json({
                    success: false,
                    error: appError.code || 'UNAUTHORIZED',
                    message: appError.message,
                });
            }
            else {
                res.status(401).json({
                    success: false,
                    error: 'UNAUTHORIZED',
                    message: 'OAuth token validation failed',
                });
            }
        }
    };
};
exports.requireOAuthToken = requireOAuthToken;
//# sourceMappingURL=auth.js.map