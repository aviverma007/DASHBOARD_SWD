import { useState } from "react";
import { useOutlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Header } from "./Header";
import clsx from "clsx";
import { Sidebar } from "./Sidebar";
import { OverviewDrawer } from "../overview/OverviewDrawer";
import { useIdleLogout } from "../../hooks/useIdleLogout";

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const outlet = useOutlet();
  useIdleLogout(); // 30-min inactivity → sign out (AppShell only renders when authenticated)
  // Both Overview (/) and Inventory (/inventory) now ship their own
  // navy filter bar and full-bleed layout (redesigned to match
  // Inventory's design system) — the generic FilterBar and content
  // padding would duplicate/interfere with either, so both are
  // suppressed here for every route except the still-generic
  // placeholder pages (Sales, Collections, etc.).
  const managesOwnChrome = location.pathname === "/" || location.pathname === "/overview" || location.pathname === "/inventory" || location.pathname === "/projects" || location.pathname === "/target" || location.pathname === "/channel-partners" || location.pathname === "/lead-conversion" || location.pathname === "/notes" || location.pathname === "/guide";

  return (
    <div className="min-h-screen bg-surface">
      <Header onOpenMobileNav={() => setMobileNavOpen(true)} />

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
                <img src="/brand/smartworld-logo.png" alt="Smart World" className="h-7 w-auto" />
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
          {/* Route transition. Two things matter here:
              1. useOutlet() snapshots the CURRENT page element — a plain
                 <Outlet/> inside the exiting wrapper would re-render to
                 the NEW route mid-exit (router context), collapsing the
                 whole transition into a flicker.
              2. y animates back to 0, and Framer clears the transform to
                 `none` at rest — so the pages' position:fixed drawers
                 are unaffected once the entrance settles. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              /* macOS-minimize feel: the leaving page shrinks toward
                 centre and fades; the arriving page grows from ~93%
                 with a springy overshoot (scales just past 100%, then
                 settles). Transform clears to `none` at rest, so the
                 pages' position:fixed drawers stay viewport-pinned. */
              initial={{ opacity: 0, scale: 0.93, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 6, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: "spring", stiffness: 240, damping: 19, mass: 0.9 }}
              style={{ transformOrigin: "50% 38%" }}
              className={managesOwnChrome ? "" : "p-4 md:p-6"}
            >
              {outlet}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <OverviewDrawer />
    </div>
  );
}
