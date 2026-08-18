import { create } from "zustand";

/**
 * DEMO AUTHENTICATION ONLY.
 *
 * This is not production security. There is no backend, no password
 * hashing, no token verification, no session expiry. It exists so the
 * login UI/UX can be built and demoed. When a real backend exists,
 * this store's actions should call /api/auth/login and /api/auth/otp
 * and store a real session token — see blueprint Section 25.
 */
interface AuthState {
  isAuthenticated: boolean;
  userLabel: string | null;
  login: (label: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  userLabel: null,
  login: (label) => set({ isAuthenticated: true, userLabel: label }),
  logout: () => set({ isAuthenticated: false, userLabel: null }),
}));
