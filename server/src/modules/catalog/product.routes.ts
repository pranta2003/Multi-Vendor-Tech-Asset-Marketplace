import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import * as controller from './product.controller';
import {
  createProductSchema,
  listProductsSchema,
  productSlugSchema,
  updateProductStatusSchema,
} from './product.validation';

const router = Router();

/**
 * @openapi
 * /products:
 *   get:
 *     tags: [Catalog]
 *     summary: Browse published products
 *     security: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 12, maximum: 50 } }
 *       - { in: query, name: q, schema: { type: string } }
 *       - { in: query, name: categorySlug, schema: { type: string } }
 *       - { in: query, name: vendorSlug, schema: { type: string } }
 *       - { in: query, name: sort, schema: { type: string, enum: [newest, price_asc, price_desc, popular] } }
 *     responses:
 *       200: { description: Paginated product list }
 */
router.get('/', validate(listProductsSchema), asyncHandler(controller.list));

/**
 * @openapi
 * /products/mine:
 *   get:
 *     tags: [Catalog]
 *     summary: List the authenticated vendor's own products, including drafts
 *     responses:
 *       200: { description: Vendor product list }
 *       403: { description: Not an approved vendor }
 */
// Registered BEFORE /:slug - otherwise Express would match "mine" as a slug.
router.get('/mine', authenticate, authorize(Role.VENDOR, Role.ADMIN), asyncHandler(controller.mine));

/**
 * @openapi
 * /products/{slug}:
 *   get:
 *     tags: [Catalog]
 *     summary: Get a single published product by slug
 *     security: []
 *     parameters:
 *       - { in: path, name: slug, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Product detail }
 *       404: { description: Not found or not published }
 */
router.get('/:slug', validate(productSlugSchema), asyncHandler(controller.detail));

/**
 * @openapi
 * /products:
 *   post:
 *     tags: [Catalog]
 *     summary: Submit a new product for admin review
 *     description: >
 *       Prices are integers in minor units (cents / poisha). The product is
 *       created as PENDING_REVIEW; vendors cannot self-publish.
 *     responses:
 *       201: { description: Product submitted }
 *       403: { description: Not an approved vendor }
 *       422: { description: Validation failed }
 */
router.post(
  '/',
  authenticate,
  authorize(Role.VENDOR, Role.ADMIN),
  validate(createProductSchema),
  asyncHandler(controller.create),
);

/**
 * @openapi
 * /products/{id}/status:
 *   patch:
 *     tags: [Catalog]
 *     summary: Approve, reject or archive a product (admin only)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Status updated }
 *       403: { description: Admin only }
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(Role.ADMIN),
  validate(updateProductStatusSchema),
  asyncHandler(controller.setStatus),
);

export default router;
