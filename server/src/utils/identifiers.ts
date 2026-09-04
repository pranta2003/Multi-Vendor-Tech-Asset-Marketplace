import crypto from 'node:crypto';

/**
 * Crockford base32 - no I, L, O or U. Order numbers and license keys get read
 * aloud over the phone to support agents, so removing visually ambiguous
 * characters eliminates a whole class of "I typed it exactly" tickets.
 */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const randomCrockford = (length: number): string => {
  // rejection-free approach: read one byte per char and mask to 5 bits.
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    // `noUncheckedIndexedAccess` makes the ?? 0 mandatory rather than defensive
    // theatre - TypeScript is right that Buffer indexing is not provably safe.
    out += CROCKFORD[(bytes[i] ?? 0) & 0x1f];
  }
  return out;
};

/**
 * WHY not a database sequence or an incrementing integer:
 * A guessable/enumerable order number leaks total sales volume to any customer
 * (order #1043 tells them we have had 1043 orders) and invites IDOR probing.
 * The date prefix keeps them human-sortable for support, and the random suffix
 * makes them unguessable. Uniqueness is still guaranteed by the UNIQUE index on
 * orders.orderNumber, with a bounded retry in the checkout service.
 *
 * Example: MKT-20260904-7Q2XKD
 */
export const generateOrderNumber = (now: Date = new Date()): string => {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `MKT-${y}${m}${d}-${randomCrockford(6)}`;
};

/**
 * License keys are the customer's proof of purchase and are surfaced in the UI,
 * so they must be unguessable: 20 Crockford chars is ~100 bits of entropy.
 * Formatted in groups of 5 purely for readability.
 */
export const generateLicenseKey = (): string => {
  const raw = randomCrockford(20);
  return [raw.slice(0, 5), raw.slice(5, 10), raw.slice(10, 15), raw.slice(15, 20)].join('-');
};

/**
 * Transaction id sent to SSLCommerz as `tran_id`. It is the only correlation
 * handle the gateway echoes back in the IPN, and SSLCommerz caps it at 30
 * characters - hence the deliberately short encoding rather than a raw UUID.
 */
export const generateGatewayTransactionId = (): string => `TXN${Date.now().toString(36).toUpperCase()}${randomCrockford(8)}`;
