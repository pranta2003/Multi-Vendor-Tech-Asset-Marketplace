import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * WHY a dev proxy instead of pointing axios straight at http://localhost:5000:
 *
 * The refresh token lives in an HttpOnly cookie. If the SPA is served from
 * :5173 and the API is at :5000, that cookie is cross-site, so it needs
 * SameSite=None + Secure - which does not work over plain http in dev and is a
 * weaker posture in production. Proxying /api through the Vite origin makes the
 * cookie same-origin in development, so the exact same cookie settings
 * (SameSite=Lax, Secure) work in dev and prod. Fewer environment-specific
 * branches means fewer "works on my machine" auth bugs.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_DEV_PROXY_TARGET ?? 'http://localhost:5000';

  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true, secure: false },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          // Split vendor code so a change to app code does not invalidate the
          // (large, rarely-changing) React/Stripe chunks in users' caches.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            stripe: ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          },
        },
      },
    },
  };
});
