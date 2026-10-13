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

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { config, isDevelopment, validateConfig } from './config';
import { errorHandler, asyncHandler, ErrorLogger, ErrorFactory } from './utils/errors';
import oauthRoutes from './routes/oauth';
import paymentRoutes from './routes/payment';

// ============ EXTEND EXPRESS REQUEST WITH AUTH CONTEXT ============
declare global {
  namespace Express {
    interface Request {
      customerId?: string;
      apiKey?: string;
      userId?: string;
    }
  }
}

// ============ VALIDATE CONFIG ============
try {
  validateConfig();
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

// ============ CREATE EXPRESS APP ============
const app: Express = express();

// ============ SECURITY MIDDLEWARE #1: HELMET ============
app.use(helmet({
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
app.use(
  cors({
    origin: config.cors.origins,
    credentials: config.cors.credentials,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Customer-ID'],
    maxAge: 86400, // 24 hours
  })
);

// ============ BODY PARSER MIDDLEWARE ============
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ============ REQUEST LOGGING MIDDLEWARE ============
app.use(
  morgan((tokens, req, res) => {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: tokens.status(req, res),
      responseTime: `${tokens['response-time'](req, res)}ms`,
      contentLength: tokens.res(req, res, 'content-length'),
      customerId: (req as any).customerId || 'anonymous',
    });
  })
);

// ============ SECURITY MIDDLEWARE #3: RATE LIMITING (ENFORCED) ============
const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.rateLimit.maxRequests,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isDevelopment && !req.path.startsWith('/api'),
  keyGenerator: (req) => {
    // Rate limit by IP + Customer ID (if authenticated)
    const customerId = (req as any).customerId;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return customerId ? `${customerId}:${ip}` : ip;
  },
  handler: (req, res) => {
    throw ErrorFactory.rateLimited();
  },
});

app.use('/api/', globalRateLimiter);

// ============ SECURITY MIDDLEWARE #4: JWT AUTHENTICATION ============
/**
 * CRITICAL: This middleware runs BEFORE all routes
 * Validates JWT token and sets req.customerId
 */
const jwtAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header or x-api-key
    let token: string | null = null;
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;
    const customerId = req.headers['x-customer-id'] as string;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (apiKey) {
      token = apiKey;
    }

    // Public endpoints (no auth required)
    const publicPaths = ['/health', '/api/version'];
    if (publicPaths.includes(req.path)) {
      return next();
    }

    // All other endpoints require authentication
    if (!token && !customerId) {
      throw ErrorFactory.unauthorized(
        'Authentication required. Provide Authorization header or x-customer-id header'
      );
    }

    // Validate JWT token if provided
    if (token) {
      try {
        const decoded = jwt.verify(token, config.supabase.jwtSecret) as JwtPayload;

        if (!decoded.sub) {
          throw ErrorFactory.unauthorized('Invalid token format');
        }

        (req as any).customerId = decoded.sub;
        (req as any).userId = decoded.sub;
        console.log(`✅ Authenticated customer: ${decoded.sub}`);
      } catch (jwtError) {
        throw ErrorFactory.unauthorized('Invalid or expired token');
      }
    } else if (customerId) {
      // Basic validation of customer ID format
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) {
        throw ErrorFactory.validationError('Invalid customer ID format');
      }
      (req as any).customerId = customerId;
    }

    next();
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      const appError = error as any;
      return res.status(appError.statusCode || 401).json({
        success: false,
        error: appError.code || 'UNAUTHORIZED',
        message: appError.message,
      });
    }
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentication failed',
    });
  }
};

// ============ APPLY JWT AUTH TO ALL ROUTES ============
app.use(jwtAuth);

// ============ SECURITY MIDDLEWARE #5: CUSTOMER OWNERSHIP VALIDATION ============
/**
 * Validates that customer can only access their own data
 * Runs after auth on all /api routes
 */
const customerOwnershipCheck = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Only check on /api routes (not /health)
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  const customerId = (req as any).customerId;

  // Check if path contains customer/subscription/automation ID
  const pathMatch = req.path.match(/\/([\w-]+\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);

  if (pathMatch) {
    const requestedId = pathMatch[2];

    // Validate ownership
    if (customerId !== requestedId) {
      const error = ErrorFactory.forbidden('Cannot access other customers\' data');
      return res.status(403).json({
        success: false,
        error: error.code,
        message: error.message,
      });
    }
  }

  next();
};

app.use(customerOwnershipCheck);

// ============ HEALTH CHECK ENDPOINT (NO AUTH) ============
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.env,
  });
});

// ============ VERSION ENDPOINT (NO AUTH) ============
app.get('/api/version', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      version: '1.0.0',
      environment: config.server.env,
      timestamp: new Date().toISOString(),
    },
  });
});

// ============ PROTECTED ROUTES (Auth required via middleware above) ============
app.use('/api/oauth', oauthRoutes);
app.use('/api/payment', paymentRoutes);

// ============ PLACEHOLDER ROUTES (Days 5-10) ============
app.post(
  '/api/call/setup-recording',
  asyncHandler(async (req: Request, res: Response) => {
    throw ErrorFactory.notFound('Recording endpoint not yet implemented');
  })
);

app.get(
  '/api/automation/:id/results',
  asyncHandler(async (req: Request, res: Response) => {
    throw ErrorFactory.notFound('Results endpoint not yet implemented');
  })
);

app.get(
  '/api/customer/:id/automations',
  asyncHandler(async (req: Request, res: Response) => {
    throw ErrorFactory.notFound('Automations endpoint not yet implemented');
  })
);

// ============ 404 HANDLER ============
app.use((req: Request, res: Response) => {
  const error = ErrorFactory.notFound(`Route ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    error: error.code,
    message: error.message,
  });
});

// ============ GLOBAL ERROR HANDLER (LAST) ============
app.use(errorHandler);

// ============ PROCESS ERROR HANDLERS ============
process.on('unhandledRejection', (reason: unknown) => {
  ErrorLogger.log(new Error(`Unhandled Rejection: ${JSON.stringify(reason)}`), {
    context: 'unhandledRejection',
  });
});

process.on('uncaughtException', (error: Error) => {
  ErrorLogger.log(error, { context: 'uncaughtException' });
  process.exit(1);
});

// ============ EXPORT APP ============
export default app;
