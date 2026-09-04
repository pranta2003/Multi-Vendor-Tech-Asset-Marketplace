import type { Response } from 'express';

export interface PaginationMeta {
  page: number; limit: number; total: number;
  totalPages: number; hasNext: boolean; hasPrev: boolean;
}
export interface SuccessBody<T> {
  success: true; message: string; data: T; meta?: PaginationMeta;
}
export const sendSuccess = <T>(
  res: Response, data: T, message = 'Success', statusCode = 200, meta?: PaginationMeta,
): Response<SuccessBody<T>> => {
  const body: SuccessBody<T> = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};
export const buildPagination = (page: number, limit: number, total: number): PaginationMeta => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
};
