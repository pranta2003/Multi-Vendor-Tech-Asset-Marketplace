import { Prisma, ProductStatus, Role, VendorStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/ApiError';
import { buildPagination, type PaginationMeta } from '../../utils/ApiResponse';

export interface ListProductsQuery {
  page: number;
  limit: number;
  q?: string;
  categorySlug?: string;
  vendorSlug?: string;
  sort: 'newest' | 'price_asc' | 'price_desc' | 'popular';
}

export interface CreateProductInput {
  title: string;
  summary: string;
  description: string;
  priceUsdCents: number;
  priceBdtPoisha: number;
  thumbnailUrl: string;
  galleryUrls?: string[];
  stock?: number | null;
  categoryId?: string;
}

/**
 * Slugs are generated server-side from the title. Accepting a client-supplied
 * slug invites path-traversal-ish values and duplicate-content SEO problems.
 */
const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 180);

/** Fields safe to expose publicly - no internal counters or vendor payout data. */
const publicProductSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  priceUsdCents: true,
  priceBdtPoisha: true,
  thumbnailUrl: true,
  stock: true,
  ratingSum: true,
  ratingCount: true,
  downloadCount: true,
  publishedAt: true,
  category: { select: { name: true, slug: true } },
  vendor: { select: { storeName: true, slug: true } },
} satisfies Prisma.ProductSelect;

const ORDER_BY: Record<ListProductsQuery['sort'], Prisma.ProductOrderByWithRelationInput> = {
  newest: { publishedAt: 'desc' },
  price_asc: { priceUsdCents: 'asc' },
  price_desc: { priceUsdCents: 'desc' },
  popular: { downloadCount: 'desc' },
};

export const listProducts = async (
  query: ListProductsQuery,
): Promise<{ items: unknown[]; meta: PaginationMeta }> => {
  /**
   * Only PUBLISHED, non-deleted products are ever visible on the public
   * endpoint. This predicate is built here rather than left to the caller so a
   * new controller cannot forget it and leak draft products.
   */
  const where: Prisma.ProductWhereInput = {
    status: ProductStatus.PUBLISHED,
    deletedAt: null,
    ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
    ...(query.vendorSlug ? { vendor: { slug: query.vendorSlug } } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { summary: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  // $transaction for the count+page pair so the total cannot drift from the rows
  // returned - otherwise a concurrent insert makes the pagination footer lie.
  const [total, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: publicProductSelect,
      orderBy: ORDER_BY[query.sort],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
  ]);

  return { items, meta: buildPagination(query.page, query.limit, total) };
};

export const getProductBySlug = async (slug: string): Promise<unknown> => {
  const product = await prisma.product.findFirst({
    where: { slug, status: ProductStatus.PUBLISHED, deletedAt: null },
    select: {
      ...publicProductSelect,
      description: true,
      galleryUrls: true,
      // assets deliberately omitted: storageKey is the download secret and must
      // never be serialised to an unauthenticated visitor.
      _count: { select: { reviews: true } },
    },
  });
  if (!product) throw new NotFoundError('Product');
  return product;
};

const resolveVendorId = async (userId: string): Promise<string> => {
  const vendor = await prisma.vendorProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!vendor) throw new ForbiddenError('You do not have a vendor profile');
  if (vendor.status !== VendorStatus.APPROVED) {
    throw new ForbiddenError('Your vendor account is awaiting approval');
  }
  return vendor.id;
};

export const createProduct = async (userId: string, input: CreateProductInput): Promise<unknown> => {
  const vendorId = await resolveVendorId(userId);

  // Suffix guarantees uniqueness without a retry loop while keeping the slug
  // readable. Collisions on the base title are extremely common in a
  // marketplace ("Admin Dashboard Kit" from five vendors).
  const slug = `${slugify(input.title)}-${Date.now().toString(36)}`;

  return prisma.product.create({
    data: {
      vendorId,
      title: input.title,
      slug,
      summary: input.summary,
      description: input.description,
      priceUsdCents: input.priceUsdCents,
      priceBdtPoisha: input.priceBdtPoisha,
      thumbnailUrl: input.thumbnailUrl,
      galleryUrls: input.galleryUrls ?? [],
      stock: input.stock ?? null,
      categoryId: input.categoryId ?? null,
      // Vendors cannot self-publish. New listings enter PENDING_REVIEW so an
      // admin gates what appears on the storefront - essential for a
      // multi-vendor marketplace's trust and legal exposure.
      status: ProductStatus.PENDING_REVIEW,
    },
    select: { ...publicProductSelect, status: true },
  });
};

export const updateProductStatus = async (
  actorRole: Role,
  productId: string,
  status: ProductStatus,
): Promise<unknown> => {
  if (actorRole !== Role.ADMIN) throw new ForbiddenError('Only an admin can change product status');

  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!product) throw new NotFoundError('Product');
  if (product.status === status) throw new ConflictError(`Product is already ${status}`);

  return prisma.product.update({
    where: { id: productId },
    data: {
      status,
      // publishedAt is set once, the first time it goes live, so re-publishing an
      // archived product does not reset its position in "newest" sorting.
      ...(status === ProductStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
    },
    select: { ...publicProductSelect, status: true },
  });
};

export const listVendorProducts = async (userId: string): Promise<unknown[]> => {
  const vendorId = await resolveVendorId(userId);
  return prisma.product.findMany({
    where: { vendorId, deletedAt: null },
    select: { ...publicProductSelect, status: true },
    orderBy: { createdAt: 'desc' },
  });
};
