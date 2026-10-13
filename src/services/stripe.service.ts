/**
 * Stripe Service - Handle payment processing and subscriptions
 * Features: Customer creation, subscription management, webhook verification
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { ErrorFactory } from '../utils/errors';
import { Subscription, BillingHistory } from '../types';

// ============ STRIPE CLIENT ============
const stripe = new Stripe(config.stripe.apiKey, {
  apiVersion: '2023-10-16',
});

// ============ SUPABASE CLIENT ============
const supabase = createClient(config.supabase.url, config.supabase.key);

// ============ STRIPE SERVICE ============
export class StripeService {
  /**
   * Create Stripe customer
   */
  static async createCustomer(
    email: string,
    name: string,
    customerId: string
  ): Promise<string> {
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
    } catch (error) {
      throw ErrorFactory.stripeError(
        'Failed to create Stripe customer',
        error as Error
      );
    }
  }

  /**
   * Create subscription for customer
   */
  static async createSubscription(
    customerId: string,
    tier: 'starter' | 'professional' | 'advanced'
  ): Promise<Subscription> {
    try {
      // Get Stripe customer ID from database
      const { data: customer } = await supabase
        .from('customers')
        .select('metadata')
        .eq('id', customerId)
        .single();

      if (!customer?.metadata?.stripe_customer_id) {
        throw ErrorFactory.validationError('Stripe customer ID not found');
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
          current_period_start: new Date(
            subscription.current_period_start * 1000
          ).toISOString(),
          current_period_end: new Date(
            subscription.current_period_end * 1000
          ).toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw ErrorFactory.databaseError(error as Error);
      }

      console.log(`✅ Subscription created: ${subscription.id}`);

      return savedSubscription as unknown as Subscription;
    } catch (error) {
      if (error instanceof Error && 'message' in error) {
        throw ErrorFactory.stripeError(
          `Subscription creation failed: ${error.message}`,
          error
        );
      }
      throw error;
    }
  }

  /**
   * Get subscription details
   */
  static async getSubscription(
    stripeSubscriptionId: string
  ): Promise<Stripe.Subscription> {
    try {
      return await stripe.subscriptions.retrieve(stripeSubscriptionId);
    } catch (error) {
      throw ErrorFactory.stripeError(
        'Failed to retrieve subscription',
        error as Error
      );
    }
  }

  /**
   * Update subscription tier
   */
  static async updateSubscriptionTier(
    stripeSubscriptionId: string,
    newTier: 'starter' | 'professional' | 'advanced'
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.retrieve(
        stripeSubscriptionId
      );

      if (!subscription.items.data[0]) {
        throw ErrorFactory.validationError('Subscription has no items');
      }

      const newPriceId = this.getPriceId(newTier);

      // Update the subscription item
      const updated = await stripe.subscriptions.update(
        stripeSubscriptionId,
        {
          items: [
            {
              id: subscription.items.data[0].id,
              price: newPriceId,
            },
          ],
          proration_behavior: 'create_prorations',
        }
      );

      console.log(`✅ Subscription updated to ${newTier}`);
      return updated;
    } catch (error) {
      throw ErrorFactory.stripeError(
        'Failed to update subscription',
        error as Error
      );
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(
    stripeSubscriptionId: string
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await stripe.subscriptions.update(
        stripeSubscriptionId,
        { cancel_at_period_end: true }
      );

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
    } catch (error) {
      throw ErrorFactory.stripeError(
        'Failed to cancel subscription',
        error as Error
      );
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(
    body: string | Buffer,
    signature: string
  ): Stripe.Event {
    try {
      return stripe.webhooks.constructEvent(
        body,
        signature,
        config.stripe.webhookSecret
      );
    } catch (error) {
      throw ErrorFactory.validationError(
        'Invalid webhook signature',
        { error: (error as Error).message }
      );
    }
  }

  /**
   * Handle invoice payment succeeded
   */
  static async handleInvoicePaid(
    invoice: Stripe.Invoice
  ): Promise<BillingHistory> {
    try {
      // Find customer by Stripe subscription ID
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('customer_id, stripe_subscription_id')
        .eq('stripe_subscription_id', invoice.subscription)
        .single();

      if (!subscription) {
        throw ErrorFactory.notFound('Subscription for invoice');
      }

      // Record billing history
      const { data: billing, error } = await supabase
        .from('billing_history')
        .insert({
          customer_id: (subscription as any).customer_id,
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
        throw ErrorFactory.databaseError(error as Error);
      }

      console.log(
        `✅ Payment recorded for invoice ${invoice.id}: $${invoice.amount_paid / 100}`
      );

      return billing as unknown as BillingHistory;
    } catch (error) {
      throw ErrorFactory.stripeError(
        'Failed to handle payment',
        error as Error
      );
    }
  }

  /**
   * Handle invoice payment failed
   */
  static async handlePaymentFailed(
    invoice: Stripe.Invoice
  ): Promise<void> {
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
    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }

  /**
   * Handle subscription deleted
   */
  static async handleSubscriptionDeleted(
    subscription: Stripe.Subscription
  ): Promise<void> {
    try {
      await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancel_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', subscription.id);

      console.log(`✅ Subscription marked as cancelled: ${subscription.id}`);
    } catch (error) {
      console.error('Error handling subscription deletion:', error);
    }
  }

  /**
   * Get customer subscriptions
   */
  static async getCustomerSubscriptions(
    stripeCustomerId: string
  ): Promise<Stripe.ApiList<Stripe.Subscription>> {
    try {
      return await stripe.subscriptions.list({
        customer: stripeCustomerId,
        limit: 10,
      });
    } catch (error) {
      throw ErrorFactory.stripeError(
        'Failed to retrieve subscriptions',
        error as Error
      );
    }
  }

  /**
   * Get price ID based on tier
   */
  private static getPriceId(
    tier: 'starter' | 'professional' | 'advanced'
  ): string {
    const priceIds = {
      starter: config.stripe.prices.solo,
      professional: config.stripe.prices.pro,
      advanced: config.stripe.prices.enterprise,
    };
    return priceIds[tier];
  }

  /**
   * Create checkout session for testing
   */
  static async createCheckoutSession(
    customerId: string,
    tier: 'starter' | 'professional' | 'advanced'
  ): Promise<Stripe.Checkout.Session> {
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
        success_url: `${config.server.apiUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.server.apiUrl}/payment/cancel`,
      });
    } catch (error) {
      throw ErrorFactory.stripeError(
        'Failed to create checkout session',
        error as Error
      );
    }
  }
}
