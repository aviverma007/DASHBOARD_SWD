import { useState } from "react";

/**
 * Change Password page — opened in a new tab from Settings.
 * DEMO ONLY: no backend, no real password change.
 */
export function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!current) { setError("Please enter your current password."); return; }
    if (next.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (next !== confirm) { setError("Passwords do not match."); return; }
    // DEMO: just show success
    setDone(true);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 9,
    border: "1px solid #ddd8ce",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    background: "#faf9f6",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f4f2ed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "36px 32px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 4px 32px rgba(20,33,61,.12)",
        }}
      >
        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 20,
              fontWeight: 700,
              color: "#14213d",
              marginBottom: 4,
            }}
          >
            SWD Analytics
          </div>
          <div style={{ fontSize: 13, color: "#8a8f9e" }}>Change your password</div>
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>✅</div>
            <div
              style={{
                fontFamily: "Georgia,serif",
                fontSize: 17,
                fontWeight: 700,
                color: "#14213d",
                marginBottom: 8,
              }}
            >
              Password updated
            </div>
            <div style={{ fontSize: 13.5, color: "#8a8f9e", lineHeight: 1.5 }}>
              Your password has been changed. You can close this tab.
            </div>
            <button
              onClick={() => window.close()}
              style={{
                marginTop: 22,
                padding: "11px 28px",
                borderRadius: 9,
                border: "none",
                background: "#B8893C",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Close tab
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#14213d", marginBottom: 6 }}>
                Current password
              </label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Enter current password"
                style={inputStyle}
                autoFocus
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#14213d", marginBottom: 6 }}>
                New password
              </label>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="At least 6 characters"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#14213d", marginBottom: 6 }}>
                Confirm new password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                style={inputStyle}
              />
            </div>

            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: "#c0392b",
                  background: "#fef0ee",
                  borderRadius: 8,
                  padding: "9px 12px",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                marginTop: 4,
                padding: "12px 0",
                borderRadius: 9,
                border: "none",
                background: "#14213d",
                color: "#fff",
                fontSize: 14.5,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
