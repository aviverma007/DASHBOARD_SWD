import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Dock, DockIcon, DockItem, DockLabel } from "../ui/dock";
import { NAV_ITEMS, NAV_SECTIONS } from "../../config/navigation";

interface AppDockProps {
  /** Expanded = full drawer with names + section folds; collapsed =
   * icon-only magnifying dock. Lifted to AppShell so the reserved
   * left rail can widen in sync. */
  expanded: boolean;
  onToggleExpanded: () => void;
}

const NAVY = "#1E3163";

type IconCmp = React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
const iconFor = (name: string): IconCmp =>
  ((Icons as unknown as Record<string, IconCmp>)[name] ?? Icons.Circle);

/** The app's tab selector on the LEFT edge. Collapsed: macOS-style
 * magnifying dock (icons, tooltips). Expanded: same frosted floating
 * panel, but with names always visible and the SALES / INVENTORY /
 * WORKSPACE headings folding exactly like the old sidebar. */
export function AppDock({ expanded, onToggleExpanded }: AppDockProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set());

  function toggleSection(section: string) {
    setClosedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  }

  const panelClasses = "border border-gray-200 bg-white/90 shadow-[14px_0_44px_rgba(20,33,61,0.14)] backdrop-blur-md";

  return (
    <div className="pointer-events-none fixed inset-y-0 left-2.5 z-40 hidden items-center lg:flex">
      <div className="pointer-events-auto flex max-h-[92vh] flex-col items-center">
        {/* Expand/collapse toggle — sits above the rail in both modes */}
        <button
          onClick={onToggleExpanded}
          title={expanded ? "Collapse menu" : "Expand menu"}
          aria-label={expanded ? "Collapse menu" : "Expand menu"}
          className={`mb-2 flex h-9 w-9 items-center justify-center rounded-full text-[#3d4a63] transition-colors hover:bg-gray-100 ${panelClasses} self-start`}
          style={{ alignSelf: expanded ? "flex-end" : "center" }}
        >
          {expanded ? <Icons.ChevronsLeft size={17} /> : <Icons.ChevronsRight size={17} />}
        </button>

        <AnimatePresence mode="wait" initial={false}>
          {expanded ? (
            <motion.nav
              key="drawer"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              className={`w-[236px] overflow-y-auto rounded-2xl p-3 ${panelClasses}`}
              style={{ maxHeight: "82vh" }}
              aria-label="Application navigation"
            >
              {/* Standalone (Top) items — e.g. Home, no heading */}
              {NAV_ITEMS.filter(i => i.section === "Top").map(item => (
                <NavRow key={item.key} item={item} active={location.pathname === item.path} onGo={() => navigate(item.path)} />
              ))}

              {NAV_SECTIONS.filter(s => s !== "Top").map(section => (
                <div key={section} className="mt-1.5">
                  <button
                    onClick={() => toggleSection(section)}
                    aria-expanded={!closedSections.has(section)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[1.4px] text-[#9aa3b5] transition-colors hover:text-[#1E3163]"
                  >
                    <span>{section}</span>
                    {closedSections.has(section)
                      ? <Icons.ChevronRight size={13} strokeWidth={2.2} />
                      : <Icons.ChevronDown size={13} strokeWidth={2.2} />}
                  </button>
                  <AnimatePresence initial={false}>
                    {!closedSections.has(section) && (
                      <motion.div
                        key="items"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        {NAV_ITEMS.filter(i => i.section === section).map(item => (
                          <NavRow key={item.key} item={item} active={location.pathname === item.path} onGo={() => navigate(item.path)} />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </motion.nav>
          ) : (
            <motion.div
              key="dock"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              <Dock
                orientation="vertical"
                className={`items-center ${panelClasses}`}
                magnification={66}
                distance={120}
                panelHeight={58}
              >
                {NAV_ITEMS.map(item => {
                  const Icon = iconFor(item.icon);
                  const active = location.pathname === item.path;
                  return (
                    <DockItem
                      key={item.key}
                      onClick={() => navigate(item.path)}
                      ariaLabel={item.label}
                      className={
                        "aspect-square rounded-full transition-colors " +
                        (active ? "bg-[#1E3163]" : "bg-gray-100 hover:bg-gray-200")
                      }
                    >
                      <DockLabel>{item.label}</DockLabel>
                      <DockIcon>
                        <Icon className={"h-full w-full " + (active ? "text-white" : "text-[#3d4a63]")} />
                      </DockIcon>
                    </DockItem>
                  );
                })}
              </Dock>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NavRow({ item, active, onGo }: { item: (typeof NAV_ITEMS)[number]; active: boolean; onGo: () => void }) {
  const Icon = iconFor(item.icon);
  return (
    <button
      onClick={onGo}
      className={
        "mb-0.5 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors " +
        (active ? "text-white" : "text-[#3d4a63] hover:bg-gray-100")
      }
      style={active ? { background: NAVY } : undefined}
    >
      <Icon size={17} strokeWidth={2} className={active ? "text-white" : "text-[#5a6a8a]"} />
      {item.label}
    </button>
  );
}
