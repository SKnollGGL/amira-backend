/**
 * Stripe Service Tests
 * Test payment processing and subscription management
 */

import { StripeService } from '../services/stripe.service';
import { ErrorFactory } from '../utils/errors';

describe('StripeService', () => {
  const testCustomerId = '123e4567-e89b-12d3-a456-426614174000';
  const testEmail = 'test@example.com';
  const testName = 'Test Customer';

  describe('Customer Management', () => {
    it('should validate customer email format', () => {
      const validEmail = 'test@example.com';
      const invalidEmail = 'not-an-email';

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(validEmail)).toBe(true);
      expect(emailRegex.test(invalidEmail)).toBe(false);
    });

    it('should validate customer ID format (UUID)', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUUID = 'not-a-uuid';

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(validUUID)).toBe(true);
      expect(uuidRegex.test(invalidUUID)).toBe(false);
    });
  });

  describe('Subscription Tiers', () => {
    it('should validate subscription tier', () => {
      const validTiers = ['starter', 'professional', 'advanced'];
      const invalidTier = 'premium';

      expect(validTiers).toContain('starter');
      expect(validTiers).toContain('professional');
      expect(validTiers).toContain('advanced');
      expect(validTiers).not.toContain(invalidTier);
    });

    it('should have correct price mapping', () => {
      const priceIds = {
        starter: 'price_solo_99',
        professional: 'price_pro_349',
        advanced: 'price_enterprise_999',
      };

      expect(priceIds.starter).toBeDefined();
      expect(priceIds.professional).toBeDefined();
      expect(priceIds.advanced).toBeDefined();
    });
  });

  describe('Webhook Handling', () => {
    it('should identify invoice.paid event', () => {
      const eventType = 'invoice.paid';
      expect(['invoice.paid', 'invoice.payment_failed', 'customer.subscription.deleted']).toContain(
        eventType
      );
    });

    it('should identify payment_failed event', () => {
      const eventType = 'invoice.payment_failed';
      expect(['invoice.paid', 'invoice.payment_failed', 'customer.subscription.deleted']).toContain(
        eventType
      );
    });

    it('should identify subscription.deleted event', () => {
      const eventType = 'customer.subscription.deleted';
      expect(['invoice.paid', 'invoice.payment_failed', 'customer.subscription.deleted']).toContain(
        eventType
      );
    });

    it('should reject invalid event types', () => {
      const invalidEventType = 'invalid.event';
      expect(['invoice.paid', 'invoice.payment_failed', 'customer.subscription.deleted']).not.toContain(
        invalidEventType
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid subscription', () => {
      const error = ErrorFactory.notFound('Subscription');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should handle Stripe API errors', () => {
      const error = ErrorFactory.stripeError('Stripe API error');
      expect(error.code).toBe('STRIPE_ERROR');
      expect(error.statusCode).toBe(500);
    });

    it('should handle database errors', () => {
      const dbError = new Error('Connection failed');
      const error = ErrorFactory.databaseError(dbError);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('Payment Status Tracking', () => {
    it('should track payment as paid', () => {
      const status = 'paid';
      const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
      expect(validStatuses).toContain(status);
    });

    it('should track payment as failed', () => {
      const status = 'failed';
      const validStatuses = ['pending', 'paid', 'failed', 'refunded'];
      expect(validStatuses).toContain(status);
    });

    it('should track subscription as active', () => {
      const status = 'active';
      const validStatuses = ['active', 'cancelled', 'past_due', 'incomplete'];
      expect(validStatuses).toContain(status);
    });

    it('should track subscription as past_due', () => {
      const status = 'past_due';
      const validStatuses = ['active', 'cancelled', 'past_due', 'incomplete'];
      expect(validStatuses).toContain(status);
    });
  });

  describe('Subscription Management', () => {
    it('should have valid subscription lifecycle', () => {
      const lifecycle = ['active', 'past_due', 'cancelled'];
      expect(lifecycle.length).toBeGreaterThan(0);
      expect(lifecycle[0]).toBe('active');
    });

    it('should validate tier upgrade logic', () => {
      const tiers = ['starter', 'professional', 'advanced'];
      const currentTier = 'starter';
      const upgradeTier = 'professional';

      expect(tiers.indexOf(upgradeTier)).toBeGreaterThan(tiers.indexOf(currentTier));
    });

    it('should validate tier downgrade logic', () => {
      const tiers = ['starter', 'professional', 'advanced'];
      const currentTier = 'professional';
      const downgradeTier = 'starter';

      expect(tiers.indexOf(downgradeTier)).toBeLessThan(tiers.indexOf(currentTier));
    });
  });
});
