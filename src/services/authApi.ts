/** Client for the dashboard login service (VendorGlobe API · dash_auth.py).
 *  Users, password hashes and sessions live in SQL Server; the app only keeps
 *  the session token. Every call returns { ok, ... } or throws AuthError. */
import { API_BASE } from "../config/api";

export interface SessionUser {
  id: string; displayName: string; role: string;
  /** "all" or the tab paths this login may open */
  access: "all" | string[];
  mustChange: boolean;
}
export interface AdminUser extends SessionUser {
  active: boolean; createdAt: string; updatedAt: string; updatedBy: string | null; lastLogin: string | null;
}
export class AuthError extends Error {
  status: number;
  constructor(msg: string, status: number) { super(msg); this.status = status; }
}

async function call<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: {
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new AuthError("Can't reach the login service. Check the network or try again in a minute.", 0);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new AuthError(j.error || `Login service error (${r.status})`, r.status);
  return j as T;
}

export const authApi = {
  login: (id: string, password: string) => call<{ token: string; user: SessionUser }>("/auth/login", { body: { id, password } }),
  me: (token: string) => call<{ user: SessionUser }>("/auth/me", { token }),
  logout: (token: string) => call<{ ok: true }>("/auth/logout", { method: "POST", token }),
  changePassword: (token: string, current: string, next: string) =>
    call<{ ok: true }>("/auth/change-password", { token, body: { current, new: next } }),
  // admin
  listUsers: (token: string) => call<{ users: AdminUser[]; roles: string[] }>("/auth/users", { token }),
  createUser: (token: string, u: { id: string; displayName: string; role: string; access: "all" | string[]; password: string; mustChange: boolean }) =>
    call<{ user: AdminUser }>("/auth/users", { token, body: u }),
  updateUser: (token: string, id: string, patch: Partial<{ displayName: string; role: string; access: "all" | string[]; active: boolean }>) =>
    call<{ user: AdminUser }>(`/auth/users/${encodeURIComponent(id)}`, { token, method: "PUT", body: patch }),
  resetPassword: (token: string, id: string, password: string, mustChange: boolean) =>
    call<{ tempPassword: string | null }>(`/auth/users/${encodeURIComponent(id)}/reset-password`, { token, body: { password, mustChange } }),
};
