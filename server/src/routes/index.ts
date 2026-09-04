import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import productRoutes from '../modules/catalog/product.routes';
import cartRoutes from '../modules/cart/cart.routes';
import orderRoutes from '../modules/orders/order.routes';
import paymentRoutes from '../modules/payments/payment.routes';
import { prisma } from '../config/prisma';
import { sendSuccess } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Liveness and readiness probe
 *     description: >
 *       Actively runs `SELECT 1` against PostgreSQL rather than just returning
 *       200 unconditionally. A process that is running but cannot reach its
 *       database is not ready to serve traffic, and a probe that ignores that
 *       would keep a broken instance in the load balancer rotation.
 *
 *
 *       Returns 503 on database failure so orchestrators (Docker healthcheck,
 *       Kubernetes readiness) can act on it. This route is excluded from request
 *       logging - probes fire constantly and would otherwise drown the logs.
 *     security: []
 *     responses:
 *       200:
 *         description: Service and database are healthy.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Success }
 *                 data:
 *                   type: object
 *                   properties:
 *                     status: { type: string, example: ok }
 *                     uptimeSeconds: { type: integer, example: 1284 }
 *                     timestamp: { type: string, format: date-time }
 *       503:
 *         description: The database is unreachable.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string, example: Database unreachable }
 *                 code: { type: string, example: SERVICE_UNAVAILABLE }
 */
router.get('/health', asyncHandler(async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    res.status(503).json({ success: false, message: 'Database unreachable', code: 'SERVICE_UNAVAILABLE' });
    return;
  }
  sendSuccess(res, {
    status: 'ok', uptimeSeconds: Math.floor(process.uptime()), timestamp: new Date().toISOString(),
  });
}));

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);

export default router;
