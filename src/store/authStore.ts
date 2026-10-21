import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi, type SessionUser } from "../services/authApi";

/**
 * Session state. Logins are checked by the VendorGlobe API (dash_auth.py);
 * this store keeps the session token plus the user's name, role and tab
 * rights, persisted so a refresh doesn't sign anyone out. Rights are
 * re-read from the server on every app load (useSessionRefresh), so an
 * admin's changes apply without the user signing out.
 */
interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  userId: string | null;
  userLabel: string | null;
  /** "all" or allowed route paths */
  access: "all" | string[] | null;
  role: string | null;
  /** an admin reset this password: the user must set a new one first */
  mustChange: boolean;
  signIn: (token: string, u: SessionUser) => void;
  setUser: (u: SessionUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false, token: null, userId: null, userLabel: null, access: null, role: null, mustChange: false,
      signIn: (token, u) => set({ isAuthenticated: true, token, userId: u.id, userLabel: u.displayName, access: u.access, role: u.role, mustChange: u.mustChange }),
      setUser: (u) => set({ userId: u.id, userLabel: u.displayName, access: u.access, role: u.role, mustChange: u.mustChange }),
      logout: () => {
        const t = get().token;
        if (t) authApi.logout(t).catch(() => {});   // end the server session too
        set({ isAuthenticated: false, token: null, userId: null, userLabel: null, access: null, role: null, mustChange: false });
      },
    }),
    { name: "swd-auth" }   // localStorage key
  )
);

/** Shared by the desktop and phone login screens: checks the password with
 *  the login service and returns the session to hand to signIn(). */
export function signInWithPassword(id: string, password: string) {
  return authApi.login(id.trim(), password);
}
