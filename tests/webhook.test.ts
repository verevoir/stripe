import { describe, it, expect, vi } from 'vitest';
import { createWebhookHandler } from '../src/webhook.js';
import type { StripeAdapter, WebhookEvent } from '../src/types.js';

function mockAdapter(event: WebhookEvent): StripeAdapter {
  return {
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    createCustomer: vi.fn(),
    cancelSubscription: vi.fn(),
    listInvoices: vi.fn(),
    parseWebhookEvent: vi.fn(() => event),
    retrieveSubscription: vi.fn(),
  };
}

function signedRequest(body = 'payload'): Request {
  return new Request('https://example.com/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig' },
    body,
  });
}

const checkoutEvent: WebhookEvent = {
  id: 'evt_abc',
  createdAt: 1_700_000_000,
  type: 'checkout.session.completed',
  customerId: 'cus_1',
  subscriptionId: 'sub_1',
  metadata: { accountId: 'acc_1' },
};

describe('createWebhookHandler', () => {
  it('rejects requests missing the stripe-signature header', async () => {
    const handler = createWebhookHandler({
      adapter: mockAdapter(checkoutEvent),
    });
    const response = await handler(
      new Request('https://example.com/webhook', { method: 'POST' }),
    );
    expect(response.status).toBe(400);
  });

  it('invokes the matching handler for parsed events', async () => {
    const onCheckoutCompleted = vi.fn();
    const handler = createWebhookHandler({
      adapter: mockAdapter(checkoutEvent),
      onCheckoutCompleted,
    });
    const response = await handler(signedRequest());
    expect(response.status).toBe(200);
    expect(onCheckoutCompleted).toHaveBeenCalledTimes(1);
    expect(onCheckoutCompleted).toHaveBeenCalledWith(checkoutEvent);
  });

  describe('idempotency', () => {
    it('skips handlers and marks success when the event id has been seen', async () => {
      const onCheckoutCompleted = vi.fn();
      const isEventProcessed = vi.fn(async () => true);
      const markEventProcessed = vi.fn(async () => {});

      const handler = createWebhookHandler({
        adapter: mockAdapter(checkoutEvent),
        idempotency: { isEventProcessed, markEventProcessed },
        onCheckoutCompleted,
      });

      const response = await handler(signedRequest());
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ received: true, deduplicated: true });
      expect(isEventProcessed).toHaveBeenCalledWith('evt_abc');
      expect(onCheckoutCompleted).not.toHaveBeenCalled();
      expect(markEventProcessed).not.toHaveBeenCalled();
    });

    it('processes and marks on first delivery', async () => {
      const onCheckoutCompleted = vi.fn();
      const isEventProcessed = vi.fn(async () => false);
      const markEventProcessed = vi.fn(async () => {});

      const handler = createWebhookHandler({
        adapter: mockAdapter(checkoutEvent),
        idempotency: { isEventProcessed, markEventProcessed },
        onCheckoutCompleted,
      });

      const response = await handler(signedRequest());
      expect(response.status).toBe(200);
      expect(onCheckoutCompleted).toHaveBeenCalledTimes(1);
      expect(markEventProcessed).toHaveBeenCalledWith('evt_abc');
    });

    it('falls through to processing if the dedupe store is down', async () => {
      const onCheckoutCompleted = vi.fn();
      const isEventProcessed = vi.fn(async () => {
        throw new Error('db down');
      });
      const markEventProcessed = vi.fn(async () => {});

      const handler = createWebhookHandler({
        adapter: mockAdapter(checkoutEvent),
        idempotency: { isEventProcessed, markEventProcessed },
        onCheckoutCompleted,
      });

      const response = await handler(signedRequest());
      expect(response.status).toBe(200);
      // Better to process twice than to drop a billing event.
      expect(onCheckoutCompleted).toHaveBeenCalledTimes(1);
    });

    it('swallows markEventProcessed failures (event already handled)', async () => {
      const onCheckoutCompleted = vi.fn();
      const handler = createWebhookHandler({
        adapter: mockAdapter(checkoutEvent),
        idempotency: {
          isEventProcessed: async () => false,
          markEventProcessed: async () => {
            throw new Error('db down');
          },
        },
        onCheckoutCompleted,
      });

      const response = await handler(signedRequest());
      expect(response.status).toBe(200);
      expect(onCheckoutCompleted).toHaveBeenCalledTimes(1);
    });
  });
});
