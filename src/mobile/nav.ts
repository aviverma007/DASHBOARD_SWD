/** Phone navigation model: five tabs + the module groups behind them. */
import { canAccess } from "../config/users";

export type Access = "all" | string[] | null;

export interface Mod { path: string; label: string; icon: string; blurb: string; tone?: "n" | "g" | "t" | "o" }

export const ANALYTICS: { title: string; items: Mod[] }[] = [
  { title: "Sales", items: [
    { path: "/bookings", label: "Bookings", icon: "ReceiptText", blurb: "Sales value, units, trends", tone: "n" },
    { path: "/target", label: "Target vs Actual", icon: "Target", blurb: "AOP achievement", tone: "g" },
    { path: "/channel-partners", label: "Channel Partners", icon: "Handshake", blurb: "Partner performance", tone: "t" },
    { path: "/eoi", label: "EOI / Advance", icon: "FileSignature", blurb: "Money in hand", tone: "o" },
    { path: "/gallery-footfall", label: "Gallery Footfall", icon: "Footprints", blurb: "Visits & conversion", tone: "n" },
    { path: "/digital-leads", label: "Digital Leads", icon: "Zap", blurb: "Enquiries & funnel", tone: "g" },
  ] },
  { title: "Finance", items: [
    { path: "/sap-collections", label: "SAP Collections", icon: "IndianRupee", blurb: "Demand, received, dues", tone: "t" },
    { path: "/cost", label: "Cost & Budget", icon: "Wallet", blurb: "Budget control", tone: "o" },
    { path: "/loan-details", label: "Loan Details", icon: "Landmark", blurb: "Bank loans", tone: "n" },
    { path: "/collections", label: "Collection", icon: "Banknote", blurb: "Customer collections", tone: "g" },
    { path: "/pr-to-po", label: "PR to PO", icon: "Workflow", blurb: "Procurement journey", tone: "t" },
  ] },
  { title: "Customer care", items: [
    { path: "/case-management", label: "Case Management", icon: "Headset", blurb: "Tickets & TAT", tone: "o" },
  ] },
];

export const PROJECT_MODS: Mod[] = [
  { path: "/inventory", label: "Inventory", icon: "Building2", blurb: "Stock by tower & floor", tone: "n" },
  { path: "/projects", label: "Stack plans", icon: "Building", blurb: "Unit availability", tone: "g" },
  { path: "/project-tracker", label: "Project Tracker", icon: "HardHat", blurb: "Construction progress", tone: "t" },
  { path: "/overview", label: "Business Overview", icon: "LayoutDashboard", blurb: "Portfolio snapshot", tone: "o" },
];

export const WORKSPACE: Mod[] = [
  { path: "/reports", label: "Reports", icon: "FileText", blurb: "Excel exports" },
  { path: "/notes", label: "Notes", icon: "NotebookPen", blurb: "Your notes" },
  { path: "/guide", label: "User Guide", icon: "BookOpen", blurb: "Formulas & help" },
  { path: "/settings", label: "Settings", icon: "Settings", blurb: "Account & password" },
];

export const TABS = [
  { key: "home", label: "Home", icon: "House", path: "/" },
  { key: "analytics", label: "Analytics", icon: "ChartNoAxesColumn", path: "/m/analytics" },
  { key: "projects", label: "Projects", icon: "Building2", path: "/m/projects" },
  { key: "reports", label: "Reports", icon: "FileText", path: "/reports" },
  { key: "more", label: "More", icon: "Menu", path: "/m/more" },
] as const;

const flat = (g: { items: Mod[] }[]) => g.flatMap(x => x.items);
export const ALL_MODS: Mod[] = [...flat(ANALYTICS), ...PROJECT_MODS, ...WORKSPACE];

export const visible = (mods: Mod[], access: Access) => mods.filter(m => canAccess(access, m.path));

/** which bottom tab "owns" a path (so the right tab lights up on detail screens) */
export function tabFor(path: string): string {
  if (path === "/") return "home";
  if (path.startsWith("/m/analytics") || flat(ANALYTICS).some(m => m.path === path)) return "analytics";
  if (path.startsWith("/m/projects") || PROJECT_MODS.some(m => m.path === path)) return "projects";
  if (path === "/reports") return "reports";
  return "more";
}

export const titleFor = (path: string): string => {
  const m = ALL_MODS.find(x => x.path === path);
  if (m) return m.label;
  if (path === "/m/analytics") return "Analytics";
  if (path === "/m/projects") return "Projects";
  if (path === "/m/more") return "More";
  if (path === "/change-password") return "Change password";
  if (path === "/lead-conversion") return "Gallery Footfall";
  return "SmartDB";
};

export const isRoot = (path: string) => TABS.some(t => t.path === path);
