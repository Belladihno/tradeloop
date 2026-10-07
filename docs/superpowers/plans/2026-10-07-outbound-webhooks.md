# Outbound Webhooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver signed HTTP callbacks to sellers for fixed marketplace events with queued retries and admin dead-letter retry.

**Architecture:** New `webhooks/outbound` domain (entity, service, processor) reusing the pre-registered `webhooks` BullMQ queue; sellers carry an optional URL plus encrypted secret on their profile; producers emit fixed events from existing services.

**Tech Stack:** NestJS, TypeORM Postgres, BullMQ, HMAC-SHA256, vitest.

**Spec:** `docs/superpowers/specs/2026-10-07-outbound-webhooks-design.md`

## Global Constraints

- UUIDv7 for all entity IDs, generated app-side.
- API package stays CommonJS; no `type: module` additions.
- No unnecessary comments; keep only safety-critical ones.
- Conventional commits; no push without explicit consent.
- Integration specs use the TEST_PG_URL hatch, live-env ConfigService mock, `{}` processor overrides, real Redis client, full migration sets, fresh database per file.

## Review Focus

- Seller URL unreachable (DNS/timeout) -> delivery retries then FAILED with last error; pinned in Task 5.
- Non-2xx from seller endpoint -> same retry path, not marked delivered; pinned in Task 5.
- Duplicate redelivery after admin retry -> seller dedupes on deliveryId, processor no-ops non-PENDING rows; pinned in Task 3.
- Event for a seller with no URL configured -> no row, no job, no error; pinned in Task 3.
- Timestamp skew on seller side -> timestamp included in signed payload so sellers can enforce their own freshness window; pinned in Task 3 signing test.

---

### Task 1: Event contracts and seller webhook fields

**Files:**
- Create: `packages/types/src/outbound-webhook.ts`
- Modify: `packages/types/src/index.ts`
- Create: `apps/api/src/migrations/1760600000000-SellerWebhooks.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `WebhookEventType` union (`order.created | order.paid | order.shipped | order.delivered | payout.completed`), `WebhookDeliveryStatus` enum (`PENDING | DELIVERED | FAILED`), `OutboundWebhookPayload` interface (`event`, `data: Record<string, unknown>`, `timestamp: string`, `deliveryId: string`).

- [ ] **Step 1: Write the failing test** — none (types only); verify with build instead.
- [ ] **Step 2: Add the types and migration** — `webhookUrl varchar(500) NULL` and `webhookSecret varchar(500) NULL` on `seller_profiles`, with down migration dropping both columns.
- [ ] **Step 3: Run build to verify it passes**

Run: `pnpm build`
Expected: 5 successful.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/outbound-webhook.ts packages/types/src/index.ts apps/api/src/migrations/1760600000000-SellerWebhooks.ts
git commit -m "feat(webhooks): outbound event contracts and seller webhook fields"
```

### Task 2: Delivery entity and repository

**Files:**
- Create: `apps/api/src/webhooks/outbound/entities/webhook-delivery.entity.ts`
- Create: `apps/api/src/webhooks/outbound/webhook-deliveries.repository.ts`
- Create: `apps/api/src/migrations/1760600000001-WebhookDeliveries.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `WebhookDelivery` entity; `WebhookDeliveriesRepository` with `create(data, runner?)`, `findById(id)`, `findFailed(limit)`, `save(delivery, runner?)`.

- [ ] **Step 1: Write the failing test** — repository covered indirectly by Task 6 integration; no unit test (mirrors `DisputesRepository` precedent).
- [ ] **Step 2: Implement entity and repository** — columns: `sellerId uuid FK users`, `eventType varchar(50)`, `payload jsonb`, `targetUrl varchar(500)`, `status` enum default `PENDING`, `attempts int default 0`, `lastError text NULL`, plus base columns. Indexes on `(seller_id, status)` and `status WHERE PENDING`.
- [ ] **Step 3: Run build to verify it passes**

Run: `pnpm build`
Expected: 5 successful.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/webhooks/outbound/entities apps/api/src/webhooks/outbound/webhook-deliveries.repository.ts apps/api/src/migrations/1760600000001-WebhookDeliveries.ts
git commit -m "feat(webhooks): delivery entity, repository, and migration"
```

### Task 3: Delivery service with signing

**Files:**
- Create: `apps/api/src/webhooks/outbound/webhook-delivery.service.ts`
- Test: `apps/api/src/webhooks/outbound/webhook-delivery.service.spec.ts`

**Interfaces:**
- Consumes: Task 2 repository; `SellerProfilesRepository` (existing `findByUserId`); `EncryptionService.decrypt`; `@InjectQueue("webhooks") Queue`.
- Produces: `dispatch(eventType, sellerId, payload: Record<string, unknown>)`, `deliver(deliveryId) -> "delivered" | "duplicate"`, `retryDelivery(deliveryId)`, `signPayload(secret, payload: OutboundWebhookPayload) -> { signature, body }`.

- [ ] **Step 1: Write the failing tests**

```ts
it("signs payloads verifiably", ...) // sign then recompute HMAC-SHA256 hex over `${timestamp}.${deliveryId}.${JSON.stringify(data)}`; equal. Forged signature fails timing-safe compare.
it("skips sellers with no webhook URL", ...) // dispatch returns null; repository.create not called; queue.add not called.
it("dedupes re-entry on non-pending rows", ...) // deliver() on DELIVERED row returns "duplicate" without POST.
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tradeloop/api exec vitest run src/webhooks/outbound/webhook-delivery.service.spec.ts`
Expected: FAIL, service file missing.

- [ ] **Step 3: Implement the service** — signed body is the canonical JSON of `{ event, data, timestamp, deliveryId }`; header `x-tradeloop-signature`; 10s fetch timeout; 2xx marks `DELIVERED`; else increment attempts, persist last error, throw for BullMQ retry; attempts >= 5 marks `FAILED`. `retryDelivery` throws NotFound on missing, Conflict unless `FAILED`; resets to `PENDING`, attempts 0, enqueues fresh job.
- [ ] **Step 4: Run tests to verify they pass**

Run: same command.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/webhooks/outbound/webhook-delivery.service.ts apps/api/src/webhooks/outbound/webhook-delivery.service.spec.ts
git commit -m "feat(webhooks): signed delivery service with retry state machine"
```

### Task 4: Processor, module, and admin retry endpoint

**Files:**
- Create: `apps/api/src/webhooks/outbound/webhook-delivery.processor.ts`
- Create: `apps/api/src/webhooks/outbound/outbound-webhooks.module.ts`
- Modify: `apps/api/src/app.module.ts` (import module)
- Modify: `apps/api/src/admin/admin.controller.ts` (PATCH `webhook-deliveries/:id/retry`)
- Modify: `apps/api/src/admin/admin.module.ts` (import module)

**Interfaces:**
- Consumes: Task 3 service (`deliver`, `retryDelivery`).
- Produces: `@Processor("webhooks", { concurrency: 5 })` handling `{ deliveryId }` jobs; admin endpoint returning the reset delivery.

- [ ] **Step 1: Write the failing test** — covered by Task 6 integration (retry endpoint exercised over HTTP); processor is a 3-line delegate like existing processors.
- [ ] **Step 2: Implement processor, module, admin wiring** — processor delegates to `deliver()`; admin route takes `@Param("id", ParseUUIDPipe)`, `@CurrentUser()` unused except role guard already on controller.
- [ ] **Step 3: Run build to verify it passes**

Run: `pnpm build`
Expected: 5 successful.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/webhooks/outbound/webhook-delivery.processor.ts apps/api/src/webhooks/outbound/outbound-webhooks.module.ts apps/api/src/app.module.ts apps/api/src/admin/admin.controller.ts apps/api/src/admin/admin.module.ts
git commit -m "feat(webhooks): delivery processor, module wiring, and admin retry"
```

### Task 5: Seller webhook configuration at onboarding

**Files:**
- Modify: `packages/validators/src/seller.ts` (optional `webhookUrl`, `webhookSecret` on onboard schema)
- Modify: `apps/api/src/seller-profiles/seller-profiles.service.ts` (persist + encrypt on onboard)
- Test: extend `apps/api/src/seller-profiles/seller-profiles.integration.spec.ts` (onboard with URL stores it; secret stored encrypted)

**Interfaces:**
- Consumes: Task 1 migration columns; `EncryptionService.encrypt`.
- Produces: onboard accepts and persists webhook fields; validation HTTPS URL and secret min 16 chars.

- [ ] **Step 1: Write the failing test** — onboard with `webhookUrl: "https://seller.test/hooks"` and secret; expect response to omit the secret and DB row to hold an encrypted (colon-separated) value.
- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tradeloop/api exec vitest run src/seller-profiles/seller-profiles.integration.spec.ts`
Expected: FAIL on unknown field / missing persistence.

- [ ] **Step 3: Implement** — extend schema and onboard persistence only; no new endpoint.
- [ ] **Step 4: Run test to verify it passes**

Run: same command.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/validators/src/seller.ts apps/api/src/seller-profiles/seller-profiles.service.ts apps/api/src/seller-profiles/seller-profiles.integration.spec.ts
git commit -m "feat(webhooks): seller webhook URL and secret at onboarding"
```

### Task 6: Order event producers

**Files:**
- Modify: `apps/api/src/orders/orders.service.ts` (emit on create + ship + deliver)
- Modify: `apps/api/src/webhooks/webhook-handler.service.ts` (emit `order.paid` on charge.success processed)
- Modify: `apps/api/src/orders/orders.module.ts` (import outbound module)

**Interfaces:**
- Consumes: Task 3 `dispatch(eventType, sellerId, payload)`.
- Produces: rows + jobs for the four order events with `{ orderId }` payloads (plus amount on paid).

- [ ] **Step 1: Write the failing test** — extend `apps/api/src/orders/orders.integration.spec.ts`: after checkout/ship/deliver flows, assert delivery rows exist for the seller with the right event types. Fund flow asserts an `order.paid` row after the funding webhook.
- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @tradeloop/api exec vitest run src/orders/orders.integration.spec.ts`
Expected: FAIL, no rows.

- [ ] **Step 3: Implement** — call `dispatch()` after the state transitions commit (never inside the money transaction); failures to dispatch must not fail the order flow (dispatch after commit, let queue retries handle the rest).
- [ ] **Step 4: Run test to verify it passes**

Run: same command.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/orders/orders.service.ts apps/api/src/webhooks/webhook-handler.service.ts apps/api/src/orders/orders.module.ts apps/api/src/orders/orders.integration.spec.ts
git commit -m "feat(webhooks): emit order lifecycle events"
```

### Task 7: Payout producer and integration suite

**Files:**
- Modify: `apps/api/src/payouts/payouts.service.ts` (emit `payout.completed` after commit)
- Modify: `apps/api/src/payouts/payouts.module.ts` (import outbound module)
- Create: `apps/api/src/webhooks/outbound/webhook-delivery.integration.spec.ts`

**Interfaces:**
- Consumes: Tasks 3-4 (service, queue fake, processor override).
- Produces: `payout.completed` rows on completed payouts; integration proof of success, retry-to-dead-letter, admin retry, and producer rows.

- [ ] **Step 1: Write the failing tests**

```ts
it("delivers to a stub endpoint and marks DELIVERED", ...) // stub seller URL as local HTTP stub? No inbound server in tests: point dispatch at an unroutable URL for failure, and assert success path via a tiny node http server on 127.0.0.1 in the spec.
it("retries failures into FAILED dead letters", ...) // unroutable URL; drive processor deliver() until attempts exhaust; expect FAILED with lastError.
it("admin retry flips FAILED back through", ...) // PATCH endpoint; expect PENDING then DELIVERED against the stub server.
it("emits payout.completed rows", ...) // approved seller with URL, request + approve + process; expect the row.
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @tradeloop/api exec vitest run src/webhooks/outbound/webhook-delivery.integration.spec.ts`
Expected: FAIL, files missing.

- [ ] **Step 3: Implement producer call plus the spec harness** (harness from Global Constraints; stub HTTP server bound to 127.0.0.1 ephemeral port, closed in afterAll).
- [ ] **Step 4: Run tests to verify they pass**

Run: same command.
Expected: all pass.

- [ ] **Step 5: Run the full suite and commit**

Run: `pnpm build`, all unit specs, all integration specs per-file with fresh databases.
Expected: everything green.

```bash
git add apps/api/src/payouts/payouts.service.ts apps/api/src/payouts/payouts.module.ts apps/api/src/webhooks/outbound/webhook-delivery.integration.spec.ts
git commit -m "feat(webhooks): payout producer and delivery integration suite"
```
