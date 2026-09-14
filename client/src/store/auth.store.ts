import { create } from 'zustand';
import { bootstrapSession, setAccessToken, setSessionExpiredHandler } from '../lib/api';
import { authApi } from '../lib/services';
import { signInWithGoogle } from '../lib/firebase';
import type { PublicUser } from '../lib/types';

interface AuthState {
  user: PublicUser | null;
  /**
   * `initialising` is deliberately separate from `loading`.
   *
   * On a cold load we do not yet know whether the visitor is authenticated -
   * that answer arrives only after the silent refresh resolves. Without this
   * flag, a protected route would evaluate `user === null` on the very first
   * render and bounce an authenticated user to the login page before their
   * session was restored. Guards must wait for `initialising === false`.
   */
  initialising: boolean;
  loading: boolean;
  error: string | null;

  initialise: () => Promise<void>;
  login: (email: string, password: string) => Promise<PublicUser>;
  loginWithGoogle: (role?: 'CUSTOMER' | 'VENDOR') => Promise<PublicUser>;
  register: (input: {
    email: string; password: string; fullName: string; role?: 'CUSTOMER' | 'VENDOR';
  }) => Promise<PublicUser>;
  logout: () => Promise<void>;
  clearError: () => void;
}

let initialisePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialising: true,
  loading: false,
  error: null,

  initialise: async () => {
    if (initialisePromise) return initialisePromise;

    initialisePromise = (async () => {
      // Registered here so the api layer can drop our state when a refresh fails,
      // without the api module importing the store (which would be circular).
      setSessionExpiredHandler(() => {
        initialisePromise = null;
        set({ user: null });
      });

      try {
        const session = await bootstrapSession();
        if (!session) {
          set({ user: null, initialising: false });
          return;
        }
        // Direct assignment from the refresh response payload: eliminates
        // the redundant secondary GET /auth/me network request on cold start.
        set({ user: session.user, initialising: false });
      } catch {
        setAccessToken(null);
        set({ user: null, initialising: false });
      }
    })();

    return initialisePromise;
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const payload = await authApi.login(email, password);
      setAccessToken(payload.accessToken);
      set({ user: payload.user, loading: false });
      return payload.user;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Login failed' });
      throw err;
    }
  },

  loginWithGoogle: async (role) => {
    set({ loading: true, error: null });
    try {
      const { idToken } = await signInWithGoogle();
      const payload = await authApi.googleLogin(idToken, role);
      setAccessToken(payload.accessToken);
      set({ user: payload.user, loading: false });
      return payload.user;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Google sign-in failed' });
      throw err;
    }
  },

  register: async (input) => {
    set({ loading: true, error: null });
    try {
      const payload = await authApi.register(input);
      setAccessToken(payload.accessToken);
      set({ user: payload.user, loading: false });
      return payload.user;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Registration failed' });
      throw err;
    }
  },

  logout: async () => {
    try {
      // Best-effort: the server clears the HttpOnly cookie and revokes the
      // refresh family. Even if it fails (offline), we still drop local state -
      // the user asked to log out and the UI must honour that immediately.
      await authApi.logout();
    } finally {
      setAccessToken(null);
      initialisePromise = null;
      set({ user: null });
    }
  },

  clearError: () => set({ error: null }),
}));
