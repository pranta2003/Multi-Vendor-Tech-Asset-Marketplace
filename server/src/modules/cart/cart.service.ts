import { ProductStatus, VendorStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/ApiError';
import { CURRENCY_PRICE_FIELD } from '../../utils/money';
import type { Currency } from '@prisma/client';

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

/**
 * Cart is created lazily on first write rather than at registration. Most
 * visitors never add anything, so eagerly creating a row per user is wasted
 * storage and an extra write on the signup critical path.
 */
const getOrCreateCart = async (userId: string): Promise<string> => {
  const existing = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.cart.create({ data: { userId }, select: { id: true } });
  return created.id;
};

export const getCart = async (userId: string, currency: Currency): Promise<CartView> => {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        orderBy: { createdAt: 'asc' },
        include: {
          product: {
            select: {
              id: true, title: true, slug: true, thumbnailUrl: true, stock: true,
              priceUsdCents: true, priceBdtPoisha: true, status: true, deletedAt: true,
              vendor: { select: { storeName: true } },
            },
          },
        },
      },
    },
  });

  const priceField = CURRENCY_PRICE_FIELD[currency];
  const items: CartLine[] = [];
  let subtotalAmount = 0;

  for (const item of cart?.items ?? []) {
    // Silently hide unavailable products from the cart view rather than erroring:
    // the checkout service is the authority that rejects them, and a cart page
    // that 500s because a vendor archived something is a terrible experience.
    if (item.product.deletedAt !== null || item.product.status !== ProductStatus.PUBLISHED) continue;

    const unitAmount = item.product[priceField];
    const lineTotal = unitAmount * item.quantity;
    subtotalAmount += lineTotal;

    items.push({
      itemId: item.id,
      productId: item.product.id,
      title: item.product.title,
      slug: item.product.slug,
      thumbnailUrl: item.product.thumbnailUrl,
      unitAmount,
      quantity: item.quantity,
      lineTotal,
      stock: item.product.stock,
      vendorStoreName: item.product.vendor.storeName,
    });
  }

  return {
    currency,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotalAmount,
  };
};

export const addItem = async (
  userId: string,
  productId: string,
  quantity: number,
  currency: Currency,
): Promise<CartView> => {
  /**
   * Saleability is expressed as WHERE PREDICATES rather than as post-fetch `if`
   * checks, for the same reason order lookups scope by ownerId in the query:
   * an unpublished draft, a soft-deleted product and a product belonging to a
   * suspended vendor must all be INDISTINGUISHABLE from a product that does not
   * exist.
   *
   * The earlier version fetched by id alone and then threw a 409 "not currently
   * on sale". That is an enumeration oracle: an attacker who guesses or scrapes
   * a UUID learns that an unreleased product exists, and can poll the endpoint
   * to detect the exact moment a competitor's unannounced product is created.
   * A 404 leaks nothing.
   */
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      deletedAt: null,
      status: ProductStatus.PUBLISHED,
      vendor: { status: VendorStatus.APPROVED },
    },
    select: { id: true, stock: true, vendor: { select: { userId: true } } },
  });

  if (!product) throw new NotFoundError('Product');

  // A vendor buying their own asset would corrupt their own sales metrics and
  // trigger a self-referential payout.
  if (product.vendor.userId === userId) {
    throw new BadRequestError('You cannot purchase your own product');
  }
  if (product.stock !== null && product.stock < quantity) {
    throw new ConflictError(`Only ${product.stock} licence(s) available`);
  }

  const cartId = await getOrCreateCart(userId);

  /**
   * upsert against @@unique([cartId, productId]). Doing this as a
   * read-then-write would let two concurrent "add to cart" clicks create two
   * rows for the same product; the unique constraint plus upsert makes the
   * operation naturally idempotent per (cart, product).
   */
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity },
    update: { quantity: { increment: quantity } },
  });

  // Re-validate the accumulated quantity against stock: incrementing could have
  // pushed the line past what is available.
  if (product.stock !== null) {
    const line = await prisma.cartItem.findUniqueOrThrow({
      where: { cartId_productId: { cartId, productId } },
      select: { quantity: true },
    });
    if (line.quantity > product.stock) {
      await prisma.cartItem.update({
        where: { cartId_productId: { cartId, productId } },
        data: { quantity: product.stock },
      });
    }
  }

  return getCart(userId, currency);
};

export const updateItemQuantity = async (
  userId: string,
  productId: string,
  quantity: number,
  currency: Currency,
): Promise<CartView> => {
  const cart = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
  if (!cart) throw new NotFoundError('Cart');

  if (quantity === 0) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    return getCart(userId, currency);
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { stock: true },
  });
  if (!product) throw new NotFoundError('Product');
  if (product.stock !== null && product.stock < quantity) {
    throw new ConflictError(`Only ${product.stock} licence(s) available`);
  }

  // updateMany scoped by cartId means a caller cannot mutate somebody else's
  // cart line even by guessing an item id.
  const result = await prisma.cartItem.updateMany({
    where: { cartId: cart.id, productId },
    data: { quantity },
  });
  if (result.count === 0) throw new NotFoundError('Cart item');

  return getCart(userId, currency);
};

export const removeItem = async (
  userId: string,
  productId: string,
  currency: Currency,
): Promise<CartView> => {
  const cart = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
  if (!cart) throw new NotFoundError('Cart');
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  return getCart(userId, currency);
};

export const clearCart = async (userId: string): Promise<void> => {
  const cart = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
};
