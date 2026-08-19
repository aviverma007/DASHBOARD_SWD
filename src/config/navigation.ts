export interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: string; // lucide-react icon name
  status: "active" | "placeholder";
}

/**
 * Only Overview and Inventory are fully built in this phase.
 * Everything else renders a consistent "coming soon" placeholder
 * so the nav is scalable without building unused pages.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Overview", path: "/", icon: "LayoutDashboard", status: "active" },
  { key: "inventory", label: "Inventory", path: "/inventory", icon: "Building2", status: "active" },
  { key: "sales", label: "Sales", path: "/sales", icon: "TrendingUp", status: "placeholder" },
  { key: "collections", label: "Collections", path: "/collections", icon: "Wallet", status: "placeholder" },
  { key: "revenue", label: "Revenue", path: "/revenue", icon: "IndianRupee", status: "placeholder" },
  { key: "customers", label: "Customers", path: "/customers", icon: "Users", status: "placeholder" },
  { key: "projects", label: "Projects", path: "/projects", icon: "Building", status: "active" },
  { key: "reports", label: "Reports", path: "/reports", icon: "FileText", status: "placeholder" },
  { key: "upload", label: "Data Upload", path: "/upload", icon: "UploadCloud", status: "placeholder" },
  { key: "settings", label: "Settings", path: "/settings", icon: "Settings", status: "placeholder" },
];
