import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { stripe } from '../../config/stripe';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { sendSuccess } from '../../utils/ApiResponse';
import { BadRequestError, UnauthorizedError } from '../../utils/ApiError';
import * as paymentService from './payment.service';

const requireUserId = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user.id;
};

export const checkout = async (req: Request, res: Response): Promise<void> => {
  const result = await paymentService.initiateCheckout(requireUserId(req), req.body);
  sendSuccess(res, result, 'Checkout initiated', 201);
};

export const status = async (req: Request, res: Response): Promise<void> => {
  const result = await paymentService.getPaymentStatusForOrder(
    requireUserId(req),
    String(req.params.orderNumber),
  );
  sendSuccess(res, result, 'Payment status retrieved');
};

/**
 * Stripe webhook.
 *
 * `req.body` here is a raw Buffer, because app.ts mounts express.raw() on this
 * exact path BEFORE express.json(). This is mandatory: constructEvent computes
 * an HMAC over the byte-for-byte payload, and JSON.parse -> JSON.stringify
 * round-tripping changes key order and whitespace, which invalidates the
 * signature. "Works in Postman, fails with real Stripe" is almost always this.
 */
export const stripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string') {
    throw new BadRequestError('Missing stripe-signature header');
  }
  if (!Buffer.isBuffer(req.body)) {
    // Guards against a future refactor accidentally re-ordering the body
    // parsers, which would silently break signature verification.
    throw new BadRequestError('Stripe webhook body must be raw; body parser misconfigured');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // 400, never 500: a bad signature is the caller's problem and Stripe should
    // not retry it. Returning 500 here would make Stripe hammer us for days.
    logger.warn({ err: (err as Error).message }, 'Rejected Stripe webhook: bad signature');
    res.status(400).json({ success: false, message: 'Invalid webhook signature', code: 'INVALID_SIGNATURE' });
    return;
  }

  const outcome = await paymentService.handleStripeEvent(event);
  // Always 200 once the signature is verified and processing succeeded, so
  // Stripe stops retrying. Errors thrown from the service propagate to
  // errorHandler as a 500, which is exactly when we *do* want a retry.
  res.status(200).json(outcome);
};

/**
 * SSLCommerz IPN (Instant Payment Notification).
 *
 * Body is application/x-www-form-urlencoded. This is the ONLY SSLCommerz
 * endpoint that may fulfil an order - see payment.service for the three
 * verification layers it applies before doing so.
 */
export const sslczIpn = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Record<string, string>;
  const outcome = await paymentService.handleSslczIpn(body);
  res.status(200).json(outcome);
};

/**
 * Browser redirect targets.
 *
 * WHY these do not fulfil anything:
 * SSLCommerz POSTs the customer's *browser* to success_url. Anyone can craft
 * that request by hand - it carries no authentication and no signature we can
 * fully trust. Treating it as proof of payment is the single most common
 * SSLCommerz integration vulnerability. So these handlers only bounce the user
 * back to the SPA; the money question is settled asynchronously by the IPN.
 *
 * The frontend then polls GET /payments/:orderNumber/status, which reads the
 * order state that the IPN wrote.
 */
const redirectToClient = (res: Response, path: string, tranId?: string): void => {
  const url = new URL(path, env.CLIENT_ORIGIN);
  if (tranId) url.searchParams.set('tran_id', tranId);
  res.redirect(303, url.toString());
};

export const sslczSuccessRedirect = (req: Request, res: Response): void => {
  const tranId = (req.body as Record<string, string> | undefined)?.tran_id;
  logger.info({ tranId }, 'SSLCommerz browser redirect: success (informational only)');
  redirectToClient(res, '/checkout/processing', tranId);
};

export const sslczFailRedirect = (req: Request, res: Response): void => {
  const tranId = (req.body as Record<string, string> | undefined)?.tran_id;
  redirectToClient(res, '/checkout/failed', tranId);
};

export const sslczCancelRedirect = (req: Request, res: Response): void => {
  const tranId = (req.body as Record<string, string> | undefined)?.tran_id;
  redirectToClient(res, '/checkout/cancelled', tranId);
};
