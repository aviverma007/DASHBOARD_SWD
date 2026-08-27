import { useEffect, useRef, useState } from "react";
import { Bell, Menu, User, LogOut, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

interface HeaderProps {
  onOpenMobileNav: () => void;
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  const userLabel = useAuthStore((s) => s.userLabel);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Derive a display name from the label (could be email or name)
  const isEmail = userLabel?.includes("@");
  const displayName = isEmail
    ? userLabel!.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : (userLabel ?? "User");
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleLogout() {
    setOpen(false);
    logout();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border-subtle bg-white">
      <div className="flex h-14 items-center gap-3 px-4">
        <button
          onClick={onOpenMobileNav}
          className="rounded-md p-2 text-charcoal-soft hover:bg-surface lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2.5">
          {/* Logo → Home. Icon mark on small screens, wordmark from sm: up */}
          <button onClick={() => navigate("/")} aria-label="Go to Home" className="flex items-center border-0 bg-transparent p-0" style={{ cursor: "pointer" }}>
            <img src="/brand/smartworld-mark.png" alt="Smart World" className="h-8 w-auto sm:hidden" />
            <img src="/brand/smartworld-logo.png" alt="Smart World — iLive. iWork. iPlay." className="hidden h-9 w-auto sm:block" />
          </button>
          <span className="hidden border-l border-border-subtle pl-2.5 text-[11px] leading-tight text-charcoal-soft md:block">
            Analytics<br />Inventory &amp; Sales
          </span>
        </div>

        <div className="flex-1" />

        <button
          className="rounded-md p-2 text-charcoal-soft hover:bg-surface"
          aria-label="Notifications"
        >
          <Bell size={19} />
        </button>

        {/* User avatar — tooltip on hover, dropdown on click */}
        <div ref={ref} style={{ position: "relative" }}>
          <button
            onClick={() => setOpen((v) => !v)}
            title={displayName}
            aria-label={`Signed in as ${displayName}`}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#1E3163",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.5px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "inherit",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#B8893C")}
            onMouseLeave={(e) => {
              if (!open) (e.currentTarget as HTMLButtonElement).style.background = "#1E3163";
            }}
          >
            {initials || <User size={16} />}
          </button>

          {/* Dropdown card */}
          {open && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                zIndex: 100,
                width: 240,
                background: "#fff",
                border: "1px solid #e4e0d6",
                borderRadius: 12,
                boxShadow: "0 8px 32px rgba(20,33,61,.16)",
                overflow: "hidden",
              }}
            >
              {/* User info */}
              <div
                style={{
                  padding: "16px 18px 14px",
                  borderBottom: "1px solid #f0ede6",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {/* Avatar circle */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "#1E3163",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "0.5px",
                    flexShrink: 0,
                  }}
                >
                  {initials || <User size={18} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#14213d",
                      marginBottom: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {displayName}
                  </div>
                  {isEmail && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#8a8f9e",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {userLabel}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ padding: "6px 0" }}>
                <button
                  onClick={() => { setOpen(false); navigate("/settings"); }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 18px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13.5,
                    color: "#14213d",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#faf9f6")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
                >
                  <Settings size={15} style={{ color: "#8a8f9e", flexShrink: 0 }} />
                  Settings
                </button>

                <button
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 18px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13.5,
                    color: "#c0392b",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#fef5f4")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
                >
                  <LogOut size={15} style={{ color: "#c0392b", flexShrink: 0 }} />
                  Log out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

