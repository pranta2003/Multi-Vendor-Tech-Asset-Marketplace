import type { Request, Response } from 'express';
import { ProductStatus, Role } from '@prisma/client';
import { sendSuccess } from '../../utils/ApiResponse';
import { UnauthorizedError } from '../../utils/ApiError';
import * as productService from './product.service';

/**
 * Controllers in this codebase do exactly four things:
 *   1. pull already-validated values off the request
 *   2. call one service function
 *   3. shape the HTTP response
 *   4. nothing else
 *
 * No business rules, no Prisma calls, no price arithmetic. That is what makes
 * the services independently testable and reusable from a cron job or CLI.
 */
const requireUserId = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user.id;
};

export const list = async (req: Request, res: Response): Promise<void> => {
  const { items, meta } = await productService.listProducts({
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 12),
    q: req.query.q as string | undefined,
    categorySlug: req.query.categorySlug as string | undefined,
    vendorSlug: req.query.vendorSlug as string | undefined,
    sort: (req.query.sort as productService.ListProductsQuery['sort'] | undefined) ?? 'newest',
  });
  sendSuccess(res, items, 'Products retrieved', 200, meta);
};

export const detail = async (req: Request, res: Response): Promise<void> => {
  const product = await productService.getProductBySlug(String(req.params.slug));
  sendSuccess(res, { product }, 'Product retrieved');
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const product = await productService.createProduct(requireUserId(req), req.body);
  sendSuccess(res, { product }, 'Product submitted for review', 201);
};

export const mine = async (req: Request, res: Response): Promise<void> => {
  const products = await productService.listVendorProducts(requireUserId(req));
  sendSuccess(res, { products }, 'Vendor products retrieved');
};

export const setStatus = async (req: Request, res: Response): Promise<void> => {
  const role = req.user?.role ?? Role.CUSTOMER;
  const product = await productService.updateProductStatus(
    role,
    String(req.params.id),
    req.body.status as ProductStatus,
  );
  sendSuccess(res, { product }, 'Product status updated');
};
