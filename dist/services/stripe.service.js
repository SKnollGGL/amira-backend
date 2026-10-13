"use strict";
/**
 * Stripe Service - Handle payment processing and subscriptions
 * Features: Customer creation, subscription management, webhook verification
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const stripe_1 = __importDefault(require("stripe"));
const supabase_js_1 = require("@supabase/supabase-js");
const config_1 = require("../config");
const errors_1 = require("../utils/errors");
// ============ STRIPE CLIENT ============
const stripe = new stripe_1.default(config_1.config.stripe.apiKey, {
    apiVersion: '2023-10-16',
});
// ============ SUPABASE CLIENT ============
const supabase = (0, supabase_js_1.createClient)(config_1.config.supabase.url, config_1.config.supabase.key);
// ============ STRIPE SERVICE ============
class StripeService {
    /**
     * Create Stripe customer
     */
    static async createCustomer(email, name, customerId) {
        try {
            const customer = await stripe.customers.create({
                email,
                name,
                metadata: {
                    customerId,
                },
            });
            console.log(`✅ Stripe customer created: ${customer.id}`);
            return customer.id;
        }
        catch (error) {
            throw errors_1.ErrorFactory.stripeError('Failed to create Stripe customer', error);
        }
    }
    /**
     * Create subscription for customer
     */
    static async createSubscription(customerId, tier) {
        try {
            // Get Stripe customer ID from database
            const { data: customer } = await supabase
                .from('customers')
                .select('metadata')
                .eq('id', customerId)
                .single();
            if (!customer?.metadata?.stripe_customer_id) {
                throw errors_1.ErrorFactory.validationError('Stripe customer ID not found');
            }
            const priceId = this.getPriceId(tier);
            // Create subscription
            const subscription = await stripe.subscriptions.create({
                customer: customer.metadata.stripe_customer_id,
                items: [
                    {
                        price: priceId,
                    },
                ],
                payment_behavior: 'default_incomplete',
                expand: ['latest_invoice.payment_intent'],
            });
            // Store subscription in database
            const { data: savedSubscription, error } = await supabase
                .from('subscriptions')
                .insert({
                customer_id: customerId,
                stripe_subscription_id: subscription.id,
                stripe_customer_id: customer.metadata.stripe_customer_id,
                tier,
                status: subscription.status,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
                .select()
                .single();
            if (error) {
                throw errors_1.ErrorFactory.databaseError(error);
            }
            console.log(`✅ Subscription created: ${subscription.id}`);
            return savedSubscription;
        }
        catch (error) {
            if (error instanceof Error && 'message' in error) {
                throw errors_1.ErrorFactory.stripeError(`Subscription creation failed: ${error.message}`, error);
            }
            throw error;
        }
    }
    /**
     * Get subscription details
     */
    static async getSubscription(stripeSubscriptionId) {
        try {
            return await stripe.subscriptions.retrieve(stripeSubscriptionId);
        }
        catch (error) {
            throw errors_1.ErrorFactory.stripeError('Failed to retrieve subscription', error);
        }
    }
    /**
     * Update subscription tier
     */
    static async updateSubscriptionTier(stripeSubscriptionId, newTier) {
        try {
            const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
            if (!subscription.items.data[0]) {
                throw errors_1.ErrorFactory.validationError('Subscription has no items');
            }
            const newPriceId = this.getPriceId(newTier);
            // Update the subscription item
            const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
                items: [
                    {
                        id: subscription.items.data[0].id,
                        price: newPriceId,
                    },
                ],
                proration_behavior: 'create_prorations',
            });
            console.log(`✅ Subscription updated to ${newTier}`);
            return updated;
        }
        catch (error) {
            throw errors_1.ErrorFactory.stripeError('Failed to update subscription', error);
        }
    }
    /**
     * Cancel subscription
     */
    static async cancelSubscription(stripeSubscriptionId) {
        try {
            const subscription = await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
            // Update database
            await supabase
                .from('subscriptions')
                .update({
                status: 'cancelled',
                cancel_at: new Date().toISOString(),
            })
                .eq('stripe_subscription_id', stripeSubscriptionId);
            console.log(`✅ Subscription cancelled: ${stripeSubscriptionId}`);
            return subscription;
        }
        catch (error) {
            throw errors_1.ErrorFactory.stripeError('Failed to cancel subscription', error);
        }
    }
    /**
     * Verify webhook signature
     */
    static verifyWebhookSignature(body, signature) {
        try {
            return stripe.webhooks.constructEvent(body, signature, config_1.config.stripe.webhookSecret);
        }
        catch (error) {
            throw errors_1.ErrorFactory.validationError('Invalid webhook signature', { error: error.message });
        }
    }
    /**
     * Handle invoice payment succeeded
     */
    static async handleInvoicePaid(invoice) {
        try {
            // Find customer by Stripe subscription ID
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('customer_id, stripe_subscription_id')
                .eq('stripe_subscription_id', invoice.subscription)
                .single();
            if (!subscription) {
                throw errors_1.ErrorFactory.notFound('Subscription for invoice');
            }
            // Record billing history
            const { data: billing, error } = await supabase
                .from('billing_history')
                .insert({
                customer_id: subscription.customer_id,
                subscription_id: invoice.subscription,
                amount: (invoice.amount_paid || 0) / 100, // Convert cents to dollars
                currency: invoice.currency?.toUpperCase() || 'USD',
                status: 'paid',
                stripe_charge_id: invoice.charge,
                stripe_invoice_id: invoice.id,
                description: invoice.lines.data[0]?.description || 'Subscription',
            })
                .select()
                .single();
            if (error) {
                throw errors_1.ErrorFactory.databaseError(error);
            }
            console.log(`✅ Payment recorded for invoice ${invoice.id}: $${invoice.amount_paid / 100}`);
            return billing;
        }
        catch (error) {
            throw errors_1.ErrorFactory.stripeError('Failed to handle payment', error);
        }
    }
    /**
     * Handle invoice payment failed
     */
    static async handlePaymentFailed(invoice) {
        try {
            // Find customer
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('customer_id, stripe_subscription_id')
                .eq('stripe_subscription_id', invoice.subscription)
                .single();
            if (!subscription) {
                return;
            }
            // Update subscription status
            await supabase
                .from('subscriptions')
                .update({
                status: 'past_due',
            })
                .eq('stripe_subscription_id', subscription.stripe_subscription_id);
            // Record failed payment
            await supabase.from('billing_history').insert({
                customer_id: subscription.customer_id,
                amount: (invoice.total || 0) / 100,
                currency: invoice.currency?.toUpperCase() || 'USD',
                status: 'failed',
                stripe_invoice_id: invoice.id,
                description: 'Payment failed',
            });
            console.log(`⚠️ Payment failed for invoice ${invoice.id}`);
        }
        catch (error) {
            console.error('Error handling payment failure:', error);
        }
    }
    /**
     * Handle subscription deleted
     */
    static async handleSubscriptionDeleted(subscription) {
        try {
            await supabase
                .from('subscriptions')
                .update({
                status: 'cancelled',
                cancel_at: new Date().toISOString(),
            })
                .eq('stripe_subscription_id', subscription.id);
            console.log(`✅ Subscription marked as cancelled: ${subscription.id}`);
        }
        catch (error) {
            console.error('Error handling subscription deletion:', error);
        }
    }
    /**
     * Get customer subscriptions
     */
    static async getCustomerSubscriptions(stripeCustomerId) {
        try {
            return await stripe.subscriptions.list({
                customer: stripeCustomerId,
                limit: 10,
            });
        }
        catch (error) {
            throw errors_1.ErrorFactory.stripeError('Failed to retrieve subscriptions', error);
        }
    }
    /**
     * Get price ID based on tier
     */
    static getPriceId(tier) {
        const priceIds = {
            starter: config_1.config.stripe.prices.solo,
            professional: config_1.config.stripe.prices.pro,
            advanced: config_1.config.stripe.prices.enterprise,
        };
        return priceIds[tier];
    }
    /**
     * Create checkout session for testing
     */
    static async createCheckoutSession(customerId, tier) {
        try {
            const priceId = this.getPriceId(tier);
            return await stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: `${config_1.config.server.apiUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${config_1.config.server.apiUrl}/payment/cancel`,
            });
        }
        catch (error) {
            throw errors_1.ErrorFactory.stripeError('Failed to create checkout session', error);
        }
    }
}
exports.StripeService = StripeService;
//# sourceMappingURL=stripe.service.js.map