import { useState } from "react";
import { Mail, Phone, Lock, ArrowRight } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import clsx from "clsx";

type LoginMode = "email-password" | "mobile-otp" | "email-otp";

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const [mode, setMode] = useState<LoginMode>("email-password");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  function handleSendOtp() {
    // DEMO ONLY — no real OTP is sent. See authStore.ts.
    setOtpSent(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const label = mode === "mobile-otp" ? mobile : email;
    login(label || "Demo User");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-base font-bold text-white">
            SW
          </div>
          <h1 className="mt-3 text-lg font-bold text-charcoal">SWD Analytics</h1>
          <p className="text-sm text-charcoal-soft">Inventory &amp; Sales Dashboard</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-white p-5 shadow-card">
          <div className="mb-4 flex gap-1 rounded-lg bg-surface p-1">
            <ModeTab label="Email" active={mode === "email-password"} onClick={() => { setMode("email-password"); setOtpSent(false); }} />
            <ModeTab label="Mobile OTP" active={mode === "mobile-otp"} onClick={() => { setMode("mobile-otp"); setOtpSent(false); }} />
            <ModeTab label="Email OTP" active={mode === "email-otp"} onClick={() => { setMode("email-otp"); setOtpSent(false); }} />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "email-password" && (
              <>
                <FieldWithIcon icon={Mail}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@smartworlddevelopers.com"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </FieldWithIcon>
                <FieldWithIcon icon={Lock}>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </FieldWithIcon>
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-1.5 text-charcoal-soft">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded"
                    />
                    Remember me
                  </label>
                  <button type="button" className="font-medium text-brand-blue hover:underline">
                    Forgot password?
                  </button>
                </div>
              </>
            )}

            {mode === "mobile-otp" && (
              <>
                <FieldWithIcon icon={Phone}>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Mobile number"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </FieldWithIcon>
                {otpSent ? (
                  <>
                    <FieldWithIcon icon={Lock}>
                      <input
                        type="text"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter OTP"
                        className="w-full bg-transparent text-sm outline-none"
                      />
                    </FieldWithIcon>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-xs font-medium text-brand-blue hover:underline"
                    >
                      Resend OTP
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="w-full rounded-lg border border-brand-blue py-2 text-sm font-medium text-brand-blue hover:bg-brand-blue/5"
                  >
                    Send OTP
                  </button>
                )}
              </>
            )}

            {mode === "email-otp" && (
              <>
                <FieldWithIcon icon={Mail}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@smartworlddevelopers.com"
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </FieldWithIcon>
                {otpSent ? (
                  <>
                    <FieldWithIcon icon={Lock}>
                      <input
                        type="text"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="Enter OTP"
                        className="w-full bg-transparent text-sm outline-none"
                      />
                    </FieldWithIcon>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-xs font-medium text-brand-blue hover:underline"
                    >
                      Resend OTP
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="w-full rounded-lg border border-brand-blue py-2 text-sm font-medium text-brand-blue hover:bg-brand-blue/5"
                  >
                    Send OTP
                  </button>
                )}
              </>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy py-2.5 text-sm font-semibold text-white hover:bg-navy-dark"
            >
              Sign in
              <ArrowRight size={15} />
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-charcoal-soft">
          Demo authentication only — not connected to a production identity provider.
        </p>
      </div>
    </div>
  );
}

function ModeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-white text-brand-blue shadow-sm" : "text-charcoal-soft hover:text-charcoal"
      )}
    >
      {label}
    </button>
  );
}

function FieldWithIcon({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border-subtle px-3 py-2.5 focus-within:border-brand-blue/50">
      <Icon size={16} className="shrink-0 text-charcoal-soft" />
      {children}
    </div>
  );
}
