import dotenv from 'dotenv';
import path from 'node:path';
import { PrismaClient, ProductStatus, Role, VendorStatus } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log('[INFO] DATABASE_URL is not set in the current environment.');
    console.log('To seed against your database, run:');
    console.log('  $env:DATABASE_URL="your-connection-string"; npm run seed:marketplace');
    process.exit(0);
  }

  console.log('--- Starting safe marketplace demo data seeding ---');

  const passwordHash = await hashPassword('Str0ngDemoPass1');

  // 1. Upsert Categories (7 diverse tech categories)
  const categoriesData = [
    { name: 'UI Kits & Design Systems', slug: 'ui-kits' },
    { name: 'Frontend & Web Templates', slug: 'frontend-templates' },
    { name: 'SaaS Boilerplates & Starters', slug: 'boilerplates' },
    { name: 'Mobile App Templates', slug: 'mobile-templates' },
    { name: 'Cloud & DevOps Automation', slug: 'devops' },
    { name: 'AI & Machine Learning Tools', slug: 'ai-tools' },
    { name: 'Engineering Masterclasses', slug: 'courses' },
  ];

  const categories: Record<string, string> = {};
  for (const cat of categoriesData) {
    const record = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: cat,
    });
    categories[cat.slug] = record.id;
    console.log(`  Category [${cat.slug}] ready.`);
  }

  // 2. Upsert Demo Vendors
  const vendorsData = [
    {
      email: 'devcraft@marketplace.demo',
      fullName: 'DevCraft Studios',
      storeName: 'DevCraft Studios',
      slug: 'devcraft-studios',
      bio: 'Production-ready full-stack boilerplates and developer toolkits designed for high scale.',
    },
    {
      email: 'pixelpulse@marketplace.demo',
      fullName: 'Sarah Chen',
      storeName: 'PixelPulse Design',
      slug: 'pixelpulse',
      bio: 'Award-winning UI/UX designer crafting accessible, beautiful design systems.',
    },
    {
      email: 'cloudarchitect@marketplace.demo',
      fullName: 'Alex Vance',
      storeName: 'CloudArchitects',
      slug: 'cloudarchitects',
      bio: 'Cloud engineers and site reliability specialists packaging enterprise infra as code.',
    },
    {
      email: 'neuralstack@marketplace.demo',
      fullName: 'Dr. Elena Rostova',
      storeName: 'NeuralStack AI Labs',
      slug: 'neuralstack',
      bio: 'Machine learning researchers building modular pipelines, fine-tuned models, and AI agent frameworks.',
    },
    {
      email: 'codeforge@marketplace.demo',
      fullName: 'Marcus Sterling',
      storeName: 'CodeForge Academy',
      slug: 'codeforge',
      bio: 'Principal engineers delivering masterclasses and deep-dive technical resources for engineering teams.',
    },
  ];

  const vendors: Record<string, string> = {};
  for (const v of vendorsData) {
    const user = await prisma.user.upsert({
      where: { email: v.email },
      update: { fullName: v.fullName, role: Role.VENDOR },
      create: {
        email: v.email,
        fullName: v.fullName,
        passwordHash,
        role: Role.VENDOR,
        isEmailVerified: true,
      },
    });

    const profile = await prisma.vendorProfile.upsert({
      where: { userId: user.id },
      update: { storeName: v.storeName, status: VendorStatus.APPROVED, bio: v.bio },
      create: {
        userId: user.id,
        storeName: v.storeName,
        slug: v.slug,
        bio: v.bio,
        status: VendorStatus.APPROVED,
        commissionRateBps: 1500,
      },
    });

    vendors[v.slug] = profile.id;
    console.log(`  Vendor [${v.storeName}] ready.`);
  }

  // 3. Upsert Demo Products (24 diverse, realistic tech assets)
  const demoProducts = [
    // --- 1. UI Kits & Design Systems (4 products) ---
    {
      title: 'Nexus UI - React & Tailwind Design System',
      slug: 'nexus-ui-design-system',
      summary: '60+ production-grade accessible components, full Figma library, dark mode, and Framer Motion animations.',
      description: `Nexus UI is a meticulously crafted component system built specifically for modern SaaS dashboards and web applications.

Features:
- 60+ fully responsive components built with React and Tailwind CSS
- 100% WCAG 2.1 AA accessibility compliance
- Interactive Figma component library with variants & tokens
- Light, dark, and high-contrast theme tokens
- Animated with smooth, performant Framer Motion gestures
- TypeScript types and Storybook documentation included`,
      priceUsdCents: 4900,
      priceBdtPoisha: 580000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 48,
      ratingCount: 10,
      downloadCount: 142,
      vendorKey: 'pixelpulse',
      categoryKey: 'ui-kits',
      assetFileName: 'nexus-ui-bundle-v2.1.zip',
    },
    {
      title: 'Catalyst Modern Admin Dashboard UI Kit',
      slug: 'catalyst-admin-dashboard-ui',
      summary: '80+ responsive dashboard screens, charts, data tables with virtualization, and authentication flows in React & Tailwind.',
      description: `Catalyst is an enterprise-grade admin dashboard UI kit engineered for CRM, analytics, finance, and logistics applications.

Included:
- 80+ pre-built application screens and widgets
- Interactive charts powered by Chart.js and Recharts
- High-performance data tables with virtualized scrolling, column filtering, and CSV export
- Complete light/dark mode system with system preference detection
- Clean, semantic TypeScript code with zero third-party UI framework bloat`,
      priceUsdCents: 5900,
      priceBdtPoisha: 700000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 92,
      ratingCount: 19,
      downloadCount: 218,
      vendorKey: 'pixelpulse',
      categoryKey: 'ui-kits',
      assetFileName: 'catalyst-dashboard-v1.zip',
    },
    {
      title: 'SwiftDesign iOS 18 Design System & Component Library',
      slug: 'swiftui-modern-component-library',
      summary: '50+ native SwiftUI iOS components, interactive previews, haptics, dynamic island animations, and dark mode.',
      description: `SwiftDesign provides beautiful, modular iOS 17/18 SwiftUI views following Apple Human Interface Guidelines to speed up mobile app development.

Includes:
- 50+ modular native SwiftUI components
- Dynamic Island and Live Activity presentation helpers
- Fluid sheet animations, custom navigation bars, and haptic feedback
- Strict conformance to Apple Human Interface Guidelines
- Comprehensive Xcode preview catalog`,
      priceUsdCents: 4500,
      priceBdtPoisha: 530000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 78,
      ratingCount: 16,
      downloadCount: 135,
      vendorKey: 'pixelpulse',
      categoryKey: 'ui-kits',
      assetFileName: 'swiftdesign-ios-v2.zip',
    },
    {
      title: 'FlutterCraft Cross-Platform Mobile UI Kit',
      slug: 'flutter-craft-design-system',
      summary: 'Over 120+ Flutter widgets, responsive layouts for phones & tablets, state management agnostic, and Figma source files.',
      description: `Accelerate cross-platform mobile development with FlutterCraft, a comprehensive UI library designed for iOS, Android, and Web.

Highlights:
- 120+ production-tested Flutter widgets
- Pixel-perfect typography and adaptive layout systems for phone and tablet
- Seamless integration with Riverpod, Bloc, or Provider
- Full light & dark mode theme data with Material 3 styling
- Includes full Figma component kit`,
      priceUsdCents: 3900,
      priceBdtPoisha: 460000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1555774698-0b77e0d5fac6?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 44,
      ratingCount: 9,
      downloadCount: 88,
      vendorKey: 'pixelpulse',
      categoryKey: 'ui-kits',
      assetFileName: 'fluttercraft-ui-v1.zip',
    },

    // --- 2. Frontend & Web Templates (4 products) ---
    {
      title: 'Minimalist Portfolio & Blog Astro Template',
      slug: 'minimalist-portfolio-astro-template',
      summary: 'Lightning-fast 100/100 Lighthouse score developer portfolio with MDX blog, RSS feed, and Tailwind CSS.',
      description: `An exceptionally fast and elegant personal website template built with Astro 4 and Tailwind CSS.

Features:
- Perfect 100 Lighthouse performance, accessibility, and SEO scores
- MDX support with syntax highlighting and reading time calculation
- Dark and light theme toggle built-in
- SEO-friendly open graph cards and automatic sitemap generation
- Zero client-side JavaScript by default for ultimate loading speed`,
      priceUsdCents: 2900,
      priceBdtPoisha: 340000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 38,
      ratingCount: 8,
      downloadCount: 94,
      vendorKey: 'pixelpulse',
      categoryKey: 'frontend-templates',
      assetFileName: 'astro-minimalist-portfolio.zip',
    },
    {
      title: 'Prism - High-Converting Next.js SaaS Marketing Template',
      slug: 'prism-saas-marketing-template',
      summary: '12 pre-built landing pages, pricing calculators, interactive feature showcases, and blog in Next.js 14.',
      description: `Designed to maximize conversion rates for SaaS founders. Packed with polished micro-interactions and copy frameworks.

Highlights:
- 12 responsive pages including Pricing with annual toggle, Features, and Testimonials
- Dynamic pricing tier calculator with custom currency conversion
- Built with Next.js 14 App Router and Tailwind CSS
- Automated OpenGraph banner generation via @vercel/og
- Fully responsive on mobile, tablet, and ultra-wide screens`,
      priceUsdCents: 3900,
      priceBdtPoisha: 460000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 55,
      ratingCount: 11,
      downloadCount: 106,
      vendorKey: 'pixelpulse',
      categoryKey: 'frontend-templates',
      assetFileName: 'prism-saas-template.zip',
    },
    {
      title: 'DocuPro Developer Documentation Hub Template',
      slug: 'documentation-vitepress-theme-pro',
      summary: 'Algolia search, OpenAPI interactive playground, markdown snippets, code copying, and version switcher.',
      description: `Build Stripe-grade technical documentation for your developer tools, APIs, and open-source libraries.

Features:
- Instant client-side full-text search with Algolia DocSearch integration
- Interactive REST OpenAPI interactive documentation explorer
- Copyable code blocks with line-highlighting and multi-language tabs
- Version switcher for multi-release documentation
- Optimized SEO meta tags and automated table-of-contents generation`,
      priceUsdCents: 3500,
      priceBdtPoisha: 410000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 29,
      ratingCount: 6,
      downloadCount: 62,
      vendorKey: 'devcraft-studios',
      categoryKey: 'frontend-templates',
      assetFileName: 'docupro-docs-hub.zip',
    },
    {
      title: 'ApexStore Modern E-Commerce Storefront Template',
      slug: 'ecommerce-storefront-remix-tailwind',
      summary: 'High-performance Remix storefront with cart drawer, faceted search, optimistic UI, and Stripe checkout.',
      description: `ApexStore is a full-featured online store front-end built on Remix Run and Tailwind CSS.

Includes:
- Optimistic cart drawer with instant quantity updates
- Multi-facet product filtering (categories, price ranges, brand, tags)
- Integrated Stripe Elements checkout and localized currency formatting
- Server-side rendering (SSR) for blazing performance and high SEO ranking
- Fully responsive on all device viewports`,
      priceUsdCents: 4900,
      priceBdtPoisha: 580000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 40,
      ratingCount: 8,
      downloadCount: 79,
      vendorKey: 'devcraft-studios',
      categoryKey: 'frontend-templates',
      assetFileName: 'apexstore-storefront.zip',
    },

    // --- 3. SaaS Boilerplates & Starters (4 products) ---
    {
      title: 'SaaS Core - Next.js 14 Production Boilerplate',
      slug: 'saas-core-nextjs-boilerplate',
      summary: 'Next.js 14 App Router, Prisma ORM, Stripe subscriptions, team workspaces, RBAC, and automated transactional emails.',
      description: `Save 200+ hours of setup time. SaaS Core includes everything you need to ship a revenue-generating web application.

What is inside:
- Next.js 14 with TypeScript, Server Actions, and React Server Components
- Multi-tenant workspace architecture with invite links and role-based permissions (Owner, Admin, Member)
- Stripe Customer Portal and webhook handling for recurring plans and usage billing
- Prisma schema with PostgreSQL migrations and seed scripts
- Resend / React-Email templates for onboarding and invoices`,
      priceUsdCents: 7900,
      priceBdtPoisha: 930000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 110,
      ratingCount: 22,
      downloadCount: 284,
      vendorKey: 'devcraft-studios',
      categoryKey: 'boilerplates',
      assetFileName: 'saas-core-boilerplate-v3.0.zip',
    },
    {
      title: 'Enterprise Turborepo Monorepo Full-Stack Starter',
      slug: 'turborepo-enterprise-fullstack-starter',
      summary: 'Turborepo setup with shared UI package, tRPC, Prisma, Next.js web app, Expo mobile app, and Docker Compose.',
      description: `A production monorepo blueprint built for scaling engineering teams with end-to-end type safety.

Architecture:
- Turborepo with remote caching enabled
- Shared packages: @repo/ui, @repo/db, @repo/api (tRPC)
- Apps: Next.js 14 web app, Expo React Native iOS/Android app
- Fully automated CI/CD pipeline in GitHub Actions
- PostgreSQL with Docker Compose local environment`,
      priceUsdCents: 8900,
      priceBdtPoisha: 1050000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: 5,
      status: ProductStatus.PUBLISHED,
      ratingSum: 35,
      ratingCount: 7,
      downloadCount: 52,
      vendorKey: 'devcraft-studios',
      categoryKey: 'boilerplates',
      assetFileName: 'turborepo-enterprise-starter.zip',
    },
    {
      title: 'FastAPI + React AI Agent SaaS Starter',
      slug: 'fastapi-react-ai-agent-starter',
      summary: 'Python FastAPI backend, streaming OpenAI LLM responses, vector store retrieval, and modern React frontend.',
      description: `Build intelligent SaaS applications with a high-performance Python FastAPI backend and a polished React dashboard.

Features:
- Streaming Server-Sent Events (SSE) for conversational AI responses
- LangChain / LlamaIndex vector retrieval pipeline with pgvector
- Asynchronous Celery / Redis background worker tasks
- Stripe meter-based token billing and usage tracking
- React + Tailwind chat interface with markdown and code execution blocks`,
      priceUsdCents: 6900,
      priceBdtPoisha: 810000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 62,
      ratingCount: 13,
      downloadCount: 175,
      vendorKey: 'neuralstack',
      categoryKey: 'boilerplates',
      assetFileName: 'fastapi-react-ai-agent-v1.zip',
    },
    {
      title: 'NestJS & Angular Enterprise Multi-Tenant SaaS Boilerplate',
      slug: 'nest-angular-b2b-saas-starter',
      summary: 'Microservice-ready NestJS API, Angular 17 signals, PostgreSQL schema-per-tenant, JWT auth, and audit logging.',
      description: `A robust corporate B2B boilerplate engineered with NestJS and Angular for enterprise compliance and security.

Features:
- Strict schema-per-tenant PostgreSQL database isolation
- Comprehensive RBAC, audit logging, and single sign-on (SSO / SAML)
- Angular 17 frontend with Signals and Tailwind CSS
- Automated Swagger/OpenAPI documentation and client generation
- Dockerized staging and production configurations`,
      priceUsdCents: 9900,
      priceBdtPoisha: 1180000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 42,
      ratingCount: 9,
      downloadCount: 68,
      vendorKey: 'devcraft-studios',
      categoryKey: 'boilerplates',
      assetFileName: 'nest-angular-b2b-starter.zip',
    },

    // --- 4. Mobile App Templates (3 products) ---
    {
      title: 'QuickCommerce - Flutter Multi-Vendor Shopping App',
      slug: 'flutterflow-ecommerce-template',
      summary: 'Complete mobile shopping app with real-time order tracking, push notifications, and payment gateways.',
      description: `A battle-tested cross-platform e-commerce app template built with Flutter.

Key Capabilities:
- Full customer journey: catalog search, product variants, wishlist, animated cart, and checkout
- Live delivery tracking powered by Google Maps SDK
- Push notification handling with Firebase Cloud Messaging (FCM)
- Integrated Stripe & SSLCommerz payment flows
- Clean MVVM architecture with Riverpod state management`,
      priceUsdCents: 5500,
      priceBdtPoisha: 650000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1526470608268-f674ce90ebd4?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 71,
      ratingCount: 15,
      downloadCount: 160,
      vendorKey: 'pixelpulse',
      categoryKey: 'mobile-templates',
      assetFileName: 'flutterflow-quickcommerce-v2.zip',
    },
    {
      title: 'PulseFit - React Native Health & Fitness Tracker',
      slug: 'react-native-fitness-tracker-template',
      summary: 'Workout planner, calorie counter, Apple Health & Google Fit sync, audio coaching, and dark UI.',
      description: `PulseFit is a beautifully designed health, fitness, and workout mobile application built with React Native and Expo.

Features:
- Native HealthKit (Apple Health) and Google Fit bi-directional data synchronization
- Interactive workout planner with animated exercise demonstrations
- Macro calorie tracking with barcode scanner integration
- Offline-first SQLite persistence with background cloud synchronization
- Fluid charts and weekly fitness milestone progress tracking`,
      priceUsdCents: 4900,
      priceBdtPoisha: 580000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 36,
      ratingCount: 8,
      downloadCount: 71,
      vendorKey: 'pixelpulse',
      categoryKey: 'mobile-templates',
      assetFileName: 'pulsefit-react-native.zip',
    },
    {
      title: 'SyncWave - Expo React Native Real-Time Social Chat App',
      slug: 'expo-social-chat-template',
      summary: 'End-to-end encrypted messaging, voice notes, image sharing, read receipts, and WebSockets in Expo.',
      description: `SyncWave is a real-time messaging mobile application template built with Expo React Native and WebSockets.

Highlights:
- 1-on-1 and group chats with typing indicators and delivery receipts
- In-chat voice messaging with audio waveform visualization
- Image and document sharing with local thumbnail generation
- End-to-end encryption ready architecture
- Smooth swipe actions and native gesture handling`,
      priceUsdCents: 4200,
      priceBdtPoisha: 495000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 25,
      ratingCount: 5,
      downloadCount: 58,
      vendorKey: 'devcraft-studios',
      categoryKey: 'mobile-templates',
      assetFileName: 'syncwave-chat-template.zip',
    },

    // --- 5. Cloud & DevOps Automation (3 products) ---
    {
      title: 'Enterprise Kubernetes & Terraform AWS Blueprint',
      slug: 'enterprise-kubernetes-terraform-pack',
      summary: 'Production EKS cluster, multi-region Terraform IaC, ArgoCD GitOps, cert-manager, and Prometheus/Grafana monitoring.',
      description: `Deploy high-availability Kubernetes infrastructure in minutes instead of months. Fully codified in Terraform and Helm.

Includes:
- Multi-AZ AWS EKS cluster deployment with managed node groups
- Ingress-Nginx with automated Let's Encrypt SSL certificates via cert-manager
- Prometheus, Alertmanager, and pre-configured Grafana monitoring dashboards
- ArgoCD GitOps continuous deployment pipeline
- Step-by-step architecture guides and deployment runbooks`,
      priceUsdCents: 9900,
      priceBdtPoisha: 1180000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: 10,
      status: ProductStatus.PUBLISHED,
      ratingSum: 30,
      ratingCount: 6,
      downloadCount: 45,
      vendorKey: 'cloudarchitects',
      categoryKey: 'devops',
      assetFileName: 'k8s-terraform-iac-v1.zip',
    },
    {
      title: 'AWS Serverless Event-Driven Architecture Blueprint',
      slug: 'aws-serverless-event-driven-blueprint',
      summary: 'EventBridge, SQS FIFO, Lambda TypeScript, DynamoDB single-table design with AWS CDK IaC.',
      description: `An enterprise blueprint for high-throughput, asynchronous event-driven cloud applications on AWS.

Includes:
- AWS CDK TypeScript IaC modules with automated synth testing
- EventBridge bus with schema registry and dead-letter queues (DLQ)
- DynamoDB single-table design optimized for high-volume transactions
- AWS Lambda functions with PowerTools for structured logging and X-Ray tracing
- Chaos engineering tests to verify automatic system resilience`,
      priceUsdCents: 8900,
      priceBdtPoisha: 1050000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 45,
      ratingCount: 9,
      downloadCount: 58,
      vendorKey: 'cloudarchitects',
      categoryKey: 'devops',
      assetFileName: 'aws-serverless-blueprint.zip',
    },
    {
      title: 'GitOps & CI/CD Pipeline Suite for Enterprise Kubernetes',
      slug: 'github-actions-enterprise-cicd-pipeline',
      summary: '30+ GitHub Actions workflows, Trivy vulnerability scanning, semantic versioning, and blue-green deployments.',
      description: `Automate testing, security linting, container builds, and canary deployments with battle-tested workflows.

Highlights:
- Reusable GitHub Actions composite workflows for Node.js, Go, and Python
- Security scanning with Trivy (containers) and Gitleaks (secrets)
- Automated Semantic Versioning and Changelog generation
- Zero-downtime blue-green Kubernetes deployments with rollout status checks
- Slack & Discord build notification webhooks`,
      priceUsdCents: 6500,
      priceBdtPoisha: 760000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 24,
      ratingCount: 5,
      downloadCount: 42,
      vendorKey: 'cloudarchitects',
      categoryKey: 'devops',
      assetFileName: 'gitops-cicd-pipeline-suite.zip',
    },

    // --- 6. AI & Machine Learning Tools (3 products) ---
    {
      title: 'Enterprise RAG Knowledge Base Pipeline (LlamaIndex + Qdrant)',
      slug: 'rag-pipeline-llamaindex-langchain',
      summary: 'Hybrid search, document chunking, semantic caching with Redis, re-ranking, and evaluation metrics.',
      description: `A production-ready Retrieval-Augmented Generation (RAG) system engineered for high-accuracy document intelligence.

Features:
- Multi-format ingestion: PDF, DOCX, Markdown, and Web Scraper
- Hybrid dense and sparse vector search powered by Qdrant
- Cross-encoder reranking for superior query relevance
- Semantic response caching with Redis to reduce LLM token expenses by up to 60%
- Automated RAG evaluation suite (Faithfulness & Answer Relevancy)`,
      priceUsdCents: 7500,
      priceBdtPoisha: 890000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 52,
      ratingCount: 11,
      downloadCount: 112,
      vendorKey: 'neuralstack',
      categoryKey: 'ai-tools',
      assetFileName: 'rag-enterprise-pipeline.zip',
    },
    {
      title: 'Multimodal Vision & OCR Analytics Agent',
      slug: 'multimodal-ai-vision-agent',
      summary: 'Automated invoice, receipt, and chart extraction using GPT-4o Vision, layout analysis, and JSON formatting.',
      description: `Extract structured JSON data from complex invoices, diagrams, and receipts with zero hallucinations.

Included:
- High-precision image preprocessing and perspective correction
- Multimodal LLM prompts with strict Pydantic JSON schema validation
- Confidence score calculation and human-in-the-loop review queues
- FastAPI inference endpoint with batch processing support
- Complete test datasets with ground-truth validation scripts`,
      priceUsdCents: 6500,
      priceBdtPoisha: 765000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 33,
      ratingCount: 7,
      downloadCount: 65,
      vendorKey: 'neuralstack',
      categoryKey: 'ai-tools',
      assetFileName: 'vision-ai-agent.zip',
    },
    {
      title: 'LangGraph Autonomous Agent Workflow Orchestrator',
      slug: 'agentic-workflow-langgraph-orchestrator',
      summary: 'Multi-agent state machines, human-in-the-loop approvals, web search, code execution, and SQLite checkpointing.',
      description: `Build resilient multi-agent applications that plan, research, self-correct, and execute complex real-world tasks.

Highlights:
- State graph architecture with cyclical loops and conditional branching
- Built-in tools: Google Search, Python code sandbox, and SQL query generator
- Human-in-the-loop pause and resume approval checkpoints
- Streaming UI hooks compatible with React and Next.js
- Comprehensive trace logging with LangSmith integration`,
      priceUsdCents: 8500,
      priceBdtPoisha: 990000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1676299081847-824916de030a?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1676299081847-824916de030a?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 46,
      ratingCount: 9,
      downloadCount: 84,
      vendorKey: 'neuralstack',
      categoryKey: 'ai-tools',
      assetFileName: 'langgraph-agent-orchestrator.zip',
    },

    // --- 7. Engineering Masterclasses (3 products) ---
    {
      title: 'Full-Stack Microservices Masterclass (Go + Node + gRPC)',
      slug: 'full-stack-microservices-masterclass',
      summary: 'Hands-on video course & source code teaching event-driven microservices, Kafka, Docker, and distributed tracing.',
      description: `An in-depth, hands-on engineering masterclass designed for senior engineers and team leads.

Curriculum:
- Domain-Driven Design (DDD) & Service Boundaries
- High-performance communication with gRPC & Protocol Buffers
- Event streaming with Apache Kafka & outbox pattern
- Distributed tracing with OpenTelemetry & Jaeger
- Fault tolerance with circuit breakers and rate limiters`,
      priceUsdCents: 12900,
      priceBdtPoisha: 1520000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 162,
      ratingCount: 33,
      downloadCount: 310,
      vendorKey: 'codeforge',
      categoryKey: 'courses',
      assetFileName: 'microservices-course-materials.zip',
    },
    {
      title: 'High-Scale Distributed System Design Masterclass',
      slug: 'high-scale-system-design-masterclass',
      summary: 'Real-world architectures for 10M+ daily active users: sharding, consensus (Raft), caching, and multi-region failover.',
      description: `Master the design patterns required to interview for and architect mission-critical, high-throughput systems.

Modules:
- Database sharding strategies, read-replicas, and connection pooling
- Distributed consensus protocols (Paxos and Raft simplified)
- Advanced cache invalidation, cache-aside, and write-through architectures
- Global CDN and multi-region active-active database replication
- Real-world teardowns: designing Twitter feed, Uber dispatcher, and Netflix streaming`,
      priceUsdCents: 11900,
      priceBdtPoisha: 1400000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 95,
      ratingCount: 19,
      downloadCount: 185,
      vendorKey: 'codeforge',
      categoryKey: 'courses',
      assetFileName: 'system-design-masterclass-pack.zip',
    },
    {
      title: 'Advanced React Architecture & Performance Masterclass',
      slug: 'advanced-react-performance-masterclass',
      summary: 'Deep dive into React 19, concurrent mode, compiler optimizations, custom renderers, and memory leak profiling.',
      description: `Level up from mid-level to senior React architect by mastering low-level rendering mechanics and performance.

Included:
- Profiling React render cascades and memory leaks using Chrome DevTools
- Concurrency, transitions, and streaming server components deep-dive
- Building state management libraries from scratch using useSyncExternalStore
- Advanced animation pipelines with 60fps gesture physics
- Production codebase refactoring case studies`,
      priceUsdCents: 9900,
      priceBdtPoisha: 1160000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 84,
      ratingCount: 17,
      downloadCount: 140,
      vendorKey: 'codeforge',
      categoryKey: 'courses',
      assetFileName: 'react-performance-masterclass.zip',
    },
  ];

  for (const item of demoProducts) {
    const vendorId = vendors[item.vendorKey];
    const categoryId = categories[item.categoryKey];

    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        title: item.title,
        summary: item.summary,
        description: item.description,
        priceUsdCents: item.priceUsdCents,
        priceBdtPoisha: item.priceBdtPoisha,
        thumbnailUrl: item.thumbnailUrl,
        galleryUrls: item.galleryUrls,
        stock: item.stock,
        status: item.status,
        ratingSum: item.ratingSum,
        ratingCount: item.ratingCount,
        downloadCount: item.downloadCount,
        publishedAt: new Date(),
        categoryId,
        vendorId,
      },
      create: {
        title: item.title,
        slug: item.slug,
        summary: item.summary,
        description: item.description,
        priceUsdCents: item.priceUsdCents,
        priceBdtPoisha: item.priceBdtPoisha,
        thumbnailUrl: item.thumbnailUrl,
        galleryUrls: item.galleryUrls,
        stock: item.stock,
        status: item.status,
        ratingSum: item.ratingSum,
        ratingCount: item.ratingCount,
        downloadCount: item.downloadCount,
        publishedAt: new Date(),
        categoryId,
        vendorId,
      },
    });

    // Ensure corresponding digital asset entry exists
    const storageKey = `assets/${item.slug}/${item.assetFileName}`;
    const existingAsset = await prisma.productAsset.findFirst({
      where: { productId: product.id },
    });

    if (!existingAsset) {
      await prisma.productAsset.create({
        data: {
          productId: product.id,
          fileName: item.assetFileName,
          storageKey,
          mimeType: 'application/zip',
          sizeBytes: BigInt(25_000_000), // ~25MB
          version: '1.0.0',
        },
      });
    }

    console.log(`  Product [${product.title}] ready.`);
  }

  // 4. Ensure demo customer exists
  await prisma.user.upsert({
    where: { email: 'customer@marketplace.demo' },
    update: {},
    create: {
      email: 'customer@marketplace.demo',
      fullName: 'Demo Customer',
      passwordHash,
      role: Role.CUSTOMER,
      isEmailVerified: true,
      cart: { create: {} },
    },
  });

  console.log(`--- Marketplace demo seeding complete. ${demoProducts.length} items verified safely. ---`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
