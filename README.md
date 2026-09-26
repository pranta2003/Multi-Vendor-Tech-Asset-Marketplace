#                                                    AssetHub — Multi-Vendor Tech Asset Marketplace

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
##Local / Docker Architecture

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

##🔐 Authentication

AssetHub supports both traditional and social authentication.

Email / Password
       │
       ▼
Argon2id + JWT
       │
       ▼
HttpOnly Refresh Cookie

Google authentication:

Google
  ↓
Firebase Authentication
  ↓
Backend Verification
  ↓
AssetHub JWT Session

Authorization is enforced server-side through role-based access control.

##💳 Payment & Fulfilment

The platform supports:

Stripe for international payments
SSLCommerz for Bangladesh

Payment fulfilment does not rely on browser redirects.

Payment
   ↓
Webhook / IPN
   ↓
Verification
   ↓
Database Transaction
   ↓
Order Fulfilment
   ↓
Digital Library

This prevents an unverified browser redirect from being treated as proof of payment.

##🎫 Customer Support

AssetHub includes a dedicated support ticket system.

Customer
   ↓
Contact Us
   ↓
Support Ticket
   ↓
PostgreSQL
   ↓
Resend
   ↓
Support Inbox

Support emails contain the submitted customer and ticket information, with the customer's email configured as Reply-To.

##🧱 Backend Architecture

The backend follows a layered architecture:

Routes
  ↓
Controllers
  ↓
Services
  ↓
Prisma
  ↓
PostgreSQL

Business logic stays inside the service layer, keeping controllers thin and making complex workflows easier to test and maintain.

##🚀 Quick Start
Requirements
Node.js 20+
npm 10+
PostgreSQL 14+
Docker Engine 24+ (optional)
Docker
cp .env.example .env
docker compose up --build -d

Application:

http://localhost:8080

Swagger:

http://localhost:8080/api/docs

Health:

http://localhost:8080/api/v1/health
Native Development
npm run install:all
npm run prisma:deploy
npm run seed

Then run:

npm run dev:server
npm run dev:client
##🔑 Environment Variables

Backend configuration is validated at startup.

Important variables include:

DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET

STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

SSLCZ_STORE_ID
SSLCZ_STORE_PASSWORD

RESEND_API_KEY
SUPPORT_EMAIL

Frontend public configuration uses VITE_* variables.

Never expose backend secrets through VITE_* variables or commit .env files.

See .env.example for the complete configuration.

##🧪 Verification

The repository includes automated validation for:

npm run typecheck
npm run validate:openapi
npm run test:contact
npm run build
python scripts/validate-infra.py

GitHub Actions runs the relevant checks before changes are merged into main.

##📁 Repository Structure
.
├── client/                 # React + Vite frontend
├── server/                 # Express + TypeScript backend
│   ├── api/                # Serverless entrypoint
│   ├── prisma/             # Schema & migrations
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── modules/
│       └── utils/
├── docker/                 # PostgreSQL / Docker configuration
├── scripts/                # Infrastructure validation
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── package.json
└── README.md
##🧠 Engineering Focus

AssetHub was built to demonstrate practical production-oriented engineering rather than only feature implementation.

Key areas include:

Secure authentication
RBAC
Transactional database operations
Payment verification
Webhook-driven fulfilment
API validation
Error handling
Rate limiting
Dockerized infrastructure
CI automation
Independent frontend/backend deployment

##🧭 Future Improvements

Potential future improvements include:

Redis-backed distributed rate limiting
Background job processing
Advanced vendor analytics
Richer marketplace search
Recommendation systems
Centralized observability
Advanced admin reporting
Scalable object storage
<div align="center">
##⭐ Like the Project?

If you found AssetHub useful or interesting, consider giving the repository a star.

Built with care, curiosity, and a lot of debugging.

<br>
AssetHub — Multi-Vendor Tech Asset Marketplace

© 2026 Pranta Kumer Pandit. All rights reserved.

</div> ```

This is the version I'd actually use. It is far shorter, but someone landing on the repo immediately sees Live Demo → Backend → Features → Stack → Architecture → Setup → Engineering decisions. The deeper technical details can stay in the code itself instead of turning the README into a technical manual.
