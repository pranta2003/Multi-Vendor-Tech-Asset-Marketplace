import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './cart.controller';
import {
  addCartItemSchema,
  getCartSchema,
  removeCartItemSchema,
  updateCartItemSchema,
} from './cart.validation';

const router = Router();

// Every cart route is customer-scoped. Applying authenticate at the router level
// means a newly added route cannot accidentally ship unauthenticated.
router.use(authenticate, authorize(Role.CUSTOMER, Role.ADMIN));

/**
 * @openapi
 * /cart:
 *   get:
 *     tags: [Cart]
 *     summary: Get the authenticated customer's cart
 *     parameters:
 *       - { in: query, name: currency, schema: { type: string, enum: [USD, BDT], default: USD } }
 *     responses:
 *       200: { description: Cart contents priced in the requested currency }
 */
router.get('/', validate(getCartSchema), asyncHandler(controller.get));

/**
 * @openapi
 * /cart/items:
 *   post:
 *     tags: [Cart]
 *     summary: Add a product to the cart
 *     responses:
 *       201: { description: Item added }
 *       409: { description: Product unavailable or insufficient stock }
 */
router.post('/items', validate(addCartItemSchema), asyncHandler(controller.add));

/**
 * @openapi
 * /cart/items/{productId}:
 *   patch:
 *     tags: [Cart]
 *     summary: Set the quantity for a cart line (0 removes it)
 *     parameters:
 *       - { in: path, name: productId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Cart updated }
 */
router.patch('/items/:productId', validate(updateCartItemSchema), asyncHandler(controller.update));

/**
 * @openapi
 * /cart/items/{productId}:
 *   delete:
 *     tags: [Cart]
 *     summary: Remove a product from the cart
 *     parameters:
 *       - { in: path, name: productId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Item removed }
 */
router.delete('/items/:productId', validate(removeCartItemSchema), asyncHandler(controller.remove));

/**
 * @openapi
 * /cart:
 *   delete:
 *     tags: [Cart]
 *     summary: Empty the cart
 *     responses:
 *       200: { description: Cart cleared }
 */
router.delete('/', asyncHandler(controller.clear));

export default router;
