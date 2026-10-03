# Tradeloop — Technical Requirements Document

> This document is the single source of truth for the Tradeloop project. It covers every architectural decision, the reasoning behind each one, the full system design, step-by-step build order, and every frontend and backend concern. No decision in this document was made arbitrarily. Every choice has a stated reason tied to the specific needs of this project.

---

## Table of Contents

1. [Project Background](#1-project-background)
2. [What Tradeloop Is](#2-what-tradeloop-is)
3. [Monorepo Setup](#3-monorepo-setup)
4. [Backend — Technology Decisions](#4-backend--technology-decisions)
5. [Backend — Architecture Decisions](#5-backend--architecture-decisions)
6. [Backend — Module Map](#6-backend--module-map)
7. [Backend — Database Schema](#7-backend--database-schema)
8. [Backend — Complete System Flows](#8-backend--complete-system-flows)
9. [Backend — Background Jobs](#9-backend--background-jobs)
10. [Backend — Request Pipeline](#10-backend--request-pipeline)
11. [Frontend — Technology Decisions](#11-frontend--technology-decisions)
12. [Frontend — Design System](#12-frontend--design-system)
13. [Frontend — Application Structure](#13-frontend--application-structure)
14. [Frontend — State and Data](#14-frontend--state-and-data)
15. [Frontend — Routing Structure](#15-frontend--routing-structure)
16. [Frontend — Error Boundaries and Loading States](#16-frontend--error-boundaries-and-loading-states)
17. [Frontend — Folder Architecture](#17-frontend--folder-architecture)
18. [Step-by-Step Build Order](#18-step-by-step-build-order)
19. [Environment Variables](#19-environment-variables)
20. [Docker and Local Development](#20-docker-and-local-development)
21. [Testing Strategy](#21-testing-strategy)
22. [README and Portfolio Presentation](#22-readme-and-portfolio-presentation)

---

## 1. Project Background

This project exists because of a job application to Jointearn Company Ltd, a Nigerian technology company building an entertainment and social commerce platform where users earn rewards engaging with content and shop on an integrated marketplace. The job description called for an experienced NestJS backend developer with hands-on experience in e-commerce, marketplace, payment, escrow, logistics, and fintech systems.

The problem was that no single existing portfolio project covered the full technical surface area the role demands. The decision was made to build one from scratch — not a generic e-commerce template, but a project that mirrors the exact technical domains in the job description: multi-vendor marketplace, escrow-based payments, wallet systems, seller settlements, disputes, logistics, fraud prevention, and background job processing.

The project is named **Tradeloop**. It is a multi-vendor marketplace backend and frontend built to demonstrate production-grade engineering across every domain the role requires.

The cover letter angle when applying is direct: reference Jointearn's platform model, note that Tradeloop covers the same technical mechanics, and state readiness to enter their existing codebase on day one.

---

## 2. What Tradeloop Is

Tradeloop is a multi-vendor marketplace platform. Buyers browse products from multiple sellers, add to cart, fund their wallet, and place orders. Funds are held in escrow from the moment an order is placed until the buyer confirms delivery. At that point, the platform takes a commission and releases the remainder to the seller's wallet. Sellers can request payouts to their bank accounts. Disputes can be raised by buyers, adjudicated by admins, and resolved in either party's favour with automatic fund movement. The platform supports discount codes, shipping integration, fraud detection, webhook delivery to sellers, and a full audit trail of every financial action.

There are two web applications: a public-facing marketplace for buyers and sellers, and an internal admin dashboard for platform operators.

---

## 3. Monorepo Setup

### Why a monorepo

The project has three applications (API, user web app, admin web app) and four shared packages (UI components, TypeScript types, Zod validation schemas, utility functions). Without a monorepo these applications would either duplicate code or depend on separately published npm packages, creating synchronisation overhead. A monorepo puts everything in one repository, allows packages to reference each other directly without publishing, and enables shared tooling and configuration.

### Package manager — pnpm

pnpm is chosen over npm and yarn for three reasons:
- It uses a content-addressable store with hard links, meaning packages are not duplicated across workspace projects. Disk usage is significantly lower.
- Its workspace protocol (`workspace:*`) makes local package linking explicit and reliable.
- It is faster than npm on cold and warm installs due to its parallel installation model.

### Build orchestration — Turborepo

Turborepo is added on top of pnpm workspaces. pnpm handles package installation and linking. Turborepo handles task orchestration across the workspace.

Without Turborepo, running builds, tests, and dev servers across multiple packages requires manual coordination of order. If `apps/web` depends on `packages/validators`, you must remember to build `packages/validators` first. With Turborepo, a `turbo.json` pipeline definition encodes these dependency relationships. Turborepo reads the dependency graph and executes tasks in the correct order automatically.

Turborepo's most valuable feature for this project is caching. Every task output is hashed against its inputs (source files, environment variables, dependencies). If the inputs have not changed since the last run, Turborepo restores the output from cache instantly without re-executing the task. Changing one file in `apps/api` does not trigger a rebuild of `packages/ui`. Only what actually changed is rebuilt.

Turborepo also runs independent tasks in parallel. `apps/web` and `apps/admin` have no dependency on each other. Turborepo builds them simultaneously without configuration.

The `turbo dev` command starts the entire stack — all packages in watch mode, all apps in dev mode — in the correct order with one command.

### Repository structure

```
tradeloop/
├── apps/
│   ├── api/              NestJS backend
│   ├── web/              Next.js user-facing marketplace
│   └── admin/            React + Vite internal dashboard
├── packages/
│   ├── ui/               Shared component library
│   ├── types/            Shared TypeScript interfaces and types
│   ├── validators/       Shared Zod schemas used by both backend and frontend
│   └── utils/            Shared utility functions and the typed API client
├── turbo.json
├── pnpm-workspace.yaml
├── package.json          Root package — turbo and shared dev tooling only
└── .env.example
```

### Why each shared package exists

**`packages/types`** — TypeScript interfaces for domain entities (User, Order, Product, etc.) are defined once and imported by all three apps. No duplication, no drift between what the backend returns and what the frontend expects.

**`packages/validators`** — Zod schemas are defined once and consumed by both the NestJS backend (via `nestjs-zod` for DTO validation) and the React frontend (via `react-hook-form`'s zod resolver for form validation). A validation rule changed in one place propagates everywhere automatically. This is the highest-value shared package in the monorepo — it eliminates an entire class of frontend/backend validation mismatch bugs.

**`packages/ui`** — Shared component library consumed by both `apps/web` and `apps/admin`. Contains only primitive and composed components that carry no business logic. Domain-aware components (OrderStatusStepper, WalletBalanceCard) live in the app that uses them.

**`packages/utils`** — The typed API client lives here. It is a centralised HTTP client that handles auth headers, token refresh on 401, and typed responses. Both frontend apps import from it. Also contains formatting utilities (currency, dates) and the `cn` class composition utility.

---

## 4. Backend — Technology Decisions

### Framework — NestJS 12 with TypeScript

NestJS is the primary framework. It provides a structured, opinionated architecture built on top of Node.js and Express/Fastify. Its module system, dependency injection, decorators, guards, interceptors, pipes, and filters map naturally to the concerns of a production API. The job description explicitly requires NestJS experience.

TypeScript is non-negotiable. Every file is TypeScript. Strict mode is enabled in `tsconfig.json`.

### HTTP Adapter — `@nestjs/platform-fastify`

NestJS ships with two HTTP adapters: Express (default) and Fastify. The decision is to use Fastify.

Fastify benchmarks at roughly 2-3x Express on raw request throughput due to a more efficient router and lower per-request overhead. For a marketplace API handling concurrent orders, wallet operations, and file uploads, the lower per-request overhead is a real advantage even if load is not yet production scale.

Fastify ships with Pino as its built-in logger. Pino is a structured, high-performance logger that outputs JSON. This replaces the need for a separate winston setup that would have been required with the Express adapter. Structured JSON logs with request IDs are what production logging infrastructure expects.

Fastify does not support Express middleware natively. Any middleware must be Fastify-compatible. File uploads use `@fastify/multipart` instead of multer. Security headers use `@fastify/helmet` instead of the Express equivalent.

### ORM — TypeORM

TypeORM is chosen for standard CRUD operations. Its decorator-based entity definitions align with NestJS's class-based architecture. Relations, migrations, and repository patterns are well-supported.

**Critical rule: TypeORM is used for standard CRUD only.** Any operation involving money movement — escrow holds, wallet debits, commission calculations, payouts — is written as raw SQL using TypeORM's `QueryRunner` for transaction management and `query()` for atomic SQL statements. The reason is explicit control. TypeORM's high-level methods abstract away the exact SQL being executed. When funds are moving between wallets, the developer must know exactly what SQL is running, what locks are being held, and what the failure modes are. TypeORM is not used to hide that.

### Database — PostgreSQL

PostgreSQL is the primary datastore. It is chosen over MySQL for several reasons specific to this project:

- Native `tsvector` and `tsquery` types for full-text search. Product search is implemented using PostgreSQL's built-in full-text search with GIN indexes. No external search service is required.
- Partial unique indexes. Soft-deleted records need to allow re-use of unique fields (email, product slug). PostgreSQL partial unique indexes (`WHERE deleted_at IS NULL`) solve this cleanly. MySQL's support for partial indexes is limited.
- `SELECT ... FOR UPDATE` row-level locking for concurrent financial operations.
- Strong JSON support via `jsonb` for audit log metadata and webhook payloads.
- Mature TypeORM support.

### Cache and Queue Broker — Redis

Redis serves two purposes: caching and queue brokerage.

For caching: product listing results, wallet balances for high-read scenarios, and the access token revocation blocklist (JTI store).

For queuing: BullMQ uses Redis as its broker. All background job queues run through Redis.

Redis is also used for sliding-window velocity tracking in the fraud prevention system. Sorted sets track event timestamps per user within configurable time windows.

### Queue System — BullMQ

BullMQ is the queue library. It is built on Redis and provides job scheduling, delayed jobs, retry with backoff, job prioritisation, and a monitoring interface (Bull Board).

Queues are domain-separated. One queue per domain, not one global queue. The reason is failure isolation, independent scaling, and observability. A failing payout job must not block notification emails. Payout processing needs conservative retries with exponential backoff. Notification delivery can be aggressive with high concurrency. A single queue cannot have different retry strategies per job type. Domain-separated queues can.

The queues are:
- `notifications` — email and in-app notification delivery
- `payouts` — seller payout processing via payment provider
- `disputes` — auto-expiry of unresolved disputes after configured period
- `webhooks` — outbound webhook delivery to seller endpoints with retry
- `settlements` — commission calculation and escrow release at order completion

### Authentication — Passport.js with JWT and Google OAuth strategies

The initial discussion considered using `@nestjs/jwt` with a custom guard and avoiding Passport entirely. This was the right call for a JWT-only setup. However, the decision was made to add Google OAuth sign-in because a modern consumer marketplace is expected to offer it. Google OAuth is a multi-step protocol — redirect to Google, receive authorisation code, exchange for tokens, verify ID token, extract profile, find-or-create user. Passport's `passport-google-oauth20` strategy encapsulates this entire flow. With both JWT and Google OAuth coexisting, Passport's strategy abstraction earns its place.

The two strategies used are:
- `passport-jwt` — verifies Bearer tokens on every protected route
- `passport-google-oauth20` — handles the Google OAuth 2.0 flow

After Google OAuth completes, the platform issues its own JWT pair. Google is only the identity provider for the initial handshake. All subsequent requests use the platform's own tokens. The client never holds Google tokens.

RBAC is handled by a custom `RolesGuard` that reads a `@Roles()` decorator on the route handler and checks the authenticated user's role. This sits on top of Passport and does not involve it.

### Validation — `nestjs-zod`

NestJS's built-in `ValidationPipe` is built around `class-validator` decorators. Zod uses schema objects, not decorators. They are incompatible by default.

`nestjs-zod` provides `createZodDto()` which wraps a Zod schema into a class NestJS can understand. DTOs are defined as Zod schemas and wrapped into classes. `ValidationPipe` works normally. Swagger integration works via `nestjs-zod/openapi`.

The critical advantage: these Zod schemas live in `packages/validators` and are imported by both the NestJS backend (for DTO validation) and the React frontend (for form validation). One schema definition, validated in both places, impossible to drift.

### Sanitization — Two-layer approach

Validation rejects bad input. Sanitization cleans input that passes validation but could still cause harm.

Layer 1 is a global `SanitizePipe` that runs on all string fields: strips leading and trailing whitespace, removes null bytes, and strips HTML tags on fields that do not allow rich text.

Layer 2 uses `sanitize-html` on specific rich text fields (product descriptions, seller bios) where some formatting is allowed. `sanitize-html` takes a configurable allowlist of safe HTML tags. Everything not on the allowlist is stripped. `DOMPurify` was considered and rejected because it is browser-focused and requires a DOM environment. `sanitize-html` is built for Node.

### File Storage — Supabase Storage

Supabase Storage is chosen for product image uploads. The decision was originally Cloudinary but Cloudinary requires credit card input to sign up. Supabase Storage's free tier provides 1GB of storage with CDN delivery and requires no payment method.

The upload flow uses `@fastify/multipart` to process the multipart request in memory (no disk write), then streams directly to the Supabase SDK. The endpoint returns a URL. Product creation accepts a URL, not a file — uploads and resource creation are always separate endpoints.

### Email — Brevo via Nodemailer transport

**Why Brevo:** Brevo's free tier provides 300 emails per day (approximately 9,000 per month) with no expiry and no credit card required. The one limitation is a "Sent with Brevo" footer on outgoing emails on the free tier. For a portfolio project where no real users receive emails, this is irrelevant.

Resend was the initial choice but requires a paid plan to send to multiple recipient addresses. SendGrid's perpetual free tier has been eliminated as of 2025. Zoho ZeptoMail offers 10,000 emails as a one-time credit valid for 6 months — unsuitable for a project under active development for weeks.

Sendlib was investigated. It requires a custom pricing engagement via demo request with no published free tier. Not usable for this project.

**Why Nodemailer as the transport layer:** Nodemailer is not an email service — it is a Node.js SMTP transport library. It sends emails through whatever SMTP server is configured. Using Nodemailer on top of Brevo's SMTP means the `NotificationService` is completely decoupled from Brevo. Switching email providers is a configuration change (new SMTP credentials in environment variables), not a code change. No Brevo SDK is imported anywhere in application code.

### Payment Providers — Paystack and Flutterwave via Strategy Pattern

Two payment providers are integrated: Paystack and Flutterwave.

**Why Paystack as primary:** Paystack is the de facto standard for Nigerian fintech applications. It has first-class NGN support, an excellent sandbox environment with test card numbers (no real card required), clean REST API documentation, and webhook infrastructure. It was acquired by Stripe, which signals technical credibility. Any Nigerian banking or fintech interviewer recognises it immediately.

**Why Flutterwave as secondary:** Flutterwave extends coverage to pan-African payments and supports more currencies. Adding it demonstrates awareness that a marketplace at scale needs multi-provider support.

**Why the Strategy Pattern for payment providers:** Both providers are wrapped behind a common `PaymentProvider` interface. `PaymentService` consumes the interface and never contains provider-specific code. Adding a third provider (Stripe, Monnify) means implementing one new class. Nothing else changes. Provider selection is controlled by an environment variable (`PAYMENT_PROVIDER=paystack` or `PAYMENT_PROVIDER=flutterwave`), injected through NestJS's DI system.

The same strategy pattern is applied to logistics providers.

### Logistics — Pluggable Interface with Mock Provider and Sendbox Implementation

Integrating a real logistics provider like Sendbox or Gigl requires business registration and API approval that cannot be completed during development. The solution is a `LogisticsProvider` interface with two implementations: a `MockLogisticsProvider` for development and testing, and a `SendboxProvider` that contains the correct API structure for production use once credentials are available.

The mock provider returns realistic fake tracking numbers and simulates status progression. The entire order-to-delivery flow works end-to-end in development and tests without real logistics credentials. The Sendbox implementation is activated by setting `LOGISTICS_PROVIDER=sendbox` in the environment.

This approach demonstrates interface-driven design while keeping the development environment fully functional.

### Testing — Vitest with testcontainers

**Why Vitest over Jest:** Vitest is significantly faster than Jest due to its Vite-based architecture and native ESM support. Its API is Jest-compatible, so the migration cost is zero. For a portfolio project, using Vitest signals awareness of the current ecosystem rather than defaulting to Jest by inertia.

NestJS 12's testing utilities work with Vitest. The configuration requires `environment: 'node'` in `vitest.config.ts` and `--pool=forks` to avoid NestJS DI issues in parallel test workers.

**Why `@testcontainers/postgresql` for integration tests:** Integration tests must run against a real PostgreSQL database, not a mocked repository. Mocking TypeORM repositories in integration tests means testing the mock, not the actual SQL behaviour — constraint violations, transaction rollbacks, and concurrent writes cannot be meaningfully tested against mocks. `@testcontainers/postgresql` spins up a real PostgreSQL Docker container per test suite, runs migrations, and tears it down after. Tests run against actual database behaviour.

### API Documentation — Swagger/OpenAPI

Swagger is configured via `@nestjs/swagger` with `nestjs-zod/openapi` for Zod schema integration. Every endpoint is documented. Swagger UI is **disabled in production**. Exposing the full API schema publicly on a production marketplace is an unnecessary attack surface. The environment variable `SWAGGER_ENABLED=true` controls this, defaulting to false.

---

## 5. Backend — Architecture Decisions

### Database Schema Strategy — Single users table with role-specific profile extensions

All user types (buyers, sellers, admins) share one `users` table with a `role` enum column. Role-specific data lives in extension tables: `buyer_profiles` and `seller_profiles`.

**Why not separate tables per user type:** A buyer who becomes a seller would require data migration across tables. Foreign keys from `orders`, `transactions`, and `wallets` would need to reference multiple user tables, making every relation ambiguous. Auth queries always hit one table regardless of role — no joins needed to verify identity.

**Why profile extension tables:** They carry only role-specific data. A seller is still a `user` with all the base fields. `seller_profiles` is created when the seller is approved. `buyer_profiles` can be created on first purchase or profile setup.

### Primary keys — UUIDv7 generated app-side

Every entity ID is a UUIDv7, generated in application code by the `BaseEntity` property initializer (`uuid` v7). The database never generates IDs.

**Why v7 over v4:** v4 is fully random, which scatters B-tree inserts and fragments indexes under write load. v7 carries a millisecond timestamp in its high bits, so inserts arrive roughly time-ordered — better index locality and faster range scans. As a bonus, `ORDER BY id` is chronological order, which is exactly what cursor pagination (`cursor=<lastId>`) assumes.

**Why app-side over a database default:** PostgreSQL 15 has no built-in `uuidv7()` generator. Generating in `BaseEntity` gives one code path for all entities with no extension dependency. The rule for services: persist entity instances (`repository.create()` then `save()`), never raw literals, so the initializer always runs.

### Data access — Controller → Service → Repository → Database

Every module follows four layers with strict ownership:

- **Controllers** translate HTTP only: validate input via DTOs, call one service method, return the result. No business logic, no queries.
- **Services** own business logic and transaction boundaries: they decide what should happen, open `QueryRunner` transactions, and orchestrate repository calls. They never issue queries — no `Repository` injection, no `query()` calls. The only `DataSource` use allowed in a service is creating a `QueryRunner`.
- **Repositories** own all persistence: TypeORM queries for standard CRUD and hand-written SQL for money movement, stock, and usage counters. Transactional methods accept the caller's `QueryRunner` — the exact SQL, the locks it takes, and its failure modes live here and nowhere else.
- **Entities** are the TypeORM-mapped domain objects passed between these layers.

Per-module files follow `<domain>.repository.ts` next to `<domain>.service.ts` (e.g. `users.repository.ts`). The transaction rule this enables: one service method, one `QueryRunner`, many repository calls — single commit or full rollback.

### Escrow Implementation — Ledger-based wallet system

Money is never moved by direct balance mutation. The following is explicitly prohibited:

```
UPDATE wallets SET balance = balance - 500 WHERE userId = buyerId;
```

Direct mutations are not auditable, not reversible, and not safe under concurrent requests.

Every money movement is a `transactions` table record. A transaction has a `fromWalletId`, `toWalletId`, `amount`, `type`, `status`, and `referenceId`. Wallet balance is always the net of all completed transaction credits and debits for that wallet.

**Why ledger over balance columns:**
- Every state is auditable. Any balance at any point in time can be reconstructed from the transaction log.
- Reversals are additive. A reversal is a new transaction record, not a subtraction from a balance column.
- Concurrent requests cannot race on a balance column — the check and mutation happen in one atomic SQL statement.
- Financial regulators and fintech auditors expect double-entry ledger patterns.
- This mirrors how Paystack, Stripe, and real payment systems work internally.

There are four wallet types: `BUYER`, `SELLER`, `PLATFORM`, and `ESCROW`. The platform wallet receives commission entries. The escrow wallet holds buyer funds between order placement and delivery confirmation.

### Refresh Token Storage — Hashed in database, Redis for access token revocation

Refresh tokens are stored hashed (argon2) in a `refreshTokenHash` column on the `users` table. Raw token is returned to the client. On refresh, the client sends the raw token, the backend hashes it and compares.

**Why hash:** If the database is compromised, raw refresh tokens cannot be used directly.

**Why database not Redis-only:** Redis is ephemeral by default. A Redis restart or eviction clears all sessions silently. The database provides persistence. A `refreshTokenHash` column also allows targeted session invalidation per user from an admin panel.

**Why Redis for access token revocation:** Access tokens are short-lived (15 minutes). When a user logs out, the access token's JTI (JWT ID) is pushed into Redis with a TTL equal to the token's remaining lifetime. Every request through the JWT guard checks this blocklist. Redis TTL handles cleanup automatically — no cron job needed. A database lookup on every API request for revocation would be expensive at scale.

Token rotation is enforced: every refresh token use invalidates the previous token and issues a new pair. If the old token is used again after rotation, it is treated as a theft signal and all sessions for that user are cleared.

### Queue Architecture — Domain-separated BullMQ queues

Five queues: `notifications`, `payouts`, `disputes`, `webhooks`, `settlements`.

**Why not one global queue:** A poison pill job or a slow worker in a single queue blocks everything behind it. Domain separation means a failing payout job cannot delay notification emails. Each queue has independent concurrency settings, retry strategies, and rate limits appropriate to its domain.

**Why not micro-queues per job type:** Too granular. 20+ queues become unmanageable. Domain is the right unit of separation — it matches how workers would be scaled independently in production.

Bull Board is configured to connect to all queues and provide a single admin monitoring interface. A screenshot of Bull Board goes in the README.

### Soft Delete Strategy — Manual deletedAt column with partial unique indexes

TypeORM's built-in `@DeleteDateColumn` with `softDelete()` is explicitly not used.

**Why:** TypeORM's soft delete has a known bug with unique constraints — soft-deleting a user and attempting re-registration with the same email fires the unique constraint because the row still exists. It also does not automatically filter deleted parents through relations without careful configuration of `withDeleted` everywhere.

**What is done instead:** A `deletedAt` column is added manually to all soft-deletable entities. Every query that should exclude deleted records includes `.where('entity.deletedAt IS NULL')` explicitly.

For unique constraint compatibility with soft deletes, partial unique indexes are created at the database level in migrations:

```sql
CREATE UNIQUE INDEX users_email_unique ON users(email) WHERE deleted_at IS NULL;
```

This means soft-deleted users do not block re-registration. The uniqueness constraint only applies to active records.

### Commission Calculation — At escrow release, atomically

Commission is calculated at the point of escrow release, not at order creation and not at payout time.

**Why not at order creation:** Orders are cancelled, disputed, and partially refunded. Calculating commission at creation requires reversing it on cancellation — complex reconciliation logic on operations that have not yet occurred.

**Why not at payout:** Payout is triggered by the seller. Deferring commission calculation to payout time means the platform's revenue is not known until the seller acts. It also creates a race condition where commission calculation and fund transfer happen in separate operations.

**At escrow release:** The seller has earned the commission when the buyer confirms delivery. Commission calculation and fund movement are wrapped in a single `QueryRunner` database transaction:

1. Lock the escrow wallet row with `SELECT ... FOR UPDATE`
2. Calculate commission: `orderAmount × seller.commissionRate`
3. Insert transaction: escrow → platform wallet (COMMISSION)
4. Insert transaction: escrow → seller wallet (ESCROW_RELEASE, amount minus commission)
5. Update wallet balances
6. Update order status to COMPLETED
7. Insert audit log entry

All six steps succeed or all roll back. There is no partial state.

Commission rate lives on `seller_profiles`, not hardcoded. Different sellers can have different rates (early sellers rewarded with lower commission as an incentive). Admin can update per seller.

### Webhook Delivery — Async via BullMQ, exponential backoff, HMAC-signed

Webhook delivery is async. Synchronising HTTP calls to external seller endpoints inside the order completion flow would couple the platform's reliability to every external system it notifies. A broken seller endpoint cannot cause order completion to fail.

Every outbound webhook payload is signed with HMAC-SHA256 using a per-seller secret. The signature is sent in the `X-Tradeloop-Signature` header. Sellers verify it on their end. This is the standard pattern used by Stripe and Paystack.

Retry schedule on failure: immediate → 30 seconds → 5 minutes → 30 minutes → 2 hours. After 5 failed attempts, the delivery is moved to the dead letter state. Admin can trigger manual retry from the dead letter queue.

### TOCTOU Prevention — Atomic conditional SQL

TOCTOU (Time-Of-Check-Time-Of-Use) race conditions are prevented by collapsing the check and the use into a single atomic SQL statement.

**For stock decrement:**
```sql
UPDATE products SET stock = stock - :quantity
WHERE id = :id AND stock >= :quantity
RETURNING *;
```
If no row is returned, stock was insufficient. No separate read needed. No window between check and decrement.

**For wallet debit:**
```sql
UPDATE wallets SET balance = balance - :amount
WHERE id = :walletId AND balance >= :amount
RETURNING *;
```
If no row is returned, insufficient funds. Balance cannot go negative under any concurrency.

**For multi-table atomic operations (escrow release, payout processing):**
`QueryRunner` wraps multiple statements in a database transaction. `SELECT ... FOR UPDATE` locks the relevant wallet row before any read-then-write sequence.

### Idempotency Keys — Stored per user with 24-hour TTL

Every order creation request accepts an `Idempotency-Key` header. The key is stored in an `idempotency_keys` table with the response. If the same key arrives again within 24 hours, the stored response is returned without re-processing. This handles network retries where the client did not receive the response but the server already processed the request.

Idempotency keys are scoped to `(key, userId)` — a key used by one user cannot collide with the same key used by another user.

BullMQ job handlers are also idempotent. Every worker function checks whether its work is already done before executing:

```
payout worker: if payout.status === COMPLETED, return immediately
settlement worker: if order.status === COMPLETED, return immediately
```

This makes duplicate job execution safe — re-queued jobs after a worker crash produce no side effects.

### API Response Shape — Standardised envelope via global interceptor

Every API response, success or error, follows a consistent envelope shape.

**Success:**
```json
{
  "success": true,
  "message": "order created successfully",
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 340, "nextCursor": "uuid" }
}
```
`meta` only appears on paginated responses. Applied by a global `TransformInterceptor` — controllers never manually wrap responses.

**Error:**
```json
{
  "success": false,
  "error": "INSUFFICIENT_FUNDS",
  "message": "Wallet balance is insufficient for this order",
  "timestamp": "2026-10-01T10:00:00Z",
  "path": "/api/v1/orders"
}
```
Applied by a global `GlobalExceptionFilter`. Every exception — TypeORM constraint violations, JWT errors, custom business exceptions — produces this shape. A reviewer or frontend developer never encounters inconsistent error responses.

### Pagination — Cursor-based for live marketplace data

Offset-based pagination (`page=2&limit=20`) breaks on live data. If a new product is inserted between page 1 and page 2 requests, records are skipped or duplicated. For a marketplace with live inventory and new listings, this is a real problem.

Cursor-based pagination (`cursor=<lastId>&limit=20`) is stable — it always fetches records after the last seen ID regardless of insertions. Used on all product listing, transaction history, and order list endpoints.

Admin tables with stable, less frequently updated data (audit logs, user lists) can use offset pagination for simplicity. The distinction is documented in the README.

### Seller Onboarding — Explicit state machine

Seller status is not a boolean `isVerified` flag. It is an explicit state with enforced transitions:

```
PENDING_VERIFICATION → UNDER_REVIEW → ACTIVE → SUSPENDED
```

Invalid transitions are rejected at the service layer. A suspended seller cannot jump directly to ACTIVE without going through UNDER_REVIEW again. This is enforced in `SellerProfileService` using a transition guard method, not left to the caller to manage.

### Audit Log — Immutable append-only table

Every admin action and every financial operation writes an entry to `audit_logs`. The table has no update or delete operations. It is append-only by design and enforced by not exposing any update or delete methods on the `AuditService`.

Each entry records: actor ID, actor role, action type, target resource ID and type, a JSON snapshot of before/after state, IP address, and timestamp.

This is a compliance requirement in fintech, not optional. The Jointearn JD explicitly lists "fraud prevention and transaction security" — an immutable audit trail is the backbone of both.

### Security Headers — `@fastify/helmet`

Registered in `main.ts`. Sets `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, and `Content-Security-Policy` headers on every response. One line of setup, covers a real attack surface.

### CORS — Explicit origin allowlist

`app.enableCors()` is never called with a wildcard origin. An allowlist of `WEB_URL` and `ADMIN_URL` environment variables is configured. Wildcard CORS on a marketplace API that handles payments is a security vulnerability.

### Rate Limiting — `@nestjs/throttler` with Redis store, per-endpoint configuration

Global rate limiting is applied. Auth endpoints (`/auth/login`, `/auth/register`) have stricter limits than product browsing endpoints. The Redis store is used so rate limit state is shared across multiple API instances (horizontal scaling).

### Request ID Tracing — nanoid per request, in logs and response headers

A middleware generates a nanoid for every incoming request. The ID is attached to the Fastify request object, included in every Pino log line for that request lifecycle, and returned in the `X-Request-Id` response header. In production, filtering logs by `requestId` shows the complete lifecycle of any specific request — essential for debugging concurrent operations.

### Configuration Management — `@nestjs/config` with Zod schema validation at startup

All environment variables are validated at application startup using a Zod schema. If `DATABASE_URL` is missing or `JWT_SECRET` is too short, the application fails immediately with a clear error message listing which variables are invalid. It does not start and crash later when the first database query fires.

### Database Migrations — TypeORM migrations only, never `synchronize: true`

`synchronize: true` is a TypeORM option that automatically modifies the database schema to match entities at startup. It is a development convenience that has destroyed production databases by dropping columns with data. It is never used in this project, including in development.

All schema changes happen through TypeORM migration files. Migrations are version-controlled, reviewed, and run explicitly. The `docker-compose.yml` runs pending migrations automatically on container start for the development environment.

### Promotions and Discounts — Scoped discount system with atomic usage tracking

Discounts support:
- Code-based (buyer applies a code at checkout) and automatic (applied based on rules)
- Percentage and flat amount types
- Four scope levels: PLATFORM (all products), SELLER (one seller's products), PRODUCT (specific product), CATEGORY (specific category)
- Minimum order value requirement
- Total usage limit and per-user usage limit
- Start and expiry dates
- Seller-created (scoped to their own store) and admin-created (any scope)

Usage tracking uses an atomic conditional SQL update to prevent race conditions where two buyers simultaneously redeem the last use of a discount:

```sql
UPDATE discounts SET usage_count = usage_count + 1
WHERE id = :id AND usage_count < max_usage_count
RETURNING *;
```

If no row is returned, the discount reached its limit between the buyer's validation check and their submission. The order is rejected cleanly.

Discounts are applied before escrow hold. The escrow holds the discounted amount, not the original price. The `orders` table records both `originalAmount` and `discountedAmount`.

### Fraud Prevention — Rule-based FraudService with Redis velocity tracking

A configurable rule engine with a `fraud_rules` table and `flagged_events` table. Rules have configurable thresholds, time windows, and actions (FLAG, BLOCK, or NOTIFY_ADMIN). Admin can tune thresholds without a deployment.

Seven fraud rule types:

1. **Order velocity** — buyer places more than N orders within X seconds. Uses Redis sorted sets for sliding window tracking. Default: 5 orders in 60 seconds triggers FLAG.

2. **Wallet funding velocity** — more than N top-up attempts within X minutes. Indicates stolen card testing. Default: 3 attempts in 10 minutes triggers FLAG and NOTIFY_ADMIN.

3. **Suspicious payout** — seller requests payout within N hours of first completed order. Default: within 2 hours triggers FLAG and holds payout for manual admin review.

4. **Login anomaly** — N failed login attempts within X minutes triggers temporary account lock via Redis TTL key. Default: 5 failures in 15 minutes triggers 30-minute lockout and email notification.

5. **Dispute abuse** — buyer raises N disputes within X days. Default: 3 disputes in 30 days triggers FLAG.

6. **High-value transaction** — single order or wallet top-up exceeds N amount. Default: ₦500,000 triggers FLAG and NOTIFY_ADMIN.

7. **Promo abuse** — same IP address redeems discounts across N accounts. Requires storing `ipAddress` and `userAgent` on `discount_redemptions`.

Redis sorted sets are used for velocity checks because `ZREMRANGEBYSCORE` cleans up old events atomically and `ZCARD` counts events in the window in one operation, with no application-level loop.

FLAG actions log the event and continue processing. BLOCK actions throw a `FraudBlockedException` and halt the request. All flagged events appear in the admin fraud dashboard.

---

## 6. Backend — Module Map

```
apps/api/src/
├── auth/
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── google.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── google-auth.guard.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.module.ts

├── users/
│   ├── entities/
│   │   └── user.entity.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.repository.ts
│   └── users.module.ts

├── seller-profiles/
│   ├── entities/
│   │   └── seller-profile.entity.ts
│   ├── seller-profiles.controller.ts
│   ├── seller-profiles.service.ts
│   └── seller-profiles.module.ts

├── products/
│   ├── entities/
│   │   ├── product.entity.ts
│   │   └── category.entity.ts
│   ├── products.controller.ts
│   ├── products.service.ts
│   ├── search.service.ts
│   └── products.module.ts

├── cart/
│   ├── entities/
│   │   ├── cart.entity.ts
│   │   └── cart-item.entity.ts
│   ├── cart.controller.ts
│   ├── cart.service.ts
│   └── cart.module.ts

├── orders/
│   ├── entities/
│   │   ├── order.entity.ts
│   │   └── order-item.entity.ts
│   ├── orders.controller.ts
│   ├── orders.service.ts
│   └── orders.module.ts

├── payments/
│   ├── interfaces/
│   │   └── payment-provider.interface.ts
│   ├── providers/
│   │   ├── paystack.provider.ts
│   │   └── flutterwave.provider.ts
│   ├── payment.service.ts
│   └── payments.module.ts

├── webhooks/
│   ├── webhooks.controller.ts
│   ├── webhook-handler.service.ts
│   └── webhooks.module.ts

├── wallet/
│   ├── entities/
│   │   ├── wallet.entity.ts
│   │   └── transaction.entity.ts
│   ├── wallet.controller.ts
│   ├── wallet.service.ts
│   └── wallet.module.ts

├── escrow/
│   ├── escrow.service.ts
│   └── escrow.module.ts

├── settlement/
│   ├── settlement.service.ts
│   └── settlement.module.ts

├── payouts/
│   ├── entities/
│   │   └── payout-request.entity.ts
│   ├── payouts.controller.ts
│   ├── payouts.service.ts
│   └── payouts.module.ts

├── disputes/
│   ├── entities/
│   │   └── dispute.entity.ts
│   ├── disputes.controller.ts
│   ├── disputes.service.ts
│   └── disputes.module.ts

├── discounts/
│   ├── entities/
│   │   ├── discount.entity.ts
│   │   └── discount-redemption.entity.ts
│   ├── discounts.controller.ts
│   ├── discounts.service.ts
│   └── discounts.module.ts

├── logistics/
│   ├── interfaces/
│   │   └── logistics-provider.interface.ts
│   ├── providers/
│   │   ├── sendbox.provider.ts
│   │   └── mock-logistics.provider.ts
│   ├── entities/
│   │   └── shipment.entity.ts
│   ├── logistics.controller.ts
│   ├── logistics.service.ts
│   └── logistics.module.ts

├── uploads/
│   ├── uploads.controller.ts
│   ├── uploads.service.ts
│   └── uploads.module.ts

├── notifications/
│   ├── channels/
│   │   ├── email.channel.ts
│   │   └── in-app.channel.ts
│   ├── entities/
│   │   └── notification.entity.ts
│   ├── notifications.service.ts
│   └── notifications.module.ts

├── fraud/
│   ├── entities/
│   │   ├── fraud-rule.entity.ts
│   │   └── flagged-event.entity.ts
│   ├── fraud.service.ts
│   ├── fraud.controller.ts        (admin only)
│   └── fraud.module.ts

├── admin/
│   ├── admin.controller.ts
│   ├── admin.service.ts
│   └── admin.module.ts

├── audit/
│   ├── entities/
│   │   └── audit-log.entity.ts
│   ├── audit.service.ts
│   └── audit.module.ts

├── health/
│   ├── health.controller.ts
│   └── health.module.ts

├── queues/
│   ├── processors/
│   │   ├── notifications.processor.ts
│   │   ├── payouts.processor.ts
│   │   ├── disputes.processor.ts
│   │   ├── webhooks.processor.ts
│   │   └── settlements.processor.ts
│   └── queues.module.ts

└── common/
    ├── guards/
    │   └── roles.guard.ts
    ├── pipes/
    │   ├── sanitize.pipe.ts
    │   └── zod-validation.pipe.ts
    ├── filters/
    │   └── global-exception.filter.ts
    ├── interceptors/
    │   ├── transform.interceptor.ts
    │   └── serialize.interceptor.ts
    ├── middleware/
    │   └── request-id.middleware.ts
    ├── decorators/
    │   ├── roles.decorator.ts
    │   ├── current-user.decorator.ts
    │   └── idempotency-key.decorator.ts
    ├── exceptions/
    │   ├── insufficient-funds.exception.ts
    │   ├── insufficient-stock.exception.ts
    │   ├── fraud-blocked.exception.ts
    │   └── invalid-state-transition.exception.ts
    └── base/
        └── base.entity.ts
```

---

## 7. Backend — Database Schema

### Base Entity

All entities extend `BaseEntity`:
- `id` — UUIDv7, primary key, generated app-side (property initializer, never database-generated)
- `createdAt` — timestamp, auto-set on insert
- `updatedAt` — timestamp, auto-set on update
- `deletedAt` — timestamp, null by default, set on soft delete

### users

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| email | VARCHAR | Partial unique index WHERE deleted_at IS NULL |
| passwordHash | VARCHAR | Nullable — null for Google-only accounts |
| googleId | VARCHAR | Nullable — set for Google OAuth users |
| role | ENUM | BUYER, SELLER, ADMIN |
| isVerified | BOOLEAN | Email verification status |
| refreshTokenHash | VARCHAR | Nullable — hashed refresh token |
| deletedAt | TIMESTAMP | Soft delete |

### seller_profiles

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | UUID | FK → users |
| storeName | VARCHAR | Unique |
| bankAccountNumber | VARCHAR | Encrypted at rest |
| bankCode | VARCHAR | Nigerian bank code |
| commissionRate | DECIMAL | Default platform rate, admin-adjustable per seller |
| status | ENUM | PENDING_VERIFICATION, UNDER_REVIEW, ACTIVE, SUSPENDED |

### buyer_profiles

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | UUID | FK → users |
| defaultShippingAddress | JSONB | Nullable |

### categories

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR | |
| parentId | UUID | FK → categories (self-referential for subcategories) |

### products

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| sellerId | UUID | FK → users |
| categoryId | UUID | FK → categories |
| name | VARCHAR | |
| description | TEXT | Sanitised rich text |
| price | DECIMAL | |
| stock | INTEGER | |
| imageUrl | VARCHAR | Supabase Storage URL |
| searchVector | TSVECTOR | Auto-populated from name + description via trigger |
| deletedAt | TIMESTAMP | |

GIN index on `searchVector`.

### carts

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| buyerId | UUID | FK → users, unique (one cart per buyer) |

### cart_items

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| cartId | UUID | FK → carts |
| productId | UUID | FK → products |
| quantity | INTEGER | |

### orders

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| buyerId | UUID | FK → users |
| sellerId | UUID | FK → users |
| status | ENUM | PENDING, CONFIRMED, SHIPPED, DELIVERED, COMPLETED, CANCELLED, DISPUTED |
| originalAmount | DECIMAL | Pre-discount total |
| discountedAmount | DECIMAL | Nullable — amount saved |
| totalAmount | DECIMAL | Final amount charged to buyer |
| commissionAmount | DECIMAL | Nullable — set at settlement |
| discountId | UUID | FK → discounts, nullable |
| shippingAddress | JSONB | Snapshot at order time |

### order_items

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| orderId | UUID | FK → orders |
| productId | UUID | FK → products |
| quantity | INTEGER | |
| unitPrice | DECIMAL | Snapshot at order time — never references live product price |
| productName | VARCHAR | Snapshot — product may be deleted later |

Prices are snapshotted at order creation time. If the seller changes the price or deletes the product, historical orders remain accurate.

### wallets

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | UUID | FK → users, nullable (platform and escrow wallets have no user) |
| type | ENUM | BUYER, SELLER, PLATFORM, ESCROW |
| balance | DECIMAL | Cached running total — always verifiable against transactions |

### transactions

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| fromWalletId | UUID | FK → wallets |
| toWalletId | UUID | FK → wallets |
| amount | DECIMAL | |
| type | ENUM | ESCROW_HOLD, ESCROW_RELEASE, COMMISSION, PAYOUT, REFUND, WALLET_FUND |
| status | ENUM | PENDING, COMPLETED, REVERSED |
| referenceId | UUID | orderId, payoutId, disputeId, or walletFundId |
| referenceType | VARCHAR | Order, Payout, Dispute, WalletFund |

### payout_requests

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| sellerId | UUID | FK → users |
| amount | DECIMAL | |
| status | ENUM | PENDING, APPROVED, REJECTED, PROCESSED, FAILED |
| adminId | UUID | FK → users, nullable — set on approval or rejection |
| rejectionReason | TEXT | Nullable |

### disputes

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| orderId | UUID | FK → orders |
| raisedBy | UUID | FK → users (buyer) |
| reason | TEXT | |
| status | ENUM | OPEN, UNDER_REVIEW, RESOLVED_BUYER, RESOLVED_SELLER, EXPIRED |
| adminId | UUID | FK → users, nullable |
| resolvedAt | TIMESTAMP | Nullable |
| expiresAt | TIMESTAMP | Set to now + 7 days on creation |

### discounts

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| code | VARCHAR | Nullable — null for automatic promotions. Unique where not null. |
| type | ENUM | PERCENTAGE, FLAT_AMOUNT |
| value | DECIMAL | |
| scope | ENUM | PLATFORM, SELLER, PRODUCT, CATEGORY |
| scopeId | UUID | Nullable — FK to relevant table based on scope |
| createdBy | UUID | FK → users |
| minimumOrderValue | DECIMAL | Nullable |
| maxUsageCount | INTEGER | Nullable — null means unlimited |
| maxUsagePerUser | INTEGER | Nullable |
| usageCount | INTEGER | Default 0 |
| isActive | BOOLEAN | |
| startsAt | TIMESTAMP | |
| expiresAt | TIMESTAMP | Nullable |

### discount_redemptions

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| discountId | UUID | FK → discounts |
| orderId | UUID | FK → orders |
| userId | UUID | FK → users |
| amountDeducted | DECIMAL | |
| ipAddress | VARCHAR | For promo abuse detection |
| userAgent | VARCHAR | For promo abuse detection |

### shipments

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| orderId | UUID | FK → orders |
| provider | ENUM | SENDBOX, MOCK |
| trackingId | VARCHAR | |
| trackingUrl | VARCHAR | |
| status | ENUM | PENDING, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, FAILED |
| providerResponse | JSONB | Raw provider response snapshot |
| estimatedDelivery | TIMESTAMP | Nullable |

### notifications

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | UUID | FK → users |
| type | VARCHAR | ORDER_CONFIRMED, DISPUTE_RAISED, PAYOUT_APPROVED, etc. |
| title | VARCHAR | |
| body | TEXT | |
| isRead | BOOLEAN | Default false |
| metadata | JSONB | Additional context (orderId, amount, etc.) |

### webhook_deliveries

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| sellerId | UUID | FK → users |
| event | VARCHAR | order.completed, payout.processed, etc. |
| payload | JSONB | |
| status | ENUM | PENDING, DELIVERED, FAILED |
| attempts | INTEGER | Default 0 |
| nextRetryAt | TIMESTAMP | Nullable |
| lastError | TEXT | Nullable |

### idempotency_keys

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| key | VARCHAR | |
| userId | UUID | FK → users |
| response | JSONB | Stored response to return on duplicate |
| createdAt | TIMESTAMP | Cleaned up after 24 hours via scheduled job |

Unique index on `(key, userId)`.

### fraud_rules

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR | |
| description | TEXT | |
| type | ENUM | VELOCITY, PAYOUT, DISPUTE, LOGIN, PROMO, HIGH_VALUE |
| threshold | INTEGER | |
| windowSeconds | INTEGER | Nullable — for velocity rules |
| action | ENUM | FLAG, BLOCK, NOTIFY_ADMIN |
| isActive | BOOLEAN | |

### flagged_events

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | UUID | FK → users |
| type | ENUM | ORDER, WALLET_FUND, PAYOUT, DISPUTE, LOGIN, PROMO_REDEMPTION |
| referenceId | UUID | Nullable |
| referenceType | VARCHAR | Nullable |
| ruleId | UUID | FK → fraud_rules |
| reason | TEXT | |
| severity | ENUM | LOW, MEDIUM, HIGH |
| status | ENUM | OPEN, REVIEWED, DISMISSED, ESCALATED |
| reviewedBy | UUID | FK → users, nullable |
| metadata | JSONB | |

### audit_logs

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| actorId | UUID | FK → users |
| actorRole | ENUM | |
| action | VARCHAR | ORDER_CANCELLED, DISPUTE_RESOLVED, PAYOUT_APPROVED, etc. |
| targetId | UUID | |
| targetType | VARCHAR | Order, Dispute, Payout, User, etc. |
| metadata | JSONB | Before/after state snapshot |
| ipAddress | VARCHAR | |
| createdAt | TIMESTAMP | |

No `updatedAt`, no `deletedAt`. This table is append-only. No update or delete operations are exposed.

---

## 8. Backend — Complete System Flows

### Auth Flow

**Registration:**
1. Client sends `POST /api/v1/auth/register` with email, password, role (BUYER or SELLER)
2. `ZodValidationPipe` validates body against `registerSchema` from `packages/validators`
3. `SanitizePipe` trims and cleans all string fields
4. `FraudService.checkRegistration()` — checks for suspicious registration patterns (same IP, many accounts)
5. `AuthService.register()`:
   - Check email not already in use
   - Hash password with argon2
   - Create user record
   - Create wallet (BUYER type — all new users get a buyer wallet)
   - Enqueue email verification job via BullMQ notifications queue
6. Generate access token (JWT, 15-minute expiry) and refresh token (nanoid, 7-day expiry)
7. Hash refresh token, store in `users.refreshTokenHash`
8. Return `{ accessToken, refreshToken, user }`

**Google OAuth:**
1. Client sends `GET /api/v1/auth/google`
2. Passport redirects to Google OAuth consent screen
3. Google redirects to `GET /api/v1/auth/google/callback` with authorisation code
4. `GoogleStrategy.validate()`:
   - Exchange code for Google tokens
   - Extract profile (email, googleId, name)
   - Find existing user by email or googleId
   - If not found: create user, create buyer wallet
   - If found: ensure googleId is linked
5. Issue platform JWT pair
6. Return tokens to client (redirect with tokens in query params or set as cookies — decision to be finalised at implementation)

**Token Refresh:**
1. Client sends `POST /api/v1/auth/refresh` with raw refresh token
2. Hash the token with argon2
3. Find user where `refreshTokenHash` matches
4. Verify token has not expired
5. Issue new access token and new refresh token (rotation)
6. Overwrite `refreshTokenHash` with new hash
7. Return new token pair

**Logout:**
1. Client sends `POST /api/v1/auth/logout`
2. Extract JTI from current access token
3. Add JTI to Redis blocklist with TTL equal to remaining access token lifetime
4. Clear `refreshTokenHash` in database
5. Return 200

### Seller Onboarding Flow

1. Authenticated BUYER sends `POST /api/v1/seller/onboard` with store details
2. Create `seller_profile` with status `PENDING_VERIFICATION`
3. Enqueue admin notification job
4. Admin sees pending approval in dashboard
5. Admin sends `PATCH /api/v1/admin/sellers/:id/review` — status transitions to `UNDER_REVIEW`. Insert audit log.
6. Admin sends `PATCH /api/v1/admin/sellers/:id/approve` or `/reject`
   - On approve: status → `ACTIVE`, `user.role` updated to `SELLER`, seller wallet created, email notification to seller. Insert audit log.
   - On reject: status → `PENDING_VERIFICATION` (can reapply), rejection reason recorded, email notification. Insert audit log.

### Wallet Funding Flow

1. Buyer sends `POST /api/v1/wallet/fund` with amount
2. `FraudService.checkFundingVelocity(userId)` — Redis sorted set check
3. `FraudService.checkHighValue(amount)` — threshold check
4. `PaymentService.initializeTransaction({ amount, email, callbackUrl })`
   - Active provider (`paystack` or `flutterwave`) initialises the transaction
   - Returns `{ paymentUrl, reference }`
5. Store reference in `idempotency_keys`
6. Return `paymentUrl` to client — client redirects to Paystack/Flutterwave payment page

**Webhook handling (Paystack):**
1. Paystack sends `POST /webhooks/paystack` with raw body and `X-Paystack-Signature` header
2. Body must be read as raw Buffer before JSON parsing — required for HMAC verification
3. `PaystackProvider.verifyWebhook(rawBody, signature)` — HMAC-SHA256 comparison
4. If verification fails: log attempt, return 401
5. `WebhookHandlerService.handlePaystackEvent(event)`:
   - On `charge.success`:
     - Check reference not already processed (idempotency)
     - Atomic wallet credit (raw SQL conditional update)
     - Insert WALLET_FUND transaction record
     - Mark reference as processed
     - Enqueue buyer notification
6. Return 200 to Paystack immediately — processing is async

### Order Creation and Escrow Hold Flow

1. Buyer sends `POST /api/v1/orders` with `{ productId, quantity, shippingAddress, discountCode?, Idempotency-Key header }`
2. Check idempotency key — if exists, return stored response
3. `FraudService.checkOrderVelocity(userId)` — Redis sorted set check
4. `ZodValidationPipe` validates body
5. If `discountCode` present: `DiscountService.validate(code, buyerId, cartItems)` — all validation rules run
6. `OrderService.create()` with `QueryRunner`:
   - Begin transaction
   - Lock product row: `SELECT * FROM products WHERE id = :id FOR UPDATE`
   - Atomic stock decrement: `UPDATE products SET stock = stock - :qty WHERE id = :id AND stock >= :qty RETURNING *` — reject if no row returned
   - Snapshot product price and name into order item
   - Lock buyer wallet: `SELECT * FROM wallets WHERE id = :buyerWalletId FOR UPDATE`
   - Atomic escrow hold: `UPDATE wallets SET balance = balance - :total WHERE id = :buyerWalletId AND balance >= :total RETURNING *` — reject if no row returned
   - Credit escrow wallet
   - Insert ESCROW_HOLD transaction (COMPLETED)
   - Insert order (status: PENDING)
   - Insert order items
   - If discount applied: insert `discount_redemptions`, atomic increment `discounts.usageCount`
   - Insert audit log
   - Commit
7. Store idempotency response
8. Enqueue buyer and seller notification jobs
9. Return order

### Order Lifecycle State Machine

```
PENDING    ← order placed, escrow held
    ↓ seller confirms
CONFIRMED
    ↓ seller ships, tracking created
SHIPPED
    ↓ buyer confirms delivery
DELIVERED  ← triggers settlement via BullMQ
    ↓ settlement completes
COMPLETED

PENDING/CONFIRMED/SHIPPED → CANCELLED (by buyer before delivery)
SHIPPED/DELIVERED → DISPUTED (by buyer)
```

State transitions are validated in `OrderService` — calling `ship()` on a PENDING order throws `InvalidStateTransitionException`.

### Settlement Flow (triggered on delivery confirmation)

Settlement runs in the BullMQ settlements queue, not synchronously on the HTTP request, to avoid blocking the buyer's confirmation response.

1. Job received: `{ orderId }`
2. Check order status is `DELIVERED` (idempotency guard)
3. `SettlementService.settle(orderId)` with `QueryRunner`:
   - Begin transaction
   - Fetch order, seller profile (for commission rate)
   - Lock escrow wallet: `SELECT * FROM wallets WHERE id = :escrowWalletId FOR UPDATE`
   - Calculate commission: `order.totalAmount × seller.commissionRate`
   - Calculate seller net: `order.totalAmount - commission`
   - Insert COMMISSION transaction: escrow → platform wallet
   - Insert ESCROW_RELEASE transaction: escrow → seller wallet (net amount)
   - Update wallet balances (escrow decremented by total, platform credited commission, seller credited net)
   - Update order: status → COMPLETED, `commissionAmount` set
   - Insert audit log
   - Commit
4. Enqueue webhook delivery job: `order.completed` event
5. Enqueue seller notification: "Payment received"
6. Enqueue buyer notification: "Order completed"

### Dispute Flow

1. Buyer sends `POST /api/v1/orders/:id/dispute` — order must be in SHIPPED or DELIVERED status
2. `FraudService.checkDisputeAbuse(buyerId)` — frequency check
3. Insert dispute record, `expiresAt: now + 7 days`
4. Update order status to DISPUTED
5. Schedule BullMQ delayed job in `disputes` queue with delay of 7 days (auto-expiry)
6. Notify seller and admin

**Admin resolution:**
- `PATCH /api/v1/admin/disputes/:id/resolve` with `{ resolution: 'BUYER' | 'SELLER' }`
- Cancel the BullMQ delayed expiry job
- If RESOLVED_BUYER: `QueryRunner` — refund escrow → buyer wallet, restore stock, update order to CANCELLED. Insert audit log.
- If RESOLVED_SELLER: trigger standard settlement flow
- Notify both parties

**Auto-expiry (BullMQ fires after 7 days if not manually resolved):**
- Check dispute still OPEN (idempotency)
- Auto-resolve in seller's favour
- Trigger settlement flow
- Update dispute status to EXPIRED

### Payout Flow

1. Seller sends `POST /api/v1/payouts/request` with amount
2. `FraudService.checkPayoutSuspicion(sellerId, amount)` — timing check against first order
3. Validate seller wallet balance covers amount
4. Insert `payout_request` with status PENDING
5. Notify admin

**Admin approval:**
1. `PATCH /api/v1/admin/payouts/:id/approve`
2. `QueryRunner`:
   - Lock seller wallet: `SELECT ... FOR UPDATE`
   - Verify balance still sufficient
   - Atomic debit: `UPDATE wallets SET balance = balance - :amount WHERE id = :id AND balance >= :amount RETURNING *`
   - Insert PAYOUT transaction (status: PENDING)
   - Update `payout_request` status to APPROVED
   - Insert audit log
   - Commit
3. Enqueue job in BullMQ payouts queue

**BullMQ payout worker:**
1. `PaymentService.initiateBankTransfer(sellerBankDetails, amount, reference)`
2. On provider `transfer.success` webhook:
   - Update PAYOUT transaction status to COMPLETED
   - Update `payout_request` to PROCESSED
   - Emit webhook: `payout.processed`
   - Notify seller
3. On provider `transfer.failed` webhook (after provider retries):
   - Update PAYOUT transaction status to REVERSED
   - Reverse wallet debit (credit back to seller wallet)
   - Update `payout_request` to FAILED
   - Notify admin — dead letter queue entry

**Admin rejection:**
1. `PATCH /api/v1/admin/payouts/:id/reject` with reason
2. Update `payout_request` to REJECTED
3. Notify seller with reason
4. Insert audit log

---

## 9. Backend — Background Jobs

### notifications queue
- Email delivery via Nodemailer + Brevo SMTP
- In-app notification insert into `notifications` table
- Concurrency: 10 workers
- Retry: 3 attempts, 5-second delay

### settlements queue
- Triggered by order delivery confirmation
- Processes escrow release and commission calculation atomically
- Concurrency: 5 workers (financial — conservative)
- Retry: 3 attempts, 10-second exponential backoff
- Idempotent: checks order status before processing

### disputes queue
- Delayed jobs: auto-expiry after 7 days
- Concurrency: 3 workers
- Job is cancelled if admin resolves first (store BullMQ job ID on dispute record)

### payouts queue
- Processes approved bank transfers via payment provider
- Concurrency: 3 workers (financial — conservative)
- Retry: 5 attempts, exponential backoff
- Idempotent: checks payout status before processing

### webhooks queue
- Outbound HTTP delivery to seller-registered webhook URLs
- Concurrency: 10 workers
- Retry: 5 attempts, exponential backoff (immediate → 30s → 5min → 30min → 2hr)
- After 5 failures: status → FAILED, dead letter entry created
- HMAC-SHA256 signed payload on every attempt

---

## 10. Backend — Request Pipeline

Every incoming request passes through this pipeline in order:

1. `RequestIdMiddleware` — generates nanoid, attaches to request, adds to Pino log context
2. `@fastify/helmet` — sets security headers
3. Fastify route matching
4. `JwtAuthGuard` — verifies Bearer token, checks Redis JTI blocklist (on protected routes)
5. `RolesGuard` — checks `@Roles()` decorator against `request.user.role` (on role-protected routes)
6. `ZodValidationPipe` — validates and transforms request body against DTO schema
7. `SanitizePipe` — trims strings, sanitises rich text fields
8. Controller method invocation
9. Service layer
10. Repository or raw SQL
11. `TransformInterceptor` — wraps response in standard success envelope
12. `ClassSerializerInterceptor` — excludes `@Exclude()` decorated fields (passwordHash, refreshTokenHash)
13. Pino logs request completion: requestId, method, path, status, duration
14. Response sent

On any exception: `GlobalExceptionFilter` intercepts, formats into standard error envelope, logs with requestId.

---

## 11. Frontend — Technology Decisions

### User App — Next.js 14 (App Router)

The user-facing marketplace is a public application. Product listing pages, individual product pages, seller storefronts — these pages must be indexable by Google. A buyer finding Tradeloop via search (e.g., "buy shoes Lagos") must land on a crawlable, fast-loading page. React SPA cannot achieve this without prerendering infrastructure.

Next.js App Router provides React Server Components: pages rendered on the server, HTML sent to the client, fully crawlable. Authenticated pages (cart, checkout, wallet, orders) remain client-side interactive components within the same framework.

**Why App Router over Pages Router:** App Router is the current and future direction of Next.js. Server Components are first-class. Layouts, loading states, and error boundaries are built into the routing model.

### Admin App — React + Vite

The admin dashboard is entirely behind authentication. No page is ever public. No URL is indexed. No buyer finds the admin panel via Google. SSR buys nothing here.

React + Vite is a pure client-side SPA. It is simpler — no server/client component distinction, no `use client` directives, no thinking about what runs where. Vite's dev server starts in milliseconds. For a dashboard used only by internal staff on good hardware, this is the right tool.

### Styling — Tailwind CSS with CVA and tailwind-merge

**Why Tailwind over pure CSS:** The design system decisions made in this document — the colour palette, typographic scale, spacing system — map directly into `tailwind.config.ts` as design tokens. Once configured, the entire design system is enforced through utility classes. No developer invents an arbitrary colour value that deviates from the palette.

In a monorepo with a shared `packages/ui` component library, Tailwind's approach of carrying styles in markup is an advantage. Components are self-contained — no separate `.module.css` files, no CSS import side effects, no specificity conflicts between packages.

**Why not pure CSS:** Pure CSS at scale across two apps sharing a component library requires a disciplined CSS architecture (BEM, ITCSS, or similar) maintained by one developer. The overhead does not demonstrate additional value to a reviewer.

**CVA (Class Variance Authority):** Long Tailwind class strings on complex components become unreadable and hard to manage. CVA provides a structured way to define component variants — the base classes and the per-variant classes are separated and named. The result is type-safe, readable, and extensible.

**tailwind-merge:** When a component consumer passes additional classes to override defaults, standard Tailwind class merging produces conflicts (both `bg-teal` and `bg-red-500` apply, last one wins by cascade order). `tailwind-merge` resolves conflicts correctly — the overriding class wins deterministically.

**`cn` utility:** A single function combining CVA's `cx` and `tailwind-merge`'s `twMerge` is defined in `packages/utils` and used everywhere for class composition.

### Animation — Framer Motion (user app), CSS transitions only (admin app)

Framer Motion is used in the user app because the user app is public-facing and benefits from the polish. The admin app is internal — CSS transitions are sufficient and add no bundle cost.

The principle governing all animation decisions: animation must communicate state change or guide attention. It is never decorative.

---

## 12. Frontend — Design System

### Brand Identity

Tradeloop is a marketplace that handles real money. The emotional contract with users is trust — buyers trusting that their money is safe with strangers, sellers trusting that they will be paid. Every design decision is evaluated against whether it reinforces or undermines that contract.

This rules out: playful or loud consumer aesthetics (unserious for financial trust), aggressive crypto/fintech aesthetics (alienating for general marketplace buyers), generic white-and-blue SaaS (forgettable).

The target is: **confident, clean, and warm**.

### Colour Palette

**Primary — Deep Teal `#0D6E6E`**

Teal sits between blue (trust, stability — banking) and green (growth, money, transactions). It is not overused in Nigerian tech — most fintech defaults to blue (Paystack, Flutterwave, GTBank). Tradeloop is distinguishable at a glance. Teal signals financial credibility without impersonating a bank.

Light teal `#E8F5F5` is used for backgrounds, selected states, and hover states.
Dark teal `#095555` is used for active states and pressed states.

**Accent — Warm Amber `#E8A020`**

Amber is used sparingly: primary call-to-action buttons, price displays, active states on financial elements (escrow badges, wallet balance). It evokes value, reward, and the movement of money without anxiety. It contrasts warm against teal without clashing.

Light amber `#FDF3E3` is used for badge backgrounds and subtle highlights.

**Surface — Warm Off-White `#F9F7F4`**

Pure white (`#FFFFFF`) is sterile at scale and makes the palette feel clinical. A warm off-white as the base page background makes teal and amber feel intentional, not pasted on. It also reduces eye strain on long browsing sessions.

**Neutrals:**
- `#1A1A1A` — primary text
- `#4A4A4A` — secondary text
- `#8A8A8A` — muted text (metadata, timestamps)
- `#D4D4D4` — borders
- `#F0EEEC` — card backgrounds

**Semantic Colours:**
- Success: `#1A7F5A` — deep green, used for COMPLETED status, positive transactions
- Error: `#C0392B` — serious red, used for failed states, destructive warnings
- Warning: `#D4850A` — amber-adjacent, used for attention-needed states (DISPUTED, PENDING admin action)
- Info: `#1A5F8A` — used for informational states

**Trust signal colour mapping:**
- Escrow held: amber badge — money is secure and in motion
- Order completed: success green — finality and satisfaction
- Dispute open: warning amber — attention needed, not panic
- Account suspended: error red — serious consequence

### Typography

**Display and headings — Plus Jakarta Sans**

A modern geometric sans-serif with character and confidence. Designed for screen use. Works at large display sizes without losing legibility at smaller heading sizes. Not Inter (used by almost every SaaS application) and not Poppins (too casual and rounded for a financial platform). Plus Jakarta Sans is recognisable as a deliberate choice, not a default.

**Body — Inter**

Optimised for UI density and readability at small sizes. Pairs cleanly with Plus Jakarta Sans — both are geometric, but Plus Jakarta San's slightly heavier personality at large sizes provides clear hierarchy separation. Inter at body sizes is reliable and tested across thousands of UI contexts.

**Monospace — JetBrains Mono**

Used exclusively for: transaction IDs, order reference numbers, wallet addresses, tracking numbers, and any system-generated identifier. Monospace on reference numbers communicates precision. It makes long alphanumeric strings scannable. It also signals that these values are machine-generated identifiers, not human-readable text.

**Typographic scale (strict — no arbitrary sizes):**
- 12px — labels, captions, metadata, timestamps
- 14px — table content, secondary body text, form helper text
- 16px — default body, form inputs, card body text
- 18px — section sub-headings
- 24px — page sub-headings, card titles
- 32px — page headings
- 48px — hero and display text (landing page only)

**All font sizes have semantic meaning. No component uses a size not on this scale.**

### Spacing Scale

Based on a 4px base unit:
- 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px

These map to Tailwind's default spacing scale (1, 2, 3, 4, 6, 8, 12, 16, 24).

### Border Radius

- 4px — buttons, badges, small elements
- 8px — cards, form inputs, dropdowns
- 12px — modals, panels
- 9999px — pill badges, avatar rings

Consistent radius reinforces visual coherence. The scale avoids the "everything is the same border-radius" problem that makes AI-generated designs look templated.

### Shadows

Used on cards and modals only — not on every element.

- Card shadow: `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)`
- Modal shadow: `0 4px 16px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)`

Soft, not dramatic. These are commerce contexts — a product card does not need a theatrical shadow.

### Design Tokens in Tailwind Config

All palette, typography, spacing, and radius values are defined in `packages/ui/tailwind.config.ts` and extended by each app's Tailwind config. No hardcoded hex values exist in component code. All colour references use token names (`text-teal`, `bg-amber-light`, `border-neutral`).

### Animation Decisions

**Justified animations (where to use):**

- Order status stepper progression — when status advances, the step fills with a left-to-right sweep (200ms). Communicates that a real state change just occurred.
- Wallet balance update after funding — number counts up from old to new balance (300ms). Money arriving should feel real and confirmed.
- Toast notifications — slide in from top-right, auto-dismiss with a progress bar underline. Non-blocking feedback.
- Page transitions (Next.js route changes) — subtle fade (150ms). Prevents jarring hard cuts.
- Skeleton loaders — shimmer on product cards and table rows during data fetching. Perceived performance improvement.
- Dispute/cancellation confirmation modal — slight scale-up on open (200ms). Destructive actions warrant a pause.
- HIGH severity fraud flag badge (admin) — pulse animation only on HIGH severity to draw admin attention without scanning every row.

**Explicitly no animation:**
- Navigation sidebar in admin — used constantly, animation becomes friction
- Table row renders — performance concern at high data density
- Form field focus states — border colour change is sufficient
- Button hover states — colour shift only, no movement
- Filter and sort changes — results must appear immediately

### Trust Design Patterns

**Escrow badge:** A small locked-padlock icon with "Escrow Protected" in micro-text appears on every product card, in the checkout summary, and on order detail pages. It is subtle but consistent. It builds the user's mental model of the platform's financial safety guarantees passively, without requiring them to read about it.

**Verified seller badge:** Appears on seller cards and storefronts only after admin approval. It looks distinct — not a generic blue checkmark. It must feel earned.

**Transaction reference numbers:** Always displayed in `JetBrains Mono`. Always copyable with a single click (copy icon appears on hover). Users dealing with financial concerns need to reference transactions easily.

**Destructive action confirmation:** Raising a dispute, cancelling an order, requesting a payout — always a modal with clear consequence language. The confirm button uses a destructive red style. The cancel button is always the visually dominant option. No destructive action fires on a single button press.

**Empty states:** Never "No data." Every empty state explains the situation and provides an action:
- Empty cart: "Your cart is empty — browse products"
- No orders yet: "You haven't placed any orders yet — start shopping"
- No disputes: "No active disputes"

**Error states on financial operations are specific, not generic:**
- "Your wallet balance is insufficient. Fund your wallet to continue."
- "This discount code has reached its usage limit."
- "This product is currently out of stock."

Never: "Something went wrong. Please try again."

---

## 13. Frontend — Application Structure

### User App Page Architecture

**Landing Page:**

Not a generic hero with a banner image and "Shop Now." The primary element is a large search bar — the platform's primary value proposition is finding products. Below the search bar are category shortcuts (not a carousel). Below that: featured seller storefronts, a curated product grid, and a trust bar.

Trust bar content: "Escrow protected payments | Verified sellers | Instant seller payouts"

This answers the three questions every first-time marketplace user has before they ask them.

**Product Listing Page:**

Left sidebar with collapsible filters (category, price range, seller, in-stock only, sort). Product grid on the right — 3 columns desktop, 2 tablet, 1 mobile. Cursor-based "Load more" pagination rather than numbered pages. Numbered pages break when filters are active and new products are added — cursor pagination is stable.

Product cards: image dominant (top 60%), price in amber, seller name in muted text, escrow protected micro-badge on every card, low-stock warning only when fewer than 5 units remain.

**Product Detail Page:**

Split layout: image gallery left, purchase controls right. Purchase controls: product name, price (amber, prominent), seller info strip (name, verified badge, response time), variant selector if applicable, quantity, primary "Add to Cart" button (teal), secondary "Buy Now" (outlined). Below the fold: description (sanitised rich text), seller's other products, reviews.

**Cart and Checkout — Two steps, not a multi-page wizard:**

Step 1: Review cart items, apply discount code, see price breakdown (original, discount, shipping estimate, total).
Step 2: Shipping address, payment method selection (pay from wallet or fund wallet and pay).

**Wallet Page:**

Balance card (teal background, white text) at top. Quick actions: Fund Wallet, Request Withdrawal (sellers). Transaction history table — filterable by type, with credit amounts in green and debit amounts in red, status badges, monospace reference numbers.

**Order Detail Page:**

Horizontal order status stepper. Shipment tracking section. Order items with price snapshot. Price breakdown. Contextual action buttons based on current status — the buyer sees "Confirm Delivery" when the order is SHIPPED. The buyer sees "Raise Dispute" (outlined, secondary) for a brief window after delivery.

### Admin App Layout

**Shell:**

Fixed left sidebar (240px), navigation grouped by domain (Overview, Commerce, Finance, Moderation, System). Sticky top bar with global search, notification bell, admin profile.

**Dashboard:**

Four KPI cards at top — each showing a count requiring action: pending seller approvals, open disputes, failed payouts, high-severity flagged events. Each card links directly to the relevant management page. Below: revenue and commission chart (7-day and 30-day toggle). Below: recent orders table (live, last 20). Recent high-severity fraud events feed.

This is an actionable dashboard, not a vanity metrics page. Every element either answers a question or provides a link to take action.

**All admin tables have:**
- Column-level sorting
- Row-level contextual actions (approve, reject, view, suspend)
- Bulk selection for batch operations
- Export to CSV

---

## 14. Frontend — State and Data

### The Four State Categories

Before choosing any state library, the state in this application is categorised:

- **Server state** — products, orders, wallet balance, transactions. Lives on the server, fetched and cached on client. Changes externally (another user updates an order). Requires caching, background refetching, cache invalidation.
- **Client state** — cart contents, modal open/closed, active tabs, notification panel. Lives only on the client. Never needs to reach the server directly.
- **Auth state** — current user, role, access token. Hybrid — sourced from server, persisted client-side.
- **Form state** — input values, validation errors, submission status. Ephemeral, lives only for the form's lifetime.

The most common frontend architecture mistake is putting server state into a general-purpose state manager (Redux, Zustand). Server state has fundamentally different requirements — caching, deduplication, background refetching, cache invalidation — that a general state manager does not handle.

### Server State — TanStack Query

TanStack Query manages all server state in both apps. It handles caching, background refetching, deduplication (three components requesting the same wallet balance result in one HTTP request), loading and error states, and cache invalidation.

`queryKey` arrays are structured to mirror the backend resource hierarchy. Cache invalidation after mutations is explicit and scoped — confirming delivery invalidates both the `orders` and `wallet` caches because both change.

Optimistic updates are used for cart operations — adding to cart feels instant to the user, rolls back automatically if the server rejects the operation.

### Client State — Zustand

Zustand manages global client-only state: cart contents (before order placement), auth state (user object, role), notification panel open/close, and the toast notification queue.

**Why Zustand over Redux:** Redux's value is in complex state with many actions, time-travel debugging, and large team coordination. For five client-side concerns, Redux's boilerplate (actions, reducers, selectors, dispatch) is disproportionate. Zustand provides a store in approximately 10 lines.

**Why not React Context:** Context re-renders every consumer when any value changes. Zustand uses a subscription model — components re-render only when the slice they subscribe to changes.

### Auth State

**User app (Next.js):** NextAuth.js manages sessions. It handles the Google OAuth callback, stores session data in HTTP-only cookies, and makes session available in both Server Components (via `getServerSession`) and Client Components (via `useSession`). Access tokens are included in session for API calls.

**Admin app (React + Vite):** A Zustand auth store holds the user object and access token in memory (never localStorage — XSS risk). The refresh token is stored in an HTTP-only cookie (set by the API). On page load, the app calls the refresh endpoint to restore session state.

### Form State — React Hook Form with Zod resolver and shared schemas

React Hook Form is chosen over Formik because it uses uncontrolled inputs and ref-based tracking. Formik re-renders the form on every keystroke. For complex forms (checkout, seller onboarding, product creation), React Hook Form's performance advantage is measurable.

**The critical integration:** Zod schemas from `packages/validators` are used directly as form validation schemas via `@hookform/resolvers/zod`. A schema change in the shared package propagates to both the backend DTO validation and the frontend form validation simultaneously. It is impossible for the form to accept data the API rejects or vice versa.

### Data Fetching Patterns in Next.js App Router

Three fetching patterns are used, each in the appropriate context:

**Pattern 1 — React Server Components for initial public page data:** Product listings, product detail pages, seller storefronts. Data fetched on the server during rendering. HTML sent to client is pre-populated. SEO-crawlable. No client-side loading state for initial render.

**Pattern 2 — TanStack Query for interactive and authenticated data:** Wallet balance, orders, cart, notifications. User-specific, frequently updated. TanStack Query manages the client-side lifecycle.

**Pattern 3 — Optimistic mutations with rollback:** Cart operations. Changes appear instant to the user, roll back automatically if the server rejects.

### Real-time Updates

**Notifications — Server-Sent Events (SSE):**

SSE is chosen over WebSockets because all update flows in this application are unidirectional: server pushes to client. WebSockets provide bidirectional communication that this use case does not require. SSE is simpler, works over HTTP/2, and NestJS provides a `@Sse()` decorator natively.

An `EventSource` connection is opened on the notifications endpoint when the user is authenticated. Incoming events update the Zustand notification store, which re-renders the notification bell count and the notification panel.

**Order status updates — TanStack Query polling:**

On the order detail page, TanStack Query polls the order endpoint every 10 seconds when the order is in SHIPPED status. Polling stops when the order reaches COMPLETED or DISPUTED. This is simpler than SSE for a single resource and appropriate for a state that changes infrequently.

### Typed API Client in `packages/utils`

A centralised API client is defined in `packages/utils`. It handles authentication headers automatically, refreshes tokens on 401 responses, and returns typed responses that match the backend DTOs.

The client is organised by domain — `api.products.list()`, `api.wallet.getBalance()`, `api.orders.confirmDelivery()`. This mirrors the backend module structure. TanStack Query wraps the client — it never makes raw `fetch` calls.

---

## 15. Frontend — Routing Structure

### User App (Next.js App Router)

```
app/
├── (public)/                   Public layout — nav, footer, no auth required
│   ├── page.tsx                Landing / homepage
│   ├── products/
│   │   ├── page.tsx            Product listing with search and filters
│   │   └── [slug]/
│   │       └── page.tsx        Product detail page
│   ├── store/
│   │   └── [storeName]/
│   │       └── page.tsx        Seller storefront
│   └── categories/
│       └── [slug]/
│           └── page.tsx        Category listing
│
├── (auth)/                     Auth layout — redirects to /dashboard if already logged in
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   └── auth/
│       └── google/
│           └── callback/
│               └── page.tsx
│
├── (protected)/                Protected layout — redirects to /login if not authenticated
│   ├── dashboard/
│   │   └── page.tsx            Buyer/seller home after login
│   ├── cart/
│   │   └── page.tsx
│   ├── checkout/
│   │   └── page.tsx
│   ├── orders/
│   │   ├── page.tsx            Order list
│   │   └── [id]/
│   │       └── page.tsx        Order detail with tracking
│   ├── wallet/
│   │   └── page.tsx
│   ├── notifications/
│   │   └── page.tsx
│   └── seller/                 Seller-only routes (role guard)
│       ├── dashboard/
│       │   └── page.tsx
│       ├── products/
│       │   ├── page.tsx        Product management
│       │   └── new/
│       │       └── page.tsx
│       ├── orders/
│       │   └── page.tsx        Seller's incoming orders
│       ├── payouts/
│       │   └── page.tsx
│       └── store/
│           └── page.tsx        Store settings
│
└── api/                        Next.js API routes (auth callbacks only)
    └── auth/
        └── [...nextauth]/
            └── route.ts
```

### Admin App (React Router v6)

```
src/
└── routes/
    ├── index.tsx               Root router — redirects to /login or /dashboard
    ├── Login.tsx
    └── (protected)/            All routes behind RequireAuth component
        ├── Dashboard.tsx
        ├── sellers/
        │   ├── SellerList.tsx
        │   └── SellerDetail.tsx
        ├── orders/
        │   ├── OrderList.tsx
        │   └── OrderDetail.tsx
        ├── disputes/
        │   ├── DisputeList.tsx
        │   └── DisputeDetail.tsx
        ├── payouts/
        │   ├── PayoutList.tsx
        │   └── PayoutDetail.tsx
        ├── products/
        │   └── ProductList.tsx
        ├── users/
        │   ├── UserList.tsx
        │   └── UserDetail.tsx
        ├── fraud/
        │   ├── FlaggedEvents.tsx
        │   └── FraudRules.tsx
        ├── transactions/
        │   └── TransactionList.tsx
        ├── discounts/
        │   ├── DiscountList.tsx
        │   └── CreateDiscount.tsx
        ├── audit/
        │   └── AuditLog.tsx
        └── system/
            ├── Webhooks.tsx
            └── Health.tsx
```

---

## 16. Frontend — Error Boundaries and Loading States

### Error Boundaries

Next.js App Router provides file-based `error.tsx` components that act as React error boundaries per route segment. Every major route group has an `error.tsx`.

Error boundaries display a human-readable message with the specific error where possible (from the API's standardised error envelope) and a retry button. They never display stack traces in production.

### Loading States

Next.js App Router provides file-based `loading.tsx` components per route segment. Every page has a `loading.tsx` that renders a skeleton matching the page's layout — not a spinner in the centre of the screen.

Skeleton loaders use the shimmer animation pattern (a gradient that sweeps left to right). They match the shape of the content they replace — a product card skeleton has the same height and column proportions as a real product card.

### Empty States

Every list view has an explicit empty state component. Empty states include:
- An illustration or icon (simple SVG, not stock art)
- A clear explanation of why the list is empty
- A primary action button if there is a logical next step

Empty states are never just "No results" or left as a blank area.

---

## 17. Frontend — Folder Architecture

### `packages/ui`

```
packages/ui/
├── src/
│   ├── primitives/             Atom-level, zero business logic
│   │   ├── Button/
│   │   │   ├── Button.tsx      CVA variants: intent, size
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Badge/
│   │   ├── Avatar/
│   │   ├── Tooltip/
│   │   ├── Spinner/
│   │   ├── Skeleton/
│   │   └── Modal/
│   ├── composed/               Combine primitives, still no business logic
│   │   ├── FormField/          Label + Input + error message
│   │   ├── DataTable/          Table + pagination + sort controls
│   │   ├── StatusBadge/        Badge + semantic colour mapping
│   │   ├── PriceDisplay/       Amount formatting + currency symbol
│   │   ├── TransactionRow/     Icon + description + amount + status
│   │   ├── EmptyState/
│   │   └── ConfirmModal/       Reusable destructive action confirmation
│   ├── layout/
│   │   ├── PageShell/
│   │   ├── Sidebar/
│   │   ├── TopBar/
│   │   └── ContentArea/
│   └── index.ts                Barrel export
├── tailwind.config.ts          Design tokens — extended by app configs
└── package.json
```

### `apps/web` (Next.js)

```
apps/web/
├── app/                        Next.js App Router — routes only
├── components/                 App-specific components
│   ├── domain/                 Business-aware components
│   │   ├── OrderStatusStepper/
│   │   ├── WalletBalanceCard/
│   │   ├── EscrowBadge/
│   │   ├── ProductCard/
│   │   ├── SellerInfoStrip/
│   │   └── TrustBar/
│   └── layout/
│       ├── Navbar/
│       └── Footer/
├── stores/                     Zustand stores
│   ├── cart.store.ts
│   ├── auth.store.ts
│   └── notification.store.ts
├── hooks/                      Custom React hooks
│   ├── use-cart.ts
│   ├── use-wallet.ts
│   ├── use-notifications-stream.ts  SSE hook
│   └── use-order-polling.ts
├── lib/                        Utilities and config
│   ├── auth.ts                 NextAuth config
│   └── query-client.ts         TanStack Query client setup
└── public/
```

### `apps/admin` (React + Vite)

```
apps/admin/
├── src/
│   ├── routes/                 Route components (one per page)
│   ├── components/             Admin-specific components
│   │   ├── domain/
│   │   │   ├── DisputeDetail/
│   │   │   ├── FraudFlagBadge/
│   │   │   ├── PayoutApprovalRow/
│   │   │   └── SellerStatusBadge/
│   │   └── layout/
│   │       ├── AdminShell/
│   │       └── AdminSidebar/
│   ├── stores/
│   │   └── auth.store.ts
│   ├── hooks/
│   │   └── use-admin-query.ts
│   └── lib/
│       └── query-client.ts
└── index.html
```

---

## 18. Step-by-Step Build Order

The build order is designed so that every step produces something runnable and testable before the next step begins. Infrastructure is always built before the features that depend on it.

### Phase 0 — Repository and Tooling

1. Create the root directory: `tradeloop/`
2. Initialise Git repository
3. Create `pnpm-workspace.yaml` declaring `apps/*` and `packages/*`
4. Create root `package.json` with Turborepo as the only dev dependency
5. Create `turbo.json` with `build`, `test`, `dev`, and `lint` pipeline definitions
6. Create `.gitignore`, `.nvmrc` (Node version), `.env.example`
7. Create `packages/types` — initialise with `package.json`, `tsconfig.json`, empty `src/index.ts`
8. Create `packages/validators` — initialise, install `zod`, create first schema (user registration)
9. Create `packages/utils` — initialise, create `cn` utility, create empty API client skeleton
10. Create `packages/ui` — initialise, install Tailwind, CVA, tailwind-merge, configure `tailwind.config.ts` with all design tokens
11. Verify `turbo build` runs across all packages in correct order

### Phase 1 — Backend Foundation

12. Scaffold `apps/api` with NestJS CLI using Fastify adapter
13. Install all core dependencies: TypeORM, PostgreSQL driver, Redis, BullMQ, Passport, JWT, `nestjs-zod`, argon2, nanoid, Pino
14. Configure `@nestjs/config` with Zod environment variable validation schema — app fails to start if any required env var is missing
15. Set up `docker-compose.yml` with PostgreSQL and Redis services, volume mounts, and health checks
16. Configure TypeORM with migration-only setup (`synchronize: false` always)
17. Create `BaseEntity` with `id`, `createdAt`, `updatedAt`, `deletedAt`
18. Create the first migration (empty, to verify migration tooling works)
19. Set up global `ValidationPipe`, `ClassSerializerInterceptor`, `TransformInterceptor`, `GlobalExceptionFilter`
20. Set up `RequestIdMiddleware`
21. Set up `@fastify/helmet` and CORS configuration
22. Set up `@nestjs/throttler` with Redis store
23. Verify health check endpoint returns 200 and `docker-compose up` starts cleanly

### Phase 2 — Auth Module

24. Create `users` entity, migration, and repository
25. Create `AuthModule` with registration and login endpoints
26. Implement JWT strategy (passport-jwt)
27. Implement Google OAuth strategy (passport-google-oauth20)
28. Implement refresh token rotation (hash with argon2, store in users table)
29. Implement access token revocation (Redis JTI blocklist)
30. Implement `JwtAuthGuard`, `RolesGuard`, `@Roles()` decorator, `@CurrentUser()` decorator
31. Write unit tests for `AuthService` (password hashing, token generation, rotation logic)
32. Write integration tests for registration, login, refresh, logout flows against real test database

### Phase 3 — Wallet and Ledger System

33. Create `wallets` entity, `transactions` entity, migrations
34. Create platform wallet and escrow wallet as seed data (these are system wallets with no associated user)
35. Implement `WalletService` with ledger-based balance operations
36. Implement raw SQL atomic wallet credit and debit methods
37. Write unit tests for all `WalletService` methods with mocked repositories
38. Write integration tests for concurrent wallet operations (confirm race conditions are prevented)

### Phase 4 — Product and Category Management

39. Create `categories` entity with self-referential parent relation, migration
40. Create `products` entity with `searchVector` column, migration
41. Create database trigger to auto-populate `searchVector` from `name` and `description` on insert and update
42. Create GIN index on `searchVector`
43. Create partial unique index on `products(slug) WHERE deleted_at IS NULL`
44. Implement `ProductsService` with CRUD, soft delete, and filter builder
45. Implement `SearchService` with `tsvector` full-text search query
46. Write integration tests for product search and filtering

### Phase 5 — Seller Onboarding and Profiles

47. Create `seller_profiles` entity with state machine status enum, migration
48. Create `buyer_profiles` entity, migration
49. Implement `SellerProfilesService` with transition guard method (prevents invalid status transitions)
50. Implement seller onboarding endpoint and admin approval endpoints
51. Create seller wallet on approval
52. Write unit tests for state machine transition logic

### Phase 6 — Payment Providers

53. Define `PaymentProvider` interface
54. Implement `PaystackProvider` with `initializeTransaction`, `verifyTransaction`, `verifyWebhook`
55. Implement `FlutterwaveProvider` with the same interface
56. Implement `PaymentService` that delegates to the active provider via dependency injection
57. Implement wallet funding endpoint
58. Implement webhook endpoints for Paystack and Flutterwave
59. Implement `WebhookHandlerService`
60. Write unit tests for HMAC verification logic in both providers
61. Write integration tests for wallet funding flow using Paystack sandbox

### Phase 7 — Cart and Orders

62. Create `carts`, `cart_items` entities, migrations
63. Implement `CartService` with add, remove, update quantity, clear
64. Create `orders`, `order_items` entities with all status enum values, migrations
65. Create `idempotency_keys` entity, migration
66. Implement `OrderService.create()` with full `QueryRunner` transaction (stock decrement, escrow hold, order and items insert)
67. Implement order status transition endpoints for seller and buyer
68. Write unit tests for `OrderService` state machine logic
69. Write integration tests for concurrent order creation (two buyers on last stock unit)
70. Write integration test for idempotency (duplicate order request returns same response)

### Phase 8 — Discounts

71. Create `discounts`, `discount_redemptions` entities, migrations
72. Implement `DiscountService` with all validation rule checks
73. Integrate discount validation and atomic usage increment into order creation flow
74. Implement seller and admin discount management endpoints
75. Write unit tests for each discount validation rule
76. Write integration test for concurrent discount redemption at usage limit

### Phase 9 — Escrow, Settlement, and Disputes

77. Implement `EscrowService` (delegates to wallet service with correct transaction types)
78. Implement `SettlementService` with full `QueryRunner` transaction
79. Create `disputes` entity, migration
80. Implement `DisputeService` with raise, adjudicate (buyer/seller resolution), auto-expiry
81. Set up BullMQ `settlements` queue and processor
82. Set up BullMQ `disputes` queue and processor (delayed auto-expiry jobs)
83. Write integration tests for full order lifecycle: place → confirm → ship → deliver → settlement
84. Write integration tests for dispute: raise → resolve buyer (refund) and resolve seller (settlement)

### Phase 10 — Payouts

85. Create `payout_requests` entity, migration
86. Implement `PayoutsService` with request, approve, reject
87. Set up BullMQ `payouts` queue and processor
88. Integrate `FraudService.checkPayoutSuspicion()` into payout request flow
89. Write integration tests for payout request → approve → process → success and failure paths

### Phase 11 — Notifications

90. Create `notifications` entity, migration
91. Implement `EmailChannel` using Nodemailer + Brevo SMTP with HTML email templates
92. Implement `InAppChannel` (inserts notification records)
93. Implement `NotificationsService` with strategy dispatch
94. Set up BullMQ `notifications` queue and processor
95. Implement SSE endpoint for real-time in-app notification delivery
96. Write integration tests for notification delivery

### Phase 12 — Logistics

97. Define `LogisticsProvider` interface
98. Implement `MockLogisticsProvider` with realistic fake tracking data
99. Implement `SendboxProvider` with correct API structure (requires Sendbox credentials to activate)
100. Create `shipments` entity, migration
101. Implement `LogisticsService` with createShipment, trackShipment, calculateRate
102. Implement shipping rate endpoint, shipment creation endpoint, tracking endpoint
103. Implement Sendbox webhook endpoint for auto-status updates
104. Write integration tests using mock provider for full order-to-delivery tracking flow

### Phase 13 — Webhooks (outbound to sellers)

105. Create `webhook_deliveries` entity, migration
106. Implement outbound `WebhookDeliveryService` with HMAC signing
107. Set up BullMQ `webhooks` queue and processor with exponential backoff
108. Implement admin dead letter retry endpoint
109. Write unit tests for HMAC signing
110. Write integration tests for delivery success and failure with retry

### Phase 14 — Fraud Prevention

111. Create `fraud_rules`, `flagged_events` entities, migrations
112. Seed default fraud rules into the database
113. Implement `FraudService` with all seven rule check methods using Redis sorted sets
114. Integrate `FraudService` checks into all relevant service entry points (orders, wallet, payouts, disputes, auth, discounts)
115. Implement admin fraud dashboard endpoints
116. Write unit tests for each fraud rule check method

### Phase 15 — Admin Module

117. Implement all admin-only endpoints behind `@Roles(Role.ADMIN)` guard
118. Implement `AuditService` and ensure every financial and admin operation writes an audit log entry
119. Implement `HealthModule` with database, Redis, and Supabase checks
120. Implement graceful shutdown hooks

### Phase 16 — Documentation and Hardening

121. Configure Swagger/OpenAPI with `nestjs-zod/openapi` — document every endpoint
122. Ensure Swagger is disabled in production via environment variable
123. Add rate limiting configuration per endpoint
124. Review all endpoints for missing auth guards
125. Run full integration test suite, fix failures
126. Write backend README section: architecture diagram, module summary, how to run

### Phase 17 — User App (Next.js)

127. Scaffold `apps/web` with Next.js 14, App Router, TypeScript
128. Configure Tailwind to extend `packages/ui/tailwind.config.ts`
129. Install and configure NextAuth.js with Google provider and JWT strategy
130. Implement route group layouts (public, auth, protected)
131. Build `Navbar` and `Footer` layout components
132. Build landing page with search bar, category shortcuts, trust bar
133. Build product listing page with filter sidebar and product card grid (Server Component with TanStack Query hydration)
134. Build product detail page (Server Component)
135. Build seller storefront page
136. Build cart page
137. Build checkout flow (two-step: review, payment)
138. Build wallet page with transaction history
139. Build order list and order detail pages with status stepper
140. Build dispute raise flow
141. Build seller dashboard, product management, orders management, payouts pages
142. Implement SSE notification hook
143. Implement TanStack Query order status polling
144. Add Framer Motion animations where specified
145. Add skeleton loaders for all data-fetching states
146. Add empty states for all list views
147. Add error boundaries for all route segments

### Phase 18 — Admin App (React + Vite)

148. Scaffold `apps/admin` with Vite, React, TypeScript
149. Configure Tailwind to extend `packages/ui/tailwind.config.ts`
150. Set up React Router v6 with `RequireAuth` wrapper component
151. Implement Zustand auth store
152. Build `AdminShell` layout with sidebar navigation
153. Build dashboard page with KPI cards and charts
154. Build seller management pages (list, detail, approve/reject)
155. Build order management pages
156. Build dispute management pages with resolution controls
157. Build payout management pages with approve/reject controls
158. Build fraud dashboard (flagged events list, fraud rules configuration)
159. Build user management pages
160. Build transaction list and audit log pages
161. Build webhook delivery management and dead letter retry
162. Build discount management pages

### Phase 19 — Final Integration and Polish

163. Run full end-to-end test of every system flow manually
164. Run full test suite in CI configuration
165. Write root README with: project overview, architecture diagram, module map, how to run with Docker, environment variables reference, what each app does, technical highlights section
166. Add Bull Board dashboard to the API and document in README
167. Take screenshots of key pages for README
168. Final review of all TypeScript types — no `any` types in non-test code
169. Verify `docker-compose up` starts the entire stack from cold with no manual steps beyond copying `.env.example` to `.env`

---

## 19. Environment Variables

```
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/tradeloop

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=minimum-32-character-secret-here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback

# Payment — Paystack
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_WEBHOOK_SECRET=

# Payment — Flutterwave
FLUTTERWAVE_SECRET_KEY=FLWSECK_TEST-...
FLUTTERWAVE_WEBHOOK_SECRET=

# Active payment provider
PAYMENT_PROVIDER=paystack

# Logistics
SENDBOX_API_KEY=
SENDBOX_WEBHOOK_SECRET=
LOGISTICS_PROVIDER=mock

# Supabase Storage
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_STORAGE_BUCKET=tradeloop-products

# Email — Brevo SMTP
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_USER=
BREVO_SMTP_KEY=
EMAIL_FROM=noreply@tradeloop.com

# Application
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000
WEB_URL=http://localhost:3001
ADMIN_URL=http://localhost:3002

# Swagger (disabled in production)
SWAGGER_ENABLED=true

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3001
VITE_API_URL=http://localhost:3000
```

---

## 20. Docker and Local Development

### `docker-compose.yml` services

- `postgres` — PostgreSQL 15, persistent volume, health check
- `redis` — Redis 7, persistent volume, health check
- `api` — NestJS app, depends on postgres and redis, runs migrations on start, hot reload with volume mount
- `web` — Next.js app, hot reload
- `admin` — Vite dev server, hot reload

A reviewer must be able to:
1. Clone the repository
2. Copy `.env.example` to `.env`
3. Run `docker-compose up`
4. Have the entire stack running with the database seeded and migrations applied

No additional manual steps. No "run this command first, then this one." This is the standard that separates a portfolio project that gets evaluated from one that gets skipped.

### Migration automation

The `api` service's Docker entrypoint runs `typeorm migration:run` before starting the NestJS application. Migrations are always applied before the application accepts requests.

---

## 21. Testing Strategy

### What to test and why

Testing is a tool for reducing risk on high-consequence operations. The selection of what to test is deliberate:

**Unit tests — pure business logic only, no infrastructure:**

- `EscrowService` — hold, release, and refund calculations
- `CommissionService` — rate calculation, rounding, edge cases (zero commission, 100% discount)
- `WalletService` — ledger balance derivation
- `OrderService` — state machine valid and invalid transition logic
- `DiscountService` — all validation rule checks (scope, expiry, usage limits, per-user limits)
- `FraudService` — each rule check method with mocked Redis
- Webhook HMAC verification in both providers
- State machine transitions in `SellerProfilesService`

These are high-value unit tests because they protect financial logic. A bug in commission rounding or escrow release is a real money problem. Infrastructure is mocked with `vitest-mock-extended`.

**Integration tests — full module wiring against real database:**

- Auth flow: register, login, token refresh, logout, Google OAuth callback
- Order lifecycle: create → confirm → ship → deliver → settlement (escrow releases correctly, commission calculated correctly)
- Concurrent order creation: two buyers purchasing last unit simultaneously (one succeeds, one receives InsufficientStockException)
- Concurrent wallet debit: two payouts simultaneously (only one succeeds if insufficient balance)
- Dispute flow: raise → admin resolves buyer (refund to buyer wallet) and admin resolves seller (settlement to seller wallet)
- Auto-expiry: dispute not resolved in time (BullMQ fires, settlement runs)
- Payout flow: request → approve → process → success and failure webhook
- Discount: concurrent redemption at usage limit (only one succeeds)
- Idempotency: duplicate order request with same key returns same response without processing twice

`@testcontainers/postgresql` spins up a real PostgreSQL container per test suite. TypeORM migrations run before tests. The container is torn down after the suite. This tests actual SQL behaviour — constraint violations, transaction rollbacks, row locks — which cannot be meaningfully tested against mocked repositories.

**What is not tested:**

- Controller methods — they are thin wrappers that call services and return responses. No business logic to test.
- TypeORM repository methods themselves.
- Simple CRUD endpoints with no business logic.

**Vitest configuration:**

`environment: 'node'` is set in `vitest.config.ts`. Tests run with `--pool=forks` to avoid NestJS DI issues in parallel test workers. Test timeout is set to 30 seconds for integration tests that spin up containers.

---

## 22. README and Portfolio Presentation

The README is what a Jointearn reviewer reads before looking at a single line of code. It must communicate the project's technical depth within the first two scrolls.

### README structure

1. **Project overview** — one paragraph: what Tradeloop is, what technical domains it covers, why it was built
2. **Architecture diagram** — a module dependency diagram showing how the major systems connect (auth, wallet/escrow, orders, payments, logistics, fraud, notifications)
3. **Technical highlights** — a bulleted list of the most impressive technical decisions:
   - Ledger-based wallet system with double-entry accounting pattern
   - TOCTOU-safe concurrent stock and wallet operations using atomic conditional SQL
   - Pluggable payment provider interface (Paystack and Flutterwave)
   - Pluggable logistics interface with mock provider for development
   - Configurable fraud rule engine with Redis velocity tracking
   - Full order lifecycle with escrow hold, commission settlement, and dispute resolution
   - Idempotent order creation with idempotency key header
   - Exponential backoff webhook delivery with dead letter queue
   - Shared Zod schemas between NestJS backend and React frontend
4. **Stack table** — backend, frontend user app, frontend admin app, shared packages, infrastructure
5. **How to run** — three commands: clone, copy env, docker-compose up
6. **Environment variables reference** — table with name, required/optional, description
7. **API documentation** — link to Swagger UI (development only)
8. **Bull Board** — screenshot of the queue monitoring interface
9. **Test suite** — how to run tests, what is covered

### Cover letter note

The cover letter references Jointearn's platform model directly. The technical language mirrors what the job description asks for. It does not summarise the README — it states one specific technical overlap (escrow and seller settlement mechanics) and states readiness to enter their codebase immediately.

---

*End of Tradeloop Technical Requirements Document*

*Version 1.0 — compiled from full architecture discussion*
