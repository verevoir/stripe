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
  /** Require billing address during checkout. */
  readonly collectBillingAddress?: boolean;
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

/** A paid invoice summary. */
export interface Invoice {
  readonly id: string;
  readonly date: number;
  readonly amount: number;
  readonly currency: string;
  readonly status: string;
  readonly pdfUrl: string | null;
}

/** Extract a specific event type from the WebhookEvent union. */
type EventOfType<T extends WebhookEvent['type']> = Extract<WebhookEvent, { type: T }>;

/** Configuration for the webhook route handler. */
export interface WebhookHandlerOptions {
  /** The Stripe adapter (or a function that returns one, for lazy init). */
  adapter: StripeAdapter | (() => Promise<StripeAdapter>);
  /** Called when a checkout session completes. */
  onCheckoutCompleted?: (event: EventOfType<'checkout.session.completed'>) => Promise<void>;
  /** Called when a subscription is updated. */
  onSubscriptionUpdated?: (event: EventOfType<'customer.subscription.updated'>) => Promise<void>;
  /** Called when a subscription is deleted. */
  onSubscriptionDeleted?: (event: EventOfType<'customer.subscription.deleted'>) => Promise<void>;
  /** Called when an invoice payment fails. */
  onPaymentFailed?: (event: EventOfType<'invoice.payment_failed'>) => Promise<void>;
}

/** The adapter interface — everything a consumer needs from Stripe. */
export interface StripeAdapter {
  createCheckoutSession(options: CheckoutOptions): Promise<CheckoutSession>;
  createPortalSession(options: PortalOptions): Promise<PortalSession>;
  createCustomer(
    email: string,
    metadata?: Record<string, string>,
  ): Promise<string>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  listInvoices(customerId: string): Promise<Invoice[]>;
  parseWebhookEvent(payload: string | Buffer, signature: string): WebhookEvent;
}
