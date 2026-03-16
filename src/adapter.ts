import type Stripe from 'stripe';
import type {
  StripeAdapter,
  CheckoutOptions,
  CheckoutSession,
  PortalOptions,
  PortalSession,
  WebhookEvent,
} from './types.js';

export interface CreateStripeAdapterOptions {
  /** Configured Stripe SDK instance. Consumer creates this with their API key. */
  client: Stripe;
  /** Webhook endpoint secret for signature verification. */
  webhookSecret: string;
}

/**
 * Create a Stripe adapter wrapping the Stripe SDK.
 *
 * The consumer provides a configured Stripe client — this adapter does not
 * manage API keys. It provides the operations needed for subscription billing:
 * checkout, portal, customer management, and webhook parsing.
 */
export function createStripeAdapter(
  options: CreateStripeAdapterOptions,
): StripeAdapter {
  const { client, webhookSecret } = options;

  return {
    async createCheckoutSession(
      opts: CheckoutOptions,
    ): Promise<CheckoutSession> {
      const params: Stripe.Checkout.SessionCreateParams = {
        mode: 'subscription',
        line_items: [{ price: opts.priceId, quantity: 1 }],
        success_url: opts.successUrl,
        cancel_url: opts.cancelUrl,
      };

      if (opts.customerId) {
        params.customer = opts.customerId;
      } else if (opts.customerEmail) {
        params.customer_email = opts.customerEmail;
      }

      if (opts.metadata) {
        params.metadata = opts.metadata;
      }

      const session = await client.checkout.sessions.create(params);
      return {
        sessionId: session.id,
        url: session.url!,
      };
    },

    async createPortalSession(opts: PortalOptions): Promise<PortalSession> {
      const session = await client.billingPortal.sessions.create({
        customer: opts.customerId,
        return_url: opts.returnUrl,
      });
      return { url: session.url };
    },

    async createCustomer(
      email: string,
      metadata?: Record<string, string>,
    ): Promise<string> {
      const customer = await client.customers.create({
        email,
        ...(metadata && { metadata }),
      });
      return customer.id;
    },

    async cancelSubscription(subscriptionId: string): Promise<void> {
      await client.subscriptions.cancel(subscriptionId);
    },

    parseWebhookEvent(
      payload: string | Buffer,
      signature: string,
    ): WebhookEvent {
      const event = client.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          return {
            type: 'checkout.session.completed',
            customerId: session.customer as string,
            subscriptionId: session.subscription as string,
            metadata: (session.metadata as Record<string, string>) ?? {},
          };
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const item = sub.items.data[0];
          return {
            type: 'customer.subscription.updated',
            subscriptionId: sub.id,
            status: sub.status,
            currentPeriodStart: item?.current_period_start ?? 0,
            currentPeriodEnd: item?.current_period_end ?? 0,
            priceId: item?.price?.id ?? '',
            cancelAtPeriodEnd: sub.cancel_at_period_end,
          };
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          return {
            type: 'customer.subscription.deleted',
            subscriptionId: sub.id,
          };
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          const subDetails = invoice.parent?.subscription_details;
          return {
            type: 'invoice.payment_failed',
            subscriptionId: subDetails?.subscription
              ? (typeof subDetails.subscription === 'string'
                  ? subDetails.subscription
                  : subDetails.subscription.id)
              : '',
            customerId: typeof invoice.customer === 'string'
              ? invoice.customer
              : invoice.customer?.id ?? '',
          };
        }

        default:
          return { type: 'unknown', rawType: event.type };
      }
    },
  };
}
