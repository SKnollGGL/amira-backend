"use strict";
/**
 * Payment Routes - Handle Stripe payment processing
 * Endpoints: POST /api/payment/create-subscription, POST /api/webhooks/stripe
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_service_1 = require("../services/stripe.service");
const errors_1 = require("../utils/errors");
const router = (0, express_1.Router)();
// ============ CREATE SUBSCRIPTION ENDPOINT ============
/**
 * POST /api/payment/create-subscription
 * Create a Stripe subscription for a customer
 *
 * Request body:
 * {
 *   "customer_id": "customer_uuid",
 *   "tier": "starter|professional|advanced",
 *   "email": "customer@example.com" (optional, for new customers)
 *   "name": "Customer Name" (optional, for new customers)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "subscription_id": "sub_xxx",
 *     "customer_id": "customer_uuid",
 *     "tier": "professional",
 *     "status": "active",
 *     "current_period_end": "2026-11-13T..."
 *   }
 * }
 */
router.post('/create-subscription', (0, errors_1.asyncHandler)(async (req, res) => {
    const { customer_id, tier, email, name } = req.body;
    // ============ INPUT VALIDATION ============
    if (!customer_id) {
        throw errors_1.ErrorFactory.validationError('Customer ID is required');
    }
    if (!errors_1.Validators.uuid(customer_id)) {
        throw errors_1.ErrorFactory.validationError('Invalid customer ID format');
    }
    if (!tier) {
        throw errors_1.ErrorFactory.validationError('Tier is required');
    }
    if (!['starter', 'professional', 'advanced'].includes(tier)) {
        throw errors_1.ErrorFactory.validationError('Invalid tier. Must be starter, professional, or advanced');
    }
    // ============ CREATE SUBSCRIPTION ============
    try {
        // Create Stripe customer if needed
        if (email && name) {
            if (!errors_1.Validators.email(email)) {
                throw errors_1.ErrorFactory.validationError('Invalid email format');
            }
            await stripe_service_1.StripeService.createCustomer(email, name, customer_id);
        }
        // Create subscription
        const subscription = await stripe_service_1.StripeService.createSubscription(customer_id, tier);
        // ============ RETURN RESPONSE ============
        res.json({
            success: true,
            data: {
                subscription_id: subscription.stripe_subscription_id,
                customer_id: subscription.customer_id,
                tier: subscription.tier,
                status: subscription.status,
                current_period_start: subscription.current_period_start,
                current_period_end: subscription.current_period_end,
                message: `Subscription created for ${tier} tier`,
            },
        });
    }
    catch (error) {
        if (error instanceof Error) {
            throw errors_1.ErrorFactory.stripeError('Subscription creation failed', error);
        }
        throw error;
    }
}));
// ============ GET SUBSCRIPTION ============
/**
 * GET /api/payment/subscription/:subscription_id
 * Get subscription details
 */
router.get('/subscription/:subscription_id', (0, errors_1.asyncHandler)(async (req, res) => {
    const { subscription_id } = req.params;
    if (!subscription_id) {
        throw errors_1.ErrorFactory.validationError('Subscription ID is required');
    }
    const subscription = await stripe_service_1.StripeService.getSubscription(subscription_id);
    res.json({
        success: true,
        data: {
            subscription_id: subscription.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000),
            cancel_at: subscription.cancel_at
                ? new Date(subscription.cancel_at * 1000)
                : null,
        },
    });
}));
// ============ UPDATE SUBSCRIPTION TIER ============
/**
 * POST /api/payment/upgrade-subscription
 * Change subscription tier (upgrade/downgrade)
 */
router.post('/upgrade-subscription', (0, errors_1.asyncHandler)(async (req, res) => {
    const { subscription_id, tier } = req.body;
    if (!subscription_id) {
        throw errors_1.ErrorFactory.validationError('Subscription ID is required');
    }
    if (!tier) {
        throw errors_1.ErrorFactory.validationError('Tier is required');
    }
    if (!['starter', 'professional', 'advanced'].includes(tier)) {
        throw errors_1.ErrorFactory.validationError('Invalid tier');
    }
    const updated = await stripe_service_1.StripeService.updateSubscriptionTier(subscription_id, tier);
    res.json({
        success: true,
        data: {
            subscription_id: updated.id,
            status: updated.status,
            tier,
            message: `Subscription upgraded to ${tier}`,
        },
    });
}));
// ============ CANCEL SUBSCRIPTION ============
/**
 * POST /api/payment/cancel-subscription
 * Cancel a subscription
 */
router.post('/cancel-subscription', (0, errors_1.asyncHandler)(async (req, res) => {
    const { subscription_id } = req.body;
    if (!subscription_id) {
        throw errors_1.ErrorFactory.validationError('Subscription ID is required');
    }
    const cancelled = await stripe_service_1.StripeService.cancelSubscription(subscription_id);
    res.json({
        success: true,
        data: {
            subscription_id: cancelled.id,
            status: cancelled.status,
            cancelled_at: new Date().toISOString(),
            message: 'Subscription cancelled',
        },
    });
}));
// ============ STRIPE WEBHOOK ============
/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 * Events: payment_intent.succeeded, invoice.paid, invoice.payment_failed, customer.subscription.deleted
 */
router.post('/webhooks/stripe', (0, express_1.raw)({ type: 'application/json' }), (0, errors_1.asyncHandler)(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
        throw errors_1.ErrorFactory.validationError('Stripe signature is missing');
    }
    // ============ VERIFY WEBHOOK ============
    let event;
    try {
        event = stripe_service_1.StripeService.verifyWebhookSignature(req.body, signature);
    }
    catch (error) {
        errors_1.ErrorLogger.logInfo('Invalid webhook signature', {
            signature: signature.substring(0, 20) + '...',
        });
        throw errors_1.ErrorFactory.validationError('Invalid webhook signature');
    }
    // ============ HANDLE EVENTS ============
    switch (event.type) {
        case 'invoice.paid': {
            const invoice = event.data.object;
            await stripe_service_1.StripeService.handleInvoicePaid(invoice);
            break;
        }
        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            await stripe_service_1.StripeService.handlePaymentFailed(invoice);
            break;
        }
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            await stripe_service_1.StripeService.handleSubscriptionDeleted(subscription);
            break;
        }
        default:
            // Log unhandled event
            errors_1.ErrorLogger.logInfo(`Unhandled webhook event type: ${event.type}`, {
                eventId: event.id,
            });
    }
    // ============ ACKNOWLEDGE WEBHOOK ============
    res.json({ received: true, event_id: event.id });
}));
// ============ TEST WEBHOOK ============
/**
 * POST /api/payment/test-webhook
 * For development: Simulate a webhook event
 */
router.post('/test-webhook', (0, errors_1.asyncHandler)(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        throw errors_1.ErrorFactory.forbidden('Test webhook not available in production');
    }
    const { event_type, customer_id } = req.body;
    if (!event_type) {
        throw errors_1.ErrorFactory.validationError('Event type is required');
    }
    // Simulate webhook
    errors_1.ErrorLogger.logInfo('Simulated webhook event', {
        event_type,
        customer_id,
    });
    res.json({
        success: true,
        message: `Simulated ${event_type} event`,
    });
}));
exports.default = router;
//# sourceMappingURL=payment.js.map