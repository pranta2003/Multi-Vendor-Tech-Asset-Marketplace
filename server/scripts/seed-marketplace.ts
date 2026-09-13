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
  const categoriesData = [
    { name: 'UI Kits & Design Systems', slug: 'ui-kits' },
    { name: 'SaaS Boilerplates & Starters', slug: 'boilerplates' },
    { name: 'Mobile App Templates', slug: 'mobile-templates' },
    { name: 'Cloud & DevOps Automation', slug: 'devops' },
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
  const demoProducts = [
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
      categoryKey: 'ui-kits',
      assetFileName: 'astro-minimalist-portfolio.zip',
    },
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
      assetFileName: 'ai-agent-starter-pack.zip',
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
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
