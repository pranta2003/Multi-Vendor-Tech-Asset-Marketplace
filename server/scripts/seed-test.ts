/**
 * Test fixture builder. Creates an approved vendor, a customer, and products
 * with known stock levels so the concurrency and payment tests are deterministic.
 */
import { Currency, ProductStatus, Role, VendorStatus } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/utils/password';

const main = async (): Promise<void> => {
  await prisma.$transaction([
    prisma.paymentEvent.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.downloadGrant.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.product.deleteMany(),
    prisma.vendorProfile.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await hashPassword('Str0ngPass');

  const vendorUser = await prisma.user.create({
    data: { email: 'vendor@test.com', passwordHash, fullName: 'Vendor One', role: Role.VENDOR },
  });
  const vendor = await prisma.vendorProfile.create({
    data: {
      userId: vendorUser.id,
      storeName: 'PixelForge',
      slug: 'pixelforge',
      status: VendorStatus.APPROVED,
      commissionRateBps: 1500,
    },
  });

  const customer = await prisma.user.create({
    data: { email: 'buyer@test.com', passwordHash, fullName: 'Buyer One', role: Role.CUSTOMER },
  });
  const customer2 = await prisma.user.create({
    data: { email: 'buyer2@test.com', passwordHash, fullName: 'Buyer Two', role: Role.CUSTOMER },
  });
  await prisma.user.create({
    data: { email: 'admin@test.com', passwordHash, fullName: 'Admin', role: Role.ADMIN },
  });

  // stock = 1 -> the oversell battleground
  const scarce = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      title: 'Scarce Admin Kit',
      slug: 'scarce-admin-kit',
      summary: 'Exactly one licence exists for this product.',
      description: 'A deliberately scarce product used to prove the oversell guard works.',
      priceUsdCents: 4900,
      priceBdtPoisha: 590_000,
      thumbnailUrl: 'https://cdn.example.com/scarce.png',
      stock: 1,
      status: ProductStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  // stock = null -> unlimited digital licence
  const unlimited = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      title: 'Unlimited UI Kit',
      slug: 'unlimited-ui-kit',
      summary: 'An unlimited digital licence with no stock ceiling.',
      description: 'Used to prove that null stock is treated as unlimited and never decremented.',
      priceUsdCents: 2500,
      priceBdtPoisha: 300_000,
      thumbnailUrl: 'https://cdn.example.com/unlimited.png',
      stock: null,
      status: ProductStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  const draft = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      title: 'Unpublished Draft Kit',
      slug: 'unpublished-draft-kit',
      summary: 'Should never be purchasable or visible publicly.',
      description: 'Used to prove that unpublished products cannot be added to a cart.',
      priceUsdCents: 1000,
      priceBdtPoisha: 120_000,
      thumbnailUrl: 'https://cdn.example.com/draft.png',
      status: ProductStatus.DRAFT,
    },
  });

  console.log(
    JSON.stringify(
      {
        vendorUserId: vendorUser.id,
        vendorId: vendor.id,
        customerId: customer.id,
        customer2Id: customer2.id,
        scarceId: scarce.id,
        unlimitedId: unlimited.id,
        draftId: draft.id,
        currencies: [Currency.USD, Currency.BDT],
      },
      null,
      2,
    ),
  );
};

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
