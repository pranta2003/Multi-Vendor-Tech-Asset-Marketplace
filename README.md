# Multi-Vendor Tech Asset Marketplace

A production-grade marketplace for digital tech assets (UI kits, code templates, courses) with
vendor onboarding, role-based access control, transactional order fulfilment, and dual payment
gateways — **Stripe** for international cards and **SSLCommerz** for Bangladesh.

Built to demonstrate senior-level engineering decisions, not just working features. Nearly every
non-obvious choice in this codebase carries a comment explaining *why*.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 6 + TypeScript + Tailwind CSS + Zustand |
| Backend | Node.js 20 + Express 4 + TypeScript |
| Database | PostgreSQL 16 + Prisma ORM 5 |
| Auth | JWT access tokens + rotating refresh tokens in HttpOnly cookies + Argon2id |
| Payments | Stripe (webhooks) · SSLCommerz (IPN) |
| API docs | Swagger UI / OpenAPI 3.0.3 |
| Infra | Docker multi-stage builds · Docker Compose · nginx |

Deliberately **not** Next.js — this is a client-rendered SPA talking to a standalone REST API, so
the two halves can be scaled, deployed, and reasoned about independently.

---

## Architecture

```
                    ┌──────────────────────────────────────────┐
  Browser  ─────────►  web  (nginx :80)                        │
                    │    • serves the built SPA                │
                    │    • reverse-proxies /api ──────────┐    │
                    └─────────────────────────────────────┼────┘
                                                          │  same origin
                    ┌─────────────────────────────────────▼────┐
                    │  api  (Express :5000)  — not published    │
                    │    routes → controllers → services → db  │
                    └─────────────────────────────────────┬────┘
                                                          │
                    ┌─────────────────────────────────────▼────┐
                    │  postgres :5432        — not published    │
                    └──────────────────────────────────────────┘
```

**Only the `web` container publishes a port.** The API and database are reachable solely on the
private Docker network. Two consequences worth stating explicitly:

1. Postgres is never exposed to the host or the internet in production.
2. The API cannot be called around nginx, so no client can dodge the rate limiter or forge the
   `X-Forwarded-For` chain that the limiter depends on.

### Why the SPA and API share one origin

The refresh token lives in an `HttpOnly` cookie scoped to `Path=/api/v1/auth`. If the browser
reached the API on a *different* origin, that cookie would be cross-site and would require
`SameSite=None; Secure` — a strictly weaker CSRF posture that also fails outright over plain HTTP.

Routing `/api` through nginx (production) and through the Vite dev proxy (development) makes the
cookie same-origin in **both** environments, so identical cookie attributes work everywhere. That
symmetry is why there are no environment-specific auth branches in the client code — and
environment-specific auth branches are where "works on my machine" bugs are born.

---

## Prerequisites

- **Docker Engine 24+** with the Compose v2 plugin (`docker compose`, not `docker-compose`), or
- **Node.js 20+** and a local **PostgreSQL 14+** if running natively.

---

## Quick start with Docker

```bash
# 1. Configure
cp .env.example .env

# 2. Generate two DIFFERENT strong secrets and paste them into .env
openssl rand -base64 48   # -> JWT_ACCESS_SECRET
openssl rand -base64 48   # -> JWT_REFRESH_SECRET

# 3. For local HTTP, relax the cookie flag in .env:
#      COOKIE_SECURE=false
#    (see the warning below before changing this)

# 4. Build and start
docker compose up --build -d

# 5. Watch it come up
docker compose logs -f api
```

Then open:

| URL | What |
|---|---|
| http://localhost:8080 | The application |
| http://localhost:8080/api/docs | Swagger UI (requires `ENABLE_SWAGGER_UI=true`) |
| http://localhost:8080/api/v1/health | Health probe (runs `SELECT 1`) |

> **`COOKIE_SECURE` and plain HTTP.** The server refuses to boot in production with
> `COOKIE_SECURE=false` — that guard is intentional. But a `Secure` cookie is only ever sent over
> HTTPS, so with `NODE_ENV=production` over plain `http://localhost` the browser silently discards
> the refresh cookie and every session dies at the 15-minute access-token expiry. For local
> HTTP testing set `COOKIE_SECURE=false`; for any real deployment terminate TLS and set it `true`.
> There is no third option that is both secure and functional.

### Startup ordering

`docker compose up` resolves this graph, and each edge exists for a reason:

```
postgres (healthy) ──► migrate (exits 0) ──► api (healthy) ──► web
```

- **`postgres` healthy** uses `pg_isready -U <user> -d <db>` rather than bare `pg_isready`, which
  would check the default `postgres` database and can report ready before *our* database has
  finished initialising.
- **`migrate` is a one-shot job, not a startup hook.** If the API is ever scaled past one replica,
  every replica would race to apply the same migration on boot. Prisma's advisory lock prevents
  corruption, but the losers block and can fail their own health checks. A dedicated job runs
  exactly once, and the API refuses to start unless it exits `0` — so the API never serves traffic
  against a schema it does not expect.
- **`web` waits for `api` *healthy*,** not merely started, so the first page load cannot hit a 502
  from nginx while Express is still connecting to Postgres.

### Seeding demo data

The production image deliberately ships without the Prisma CLI or `tsx`, so seed from the
`migrator` stage, which has both:

```bash
docker compose run --rm --entrypoint sh migrate -c "npx tsx scripts/seed-test.ts"
```

Creates an approved vendor, an admin, two customers, and products with known stock levels.
All seeded accounts use the password `Str0ngPass` — **development only.**

---

## Local development without Docker

The recommended loop. Vite HMR and `tsx watch` are both slower and less reliable across a Docker
bind mount (every filesystem event crosses a virtualisation boundary on macOS and Windows), so only
the database is containerised.

```bash
# Database only, port 5432 published to the host
docker compose -f docker-compose.dev.yml up -d

# Install both packages
npm run install:all

# Apply migrations, then seed
npm run prisma:deploy
npm run seed

# Two terminals
npm run dev:server     # http://localhost:5000
npm run dev:client     # http://localhost:5173
```

`server/src/config/env.ts` loads `../.env` and then `server/.env`, so the root `.env` works for
native runs too.

Prefer everything in containers? `docker compose -f docker-compose.dev.yml --profile full up --build`.

### On the absence of npm workspaces

`server/` and `client/` are independent packages, each with its own `package-lock.json`. The root
`package.json` declares **no** workspaces, which is a deliberate trade-off.

Workspaces hoist a single `node_modules` and a single root lockfile. That actively hurts the Docker
build here: each Dockerfile copies only its own `package.json` + `package-lock.json` to create an
`npm ci` layer that survives source changes. With a hoisted root lockfile, every image would need
the whole monorepo in its build context, and bumping a *frontend* dependency would invalidate the
*backend's* dependency layer. Independent locks also mean the API image installs zero frontend
packages — a smaller image and a smaller CVE surface. The root `scripts` provide monorepo
ergonomics without the coupling.

Built to demonstrate senior-level engineering decisions, not just working features. Nearly every
non-obvious choice in this codebase carries a comment explaining *why*.

---

## Environment variables

Every value is validated by a Zod schema at boot (`server/src/config/env.ts`). A missing or
malformed value **exits the process with an explicit message** rather than failing later at
runtime — a misconfigured JWT secret should be a startup crash, never a silent auth hole.

**Required, no default:** `CLIENT_ORIGIN`, `SERVER_ORIGIN`, `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SSLCZ_STORE_ID`,
`SSLCZ_STORE_PASSWORD`.

See [`.env.example`](./.env.example) for the fully annotated list. Four that cause real incidents:

| Variable | Why it matters |
|---|---|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Min 32 chars and **must differ**. They sign tokens with different lifetimes and different powers; if one key signed both, a stolen 15-minute access token could be replayed as a 7-day refresh token, defeating rotation entirely. |
| `CLIENT_ORIGIN` / `SERVER_ORIGIN` | The origins a *browser* uses — never internal container hostnames. They feed the CORS allow-list and build the gateway redirect/IPN callback URLs. Wrong values let checkout appear to work and then strand the customer on a dead URL after payment. |
| `COOKIE_SECURE` | Must be `true` in production; the server exits otherwise. |
| `VITE_*` | **Inlined into the public JavaScript bundle at build time.** Not read at runtime. |

### The `VITE_*` rule

Anything prefixed `VITE_` is compiled into a static asset every visitor downloads.

- Only the Stripe **publishable** key (`pk_...`) belongs there. It is designed to be public.
- The **secret** key must never appear in a `VITE_*` variable.
- Because these are build-time values, changing one requires `docker compose up --build`. A
  restart will not pick it up.

`client/Dockerfile` enforces this: after `vite build` it greps the output for `sk_test_`,
`sk_live_`, `whsec_` and `SSLCZ_STORE_PASSWORD` and **fails the build** on a match. Someone adding
`VITE_STRIPE_SECRET_KEY` "just to test" gets a red build instead of a live credential leak.

---

## Database

```bash
npm run prisma:migrate    # create + apply a migration (development)
npm run prisma:deploy     # apply pending migrations (production/CI)
npm run prisma:studio     # browse data
npm run prisma:generate   # regenerate the typed client
```

Migration history:

| Migration | Purpose |
|---|---|
| `20260903232000_enable_extensions` | `CREATE EXTENSION citext, pgcrypto` |
| `20260903232507_init` | Full schema — 15 tables |

The extensions live in **migration history**, not only in `docker/postgres/init.sql`. `init.sql`
runs only when the Postgres image initialises an empty data directory, which covers
`docker compose up` on a fresh volume but does nothing for a managed database (RDS, Cloud SQL, Neon,
Supabase) where you cannot place a file in `/docker-entrypoint-initdb.d`. Since `users.email` is
`CITEXT`, its `CREATE TABLE` fails with `type "citext" does not exist` if the extension is missing —
so the requirement has to travel with the schema. `init.sql` is retained as idempotent
defence-in-depth.

`CITEXT` means `Foo@x.com` and `foo@x.com` are the same account, enforced by a unique index in the
database rather than by remembering to `.toLowerCase()` at every call site.

---

## Payment webhooks in development

Gateways cannot reach `localhost`, so forward them:

```bash
# Stripe
stripe listen --forward-to localhost:5000/api/v1/payments/stripe/webhook
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET

# SSLCommerz IPN — expose the port, then set the tunnel URL as SERVER_ORIGIN
ngrok http 5000
```

**Fulfilment is driven by the webhook/IPN, never by the browser redirect.** A redirect is a
client-controlled URL that a user could simply visit; treating it as proof of payment would hand out
paid downloads for free. The redirect only navigates the UI — entitlement is granted when a
signature-verified gateway callback arrives, and order status plus stock are updated inside a
database transaction so concurrent checkouts cannot oversell a limited-stock item.

---

## Verification

```bash
npm run typecheck          # both packages, zero errors
npm run validate:openapi    # 49 structural assertions over the generated spec
python3 scripts/validate-infra.py   # 83 assertions over the Docker/env config
```

`validate-infra.py` checks things that are easy to get silently wrong: both compose files parse;
every Zod-required variable appears in `.env.example` *and* is passed to the `api` service; every
`${VAR}` in compose is documented; no literal secrets are hardcoded; Postgres and the API are not
published in production; the `depends_on` conditions are correct; every named volume and network is
declared; and each `build.target` names a stage that actually exists in the Dockerfile.

`validate:openapi` exists because `swagger-jsdoc` **silently skips** malformed YAML blocks — a route
can vanish from the documentation with no warning at all.

---

## Deploying to production

1. **Terminate TLS in front of `web`** (Caddy, Traefik, an ALB, or Cloudflare). Nothing in this
   stack terminates HTTPS. `COOKIE_SECURE=true` requires it, and so does `SameSite=Lax` being
   meaningful.
2. **Set real origins.** `CLIENT_ORIGIN` and `SERVER_ORIGIN` both become your public HTTPS URL.
3. **Rotate every secret.** Fresh `openssl rand -base64 48` values, a strong `POSTGRES_PASSWORD`,
   live gateway credentials, and `SSLCZ_IS_LIVE=true` together with live SSLCommerz credentials —
   changing one without the other fails every transaction.
4. **Rebuild the SPA** so the live publishable key is inlined:
   `docker compose build --build-arg VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... web`
5. **Decide on `ENABLE_SWAGGER_UI`.** The compose file defaults it to `false` (secure by default);
   `.env.example` ships `true` so the demo is explorable. Interactive docs enumerate every
   endpoint, payload shape and validation rule — a feature for a portfolio, reconnaissance for a
   real product.
6. **Back up the `postgres_data` volume.** `docker compose down` preserves it; `down -v` destroys
   it. Take real `pg_dump` backups off-host.

### Known trade-offs

Stated plainly rather than hidden:

- **Sourcemaps are published.** `vite.config.ts` sets `sourcemap: true`, so `dist/assets/*.map`
  ship and your frontend source is readable in DevTools. For a portfolio that is arguably a
  feature. For a commercial product, set `sourcemap: false` or upload maps to an error tracker
  instead of serving them. No secrets are exposed either way — this was verified.
- **nginx workers run as the unprivileged `nginx` user, but the master runs as root** (the official
  image's default, required to bind port 80). A fully rootless variant needs a high port and
  writable-path changes.
- **Rate limiting is in-process memory.** Correct for one API replica. Multiple replicas need a
  shared store (`rate-limit-redis`), or each replica enforces its own fraction of the limit.
- **No CSRF token.** `SameSite=Lax` plus a refresh cookie scoped to `Path=/api/v1/auth` plus a
  `Bearer` access token that must be attached by JavaScript covers the standard vectors. A
  defence-in-depth double-submit token would be the next hardening step.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `api` exits immediately, logs `Invalid environment configuration` | A required variable is missing or malformed. The log names each offending key. |
| Compose aborts with `JWT_ACCESS_SECRET is required` | The `${VAR:?...}` guard fired before any container started. You have no `.env`, or the key is blank. |
| `type "citext" does not exist` | Migrations were applied out of order, or an old volume predates the extensions migration. `docker compose down -v` then `up --build` (destroys data). |
| Login works, then everything 401s after ~15 min | The refresh cookie is being dropped. `COOKIE_SECURE=true` over plain HTTP — use HTTPS or set it `false` locally. |
| `web` returns 502 | `api` is unhealthy. `docker compose logs api`. |
| Stripe key is `undefined` in the browser | `VITE_*` is build-time. You restarted instead of rebuilding: `docker compose up --build web`. |
| `invalid ELF header` for argon2 in the full dev profile | The host `node_modules` shadowed the container's native build. The anonymous `/app/node_modules` volume prevents this — do not remove it. |
| 429 on login while developing | `AUTH_RATE_LIMIT_MAX` defaults to 10 per 15 min. The dev profile raises it to 1000. |
| `web` won't start: `open() "/etc/nginx/snippets/security-headers.conf" failed` | `client/security-headers.conf` was not copied into the image. `nginx.conf` and the `COPY` in `client/Dockerfile` must reference the identical path. |

### One nginx behaviour worth internalising

`add_header` does **not** accumulate across configuration levels. If a `location` block declares any
`add_header` of its own, every `add_header` inherited from `server` is **discarded silently**.

This config originally declared the three security headers once at `server` level. Because both
`location /` and `location /assets/` set their own `Cache-Control`, the real responses carried
**none** of them — `nginx -t` passes, the site works, and the headers are simply absent. It was
caught only by asserting on actual response headers with `curl -I`. They now live in
`security-headers.conf`, included by each location so the copies cannot drift.

Same class of bug in the same file: `expires 1y` *plus* `add_header Cache-Control` emits **two**
conflicting `Cache-Control` headers. It is now a single header. `scripts/validate-infra.py` guards
against both regressions.

---

## Project layout

```
.
├── docker-compose.yml           # production stack (web → api → postgres)
├── docker-compose.dev.yml       # dev: postgres only, or --profile full
├── .env.example                 # annotated single source of env truth
├── package.json                 # root task runner (no workspaces — see above)
├── docker/postgres/init.sql     # first-boot extensions (defence-in-depth)
├── scripts/validate-infra.py    # 83 infra assertions
├── server/
│   ├── Dockerfile               # deps → builder → migrator → runner
│   ├── prisma/                  # schema + migrations
│   └── src/
│       ├── config/              # env (Zod), prisma, swagger, logger
│       ├── middleware/          # auth, RBAC, validation, rate limits, errors
│       ├── modules/             # auth · catalog · cart · orders · payments
│       │   └── <m>/             # routes → controller → service → validation
│       └── utils/               # ApiResponse, custom errors, asyncHandler
└── client/
    ├── Dockerfile               # vite build → nginx (+ secret scan)
    ├── nginx.conf               # SPA fallback + /api proxy
    ├── security-headers.conf    # shared snippet (see the add_header note above)
    └── src/
        ├── api/                 # axios client, single-flight refresh
        ├── components/ pages/ hooks/
        ├── store/               # Zustand slices
        └── types/
```

Each module follows **routes → controller → service**. Controllers only handle HTTP: parse, call a
service, format a response. All business logic, all multi-step database work, and every transaction
lives in the service layer — which is why the order-fulfilment logic is testable without an HTTP
server and reusable from a webhook handler, a CLI script, or a future queue worker.
