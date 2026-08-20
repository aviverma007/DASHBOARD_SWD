import { useState } from "react";
import { Lock, ArrowRight } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

// Hardcoded credentials — replace with a real auth backend when ready
const VALID_ID = "admin@admin";
const VALID_PW = "admin";
const DISPLAY_NAME = "Admin";

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (userId.trim() !== VALID_ID || password !== VALID_PW) {
      setError("Invalid user ID or password. Please try again.");
      return;
    }

    setLoading(true);
    // Small delay so the button state is visible before redirect
    setTimeout(() => {
      login(DISPLAY_NAME);
      setLoading(false);
    }, 300);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f1c36 0%, #1e3163 60%, #2a4488 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "inherit",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo block */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "#B8893C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Georgia,serif",
              fontSize: 18,
              fontWeight: 700,
              color: "#fff",
              margin: "0 auto 14px",
              boxShadow: "0 4px 20px rgba(184,137,60,.4)",
            }}
          >
            SW
          </div>
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 22,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 5,
            }}
          >
            SWD Analytics
          </div>
          <div style={{ fontSize: 13, color: "#a9b2c7" }}>
            Inventory &amp; Sales Dashboard
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: "32px 28px",
            boxShadow: "0 20px 60px rgba(0,0,0,.35)",
          }}
        >
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 17,
              fontWeight: 700,
              color: "#14213d",
              marginBottom: 22,
            }}
          >
            Sign in
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* User ID */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#4a5568",
                  marginBottom: 6,
                  letterSpacing: "0.3px",
                }}
              >
                User ID
              </label>
              <input
                type="text"
                required
                autoFocus
                value={userId}
                onChange={(e) => { setUserId(e.target.value); setError(""); }}
                placeholder="Enter your user ID"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: 10,
                  border: error ? "1.5px solid #e53e3e" : "1.5px solid #ddd8ce",
                  fontSize: 14,
                  fontFamily: "inherit",
                  outline: "none",
                  background: "#faf9f6",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = "#1E3163"; }}
                onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = "#ddd8ce"; }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#4a5568",
                  marginBottom: 6,
                  letterSpacing: "0.3px",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={15}
                  style={{
                    position: "absolute",
                    left: 13,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#9ca3af",
                    pointerEvents: "none",
                  }}
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Password"
                  style={{
                    width: "100%",
                    padding: "11px 14px 11px 38px",
                    borderRadius: 10,
                    border: error ? "1.5px solid #e53e3e" : "1.5px solid #ddd8ce",
                    fontSize: 14,
                    fontFamily: "inherit",
                    outline: "none",
                    background: "#faf9f6",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = "#1E3163"; }}
                  onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = "#ddd8ce"; }}
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                style={{
                  fontSize: 12.5,
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
                <span style={{ fontSize: 14 }}>⚠</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "12px 0",
                borderRadius: 10,
                border: "none",
                background: loading ? "#8a9abb" : "#1E3163",
                color: "#fff",
                fontSize: 14.5,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "background 0.15s",
                letterSpacing: "0.3px",
              }}
              onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#B8893C"; }}
              onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#1E3163"; }}
            >
              {loading ? "Signing in…" : "Sign in"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        </div>

        <p style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#5a6478" }}>
          Smart World Developers · Internal Analytics Platform
        </p>
      </div>
    </div>
  );
}
