import { describe, it, expect, vi } from 'vitest';
import { createStripeAdapter } from '../src/adapter.js';
import type { CreateStripeAdapterOptions } from '../src/adapter.js';

/** Build a minimal mock Stripe client. */
function createMockClient() {
  return {
    checkout: {
      sessions: {
        create: vi.fn(),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
    customers: {
      create: vi.fn(),
    },
    subscriptions: {
      cancel: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn(),
    },
  };
}

function setup() {
  const client = createMockClient();
  const adapter = createStripeAdapter({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: client as any,
    webhookSecret: 'whsec_test',
  } as CreateStripeAdapterOptions);
  return { client, adapter };
}

describe('createStripeAdapter', () => {
  describe('createCheckoutSession', () => {
    it('creates a subscription checkout session', async () => {
      const { client, adapter } = setup();
      client.checkout.sessions.create.mockResolvedValue({
        id: 'cs_123',
        url: 'https://checkout.stripe.com/cs_123',
      });

      const session = await adapter.createCheckoutSession({
        priceId: 'price_pro',
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
        customerEmail: 'alice@example.com',
      });

      expect(session.sessionId).toBe('cs_123');
      expect(session.url).toBe('https://checkout.stripe.com/cs_123');
      expect(client.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          line_items: [{ price: 'price_pro', quantity: 1 }],
          customer_email: 'alice@example.com',
        }),
      );
    });

    it('uses customerId when provided', async () => {
      const { client, adapter } = setup();
      client.checkout.sessions.create.mockResolvedValue({
        id: 'cs_456',
        url: 'https://checkout.stripe.com/cs_456',
      });

      await adapter.createCheckoutSession({
        priceId: 'price_brand',
        customerId: 'cus_existing',
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
      });

      expect(client.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing' }),
      );
    });

    it('passes metadata through', async () => {
      const { client, adapter } = setup();
      client.checkout.sessions.create.mockResolvedValue({
        id: 'cs_789',
        url: 'https://checkout.stripe.com/cs_789',
      });

      await adapter.createCheckoutSession({
        priceId: 'price_pro',
        successUrl: 'https://app.com/success',
        cancelUrl: 'https://app.com/cancel',
        metadata: { accountId: 'acc_123' },
      });

      expect(client.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { accountId: 'acc_123' } }),
      );
    });
  });

  describe('createPortalSession', () => {
    it('creates a billing portal session', async () => {
      const { client, adapter } = setup();
      client.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/session/xyz',
      });

      const session = await adapter.createPortalSession({
        customerId: 'cus_123',
        returnUrl: 'https://app.com/settings',
      });

      expect(session.url).toBe('https://billing.stripe.com/session/xyz');
      expect(client.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: 'https://app.com/settings',
      });
    });
  });

  describe('createCustomer', () => {
    it('creates a Stripe customer and returns the ID', async () => {
      const { client, adapter } = setup();
      client.customers.create.mockResolvedValue({ id: 'cus_new' });

      const id = await adapter.createCustomer('alice@example.com');
      expect(id).toBe('cus_new');
    });

    it('passes metadata when provided', async () => {
      const { client, adapter } = setup();
      client.customers.create.mockResolvedValue({ id: 'cus_meta' });

      await adapter.createCustomer('bob@example.com', { accountId: 'acc_1' });
      expect(client.customers.create).toHaveBeenCalledWith({
        email: 'bob@example.com',
        metadata: { accountId: 'acc_1' },
      });
    });
  });

  describe('cancelSubscription', () => {
    it('cancels a subscription', async () => {
      const { client, adapter } = setup();
      client.subscriptions.cancel.mockResolvedValue({});

      await adapter.cancelSubscription('sub_123');
      expect(client.subscriptions.cancel).toHaveBeenCalledWith('sub_123');
    });
  });

  describe('parseWebhookEvent', () => {
    it('parses checkout.session.completed', () => {
      const { client, adapter } = setup();
      client.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_123',
            subscription: 'sub_456',
            metadata: { accountId: 'acc_789' },
          },
        },
      });

      const event = adapter.parseWebhookEvent('payload', 'sig');
      expect(event).toEqual({
        type: 'checkout.session.completed',
        customerId: 'cus_123',
        subscriptionId: 'sub_456',
        metadata: { accountId: 'acc_789' },
      });
    });

    it('parses customer.subscription.updated', () => {
      const { client, adapter } = setup();
      client.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_123',
            status: 'active',
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  current_period_start: 1700000000,
                  current_period_end: 1702592000,
                  price: { id: 'price_pro' },
                },
              ],
            },
          },
        },
      });

      const event = adapter.parseWebhookEvent('payload', 'sig');
      expect(event).toEqual({
        type: 'customer.subscription.updated',
        subscriptionId: 'sub_123',
        status: 'active',
        currentPeriodStart: 1700000000,
        currentPeriodEnd: 1702592000,
        priceId: 'price_pro',
        cancelAtPeriodEnd: false,
      });
    });

    it('parses customer.subscription.deleted', () => {
      const { client, adapter } = setup();
      client.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_dead' } },
      });

      const event = adapter.parseWebhookEvent('payload', 'sig');
      expect(event).toEqual({
        type: 'customer.subscription.deleted',
        subscriptionId: 'sub_dead',
      });
    });

    it('parses invoice.payment_failed', () => {
      const { client, adapter } = setup();
      client.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: 'cus_123',
            parent: {
              subscription_details: {
                subscription: 'sub_123',
              },
            },
          },
        },
      });

      const event = adapter.parseWebhookEvent('payload', 'sig');
      expect(event).toEqual({
        type: 'invoice.payment_failed',
        subscriptionId: 'sub_123',
        customerId: 'cus_123',
      });
    });

    it('returns unknown for unhandled event types', () => {
      const { client, adapter } = setup();
      client.webhooks.constructEvent.mockReturnValue({
        type: 'payment_intent.succeeded',
        data: { object: {} },
      });

      const event = adapter.parseWebhookEvent('payload', 'sig');
      expect(event).toEqual({
        type: 'unknown',
        rawType: 'payment_intent.succeeded',
      });
    });
  });
});
