# ARIS Platform SaaS - Backend API

Complete production-ready Node.js + TypeScript backend for multi-tenant SaaS platform.

## Features

- **Multi-tenant Architecture**: Isolated data per customer/firm
- **TypeScript**: Full type safety and modern development experience
- **Express.js**: Lightweight and flexible web framework
- **Stripe Integration**: Complete payment processing and subscription management
- **Supabase/PostgreSQL**: Secure database with Row-Level Security
- **n8n Integration**: Workflow automation and orchestration
- **Twilio Integration**: Voice calls and SMS capabilities
- **OAuth2**: Google, HubSpot, and Twilio OAuth support
- **Rate Limiting**: Request throttling for API protection
- **Error Handling**: Comprehensive error framework with logging
- **Security**: Helmet headers, CORS, input validation
- **Production Ready**: Monitoring, logging, and alerting

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Stripe test account
- Supabase project
- n8n instance
- Twilio account (optional)

### Installation

1. **Clone and setup**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Configure environment variables**
   ```bash
   # Edit .env with your API keys
   STRIPE_KEY=sk_test_...
   SUPABASE_URL=https://...supabase.co
   SUPABASE_KEY=...
   N8N_API_KEY=...
   TWILIO_ACCOUNT_SID=...
   TWILIO_AUTH_TOKEN=...
   CLAUDE_API_KEY=...
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Build TypeScript**
   ```bash
   npm run build
   ```

5. **Start server**
   ```bash
   npm start
   # Runs on http://localhost:3000
   ```

## Development

### Run in development mode
```bash
npm run dev
```

### Watch TypeScript compilation
```bash
npm run watch
```

### Run tests
```bash
npm test
npm run test:watch
npm run test:coverage
```

### Lint and format
```bash
npm run lint
npm run format
```

### Type checking
```bash
npm run type-check
```

## API Endpoints

### Health Check
```
GET /health
```

### API Information
```
GET /api/version
```

### Days 1-2: Foundation ✅
- [x] TypeScript setup
- [x] Database schema (12 tables)
- [x] Environment configuration
- [x] Error handling framework
- [x] Security middleware

### Days 3-4: OAuth + Stripe (In Progress)
```
POST /api/oauth/callback
POST /api/payment/create-subscription
POST /api/setup/deploy-automation
```

### Days 5-6: Recording + Deployment
```
POST /api/call/setup-recording
POST /api/automation/{id}/results
GET /api/customer/{id}/automations
```

### Days 7-8: Monitoring + Security (Scheduled)
- Request logging
- Error tracking
- Rate limiting
- Security headers

### Days 9-10: Production Deployment (Scheduled)
- Heroku deployment
- Database backups
- Monitoring + alerts

## Database Schema

### 12 Tables
1. `customers` - Customer accounts
2. `customer_automations` - Automation workflows
3. `oauth_tokens` - OAuth credentials (encrypted)
4. `call_recordings` - Twilio call recordings
5. `execution_logs` - Workflow execution history
6. `support_tickets` - Customer support
7. `subscriptions` - Stripe subscriptions
8. `billing_history` - Payment records
9. `automation_stats` - Performance metrics
10. `api_usage` - API request tracking
11. `audit_logs` - Action audit trail
12. `system_config` - System configuration

Apply schema in Supabase:
```sql
-- Copy content from src/database/schema.sql
-- Paste into Supabase SQL editor
-- Run to create all tables
```

## Error Handling

All errors follow consistent format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {}
}
```

### Error Codes
- `INVALID_REQUEST` - 400
- `UNAUTHORIZED` - 401
- `FORBIDDEN` - 403
- `NOT_FOUND` - 404
- `RATE_LIMITED` - 429
- `INTERNAL_ERROR` - 500
- `DATABASE_ERROR` - 500
- `STRIPE_ERROR` - 500
- `N8N_ERROR` - 500
- `TWILIO_ERROR` - 500

## Security

### Implemented
- ✅ CORS with whitelist
- ✅ Helmet security headers
- ✅ Rate limiting (100 req/min)
- ✅ Input validation
- ✅ Error message masking (production)
- ✅ TypeScript strict mode
- ✅ Environment variable validation

### Roadmap (Days 7-8)
- API key authentication
- JWT token validation
- Request signing
- Encryption at rest
- SQL injection prevention
- XSS protection

## Monitoring

### Logging
- Request logging via Morgan
- Error logging with context
- Performance metrics

### Metrics Tracked
- API response times
- Error rates
- Database query times
- Webhook processing
- Payment events

## Production Deployment

### Heroku Setup
```bash
heroku create amira-platform-api
heroku config:set NODE_ENV=production
heroku config:set STRIPE_KEY=sk_live_...
# Add all other env vars
git push heroku main
heroku logs --tail
```

### Monitoring
- Error rate alerting
- Response time tracking
- Uptime monitoring
- Database backup automation

## Support

For issues and questions:
1. Check error logs: `npm run dev`
2. Verify .env configuration
3. Test endpoints: See API documentation
4. Review GitHub issues

## Development Timeline

- **Days 1-2** ✅ COMPLETE: TypeScript conversion, database schema, config
- **Days 3-4** (Oct 15-16): OAuth + Stripe implementation
- **Days 5-6** (Oct 17-18): Call recording + automation results
- **Days 7-8** (Oct 19-20): Monitoring + security hardening
- **Days 9-10** (Oct 21-22): Production deployment

## License

MIT - ARIS Consulting
