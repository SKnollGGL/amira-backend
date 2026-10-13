# Production Deployment Guide - ARIS Platform Sign-Up + Payment System

**Status:** Ready for Deployment  
**Date:** 2026-10-14  
**Version:** 1.0.0

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  amiraconsulting.services                   │
│                  (Cloudflare Pages)                          │
├────────────────┬─────────────────────┬──────────────────────┤
│ /signup.html   │  /payment.html      │  /success.html       │
│ (Vue.js)       │  (Stripe.js)        │  (Dashboard)         │
└────────────────┴─────────────────────┴──────────────────────┘
                        ↓ (HTTPS API calls)
┌─────────────────────────────────────────────────────────────┐
│      ARIS Platform Backend (Render.com)                     │
│      Node.js + Express + TypeScript                         │
├─────────────────────────────────────────────────────────────┤
│  POST /api/payment/create-customer                          │
│  POST /api/payment/create-payment-intent                    │
│  GET  /api/payment/customer/:id                             │
│  POST /api/payment/create-subscription                      │
│  POST /api/webhooks/stripe                                  │
└─────────────────────────────────────────────────────────────┘
          ↓                      ↓                ↓
    ┌──────────┐         ┌─────────────┐    ┌──────────┐
    │ Stripe   │         │  Supabase   │    │   n8n    │
    │ Payments │         │  Database   │    │Workflows │
    └──────────┘         └─────────────┘    └──────────┘
```

## Pre-Deployment Checklist

### 1. Environment Variables (CRITICAL)

Get these values from:
- **Stripe:** dashboard.stripe.com/apikeys
- **Supabase:** https://diryethqkgdweamujrdu.supabase.co/project/settings/api
- **N8N:** https://arisconsulting.app.n8n.cloud/

Required environment variables for Render:
```
STRIPE_KEY=sk_live_... (get from Stripe)
STRIPE_PUBLISHABLE_KEY=pk_live_... (get from Stripe)
STRIPE_WEBHOOK_SECRET=whsec_... (generate in Stripe webhooks)
SUPABASE_URL=https://diryethqkgdweamujrdu.supabase.co
SUPABASE_KEY=... (get from Supabase Settings > API)
SUPABASE_JWT_SECRET=... (get from Supabase Settings > JWT Secret)
ENCRYPTION_SALT=TNiil7du2rFOO1QolXKphF6LHV9ZgM (keep this)
N8N_API_KEY=... (generate in n8n)
CLAUDE_API_KEY=sk-ant-... (from claude.ai)
```

### 2. Database Schema

Supabase tables required:
- `customers` - User accounts
- `subscriptions` - Stripe subscriptions
- `billing_history` - Payment records
- `oauth_tokens` - OAuth tokens

Run migration if not already done:
```sql
-- Check if tables exist
SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'customers');
```

### 3. Stripe Configuration

1. Create products:
   - Starter: €49.99/month
   - Professional: €99.99/month
   - Advanced: €199.99/month

2. Get price IDs and add to Render environment:
   ```
   STRIPE_PRICE_STARTER=price_xxx
   STRIPE_PRICE_PROFESSIONAL=price_yyy
   STRIPE_PRICE_ADVANCED=price_zzz
   ```

3. Setup webhook:
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://[RENDER_URL]/api/webhooks/stripe`
   - Events: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
   - Copy webhook secret → STRIPE_WEBHOOK_SECRET

4. Test webhook connectivity:
   ```
   curl -X POST https://[RENDER_URL]/api/webhooks/stripe \
     -H "Content-Type: application/json" \
     -H "Stripe-Signature: t=123,v1=abc" \
     -d '{"type": "invoice.paid"}'
   ```

## Deployment Steps

### PHASE 1: Deploy Backend to Render

1. **Connect Git Repository to Render**
   - Go to render.com
   - New → Web Service
   - Connect GitHub repository: `backend/`
   - Name: `amira-aris-backend`
   - Plan: Standard ($7/month)
   - Build Command: `npm install && npm run build`
   - Start Command: `node dist/index.js`

2. **Add Environment Variables in Render Dashboard**
   - Dashboard → amira-aris-backend → Settings → Environment
   - Add all variables from section above

3. **Deploy**
   - Click "Create Web Service"
   - Wait for build (2-3 minutes)
   - Note the URL: `https://amira-aris-backend.render.com`

4. **Test Backend Health**
   ```bash
   curl https://amira-aris-backend.render.com/health
   # Expected: {"status": "ok", "environment": "production", ...}
   ```

### PHASE 2: Deploy Frontend to Cloudflare Pages

1. **Copy HTML files to Cloudflare Pages repository**
   - Upload `/public/signup.html` → `signup.html`
   - Upload `/public/payment.html` → `payment.html`
   - Upload `/public/success.html` → `success.html`

2. **Update JavaScript API URLs in HTML files**
   - Search for `fetch('/api/` in each HTML file
   - Replace with backend URL: `fetch('https://amira-aris-backend.render.com/api/`

3. **Deploy via Cloudflare Pages**
   - Cloudflare Dashboard → Pages → amiraconsulting-site
   - Upload files manually or via git

4. **Test frontend**
   - Visit: https://amiraconsulting.services/signup.html
   - Form should load without errors

### PHASE 3: Wire DNS + HTTPS

1. **Ensure HTTPS enabled**
   - Cloudflare → amiraconsulting.services → SSL/TLS
   - Set to "Full (strict)"

2. **Set CORS headers** (if needed)
   - Backend CORS_ORIGINS already includes `https://amiraconsulting.services`

3. **Test CORS**
   ```bash
   curl -H "Origin: https://amiraconsulting.services" \
        https://amira-aris-backend.render.com/api/payment/config \
        -v 2>&1 | grep -i "access-control"
   ```

### PHASE 4: Configure Stripe Webhook

1. **Add Render URL to Stripe**
   - Stripe Dashboard → Developers → Webhooks
   - Endpoint: `https://amira-aris-backend.render.com/api/webhooks/stripe`
   - Events to listen for:
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.deleted`

2. **Test webhook from Stripe dashboard**
   - Click "Send test webhook"
   - Check Render logs for webhook processing

## Testing Workflow

### Test 1: Health Check
```bash
curl https://amira-aris-backend.render.com/health
```

Expected output:
```json
{
  "status": "ok",
  "environment": "production",
  "uptime": 123.45
}
```

### Test 2: Free Tier Sign-Up

1. Visit: https://amiraconsulting.services/signup.html
2. Fill form:
   - Name: "Test User"
   - Email: "test+free@example.com"
   - Phone: "+40 712 345 678"
   - Password: "TestPass123"
   - Tier: "Free"
3. Click "Create Account"
4. Expected: Redirect to success page with customer ID
5. Verify in Supabase: 
   - Table `customers`
   - Check that row with email was created
   - Status should be "active"

### Test 3: Paid Tier Sign-Up (Stripe Test Mode)

1. Visit: https://amiraconsulting.services/signup.html
2. Fill form:
   - Name: "Test Pro"
   - Email: "test+pro@example.com"
   - Phone: "+40 712 345 678"
   - Password: "TestPass123"
   - Tier: "Professional"
3. Click "Create Account"
4. Expected: Redirect to /payment.html
5. Verify order summary shows:
   - Plan: Professional
   - Price: €99.99/month
6. On payment page:
   - Card: 4242 4242 4242 4242
   - Expiry: Any future date (e.g., 12/26)
   - CVC: Any 3 digits (e.g., 123)
   - Click "Complete Payment"
7. Expected: 
   - Payment succeeds
   - Webhook triggers (check n8n logs)
   - Customer created in Supabase with tier="professional"
   - Subscription created in Supabase with status="active"

### Test 4: Webhook Processing

1. After successful payment:
   - Check Stripe Dashboard → Invoices
   - Should see new invoice with "Paid" status
2. Check n8n workflow executions:
   - https://arisconsulting.app.n8n.cloud/executions
   - Look for webhook execution logs
3. Check Supabase:
   - Table `subscriptions`: Check status="active"
   - Table `billing_history`: Check payment recorded

### Test 5: Mobile Responsiveness

1. Test on mobile device:
   - https://amiraconsulting.services/signup.html
   - Form should be full-width, readable
   - Submit button should work on touch

2. Test on various screen sizes:
   - iPhone (375px)
   - Android (412px)
   - iPad (768px)
   - Desktop (1920px)

## Monitoring & Logging

### Backend Logs (Render)
- Render Dashboard → amira-aris-backend → Logs
- Real-time application logs
- Check for errors in startup and request handling

### Database Logs (Supabase)
- Supabase Dashboard → Logs → Edge Functions
- Monitor database queries

### Stripe Logs
- Stripe Dashboard → Logs
- Check webhook delivery status
- See event processing history

### n8n Logs
- n8n Dashboard → Executions
- Monitor workflow triggers
- Check for failures in payment processing

## Troubleshooting

### Issue: "Payment processing failed" on frontend

**Diagnosis:**
```bash
# Check backend is running
curl https://amira-aris-backend.render.com/health

# Check Stripe config
curl https://amira-aris-backend.render.com/api/payment/config

# Check logs
# Render Dashboard → amira-aris-backend → Logs
```

**Solutions:**
1. Verify STRIPE_KEY and STRIPE_PUBLISHABLE_KEY are set
2. Check CORS origin in backend `.env`
3. Ensure Stripe keys are for correct environment (test vs live)

### Issue: "Database error" when creating customer

**Diagnosis:**
1. Check Supabase connection:
   ```bash
   # Test from backend logs
   ```
2. Verify database credentials:
   - SUPABASE_URL correct format
   - SUPABASE_KEY is valid
   - JWT_SECRET is correct

**Solutions:**
1. Check SUPABASE_URL and SUPABASE_KEY in environment
2. Verify `customers` table exists in Supabase
3. Check Row-Level Security (RLS) policies allow writes
4. Test connection in Supabase Console → SQL

### Issue: Webhook not received (payment not confirmed)

**Diagnosis:**
1. Check Stripe webhook delivery:
   - Stripe Dashboard → Developers → Webhooks
   - Click endpoint → Recent attempts
   - Look for failed deliveries
2. Check Render logs for webhook endpoint errors

**Solutions:**
1. Verify webhook endpoint: `https://amira-aris-backend.render.com/api/webhooks/stripe`
2. Check STRIPE_WEBHOOK_SECRET is correct
3. Resend test webhook from Stripe dashboard
4. Check firewall/security isn't blocking webhooks

### Issue: CORS error when submitting signup form

**Error:** "Access to XMLHttpRequest ... blocked by CORS"

**Solutions:**
1. Check CORS_ORIGINS in Render environment:
   ```
   CORS_ORIGINS=https://amiraconsulting.services,http://localhost:3000
   ```
2. Verify frontend is making requests to correct backend URL
3. Check browser console for exact error message
4. Test with curl (doesn't have CORS restrictions):
   ```bash
   curl -H "Origin: https://amiraconsulting.services" \
        -H "Content-Type: application/json" \
        https://amira-aris-backend.render.com/api/payment/config
   ```

## Performance Optimization

### Caching
- Static files (HTML) cached by Cloudflare
- API responses cached where appropriate (24 hours for config)

### Rate Limiting
- Enabled: 100 requests per minute per IP
- Rate limit errors return 429 status

### Database Optimization
- Add indexes on frequently queried fields:
  ```sql
  CREATE INDEX idx_customers_email ON customers(email);
  CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
  ```

## Security Checklist

- [ ] All API keys stored in Render environment variables (NOT in code)
- [ ] HTTPS enabled on all endpoints (Cloudflare + Render)
- [ ] CORS properly configured (only allow amiraconsulting.services)
- [ ] Rate limiting enabled
- [ ] Stripe webhook signature verified
- [ ] Database Row-Level Security (RLS) configured
- [ ] No sensitive data in logs
- [ ] ENCRYPTION_SALT is strong and unique
- [ ] JWT secrets proper length and complexity

## Rollback Plan

If issues occur post-deployment:

1. **Immediate Rollback (Render)**
   - Render Dashboard → amira-aris-backend
   - Click "Rollback" to previous deployment
   - Takes effect immediately

2. **Frontend Rollback (Cloudflare Pages)**
   - Cloudflare Dashboard → Pages → amiraconsulting-site
   - Select previous deployment
   - Click "Retry/Rollback"

3. **Database Backup**
   - Supabase → Backups
   - Restore from point-in-time backup if needed

## Success Criteria

✅ Deployment is complete when:

1. Backend health check returns OK
2. Frontend loads without JS errors
3. Free tier signup creates customer in Supabase
4. Paid tier creates payment intent via Stripe
5. Webhook processes payment and creates subscription
6. Success page displays correct customer info
7. Mobile responsive on small screens
8. All logs show no errors

## Contact & Support

**Deployment Contact:** admin@amiraconsulting.services

**Runbooks:**
- Backend Issues: Check Render logs
- Database Issues: Check Supabase console
- Payment Issues: Check Stripe dashboard
- Workflow Issues: Check n8n executions

**Escalation:**
1. Check logs across all systems
2. Review recent deployments
3. Check Stripe/Supabase/n8n status pages
4. Contact platform support if infrastructure issue

---

## Deployment Completed Successfully ✅

Date deployed: [DEPLOY_DATE]
Backend URL: https://[RENDER_URL]
Frontend URL: https://amiraconsulting.services
Status: ✅ LIVE
