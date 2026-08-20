import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import { NAV_ITEMS } from "../../config/navigation";

interface SidebarProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onNavigate }: SidebarProps) {
  return (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: collapsed ? "14px 8px" : "14px 10px",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const Icon =
          (Icons as unknown as Record<string, Icons.LucideIcon>)[item.icon] ??
          Icons.Circle;
        const isPlaceholder = item.status === "placeholder";

        return (
          <NavLink
            key={item.key}
            to={item.path}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            style={({ isActive }) => ({
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 9,
              padding: collapsed ? "10px 0" : "9px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              textDecoration: "none",
              fontSize: 13.5,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? "#1E3163" : isPlaceholder ? "#b0b8c9" : "#4a5568",
              background: isActive
                ? "linear-gradient(90deg, rgba(30,49,99,0.09) 0%, rgba(30,49,99,0.04) 100%)"
                : "transparent",
              boxShadow: isActive
                ? "0 1px 4px rgba(30,49,99,0.08)"
                : "none",
              transition: "background 0.14s, color 0.14s, box-shadow 0.14s",
              cursor: "pointer",
              opacity: isPlaceholder ? 0.65 : 1,
            })}
          >
            {({ isActive }) => (
              <>
                {/* Left accent bar */}
                {isActive && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "20%",
                      height: "60%",
                      width: 3,
                      borderRadius: 2,
                      background: "#B8893C",
                    }}
                  />
                )}

                <Icon
                  size={17}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={{
                    flexShrink: 0,
                    color: isActive ? "#1E3163" : isPlaceholder ? "#b0b8c9" : "#6b7280",
                    marginLeft: isActive && !collapsed ? 4 : 0,
                  }}
                />

                {!collapsed && (
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                )}

                {!collapsed && isPlaceholder && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      letterSpacing: "0.8px",
                      textTransform: "uppercase",
                      color: "#9ca3af",
                      background: "#f1f3f6",
                      borderRadius: 999,
                      padding: "2px 7px",
                      flexShrink: 0,
                    }}
                  >
                    Soon
                  </span>
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
