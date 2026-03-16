# @verevoir/stripe — Stripe Payment Adapter

Stripe checkout, subscription management, webhook handling, and billing portal. Wraps the Stripe SDK with a focused interface for subscription billing.

## What It Does

- **Checkout** — create Stripe Checkout sessions for subscription sign-up
- **Portal** — create Stripe Billing Portal sessions for self-service management
- **Customers** — create and manage Stripe customers
- **Subscriptions** — cancel subscriptions
- **Webhooks** — parse and verify Stripe webhook events into typed domain events

## Design Principles

- **Consumer owns the Stripe client** — adapter receives a configured Stripe SDK instance. Does not manage API keys.
- **Focused webhook parsing** — handles the four subscription-relevant event types, returns `unknown` for everything else.
- **Stripe is source of truth** — subscription state is synced from webhooks, not managed locally.
- **Peer dependency on stripe** — consumer installs and configures the Stripe SDK.

## Quick Example

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
  metadata: { accountId: 'acc_123' },
});
// Redirect to session.url

// Handle webhooks
const event = adapter.parseWebhookEvent(body, signature);
if (event.type === 'customer.subscription.updated') {
  // Sync subscription state
}
```

## Setup

```bash
npm install
```

## Commands

```bash
make build   # Compile TypeScript
make test    # Run test suite
make lint    # Lint and check formatting
make run     # No-op (library)
```

## Architecture

- `src/types.ts` — Core interfaces: StripeAdapter, CheckoutOptions, WebhookEvent, PortalOptions
- `src/adapter.ts` — `createStripeAdapter()` — wraps Stripe SDK into the adapter interface
- `src/index.ts` — Public API exports

## Dependencies

- **Peer dependency**: `stripe` (^17.0.0 || ^18.0.0)
- **No** dependency on `@verevoir/commerce` — uses structural Money type
- **No** dependency on `@verevoir/accounts` — consumer wires these together
