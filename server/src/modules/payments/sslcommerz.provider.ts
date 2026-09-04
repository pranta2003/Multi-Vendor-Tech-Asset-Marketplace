import crypto from 'node:crypto';
import { Currency } from '@prisma/client';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { PaymentError } from '../../utils/ApiError';
import { minorToMajorString } from '../../utils/money';

/**
 * WHY no npm wrapper (e.g. `sslcommerz-lts`):
 * The popular community wrappers are thin, unmaintained shims over three HTTP
 * calls, and several of them do NOT perform the mandatory server-side
 * validation call - which is the entire security model of this gateway. Owning
 * ~150 lines of documented HTTP is strictly safer than depending on an
 * unaudited package that sits in your payment path.
 *
 * Endpoints below are the documented v4 API surface:
 *   POST {base}/gwprocess/v4/api.php                     -> create session
 *   GET  {base}/validator/api/validationserverAPI.php    -> verify a transaction
 */
const SSLCZ_BASE = env.SSLCZ_IS_LIVE
  ? 'https://securepay.sslcommerz.com'
  : 'https://sandbox.sslcommerz.com';

const SESSION_URL = `${SSLCZ_BASE}/gwprocess/v4/api.php`;
const VALIDATION_URL = `${SSLCZ_BASE}/validator/api/validationserverAPI.php`;

/** Statuses the validation API can return. Only the first two mean "money moved". */
const VALID_STATUSES = new Set(['VALID', 'VALIDATED']);

export interface SslczSessionRequest {
  transactionId: string;
  amountMinor: number;
  currency: Currency;
  productName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  customerCountry: string;
}

export interface SslczSessionResponse {
  gatewayPageUrl: string;
  sessionKey: string;
}

interface SslczRawSessionResponse {
  status?: string;
  failedreason?: string;
  sessionkey?: string;
  GatewayPageURL?: string;
}

export interface SslczValidationResult {
  status: string;
  tranId: string;
  valId: string;
  amountMinor: number;
  currency: string;
  bankTransactionId?: string;
  cardType?: string;
  riskLevel?: string;
  raw: Record<string, unknown>;
}

const postForm = async <T>(url: string, body: URLSearchParams): Promise<T> => {
  // AbortSignal.timeout: without an explicit timeout a hung gateway holds an
  // Express request (and a DB connection, if you were careless enough to open
  // one) until the process is restarted.
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new PaymentError(`SSLCommerz responded with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
};

/**
 * Step 1 of the SSLCommerz flow: exchange order details for a hosted payment
 * page URL. The customer is redirected there; we never touch card data, which
 * keeps this service out of PCI-DSS scope entirely.
 */
export const createSslczSession = async (
  input: SslczSessionRequest,
): Promise<SslczSessionResponse> => {
  const body = new URLSearchParams({
    store_id: env.SSLCZ_STORE_ID,
    store_passwd: env.SSLCZ_STORE_PASSWORD,
    total_amount: minorToMajorString(input.amountMinor, input.currency),
    currency: input.currency,
    tran_id: input.transactionId,

    // These four URLs are where SSLCommerz sends the browser / server.
    // success_url is a BROWSER redirect and is therefore untrusted - see the
    // controller: it only redirects, it never fulfils an order.
    success_url: `${env.SERVER_ORIGIN}/api/v1/payments/sslcommerz/success`,
    fail_url: `${env.SERVER_ORIGIN}/api/v1/payments/sslcommerz/fail`,
    cancel_url: `${env.SERVER_ORIGIN}/api/v1/payments/sslcommerz/cancel`,
    ipn_url: `${env.SERVER_ORIGIN}/api/v1/payments/sslcommerz/ipn`,

    cus_name: input.customerName,
    cus_email: input.customerEmail,
    cus_phone: input.customerPhone,
    cus_add1: input.customerAddress,
    cus_city: input.customerCity,
    cus_country: input.customerCountry,

    // Digital goods: SSLCommerz still requires shipping_method, and "NO" is the
    // documented value for non-shippable products.
    shipping_method: 'NO',
    num_of_item: '1',
    product_name: input.productName,
    product_category: 'digital-goods',
    product_profile: 'digital-goods',
  });

  const json = await postForm<SslczRawSessionResponse>(SESSION_URL, body);

  if (json.status !== 'SUCCESS' || !json.GatewayPageURL || !json.sessionkey) {
    logger.error({ status: json.status, reason: json.failedreason }, 'SSLCommerz session creation failed');
    throw new PaymentError(json.failedreason ?? 'Could not start the SSLCommerz payment session');
  }

  return { gatewayPageUrl: json.GatewayPageURL, sessionKey: json.sessionkey };
};

/**
 * Step 2 - THE MANDATORY ONE.
 *
 * The IPN body is an unauthenticated HTTP POST from the public internet. Anyone
 * who learns an order's tran_id can forge one. SSLCommerz's documented security
 * model is that the IPN is only a *notification*: you must call this validation
 * endpoint server-to-server with the val_id and trust ONLY its response.
 *
 * Skipping this call is the single most common way Bangladeshi checkouts get
 * drained, and it is what an interviewer will look for first.
 */
export const validateSslczTransaction = async (valId: string): Promise<SslczValidationResult> => {
  const url = new URL(VALIDATION_URL);
  url.searchParams.set('val_id', valId);
  url.searchParams.set('store_id', env.SSLCZ_STORE_ID);
  url.searchParams.set('store_passwd', env.SSLCZ_STORE_PASSWORD);
  url.searchParams.set('v', '1');
  url.searchParams.set('format', 'json');

  const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    throw new PaymentError(`SSLCommerz validation endpoint returned HTTP ${response.status}`);
  }

  const raw = (await response.json()) as Record<string, unknown>;
  const status = String(raw.status ?? 'UNKNOWN');
  const currency = String(raw.currency ?? '');

  return {
    status,
    tranId: String(raw.tran_id ?? ''),
    valId: String(raw.val_id ?? ''),
    // `amount` is what the customer was charged in the transaction currency.
    // We deliberately do NOT read `store_amount` (that is net of gateway fees)
    // for the equality check against the order total.
    amountMinor: Math.round(Number(raw.amount ?? 0) * 100),
    currency,
    bankTransactionId: raw.bank_tran_id ? String(raw.bank_tran_id) : undefined,
    cardType: raw.card_type ? String(raw.card_type) : undefined,
    riskLevel: raw.risk_level !== undefined ? String(raw.risk_level) : undefined,
    raw,
  };
};

export const isSslczValidationSuccessful = (status: string): boolean => VALID_STATUSES.has(status);

/**
 * Optional but cheap defence-in-depth: SSLCommerz signs the IPN body with an
 * MD5 `verify_sign` over the fields named in `verify_key`.
 *
 * The documented algorithm is:
 *   1. take each field listed in verify_key from the POST body
 *   2. add store_passwd = md5(store_password)
 *   3. sort keys ascending, join as key=value&...
 *   4. md5() the result and compare to verify_sign
 *
 * This only proves the payload was not tampered with in transit - it does NOT
 * prove the payment succeeded, because an attacker who never had the store
 * password simply omits the signature. So a failed check is a hard reject, but
 * a passing check still does not excuse us from calling the validation API.
 */
export const verifySslczIpnSignature = (payload: Record<string, string>): boolean => {
  const verifySign = payload.verify_sign;
  const verifyKey = payload.verify_key;
  if (!verifySign || !verifyKey) return false;

  const fields = verifyKey.split(',').map((k) => k.trim()).filter(Boolean);
  const pairs = new Map<string, string>();
  for (const field of fields) {
    pairs.set(field, payload[field] ?? '');
  }
  pairs.set('store_passwd', crypto.createHash('md5').update(env.SSLCZ_STORE_PASSWORD).digest('hex'));

  const sorted = [...pairs.keys()].sort();
  const queryString = sorted.map((k) => `${k}=${pairs.get(k) ?? ''}`).join('&');
  const expected = crypto.createHash('md5').update(queryString).digest('hex');

  // timingSafeEqual needs equal lengths; MD5 hex is always 32 chars but the
  // attacker controls verify_sign, so guard before comparing.
  if (expected.length !== verifySign.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(verifySign));
};
