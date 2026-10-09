# Tradeloop API

NestJS (Fastify) marketplace backend: catalog, cart, orders with wallet escrow,
settlement, disputes, payouts, shipments, notifications, fraud screening, audit
logging, and admin tooling. PostgreSQL + Redis + BullMQ; TypeORM, no
auto-synchronize — schema changes ship as reviewed migrations.

## Quick Start

1. Install dependencies: `pnpm install` (repo root)
2. Start infrastructure: `docker compose up -d` (Postgres on 15432, Redis on 16379)
3. Set up environment: copy the required keys into the root `.env`
   (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` at minimum)
4. Run migrations: `pnpm --filter @tradeloop/api migration:run`
5. Run the dev server: `pnpm --filter @tradeloop/api dev`

API listens on `PORT` (default 3000) under the `api/v1` prefix.
Interactive docs (dev/staging only): `GET /docs`.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm --filter @tradeloop/api dev` | Start dev server with watch |
| `pnpm --filter @tradeloop/api build` | Production build (`nest build`) |
| `pnpm --filter @tradeloop/api start` | Run the built server |
| `pnpm --filter @tradeloop/api test` | Full test suite (unit + integration) |
| `pnpm --filter @tradeloop/api lint` | Typecheck (`tsc --noEmit`) |
| `pnpm --filter @tradeloop/api migration:run` | Apply pending migrations |
| `pnpm --filter @tradeloop/api migration:revert` | Revert the last migration |

## Architecture

- **Layering:** Controller → Service → Repository → DB. Services never run
  queries; repositories own SQL; one service method uses one QueryRunner, and
  state transitions re-check the row count so concurrent workers cannot
  double-apply.
- **Money:** wallet-funded escrow per order. Delivery confirmation releases
  funds to the seller (minus commission); cancellation and dispute rulings
  refund the buyer. Payouts are off-ledger receipts against settled earnings.
- **Async work:** BullMQ queues for settlement, disputes, payouts, webhook
  delivery, and notifications. Queue dashboard at `/queues` when docs are
  enabled.
- **Cross-cutting:** JWT auth with role guards, Zod request validation,
  Redis-backed global rate limiting (stricter tiers on auth and writes),
  request IDs, success/error envelopes, audit rows on state changes, and
  fraud screening that flags but never blocks (except fraudulent payouts,
  which are auto-rejected).
- **Outbound webhooks:** sellers register a URL + secret; order and payout
  events are HMAC-signed with at-least-once retry.

## Key Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | (required) |
| `REDIS_URL` | Redis connection | (required) |
| `JWT_SECRET` | Token signing (min 32 chars) | (required) |
| `NODE_ENV` | `development` / `test` / `production` | `development` |
| `SWAGGER_ENABLED` | Serve `/docs` and `/queues` | `true` (set `false` in production) |
| `PAYMENT_PROVIDER` | `paystack` / `flutterwave` | `paystack` |
| `LOGISTICS_PROVIDER` | `mock` / `sendbox` | `mock` |

## Testing

Integration specs boot the full `AppModule` against a fresh database per file
(testcontainers Postgres, real Redis on 16379) with background processors
overridden. Unit specs cover services with mocked repositories.
