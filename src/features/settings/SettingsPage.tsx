import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

/**
 * Settings page — two actions:
 * 1. Change Password → navigates to /change-password within the same app
 * 2. Logout → inline confirmation popup, then signs out
 */
export function SettingsPage() {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const logout = useAuthStore((s) => s.logout);
  const userLabel = useAuthStore((s) => s.userLabel);
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/", { replace: true });
  }

  return (
    <div
      style={{
        maxWidth: 540,
        margin: "48px auto",
        padding: "0 20px",
        fontFamily: "inherit",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontFamily: "Georgia,serif",
            fontSize: 22,
            fontWeight: 700,
            color: "#14213d",
            marginBottom: 4,
          }}
        >
          Settings
        </div>
        {userLabel && (
          <div style={{ fontSize: 13.5, color: "#8a8f9e" }}>
            Signed in as <strong style={{ color: "#14213d" }}>{userLabel}</strong>
          </div>
        )}
      </div>

      {/* Options */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e4e0d6",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(20,33,61,.06), 0 4px 16px rgba(20,33,61,.07)",
        }}
      >
        {/* Change Password */}
        <button
          onClick={() => navigate("/change-password")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "20px 22px",
            background: "none",
            border: "none",
            borderBottom: "1px solid #f0ede6",
            cursor: "pointer",
            textAlign: "left",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#faf9f6")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#EBF4FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            🔑
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#14213d", marginBottom: 2 }}>
              Change password
            </div>
            <div style={{ fontSize: 12.5, color: "#8a8f9e" }}>
              Update your account password
            </div>
          </div>
          <span style={{ fontSize: 18, color: "#c0bbb0" }}>›</span>
        </button>

        {/* Logout */}
        <button
          onClick={() => setShowLogoutConfirm(true)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "20px 22px",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#fdf8f6")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "none")}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#FEF0EE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            🚪
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#c0392b", marginBottom: 2 }}>
              Log out
            </div>
            <div style={{ fontSize: 12.5, color: "#8a8f9e" }}>
              End your current session
            </div>
          </div>
          <span style={{ fontSize: 18, color: "#c0bbb0" }}>›</span>
        </button>
      </div>

      {/* Logout confirmation popup */}
      {showLogoutConfirm && (
        <div
          onClick={() => setShowLogoutConfirm(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(10,15,30,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "32px 28px 24px",
              width: 360,
              boxShadow: "0 8px 60px rgba(0,0,0,0.22)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 14 }}>🚪</div>
            <div
              style={{
                fontFamily: "Georgia,serif",
                fontSize: 19,
                fontWeight: 700,
                color: "#14213d",
                marginBottom: 8,
              }}
            >
              Log out?
            </div>
            <div style={{ fontSize: 13.5, color: "#8a8f9e", marginBottom: 24, lineHeight: 1.5 }}>
              You'll need to sign in again to access the dashboard.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 9,
                  border: "1px solid #e4e0d6",
                  background: "#fff",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#14213d",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#f8f6f0")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#fff")}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  borderRadius: 9,
                  border: "none",
                  background: "#c0392b",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#a93226")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#c0392b")}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
