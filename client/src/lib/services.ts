import { api, unwrap, unwrapPaged } from './api';
import type {
  AuthPayload,
  CartView,
  CheckoutRequest,
  CheckoutResult,
  Currency,
  Entitlement,
  OrderSummary,
  PaginationMeta,
  PaymentStatusView,
  ProductDetail,
  ProductListItem,
  PublicUser,
  VendorProduct,
  SuccessBody,
} from './types';

/**
 * A thin, typed function per endpoint. Components never call axios directly, so
 * when a route or an envelope changes there is exactly one place to update and
 * the compiler locates every affected caller.
 *
 * Each call passes the FULL envelope type as the axios generic
 * (`SuccessBody<T>`) and then pipes through `unwrap`. That keeps the response
 * type honest end-to-end without a single `as` cast - if the server's shape and
 * this declaration disagree, it is a compile error rather than a runtime
 * `undefined` deep inside a component.
 */

export const authApi = {
  login: (email: string, password: string): Promise<AuthPayload> =>
    api.post<SuccessBody<AuthPayload>>('/auth/login', { email, password }).then(unwrap),

  register: (input: {
    email: string;
    password: string;
    fullName: string;
    role?: 'CUSTOMER' | 'VENDOR';
  }): Promise<AuthPayload> =>
    api.post<SuccessBody<AuthPayload>>('/auth/register', input).then(unwrap),

  me: (): Promise<PublicUser> =>
    api.get<SuccessBody<{ user: PublicUser }>>('/auth/me').then((r) => unwrap(r).user),

  logout: (): Promise<void> =>
    api.post<SuccessBody<null>>('/auth/logout').then(() => undefined),
};

export const productApi = {
  list: (params: {
    page?: number;
    limit?: number;
    q?: string;
    sort?: string;
    vendorSlug?: string;
  }): Promise<{ items: ProductListItem[]; meta: PaginationMeta | undefined }> =>
    api.get<SuccessBody<ProductListItem[]>>('/products', { params }).then((r) => {
      const { data, meta } = unwrapPaged(r);
      return { items: data, meta };
    }),

  detail: (slug: string): Promise<ProductDetail> =>
    api
      .get<SuccessBody<{ product: ProductDetail }>>(`/products/${encodeURIComponent(slug)}`)
      .then((r) => unwrap(r).product),

  mine: (): Promise<VendorProduct[]> =>
    api.get<SuccessBody<{ products: VendorProduct[] }>>('/products/mine').then((r) => unwrap(r).products),
};

export const cartApi = {
  get: (currency: Currency): Promise<CartView> =>
    api.get<SuccessBody<{ cart: CartView }>>('/cart', { params: { currency } }).then((r) => unwrap(r).cart),

  add: (productId: string, quantity: number, currency: Currency): Promise<CartView> =>
    api
      .post<SuccessBody<{ cart: CartView }>>('/cart/items', { productId, quantity }, { params: { currency } })
      .then((r) => unwrap(r).cart),

  update: (productId: string, quantity: number, currency: Currency): Promise<CartView> =>
    api
      .patch<SuccessBody<{ cart: CartView }>>(
        `/cart/items/${encodeURIComponent(productId)}`,
        { quantity },
        { params: { currency } },
      )
      .then((r) => unwrap(r).cart),

  remove: (productId: string, currency: Currency): Promise<CartView> =>
    api
      .delete<SuccessBody<{ cart: CartView }>>(`/cart/items/${encodeURIComponent(productId)}`, {
        params: { currency },
      })
      .then((r) => unwrap(r).cart),

  clear: (): Promise<void> =>
    api.delete<SuccessBody<{ cleared: boolean }>>('/cart').then(() => undefined),
};

export const orderApi = {
  checkout: (input: CheckoutRequest): Promise<CheckoutResult> =>
    api.post<SuccessBody<CheckoutResult>>('/orders/checkout', input).then(unwrap),

  listMine: (
    params: { page?: number; limit?: number } = {},
  ): Promise<{ items: OrderSummary[]; meta: PaginationMeta | undefined }> =>
    api.get<SuccessBody<OrderSummary[]>>('/orders', { params }).then((r) => {
      const { data, meta } = unwrapPaged(r);
      return { items: data, meta };
    }),

  detail: (orderNumber: string): Promise<OrderSummary> =>
    api
      .get<SuccessBody<{ order: OrderSummary }>>(`/orders/${encodeURIComponent(orderNumber)}`)
      .then((r) => unwrap(r).order),

  entitlements: (): Promise<Entitlement[]> =>
    api.get<SuccessBody<{ grants: Entitlement[] }>>('/orders/entitlements').then((r) => unwrap(r).grants),
};

export const paymentApi = {
  status: (orderNumber: string): Promise<PaymentStatusView> =>
    api
      .get<SuccessBody<PaymentStatusView>>(`/payments/${encodeURIComponent(orderNumber)}/status`)
      .then(unwrap),
};
