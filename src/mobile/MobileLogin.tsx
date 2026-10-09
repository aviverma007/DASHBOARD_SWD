/** Native-style phone sign-in. Same auth rules as the desktop login (findUser → authStore.login). */
import { useState } from "react";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { findUser } from "../config/users";
import { useAuthStore } from "../store/authStore";
import { IDLE_LOGOUT_FLAG } from "../hooks/useIdleLogout";
import "./mobile-ui.css";

export function MobileLogin() {
  const login = useAuthStore(s => s.login);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<{ id?: string; pw?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const [idle] = useState(() => {
    const f = sessionStorage.getItem(IDLE_LOGOUT_FLAG) === "1";
    sessionStorage.removeItem(IDLE_LOGOUT_FLAG);
    return f;
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof err = {};
    if (!id.trim()) next.id = "Enter your user ID";
    if (!pw) next.pw = "Enter your password";
    if (next.id || next.pw) { setErr(next); return; }
    const u = findUser(id, pw);
    if (!u) { setErr({ form: "Invalid user ID or password. Please try again." }); return; }
    setErr({}); setBusy(true);
    setTimeout(() => login(u.displayName, u.access, u.role), 700);
  };

  return (
    <div className="m-app m-login">
      <div className="m-login-top">
        <div className="m-login-logo"><img src="/brand/smartworld-mark.png" alt="Smart World" /></div>
        <h1>SmartDB</h1>
        <p>Smart World Developers · sales, collections &amp; projects in your pocket.</p>
        {idle && <p style={{ marginTop: 10, color: "#f5d9a8" }}>You were signed out after 30 minutes of inactivity.</p>}
      </div>
      <form className="m-login-card" onSubmit={submit} noValidate>
        <h2>Sign in</h2>
        <label className={`m-in${err.id || err.form ? " err" : ""}`}>
          <User size={19} />
          <input value={id} onChange={e => setId(e.target.value)} placeholder="User ID" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-label="User ID" />
        </label>
        {err.id && <div className="m-err">{err.id}</div>}
        <label className={`m-in${err.pw || err.form ? " err" : ""}`}>
          <Lock size={19} />
          <input value={pw} onChange={e => setPw(e.target.value)} type={show ? "text" : "password"} placeholder="Password" autoComplete="current-password" aria-label="Password" />
          <button type="button" className="m-ico" style={{ width: 36, height: 36 }} onClick={() => setShow(s => !s)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={19} /> : <Eye size={19} />}</button>
        </label>
        {err.pw && <div className="m-err">{err.pw}</div>}
        {err.form && <div className="m-err" role="alert">{err.form}</div>}
        <button type="submit" className="m-btn pri" disabled={busy} style={{ width: "100%", height: 52, marginTop: 4 }}>
          {busy ? <><span className="m-spin" /> Signing in…</> : "Sign in"}
        </button>
      </form>
      <div className="m-login-foot">© Smart World Developers · Internal use only</div>
    </div>
  );
}
