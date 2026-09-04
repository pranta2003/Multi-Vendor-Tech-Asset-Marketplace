import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { orderNumberSchema } from '../orders/order.validation';
import * as controller from './payment.controller';

const router = Router();

/**
 * @openapi
 * /payments/stripe/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Stripe webhook receiver (signature verified)
 *     security: []
 *     description: >
 *       Consumes the raw request body so the HMAC signature can be verified
 *       byte-for-byte. Events are de-duplicated by a UNIQUE constraint on
 *       (provider, externalEventId), so redeliveries are safe. Returns 400 on a
 *       bad signature so Stripe does not retry, and 500 on genuine processing
 *       failures so that it does.
 *     responses:
 *       200: { description: Event accepted }
 *       400: { description: Missing or invalid signature }
 */
// No authenticate, no rate limiter: the HMAC signature IS the authentication,
// and rate-limiting a webhook endpoint would drop legitimate gateway traffic
// during a burst of settlements.
router.post('/stripe/webhook', asyncHandler(controller.stripeWebhook));

/**
 * @openapi
 * /payments/sslcommerz/ipn:
 *   post:
 *     tags: [Payments]
 *     summary: SSLCommerz IPN receiver
 *     security: []
 *     description: >
 *       Applies three checks before any fulfilment - verify_sign MD5 integrity,
 *       a server-to-server call to validationserverAPI.php, and an exact
 *       amount/currency match against the stored order. Always returns 200 once
 *       recorded so the gateway stops retrying.
 *     responses:
 *       200: { description: IPN recorded }
 */
router.post('/sslcommerz/ipn', asyncHandler(controller.sslczIpn));

/**
 * @openapi
 * /payments/sslcommerz/success:
 *   post:
 *     tags: [Payments]
 *     summary: Browser redirect target - informational only, never fulfils
 *     security: []
 *     responses:
 *       303: { description: Redirects to the SPA }
 */
router.post('/sslcommerz/success', controller.sslczSuccessRedirect);
router.post('/sslcommerz/fail', controller.sslczFailRedirect);
router.post('/sslcommerz/cancel', controller.sslczCancelRedirect);
// SSLCommerz POSTs by default but has been observed to GET on some cancel
// flows, so both verbs are accepted rather than returning a confusing 404.
router.get('/sslcommerz/success', controller.sslczSuccessRedirect);
router.get('/sslcommerz/fail', controller.sslczFailRedirect);
router.get('/sslcommerz/cancel', controller.sslczCancelRedirect);

/**
 * @openapi
 * /payments/{orderNumber}/status:
 *   get:
 *     tags: [Payments]
 *     summary: Poll settlement state for one of your own orders
 *     description: >
 *       The SPA polls this after returning from the SSLCommerz hosted page,
 *       because the browser redirect carries no trustworthy payment result.
 *     parameters:
 *       - { in: path, name: orderNumber, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Order and payment status }
 *       404: { description: Not found, or not owned by the caller }
 */
router.get(
  '/:orderNumber/status',
  authenticate,
  validate(orderNumberSchema),
  asyncHandler(controller.status),
);

export default router;
