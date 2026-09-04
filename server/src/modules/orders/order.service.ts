import { OrderStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ForbiddenError, NotFoundError } from '../../utils/ApiError';
import { buildPagination, type PaginationMeta } from '../../utils/ApiResponse';

const orderDetailSelect = {
  id: true,
  orderNumber: true,
  status: true,
  currency: true,
  subtotalAmount: true,
  discountAmount: true,
  taxAmount: true,
  totalAmount: true,
  billingName: true,
  billingEmail: true,
  paidAt: true,
  fulfilledAt: true,
  failureReason: true,
  createdAt: true,
  items: {
    select: {
      productId: true,
      productTitle: true,
      productThumbnail: true,
      unitAmount: true,
      quantity: true,
      lineTotal: true,
    },
  },
  payments: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { provider: true, status: true, methodLabel: true, failureMessage: true },
  },
} satisfies Prisma.OrderSelect;

/**
 * platformFeeAmount, vendorEarning and commissionRateBps are intentionally NOT
 * in the customer-facing select. Our commission structure is commercially
 * sensitive and is nobody's business but ours and the vendor's.
 */
export const listMyOrders = async (
  userId: string,
  page: number,
  limit: number,
): Promise<{ items: unknown[]; meta: PaginationMeta }> => {
  const where: Prisma.OrderWhereInput = { customerId: userId };
  const [total, items] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: orderDetailSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { items, meta: buildPagination(page, limit, total) };
};

export const getMyOrder = async (userId: string, orderNumber: string): Promise<unknown> => {
  // Ownership is a WHERE predicate, not a post-fetch `if`. A missing order and
  // somebody else's order are indistinguishable to the caller, so this endpoint
  // cannot be used to probe which order numbers exist.
  const order = await prisma.order.findFirst({
    where: { orderNumber, customerId: userId },
    select: orderDetailSelect,
  });
  if (!order) throw new NotFoundError('Order');
  return order;
};

/**
 * Download grants are the customer's purchased licences. Only ever readable by
 * the buyer, and only for orders that actually reached FULFILLED.
 */
export const listMyEntitlements = async (userId: string): Promise<unknown[]> =>
  prisma.downloadGrant.findMany({
    where: {
      userId,
      isRevoked: false,
      order: { status: OrderStatus.FULFILLED },
    },
    select: {
      licenseKey: true,
      downloadCount: true,
      maxDownloads: true,
      expiresAt: true,
      createdAt: true,
      order: { select: { orderNumber: true } },
      product: { select: { id: true, title: true, slug: true, thumbnailUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

/**
 * Vendor sales view. Reads OrderItem rows (the immutable snapshot) rather than
 * joining live Product rows, so a vendor's historical earnings never change when
 * they edit a price today.
 */
export const listVendorSales = async (
  userId: string,
  role: Role,
): Promise<{ totalEarnings: number; itemCount: number; items: unknown[] }> => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!vendor && role !== Role.ADMIN) throw new ForbiddenError('You do not have a vendor profile');
  if (!vendor) return { totalEarnings: 0, itemCount: 0, items: [] };

  const items = await prisma.orderItem.findMany({
    where: {
      vendorId: vendor.id,
      // Only settled orders count toward earnings. Counting AWAITING_PAYMENT
      // rows would let anyone inflate a vendor's dashboard by starting
      // checkouts they never complete.
      order: { status: OrderStatus.FULFILLED },
    },
    select: {
      productTitle: true,
      unitAmount: true,
      quantity: true,
      lineTotal: true,
      commissionRateBps: true,
      platformFeeAmount: true,
      vendorEarning: true,
      createdAt: true,
      order: { select: { orderNumber: true, currency: true, fulfilledAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return {
    totalEarnings: items.reduce((sum, i) => sum + i.vendorEarning, 0),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    items,
  };
};
