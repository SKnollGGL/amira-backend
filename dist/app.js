"use strict";
/**
 * ARIS Platform SaaS - Main Application
 * Express.js setup with middleware, routes, and error handling
 *
 * SECURITY-FIRST ARCHITECTURE:
 * 1. Security headers (Helmet)
 * 2. CORS validation
 * 3. Body parsing
 * 4. Request logging
 * 5. Rate limiting (ENFORCED)
 * 6. JWT Authentication (BEFORE ROUTES)
 * 7. Customer ownership validation
 * 8. Routes (protected)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
const errors_1 = require("./utils/errors");
const oauth_1 = __importDefault(require("./routes/oauth"));
const payment_1 = __importDefault(require("./routes/payment"));
// ============ VALIDATE CONFIG ============
try {
    (0, config_1.validateConfig)();
}
catch (error) {
    console.error('Configuration validation failed:', error);
    process.exit(1);
}
// ============ CREATE EXPRESS APP ============
const app = (0, express_1.default)();
// ============ SECURITY MIDDLEWARE #1: HELMET ============
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
        },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
}));
// ============ SECURITY MIDDLEWARE #2: CORS ============
app.use((0, cors_1.default)({
    origin: config_1.config.cors.origins,
    credentials: config_1.config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Customer-ID'],
    maxAge: 86400, // 24 hours
}));
// ============ BODY PARSER MIDDLEWARE ============
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
// ============ STATIC FILE SERVING ============
app.use(express_1.default.static('public'));
// ============ REQUEST LOGGING MIDDLEWARE ============
app.use((0, morgan_1.default)((tokens, req, res) => {
    return JSON.stringify({
        timestamp: new Date().toISOString(),
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: tokens.status(req, res),
        responseTime: `${tokens['response-time'](req, res)}ms`,
        contentLength: tokens.res(req, res, 'content-length'),
        customerId: req.customerId || 'anonymous',
    });
}));
// ============ SECURITY MIDDLEWARE #3: RATE LIMITING (ENFORCED) ============
const globalRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: config_1.config.rateLimit.maxRequests,
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => config_1.isDevelopment && !req.path.startsWith('/api'),
    keyGenerator: (req) => {
        // Rate limit by IP + Customer ID (if authenticated)
        const customerId = req.customerId;
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        return customerId ? `${customerId}:${ip}` : ip;
    },
    handler: (req, res) => {
        throw errors_1.ErrorFactory.rateLimited();
    },
});
app.use('/api/', globalRateLimiter);
// ============ SECURITY MIDDLEWARE #4: JWT AUTHENTICATION ============
/**
 * CRITICAL: This middleware runs BEFORE all routes
 * Validates JWT token and sets req.customerId
 */
const jwtAuth = async (req, res, next) => {
    try {
        // Extract token from Authorization header or x-api-key
        let token = null;
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'];
        const customerId = req.headers['x-customer-id'];
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.slice(7);
        }
        else if (apiKey) {
            token = apiKey;
        }
        // Public endpoints (no auth required)
        const publicPaths = [
            '/health',
            '/api/version',
            '/signup.html',
            '/payment.html',
            '/success.html',
            '/api/payment/config',
            '/api/payment/create-customer',
            '/api/payment/create-payment-intent'
        ];
        // Allow static files and public API endpoints
        if (publicPaths.includes(req.path) || req.path.match(/\.(html|css|js|png|jpg|jpeg|gif|ico|svg)$/i)) {
            return next();
        }
        // All other endpoints require authentication
        if (!token && !customerId) {
            throw errors_1.ErrorFactory.unauthorized('Authentication required. Provide Authorization header or x-customer-id header');
        }
        // Validate JWT token if provided
        if (token) {
            try {
                const decoded = jsonwebtoken_1.default.verify(token, config_1.config.supabase.jwtSecret);
                if (!decoded.sub) {
                    throw errors_1.ErrorFactory.unauthorized('Invalid token format');
                }
                req.customerId = decoded.sub;
                req.userId = decoded.sub;
                console.log(`✅ Authenticated customer: ${decoded.sub}`);
            }
            catch (jwtError) {
                throw errors_1.ErrorFactory.unauthorized('Invalid or expired token');
            }
        }
        else if (customerId) {
            // Basic validation of customer ID format
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
                throw errors_1.ErrorFactory.validationError('Invalid customer ID format');
            }
            req.customerId = customerId;
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
                message: 'Authentication failed',
            });
        }
    }
};
// ============ APPLY JWT AUTH TO ALL ROUTES ============
app.use(jwtAuth);
// ============ SECURITY MIDDLEWARE #5: CUSTOMER OWNERSHIP VALIDATION ============
/**
 * Validates that customer can only access their own data
 * Runs after auth on all /api routes
 */
const customerOwnershipCheck = (req, res, next) => {
    // Only check on /api routes (not /health)
    if (!req.path.startsWith('/api/')) {
        return next();
    }
    const customerId = req.customerId;
    // Check if path contains customer/subscription/automation ID
    const pathMatch = req.path.match(/\/([\w-]+\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (pathMatch) {
        const requestedId = pathMatch[2];
        // Validate ownership
        if (customerId !== requestedId) {
            const error = errors_1.ErrorFactory.forbidden('Cannot access other customers\' data');
            res.status(403).json({
                success: false,
                error: error.code,
                message: error.message,
            });
            return;
        }
    }
    next();
};
app.use(customerOwnershipCheck);
// ============ HEALTH CHECK ENDPOINT (NO AUTH) ============
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config_1.config.server.env,
    });
});
// ============ VERSION ENDPOINT (NO AUTH) ============
app.get('/api/version', (req, res) => {
    res.json({
        success: true,
        data: {
            version: '1.0.0',
            environment: config_1.config.server.env,
            timestamp: new Date().toISOString(),
        },
    });
});
// ============ PROTECTED ROUTES (Auth required via middleware above) ============
app.use('/api/oauth', oauth_1.default);
app.use('/api/payment', payment_1.default);
// ============ PLACEHOLDER ROUTES (Days 5-10) ============
app.post('/api/call/setup-recording', (0, errors_1.asyncHandler)(async (req, res) => {
    throw errors_1.ErrorFactory.notFound('Recording endpoint not yet implemented');
}));
app.get('/api/automation/:id/results', (0, errors_1.asyncHandler)(async (req, res) => {
    throw errors_1.ErrorFactory.notFound('Results endpoint not yet implemented');
}));
app.get('/api/customer/:id/automations', (0, errors_1.asyncHandler)(async (req, res) => {
    throw errors_1.ErrorFactory.notFound('Automations endpoint not yet implemented');
}));
// ============ 404 HANDLER ============
app.use((req, res) => {
    const error = errors_1.ErrorFactory.notFound(`Route ${req.method} ${req.path}`);
    res.status(404).json({
        success: false,
        error: error.code,
        message: error.message,
    });
});
// ============ GLOBAL ERROR HANDLER (LAST) ============
app.use(errors_1.errorHandler);
// ============ PROCESS ERROR HANDLERS ============
process.on('unhandledRejection', (reason) => {
    errors_1.ErrorLogger.log(new Error(`Unhandled Rejection: ${JSON.stringify(reason)}`), {
        endpoint: 'process',
        method: 'unhandledRejection',
    });
});
process.on('uncaughtException', (error) => {
    errors_1.ErrorLogger.log(error, {
        endpoint: 'process',
        method: 'uncaughtException',
    });
    process.exit(1);
});
// ============ EXPORT APP ============
exports.default = app;
//# sourceMappingURL=app.js.map