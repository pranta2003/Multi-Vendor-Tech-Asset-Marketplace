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
    console.log('To seed against your database (e.g. Neon or local PostgreSQL), run:');
    console.log('  $env:DATABASE_URL="your-connection-string"; npm run seed:marketplace');
    process.exit(0);
  }

  console.log('--- Starting safe marketplace demo data seeding ---');

  const passwordHash = await hashPassword('Str0ngDemoPass1');

  // 1. Upsert Categories
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

  // 3. Upsert Demo Products
  // 3. Upsert Demo Products (24 diverse, realistic tech assets)
  const demoProducts = [
    // --- UI Kits & Design Systems ---
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
      title: 'Zenith - Fintech & Banking UI Design System',
      slug: 'zenith-fintech-design-system',
      summary: '80+ Figma & React financial dashboard components, charts, crypto widgets, and transaction feeds.',
      description: `Zenith is a purpose-built design system tailored for modern banking, neobanking, crypto exchanges, and wealth management apps.

Included Features:
- 80+ modular financial components (balances, transaction histories, card switchers)
- Interactive financial charts using Recharts and D3 primitives
- Figma UI kit with auto-layout v5, tokens, and multi-brand theming
- Secure KYC verification and wire transfer modal flows
- Fully documented in Storybook with 100% accessibility compliance`,
      priceUsdCents: 6900,
      priceBdtPoisha: 810000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 39,
      ratingCount: 8,
      downloadCount: 88,
      vendorKey: 'pixelpulse',
      categoryKey: 'ui-kits',
      assetFileName: 'zenith-fintech-ui-kit.zip',
    },
    {
      title: 'Catalyst - Tailwind CSS Admin & CRM Dashboard',
      slug: 'catalyst-admin-dashboard-kit',
      summary: 'Clean, modular admin dashboard with analytics charts, data tables, Kanban boards, and dark mode.',
      description: `A battle-tested administrative dashboard crafted for complex SaaS applications and internal operations tools.

Key Capabilities:
- High-density data tables with sorting, multi-column filtering, and CSV export
- Interactive Kanban project boards with drag-and-drop
- Role-based navigation layout with collapsible sidebar
- Performance optimized bundle with zero heavy chart dependencies
- Dark mode native with automatic system preference detection`,
      priceUsdCents: 5500,
      priceBdtPoisha: 650000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 62,
      ratingCount: 13,
      downloadCount: 119,
      vendorKey: 'pixelpulse',
      categoryKey: 'ui-kits',
      assetFileName: 'catalyst-dashboard-v1.zip',
    },

    // --- Frontend & Web Templates ---
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
      title: 'Vortex - Modern Developer Documentation & API Portal',
      slug: 'vortex-developer-docs-engine',
      summary: 'Interactive OpenAPI spec explorer, algorithmic search, code tabs, and version switcher for developer docs.',
      description: `Give your API or open-source library world-class documentation with an interactive developer portal.

Features:
- Live API playground executing requests directly from documentation pages
- Full-text search with instant keyboard shortcuts (Cmd+K)
- Multi-language code snippet tabs (cURL, Python, TypeScript, Go)
- Version dropdown with archive routing
- Markdown / MDX powered authoring workflow`,
      priceUsdCents: 3500,
      priceBdtPoisha: 410000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 44,
      ratingCount: 9,
      downloadCount: 79,
      vendorKey: 'devcraft-studios',
      categoryKey: 'frontend-templates',
      assetFileName: 'vortex-docs-portal.zip',
    },
    {
      title: 'Orbit - Creative Agency & Studio Showcase Template',
      slug: 'orbit-design-agency-showcase',
      summary: 'Smooth WebGL background shaders, dynamic cursor animations, client case studies, and responsive design.',
      description: `A show-stopping website template for design agencies, freelance developers, and 3D motion designers.

Package Contains:
- Lightweight WebGL interactive background effects using Three.js
- Case study detail layouts with before/after interactive image comparisons
- Contact form integration with automated validation and spam filtering
- Dark-first aesthetic with typography optimized for readability
- High performance 60fps scrolling and view transitions`,
      priceUsdCents: 3200,
      priceBdtPoisha: 380000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 29,
      ratingCount: 6,
      downloadCount: 62,
      vendorKey: 'pixelpulse',
      categoryKey: 'frontend-templates',
      assetFileName: 'orbit-agency-showcase.zip',
    },

    // --- SaaS Boilerplates & Starters ---
    {
      title: 'SaaS Core - Next.js 14 & Supabase Boilerplate',
      slug: 'saas-core-nextjs-boilerplate',
      summary: 'Complete SaaS starter kit with Stripe billing, Supabase auth, teams, transactional emails, and admin portal.',
      description: `Launch your next SaaS in days rather than months. SaaS Core comes pre-wired with every foundational feature a serious SaaS requires.

Included out of the box:
- Next.js 14 App Router with Server Actions
- Supabase Auth + PostgreSQL with Prisma ORM
- Multi-tier Stripe subscriptions, checkout, and webhook handling
- Team workspaces and role-based access control (RBAC)
- Resend transactional email integration
- Admin control panel with telemetry and usage metrics`,
      priceUsdCents: 8900,
      priceBdtPoisha: 1050000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 98,
      ratingCount: 20,
      downloadCount: 218,
      vendorKey: 'devcraft-studios',
      categoryKey: 'boilerplates',
      assetFileName: 'saas-core-nextjs14.zip',
    },
    {
      title: 'HyperLaunch - Multi-Tenant B2B SaaS Starter Kit',
      slug: 'hyperlaunch-multi-tenant-b2b-saas',
      summary: 'Multi-tenant PostgreSQL isolation, SAML/SSO enterprise auth, audit logs, and Stripe metered billing.',
      description: `Everything you need to sell to enterprise customers. HyperLaunch handles complex B2B compliance and tenancy out of the box.

Enterprise Ready:
- Schema-per-tenant or Row-Level Security (RLS) PostgreSQL database architecture
- Single Sign-On (SSO / SAML 2.0) via Okta, Google Workspace, and Azure AD
- Complete audit logging and security event tracking
- Stripe metered usage billing with usage tracking webhooks
- Role-based invitations with fine-grained permission matrices`,
      priceUsdCents: 11900,
      priceBdtPoisha: 1400000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 78,
      ratingCount: 16,
      downloadCount: 145,
      vendorKey: 'devcraft-studios',
      categoryKey: 'boilerplates',
      assetFileName: 'hyperlaunch-b2b-saas.zip',
    },
    {
      title: 'TurboStack - Production Turborepo + NestJS Boilerplate',
      slug: 'turbostack-monorepo-boilerplate',
      summary: 'Battle-tested Turborepo with React Vite web app, React Native mobile, NestJS API, and shared UI package.',
      description: `A professional TypeScript monorepo setup designed for teams scaling across web, mobile, and microservices.

Monorepo Architecture:
- Turborepo with remote caching and instant parallel pipeline execution
- Shared @repo/ui package with Tailwind CSS design tokens
- NestJS enterprise REST API with Swagger documentation and OpenAPI generator
- React 18 frontend with TanStack Query and state management
- Shared validation schemas using Zod across backend and frontend`,
      priceUsdCents: 8500,
      priceBdtPoisha: 1000000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 49,
      ratingCount: 10,
      downloadCount: 112,
      vendorKey: 'devcraft-studios',
      categoryKey: 'boilerplates',
      assetFileName: 'turbostack-monorepo-master.zip',
    },
    {
      title: 'Relay - Real-Time Collaborative Canvas & Docs Starter',
      slug: 'relay-realtime-collaboration-kit',
      summary: 'Multiplayer CRDT sync with Yjs, WebSockets, presence cursors, and offline-first state management.',
      description: `Build multiplayer applications like Notion or Figma with real-time CRDT conflict-free synchronization.

What is Included:
- Yjs CRDT synchronization over persistent WebSockets
- Live multiplayer cursor tracking and user presence avatars
- Rich text collaborative editor built on Tiptap
- Offline-first caching with IndexedDB and automatic sync upon reconnection
- Room-based security with JWT channel authentication`,
      priceUsdCents: 7500,
      priceBdtPoisha: 880000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 36,
      ratingCount: 7,
      downloadCount: 67,
      vendorKey: 'devcraft-studios',
      categoryKey: 'boilerplates',
      assetFileName: 'relay-collaboration-suite.zip',
    },

    // --- Mobile App Templates ---
    {
      title: 'FlutterFlow E-Commerce Mobile App Template',
      slug: 'flutterflow-ecommerce-template',
      summary: 'Production-ready iOS and Android shopping app with cart, catalog filters, wishlist, and payment integration.',
      description: `A modern, clean Flutter application for building high-converting mobile commerce experiences.

Key Highlights:
- Cross-platform for iOS and Android with 60fps animations
- State management with Riverpod and clean architecture
- Product search, filtering, and review ratings
- Shopping cart, checkout flow, and order history
- Push notification handling ready for FCM`,
      priceUsdCents: 5900,
      priceBdtPoisha: 700000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1526406915894-7bcd65f60845?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 72,
      ratingCount: 15,
      downloadCount: 87,
      vendorKey: 'devcraft-studios',
      categoryKey: 'mobile-templates',
      assetFileName: 'flutter-shop-master.zip',
    },
    {
      title: 'Modern iOS 17 SwiftUI Component Library',
      slug: 'swiftui-modern-component-library',
      summary: '50+ native iOS components with haptics, dark mode, dynamic island support, and interactive widgets.',
      description: `Accelerate native iOS app development with clean, idiomatic SwiftUI components.

Package Contents:
- 50+ customizable SwiftUI views and modifiers
- Built for iOS 17 and Xcode 15+
- Dynamic Island and Live Activity templates
- Subtle haptic feedback integration
- Sample showcase app with source code included`,
      priceUsdCents: 4500,
      priceBdtPoisha: 530000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1563206767-5b18f218e8de?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1563206767-5b18f218e8de?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 48,
      ratingCount: 10,
      downloadCount: 76,
      vendorKey: 'pixelpulse',
      categoryKey: 'mobile-templates',
      assetFileName: 'swiftui-components-pro.zip',
    },
    {
      title: 'PulseFit - React Native Health & Workout Tracker',
      slug: 'pulsefit-react-native-health-app',
      summary: 'iOS HealthKit & Google Fit integration, workout timer, animated progress rings, and offline storage.',
      description: `A polished fitness and lifestyle mobile template developed with Expo 50 and React Native.

Features:
- Apple HealthKit and Google Fit synchronization
- Custom animated circular progress rings with react-native-reanimated
- Interval rest timers with background notifications
- Pre-populated library of 150+ workout routines with animated SVG guides
- Local SQLite database ensuring 100% offline functionality`,
      priceUsdCents: 5900,
      priceBdtPoisha: 690000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 42,
      ratingCount: 9,
      downloadCount: 65,
      vendorKey: 'pixelpulse',
      categoryKey: 'mobile-templates',
      assetFileName: 'pulsefit-expo-app.zip',
    },
    {
      title: 'CryptoSphere - Non-Custodial Web3 Crypto Wallet App',
      slug: 'cryptosphere-web3-mobile-wallet',
      summary: 'EVM multi-chain support, biometric authentication, token swaps, and WalletConnect v2 integration.',
      description: `A secure, non-custodial crypto wallet template ready for Ethereum, Polygon, Arbitrum, and Base.

Security & Features:
- Secure Keychain and Hardware Biometrics (FaceID / TouchID)
- WalletConnect v2 integration for seamless dApp interaction
- Real-time token price charts with Coingecko API integration
- Decentralized token swap simulation interface
- Clean multi-wallet switching architecture`,
      priceUsdCents: 6500,
      priceBdtPoisha: 760000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 38,
      ratingCount: 8,
      downloadCount: 51,
      vendorKey: 'devcraft-studios',
      categoryKey: 'mobile-templates',
      assetFileName: 'cryptosphere-wallet-template.zip',
    },

    // --- Cloud & DevOps Automation ---
    {
      title: 'Enterprise Kubernetes & Terraform Starter Pack',
      slug: 'enterprise-kubernetes-terraform-pack',
      summary: 'Modular Infrastructure as Code for AWS/GCP: EKS clusters, VPC peering, ArgoCD GitOps, and Prometheus monitoring.',
      description: `Deploy a secure, battle-tested Kubernetes production infrastructure in under an hour with modular Terraform scripts.

What is Included:
- Complete AWS VPC & EKS cluster modules
- Automated ArgoCD GitOps pipeline configuration
- Zero-trust network policies and IAM roles for service accounts
- Grafana + Prometheus observability stack with custom dashboards
- Step-by-step architecture guides and deployment runbooks`,
      priceUsdCents: 9900,
      priceBdtPoisha: 1180000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=1200&auto=format&fit=crop&q=80',
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
      title: 'Full-Stack Microservices Masterclass (Go + Node + gRPC)',
      slug: 'full-stack-microservices-masterclass',
      summary: 'Hands-on video course & source code teaching event-driven microservices, Kafka, Docker, and distributed tracing.',
      description: `An in-depth, hands-on engineering masterclass designed for senior engineers and team leads.
      title: 'AWS Serverless Event-Driven Architecture Blueprint',
      slug: 'aws-serverless-event-driven-blueprint',
      summary: 'EventBridge, SQS FIFO, Lambda TypeScript, DynamoDB single-table design with AWS CDK IaC.',
      description: `An enterprise blueprint for high-throughput, asynchronous event-driven cloud applications on AWS.

Curriculum:
- Domain-Driven Design (DDD) & Service Boundaries
- High-performance communication with gRPC & Protocol Buffers
- Event streaming with Apache Kafka & outbox pattern
- Distributed tracing with OpenTelemetry & Jaeger
- Fault tolerance with circuit breakers and rate limiters`,
      priceUsdCents: 12900,
      priceBdtPoisha: 1520000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
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
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 162,
      ratingCount: 33,
      downloadCount: 310,
      vendorKey: 'devcraft-studios',
      categoryKey: 'courses',
      assetFileName: 'microservices-course-materials.zip',
      ratingSum: 45,
      ratingCount: 9,
      downloadCount: 58,
      vendorKey: 'cloudarchitects',
      categoryKey: 'devops',
      assetFileName: 'aws-serverless-blueprint.zip',
    },
    {
      title: 'Minimalist Portfolio & Blog Astro Template',
      slug: 'minimalist-portfolio-astro-template',
      summary: 'Lightning-fast 100/100 Lighthouse score developer portfolio with MDX blog, RSS feed, and Tailwind CSS.',
      description: `An exceptionally fast and elegant personal website template built with Astro 4 and Tailwind CSS.
      title: 'GitOps & CI/CD Pipeline Suite for Enterprise Kubernetes',
      slug: 'github-actions-enterprise-cicd-pipeline',
      summary: 'Automated container security scanning, semantic versioning, preview environments, and zero-downtime rolling deploys.',
      description: `Complete GitHub Actions and ArgoCD workflows for modern dev teams shipping containerized applications.

Features:
- Perfect 100 Lighthouse performance, accessibility, and SEO scores
- MDX support with syntax highlighting and reading time calculation
- Dark and light theme toggle built-in
- SEO-friendly open graph cards and automatic sitemap generation
- Zero client-side JavaScript by default for ultimate loading speed`,
      priceUsdCents: 2900,
      priceBdtPoisha: 340000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80',
Capabilities:
- Automated vulnerability scanning with Trivy and SonarQube
- Pull request ephemeral preview environments with automatic cleanup
- Semantic release automation with automated changelog generation
- Helm chart templates and Kustomize overlays for staging and production
- Slack and Discord deployment notification webhooks`,
      priceUsdCents: 6900,
      priceBdtPoisha: 810000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 38,
      ratingCount: 8,
      downloadCount: 94,
      vendorKey: 'pixelpulse',
      categoryKey: 'ui-kits',
      assetFileName: 'astro-minimalist-portfolio.zip',
      ratingSum: 36,
      ratingCount: 7,
      downloadCount: 72,
      vendorKey: 'cloudarchitects',
      categoryKey: 'devops',
      assetFileName: 'enterprise-cicd-suite.zip',
    },

    // --- AI & Machine Learning Tools ---
    {
      title: 'FastAPI + React AI Agent Platform Starter',
      slug: 'fastapi-react-ai-agent-starter',
      summary: 'Full-stack AI workflow builder with LangChain, streaming responses, Vector database integration, and auth.',
      description: `Build and deploy AI agents and conversational copilots with Python FastAPI and a modern React interface.

Includes:
- FastAPI async backend with server-sent events (SSE) streaming
- LangChain / LangGraph orchestration pipelines
- Qdrant & pgvector vector store integrations
- React chat UI with markdown, code snippets, and reasoning chips
- Docker compose setup for one-command local development`,
      priceUsdCents: 7900,
      priceBdtPoisha: 940000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 54,
      ratingCount: 11,
      downloadCount: 125,
      vendorKey: 'cloudarchitects',
      categoryKey: 'boilerplates',
      categoryKey: 'ai-tools',
      assetFileName: 'ai-agent-starter-pack.zip',
    },
    {
      title: 'Modern iOS 17 SwiftUI Component Library',
      slug: 'swiftui-modern-component-library',
      summary: '50+ native iOS components with haptics, dark mode, dynamic island support, and interactive widgets.',
      description: `Accelerate native iOS app development with clean, idiomatic SwiftUI components.
      title: 'RAG Engine - Enterprise Hybrid Search & Q&A Platform',
      slug: 'rag-engine-enterprise-search-toolkit',
      summary: 'Dense + sparse hybrid vector search with BM25, Cohere re-ranking, document chunking, and hallucination guardrails.',
      description: `A production-grade Retrieval-Augmented Generation (RAG) framework designed to eliminate LLM hallucinations.

Package Contents:
- 50+ customizable SwiftUI views and modifiers
- Built for iOS 17 and Xcode 15+
- Dynamic Island and Live Activity templates
- Subtle haptic feedback integration
- Sample showcase app with source code included`,
      priceUsdCents: 4500,
      priceBdtPoisha: 530000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1563206767-5b18f218e8de?w=800&auto=format&fit=crop&q=80',
Features:
- Hybrid search combining vector embeddings with BM25 keyword matching
- Cohere Re-ranker integration for top-k contextual precision
- Context-aware recursive document chunking for PDFs, DOCX, and Markdown
- Built-in guardrails verifying factual consistency of LLM responses
- FastAPI REST service with multi-tenant workspace partitioning`,
      priceUsdCents: 9500,
      priceBdtPoisha: 1120000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1563206767-5b18f218e8de?w=1200&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 48,
      ratingSum: 49,
      ratingCount: 10,
      downloadCount: 76,
      vendorKey: 'pixelpulse',
      categoryKey: 'mobile-templates',
      assetFileName: 'swiftui-components-pro.zip',
      downloadCount: 91,
      vendorKey: 'neuralstack',
      categoryKey: 'ai-tools',
      assetFileName: 'rag-engine-enterprise.zip',
    },
    {
      title: 'VisionAI - Edge Computer Vision & Object Tracking Pipeline',
      slug: 'vision-ai-object-detection-pipeline',
      summary: 'YOLOv8 ONNX runtime pipeline, real-time video stream processor, and automated data labeling dashboard.',
      description: `Deploy computer vision on edge devices and servers with low latency and minimal resource overhead.

Package Contents:
- Optimized YOLOv8 ONNX models for CPU and TensorRT GPU inference
- Multi-camera RTSP streaming ingest pipeline with DeepSort tracking
- Web-based video analytics dashboard with zone heatmaps and alert logs
- Python SDK and Docker deployment containers included`,
      priceUsdCents: 8900,
      priceBdtPoisha: 1050000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 35,
      ratingCount: 7,
      downloadCount: 48,
      vendorKey: 'neuralstack',
      categoryKey: 'ai-tools',
      assetFileName: 'visionai-edge-pipeline.zip',
    },

    // --- Engineering Masterclasses ---
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
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 162,
      ratingCount: 33,
      downloadCount: 310,
      vendorKey: 'devcraft-studios',
      categoryKey: 'courses',
      assetFileName: 'microservices-course-materials.zip',
    },
    {
      title: 'Designing High-Throughput Distributed Systems (Rust + Go)',
      slug: 'high-throughput-distributed-systems-design',
      summary: '24-hour video course covering Raft consensus, LSM storage engines, zero-copy networking, and cache coherence.',
      description: `Master the engineering fundamentals behind systems that process millions of events per second with sub-millisecond latency.

Syllabus:
- Building an in-memory Key-Value store with Raft consensus from scratch
- Log-Structured Merge (LSM) trees and Write-Ahead Logging (WAL) internals
- Linux epoll, io_uring, and zero-copy TCP network programming in Rust
- Concurrency patterns with Go channels, locks, and lock-free atomic buffers
- Profiling memory allocation and CPU cache misses with pprof and perf`,
      priceUsdCents: 14900,
      priceBdtPoisha: 1750000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 115,
      ratingCount: 23,
      downloadCount: 184,
      vendorKey: 'codeforge',
      categoryKey: 'courses',
      assetFileName: 'distributed-systems-mastery.zip',
    },
    {
      title: 'Production-Grade TypeScript: From Fundamentals to Scale',
      slug: 'production-grade-typescript-architecture',
      summary: 'Advanced type-level programming, domain modeling, AST transformers, and monorepo performance optimization.',
      description: `Transform how your engineering organization writes and scales TypeScript codebases.

Course Highlights:
- Conditional types, template literal types, and mapped type gymnastics
- Building type-safe API clients with zero code generation
- Custom TypeScript ESLint plugins and AST compiler transformers
- Compiler performance tuning for monorepos with 1M+ lines of code
- Strict type-driven domain modeling with algebraic data types`,
      priceUsdCents: 9900,
      priceBdtPoisha: 1160000,
      thumbnailUrl: 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80',
      galleryUrls: [
        'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200&auto=format&fit=crop&q=80',
      ],
      stock: null,
      status: ProductStatus.PUBLISHED,
      ratingSum: 88,
      ratingCount: 18,
      downloadCount: 156,
      vendorKey: 'codeforge',
      categoryKey: 'courses',
      assetFileName: 'typescript-architecture-course.zip',
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

  console.log('--- Marketplace demo seeding complete. All items verified safely. ---');
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
