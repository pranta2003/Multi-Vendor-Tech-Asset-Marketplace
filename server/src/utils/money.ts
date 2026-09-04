import { Currency } from '@prisma/client';

/**
 * WHY minor units everywhere:
 * Floating-point money is the single most common financial bug in e-commerce
 * code (0.1 + 0.2 !== 0.3). Every amount in this system is an integer in the
 * currency's smallest unit - cents for USD, poisha for BDT - so arithmetic is
 * exact and no rounding drift can accumulate across line items.
 *
 * The database enforces this too: every *Amount column is Int, never Decimal
 * or Float.
 */
export const MINOR_UNITS_PER_MAJOR: Readonly<Record<Currency, number>> = Object.freeze({
  [Currency.USD]: 100,
  [Currency.BDT]: 100,
});

/**
 * Each currency is served by exactly one gateway. Stripe is not licensed for
 * BDT settlement and SSLCommerz is a Bangladesh-only acquirer, so this is a
 * hard business rule rather than a preference - it lives here so the checkout
 * service and the validation schema cannot drift apart.
 */
export const CURRENCY_PRICE_FIELD: Readonly<Record<Currency, 'priceUsdCents' | 'priceBdtPoisha'>> =
  Object.freeze({
    [Currency.USD]: 'priceUsdCents',
    [Currency.BDT]: 'priceBdtPoisha',
  });

/** Converts a gateway's decimal string ("1150.00") into exact minor units. */
export const majorStringToMinor = (value: string, currency: Currency): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Non-numeric gateway amount: ${value}`);
  }
  // Multiply then round: parseFloat('1150.00') * 100 can land on 114999.99999
  // for some inputs, so rounding is mandatory, not cosmetic.
  return Math.round(numeric * MINOR_UNITS_PER_MAJOR[currency]);
};

/** Converts minor units into the decimal string gateways expect ("1150.00"). */
export const minorToMajorString = (minor: number, currency: Currency): string =>
  (minor / MINOR_UNITS_PER_MAJOR[currency]).toFixed(2);

/**
 * Commission is stored in basis points (1500 = 15.00%) so the rate itself is
 * an integer and can never suffer float drift either.
 *
 * The platform fee is rounded and the vendor receives the remainder. Doing it
 * in that order guarantees `platformFee + vendorEarning === lineTotal` exactly,
 * so the ledger always balances - if we rounded both independently we could be
 * off by one poisha per line, which is exactly the kind of discrepancy that
 * makes vendor payout reconciliation impossible.
 */
export const splitCommission = (
  lineTotal: number,
  commissionRateBps: number,
): { platformFeeAmount: number; vendorEarning: number } => {
  const platformFeeAmount = Math.round((lineTotal * commissionRateBps) / 10_000);
  return { platformFeeAmount, vendorEarning: lineTotal - platformFeeAmount };
};
