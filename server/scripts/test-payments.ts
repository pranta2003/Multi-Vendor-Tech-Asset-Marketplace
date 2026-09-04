/**
 * Payment verification tests.
 *
 * The SSLCommerz validation endpoint is stubbed by replacing global fetch, so we
 * can assert exactly how the service behaves when the gateway says VALID,
 * INVALID, or reports a different amount than the order. Nothing here talks to
 * the real internet.
 */
import crypto from 'node:crypto';
import { Currency, OrderStatus, PaymentProvider, PaymentStatus } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { createCheckoutDraft } from '../src/modules/orders/checkout.service';
import { handleSslczIpn } from '../src/modules/payments/payment.service';

const STORE_PASSWORD = 'testpass';

let pass = 0;
let fail = 0;
const check = (label: string, actual: unknown, expected: unknown): void => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass += 1;
  else fail += 1;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
};

/** Reimplements the documented SSLCommerz verify_sign algorithm to forge a *valid* signature. */
const signIpn = (fields: Record<string, string>): Record<string, string> => {
  const verifyKey = Object.keys(fields).sort().join(',');
  const pairs = new Map<string, string>();
  for (const k of verifyKey.split(',')) pairs.set(k, fields[k] ?? '');
  pairs.set('store_passwd', crypto.createHash('md5').update(STORE_PASSWORD).digest('hex'));
  const qs = [...pairs.keys()].sort().map((k) => `${k}=${pairs.get(k) ?? ''}`).join('&');
  const verifySign = crypto.createHash('md5').update(qs).digest('hex');
  return { ...fields, verify_key: verifyKey, verify_sign: verifySign };
};

/** Stub for the validation API. `mock` decides what the "gateway" reports. */
let mock: { status: string; amount: string; currency: string; tranId?: string } = {
  status: 'VALID',
  amount: '0',
  currency: 'BDT',
};

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes('validationserverAPI.php')) {
    const valId = new URL(url).searchParams.get('val_id') ?? '';
    return new Response(
      JSON.stringify({
        status: mock.status,
        tran_id: mock.tranId ?? valId.replace('VAL_', ''),
        val_id: valId,
        amount: mock.amount,
        currency: mock.currency,
        bank_tran_id: 'BANK123',
        card_type: 'VISA-Dutch Bangla',
        risk_level: '0',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;

const resetOrders = async (): Promise<void> => {
  await prisma.paymentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.downloadGrant.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
};

/** Builds a fresh BDT order in AWAITING_PAYMENT with one unit of the scarce product. */
const freshOrder = async (): Promise<{ orderId: string; tranId: string; total: number; paymentId: string }> => {
  await resetOrders();
  const buyer = await prisma.user.findUniqueOrThrow({ where: { email: 'buyer@test.com' } });
  const product = await prisma.product.findUniqueOrThrow({ where: { slug: 'scarce-admin-kit' } });
  await prisma.product.update({ where: { id: product.id }, data: { stock: 5 } });

  const cart = await prisma.cart.upsert({
    where: { userId: buyer.id },
    create: { userId: buyer.id },
    update: {},
    select: { id: true },
  });
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 1 } });

  const draft = await createCheckoutDraft(buyer.id, {
    provider: PaymentProvider.SSLCOMMERZ,
    currency: Currency.BDT,
    billingName: 'Pranta Kumer Pandit',
    billingEmail: 'buyer@test.com',
    billingPhone: '01712345678',
  });

  return {
    orderId: draft.order.id,
    tranId: draft.gatewayTransactionId,
    total: draft.order.totalAmount,
    paymentId: draft.paymentId,
  };
};

const orderState = async (orderId: string) => {
  const o = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, payments: true },
  });
  const grants = await prisma.downloadGrant.count({ where: { orderId } });
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: o.items[0]?.productId ?? '' },
    select: { stock: true },
  });
  return { status: o.status, grants, stock: product.stock, payment: o.payments[0]?.status };
};

const main = async (): Promise<void> => {
  /* ---- 1. Forged IPN with NO signature must be rejected outright ---- */
  console.log('--- 1. IPN with missing verify_sign (naive forgery) ---');
  {
    const o = await freshOrder();
    const outcome = await handleSslczIpn({
      tran_id: o.tranId,
      val_id: 'VAL_FORGED',
      status: 'VALID',
      amount: (o.total / 100).toFixed(2),
      currency: 'BDT',
    });
    const s = await orderState(o.orderId);
    check('rejected as invalid signature', outcome.detail, 'invalid signature');
    check('order still AWAITING_PAYMENT', s.status, OrderStatus.AWAITING_PAYMENT);
    check('no licences issued', s.grants, 0);
  }

  /* ---- 2. Tampered signature ---- */
  console.log('\n--- 2. IPN with a wrong verify_sign ---');
  {
    const o = await freshOrder();
    const body = signIpn({ tran_id: o.tranId, val_id: 'VAL_X', status: 'VALID', amount: '1.00', currency: 'BDT' });
    body.verify_sign = 'f'.repeat(32); // attacker guesses
    const outcome = await handleSslczIpn(body);
    const s = await orderState(o.orderId);
    check('rejected', outcome.detail, 'invalid signature');
    check('order untouched', s.status, OrderStatus.AWAITING_PAYMENT);
  }

  /* ---- 3. Valid signature but the validation API says INVALID ---- */
  console.log('\n--- 3. Signature OK, validation API returns INVALID_TRANSACTION ---');
  {
    const o = await freshOrder();
    const before = await orderState(o.orderId);
    mock = { status: 'INVALID_TRANSACTION', amount: (o.total / 100).toFixed(2), currency: 'BDT', tranId: o.tranId };
    const body = signIpn({
      tran_id: o.tranId, val_id: 'VAL_INVALID', status: 'VALID',
      amount: (o.total / 100).toFixed(2), currency: 'BDT',
    });
    const outcome = await handleSslczIpn(body);
    const s = await orderState(o.orderId);
    check('validation rejected', outcome.detail, 'validation rejected');
    check('order FAILED', s.status, OrderStatus.FAILED);
    check('payment FAILED', s.payment, PaymentStatus.FAILED);
    check('no licences issued', s.grants, 0);
    check('stock released', s.stock, (before.stock ?? 0) + 1);
  }

  /* ---- 4. THE BIG ONE: amount tampering ---- */
  console.log('\n--- 4. Validation says VALID but for a SMALLER amount (price tampering) ---');
  {
    const o = await freshOrder();
    mock = { status: 'VALID', amount: '1.00', currency: 'BDT', tranId: o.tranId }; // paid 1 BDT for a 5900 BDT order
    const body = signIpn({
      tran_id: o.tranId, val_id: 'VAL_CHEAP', status: 'VALID',
      // IPN body claims the full amount - only the validation API tells the truth
      amount: (o.total / 100).toFixed(2), currency: 'BDT',
    });
    let thrown = 'NONE';
    try {
      await handleSslczIpn(body);
    } catch (err) {
      thrown = err instanceof Error ? err.message : String(err);
    }
    const s = await orderState(o.orderId);
    check('amount mismatch raised', thrown, 'Amount mismatch between gateway and order');
    check('order NOT fulfilled', s.status, OrderStatus.AWAITING_PAYMENT);
    check('no licences issued', s.grants, 0);
  }

  /* ---- 5. Currency swap ---- */
  console.log('\n--- 5. Validation reports a different currency ---');
  {
    const o = await freshOrder();
    mock = { status: 'VALID', amount: (o.total / 100).toFixed(2), currency: 'USD', tranId: o.tranId };
    const body = signIpn({
      tran_id: o.tranId, val_id: 'VAL_CURR', status: 'VALID',
      amount: (o.total / 100).toFixed(2), currency: 'BDT',
    });
    let thrown = 'NONE';
    try { await handleSslczIpn(body); } catch (err) { thrown = err instanceof Error ? err.message : String(err); }
    const s = await orderState(o.orderId);
    check('currency mismatch raised', thrown, 'Currency mismatch between gateway and order');
    check('order NOT fulfilled', s.status, OrderStatus.AWAITING_PAYMENT);
  }

  /* ---- 6. Happy path ---- */
  console.log('\n--- 6. Fully valid IPN ---');
  let happy: { orderId: string; tranId: string; total: number; paymentId: string };
  {
    const o = await freshOrder();
    happy = o;
    mock = { status: 'VALID', amount: (o.total / 100).toFixed(2), currency: 'BDT', tranId: o.tranId };
    const body = signIpn({
      tran_id: o.tranId, val_id: 'VAL_GOOD', status: 'VALID',
      amount: (o.total / 100).toFixed(2), currency: 'BDT',
    });
    const outcome = await handleSslczIpn(body);
    const s = await orderState(o.orderId);
    const cartCount = await prisma.cartItem.count({
      where: { cart: { user: { email: 'buyer@test.com' } } },
    });
    const vendor = await prisma.vendorProfile.findUniqueOrThrow({ where: { slug: 'pixelforge' } });
    check('fulfilled', outcome.detail, 'order fulfilled');
    check('order FULFILLED', s.status, OrderStatus.FULFILLED);
    check('payment SUCCEEDED', s.payment, PaymentStatus.SUCCEEDED);
    check('one licence issued', s.grants, 1);
    check('cart cleared', cartCount, 0);
    check('vendor sales incremented', vendor.totalSalesCount >= 1, true);
  }

  /* ---- 7. Idempotency: same val_id delivered again ---- */
  console.log('\n--- 7. Duplicate IPN, same val_id (gateway retry) ---');
  {
    const body = signIpn({
      tran_id: happy.tranId, val_id: 'VAL_GOOD', status: 'VALID',
      amount: (happy.total / 100).toFixed(2), currency: 'BDT',
    });
    const outcome = await handleSslczIpn(body);
    const s = await orderState(happy.orderId);
    check('recognised as duplicate', outcome.detail, 'duplicate event');
    check('still exactly one licence', s.grants, 1);
    check('order still FULFILLED', s.status, OrderStatus.FULFILLED);
  }

  /* ---- 8. Replay with a NEW val_id after fulfilment ---- */
  console.log('\n--- 8. Second settlement attempt with a fresh val_id ---');
  {
    mock = { status: 'VALID', amount: (happy.total / 100).toFixed(2), currency: 'BDT', tranId: happy.tranId };
    const body = signIpn({
      tran_id: happy.tranId, val_id: 'VAL_GOOD_2', status: 'VALID',
      amount: (happy.total / 100).toFixed(2), currency: 'BDT',
    });
    const outcome = await handleSslczIpn(body);
    const s = await orderState(happy.orderId);
    check('reported as already settled', outcome.detail, 'already settled');
    check('no duplicate licence', s.grants, 1);
  }

  /* ---- 9. Failure IPN ---- */
  console.log('\n--- 9. Gateway reports FAILED ---');
  {
    const o = await freshOrder();
    const before = await orderState(o.orderId);
    const body = signIpn({
      tran_id: o.tranId, val_id: '', status: 'FAILED', error: 'Insufficient funds',
      amount: (o.total / 100).toFixed(2), currency: 'BDT',
    });
    const outcome = await handleSslczIpn(body);
    const s = await orderState(o.orderId);
    check('handled', outcome.handled, true);
    check('order FAILED', s.status, OrderStatus.FAILED);
    check('stock released', s.stock, (before.stock ?? 0) + 1);
    check('no licences', s.grants, 0);
  }

  /* ---- 10. IPN for an unknown transaction ---- */
  console.log('\n--- 10. IPN referencing an unknown tran_id ---');
  {
    const body = signIpn({ tran_id: 'TXNDOESNOTEXIST', val_id: 'VAL_Z', status: 'VALID', amount: '10.00', currency: 'BDT' });
    const outcome = await handleSslczIpn(body);
    check('rejected as unknown transaction', outcome.detail, 'unknown transaction');
  }

  console.log(`\nPASSED=${pass}  FAILED=${fail}`);
  if (fail > 0) process.exitCode = 1;
};

main()
  .catch((err) => {
    console.error('FATAL', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
