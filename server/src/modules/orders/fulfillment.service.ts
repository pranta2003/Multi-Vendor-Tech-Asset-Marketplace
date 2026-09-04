import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import { generateLicenseKey } from '../../utils/identifiers';
import { withSerializableRetry } from '../../utils/transaction';

export interface SettlementFacts {
  paymentId: string;
  providerRef: string;
  methodLabel?: string;
  gatewayPayload: Prisma.InputJsonValue;
}

export interface FulfillmentOutcome {
  fulfilled: boolean;
  alreadyProcessed: boolean;
  orderNumber: string;
}

/**
 * THE ONLY function in the codebase permitted to move an order to PAID/FULFILLED.
 *
 * It is called exclusively from verified webhook / IPN handlers - never from a
 * browser redirect, and never from the checkout endpoint. That single-entry
 * design is what makes the transaction-integrity requirement provable: to audit
 * "can an unpaid order ever be fulfilled?", you only have to audit this file's
 * callers.
 *
 * Idempotency is mandatory because every payment gateway retries webhooks. Both
 * Stripe and SSLCommerz will deliver the same success event multiple times on
 * timeout, and a non-idempotent handler would issue duplicate licences and
 * double-credit the vendor's sales counter.
 */
export const fulfillOrder = async (
  orderId: string,
  settlement: SettlementFacts,
): Promise<FulfillmentOutcome> =>
  // Wrapped in the retry helper for the same reason checkout is: this is a
  // Serializable transaction containing raw SQL, so two simultaneous webhook
  // deliveries can abort one another with SQLSTATE 40001. Retrying is correct
  // and safe here precisely because the operation is idempotent.
  withSerializableRetry(
    () =>
      prisma.$transaction(
    async (tx) => {
      /**
       * Re-read the order INSIDE the transaction with a row lock. Reading it
       * before the transaction would let two concurrent webhook deliveries both
       * observe status = AWAITING_PAYMENT and both proceed - the classic
       * check-then-act race. FOR UPDATE makes the second delivery block until
       * the first commits, at which point its status guard correctly sees
       * FULFILLED and bails out.
       */
      const locked = await tx.$queryRaw<Array<{ id: string; status: OrderStatus; orderNumber: string }>>(
        Prisma.sql`SELECT id, status, "orderNumber" FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`,
      );

      const current = locked[0];
      if (!current) {
        // Not throwing: a webhook for an order we do not have is not something
        // the gateway can fix by retrying, so we must still return 200 to it.
        logger.error({ orderId }, 'Fulfilment requested for unknown order');
        return { fulfilled: false, alreadyProcessed: true, orderNumber: '' };
      }

      if (current.status === OrderStatus.FULFILLED || current.status === OrderStatus.PAID) {
        logger.info({ orderId, status: current.status }, 'Duplicate settlement ignored');
        return { fulfilled: false, alreadyProcessed: true, orderNumber: current.orderNumber };
      }

      if (current.status !== OrderStatus.AWAITING_PAYMENT && current.status !== OrderStatus.PENDING) {
        // e.g. the order was already CANCELLED or FAILED and stock was released.
        // Fulfilling it now would hand over goods we have un-reserved.
        logger.warn({ orderId, status: current.status }, 'Settlement for non-payable order refused');
        return { fulfilled: false, alreadyProcessed: true, orderNumber: current.orderNumber };
      }

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });

      const now = new Date();

      await tx.payment.update({
        where: { id: settlement.paymentId },
        data: {
          status: PaymentStatus.SUCCEEDED,
          providerRef: settlement.providerRef,
          methodLabel: settlement.methodLabel ?? null,
          gatewayPayload: settlement.gatewayPayload,
          authorizedAt: now,
          capturedAt: now,
        },
      });

      /**
       * createMany + skipDuplicates leans on @@unique([orderId, productId]) on
       * download_grants: even if this transaction were somehow executed twice,
       * the database refuses to mint a second licence for the same line item.
       * Idempotency enforced by a constraint beats idempotency enforced by
       * application logic every time.
       */
      await tx.downloadGrant.createMany({
        data: order.items.map((item) => ({
          userId: order.customerId,
          productId: item.productId,
          orderId: order.id,
          licenseKey: generateLicenseKey(),
        })),
        skipDuplicates: true,
      });

      // Aggregate counters. Grouped by vendor so a multi-item order from one
      // vendor is a single UPDATE rather than N.
      const soldByVendor = new Map<string, number>();
      for (const item of order.items) {
        soldByVendor.set(item.vendorId, (soldByVendor.get(item.vendorId) ?? 0) + item.quantity);
      }
      for (const [vendorId, count] of soldByVendor) {
        await tx.vendorProfile.update({
          where: { id: vendorId },
          data: { totalSalesCount: { increment: count } },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.FULFILLED, paidAt: now, fulfilledAt: now },
      });

      /**
       * Cart is cleared here, not at checkout. If we had emptied it during
       * checkout and the gateway then failed, the customer would lose their
       * basket for a payment that never happened. Clearing on confirmed
       * settlement is the behaviour customers expect.
       */
      await tx.cartItem.deleteMany({
        where: {
          cart: { userId: order.customerId },
          productId: { in: order.items.map((i) => i.productId) },
        },
      });

      logger.info(
        { orderId, orderNumber: order.orderNumber, amount: order.totalAmount, currency: order.currency },
        'Order fulfilled',
      );

      return { fulfilled: true, alreadyProcessed: false, orderNumber: order.orderNumber };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 },
      ),
    { label: 'fulfillOrder' },
  );

/**
 * Terminal failure path: releases the reserved stock and records why.
 *
 * Also idempotent - a gateway that sends payment_failed twice must not return
 * stock twice, which would create phantom inventory out of thin air.
 */
export const failOrder = async (
  orderId: string,
  paymentId: string,
  failure: { code?: string; message: string; gatewayPayload?: Prisma.InputJsonValue },
): Promise<void> => {
  await withSerializableRetry(
    () =>
      prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; status: OrderStatus }>>(
        Prisma.sql`SELECT id, status FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`,
      );
      const current = locked[0];
      if (!current) return;

      // Only release stock from a state where it is actually still reserved.
      if (current.status !== OrderStatus.AWAITING_PAYMENT && current.status !== OrderStatus.PENDING) {
        logger.info({ orderId, status: current.status }, 'Failure event ignored for settled order');
        return;
      }

      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        await tx.$executeRaw`
          UPDATE products
             SET stock = stock + ${item.quantity}, "updatedAt" = NOW()
           WHERE id = ${item.productId}::uuid AND stock IS NOT NULL
        `;
      }

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.FAILED,
          failureCode: failure.code?.slice(0, 80) ?? null,
          failureMessage: failure.message.slice(0, 500),
          failedAt: new Date(),
          ...(failure.gatewayPayload ? { gatewayPayload: failure.gatewayPayload } : {}),
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.FAILED,
          failureReason: failure.message.slice(0, 500),
          cancelledAt: new Date(),
        },
      });

      logger.warn({ orderId, reason: failure.message }, 'Order failed, stock released');
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 },
      ),
    { label: 'failOrder' },
  );
};
