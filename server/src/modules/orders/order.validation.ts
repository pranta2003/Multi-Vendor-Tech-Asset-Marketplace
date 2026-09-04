import { z } from 'zod';
import { Currency, PaymentProvider } from '@prisma/client';

export const checkoutSchema = z.object({
  body: z.object({
    provider: z.nativeEnum(PaymentProvider),
    currency: z.nativeEnum(Currency),

    billingName: z.string().trim().min(2).max(120),
    billingEmail: z.string().trim().toLowerCase().email().max(255),
    billingPhone: z.string().trim().max(24).optional(),
    // ISO 3166-1 alpha-2, matching the @db.VarChar(2) column.
    billingCountry: z.string().trim().length(2).toUpperCase().optional(),

    // Required by SSLCommerz's session API, not persisted on the order.
    billingAddress: z.string().trim().max(255).optional(),
    billingCity: z.string().trim().max(80).optional(),

    /**
     * There is deliberately NO amount, price, currency-rate, productIds or
     * quantity field here.
     *
     * The entire order is reconstructed server-side from the authenticated
     * user's cart and the locked product rows. That is the only way to make
     * price tampering structurally impossible rather than merely validated
     * against - there is no client-supplied number anywhere in the money path.
     */
  }),
});

export const orderNumberSchema = z.object({
  params: z.object({
    // Matches generateOrderNumber(): MKT-YYYYMMDD-XXXXXX in Crockford base32.
    orderNumber: z.string().trim().regex(/^MKT-\d{8}-[0-9A-HJKMNP-TV-Z]{6}$/, 'Malformed order number'),
  }),
});

export const listOrdersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
  }),
});
