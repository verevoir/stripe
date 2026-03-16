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

| Method | Description |
|--------|-------------|
| `createCheckoutSession(options)` | Create a Stripe Checkout session for subscription |
| `createPortalSession(options)` | Create a Stripe Billing Portal session |
| `createCustomer(email, metadata?)` | Create a Stripe customer |
| `cancelSubscription(subscriptionId)` | Cancel a subscription |
| `parseWebhookEvent(payload, signature)` | Parse and verify a webhook event |

### Webhook Events

| Event Type | Fields |
|-----------|--------|
| `checkout.session.completed` | `customerId`, `subscriptionId`, `metadata` |
| `customer.subscription.updated` | `subscriptionId`, `status`, `currentPeriodStart`, `currentPeriodEnd`, `priceId`, `cancelAtPeriodEnd` |
| `customer.subscription.deleted` | `subscriptionId` |
| `invoice.payment_failed` | `subscriptionId`, `customerId` |
| `unknown` | `rawType` |

## Design

- Consumer owns the Stripe client — adapter does not manage API keys
- Stripe is source of truth for subscription state
- Focused on subscription billing (not one-off payments)

## Documentation

- [Verevoir Packages](https://verevoir.io/packages)
- [Commerce Guide](https://verevoir.io/docs/commerce)

## Development

```bash
make build   # Compile TypeScript
make test    # Run test suite
make lint    # Lint and check formatting
```

## License

MIT
