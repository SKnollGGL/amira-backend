/**
 * Jest Test Setup
 * Global configuration for all tests
 */
// Set test environment
process.env.NODE_ENV = 'test';
process.env.STRIPE_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test_key';
process.env.N8N_API_KEY = 'test_key';
process.env.TWILIO_ACCOUNT_SID = 'test_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_token';
process.env.CLAUDE_API_KEY = 'sk-ant-test';
// Suppress console logs during tests
global.console.log = jest.fn();
global.console.warn = jest.fn();
global.console.error = jest.fn();
// Add custom matchers if needed
expect.extend({});
// Set timeout for async tests
jest.setTimeout(30000);
//# sourceMappingURL=setup.js.map