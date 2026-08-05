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

/**
 * Fields present on every parsed webhook event. Stripe's own `event.id`
 * is surfaced so consumers can dedupe (Stripe retries webhooks on
 * non-2xx / timeouts, so handlers MUST be idempotent against the same
 * event id).
 */
export interface WebhookEventBase {
  /** Stripe event id (`evt_...`). Stable across retries of the same event. */
  readonly id: string;
  /** Unix seconds when Stripe created the event. */
  readonly createdAt: number;
}

/** Parsed webhook event — the subset of Stripe events we handle. */
export type WebhookEvent =
  | (WebhookEventBase & {
      type: 'checkout.session.completed';
      customerId: string;
      subscriptionId: string;
      metadata: Record<string, string>;
    })
  | (WebhookEventBase & {
      type: 'customer.subscription.updated';
      subscriptionId: string;
      status: string;
      currentPeriodStart: number;
      currentPeriodEnd: number;
      priceId: string;
      cancelAtPeriodEnd: boolean;
    })
  | (WebhookEventBase & {
      type: 'customer.subscription.deleted';
      subscriptionId: string;
    })
  | (WebhookEventBase & {
      type: 'invoice.payment_failed';
      subscriptionId: string;
      customerId: string;
    })
  | (WebhookEventBase & { type: 'unknown'; rawType: string });

/**
 * A canonical snapshot of a Stripe Subscription, fetched via
 * `adapter.retrieveSubscription`. The source of truth for period and
 * plan state — fabricated "+30 days" timestamps on webhook receipt are
 * a bug, because Stripe may retry, cancel, or adjust the period.
 */
export interface SubscriptionSnapshot {
  readonly subscriptionId: string;
  readonly customerId: string;
  readonly status: string;
  /** Unix seconds. */
  readonly currentPeriodStart: number;
  /** Unix seconds. */
  readonly currentPeriodEnd: number;
  readonly priceId: string;
  readonly cancelAtPeriodEnd: boolean;
}

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
type EventOfType<T extends WebhookEvent['type']> = Extract<
  WebhookEvent,
  { type: T }
>;

/**
 * Hooks a consumer can plug in to make webhook handling idempotent
 * against Stripe's at-least-once delivery.
 *
 * If `isEventProcessed(eventId)` returns true, the event is skipped
 * before any handler runs. Otherwise the handlers run, and
 * `markEventProcessed(eventId)` is called ONCE they've all succeeded.
 *
 * Implementations are consumer-owned because they need to be durable
 * (survive process restarts and cross-instance) — typically a DB row
 * keyed by event id with a unique constraint.
 *
 * Both hooks are optional. If only one is supplied, the handler behaves
 * as if neither were — idempotency needs both sides.
 */
export interface WebhookIdempotency {
  isEventProcessed(eventId: string): Promise<boolean>;
  markEventProcessed(eventId: string): Promise<void>;
}

/** Configuration for the webhook route handler. */
export interface WebhookHandlerOptions {
  /** The Stripe adapter (or a function that returns one, for lazy init). */
  adapter: StripeAdapter | (() => Promise<StripeAdapter>);
  /**
   * Optional idempotency hooks. Strongly recommended in production —
   * Stripe retries on any non-2xx and on timeouts, so without dedupe a
   * single event can trigger a handler multiple times and corrupt
   * state (e.g. double-billing, period_end flapping).
   */
  idempotency?: WebhookIdempotency;
  /** Called when a checkout session completes. */
  onCheckoutCompleted?: (
    event: EventOfType<'checkout.session.completed'>,
  ) => Promise<void>;
  /** Called when a subscription is updated. */
  onSubscriptionUpdated?: (
    event: EventOfType<'customer.subscription.updated'>,
  ) => Promise<void>;
  /** Called when a subscription is deleted. */
  onSubscriptionDeleted?: (
    event: EventOfType<'customer.subscription.deleted'>,
  ) => Promise<void>;
  /** Called when an invoice payment fails. */
  onPaymentFailed?: (
    event: EventOfType<'invoice.payment_failed'>,
  ) => Promise<void>;
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
  /**
   * Fetch the canonical state of a subscription from Stripe. Use this
   * on `checkout.session.completed` (and any other path where you need
   * the real period boundaries) rather than fabricating "+30 days"
   * locally — Stripe is the source of truth.
   */
  retrieveSubscription(subscriptionId: string): Promise<SubscriptionSnapshot>;
}
