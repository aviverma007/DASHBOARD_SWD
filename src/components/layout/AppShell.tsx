import { useState } from "react";
import { Outlet } from "react-router-dom";
import { X } from "lucide-react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { FilterBar } from "../filters/FilterBar";
import { DrilldownDrawer } from "../drilldown/DrilldownDrawer";
import clsx from "clsx";

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      <Header
        onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
        onOpenMobileNav={() => setMobileNavOpen(true)}
      />

      <div className="flex">
        {/* Desktop sidebar */}
        <aside
          className={clsx(
            "hidden shrink-0 border-r border-border-subtle bg-white transition-all duration-200 lg:block",
            sidebarCollapsed ? "w-16" : "w-56"
          )}
        >
          <Sidebar collapsed={sidebarCollapsed} />
        </aside>

        {/* Mobile drawer nav */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-charcoal/40"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-drawer">
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
          <FilterBar />
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      <DrilldownDrawer />
    </div>
  );
}
