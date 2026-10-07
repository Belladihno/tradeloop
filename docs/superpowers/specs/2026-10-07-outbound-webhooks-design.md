# Phase 13 Design: Outbound Webhooks to Sellers

Date: 2026-10-07
Status: approved in chat, pending spec review

## Outcome

Sellers receive signed HTTP callbacks for key marketplace events. Delivery
is durable (persisted rows, queued jobs, retries) and observable (per-delivery
status, admin retry for dead letters).

## Non-goals

- Seller-chosen topics and multi-endpoint subscriptions. Fixed event set only;
  the machinery supports subscriptions later without redesign.
- A public webhook-send endpoint. Deliveries are system-triggered only.

## Architecture and components

- `webhook_deliveries` table: id, seller id (FK users), event type, payload
  JSON, target URL, status (`PENDING`, `DELIVERED`, `FAILED`), attempt count,
  last error, timestamps. Index on (seller, status) and status for dead-letter
  listing.
- `WebhookDeliveryService`
  - `dispatch(eventType, sellerId, payload)`: loads the seller's webhook
    URL/secret from the seller profile; sellers without a URL get nothing
    (no row, no job, no error). Writes a `PENDING` row, enqueues a `deliver`
    job on the pre-registered `webhooks` queue.
  - `deliver(deliveryId)`: re-entry on non-`PENDING` rows is a duplicate
    no-op. Signs `{ event, data, timestamp, deliveryId }` with HMAC-SHA256
    into `x-tradeloop-signature`, POSTs with a 10s timeout. 2xx marks
    `DELIVERED`; anything else throws for BullMQ retry with the attempt
    count persisted; exhaustion marks `FAILED` with the last error.
  - `retryDelivery(deliveryId, adminId)`: `FAILED` rows only; resets to
    `PENDING` and enqueues a fresh job.
- Seller profile gains nullable `webhookUrl` and encrypted `webhookSecret`
  (EncryptionService, same as bank account numbers). Set at onboarding or
  profile update; validation: HTTPS URL, secret min 16 chars.
- Fixed event set v1: `order.created`, `order.paid`, `order.shipped`,
  `order.delivered`, `payout.completed`, emitted from the owning services.
- `PATCH /admin/webhook-deliveries/:id/retry` (ADMIN only).

## Data flow and error handling

Domain event -> `dispatch()` -> `PENDING` row -> queued job -> signed POST.
Non-2xx, timeouts, and DNS failures throw into exponential backoff (5
attempts, pre-registered queue policy); the 5th failure records `FAILED`.
Each delivery carries a unique `deliveryId` for seller-side dedupe. One
seller's dead endpoint never blocks others (per-delivery jobs, concurrency
5). Webhook secrets encrypted at rest.

## Testing

- Unit: HMAC signing (valid, forged, missing secret); retry state machine
  (attempt counting, `FAILED` after exhaustion, duplicate-safe re-entry).
- Integration: delivery success against a stub endpoint; failure with retry
  ending in dead letter; admin retry flips `FAILED` back through; producer
  wiring asserts rows and jobs on order and payout flows.

## Self-review

- No placeholders; all behaviors specified.
- Consistent: fixed events everywhere, no subscription concepts leak in.
- Scoped to one implementation plan: one module, one table, one endpoint
  trio (dispatch is internal), one admin endpoint.
- `order.paid` means funding confirmed (webhook charge.success processed),
  not order creation; stated here to remove ambiguity.
