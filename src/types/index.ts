/**
 * Type definitions for ARIS Platform SaaS Backend
 */

// ============ FIRM/CUSTOMER TYPES ============
export interface Firm {
  id: string;
  name: string;
  email: string;
  country: string;
  plan: 'solo' | 'pro' | 'enterprise';
  status: 'pending_payment' | 'active' | 'cancelled' | 'payment_failed';
  subscription_active: boolean;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  company?: string;
  tier: 'starter' | 'professional' | 'advanced';
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
}

// ============ BOT/AUTOMATION TYPES ============
export interface Bot {
  id: string;
  firm_id: string;
  name: string;
  n8n_id?: string;
  services: string[];
  languages: string[];
  active: boolean;
  created_at: string;
}

export interface Automation {
  id: string;
  customer_id: string;
  n8n_workflow_id: string;
  automation_type: 'email' | 'sms' | 'call' | 'webhook' | 'custom';
  status: 'active' | 'inactive' | 'paused';
  created_at: string;
}

// ============ OAUTH TYPES ============
export interface OAuthToken {
  customer_id: string;
  provider: 'google' | 'hubspot' | 'twilio';
  access_token: string;
  refresh_token?: string;
  expires_at: string;
  created_at: string;
}

export interface OAuthCallbackRequest {
  code: string;
  customer_id: string;
  provider: string;
  state?: string;
}

// ============ PAYMENT TYPES ============
export interface Subscription {
  id: string;
  customer_id: string;
  stripe_subscription_id: string;
  tier: string;
  status: 'active' | 'cancelled' | 'past_due';
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

export interface BillingHistory {
  id: string;
  customer_id?: string;
  firm_id?: string;
  amount: number;
  currency: string;
  status: 'paid' | 'failed' | 'pending';
  stripe_charge_id?: string;
  created_at: string;
}

// ============ CALL/RECORDING TYPES ============
export interface CallRecording {
  id: string;
  customer_id: string;
  automation_id: string;
  call_sid: string;
  recording_url: string;
  transcript?: string;
  insights_json?: Record<string, unknown>;
  duration_seconds?: number;
  created_at: string;
}

// ============ EXECUTION LOG TYPES ============
export interface ExecutionLog {
  id: string;
  automation_id: string;
  workflow_id: string;
  executed_at: string;
  status: 'success' | 'failed' | 'pending';
  result_json?: Record<string, unknown>;
  error_message?: string;
}

// ============ SUPPORT TICKET TYPES ============
export interface SupportTicket {
  id: string;
  customer_id: string;
  message: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at?: string;
}

// ============ API RESPONSE TYPES ============
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// ============ STATS TYPES ============
export interface AutomationStats {
  id: string;
  automation_id: string;
  emails_sent?: number;
  emails_opened?: number;
  emails_clicked?: number;
  emails_replied?: number;
  calls_made?: number;
  calls_answered?: number;
  smses_sent?: number;
  smses_delivered?: number;
  updated_at: string;
}

// ============ ERROR TYPES ============
export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// ============ REQUEST/RESPONSE TYPES ============
export interface AuthRequest {
  customerId?: string;
  userId?: string;
  apiKey?: string;
}

export interface FirmSignupRequest {
  firmName: string;
  email: string;
  country: string;
  planId: 'solo' | 'pro' | 'enterprise';
}

export interface CreateSubscriptionRequest {
  customer_id: string;
  tier: 'starter' | 'professional' | 'advanced';
}

export interface DeployAutomationRequest {
  automation_type: string;
  integrations: Record<string, unknown>;
  customSettings: Record<string, unknown>;
}

export interface SetupRecordingRequest {
  customer_id: string;
  automation_id: string;
}
