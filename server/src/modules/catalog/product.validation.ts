import { z } from 'zod';
import { ProductStatus } from '@prisma/client';

const uuid = z.string().uuid('Must be a valid UUID');

/**
 * Prices are accepted as integers in minor units, matching the database exactly.
 * Accepting a decimal ("19.99") would force a float conversion at the API
 * boundary - the precise thing money.ts exists to prevent.
 */
const minorAmount = z
  .number()
  .int('Amount must be an integer in minor units (cents/poisha)')
  .positive('Amount must be greater than zero')
  .max(100_000_000, 'Amount exceeds the maximum supported value');

export const listProductsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    // Hard cap on limit: without it, `?limit=100000` is a trivial
    // denial-of-service against your own database.
    limit: z.coerce.number().int().positive().max(50).default(12),
    q: z.string().trim().min(1).max(120).optional(),
    categorySlug: z.string().trim().max(80).optional(),
    vendorSlug: z.string().trim().max(100).optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular']).default('newest'),
  }),
});

export const productSlugSchema = z.object({
  params: z.object({ slug: z.string().trim().min(1).max(200) }),
});

export const createProductSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().min(10).max(300),
    description: z.string().trim().min(30).max(20_000),
    priceUsdCents: minorAmount,
    priceBdtPoisha: minorAmount,
    thumbnailUrl: z.string().url().max(2048),
    galleryUrls: z.array(z.string().url().max(2048)).max(10).optional(),
    // null is an explicit, meaningful value here: unlimited licences. Using
    // `.nullish()` rather than `.optional()` lets the client distinguish
    // "unlimited" from "not specified".
    stock: z.number().int().min(0).max(1_000_000).nullish(),
    categoryId: uuid.optional(),
    // No `status` field, no `vendorId` field. They are not omitted by accident:
    // Zod strips unknown keys by default, so a client sending
    // {"status":"PUBLISHED"} or {"vendorId":"<someone else>"} has those keys
    // silently discarded before the service ever sees the object.
  }),
});

export const updateProductStatusSchema = z.object({
  params: z.object({ id: uuid }),
  body: z.object({
    status: z.nativeEnum(ProductStatus),
  }),
});
