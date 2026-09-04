import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { paymentLimiter } from '../../middleware/rateLimiter';
import * as controller from './order.controller';
import { checkout } from '../payments/payment.controller';
import { checkoutSchema, listOrdersSchema, orderNumberSchema } from './order.validation';

const router = Router();

router.use(authenticate);

/**
 * @openapi
 * /orders/checkout:
 *   post:
 *     tags: [Orders]
 *     summary: Convert the cart into an order and open a payment session
 *     description: >
 *       Reserves stock inside a SERIALIZABLE transaction with row-level locks,
 *       creates the order in AWAITING_PAYMENT, then requests a payment session
 *       from the gateway. No amount is accepted from the client - the total is
 *       derived entirely from locked product rows. STRIPE settles USD,
 *       SSLCOMMERZ settles BDT.
 *     responses:
 *       201: { description: Order created with clientSecret (Stripe) or redirectUrl (SSLCommerz) }
 *       400: { description: Empty cart or provider/currency mismatch }
 *       402: { description: Gateway refused to open a session; stock released }
 *       409: { description: Insufficient stock or product no longer purchasable }
 */
router.post(
  '/checkout',
  // Tighter limit than the global one: checkout hits an external gateway and is
  // the most expensive endpoint in the system to abuse.
  paymentLimiter,
  authorize(Role.CUSTOMER, Role.ADMIN),
  validate(checkoutSchema),
  asyncHandler(checkout),
);

/**
 * @openapi
 * /orders:
 *   get:
 *     tags: [Orders]
 *     summary: List the authenticated customer's orders
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10, maximum: 50 } }
 *     responses:
 *       200: { description: Paginated order history }
 */
router.get('/', validate(listOrdersSchema), asyncHandler(controller.listMine));

/**
 * @openapi
 * /orders/entitlements:
 *   get:
 *     tags: [Orders]
 *     summary: List purchased licences (download grants) for fulfilled orders
 *     responses:
 *       200: { description: Licence list }
 */
router.get('/entitlements', asyncHandler(controller.entitlements));

/**
 * @openapi
 * /orders/vendor/sales:
 *   get:
 *     tags: [Orders]
 *     summary: Vendor earnings from fulfilled orders
 *     responses:
 *       200: { description: Sales lines with commission breakdown }
 *       403: { description: Not a vendor }
 */
router.get(
  '/vendor/sales',
  authorize(Role.VENDOR, Role.ADMIN),
  asyncHandler(controller.vendorSales),
);

/**
 * @openapi
 * /orders/{orderNumber}:
 *   get:
 *     tags: [Orders]
 *     summary: Get one of the authenticated customer's orders
 *     parameters:
 *       - { in: path, name: orderNumber, required: true, schema: { type: string, example: MKT-20260904-7Q2XKD } }
 *     responses:
 *       200: { description: Order detail }
 *       404: { description: Not found, or not owned by the caller }
 */
// Last, so the literal paths above are not swallowed by this parameterised one.
router.get('/:orderNumber', validate(orderNumberSchema), asyncHandler(controller.detail));

export default router;
