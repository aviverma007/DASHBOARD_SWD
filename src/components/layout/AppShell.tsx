import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { OverviewDrawer } from "../overview/OverviewDrawer";
import clsx from "clsx";

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  // Both Overview (/) and Inventory (/inventory) now ship their own
  // navy filter bar and full-bleed layout (redesigned to match
  // Inventory's design system) — the generic FilterBar and content
  // padding would duplicate/interfere with either, so both are
  // suppressed here for every route except the still-generic
  // placeholder pages (Sales, Collections, etc.).
  const managesOwnChrome = location.pathname === "/" || location.pathname === "/inventory" || location.pathname === "/projects" || location.pathname === "/target" || location.pathname === "/channel-partners" || location.pathname === "/lead-conversion" || location.pathname === "/notes" || location.pathname === "/guide";

  return (
    <div className="min-h-screen bg-surface">
      <Header
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        onOpenMobileNav={() => setMobileNavOpen(true)}
      />

      <div className="flex">
        {/* Desktop sidebar — sticky below the header so it never scrolls
            away with the page content; own overflow scroll in case the
            nav list ever grows taller than the viewport. */}
        <aside
          className={clsx(
            "hidden shrink-0 self-start border-r border-border-subtle bg-white transition-all duration-200 lg:block",
            "sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto",
            sidebarCollapsed ? "w-16" : "w-56"
          )}
        >
          <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed((v) => !v)} />
        </aside>

        {/* Mobile drawer nav */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-charcoal/40"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-white shadow-drawer">
              <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3.5">
                <span className="text-sm font-bold text-navy">SWD Analytics</span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-md p-1.5 text-charcoal-soft hover:bg-surface"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>
              <Sidebar collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <div className={managesOwnChrome ? "" : "p-4 md:p-6"}>
            <Outlet />
          </div>
        </main>
      </div>

      <OverviewDrawer />
    </div>
  );
}
