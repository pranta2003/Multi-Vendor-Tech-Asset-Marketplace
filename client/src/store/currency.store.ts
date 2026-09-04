import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Currency } from '../lib/types';

interface CurrencyState {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

/**
 * Currency preference is persisted because it is a harmless display preference,
 * not a credential. This is exactly the kind of state localStorage is FOR - in
 * contrast to the access token, which must never go here.
 *
 * Defaults to BDT: the primary market is Bangladesh, and defaulting to the
 * local currency means the local payment rail (SSLCommerz) is the default path.
 */
export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: 'BDT',
      setCurrency: (currency) => set({ currency }),
    }),
    { name: 'assethub.currency' },
  ),
);
