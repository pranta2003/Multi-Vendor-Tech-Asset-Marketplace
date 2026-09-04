import { useEffect, useRef, useState } from 'react';
import { paymentApi } from '../lib/services';
import type { PaymentStatusView } from '../lib/types';

type Outcome = 'pending' | 'fulfilled' | 'failed' | 'timeout' | 'error';

interface PollResult {
  status: PaymentStatusView | null;
  outcome: Outcome;
  attempts: number;
  error: string | null;
}

const TERMINAL_SUCCESS = ['PAID', 'FULFILLED'];
const TERMINAL_FAILURE = ['FAILED', 'CANCELLED', 'REFUNDED'];

/**
 * Polls the order until the webhook/IPN has been processed server-side.
 *
 * WHY POLL AT ALL:
 * The browser's return from the gateway and the gateway's server-to-server
 * callback are two INDEPENDENT events with no guaranteed ordering. The user
 * frequently lands back on our site before the IPN has been received and
 * validated. The redirect therefore cannot be treated as proof of payment - the
 * server-side callback is the only authority - so the UI waits for the server
 * to confirm rather than assuming success from the redirect.
 *
 * Backoff is progressive: settlement usually completes in a couple of seconds,
 * but occasionally takes far longer. A fixed 1s interval would either give up
 * too early or hammer the API for a minute.
 */
export const useOrderStatusPolling = (orderNumber: string | undefined): PollResult => {
  const [result, setResult] = useState<PollResult>({
    status: null, outcome: 'pending', attempts: 0, error: null,
  });
  // Held in a ref so the effect never re-runs because of a timer id change.
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!orderNumber) return;
    let cancelled = false;
    let attempt = 0;

    // ~60s total: fast at first, then progressively slower.
    const delayFor = (n: number): number => (n < 5 ? 1200 : n < 10 ? 2500 : 5000);
    const MAX_ATTEMPTS = 20;

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      attempt += 1;

      try {
        const status = await paymentApi.status(orderNumber);
        if (cancelled) return;

        const done = TERMINAL_SUCCESS.includes(status.orderStatus);
        const failed = TERMINAL_FAILURE.includes(status.orderStatus);

        setResult({
          status,
          outcome: done ? 'fulfilled' : failed ? 'failed' : attempt >= MAX_ATTEMPTS ? 'timeout' : 'pending',
          attempts: attempt,
          error: null,
        });

        if (done || failed || attempt >= MAX_ATTEMPTS) return;
        timerRef.current = window.setTimeout(() => void tick(), delayFor(attempt));
      } catch (err) {
        if (cancelled) return;
        setResult((prev) => ({
          ...prev,
          attempts: attempt,
          // A transient network blip must not end the poll - only give up after
          // exhausting the attempt budget.
          outcome: attempt >= MAX_ATTEMPTS ? 'error' : 'pending',
          error: err instanceof Error ? err.message : 'Could not check payment status',
        }));
        if (attempt < MAX_ATTEMPTS) {
          timerRef.current = window.setTimeout(() => void tick(), delayFor(attempt));
        }
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [orderNumber]);

  return result;
};
