import { useLocation, useNavigate } from "react-router-dom";
import * as Icons from "lucide-react";
import { Dock, DockIcon, DockItem, DockLabel } from "../ui/dock";
import { NAV_ITEMS } from "../../config/navigation";

/** The app's tab selector: a macOS-style magnifying dock pinned to
 * the bottom centre. Hover swells the nearest icons; every tab shows
 * a tooltip label; the active tab is navy with a gold dot beneath.
 * Desktop only — mobile keeps the drawer nav (no hover on touch). */
export function AppDock() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 hidden lg:block">
      <div className="pointer-events-auto">
        <Dock
          className="items-end border border-gray-200 bg-white/90 pb-2.5 shadow-[0_14px_44px_rgba(20,33,61,0.18)] backdrop-blur-md"
          magnification={72}
          distance={130}
          panelHeight={60}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[item.icon] ?? Icons.Circle;
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
      </div>
    </div>
  );
}
