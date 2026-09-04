/**
 * Proves the transaction-integrity requirement at the service layer.
 *
 * This test calls createCheckoutDraft() directly rather than going through HTTP,
 * which is only possible BECAUSE the business logic lives in a service that has
 * no dependency on Express. That is the practical payoff of the layering.
 */
import { Currency, PaymentProvider } from '@prisma/client';
import { prisma } from '../src/config/prisma';
import { createCheckoutDraft } from '../src/modules/orders/checkout.service';

/**
 * orders <- payments uses onDelete: Restrict by design (you must never be able
 * to delete an order that has a payment attached), so test cleanup has to remove
 * children explicitly.
 */
const resetOrders = async (): Promise<void> => {
  await prisma.paymentEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.downloadGrant.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
};

const CONCURRENT_BUYERS = 8;

const setupCartFor = async (userId: string, productId: string, quantity: number): Promise<void> => {
  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
};

const billing = {
  billingName: 'Race Tester',
  billingEmail: 'race@test.com',
  provider: PaymentProvider.STRIPE,
  currency: Currency.USD,
};

const main = async (): Promise<void> => {
  const scarce = await prisma.product.findUniqueOrThrow({ where: { slug: 'scarce-admin-kit' } });
  const unlimited = await prisma.product.findUniqueOrThrow({ where: { slug: 'unlimited-ui-kit' } });

  /* ---------------- TEST 1: oversell under real concurrency ---------------- */
  // Reset to exactly 1 licence.
  await prisma.product.update({ where: { id: scarce.id }, data: { stock: 1 } });
  await resetOrders();

  // N distinct users all holding the same last-in-stock item.
  const racers = await Promise.all(
    Array.from({ length: CONCURRENT_BUYERS }, (_, i) =>
      prisma.user.upsert({
        where: { email: `racer${i}@test.com` },
        create: { email: `racer${i}@test.com`, fullName: `Racer ${i}`, passwordHash: 'x' },
        update: {},
      }),
    ),
  );
  await Promise.all(racers.map((u) => setupCartFor(u.id, scarce.id, 1)));

  // Fire all checkouts simultaneously - this is the actual race.
  const results = await Promise.allSettled(
    racers.map((u) => createCheckoutDraft(u.id, billing)),
  );

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');
  const finalStock = await prisma.product.findUniqueOrThrow({
    where: { id: scarce.id },
    select: { stock: true },
  });

  console.log('--- TEST 1: oversell guard ---');
  console.log(`concurrent buyers      : ${CONCURRENT_BUYERS}`);
  console.log(`successful checkouts   : ${fulfilled.length}   (expect exactly 1)`);
  console.log(`rejected checkouts     : ${rejected.length}   (expect ${CONCURRENT_BUYERS - 1})`);
  console.log(`final stock            : ${finalStock.stock}   (expect 0, never negative)`);
  console.log(
    `sample rejection       : ${
      rejected[0]?.status === 'rejected' ? (rejected[0].reason as Error).message : 'n/a'
    }`,
  );
  console.log(
    `RESULT: ${fulfilled.length === 1 && finalStock.stock === 0 ? 'PASS' : 'FAIL'}`,
  );

  /* ------------- TEST 2: unlimited stock is never decremented ------------- */
  await resetOrders();
  await Promise.all(racers.map((u) => setupCartFor(u.id, unlimited.id, 2)));
  const unlimitedResults = await Promise.allSettled(
    racers.map((u) => createCheckoutDraft(u.id, billing)),
  );
  const unlimitedOk = unlimitedResults.filter((r) => r.status === 'fulfilled').length;
  const unlimitedStock = await prisma.product.findUniqueOrThrow({
    where: { id: unlimited.id },
    select: { stock: true },
  });

  console.log('\n--- TEST 2: unlimited stock (stock = NULL) ---');
  console.log(`successful checkouts   : ${unlimitedOk}   (expect ${CONCURRENT_BUYERS})`);
  console.log(`stock after            : ${unlimitedStock.stock}   (expect null)`);
  console.log(
    `RESULT: ${unlimitedOk === CONCURRENT_BUYERS && unlimitedStock.stock === null ? 'PASS' : 'FAIL'}`,
  );

  /* --------------- TEST 3: money maths and commission split --------------- */
  const anyOrder = await prisma.order.findFirstOrThrow({ include: { items: true } });
  const item = anyOrder.items[0];
  console.log('\n--- TEST 3: money arithmetic ---');
  if (!item) {
    console.log('RESULT: FAIL (no order item)');
  } else {
    const expectedLine = item.unitAmount * item.quantity;
    const balanced = item.platformFeeAmount + item.vendorEarning === item.lineTotal;
    const expectedFee = Math.round((item.lineTotal * item.commissionRateBps) / 10_000);
    console.log(`unitAmount x qty       : ${item.unitAmount} x ${item.quantity} = ${expectedLine}`);
    console.log(`lineTotal stored       : ${item.lineTotal}`);
    console.log(`commissionRateBps      : ${item.commissionRateBps} (= ${item.commissionRateBps / 100}%)`);
    console.log(`platformFee            : ${item.platformFeeAmount} (expect ${expectedFee})`);
    console.log(`vendorEarning          : ${item.vendorEarning}`);
    console.log(`fee + earning === line : ${balanced}`);
    console.log(`order.totalAmount      : ${anyOrder.totalAmount}`);
    console.log(
      `RESULT: ${
        item.lineTotal === expectedLine && balanced && item.platformFeeAmount === expectedFee
          ? 'PASS'
          : 'FAIL'
      }`,
    );
  }

  /* ------------- TEST 4: order is NOT payable/fulfilled at creation ------- */
  console.log('\n--- TEST 4: order starts unfulfilled ---');
  const statuses = await prisma.order.groupBy({ by: ['status'], _count: true });
  console.log(`statuses               : ${JSON.stringify(statuses)}`);
  const anyPaid = await prisma.order.count({ where: { status: { in: ['PAID', 'FULFILLED'] } } });
  const anyGrant = await prisma.downloadGrant.count();
  console.log(`orders PAID/FULFILLED  : ${anyPaid}   (expect 0)`);
  console.log(`download grants issued : ${anyGrant}   (expect 0)`);
  console.log(`RESULT: ${anyPaid === 0 && anyGrant === 0 ? 'PASS' : 'FAIL'}`);

  /* ----------- TEST 5: provider/currency mismatch is refused ------------- */
  console.log('\n--- TEST 5: provider/currency pairing ---');
  const racer0 = racers[0];
  if (!racer0) throw new Error('no racer');
  await setupCartFor(racer0.id, unlimited.id, 1);
  let mismatchMessage = 'NO ERROR THROWN';
  try {
    await createCheckoutDraft(racer0.id, {
      ...billing,
      provider: PaymentProvider.STRIPE,
      currency: Currency.BDT, // Stripe cannot settle BDT
    });
  } catch (err) {
    mismatchMessage = err instanceof Error ? err.message : String(err);
  }
  console.log(`STRIPE + BDT           : ${mismatchMessage}`);
  console.log(`RESULT: ${mismatchMessage.includes('settles in USD') ? 'PASS' : 'FAIL'}`);

  /* ----------- TEST 6: empty cart cannot produce an order --------------- */
  console.log('\n--- TEST 6: empty cart ---');
  const emptyUser = racers[1];
  if (!emptyUser) throw new Error('no racer');
  const emptyCart = await prisma.cart.findUniqueOrThrow({ where: { userId: emptyUser.id } });
  await prisma.cartItem.deleteMany({ where: { cartId: emptyCart.id } });
  let emptyMessage = 'NO ERROR THROWN';
  try {
    await createCheckoutDraft(emptyUser.id, billing);
  } catch (err) {
    emptyMessage = err instanceof Error ? err.message : String(err);
  }
  console.log(`empty cart checkout    : ${emptyMessage}`);
  console.log(`RESULT: ${emptyMessage === 'Your cart is empty' ? 'PASS' : 'FAIL'}`);
};

main()
  .catch((err) => {
    console.error('FATAL', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
