import { create } from 'zustand';
import { bootstrapSession, setAccessToken, setSessionExpiredHandler } from '../lib/api';
import { authApi } from '../lib/services';
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
  register: (input: {
    email: string; password: string; fullName: string; role?: 'CUSTOMER' | 'VENDOR';
  }) => Promise<PublicUser>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialising: true,
  loading: false,
  error: null,

  initialise: async () => {
    // Registered here so the api layer can drop our state when a refresh fails,
    // without the api module importing the store (which would be circular).
    setSessionExpiredHandler(() => set({ user: null }));

    const token = await bootstrapSession();
    if (!token) {
      set({ user: null, initialising: false });
      return;
    }
    try {
      const user = await authApi.me();
      set({ user, initialising: false });
    } catch {
      setAccessToken(null);
      set({ user: null, initialising: false });
    }
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
      set({ user: null });
    }
  },

  clearError: () => set({ error: null }),
}));
