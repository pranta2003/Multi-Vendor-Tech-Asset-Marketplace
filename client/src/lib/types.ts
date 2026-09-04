/**
 * Types mirroring the server's response contracts.
 *
 * These are hand-written rather than imported from the server package on
 * purpose: the frontend must depend on the API's *wire contract*, not on the
 * backend's internal Prisma types. If it imported Prisma models directly, an
 * internal-only column (commission rate, payout details, password hash) would
 * silently become part of the frontend's type surface and invite someone to
 * render it.
 */

export type Role = 'ADMIN' | 'VENDOR' | 'CUSTOMER';
export type Currency = 'USD' | 'BDT';
export type PaymentProvider = 'STRIPE' | 'SSLCOMMERZ';

export type OrderStatus =
  | 'PENDING'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFUNDED';

export type PaymentStatus =
  | 'REQUIRES_ACTION'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export type ProductStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';

/** The envelope every successful response uses. */
export interface SuccessBody<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** The envelope every failed response uses. `stack` is development-only. */
export interface ErrorBody {
  success: false;
  message: string;
  code: string;
  requestId?: string;
  details?: unknown;
  stack?: string;
}

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface AuthPayload {
  user: PublicUser;
  accessToken: string;
  expiresIn: number;
}

export interface ProductListItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  priceUsdCents: number;
  priceBdtPoisha: number;
  thumbnailUrl: string;
  stock: number | null;
  ratingSum: number;
  ratingCount: number;
  downloadCount: number;
  publishedAt: string | null;
  category: { name: string; slug: string } | null;
  vendor: { storeName: string; slug: string };
}

export interface ProductDetail extends ProductListItem {
  description: string;
  galleryUrls?: string[];
}

/**
 * The vendor's own view of a product. It is a SEPARATE type from ProductDetail
 * rather than an optional field on it, because `status` is only ever returned
 * by the vendor/admin endpoint. Making it optional on the public type would let
 * a component read `product.status` on a public product and silently render
 * `undefined`; a distinct type makes that a compile error.
 */
export interface VendorProduct extends ProductListItem {
  status: ProductStatus;
}

export interface CartLine {
  itemId: string;
  productId: string;
  title: string;
  slug: string;
  thumbnailUrl: string;
  unitAmount: number;
  quantity: number;
  lineTotal: number;
  stock: number | null;
  vendorStoreName: string;
}

export interface CartView {
  currency: Currency;
  items: CartLine[];
  itemCount: number;
  subtotalAmount: number;
}

export interface CheckoutRequest {
  provider: PaymentProvider;
  currency: Currency;
  billingName: string;
  billingEmail: string;
  billingPhone?: string;
  billingCountry?: string;
  billingAddress?: string;
  billingCity?: string;
}

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
    /** Stripe only. */
    clientSecret?: string;
    /** SSLCommerz only. */
    redirectUrl?: string;
  };
}

export interface PaymentStatusView {
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus | null;
}

/**
 * Mirrors the server's `orderDetailSelect` EXACTLY. Both the list and the detail
 * endpoint use that same select, so `items` is always present - it is not
 * optional, and a `_count` aggregate is never returned.
 *
 * These names were verified against live API responses rather than assumed:
 * the field is `productThumbnail`, not `thumbnailUrl`, and there is no
 * `productSlug`. A wrong name here compiles perfectly and then renders
 * `undefined` in the browser, which is precisely why the contract test asserts
 * these keys against real responses.
 */
export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: Currency;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  billingName: string;
  billingEmail: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  failureReason: string | null;
  createdAt: string;
  items: OrderItemView[];
}

export interface OrderItemView {
  productId: string;
  productTitle: string;
  productThumbnail: string;
  unitAmount: number;
  quantity: number;
  lineTotal: number;
}

export interface Entitlement {
  licenseKey: string;
  downloadCount: number;
  maxDownloads: number | null;
  expiresAt: string | null;
  createdAt: string;
  order: { orderNumber: string };
  product: { id: string; title: string; slug: string; thumbnailUrl: string };
}
