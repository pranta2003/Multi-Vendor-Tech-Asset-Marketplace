import { create } from 'zustand';
import { cartApi } from '../lib/services';
import type { CartView, Currency } from '../lib/types';

interface CartState {
  cart: CartView | null;
  loading: boolean;
  /** Per-product pending flag, so one row's spinner does not freeze the page. */
  mutating: Record<string, boolean>;
  error: string | null;

  load: (currency: Currency) => Promise<void>;
  add: (productId: string, quantity: number, currency: Currency) => Promise<void>;
  update: (productId: string, quantity: number, currency: Currency) => Promise<void>;
  remove: (productId: string, currency: Currency) => Promise<void>;
  reset: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  loading: false,
  mutating: {},
  error: null,

  load: async (currency) => {
    set({ loading: true, error: null });
    try {
      set({ cart: await cartApi.get(currency), loading: false });
    } catch (err) {
      // A 401/403 here is normal for guests and vendors; surface the message but
      // do not treat it as a page-level failure.
      set({ loading: false, error: err instanceof Error ? err.message : 'Could not load cart' });
    }
  },

  add: async (productId, quantity, currency) => {
    set((s) => ({ mutating: { ...s.mutating, [productId]: true }, error: null }));
    try {
      set({ cart: await cartApi.add(productId, quantity, currency) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Could not add item' });
      throw err;
    } finally {
      set((s) => {
        const { [productId]: _removed, ...rest } = s.mutating;
        return { mutating: rest };
      });
    }
  },

  update: async (productId, quantity, currency) => {
    set((s) => ({ mutating: { ...s.mutating, [productId]: true }, error: null }));
    try {
      /**
       * The SERVER's returned cart is written to state verbatim - we never
       * optimistically patch quantities locally. Stock can change between
       * requests, so the server may legitimately return a different quantity
       * (or reject the change). Trusting the response keeps the displayed cart
       * identical to the cart that will actually be charged.
       */
      set({ cart: await cartApi.update(productId, quantity, currency) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Could not update item' });
      // Re-sync so the UI never shows a quantity the server rejected.
      await get().load(currency);
    } finally {
      set((s) => {
        const { [productId]: _removed, ...rest } = s.mutating;
        return { mutating: rest };
      });
    }
  },

  remove: async (productId, currency) => {
    set((s) => ({ mutating: { ...s.mutating, [productId]: true }, error: null }));
    try {
      set({ cart: await cartApi.remove(productId, currency) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Could not remove item' });
    } finally {
      set((s) => {
        const { [productId]: _removed, ...rest } = s.mutating;
        return { mutating: rest };
      });
    }
  },

  reset: () => set({ cart: null, error: null, mutating: {} }),
}));
