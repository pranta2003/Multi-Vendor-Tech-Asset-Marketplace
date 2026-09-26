# AssetHub — Multi-Vendor Tech Asset Marketplace

<div align="center">

### A production-oriented full-stack marketplace for digital technology assets.

[![Live Frontend](https://img.shields.io/badge/Live%20Frontend-Visit%20AssetHub-5B5FEF?style=for-the-badge)](https://multi-vendor-tech-asset-marketplace-ashen.vercel.app)
[![Backend API](https://img.shields.io/badge/Backend%20API-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://multi-vendor-tech-asset-marketplace.vercel.app)
[![API Health](https://img.shields.io/badge/API%20Health-Operational-22C55E?style=for-the-badge)](https://multi-vendor-tech-asset-marketplace.vercel.app/api/v1/health)
[![CI](https://github.com/pranta2003/Multi-Vendor-Tech-Asset-Marketplace/actions/workflows/ci.yml/badge.svg)](https://github.com/pranta2003/Multi-Vendor-Tech-Asset-Marketplace/actions/workflows/ci.yml)

**Frontend:** React + Vite + TypeScript  
**Backend:** Node.js + Express + TypeScript  
**Database:** PostgreSQL + Prisma  
**Payments:** Stripe + SSLCommerz

</div>

---

## 🌐 Live Project

| Service | URL |
|---|---|
| 🛍️ **Frontend / Marketplace** | [Open AssetHub](https://multi-vendor-tech-asset-marketplace-ashen.vercel.app) |
| ⚙️ **Backend API** | [Open Backend API](https://multi-vendor-tech-asset-marketplace.vercel.app) |
| ❤️ **API Health Check** | [Check API Status](https://multi-vendor-tech-asset-marketplace.vercel.app/api/v1/health) |

> **AssetHub** is a full-stack multi-vendor marketplace for digital technology assets such as UI kits, code templates, mobile templates, DevOps resources, and courses.

The platform provides customers with a complete marketplace experience — from authentication and product discovery to cart, checkout, payment verification, digital fulfilment, order history, account management, and customer support.

The repository contains both the **React frontend** and the **Express/TypeScript backend** in a single monorepo while keeping the two applications independently deployable.

---

## ✨ Project Highlights

- 🔐 Secure JWT authentication with rotating HttpOnly refresh tokens
- 🔑 Google Sign-In through Firebase Authentication
- 👥 Role-based access control for customers, vendors, and administrators
- 🏪 Vendor onboarding and product management
- 🛍️ Multi-vendor digital marketplace
- 🔎 Product catalog with categories, filtering, sorting, and pagination
- 🛒 Shopping cart and checkout workflow
- 💳 Stripe payment integration for international payments
- 🇧🇩 SSLCommerz integration for Bangladesh
- 🔔 Webhook/IPN-based payment verification
- 📦 Transactional digital asset fulfilment
- 📚 Customer purchase library and order history
- 👤 Customer account and profile dashboard
- 🎫 Customer support ticket system
- 📧 Resend-powered support notification emails
- 📖 OpenAPI / Swagger API documentation
- 🛡️ Request validation, rate limiting, security headers, and structured errors
- 🗄️ PostgreSQL with Prisma ORM and migrations
- 🐳 Docker multi-stage production architecture
- ⚙️ GitHub Actions CI
- ☁️ Vercel production deployment
- 🧪 Automated typecheck, API validation, infrastructure validation, tests, and production builds

---

## 🎯 What This Project Demonstrates

AssetHub was built to demonstrate practical production-oriented engineering decisions rather than only feature implementation.

The codebase focuses on:

- secure authentication
- role-based authorization
- transactional database operations
- payment verification
- webhook-driven fulfilment
- server-side validation
- API architecture
- deployment reliability
- database migrations
- containerized infrastructure
- automated CI
- error handling
- maintainable separation of concerns

Nearly every non-obvious architectural decision is intentional and documented where appropriate.

The goal is to build a system that behaves more like a real production application than a simple CRUD marketplace.

---

# 🧰 Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 6 + TypeScript |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Backend | Node.js 20 + Express 4 + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Authentication | JWT + rotating HttpOnly refresh tokens + Argon2id |
| Social Authentication | Firebase Authentication / Google Sign-In |
| Payments | Stripe + SSLCommerz |
| Email | Resend |
| API Documentation | Swagger UI / OpenAPI 3.0.3 |
| Validation | Zod |
| Infrastructure | Docker + Docker Compose + nginx |
| CI/CD | GitHub Actions |
| Production Frontend | Vercel |
| Production Backend | Vercel |
| Database Hosting | PostgreSQL-compatible managed database |

Deliberately **not Next.js** — the frontend is a client-rendered React SPA communicating with a standalone REST API. This keeps the frontend and backend independently deployable and easier to reason about.

---

# 🏗️ Architecture

## Production Architecture

The production deployment uses two Vercel projects from the same repository.

```text
                         ┌──────────────────────────┐
                         │       User Browser       │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │    Vercel Frontend       │
                         │     React + Vite SPA     │
                         └────────────┬─────────────┘
                                      │
                               /api/* rewrite
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │     Vercel Backend       │
                         │  Express + TypeScript    │
                         └────────────┬─────────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │       PostgreSQL         │
                         │        Prisma ORM        │
                         └──────────────────────────┘
```
Local / Docker Architecture

The repository also provides a Dockerized production-style architecture:

                         ┌──────────────────────────────┐
                         │        Browser               │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────┐
                         │       web / nginx :80        │
                         │                              │
                         │  • serves React SPA          │
                         │  • reverse-proxies /api      │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────┐
                         │       api / Express :5000    │
                         │                              │
                         │ routes → controllers        │
                         │          → services         │
                         │          → database          │
                         └──────────────┬───────────────┘
                                        │
                                        ▼
                         ┌──────────────────────────────┐
                         │       PostgreSQL :5432       │
                         └──────────────────────────────┘

Only the web container publishes a port.

The API and PostgreSQL database remain on the private Docker network.

This provides two important properties:

PostgreSQL is never directly exposed to the host or internet.
API traffic passes through nginx, allowing the application to maintain a consistent gateway and rate-limiting model.
Why the SPA and API Share One Origin

The refresh token is stored in an HttpOnly cookie scoped to:

Path=/api/v1/auth

If the browser accessed the API from a different origin, that cookie would become cross-site and require:

SameSite=None; Secure

Routing /api through nginx in Docker production and through the Vite development proxy locally keeps the API effectively same-origin in both environments.

This allows the application to use the same cookie security model across environments without introducing environment-specific authentication branches.

🔐 Authentication & Authorization

AssetHub uses a layered authentication architecture.

Email / Password Authentication

The backend provides:

account registration
login
password hashing using Argon2id
short-lived JWT access tokens
rotating refresh tokens
HttpOnly refresh cookies
token expiration
protected API routes

The refresh token is intentionally kept out of JavaScript-accessible storage.

Google Sign-In

Google authentication is implemented through Firebase Authentication.

User
  ↓
Google Sign-In
  ↓
Firebase Authentication
  ↓
Verified Google identity
  ↓
AssetHub backend
  ↓
Find / create marketplace user
  ↓
Existing JWT session
  ↓
HttpOnly refresh cookie

Google authentication supplements the existing email/password authentication rather than replacing it.

Role-Based Access Control

The system separates access between:

Customer
Vendor
Administrator

Authorization is enforced on the backend rather than relying only on frontend route protection.

🛍️ Marketplace Features
Product Catalog

Customers can:

browse digital assets
filter by category
sort products
paginate through results
view product details
inspect ratings
view product galleries
add products to cart
proceed through checkout

Supported asset categories include areas such as:

UI Kits
Boilerplates
Mobile Templates
DevOps Resources
Courses
Vendor Management

The marketplace supports vendor-oriented workflows including:

vendor onboarding
vendor profiles
product management
asset publishing
vendor-specific product ownership
role-based vendor permissions

The backend keeps marketplace business logic separate from HTTP controllers through the service layer.

🛒 Cart & Checkout

The checkout workflow is designed around server-side validation and transactional integrity.

Customer
   ↓
Cart
   ↓
Checkout
   ↓
Order Creation
   ↓
Payment
   ↓
Gateway Verification
   ↓
Order Fulfilment
   ↓
Digital Asset Library

The browser redirect itself is never treated as proof of payment.

Payment fulfilment is driven by verified gateway callbacks.

💳 Payment System

AssetHub supports two payment gateways.

Stripe

Stripe is used for international payment processing.

The system supports:

Stripe checkout
webhook processing
signature verification
payment status updates
order fulfilment
transactional order updates
SSLCommerz

SSLCommerz is integrated for Bangladesh-focused payments.

The system supports:

SSLCommerz checkout
IPN handling
payment verification
transaction updates
order fulfilment
Payment Security Model

Fulfilment is driven by verified gateway callbacks rather than browser redirects.

Payment Gateway
      │
      ▼
Webhook / IPN
      │
      ▼
Signature Verification
      │
      ▼
Payment Status Update
      │
      ▼
Transactional Order Fulfilment
      │
      ▼
Customer Digital Library

A redirect is a client-controlled navigation event and therefore cannot be treated as proof of payment.

This prevents users from obtaining paid digital assets simply by visiting a success URL.

Order status, stock changes, and fulfilment are handled through database transactions to protect against inconsistent concurrent checkouts.

📦 Digital Asset Fulfilment

After a successfully verified payment:

The order is marked appropriately.
The purchased asset is associated with the customer.
The customer's digital library is updated.
The customer can access purchased assets from the account area.

The browser redirect is only responsible for navigating the user interface.

👤 Customer Account

Customers have access to an account dashboard containing areas such as:

profile information
order history
purchased assets
digital library
support tickets
account-related information

The account experience is designed around the needs of an actual marketplace customer rather than only exposing raw database records.

🎫 Customer Support System

AssetHub includes a dedicated Contact Us / Customer Support system.

Customers can submit:

full name
email
phone number
inquiry type
order ID
subject
support message

Each submission becomes a support ticket with a unique ticket reference.

Support Workflow
Customer
   ↓
Contact Us Form
   ↓
POST /api/v1/contact
   ↓
Support Ticket
   ↓
PostgreSQL
   ↓
Resend Notification
   ↓
Support Inbox

Support notifications are sent to the configured support address.

The email includes customer information, ticket information, subject, message, and submission details.

The customer's email is used as the Reply-To address so the support team can reply directly to the customer.

Support Email Delivery

The notification system uses Resend for transactional email delivery.

The backend safely handles:

successful delivery
missing API configuration
provider failures
delivery status persistence
structured logging

A ticket is not deleted if an email provider fails.

The support request remains stored in PostgreSQL so it can still be handled from the support system.

📖 API Documentation

The backend exposes OpenAPI documentation through Swagger UI when enabled.

Local Docker URL:

http://localhost:8080/api/docs

The API specification is validated automatically in CI to prevent malformed Swagger definitions from silently removing routes from the generated documentation.

🧱 Backend Architecture

The backend follows a layered structure:

Routes
  ↓
Controllers
  ↓
Services
  ↓
Prisma / Database

Controllers are intentionally kept thin.

They are responsible for:

reading HTTP input
calling services
formatting responses

Business logic belongs in services.

This makes business operations reusable from:

HTTP handlers
webhook handlers
CLI scripts
future background workers

and makes multi-step database operations easier to test independently.

🗄️ Database

The application uses PostgreSQL with Prisma ORM.

Prisma provides:

schema management
typed database access
migrations
transactions
relational data modelling

Useful commands:

npm run prisma:migrate
npm run prisma:deploy
npm run prisma:studio
npm run prisma:generate
Database design principles

The database layer emphasizes:

relational integrity
unique constraints
transactional operations
explicit migrations
case-insensitive email handling
safe order fulfilment
predictable schema evolution

CITEXT is used for email addresses so values such as:

Foo@example.com
foo@example.com

are treated as the same account at the database level.

🐳 Prerequisites

For Docker development:

Docker Engine 24+
Docker Compose v2

For native development:

Node.js 20+
npm 10+
PostgreSQL 14+
🚀 Quick Start with Docker
1. Configure environment variables
cp .env.example .env

Generate strong JWT secrets:

openssl rand -base64 48

Generate two different values:

JWT_ACCESS_SECRET
JWT_REFRESH_SECRET

For local HTTP development:

COOKIE_SECURE=false

Do not use COOKIE_SECURE=false in real production deployments.

2. Build and start
docker compose up --build -d

Watch the API logs:

docker compose logs -f api
3. Open the application
http://localhost:8080

Swagger UI:

http://localhost:8080/api/docs

Health check:

http://localhost:8080/api/v1/health
🔄 Startup Ordering

Docker Compose resolves the application startup graph:

PostgreSQL healthy
        ↓
Migration job
        ↓
API healthy
        ↓
Web / nginx

This prevents the application from serving requests before the database schema and API are ready.

The migration process is intentionally separated from API startup.

This avoids multiple API replicas racing to apply the same migrations during scaling.

🌱 Seeding Demo Data

The production image deliberately does not ship with development tooling such as the Prisma CLI and tsx.

Seed from the migrator stage:

docker compose run --rm --entrypoint sh migrate -c "npx tsx scripts/seed-test.ts"

The development seed creates sample marketplace data including:

an approved vendor
an administrator
customers
products
known stock levels

Any seeded credentials are intended for development only.

Never reuse development credentials in production.

💻 Local Development Without Docker

Start the development database:

docker compose -f docker-compose.dev.yml up -d

Install dependencies:

npm run install:all

Apply migrations:

npm run prisma:deploy

Seed development data:

npm run seed

Start the backend:

npm run dev:server

Start the frontend in another terminal:

npm run dev:client

Development URLs:

Frontend:
http://localhost:5173

Backend:
http://localhost:5000
📁 Project Structure
.
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── client/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── security-headers.conf
│   └── src/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── store/
│       ├── types/
│       └── ...
│
├── server/
│   ├── Dockerfile
│   ├── api/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── modules/
│       └── utils/
│
├── docker/
│   └── postgres/
│       └── init.sql
│
├── scripts/
│   └── validate-infra.py
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── package.json
└── README.md
🧩 Backend Module Structure

Backend modules are organized around business domains.

server/src/modules/

├── auth/
├── catalog/
├── cart/
├── orders/
├── payments/
├── contact/
└── ...

Each module generally follows:

routes
   ↓
controller
   ↓
service
   ↓
database

This keeps business logic isolated from HTTP concerns.

🔐 Environment Variables

Every backend environment variable is validated through a Zod schema during startup.

A missing or malformed required variable causes the application to fail explicitly rather than continuing with an unsafe configuration.

Important production variables include:

CLIENT_ORIGIN
SERVER_ORIGIN
DATABASE_URL

JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_EXPIRES_IN
JWT_REFRESH_EXPIRES_IN

COOKIE_SECURE
COOKIE_DOMAIN
COOKIE_SAME_SITE

STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_CURRENCY

SSLCZ_STORE_ID
SSLCZ_STORE_PASSWORD
SSLCZ_IS_LIVE
SSLCZ_CURRENCY

RATE_LIMIT_WINDOW_MS
RATE_LIMIT_MAX
AUTH_RATE_LIMIT_MAX

RESEND_API_KEY
SUPPORT_EMAIL
RESEND_FROM_EMAIL

See:

.env.example

for the fully documented environment configuration.

⚠️ Environment Security

Never commit:

.env
.env.*

or any private credential.

Never place backend secrets in:

VITE_*

variables.

Anything prefixed with VITE_ is compiled into the frontend JavaScript bundle and can be downloaded by every visitor.

Only public credentials such as a Stripe publishable key belong in the frontend environment.

For example:

VITE_STRIPE_PUBLISHABLE_KEY=pk_...

The following must never be exposed to the frontend:

STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SSLCZ_STORE_PASSWORD
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
DATABASE_URL
RESEND_API_KEY
🔑 The VITE_* Rule

Vite environment variables are build-time values.

That means changing:

VITE_*

requires rebuilding the frontend.

For Docker:

docker compose up --build

For Vercel, a new frontend deployment is required.

The client Dockerfile also performs a secret scan against the production bundle and fails the build if known backend secret patterns are detected.

💳 Payment Webhooks in Development

Payment gateways cannot directly reach localhost.

For Stripe:

stripe listen --forward-to localhost:5000/api/v1/payments/stripe/webhook

Copy the generated webhook secret into:

STRIPE_WEBHOOK_SECRET

For SSLCommerz, expose the local backend through a secure tunnel and configure the appropriate public server URL.

Example:

ngrok http 5000
🛡️ Security Principles

The project includes multiple layers of security.

Authentication
Argon2id password hashing
JWT access tokens
rotating refresh tokens
HttpOnly cookies
token expiration
Authorization
backend RBAC
protected routes
role-aware operations
Input Security
Zod validation
request validation
structured error handling
rate limiting
Payment Security
webhook signature verification
IPN verification
server-side payment state
transactional fulfilment
Infrastructure Security
private Docker network
nginx security headers
non-public database
environment validation
secret scanning
controlled production configuration
⚙️ CI / GitHub Actions

The repository uses GitHub Actions to automatically verify changes.

The CI pipeline validates the application before changes are merged into main.

Checks include:

server typecheck
client typecheck
OpenAPI validation
infrastructure validation
production build
automated tests where configured

The purpose of CI is to catch configuration, type, build, API, and infrastructure regressions before they reach the production branch.

🧪 Verification

Run the root typecheck:

npm run typecheck

Validate the OpenAPI specification:

npm run validate:openapi

Validate infrastructure:

python3 scripts/validate-infra.py

Run contact/support tests:

npm run test:contact

Build the complete application:

npm run build

The infrastructure validation covers areas such as:

Docker Compose syntax
required environment variables
compose variable references
secret detection
private API/database ports
dependency conditions
declared networks
declared volumes
valid Docker build targets
🗃️ Database Migration Workflow

For development:

npm run prisma:migrate

For production or CI:

npm run prisma:deploy

Generate Prisma Client:

npm run prisma:generate

Open Prisma Studio:

npm run prisma:studio

Production deployments should apply existing migrations with:

prisma migrate deploy

rather than using development migration commands against production databases.

☁️ Production Deployment

The current production deployment uses Vercel while the repository retains a complete Docker deployment architecture for local and alternative infrastructure environments.

Frontend

Vercel project root:

client

The frontend is built using Vite and deployed as a production SPA.

Backend

Vercel project root:

server

The Express application uses a serverless-compatible entrypoint.

API Routing

The frontend rewrites:

/api/*

to the production backend.

This allows the browser to communicate with the backend through the frontend origin while keeping the backend independently deployed.

🗺️ Production URLs
Frontend
https://multi-vendor-tech-asset-marketplace-ashen.vercel.app
Backend
https://multi-vendor-tech-asset-marketplace.vercel.app
Health
https://multi-vendor-tech-asset-marketplace.vercel.app/api/v1/health

The health endpoint verifies that the production API is operational.

🏭 Production Deployment Considerations

For a traditional Docker deployment:

Terminate TLS in front of nginx using infrastructure such as Caddy, Traefik, an ALB, or Cloudflare.
Configure real HTTPS origins.
Set:
COOKIE_SECURE=true
Use production payment credentials.
Rotate all secrets.
Build the frontend with the correct public publishable keys.
Keep PostgreSQL private.
Back up the production database.
Apply Prisma migrations before serving traffic.
Keep Swagger UI disabled unless it is intentionally required.
⚖️ Known Trade-offs

The project intentionally documents its current trade-offs rather than hiding them.

Frontend sourcemaps

Frontend sourcemaps are currently published for easier debugging and portfolio inspection.

For a commercial production system, sourcemaps could instead be uploaded to an error tracking service and removed from the public bundle.

No backend secrets are exposed through the sourcemaps.

In-process rate limiting

Rate limiting currently uses in-process memory.

This is appropriate for a single API replica.

If the backend is horizontally scaled across multiple replicas, a shared store such as Redis should be introduced so that rate-limit state is consistent between instances.

CSRF defence

The current authentication architecture relies on:

SameSite=Lax
HttpOnly refresh cookies
refresh-cookie path restriction
Bearer access tokens attached by JavaScript

A future hardening step could introduce a double-submit CSRF token for additional defence-in-depth.

🧠 Engineering Decisions

Several architectural decisions in this repository are intentional.

Independent frontend and backend packages

The repository does not use npm workspaces.

client/ and server/ maintain their own:

package.json
package-lock.json

This keeps their dependency trees independent.

It also improves Docker layer caching because the backend image does not need to install frontend dependencies.

Service-layer business logic

Business logic is kept outside controllers.

This makes complex workflows such as:

checkout
payment verification
fulfilment
support ticket processing
transactional updates

easier to test and reuse.

Database-driven fulfilment

The application does not trust a browser redirect as proof of payment.

Instead:

Gateway callback
      ↓
Verification
      ↓
Database transaction
      ↓
Order update
      ↓
Fulfilment

This is essential for digital goods because an incorrectly trusted success redirect could otherwise grant paid content without a verified transaction.

🐞 Troubleshooting
Symptom	Possible cause / solution
API exits immediately	Check required environment variables
JWT_ACCESS_SECRET is required	.env is missing or incomplete
type "citext" does not exist	Database extensions/migrations are incomplete
Login works then becomes unauthorized	Check refresh cookie configuration and HTTPS
web returns 502	Check API health and Docker API logs
Stripe key is undefined	VITE_* values require a frontend rebuild
Contact email is not received	Check Vercel production environment, Resend status, and Gmail Spam/Updates
API returns 429	Rate-limit configuration may have been reached
nginx security headers missing	Check nginx security header configuration
Docker native dependency error	Check host node_modules volumes and rebuild
📬 Customer Support

The production Contact Us system provides a dedicated support workflow.

Support requests are stored as tickets and can be processed through the application's support management interface.

The production notification flow is:

Contact Form
      ↓
Express API
      ↓
SupportTicket
      ↓
PostgreSQL
      ↓
Resend
      ↓
Support Inbox

The support notification contains the submitted customer information and provides a direct Reply-To address.

🧭 Future Improvements

Potential future improvements include:

Redis-backed distributed rate limiting
background job processing
dedicated transactional email domain
advanced vendor analytics
richer marketplace search
recommendation systems
centralized observability
error tracking
automated deployment previews
more advanced admin reporting
scalable object storage for digital assets

These are intentionally separated from the current core architecture so the existing application remains understandable and maintainable.

📂 Repository Layout
.
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── client/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── security-headers.conf
│   └── src/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── store/
│       └── types/
│
├── server/
│   ├── Dockerfile
│   ├── api/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── modules/
│       │   ├── auth/
│       │   ├── catalog/
│       │   ├── cart/
│       │   ├── orders/
│       │   ├── payments/
│       │   └── contact/
│       └── utils/
│
├── docker/
│   └── postgres/
│       └── init.sql
│
├── scripts/
│   └── validate-infra.py
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── package.json
└── README.md
📜 License & Usage

This repository is primarily maintained as a personal engineering and portfolio project.

The source code is provided for educational and demonstration purposes unless otherwise specified by the repository license.

Do not use production credentials, payment keys, database credentials, or other private configuration from this project in another environment.

<div align="center">
⭐ Like the Project?

If you found AssetHub useful, interesting, or helpful as a reference for full-stack development, consider giving the repository a star.
