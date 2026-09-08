/** App login accounts.
 *
 * ⚠ DEMO-GRADE AUTH: these credentials live in the client bundle and
 * are readable by anyone with the app files. Fine for an internal
 * preview; move to a real backend/SSO before wider rollout (already
 * on the company-grade roadmap).
 *
 * To add/change a login, edit this list — one line per user. */
export interface AppUser {
  id: string;        // what they type in the User ID field
  password: string;
  displayName: string; // greeting name shown in the app
  role: "admin" | "developer" | "sales" | "finance" | "management" | "crm" | "pl";
  /** View rights: "all", or the route paths this login may open.
   * /  (home), /settings and /change-password are always allowed. */
  access: "all" | string[];
}

/** The Sales section, as shown in the sidebar. */
const SALES_PATHS = ["/overview", "/bookings", "/target", "/channel-partners", "/gallery-footfall", "/digital-leads"];

export const APP_USERS: AppUser[] = [
  { id: "admin@admin", password: "admin",        displayName: "Admin",       role: "admin",      access: "all" },
  { id: "anirudh",     password: "swd@2026",     displayName: "Anirudh",     role: "developer",  access: "all" },
  { id: "sales",       password: "sales@123",    displayName: "Sales Team",  role: "sales",      access: "all" },
  { id: "finance",     password: "finance@123",  displayName: "Finance Team", role: "finance",   access: "all" },
  { id: "management",  password: "mgmt@123",     displayName: "Management",  role: "management", access: "all" },
  { id: "amit.sharma@smartworlddevelopers.com", password: "Swd@2026", displayName: "Amit Sharma", role: "management", access: "all" },
  // ── view-restricted logins ──
  { id: "sales@smartworlddevelopers.com", password: "Swd@2026", displayName: "Sales",  role: "sales", access: SALES_PATHS },
  { id: "crm@smartworlddevelopers.com",   password: "Swd@2026", displayName: "CRM",    role: "crm",   access: ["/overview", "/case-management"] },
  { id: "p&l@smartworlddevelopers.com",   password: "Swd@2026", displayName: "P&L",    role: "pl",    access: ["/overview", "/target"] },
];

/** Always-permitted paths regardless of rights. */
const OPEN_PATHS = ["/", "/settings", "/change-password"];

/** Does this access list allow a route path? */
export function canAccess(access: "all" | string[] | null | undefined, path: string): boolean {
  if (OPEN_PATHS.includes(path)) return true;
  // null/undefined = a session persisted before view rights existed —
  // those were always full-access logins, so treat as "all". Restricted
  // accounts always carry an explicit array.
  if (access == null || access === "all") return true;
  return access.some(p => path === p || path.startsWith(p + "/"));
}

/** Case-insensitive on the ID; password is exact-match. */
export function findUser(id: string, password: string): AppUser | undefined {
  const norm = id.trim().toLowerCase();
  return APP_USERS.find(u => u.id.toLowerCase() === norm && u.password === password);
}
