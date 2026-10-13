/**
 * Configuration management
 * Loads and validates environment variables
 */

import * as dotenv from 'dotenv';

// Load .env file
dotenv.config();

export const config = {
  // ============ SERVER CONFIG ============
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    apiUrl: process.env.APP_URL || 'http://localhost:3000',
  },

  // ============ STRIPE CONFIG ============
  stripe: {
    apiKey: process.env.STRIPE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    prices: {
      solo: process.env.STRIPE_PRICE_SOLO || 'price_solo_99',
      pro: process.env.STRIPE_PRICE_PRO || 'price_pro_349',
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise_999',
    },
  },

  // ============ SUPABASE CONFIG ============
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
    jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
  },

  // ============ N8N CONFIG ============
  n8n: {
    baseUrl: process.env.N8N_URL || 'https://arisconsulting.app.n8n.cloud',
    apiKey: process.env.N8N_API_KEY || '',
  },

  // ============ TWILIO CONFIG ============
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromVoice: process.env.TWILIO_FROM_VOICE || '+19187237690',
    fromWhatsApp: process.env.TWILIO_FROM_WHATSAPP || 'whatsapp:+14155238886',
    webhookUrl: process.env.TWILIO_WEBHOOK_URL || '',
  },

  // ============ CLAUDE API CONFIG ============
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
    model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001',
  },

  // ============ OAUTH CONFIG ============
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
    },
    hubspot: {
      clientId: process.env.HUBSPOT_CLIENT_ID || '',
      clientSecret: process.env.HUBSPOT_CLIENT_SECRET || '',
      redirectUri: process.env.HUBSPOT_REDIRECT_URI || '',
    },
  },

  // ============ CORS CONFIG ============
  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },

  // ============ RATE LIMITING ============
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // ============ LOGGING ============
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    morgan: process.env.MORGAN_FORMAT || 'combined',
  },

  // ============ DATABASE BACKUP ============
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
    retention: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
  },

  // ============ MONITORING ============
  monitoring: {
    errorRateThreshold: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.05'),
    alertEmail: process.env.ALERT_EMAIL || '',
  },
};

// ============ VALIDATION ============
export function validateConfig(): void {
  const requiredVars = [
    'STRIPE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'N8N_API_KEY',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'CLAUDE_API_KEY',
  ];

  const missing = requiredVars.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Copy .env.example to .env and fill in the values'
    );
  }

  console.log('✅ Configuration validated successfully');
}

// ============ HELPERS ============
export const isDevelopment = config.server.env === 'development';
export const isProduction = config.server.env === 'production';
export const isTest = config.server.env === 'test';
