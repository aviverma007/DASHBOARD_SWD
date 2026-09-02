export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: string; // lucide-react icon name
  status: "active" | "placeholder";
  /** Sidebar group this tab belongs to; rendered as a sub-heading. */
  section: string;
}

/** Section display order in the sidebar. */
/** "Top" renders without a heading — standalone items above the groups. */
export const NAV_SECTIONS = ["Top", "Sales", "Inventory", "Workspace"] as const;

/**
 * Only Overview and Inventory are fully built in this phase.
 * Everything else renders a consistent "coming soon" placeholder
 * so the nav is scalable without building unused pages.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Home", path: "/", icon: "House", status: "active", section: "Top" },
  { key: "overview", label: "Overview", path: "/overview", icon: "LayoutDashboard", status: "active", section: "Sales" },
  { key: "bookings", label: "Bookings", path: "/bookings", icon: "ReceiptText", status: "active", section: "Sales" },
  { key: "inventory", label: "Inventory", path: "/inventory", icon: "Building2", status: "active", section: "Inventory" },
  { key: "target", label: "Target vs Actual", path: "/target", icon: "Target", status: "active", section: "Sales" },
  { key: "channelpartner", label: "Channel Partners", path: "/channel-partners", icon: "Handshake", status: "active", section: "Sales" },
  { key: "galleryfootfall", label: "Gallery Footfall", path: "/gallery-footfall", icon: "Filter", status: "active", section: "Sales" },
  { key: "digitalleads", label: "Digital Leads", path: "/digital-leads", icon: "Zap", status: "active", section: "Sales" },
  { key: "projects", label: "Projects", path: "/projects", icon: "Building", status: "active", section: "Inventory" },
  { key: "reports", label: "Reports", path: "/reports", icon: "FileText", status: "active", section: "Workspace" },
  { key: "notes", label: "Notes", path: "/notes", icon: "NotebookPen", status: "active", section: "Workspace" },
  { key: "guide", label: "Guide", path: "/guide", icon: "BookOpen", status: "active", section: "Workspace" },
  { key: "settings", label: "Settings", path: "/settings", icon: "Settings", status: "active", section: "Workspace" },
];
