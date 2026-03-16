# Intent — @verevoir/stripe

## Purpose

Provide a focused Stripe payment adapter for subscription billing — checkout, portal, customer management, and webhook handling. Wraps the Stripe SDK into a minimal interface that integrates with @verevoir/commerce and @verevoir/accounts without depending on either.

## Goals

- Create Stripe Checkout sessions for subscription sign-up
- Create Stripe Billing Portal sessions for self-service management
- Create and manage Stripe customers
- Parse and verify webhook events into typed domain events
- Cancel subscriptions

## Non-goals

- One-off payments — the adapter is focused on subscription billing (one-off payments use commerce directly)
- Stripe configuration — the consumer creates and configures the Stripe SDK instance
- Subscription state management — Stripe is the source of truth; the consumer syncs state from webhooks
- Invoice management — the adapter extracts subscription and customer IDs from invoice events but does not manage invoices

## Key design decisions

- **Consumer owns the Stripe client.** The adapter receives a configured Stripe SDK instance. It does not manage API keys, webhook endpoints, or Stripe configuration.
- **Focused webhook parsing.** Handles four subscription-relevant event types (checkout completed, subscription updated, subscription deleted, invoice payment failed). Everything else returns `unknown`.
- **Structural types.** Money, CheckoutOptions, and WebhookEvent are defined locally. No import from @verevoir/commerce — the consumer wires these together.
- **Stripe is source of truth.** The adapter does not maintain local subscription state. Webhook events provide the data; the consumer persists what they need.

## Constraints

- Peer dependency: `stripe` (^17.0.0 || ^18.0.0)
- No dependency on @verevoir/commerce — structural Money type
- No dependency on @verevoir/accounts — consumer wires account ↔ customer mapping
