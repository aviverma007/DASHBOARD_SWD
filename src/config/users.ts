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
  role: "admin" | "developer" | "sales" | "finance" | "management";
}

export const APP_USERS: AppUser[] = [
  { id: "admin@admin", password: "admin",        displayName: "Admin",       role: "admin" },
  { id: "anirudh",     password: "swd@2026",     displayName: "Anirudh",     role: "developer" },
  { id: "sales",       password: "sales@123",    displayName: "Sales Team",  role: "sales" },
  { id: "finance",     password: "finance@123",  displayName: "Finance Team", role: "finance" },
  { id: "management",  password: "mgmt@123",     displayName: "Management",  role: "management" },
];

/** Case-insensitive on the ID; password is exact-match. */
export function findUser(id: string, password: string): AppUser | undefined {
  const norm = id.trim().toLowerCase();
  return APP_USERS.find(u => u.id.toLowerCase() === norm && u.password === password);
}
