import type Stripe from 'stripe';
import {
  Currency,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  type Order,
} from '@prisma/client';
import { prisma } from '../../config/prisma';
import { stripe } from '../../config/stripe';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { NotFoundError, PaymentError } from '../../utils/ApiError';
import { majorStringToMinor } from '../../utils/money';
import {
  abandonCheckoutDraft,
  createCheckoutDraft,
  type CheckoutInput,
} from '../orders/checkout.service';
import { failOrder, fulfillOrder } from '../orders/fulfillment.service';
import {
  createSslczSession,
  isSslczValidationSuccessful,
  validateSslczTransaction,
  verifySslczIpnSignature,
} from './sslcommerz.provider';

export interface CheckoutResult {
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    currency: Currency;
    totalAmount: number;
  };
  payment: {
    provider: PaymentProvider;
    /** Stripe only - the frontend confirms the intent with this. */
    clientSecret?: string;
    /** SSLCommerz only - the browser is redirected here. */
    redirectUrl?: string;
  };
}

/**
 * Guard against a webhook being trusted for an event we did not initiate.
 * Returns null when the event has already been recorded, which is our
 * idempotency gate.
 *
 * WHY record the event BEFORE processing it:
 * The @@unique([provider, externalEventId]) constraint turns "have I seen this
 * event?" into an atomic database operation. Checking with a SELECT and then
 * inserting would leave a window where two concurrent deliveries of the same
 * event both pass the check. Insert-first, catch-P2002 is race-free by
 * construction.
 */
const claimEvent = async (
  provider: PaymentProvider,
  externalEventId: string,
  eventType: string,
  rawPayload: Prisma.InputJsonValue,
  paymentId?: string,
): Promise<string | null> => {
  try {
    const event = await prisma.paymentEvent.create({
      data: {
        provider,
        externalEventId,
        eventType,
        rawPayload,
        paymentId: paymentId ?? null,
      },
    });
    return event.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      logger.info({ provider, externalEventId, eventType }, 'Duplicate gateway event ignored');
      return null;
    }
    throw err;
  }
};

const markEventProcessed = async (eventId: string, errorMessage?: string): Promise<void> => {
  await prisma.paymentEvent.update({
    where: { id: eventId },
    data: {
      processedAt: new Date(),
      errorMessage: errorMessage?.slice(0, 1000) ?? null,
    },
  });
};

/**
 * The heart of the transaction-integrity requirement.
 *
 * Before ANY order is fulfilled we independently re-derive the truth from the
 * gateway's own numbers and compare them to what we recorded at checkout. A
 * webhook that says "paid" is not sufficient: it must say paid for THIS order,
 * for EXACTLY the amount we asked for, in EXACTLY the currency we asked for.
 *
 * Without this check, a hostile client can create an order for $500, then have
 * the gateway charge $1 (by tampering with a redirect, replaying an old session,
 * or exploiting a gateway-side amount override) and still receive the goods.
 */
const assertAmountMatches = (
  order: Order,
  observedAmountMinor: number,
  observedCurrency: string,
): void => {
  if (observedCurrency.toUpperCase() !== order.currency) {
    throw new PaymentError('Currency mismatch between gateway and order', {
      expected: order.currency,
      received: observedCurrency,
    });
  }
  if (observedAmountMinor !== order.totalAmount) {
    throw new PaymentError('Amount mismatch between gateway and order', {
      expected: order.totalAmount,
      received: observedAmountMinor,
    });
  }
};

/* ------------------------------------------------------------------ checkout */

export const initiateCheckout = async (
  userId: string,
  input: CheckoutInput,
): Promise<CheckoutResult> => {
  // Phase 1: atomic DB work. Reserves stock, creates the order. No network I/O.
  const draft = await createCheckoutDraft(userId, input);
  const { order, paymentId, gatewayTransactionId, productSummary } = draft;

  // Phase 2: gateway call, deliberately AFTER commit so no lock is held across
  // the network. If it fails we compensate by releasing the reservation.
  try {
    if (input.provider === PaymentProvider.STRIPE) {
      const intent = await stripe.paymentIntents.create(
        {
          amount: order.totalAmount,
          currency: env.STRIPE_CURRENCY,
          // Metadata is our only correlation handle on the webhook. Both ids go
          // in so a support engineer can trace either direction.
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            paymentId,
          },
          description: `${order.orderNumber} - ${productSummary}`,
          receipt_email: order.billingEmail,
          automatic_payment_methods: { enabled: true },
        },
        {
          // Stripe-level idempotency: if this request is retried (our own retry,
          // a network hiccup, a double-clicking user) Stripe returns the SAME
          // PaymentIntent instead of creating a second one and double-charging.
          idempotencyKey: `pi_${paymentId}`,
        },
      );

      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.PENDING, providerRef: intent.id },
      });

      return {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          currency: order.currency,
          totalAmount: order.totalAmount,
        },
        payment: { provider: PaymentProvider.STRIPE, clientSecret: intent.client_secret ?? undefined },
      };
    }

    const session = await createSslczSession({
      transactionId: gatewayTransactionId,
      amountMinor: order.totalAmount,
      currency: order.currency,
      productName: productSummary,
      customerName: order.billingName,
      customerEmail: order.billingEmail,
      customerPhone: order.billingPhone ?? 'N/A',
      customerAddress: input.billingAddress ?? 'N/A',
      customerCity: input.billingCity ?? 'Dhaka',
      customerCountry: input.billingCountry ?? 'Bangladesh',
    });

    await prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PENDING, providerRef: session.sessionKey },
    });

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        currency: order.currency,
        totalAmount: order.totalAmount,
      },
      payment: { provider: PaymentProvider.SSLCOMMERZ, redirectUrl: session.gatewayPageUrl },
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Payment gateway error';
    await abandonCheckoutDraft(order.id, reason);
    throw err instanceof PaymentError ? err : new PaymentError(reason);
  }
};

/* ------------------------------------------------------------ stripe webhook */

export interface WebhookOutcome {
  received: true;
  handled: boolean;
  detail: string;
}

export const handleStripeEvent = async (event: Stripe.Event): Promise<WebhookOutcome> => {
  const eventId = await claimEvent(
    PaymentProvider.STRIPE,
    event.id,
    event.type,
    event as unknown as Prisma.InputJsonValue,
  );
  if (!eventId) return { received: true, handled: false, detail: 'duplicate event' };

  try {
    if (event.type !== 'payment_intent.succeeded' && event.type !== 'payment_intent.payment_failed') {
      await markEventProcessed(eventId);
      return { received: true, handled: false, detail: `unhandled type ${event.type}` };
    }

    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata?.orderId;
    const paymentId = intent.metadata?.paymentId;

    if (!orderId || !paymentId) {
      await markEventProcessed(eventId, 'PaymentIntent missing orderId/paymentId metadata');
      return { received: true, handled: false, detail: 'missing metadata' };
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      await markEventProcessed(eventId, 'Unknown order');
      return { received: true, handled: false, detail: 'unknown order' };
    }

    await prisma.paymentEvent.update({ where: { id: eventId }, data: { paymentId } });

    if (event.type === 'payment_intent.payment_failed') {
      await failOrder(orderId, paymentId, {
        code: intent.last_payment_error?.code,
        message: intent.last_payment_error?.message ?? 'Card payment failed',
        gatewayPayload: intent as unknown as Prisma.InputJsonValue,
      });
      await markEventProcessed(eventId);
      return { received: true, handled: true, detail: 'order failed' };
    }

    // amount_received is what Stripe actually captured - not `amount`, which is
    // merely what we requested.
    assertAmountMatches(order, intent.amount_received, intent.currency);

    const outcome = await fulfillOrder(orderId, {
      paymentId,
      providerRef: intent.id,
      methodLabel: intent.payment_method_types[0] ?? 'card',
      gatewayPayload: intent as unknown as Prisma.InputJsonValue,
    });

    await markEventProcessed(eventId);
    return {
      received: true,
      handled: outcome.fulfilled,
      detail: outcome.fulfilled ? 'order fulfilled' : 'already settled',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unhandled webhook error';
    await markEventProcessed(eventId, message);
    // Re-thrown so the controller returns 500 and Stripe retries. The event row
    // keeps the error for forensics, and the unique constraint means the retry
    // will be seen as a duplicate - so a poison event cannot loop forever.
    throw err;
  }
};

/* --------------------------------------------------------- sslcommerz ipn */

export const handleSslczIpn = async (body: Record<string, string>): Promise<WebhookOutcome> => {
  const tranId = body.tran_id;
  const valId = body.val_id;

  if (!tranId) return { received: true, handled: false, detail: 'missing tran_id' };

  /**
   * Layer 1 - payload integrity. Cheap, local, and rejects naive forgeries
   * outright. Not sufficient on its own (see the provider comment), so it is a
   * gate, not the decision.
   */
  if (!verifySslczIpnSignature(body)) {
    logger.warn({ tranId }, 'SSLCommerz IPN failed verify_sign check');
    return { received: true, handled: false, detail: 'invalid signature' };
  }

  const payment = await prisma.payment.findUnique({
    where: { providerTxnId: tranId },
    include: { order: true },
  });
  if (!payment) {
    logger.warn({ tranId }, 'IPN for unknown transaction');
    return { received: true, handled: false, detail: 'unknown transaction' };
  }

  // val_id is the gateway's own event identifier and is the natural idempotency
  // key. Falling back to tran_id keeps failure IPNs (which carry no val_id)
  // de-duplicated too.
  const eventId = await claimEvent(
    PaymentProvider.SSLCOMMERZ,
    valId ?? `${tranId}:${body.status ?? 'UNKNOWN'}`,
    `ipn.${(body.status ?? 'unknown').toLowerCase()}`,
    body as unknown as Prisma.InputJsonValue,
    payment.id,
  );
  if (!eventId) return { received: true, handled: false, detail: 'duplicate event' };

  try {
    const declaredStatus = body.status ?? 'UNKNOWN';

    if (declaredStatus !== 'VALID' && declaredStatus !== 'VALIDATED') {
      await failOrder(payment.orderId, payment.id, {
        code: declaredStatus,
        message: body.error ?? `Gateway reported ${declaredStatus}`,
        gatewayPayload: body as unknown as Prisma.InputJsonValue,
      });
      await markEventProcessed(eventId);
      return { received: true, handled: true, detail: `order failed (${declaredStatus})` };
    }

    if (!valId) {
      await markEventProcessed(eventId, 'Success IPN without val_id cannot be validated');
      return { received: true, handled: false, detail: 'missing val_id' };
    }

    /**
     * Layer 2 - THE AUTHORITATIVE CHECK. A server-to-server call to
     * validationserverAPI.php authenticated with our store credentials. The IPN
     * body's own `status` and `amount` fields are treated as untrusted hints
     * right up to this point; from here on we use ONLY what this call returns.
     */
    const validation = await validateSslczTransaction(valId);

    if (!isSslczValidationSuccessful(validation.status)) {
      await failOrder(payment.orderId, payment.id, {
        code: validation.status,
        message: `SSLCommerz validation returned ${validation.status}`,
        gatewayPayload: validation.raw as Prisma.InputJsonValue,
      });
      await markEventProcessed(eventId, `validation status ${validation.status}`);
      return { received: true, handled: true, detail: 'validation rejected' };
    }

    // Layer 3 - the validated transaction must belong to THIS order...
    if (validation.tranId !== tranId) {
      await markEventProcessed(eventId, 'tran_id mismatch against validation response');
      throw new PaymentError('Validated transaction does not match the notified transaction');
    }

    // ...and be for exactly the right money.
    assertAmountMatches(
      payment.order,
      // Recomputed from the validation response rather than reusing the IPN's
      // amount field, so a tampered IPN body cannot influence the comparison.
      majorStringToMinor(String(validation.raw.amount ?? '0'), payment.order.currency),
      validation.currency,
    );

    const outcome = await fulfillOrder(payment.orderId, {
      paymentId: payment.id,
      providerRef: validation.valId,
      methodLabel: validation.cardType ?? 'sslcommerz',
      gatewayPayload: validation.raw as Prisma.InputJsonValue,
    });

    await markEventProcessed(eventId);
    return {
      received: true,
      handled: outcome.fulfilled,
      detail: outcome.fulfilled ? 'order fulfilled' : 'already settled',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unhandled IPN error';
    await markEventProcessed(eventId, message);
    throw err;
  }
};

/* ------------------------------------------------------------------- queries */

export const getPaymentStatusForOrder = async (
  userId: string,
  orderNumber: string,
): Promise<{ orderNumber: string; orderStatus: OrderStatus; paymentStatus: PaymentStatus | null }> => {
  const order = await prisma.order.findFirst({
    // customerId in the WHERE clause, not checked afterwards - an IDOR is
    // impossible if the ownership predicate is part of the query itself.
    where: { orderNumber, customerId: userId },
    include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  if (!order) throw new NotFoundError('Order');

  return {
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    paymentStatus: order.payments[0]?.status ?? null,
  };
};
