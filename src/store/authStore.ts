import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * DEMO AUTHENTICATION ONLY.
 *
 * Auth state is persisted to localStorage so a page refresh does NOT
 * force the user back to the login screen. The session only ends when
 * the user explicitly clicks Logout in Settings.
 *
 * This is not production security — no backend, no token verification,
 * no session expiry. When a real backend exists, replace login/logout
 * with real API calls and store a real session token.
 */
interface AuthState {
  isAuthenticated: boolean;
  userLabel: string | null;
  /** "all" or allowed route paths; null = legacy session (treated as all). */
  access: "all" | string[] | null;
  login: (label: string, access?: "all" | string[]) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userLabel: null,
      access: null,
      login: (label, access = "all") => set({ isAuthenticated: true, userLabel: label, access }),
      logout: () => set({ isAuthenticated: false, userLabel: null, access: null }),
    }),
    {
      name: "swd-auth", // localStorage key
    }
  )
);
