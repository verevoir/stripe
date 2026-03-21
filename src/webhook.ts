import type { StripeAdapter, WebhookHandlerOptions } from './types.js';

/**
 * Create a webhook route handler for Stripe events.
 *
 * Returns a standard Request → Response function compatible with
 * Next.js App Router, Deno, Cloudflare Workers, and any framework
 * that uses the Web Request/Response API.
 *
 * Usage in Next.js:
 *   export const POST = createWebhookHandler({ adapter, onCheckoutCompleted, ... });
 */
export function createWebhookHandler(
  options: WebhookHandlerOptions,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.text();

    const adapter: StripeAdapter =
      typeof options.adapter === 'function'
        ? await options.adapter()
        : options.adapter;

    let event;
    try {
      event = adapter.parseWebhookEvent(body, signature);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await options.onCheckoutCompleted?.(event);
        break;
      case 'customer.subscription.updated':
        await options.onSubscriptionUpdated?.(event);
        break;
      case 'customer.subscription.deleted':
        await options.onSubscriptionDeleted?.(event);
        break;
      case 'invoice.payment_failed':
        await options.onPaymentFailed?.(event);
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
