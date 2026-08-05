# @verevoir/stripe

Stripe payment adapter — checkout sessions, subscription management, webhook handling, and billing portal.

Part of [Verevoir](https://verevoir.io) — a database-agnostic application platform.

## Install

```bash
npm install @verevoir/stripe stripe
```

Requires `stripe` as a peer dependency (^17.0.0 || ^18.0.0).

## Quick Start

```typescript
import Stripe from 'stripe';
import { createStripeAdapter } from '@verevoir/stripe';

const stripe = new Stripe('sk_test_...');
const adapter = createStripeAdapter({
  client: stripe,
  webhookSecret: 'whsec_...',
});

// Create a checkout session
const session = await adapter.createCheckoutSession({
  priceId: 'price_pro_monthly',
  customerEmail: 'alice@example.com',
  successUrl: 'https://app.com/success',
  cancelUrl: 'https://app.com/cancel',
});
// Redirect to session.url

// Handle webhooks
const event = adapter.parseWebhookEvent(body, signature);
if (event.type === 'customer.subscription.updated') {
  // Sync subscription state
}
```

## API

### Adapter

| Method                                  | Description                                       |
| --------------------------------------- | ------------------------------------------------- |
| `createCheckoutSession(options)`        | Create a Stripe Checkout session for subscription |
| `createPortalSession(options)`          | Create a Stripe Billing Portal session            |
| `createCustomer(email, metadata?)`      | Create a Stripe customer                          |
| `cancelSubscription(subscriptionId)`    | Cancel a subscription                             |
| `listInvoices(customerId)`              | List paid invoices for a customer                 |
| `parseWebhookEvent(payload, signature)` | Parse and verify a webhook event                  |
| `retrieveSubscription(subscriptionId)`  | Fetch canonical subscription state from Stripe    |

Use `retrieveSubscription` on `checkout.session.completed` to get the real
period boundaries. Fabricating them locally (`now + 30 days`) drifts from
Stripe the moment a period is prorated, a payment retries, or a plan changes.

### Webhook Events

| Event Type                      | Fields                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `checkout.session.completed`    | `customerId`, `subscriptionId`, `metadata`                                                           |
| `customer.subscription.updated` | `subscriptionId`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `priceId`, `cancelAtPeriodEnd` |
| `customer.subscription.deleted` | `subscriptionId`                                                                                     |
| `invoice.payment_failed`        | `subscriptionId`, `customerId`                                                                       |
| `unknown`                       | `rawType`                                                                                            |

Every parsed event also carries `id` (the Stripe `evt_...` id) and
`createdAt` (unix seconds).

### Webhook Idempotency

Stripe delivers at least once — it retries on any non-2xx response and on
timeouts. Without dedupe, one event can run your handler several times and
corrupt state. Pass `idempotency` hooks to skip events already seen:

```typescript
const handler = createWebhookHandler({
  adapter,
  idempotency: {
    isEventProcessed: (id) => db.webhookEvents.exists(id),
    markEventProcessed: (id) => db.webhookEvents.insert(id),
  },
  onCheckoutCompleted: async (event) => {
    /* ... */
  },
});
```

Back it with a durable store keyed by event id with a unique constraint —
it has to survive restarts and work across instances. Both hooks are
required; supplying only one disables dedupe. If the dedupe store throws,
the event is processed anyway: processing twice beats dropping a billing
event.

## Design

- Consumer owns the Stripe client — adapter does not manage API keys
- Stripe is source of truth for subscription state
- Focused on subscription billing (not one-off payments)

## Where it sits

- **[@verevoir/commerce](https://www.npmjs.com/package/@verevoir/commerce)** — abstract e-commerce model (products, baskets, orders, subscriptions). This adapter implements the payment side for Stripe.
- **[@verevoir/accounts](https://www.npmjs.com/package/@verevoir/accounts)** — the tenancy boundary. Put `accountId` in your Stripe metadata so webhooks resolve back to the right tenant.

Used in production by [Slinqi](https://slinqi.io) for PRO-tier subscriptions.

## Docs

- [Verevoir packages](https://verevoir.io/packages)
- [Commerce guide](https://verevoir.io/docs/commerce)

## License

MIT
