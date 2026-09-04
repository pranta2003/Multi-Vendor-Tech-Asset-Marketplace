import type { Request, Response } from 'express';
import type { Currency } from '@prisma/client';
import { sendSuccess } from '../../utils/ApiResponse';
import { UnauthorizedError } from '../../utils/ApiError';
import * as cartService from './cart.service';

const requireUserId = (req: Request): string => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user.id;
};

const currencyOf = (req: Request): Currency => req.query.currency as Currency;

export const get = async (req: Request, res: Response): Promise<void> => {
  const cart = await cartService.getCart(requireUserId(req), currencyOf(req));
  sendSuccess(res, { cart }, 'Cart retrieved');
};

export const add = async (req: Request, res: Response): Promise<void> => {
  const cart = await cartService.addItem(
    requireUserId(req),
    req.body.productId as string,
    req.body.quantity as number,
    currencyOf(req),
  );
  sendSuccess(res, { cart }, 'Item added to cart', 201);
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const cart = await cartService.updateItemQuantity(
    requireUserId(req),
    String(req.params.productId),
    req.body.quantity as number,
    currencyOf(req),
  );
  sendSuccess(res, { cart }, 'Cart updated');
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  const cart = await cartService.removeItem(
    requireUserId(req),
    String(req.params.productId),
    currencyOf(req),
  );
  sendSuccess(res, { cart }, 'Item removed from cart');
};

export const clear = async (req: Request, res: Response): Promise<void> => {
  await cartService.clearCart(requireUserId(req));
  sendSuccess(res, { cleared: true }, 'Cart cleared');
};
