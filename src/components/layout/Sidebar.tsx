import { useState } from "react";
import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import { NAV_ITEMS, NAV_SECTIONS } from "../../config/navigation";

interface SidebarProps {
  collapsed: boolean;
  onNavigate?: () => void;
  /** When provided, renders an arrow row that expands/collapses the
   * sidebar (desktop rail only — the mobile drawer omits it since it
   * has its own close button). */
  onToggleCollapse?: () => void;
}

export function Sidebar({ collapsed, onNavigate, onToggleCollapse }: SidebarProps) {
  // Which section groups are folded shut; all open by default.
  const [closedSections, setClosedSections] = useState<Set<string>>(new Set());
  function toggleSection(section: string) {
    setClosedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  }
  return (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: collapsed ? "14px 8px" : "14px 10px",
      }}
    >
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-end",
            gap: 6,
            background: "transparent",
            border: "none",
            borderRadius: 9,
            padding: collapsed ? "8px 0" : "6px 10px",
            marginBottom: 6,
            cursor: "pointer",
            color: "#6b7280",
            fontSize: 11.5,
            fontFamily: "inherit",
            transition: "background 0.14s, color 0.14s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(30,49,99,0.06)";
            e.currentTarget.style.color = "#1E3163";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#6b7280";
          }}
        >
          {!collapsed && <span style={{ fontWeight: 600, letterSpacing: "0.4px" }}>Collapse</span>}
          {collapsed ? <Icons.ChevronsRight size={17} strokeWidth={2} /> : <Icons.ChevronsLeft size={17} strokeWidth={2} />}
        </button>
      )}
      {NAV_SECTIONS.map((section, si) => (
        <div key={section} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Section sub-heading — a thin divider stands in when the
              rail is collapsed and there's no room for a label */}
          {collapsed ? (
            si > 0 && <div style={{ height: 1, background: "#e8eaf0", margin: "8px 6px" }} />
          ) : (
            <button
              onClick={() => toggleSection(section)}
              aria-expanded={!closedSections.has(section)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                width: "100%",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.4px",
                textTransform: "uppercase",
                color: "#9aa3b5",
                padding: si === 0 ? "2px 12px 4px" : "14px 12px 4px",
                transition: "color 0.14s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#1E3163"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#9aa3b5"; }}
            >
              <span>{section}</span>
              {closedSections.has(section)
                ? <Icons.ChevronRight size={13} strokeWidth={2.2} />
                : <Icons.ChevronDown size={13} strokeWidth={2.2} />}
            </button>
          )}
          {/* When the rail is collapsed to icons, folding is disabled —
              there's no heading to click, so every item stays visible. */}
          {(collapsed || !closedSections.has(section)) && NAV_ITEMS.filter((item) => item.section === section).map((item) => {
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
        </div>
      ))}
    </nav>
  );
}
