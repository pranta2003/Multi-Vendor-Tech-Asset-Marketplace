import {
  Currency,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ProductStatus,
  VendorStatus,
  type Order,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { logger } from '../../utils/logger';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/ApiError';
import { withSerializableRetry } from '../../utils/transaction';
import { CURRENCY_PRICE_FIELD, splitCommission } from '../../utils/money';
import { generateGatewayTransactionId, generateOrderNumber } from '../../utils/identifiers';

export interface CheckoutBilling {
  billingName: string;
  billingEmail: string;
  billingPhone?: string;
  billingCountry?: string;
  billingAddress?: string;
  billingCity?: string;
}

export interface CheckoutInput extends CheckoutBilling {
  provider: PaymentProvider;
  currency: Currency;
}

export interface CheckoutDraft {
  order: Order;
  paymentId: string;
  gatewayTransactionId: string;
  productSummary: string;
}

/**
 * Shape of the locked row read. Prisma's $queryRaw is untyped at runtime, so
 * this interface is the single place where the raw SQL contract is declared.
 */
interface LockedProductRow {
  id: string;
  title: string;
  thumbnailUrl: string;
  status: ProductStatus;
  deletedAt: Date | null;
  stock: number | null;
  vendorId: string;
  priceUsdCents: number;
  priceBdtPoisha: number;
  commissionRateBps: number;
  vendorStatus: VendorStatus;
}

/**
 * Each gateway settles exactly one currency, so an attacker cannot ask us to
 * charge 1500 *poisha* (~12 BDT) through Stripe for a $15 product by swapping
 * the currency field. Enforced here in the service layer, not just in Zod,
 * because the service is the security boundary - it must hold even if another
 * caller (a cron job, an admin tool) skips the HTTP validation middleware.
 */
const assertProviderCurrencyPair = (provider: PaymentProvider, currency: Currency): void => {
  const allowed: Record<PaymentProvider, Currency> = {
    [PaymentProvider.STRIPE]: Currency.USD,
    [PaymentProvider.SSLCOMMERZ]: Currency.BDT,
  };
  if (allowed[provider] !== currency) {
    throw new BadRequestError(
      `${provider} settles in ${allowed[provider]} only; received ${currency}`,
    );
  }
};

/**
 * Creates the Order, OrderItems, stock reservation and Payment row atomically.
 *
 * Deliberately does NOT call the payment gateway. Network I/O inside a database
 * transaction is a cardinal sin: a slow gateway would hold row locks and an
 * open transaction for its entire timeout, exhausting the connection pool and
 * blocking every other checkout. The gateway call happens after COMMIT, in the
 * payment service.
 */
export const createCheckoutDraft = async (
  userId: string,
  input: CheckoutInput,
): Promise<CheckoutDraft> => {
  assertProviderCurrencyPair(input.provider, input.currency);

  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: { select: { id: true, title: true } } } } },
  });

  if (!cart || cart.items.length === 0) {
    throw new BadRequestError('Your cart is empty');
  }

  const quantityByProductId = new Map<string, number>();
  for (const item of cart.items) {
    quantityByProductId.set(item.productId, item.quantity);
  }
  const productIds = [...quantityByProductId.keys()];

  return withSerializableRetry(
    () =>
      prisma.$transaction(
        async (tx) => {
          /**
           * WHY explicit SELECT ... FOR UPDATE even under Serializable:
           * Serializable would *detect* the conflict and abort one transaction,
           * but pessimistic locking makes concurrent buyers queue instead of
           * fail-and-retry, which is far cheaper than burning three retries on
           * every contended product.
           *
           * WHY ORDER BY p.id: two carts containing the same two products in
           * opposite order would otherwise grab locks in opposite order and
           * deadlock. A globally consistent lock ordering makes deadlock
           * structurally impossible.
           *
           * WHY `FOR UPDATE OF p`: locking only the products rows. Without the
           * OF clause the joined vendor_profiles row is locked too, which would
           * serialise every simultaneous purchase from the same vendor - an
           * accidental global mutex on your most successful sellers.
           *
           * WHY ::uuid[] cast: Prisma sends JS strings as text parameters, and
           * Postgres has no implicit text = uuid operator.
           */
          const rows = await tx.$queryRaw<LockedProductRow[]>(Prisma.sql`
            SELECT p.id,
                   p.title,
                   p."thumbnailUrl",
                   p.status,
                   p."deletedAt",
                   p.stock,
                   p."vendorId",
                   p."priceUsdCents",
                   p."priceBdtPoisha",
                   v."commissionRateBps",
                   v.status AS "vendorStatus"
              FROM products p
              JOIN vendor_profiles v ON v.id = p."vendorId"
             WHERE p.id = ANY(${productIds}::uuid[])
             ORDER BY p.id
               FOR UPDATE OF p
          `);

          if (rows.length !== productIds.length) {
            throw new NotFoundError('One or more products in your cart');
          }

          const priceField = CURRENCY_PRICE_FIELD[input.currency];

          let subtotalAmount = 0;
          let platformFeeTotal = 0;
          const itemCreates: Prisma.OrderItemCreateManyOrderInput[] = [];
          const stockDecrements: Array<{ id: string; quantity: number }> = [];

          for (const row of rows) {
            const quantity = quantityByProductId.get(row.id) ?? 0;
            if (quantity <= 0) throw new BadRequestError('Invalid cart quantity');

            if (row.deletedAt !== null || row.status !== ProductStatus.PUBLISHED) {
              throw new ConflictError(`"${row.title}" is no longer available for purchase`);
            }
            if (row.vendorStatus !== VendorStatus.APPROVED) {
              throw new ConflictError(`The vendor for "${row.title}" is not currently active`);
            }

            // stock === null means an unlimited digital licence. Only finite
            // stock is reserved.
            if (row.stock !== null) {
              if (row.stock < quantity) {
                throw new ConflictError(
                  `Only ${row.stock} licence(s) left for "${row.title}"`,
                  { productId: row.id, available: row.stock, requested: quantity },
                );
              }
              stockDecrements.push({ id: row.id, quantity });
            }

            /**
             * Price comes from the LOCKED database row, never from the client.
             * A request body carrying a price field is ignored by construction -
             * there is nowhere for it to enter this calculation.
             */
            const unitAmount = row[priceField];
            if (unitAmount <= 0) {
              throw new ConflictError(`"${row.title}" is not priced in ${input.currency}`);
            }

            const lineTotal = unitAmount * quantity;
            const { platformFeeAmount, vendorEarning } = splitCommission(
              lineTotal,
              row.commissionRateBps,
            );

            subtotalAmount += lineTotal;
            platformFeeTotal += platformFeeAmount;

            itemCreates.push({
              productId: row.id,
              vendorId: row.vendorId,
              // Immutable snapshot: if the vendor later renames the product,
              // raises the price or changes their commission rate, this order -
              // and the vendor's payout for it - must not change retroactively.
              productTitle: row.title,
              productThumbnail: row.thumbnailUrl,
              unitAmount,
              quantity,
              lineTotal,
              commissionRateBps: row.commissionRateBps,
              platformFeeAmount,
              vendorEarning,
            });
          }

          const totalAmount = subtotalAmount; // no tax/discount engine in v1
          if (totalAmount <= 0) throw new BadRequestError('Order total must be greater than zero');

          for (const { id, quantity } of stockDecrements) {
            /**
             * Guarded UPDATE rather than a bare decrement. We already hold the
             * row lock so this cannot lose a race, but the `stock >= quantity`
             * predicate means that if the locking logic above is ever refactored
             * incorrectly, the write fails loudly instead of silently writing a
             * negative stock value. The DB CHECK (stock >= 0) is the third layer.
             */
            const affected = await tx.$executeRaw`
              UPDATE products
                 SET stock = stock - ${quantity}, "updatedAt" = NOW()
               WHERE id = ${id}::uuid AND stock >= ${quantity}
            `;
            if (affected !== 1) {
              throw new ConflictError('Stock changed while your order was being placed');
            }
          }

          const gatewayTransactionId = generateGatewayTransactionId();

          const order = await tx.order.create({
            data: {
              orderNumber: generateOrderNumber(),
              customerId: userId,
              // AWAITING_PAYMENT, never PAID. Nothing downstream treats this
              // order as sellable until a verified webhook/IPN says so.
              status: OrderStatus.AWAITING_PAYMENT,
              currency: input.currency,
              subtotalAmount,
              totalAmount,
              platformFeeAmount: platformFeeTotal,
              billingName: input.billingName,
              billingEmail: input.billingEmail,
              billingPhone: input.billingPhone ?? null,
              billingCountry: input.billingCountry ?? null,
              items: { createMany: { data: itemCreates } },
            },
          });

          const payment = await tx.payment.create({
            data: {
              orderId: order.id,
              provider: input.provider,
              status: PaymentStatus.INITIATED,
              currency: input.currency,
              amount: totalAmount,
              // providerTxnId is UNIQUE, so this doubles as a guarantee that one
              // gateway transaction id can only ever map to one payment row.
              providerTxnId: gatewayTransactionId,
            },
          });

          const firstTitle = itemCreates[0]?.productTitle ?? 'Digital asset';
          const productSummary =
            itemCreates.length > 1 ? `${firstTitle} +${itemCreates.length - 1} more` : firstTitle;

          return { order, paymentId: payment.id, gatewayTransactionId, productSummary };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          // maxWait: how long to queue for a pool connection.
          // timeout: hard ceiling on the transaction itself, so a stuck lock
          // cannot pin a connection indefinitely.
          maxWait: 5_000,
          timeout: 15_000,
        },
      ),
    {
      label: 'createCheckoutDraft',
      exhaustedMessage:
        'Several customers are checking out this item at once. Please try again in a moment.',
    },
  );
};

/**
 * Compensating action for a checkout whose gateway session could not be created.
 * Returns reserved stock so a gateway outage does not silently destroy
 * inventory. Idempotent via the status guard.
 */
export const abandonCheckoutDraft = async (orderId: string, reason: string): Promise<void> => {
  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order || order.status !== OrderStatus.AWAITING_PAYMENT) return;

      for (const item of order.items) {
        await tx.$executeRaw`
          UPDATE products
             SET stock = stock + ${item.quantity}, "updatedAt" = NOW()
           WHERE id = ${item.productId}::uuid AND stock IS NOT NULL
        `;
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.FAILED,
          failureReason: reason.slice(0, 500),
          cancelledAt: new Date(),
        },
      });
    });
  } catch (err) {
    // Never let cleanup failure mask the original gateway error the user needs
    // to see - log it for reconciliation instead.
    logger.error({ err, orderId }, 'Failed to release stock for abandoned checkout');
  }
};
