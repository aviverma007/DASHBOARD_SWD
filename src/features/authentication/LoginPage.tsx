import { useState } from "react";
import { LoginBuddy } from "../../components/common/LoginBuddy";
import { CursorTrail } from "../../components/common/CursorTrail";
import { LoginShowcase } from "./LoginShowcase";
import AnimatedGradient from "../../components/ui/animated-gradient";
import { IDLE_LOGOUT_FLAG } from "../../hooks/useIdleLogout";

/** Apartment-building cursor (navy tower, gold windows) shown across
 * the whole login screen. Hotspot near the building base. */
const APARTMENT_CURSOR = `url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2230%22%20height%3D%2230%22%20viewBox%3D%220%200%2030%2030%22%3E%3Cg%3E%3Crect%20x%3D%227%22%20y%3D%224%22%20width%3D%2213%22%20height%3D%2224%22%20rx%3D%221.5%22%20fill%3D%22%231E3163%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.4%22/%3E%3Crect%20x%3D%2220%22%20y%3D%2212%22%20width%3D%227%22%20height%3D%2216%22%20rx%3D%221%22%20fill%3D%22%232A4488%22%20stroke%3D%22%23fff%22%20stroke-width%3D%221.2%22/%3E%3Crect%20x%3D%229.5%22%20y%3D%227%22%20width%3D%223%22%20height%3D%223%22%20fill%3D%22%23B8893C%22/%3E%3Crect%20x%3D%2214.5%22%20y%3D%227%22%20width%3D%223%22%20height%3D%223%22%20fill%3D%22%23B8893C%22/%3E%3Crect%20x%3D%229.5%22%20y%3D%2212%22%20width%3D%223%22%20height%3D%223%22%20fill%3D%22%23B8893C%22/%3E%3Crect%20x%3D%2214.5%22%20y%3D%2212%22%20width%3D%223%22%20height%3D%223%22%20fill%3D%22%23F5D9A8%22/%3E%3Crect%20x%3D%229.5%22%20y%3D%2217%22%20width%3D%223%22%20height%3D%223%22%20fill%3D%22%23F5D9A8%22/%3E%3Crect%20x%3D%2214.5%22%20y%3D%2217%22%20width%3D%223%22%20height%3D%223%22%20fill%3D%22%23B8893C%22/%3E%3Crect%20x%3D%2221.5%22%20y%3D%2215%22%20width%3D%222.5%22%20height%3D%222.5%22%20fill%3D%22%23F5D9A8%22/%3E%3Crect%20x%3D%2221.5%22%20y%3D%2219%22%20width%3D%222.5%22%20height%3D%222.5%22%20fill%3D%22%23B8893C%22/%3E%3Crect%20x%3D%2212%22%20y%3D%2223%22%20width%3D%224%22%20height%3D%225%22%20fill%3D%22%23B8893C%22/%3E%3C/g%3E%3C/svg%3E") 8 26, auto`;
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
  const [focusedField, setFocusedField] = useState<"user" | "pw" | null>(null); // which field is being typed into
  const [loginSuccess, setLoginSuccess] = useState(false); // brief thumbs-up window before redirect
  // Shown once when the previous session ended from 30-min inactivity
  const [idleNotice] = useState(() => {
    const flag = sessionStorage.getItem(IDLE_LOGOUT_FLAG) === "1";
    sessionStorage.removeItem(IDLE_LOGOUT_FLAG);
    return flag;
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (userId.trim() !== VALID_ID || password !== VALID_PW) {
      setError("Invalid user ID or password. Please try again.");
      return;
    }

    setLoading(true);
    setLoginSuccess(true); // buddy gives a thumbs-up…
    // …and holds it for a beat before the app takes over
    setTimeout(() => {
      login(DISPLAY_NAME);
      setLoading(false);
    }, 1000);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#e9ecf0",
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        padding: 0,
        fontFamily: "inherit",
        cursor: APARTMENT_CURSOR,
      }}
      className="swd-login-root"
    >
      <CursorTrail />
      {/* Everything on the login screen (inputs, buttons) shares the
          apartment cursor for a consistent feel */}
      <style>{`.swd-login-root, .swd-login-root * { cursor: ${APARTMENT_CURSOR} !important; } @media (max-width: 1100px) { .swd-login-visual { display: none; } }`}</style>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 28, minHeight: "100vh", position: "relative" }}>
      {/* Gentle animated wash over the grey half — same tones, so the
          seam blend into the white panel still matches */}
      <AnimatedGradient
        config={{ preset: "custom", color1: "#e9ecf0", color2: "#d5def0", color3: "#f6f8fb", rotation: -20, proportion: 45, scale: 0.55, speed: 10, distortion: 2, swirl: 35, swirlIterations: 5, softness: 100, offset: -60, shape: "Checks", shapeSize: 30 }}
        style={{ zIndex: 0 }}
      />
      <div style={{ width: "100%", maxWidth: 480, position: "relative", zIndex: 1 }}>
        {/* Logo block */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <LoginBuddy
            mode={loginSuccess ? "success" : error ? "error" : focusedField ? "typing" : "idle"}
            typingProgress={Math.min((focusedField === "pw" ? password.length : userId.length) / 20, 1)}
          />
          {/* Wordmark is navy — sit it on a white plate so it reads on
              the dark login background */}
          <div
            style={{
              display: "inline-block",
              background: "#fff",
              borderRadius: 14,
              padding: "14px 22px",
              margin: "0 auto 16px",
              boxShadow: "0 6px 24px rgba(30,64,120,.18)",
            }}
          >
            <img src="/brand/smartworld-logo.png" alt="Smart World — iLive. iWork. iPlay." style={{ height: 46, width: "auto", display: "block" }} />
          </div>
          <div style={{ fontSize: 13, color: "#40598c", fontWeight: 500 }}>
            Analytics — Inventory &amp; Sales Dashboard
          </div>
          {idleNotice && (
            <div style={{ marginTop: 12, display: "inline-block", background: "rgba(184,137,60,.16)", border: "1px solid rgba(184,137,60,.45)", color: "#8a6d1a", fontSize: 12.5, borderRadius: 8, padding: "7px 14px" }}>
              You were signed out after 30 minutes of inactivity.
            </div>
          )}
        </div>

        {/* Card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: "40px 40px 36px",
            boxShadow: "0 20px 60px rgba(0,0,0,.35)",
          }}
        >
          <div
            style={{
              fontFamily: "Georgia,serif",
              fontSize: 21,
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
                onFocus={(e) => { setFocusedField("user"); if (!error) e.currentTarget.style.borderColor = "#1E3163"; }}
                onBlur={(e) => { setFocusedField(f => (f === "user" ? null : f)); if (!error) e.currentTarget.style.borderColor = "#ddd8ce"; }}
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
                  onFocus={(e) => { setFocusedField("pw"); if (!error) e.currentTarget.style.borderColor = "#1E3163"; }}
                  onBlur={(e) => { setFocusedField(f => (f === "pw" ? null : f)); if (!error) e.currentTarget.style.borderColor = "#ddd8ce"; }}
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

        {/* Right showcase: full-height card flush to the right edge */}
        <LoginShowcase />
    </div>
  );
}
