/**
 * ARIS Platform SaaS - Complete Database Schema
 * PostgreSQL schema for Supabase
 * Created: 2026-10-13
 */

-- ============ ENABLE EXTENSIONS ============
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ 1. CUSTOMERS TABLE ============
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  tier VARCHAR(50) NOT NULL DEFAULT 'starter',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::JSONB,
  CHECK (tier IN ('starter', 'professional', 'advanced')),
  CHECK (status IN ('active', 'inactive', 'suspended'))
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- ============ 2. CUSTOMER AUTOMATIONS TABLE ============
CREATE TABLE IF NOT EXISTS customer_automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  n8n_workflow_id VARCHAR(255) NOT NULL,
  automation_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'inactive',
  configuration JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (automation_type IN ('email', 'sms', 'call', 'webhook', 'custom')),
  CHECK (status IN ('active', 'inactive', 'paused'))
);

CREATE INDEX idx_customer_automations_customer_id ON customer_automations(customer_id);
CREATE INDEX idx_customer_automations_n8n_workflow_id ON customer_automations(n8n_workflow_id);
CREATE INDEX idx_customer_automations_status ON customer_automations(status);

-- ============ 3. OAUTH TOKENS TABLE ============
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL,
  access_token TEXT NOT NULL,
  access_token_encrypted TEXT,
  refresh_token TEXT,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  scope VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (provider IN ('google', 'hubspot', 'twilio')),
  UNIQUE(customer_id, provider)
);

CREATE INDEX idx_oauth_tokens_customer_id ON oauth_tokens(customer_id);
CREATE INDEX idx_oauth_tokens_provider ON oauth_tokens(provider);
CREATE INDEX idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);

-- ============ 4. CALL RECORDINGS TABLE ============
CREATE TABLE IF NOT EXISTS call_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES customer_automations(id) ON DELETE CASCADE,
  call_sid VARCHAR(255) NOT NULL UNIQUE,
  recording_url TEXT,
  transcript TEXT,
  transcript_encrypted TEXT,
  insights_json JSONB DEFAULT '{}'::JSONB,
  duration_seconds INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_call_recordings_customer_id ON call_recordings(customer_id);
CREATE INDEX idx_call_recordings_automation_id ON call_recordings(automation_id);
CREATE INDEX idx_call_recordings_call_sid ON call_recordings(call_sid);
CREATE INDEX idx_call_recordings_created_at ON call_recordings(created_at DESC);

-- ============ 5. EXECUTION LOGS TABLE ============
CREATE TABLE IF NOT EXISTS execution_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES customer_automations(id) ON DELETE CASCADE,
  workflow_id VARCHAR(255) NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) NOT NULL,
  result_json JSONB DEFAULT '{}'::JSONB,
  error_message TEXT,
  duration_ms INTEGER,
  retries INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('success', 'failed', 'pending', 'timeout'))
);

CREATE INDEX idx_execution_logs_automation_id ON execution_logs(automation_id);
CREATE INDEX idx_execution_logs_workflow_id ON execution_logs(workflow_id);
CREATE INDEX idx_execution_logs_status ON execution_logs(status);
CREATE INDEX idx_execution_logs_executed_at ON execution_logs(executed_at DESC);

-- ============ 6. SUPPORT TICKETS TABLE ============
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  priority VARCHAR(50) DEFAULT 'normal',
  assigned_to VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  CHECK (status IN ('open', 'in_progress', 'closed', 'on_hold')),
  CHECK (priority IN ('low', 'normal', 'high', 'critical'))
);

CREATE INDEX idx_support_tickets_customer_id ON support_tickets(customer_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- ============ 7. SUBSCRIPTIONS TABLE ============
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) NOT NULL UNIQUE,
  stripe_customer_id VARCHAR(255),
  tier VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('active', 'cancelled', 'past_due', 'incomplete')),
  UNIQUE(customer_id, stripe_subscription_id)
);

CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============ 8. BILLING HISTORY TABLE ============
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  stripe_charge_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('pending', 'paid', 'failed', 'refunded'))
);

CREATE INDEX idx_billing_history_customer_id ON billing_history(customer_id);
CREATE INDEX idx_billing_history_subscription_id ON billing_history(subscription_id);
CREATE INDEX idx_billing_history_status ON billing_history(status);
CREATE INDEX idx_billing_history_created_at ON billing_history(created_at DESC);

-- ============ 9. AUTOMATION STATS TABLE ============
CREATE TABLE IF NOT EXISTS automation_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES customer_automations(id) ON DELETE CASCADE,
  emails_sent INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  calls_made INTEGER DEFAULT 0,
  calls_answered INTEGER DEFAULT 0,
  calls_duration_seconds INTEGER DEFAULT 0,
  smses_sent INTEGER DEFAULT 0,
  smses_delivered INTEGER DEFAULT 0,
  webhooks_triggered INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(automation_id)
);

CREATE INDEX idx_automation_stats_automation_id ON automation_stats(automation_id);

-- ============ 10. API USAGE TABLE ============
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_usage_customer_id ON api_usage(customer_id);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at DESC);

-- ============ 11. AUDIT LOG TABLE ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  changes JSONB DEFAULT '{}'::JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_customer_id ON audit_logs(customer_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============ 12. SYSTEM CONFIG TABLE ============
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key VARCHAR(255) NOT NULL UNIQUE,
  value TEXT,
  value_type VARCHAR(50) DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_config_key ON system_config(key);

-- ============ TRIGGERS ============
-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_automations_updated_at BEFORE UPDATE ON customer_automations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_tokens_updated_at BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_recordings_updated_at BEFORE UPDATE ON call_recordings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_history_updated_at BEFORE UPDATE ON billing_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============ ROW LEVEL SECURITY (RLS) ============
-- Note: Enable RLS policies based on auth context
-- This requires auth.uid() to be set in request context

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- ============ INITIAL DATA ============
INSERT INTO system_config (key, value, value_type, description)
VALUES
  ('api_version', '1.0.0', 'string', 'Current API version'),
  ('database_version', '1.0.0', 'string', 'Database schema version'),
  ('maintenance_mode', 'false', 'boolean', 'Enable maintenance mode'),
  ('max_api_requests_per_min', '100', 'integer', 'Rate limiting threshold')
ON CONFLICT (key) DO NOTHING;

-- ============ END SCHEMA ============
