import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Change Password — rendered inside the app shell (same tab, same layout).
 * DEMO ONLY: no backend, no real password change.
 */
export function ChangePasswordPage() {
  const navigate = useNavigate();
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
    setDone(true);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 9,
    border: "1.5px solid #ddd8ce",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    background: "#faf9f6",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", padding: "0 20px", fontFamily: "inherit" }}>
      {/* Back button */}
      <button
        onClick={() => navigate("/settings")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 13.5,
          color: "#6b7280",
          fontFamily: "inherit",
          padding: 0,
          marginBottom: 24,
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#14213d")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#6b7280")}
      >
        <ArrowLeft size={16} />
        Back to Settings
      </button>

      {/* Card */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e4e0d6",
          borderRadius: 16,
          padding: "32px 28px",
          boxShadow: "0 4px 24px rgba(20,33,61,.09)",
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 20,
              fontWeight: 700,
              color: "#14213d",
              marginBottom: 4,
            }}
          >
            Change password
          </div>
          <div style={{ fontSize: 13, color: "#8a8f9e" }}>
            Update your account password below.
          </div>
        </div>

        {done ? (
          <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
            <div style={{ fontSize: 42, marginBottom: 14 }}>✅</div>
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
            <div style={{ fontSize: 13.5, color: "#8a8f9e", lineHeight: 1.5, marginBottom: 22 }}>
              Your password has been changed successfully.
            </div>
            <button
              onClick={() => navigate("/settings")}
              style={{
                padding: "11px 28px",
                borderRadius: 9,
                border: "none",
                background: "#1E3163",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Back to Settings
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                Current password
              </label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Enter current password"
                style={inputStyle}
                autoFocus
                onFocus={(e) => (e.currentTarget.style.borderColor = "#1E3163")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd8ce")}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                New password
              </label>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="At least 6 characters"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#1E3163")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd8ce")}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                Confirm new password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                style={inputStyle}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#1E3163")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#ddd8ce")}
              />
            </div>

            {error && (
              <div
                style={{
                  fontSize: 13,
                  color: "#c0392b",
                  background: "#fef0ee",
                  border: "1px solid #f5c6c0",
                  borderRadius: 8,
                  padding: "9px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <span>⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                marginTop: 4,
                padding: "12px 0",
                borderRadius: 9,
                border: "none",
                background: "#1E3163",
                color: "#fff",
                fontSize: 14.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#B8893C")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1E3163")}
            >
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
