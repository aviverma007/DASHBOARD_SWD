import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import { NAV_ITEMS } from "../../config/navigation";
import clsx from "clsx";

interface SidebarProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onNavigate }: SidebarProps) {
  return (
    <nav className="flex flex-col gap-1 px-2 py-4">
      {NAV_ITEMS.map((item) => {
        const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[item.icon] ?? Icons.Circle;
        return (
          <NavLink
            key={item.key}
            to={item.path}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-blue/10 text-brand-blue"
                  : "text-charcoal-soft hover:bg-surface hover:text-charcoal",
                item.status === "placeholder" && "opacity-60"
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <Icon size={18} strokeWidth={2} className="shrink-0" />
            {!collapsed && (
              <span className="flex-1 truncate">{item.label}</span>
            )}
            {!collapsed && item.status === "placeholder" && (
              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-charcoal-soft">
                Soon
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
