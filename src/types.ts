/** Structural Money type — compatible with @verevoir/commerce Money. */
export interface Money {
  readonly amount: number;
  readonly currency: string;
}

/** A plan that maps to a Stripe Price. */
export interface PlanMapping {
  readonly planId: string;
  readonly stripePriceId: string;
}

/** Checkout session configuration. */
export interface CheckoutOptions {
  /** Stripe customer ID. Created automatically if not provided. */
  readonly customerId?: string;
  /** Customer email — used if creating a new Stripe customer. */
  readonly customerEmail?: string;
  /** Stripe Price ID to subscribe to. */
  readonly priceId: string;
  /** URL to redirect on success. */
  readonly successUrl: string;
  /** URL to redirect on cancel. */
  readonly cancelUrl: string;
  /** Optional metadata to attach to the Stripe session. */
  readonly metadata?: Record<string, string>;
}

/** Result of creating a checkout session. */
export interface CheckoutSession {
  readonly sessionId: string;
  readonly url: string;
}

/** Billing portal configuration. */
export interface PortalOptions {
  readonly customerId: string;
  readonly returnUrl: string;
}

/** Result of creating a billing portal session. */
export interface PortalSession {
  readonly url: string;
}

/** Parsed webhook event — the subset of Stripe events we handle. */
export type WebhookEvent =
  | {
      type: 'checkout.session.completed';
      customerId: string;
      subscriptionId: string;
      metadata: Record<string, string>;
    }
  | {
      type: 'customer.subscription.updated';
      subscriptionId: string;
      status: string;
      currentPeriodStart: number;
      currentPeriodEnd: number;
      priceId: string;
      cancelAtPeriodEnd: boolean;
    }
  | { type: 'customer.subscription.deleted'; subscriptionId: string }
  | {
      type: 'invoice.payment_failed';
      subscriptionId: string;
      customerId: string;
    }
  | { type: 'unknown'; rawType: string };

/** The adapter interface — everything a consumer needs from Stripe. */
export interface StripeAdapter {
  createCheckoutSession(options: CheckoutOptions): Promise<CheckoutSession>;
  createPortalSession(options: PortalOptions): Promise<PortalSession>;
  createCustomer(
    email: string,
    metadata?: Record<string, string>,
  ): Promise<string>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  parseWebhookEvent(payload: string | Buffer, signature: string): WebhookEvent;
}
