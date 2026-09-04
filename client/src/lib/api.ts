import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ErrorBody, SuccessBody } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/**
 * ============================================================================
 * TOKEN STORAGE
 * ============================================================================
 * The access token is held in a MODULE-LEVEL VARIABLE - never localStorage,
 * sessionStorage, or a non-HttpOnly cookie.
 *
 * WHY this matters more than it looks:
 * Any XSS payload can read localStorage synchronously and exfiltrate a token
 * in a single line. A token in a closure variable is not readable by injected
 * script through any storage API, so an XSS becomes a session-scoped problem
 * rather than a "steal a 15-minute token and replay it from anywhere" problem.
 *
 * The trade-off is that a page refresh loses the token. That is solved properly
 * by silent refresh: the long-lived refresh token lives in an HttpOnly cookie
 * that JavaScript cannot read at all, and bootstrapSession() below exchanges it
 * for a new access token on load. So we get persistence WITHOUT ever putting a
 * credential somewhere script can read it.
 */
let accessToken: string | null = null;

/**
 * Incremented on every token change.
 *
 * WHY A COUNTER AND NOT JUST THE TOKEN VALUE:
 * requests are stamped with the generation they were sent under, which lets the
 * 401 handler distinguish "the current token is bad" from "this response is
 * stale - the token was already replaced while this request was in flight".
 * Comparing generations is reliable even if a refresh happens to return a token
 * string identical to the previous one.
 */
let tokenGeneration = 0;

/** Ensures a single logout is announced per expiry, not one per failed request. */
let sessionExpiredAnnounced = false;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  tokenGeneration += 1;
  // A successful sign-in/refresh re-arms the announcement for the next expiry.
  if (token !== null) sessionExpiredAnnounced = false;
};
export const getAccessToken = (): string | null => accessToken;

/**
 * Lets the auth store react to a refresh failure without creating a circular
 * import (store -> api -> store). The store registers a callback at startup.
 */
type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler = () => undefined;
export const setSessionExpiredHandler = (handler: SessionExpiredHandler): void => {
  onSessionExpired = handler;
};

/** A normalised error the UI can render without knowing about axios. */
export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId: string | undefined;
  public readonly details: unknown;

  constructor(message: string, status: number, code: string, requestId?: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }

  /** True when retrying the identical request could plausibly succeed. */
  get isRetryable(): boolean {
    return this.status === 409 || this.status === 429 || this.status >= 500;
  }
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  /**
   * REQUIRED for the HttpOnly refresh cookie to be sent at all. Without this,
   * the browser silently omits credentials and every refresh returns 401 - the
   * single most common cause of "my refresh flow does nothing" bugs.
   */
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/** Requests that must never carry an Authorization header or trigger a refresh. */
const AUTH_FREE_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];
const isAuthFreePath = (url: string | undefined): boolean =>
  !!url && AUTH_FREE_PATHS.some((p) => url.startsWith(p));

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken && !isAuthFreePath(config.url)) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
    // Record which token generation went out, so a 401 that arrives after a
    // refresh can be recognised as stale instead of triggering a second refresh.
    (config as RetriableConfig)._tokenGeneration = tokenGeneration;
  }
  return config;
});

/**
 * ============================================================================
 * SINGLE-FLIGHT REFRESH
 * ============================================================================
 * When an access token expires, several in-flight requests usually 401 at the
 * same moment (e.g. a page that loads the cart, the order list and the profile
 * concurrently). The naive implementation fires one refresh per failed request.
 *
 * That is actively harmful here, because the server implements refresh-token
 * ROTATION WITH REUSE DETECTION: each refresh invalidates the previous token.
 * Three parallel refreshes means tokens 2 and 3 present an already-rotated
 * token, the server correctly treats that as a stolen-token replay, and it
 * revokes the entire token family - logging the user out for doing nothing
 * wrong. Correct client behaviour is therefore not an optimisation, it is a
 * requirement for the security design to work.
 *
 * So: the FIRST 401 starts a refresh and every subsequent 401 awaits that same
 * promise, then replays with the new token.
 */
let refreshPromise: Promise<string> | null = null;

const performRefresh = async (): Promise<string> => {
  // Bare axios, not `api`: using the instance would recurse through this very
  // interceptor if the refresh call itself returned 401.
  const { data } = await axios.post<SuccessBody<{ accessToken: string; expiresIn: number }>>(
    `${API_BASE_URL}/auth/refresh`,
    {},
    { withCredentials: true, timeout: 20_000 },
  );
  const token = data.data.accessToken;
  setAccessToken(token);
  return token;
};

const refreshAccessToken = (): Promise<string> => {
  refreshPromise ??= performRefresh().finally(() => {
    // Cleared in `finally` so a FAILED refresh does not poison later attempts
    // with a permanently rejected promise.
    refreshPromise = null;
  });
  return refreshPromise;
};

interface RetriableConfig extends InternalAxiosRequestConfig {
  /** Set once this request has consumed its single refresh-and-retry attempt. */
  _retried?: boolean;
  /** Set once this request has been replayed with an already-refreshed token. */
  _replayed?: boolean;
  /** The token generation this request was actually sent with. */
  _tokenGeneration?: number;
}

const toApiError = (error: AxiosError<ErrorBody>): ApiClientError => {
  if (error.response) {
    const body = error.response.data;
    return new ApiClientError(
      body?.message ?? 'Request failed',
      error.response.status,
      body?.code ?? 'UNKNOWN',
      body?.requestId,
      body?.details,
    );
  }
  if (error.code === 'ECONNABORTED') {
    return new ApiClientError('The request timed out. Please try again.', 0, 'TIMEOUT');
  }
  return new ApiClientError(
    'Cannot reach the server. Check your connection and try again.',
    0,
    'NETWORK_ERROR',
  );
};

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<ErrorBody>) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    const shouldAttemptRefresh =
      status === 401 &&
      !!config &&
      // `_retried` makes the retry strictly one-shot. Without it, a token that
      // is refreshed successfully but still rejected (revoked user, changed
      // role) produces an infinite refresh/retry loop that hammers the API.
      !config._retried &&
      !isAuthFreePath(config.url);

    /**
     * STALE 401 SHORT-CIRCUIT.
     *
     * When several requests are in flight with an expired token, their 401s come
     * back staggered. The first one refreshes the token; by the time the others
     * fail, the token has ALREADY been replaced. Their 401 says nothing about the
     * new token - it is simply a late response to a request sent with the old
     * one. Treating it as a fresh failure makes each straggler start its own
     * refresh, and because the server rotates refresh tokens and treats reuse as
     * theft, those extra refreshes replay a consumed token and get the entire
     * family revoked - logging out a user who did nothing wrong.
     *
     * So if the token generation moved on since this request was sent, we replay
     * it with the current token and do NOT refresh again.
     */
    if (
      shouldAttemptRefresh &&
      accessToken !== null &&
      config._tokenGeneration !== undefined &&
      config._tokenGeneration !== tokenGeneration &&
      !config._replayed
    ) {
      config._replayed = true;
      config.headers.set('Authorization', `Bearer ${accessToken}`);
      try {
        return await api.request(config);
      } catch (replayError) {
        return Promise.reject(
          replayError instanceof ApiClientError
            ? replayError
            : toApiError(replayError as AxiosError<ErrorBody>),
        );
      }
    }

    if (shouldAttemptRefresh) {
      config._retried = true;

      /**
       * The refresh and the replay are wrapped SEPARATELY and deliberately.
       *
       * A single try/catch around both is a subtle and damaging bug: if the
       * refresh succeeds but the replayed request still returns 401 - a
       * genuinely forbidden endpoint, a revoked role, a resource the user may
       * not read - that second 401 lands in the same catch and gets reported as
       * "your session has expired", wiping a perfectly valid session and
       * bouncing the user to the login screen. Only a failed REFRESH means the
       * session is gone; a failed replay is just a normal API error.
       */
      let token: string;
      try {
        token = await refreshAccessToken();
      } catch {
        // The refresh token is gone, expired, or was revoked by reuse
        // detection. This is a real logout.
        //
        // Every queued request lands here, but the user must be told once - not
        // N times. The first arrival announces it; the rest stay quiet. Safe
        // without a lock because these catch blocks run as separate microtasks
        // on a single thread, so the check-then-set cannot interleave.
        if (!sessionExpiredAnnounced) {
          sessionExpiredAnnounced = true;
          setAccessToken(null);
          onSessionExpired();
        }
        return Promise.reject(
          new ApiClientError('Your session has expired. Please sign in again.', 401, 'SESSION_EXPIRED'),
        );
      }

      config.headers.set('Authorization', `Bearer ${token}`);
      try {
        return await api.request(config);
      } catch (retryError) {
        // Surface the real reason the retry failed, not a fabricated logout.
        return Promise.reject(
          retryError instanceof ApiClientError
            ? retryError
            : toApiError(retryError as AxiosError<ErrorBody>),
        );
      }
    }

    return Promise.reject(toApiError(error));
  },
);

/** Unwraps the `{ success, data }` envelope so callers deal in plain data. */
export const unwrap = <T>(response: AxiosResponse<SuccessBody<T>>): T => response.data.data;

/** Unwraps both the payload and the pagination metadata. */
export const unwrapPaged = <T>(
  response: AxiosResponse<SuccessBody<T>>,
): { data: T; meta: SuccessBody<T>['meta'] } => ({
  data: response.data.data,
  meta: response.data.meta,
});

/**
 * Restores a session on a cold page load.
 *
 * Returns null (rather than throwing) when there is no valid cookie, because
 * "this visitor is simply not logged in" is the normal case for a public
 * marketplace and must not surface as an error to the user.
 */
export const bootstrapSession = async (): Promise<string | null> => {
  try {
    return await refreshAccessToken();
  } catch {
    setAccessToken(null);
    return null;
  }
};
