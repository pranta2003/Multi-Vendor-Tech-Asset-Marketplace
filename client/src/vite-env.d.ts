/// <reference types="vite/client" />

/**
 * Typing import.meta.env turns a missing/renamed variable into a compile error
 * instead of `undefined` surfacing at runtime as a mysterious failed request.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  readonly VITE_DEV_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
