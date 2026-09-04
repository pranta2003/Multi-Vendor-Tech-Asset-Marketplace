import { z } from 'zod';
import { Currency } from '@prisma/client';

const uuid = z.string().uuid('Must be a valid UUID');

/**
 * The display currency is a query parameter rather than part of the cart record.
 * A cart holds product references, not prices - prices are always derived from
 * the live product row at render time and re-derived again, authoritatively,
 * inside the checkout transaction.
 */
const currencyQuery = z.object({
  currency: z.nativeEnum(Currency).default(Currency.USD),
});

export const getCartSchema = z.object({ query: currencyQuery });

export const addCartItemSchema = z.object({
  query: currencyQuery,
  body: z.object({
    productId: uuid,
    // Upper bound stops a single request from reserving a vendor's entire stock,
    // and keeps lineTotal well inside Int range.
    quantity: z.number().int().positive().max(20).default(1),
  }),
});

export const updateCartItemSchema = z.object({
  query: currencyQuery,
  params: z.object({ productId: uuid }),
  body: z.object({
    // 0 is permitted and means "remove", so the frontend's quantity stepper
    // needs no special case for hitting zero.
    quantity: z.number().int().min(0).max(20),
  }),
});

export const removeCartItemSchema = z.object({
  query: currencyQuery,
  params: z.object({ productId: uuid }),
});
