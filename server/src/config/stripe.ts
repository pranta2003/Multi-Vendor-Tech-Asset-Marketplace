import Stripe from 'stripe';
import { env } from './env';

/**
 * WHY pin apiVersion explicitly:
 * If you omit it, Stripe uses whatever version is set on the account dashboard.
 * That means someone clicking "upgrade API version" in a browser can silently
 * change the shape of your webhook payloads in production. Pinning it in code
 * makes the API contract part of your deploy, reviewable in a pull request.
 *
 * maxNetworkRetries: Stripe's SDK retries idempotently on connection errors and
 * 5xx responses, which turns a transient blip into a non-event instead of a
 * failed checkout.
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
  maxNetworkRetries: 2,
  timeout: 15_000,
  appInfo: { name: 'tech-asset-marketplace', version: '1.0.0' },
});
