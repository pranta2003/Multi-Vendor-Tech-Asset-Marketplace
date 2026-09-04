import type { Currency } from './types';

/**
 * All money crosses the wire as INTEGER MINOR UNITS (cents / poisha), exactly
 * as stored in the database. The frontend never does arithmetic on major units.
 *
 * WHY: floating point cannot represent 0.1 exactly, so summing prices as
 * decimals drifts (0.1 + 0.2 === 0.30000000000000004). On a cart of 20 items
 * that produces a total which disagrees with the server's integer total by a
 * cent - and the user sees a different number than they are charged. Integers
 * are exact; we convert to a decimal string only at the final render step.
 */
const MINOR_UNITS_PER_MAJOR = 100;

const LOCALE: Record<Currency, string> = { USD: 'en-US', BDT: 'en-BD' };

export const formatMoney = (minorAmount: number, currency: Currency): string =>
  new Intl.NumberFormat(LOCALE[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minorAmount / MINOR_UNITS_PER_MAJOR);

/** Picks the correct price column for the active currency. */
export const priceFor = (
  product: { priceUsdCents: number; priceBdtPoisha: number },
  currency: Currency,
): number => (currency === 'USD' ? product.priceUsdCents : product.priceBdtPoisha);

/**
 * Each gateway settles exactly one currency, mirroring the server-side rule.
 * Duplicated here purely for UX (so we can disable an impossible option before
 * the user submits) - the server remains the enforcement point.
 */
export const providerForCurrency = (currency: Currency): 'STRIPE' | 'SSLCOMMERZ' =>
  currency === 'USD' ? 'STRIPE' : 'SSLCOMMERZ';
