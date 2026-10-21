/** Login rights helpers.
 *
 * Accounts and passwords are NOT in the app any more: they live in the
 * VendorGlobe API (SQL Server table DASH_USERS, hashed passwords) and an
 * admin manages them from Settings → User rights.
 */
import { NAV_ITEMS, NAV_SECTIONS } from "./navigation";

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin", developer: "Developer", sales: "Sales", finance: "Finance",
  management: "Management", crm: "CRM", pl: "Profit and loss",
};

/** Always-permitted paths regardless of rights. */
const OPEN_PATHS = ["/", "/settings", "/change-password"];

/** Does this access list allow a route path? */
export function canAccess(access: "all" | string[] | null | undefined, path: string): boolean {
  if (OPEN_PATHS.includes(path)) return true;
  if (access == null || access === "all") return true;
  return access.some(p => path === p || path.startsWith(p + "/"));
}

/** Tabs an admin can grant, grouped like the sidebar (Home and Settings are always open). */
export const GRANTABLE_TABS = NAV_SECTIONS.map(section => ({
  section,
  tabs: NAV_ITEMS.filter(n => n.section === section && !OPEN_PATHS.includes(n.path)).map(n => ({ path: n.path, label: n.label })),
})).filter(g => g.tabs.length);
