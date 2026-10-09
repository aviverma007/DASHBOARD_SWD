/** Shared account pieces for More + Settings. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, KeyRound } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { Sheet } from "../ui";
import { initials } from "../fmt";

export function useName() {
  const l = useAuthStore(s => s.userLabel);
  return !l ? "User" : l.includes("@") ? l.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : l;
}

export function ProfileCard() {
  const name = useName();
  const role = useAuthStore(s => s.role);
  return (
    <div className="m-card m-me">
      <span className="m-avatar">{initials(name)}</span>
      <div><b>{name}</b><small style={{ textTransform: "capitalize" }}>{role ?? "member"} · Smart World Developers</small></div>
    </div>
  );
}

export function AccountActions() {
  const nav = useNavigate();
  const logout = useAuthStore(s => s.logout);
  const [ask, setAsk] = useState(false);
  return (
    <>
      <div className="m-card m-list" style={{ padding: "4px 0" }}>
        <button type="button" className="m-row" onClick={() => nav("/change-password")}>
          <span className="m-row-i"><KeyRound size={18} /></span><span className="m-row-t"><b>Change password</b><small>Update your sign-in password</small></span>
        </button>
        <button type="button" className="m-row" onClick={() => setAsk(true)}>
          <span className="m-row-i" style={{ color: "var(--m-bad)" }}><LogOut size={18} /></span><span className="m-row-t"><b style={{ color: "var(--m-bad)" }}>Log out</b><small>End this session</small></span>
        </button>
      </div>
      <Sheet open={ask} onClose={() => setAsk(false)} title="Log out?"
        footer={<><button type="button" className="m-btn" onClick={() => setAsk(false)}>Cancel</button>
          <button type="button" className="m-btn pri" onClick={() => { setAsk(false); logout(); nav("/", { replace: true }); }}>Log out</button></>}>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--m-mut)" }}>You'll need to sign in again to see the dashboard.</p>
      </Sheet>
    </>
  );
}
