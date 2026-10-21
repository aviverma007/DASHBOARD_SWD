import { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Plus, Search, UserCog, X } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { authApi, type AdminUser } from "../../services/authApi";
import { GRANTABLE_TABS, ROLE_LABELS } from "../../config/users";

/** Settings → User rights (admin only): create IDs, choose which tabs each ID
 *  sees, reset passwords, disable / enable. Saved by the login service. */

const NAVY = "#1E3163", GOLD = "#B8893C", INK = "#14213d", MUT = "#8a8f9e", LINE = "#e4e0d6", RED = "#c0392b", GREEN = "#1a7a4a";
const CARD: React.CSSProperties = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(20,33,61,.06), 0 4px 16px rgba(20,33,61,.07)" };
const INPUT: React.CSSProperties = { width: "100%", padding: "10px 10px", borderRadius: 9, border: "1.5px solid #ddd8ce", fontSize: 13.5, fontFamily: "inherit", background: "#faf9f6", boxSizing: "border-box", color: INK };
const LBL: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: INK, marginBottom: 6, display: "block" };
const BTN = (kind: "pri" | "sec" | "danger" = "sec"): React.CSSProperties => ({
  padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
  border: kind === "sec" ? `1px solid ${LINE}` : "none",
  background: kind === "pri" ? NAVY : kind === "danger" ? RED : "#fff",
  color: kind === "sec" ? INK : "#fff", display: "inline-flex", alignItems: "center", gap: 6,
});
const ALL_TAB_PATHS = GRANTABLE_TABS.flatMap(g => g.tabs.map(t => t.path));
const TAB_LABEL = new Map(GRANTABLE_TABS.flatMap(g => g.tabs.map(t => [t.path, t.label] as const)));
const fmtWhen = (s: string | null) => {
  if (!s) return "Never";
  const d = new Date(s.replace(" ", "T") + "Z");
  return isNaN(+d) ? s : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
};
const genPassword = () => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const r = new Uint32Array(10); crypto.getRandomValues(r);
  return Array.from(r, x => a[x % a.length]).join("");
};

function Modal({ title, onClose, children, width = 560 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(10,15,30,.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px", overflowY: "auto" }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        style={{ ...CARD, width: `min(${width}px, 100%)`, padding: "22px 24px 20px", boxShadow: "0 8px 60px rgba(0,0,0,.22)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 19, fontWeight: 700, color: INK }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: MUT, padding: 4 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- tab checklist ---------- */
function AccessPicker({ value, onChange, users }: { value: "all" | string[]; onChange: (v: "all" | string[]) => void; users: AdminUser[] }) {
  const sel = value === "all" ? new Set(ALL_TAB_PATHS) : new Set(value);
  const set = (next: Set<string>) => onChange([...next]);
  const toggle = (p: string) => { const n = new Set(sel); if (n.has(p)) n.delete(p); else n.add(p); set(n); };
  return (
    <div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
          <input type="radio" checked={value === "all"} onChange={() => onChange("all")} /> All tabs, including new ones
        </label>
        <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
          <input type="radio" checked={value !== "all"} onChange={() => onChange(value === "all" ? [] : value)} /> Only the tabs ticked below
        </label>
        {value !== "all" && users.length > 0 && (
          <select aria-label="Copy tabs from another user" value="" style={{ ...INPUT, width: "auto", padding: "6px 10px", fontSize: 12.5 }}
            onChange={e => { const u = users.find(x => x.id === e.target.value); if (u) onChange(u.access === "all" ? [...ALL_TAB_PATHS] : [...u.access]); }}>
            <option value="">Copy tabs from…</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.displayName} ({u.id})</option>)}
          </select>
        )}
      </div>
      {value !== "all" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, background: "#faf9f6", border: `1px solid ${LINE}`, borderRadius: 10, padding: 12 }}>
          {GRANTABLE_TABS.map(g => {
            const on = g.tabs.filter(t => sel.has(t.path)).length;
            const all = on === g.tabs.length;
            return (
              <fieldset key={g.section} style={{ border: "none", margin: 0, padding: 0 }}>
                <legend style={{ padding: 0, marginBottom: 6 }}>
                  <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12.5, fontWeight: 700, color: NAVY, cursor: "pointer" }}>
                    <input type="checkbox" checked={all} ref={el => { if (el) el.indeterminate = on > 0 && !all; }}
                      onChange={() => { const n = new Set(sel); g.tabs.forEach(t => (all ? n.delete(t.path) : n.add(t.path))); set(n); }} />
                    {g.section === "Top" ? "General" : g.section}
                  </label>
                </legend>
                {g.tabs.map(t => (
                  <label key={t.path} style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13, padding: "3px 0 3px 18px", cursor: "pointer", color: INK }}>
                    <input type="checkbox" checked={sel.has(t.path)} onChange={() => toggle(t.path)} /> {t.label}
                  </label>
                ))}
              </fieldset>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: MUT, marginTop: 6 }}>Home and Settings are always available.</div>
    </div>
  );
}

/* ---------- create / edit ---------- */
function UserEditor({ user, roles, users, onClose, onSaved }: {
  user: AdminUser | null; roles: string[]; users: AdminUser[]; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const token = useAuthStore(s => s.token)!;
  const isNew = !user;
  const [id, setId] = useState(user?.id ?? "");
  const [name, setName] = useState(user?.displayName ?? "");
  const [role, setRole] = useState(user?.role ?? "sales");
  const [access, setAccess] = useState<"all" | string[]>(user?.access ?? []);
  const [pw, setPw] = useState(() => (user ? "" : genPassword()));
  const [mustChange, setMustChange] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; pw: string } | null>(null);

  const save = async () => {
    setErr("");
    if (isNew && !/^\S+$/.test(id.trim())) return setErr("Enter a user ID without spaces, e.g. name@smartworlddevelopers.com.");
    if (!name.trim()) return setErr("Enter the name to greet this user with.");
    if (isNew && pw.length < 6) return setErr("The password needs at least 6 characters.");
    if (access !== "all" && access.length === 0) return setErr("Tick at least one tab, or choose All tabs.");
    setBusy(true);
    try {
      if (isNew) {
        await authApi.createUser(token, { id: id.trim(), displayName: name.trim(), role, access, password: pw, mustChange });
        setCreated({ id: id.trim().toLowerCase(), pw });
      } else {
        await authApi.updateUser(token, user.id, { displayName: name.trim(), role, access });
        onSaved(`Saved ${user.id}. The change applies the next time they open the dashboard.`);
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(false); }
  };

  if (created) return (
    <Modal title="User created" onClose={() => onSaved(`Created ${created.id}.`)} width={460}>
      <p style={{ fontSize: 13.5, color: INK, lineHeight: 1.55, margin: "0 0 14px" }}>Share these sign-in details with the user. The password is shown only now{mustChange ? "; they'll be asked to change it when they first sign in" : ""}.</p>
      <Secret label="User ID" value={created.id} />
      <Secret label="Password" value={created.pw} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button style={BTN("pri")} onClick={() => onSaved(`Created ${created.id}.`)}>Done</button>
      </div>
    </Modal>
  );

  return (
    <Modal title={isNew ? "New user" : `Edit ${user.id}`} onClose={onClose} width={720}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 16 }}>
        {isNew && (
          <div><label style={LBL} htmlFor="ur-id">User ID</label>
            <input id="ur-id" style={INPUT} value={id} onChange={e => setId(e.target.value)} placeholder="name@smartworlddevelopers.com" autoComplete="off" spellCheck={false} /></div>
        )}
        <div><label style={LBL} htmlFor="ur-name">Display name</label>
          <input id="ur-name" style={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="Shown in the greeting" /></div>
        <div><label style={LBL} htmlFor="ur-role">Role</label>
          <select id="ur-role" style={INPUT} value={role} onChange={e => setRole(e.target.value)}>
            {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
          </select>
          {role === "admin" && <div style={{ fontSize: 11.5, color: GOLD, marginTop: 4 }}>Admins can manage users from this screen.</div>}
        </div>
        {isNew && (
          <div><label style={LBL} htmlFor="ur-pw">Password</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input id="ur-pw" style={{ ...INPUT, fontFamily: "ui-monospace, Menlo, monospace" }} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
              <button type="button" style={BTN()} onClick={() => setPw(genPassword())} title="Generate a new password">New</button>
            </div>
            <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12, marginTop: 6, color: INK, cursor: "pointer" }}>
              <input type="checkbox" checked={mustChange} onChange={e => setMustChange(e.target.checked)} /> Ask them to change it at first sign-in
            </label>
          </div>
        )}
      </div>
      <div style={{ ...LBL, marginBottom: 8 }}>Tabs this user can see</div>
      <AccessPicker value={access} onChange={setAccess} users={users.filter(u => u.id !== user?.id)} />
      {err && <div role="alert" style={{ color: RED, fontSize: 13, marginTop: 12 }}>{err}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button style={BTN()} onClick={onClose}>Cancel</button>
        <button style={BTN("pri")} onClick={save} disabled={busy}>{busy ? "Saving…" : isNew ? "Create user" : "Save changes"}</button>
      </div>
    </Modal>
  );
}

function Secret({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#faf9f6", border: `1px solid ${LINE}`, borderRadius: 9, padding: "9px 12px", marginBottom: 8 }}>
      <span style={{ fontSize: 12, color: MUT, width: 70 }}>{label}</span>
      <code style={{ flex: 1, fontSize: 14, fontWeight: 700, color: INK, wordBreak: "break-all" }}>{value}</code>
      <button style={{ ...BTN(), padding: "6px 10px" }} onClick={() => { navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}>
        <Copy size={14} /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/* ---------- reset password ---------- */
function ResetDialog({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: (msg: string) => void }) {
  const token = useAuthStore(s => s.token)!;
  const [mode, setMode] = useState<"gen" | "set">("gen");
  const [pw, setPw] = useState("");
  const [mustChange, setMustChange] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const go = async () => {
    setErr("");
    if (mode === "set" && pw.length < 6) return setErr("The password needs at least 6 characters.");
    setBusy(true);
    try {
      const r = await authApi.resetPassword(token, user.id, mode === "set" ? pw : "", mustChange);
      setResult(r.tempPassword ?? pw);
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't reset the password."); }
    finally { setBusy(false); }
  };
  if (result) return (
    <Modal title="Password reset" onClose={() => onDone(`Password reset for ${user.id}.`)} width={460}>
      <p style={{ fontSize: 13.5, color: INK, lineHeight: 1.55, margin: "0 0 14px" }}>
        {user.displayName} has been signed out everywhere. Share the new password with them — it's shown only now{mustChange ? "; they'll set their own when they next sign in" : ""}.
      </p>
      <Secret label="User ID" value={user.id} />
      <Secret label="Password" value={result} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button style={BTN("pri")} onClick={() => onDone(`Password reset for ${user.id}.`)}>Done</button>
      </div>
    </Modal>
  );
  return (
    <Modal title={`Reset password for ${user.displayName}`} onClose={onClose} width={480}>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, marginBottom: 8, cursor: "pointer" }}>
        <input type="radio" checked={mode === "gen"} onChange={() => setMode("gen")} /> Generate a temporary password
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, marginBottom: 8, cursor: "pointer" }}>
        <input type="radio" checked={mode === "set"} onChange={() => setMode("set")} /> Set a password myself
      </label>
      {mode === "set" && <input aria-label="New password" style={{ ...INPUT, marginBottom: 8 }} value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters" />}
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, margin: "6px 0 2px", cursor: "pointer" }}>
        <input type="checkbox" checked={mustChange} onChange={e => setMustChange(e.target.checked)} /> Ask them to change it at next sign-in
      </label>
      <div style={{ fontSize: 12, color: MUT, marginTop: 6 }}>Resetting signs {user.displayName} out of every device.</div>
      {err && <div role="alert" style={{ color: RED, fontSize: 13, marginTop: 10 }}>{err}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button style={BTN()} onClick={onClose}>Cancel</button>
        <button style={BTN("pri")} onClick={go} disabled={busy}>{busy ? "Resetting…" : "Reset password"}</button>
      </div>
    </Modal>
  );
}

/* ---------- the panel ---------- */
export function UserRightsPanel() {
  const token = useAuthStore(s => s.token);
  const myId = useAuthStore(s => s.userId);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<string[]>(Object.keys(ROLE_LABELS));
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState("");

  const load = () => {
    if (!token) return;
    setLoading(true);
    authApi.listUsers(token)
      .then(r => { setUsers(r.users); setRoles(r.roles); setLoadErr(""); })
      .catch(e => setLoadErr(e instanceof Error ? e.message : "Couldn't load users."))
      .finally(() => setLoading(false));
  };
  useEffect(load, [token]);   // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return users.filter(u => !t || u.id.includes(t) || u.displayName.toLowerCase().includes(t) || (ROLE_LABELS[u.role] ?? u.role).toLowerCase().includes(t));
  }, [users, q]);
  const done = (msg: string) => { setEditing(null); setResetting(null); setToggling(null); setNotice(msg); load(); };

  const toggleActive = async (u: AdminUser) => {
    try { await authApi.updateUser(token!, u.id, { active: !u.active }); done(u.active ? `Disabled ${u.id}. They were signed out.` : `Enabled ${u.id}.`); }
    catch (e) { setToggling(null); setNotice(e instanceof Error ? e.message : "Couldn't update the user."); }
  };

  const TH = (h: string) => <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 700, color: MUT, padding: "10px 10px", borderBottom: `2px solid ${LINE}`, whiteSpace: "nowrap" }}>{h}</th>;

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 360 }}>
          <Search size={15} style={{ position: "absolute", left: 11, top: 11, color: MUT }} aria-hidden />
          <input aria-label="Search users" style={{ ...INPUT, paddingLeft: 32 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search by ID, name or role" />
        </div>
        <div style={{ fontSize: 12.5, color: MUT }}>{users.length ? `${shown.length} of ${users.length} users` : ""}</div>
        <button style={{ ...BTN("pri"), marginLeft: "auto" }} onClick={() => setEditing("new")}><Plus size={15} /> New user</button>
      </div>

      {notice && (
        <div role="status" style={{ background: "#eef6f1", border: "1px solid #cfe6d8", color: GREEN, borderRadius: 9, padding: "9px 12px", fontSize: 13, marginBottom: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Dismiss" style={{ background: "none", border: "none", cursor: "pointer", color: GREEN }}><X size={15} /></button>
        </div>
      )}

      <div style={{ ...CARD, overflow: "hidden" }}>
        {loadErr ? (
          <div style={{ padding: 24, fontSize: 13.5, color: RED }}>{loadErr} <button style={{ ...BTN(), marginLeft: 8 }} onClick={load}>Try again</button></div>
        ) : loading && !users.length ? (
          <div style={{ padding: 24, fontSize: 13.5, color: MUT }}>Loading users…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 820 }}>
              <thead><tr style={{ background: "#faf9f6" }}>{["User ID", "Name", "Role", "Tabs", "Status", ""].map(TH)}</tr></thead>
              <tbody>
                {shown.map(u => {
                  const tabNames = u.access === "all" ? "Every tab" : u.access.map(p => TAB_LABEL.get(p) ?? p).join(", ");
                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid #f0ede6", opacity: u.active ? 1 : 0.6 }}>
                      <td style={{ padding: "10px 10px", fontWeight: 600, color: INK, whiteSpace: "nowrap" }}>{u.id}{u.id === myId && <span style={{ color: GOLD, fontWeight: 600, fontSize: 11.5 }}> (you)</span>}</td>
                      <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>{u.displayName}</td>
                      <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>{ROLE_LABELS[u.role] ?? u.role}</td>
                      <td style={{ padding: "10px 10px", maxWidth: 200 }} title={tabNames}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: u.access === "all" ? NAVY : INK, fontWeight: u.access === "all" ? 600 : 400 }}>
                          {u.access === "all" ? "All tabs" : u.access.length ? tabNames : <span style={{ color: RED }}>No tabs</span>}
                        </div>
                      </td>
                      <td style={{ padding: "10px 10px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "3px 10px", background: u.active ? "#e2f3ec" : "#f1efea", color: u.active ? GREEN : MUT }}>{u.active ? "Active" : "Disabled"}</span>
                        <div style={{ fontSize: 11.5, color: u.mustChange && u.active ? GOLD : MUT, marginTop: 4 }}>
                          {u.mustChange && u.active ? "Password change due" : u.lastLogin ? `Signed in ${fmtWhen(u.lastLogin)}` : "Never signed in"}
                        </div>
                      </td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", textAlign: "right" }}>
                        <button style={{ ...BTN(), padding: "6px 10px" }} onClick={() => setEditing(u)} aria-label={`Edit ${u.id}`}><UserCog size={14} /> Edit</button>{" "}
                        <button style={{ ...BTN(), padding: "6px 10px" }} onClick={() => setResetting(u)} title="Reset password" aria-label={`Reset password for ${u.id}`}><KeyRound size={14} /> Reset</button>{" "}
                        {u.id !== myId && (
                          <button style={{ ...BTN(), padding: "6px 10px", color: u.active ? RED : GREEN }} onClick={() => setToggling(u)}>{u.active ? "Disable" : "Enable"}</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!shown.length && <tr><td colSpan={6} style={{ padding: 22, textAlign: "center", color: MUT }}>No users match "{q}".</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && <UserEditor user={editing === "new" ? null : editing} roles={roles} users={users} onClose={() => setEditing(null)} onSaved={done} />}
      {resetting && <ResetDialog user={resetting} onClose={() => setResetting(null)} onDone={done} />}
      {toggling && (
        <Modal title={toggling.active ? `Disable ${toggling.displayName}?` : `Enable ${toggling.displayName}?`} onClose={() => setToggling(null)} width={430}>
          <p style={{ fontSize: 13.5, color: INK, lineHeight: 1.55, margin: 0 }}>
            {toggling.active
              ? `${toggling.id} will be signed out and can't sign in until you enable the ID again. Their tabs are kept.`
              : `${toggling.id} will be able to sign in again with their current password.`}
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button style={BTN()} onClick={() => setToggling(null)}>Cancel</button>
            <button style={BTN(toggling.active ? "danger" : "pri")} onClick={() => toggleActive(toggling)}>{toggling.active ? "Disable user" : "Enable user"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
