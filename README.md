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
