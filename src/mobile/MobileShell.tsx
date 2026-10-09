/** Phone app shell: top bar, bottom tabs, bell sheet. Replaces the desktop sidebar/header at ≤640px. */
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as Icons from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { DATA_AS_ON } from "../config/dataInfo";
import { TABS, isRoot, tabFor, titleFor } from "./nav";
import { MOBILE_SCREENS, NO_FULL } from "./routes";
import { initials } from "./fmt";
import { Ico, Row, ScreenSkeleton, Sheet, Skel, ToastHost } from "./ui";
import "./mobile-ui.css";

function displayName(label: string | null) {
  if (!label) return "User";
  return label.includes("@") ? label.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : label;
}

/** data-status sheet behind the bell: when each dataset was last loaded */
function DataStatus({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<{ n: string; d: string }[] | null>(null);
  useEffect(() => {
    if (!open || rows) return;
    Promise.all([
      import("../data/cpAnalytics.json"), import("../data/eoiData.json"), import("../data/costBudget.json"),
      import("../data/projectTracker.json"), import("../data/loanData.json"),
    ]).then(([cp, eoi, cost, trk, loan]) => {
      const a = (m: unknown) => String((m as { default: { meta?: { asOn?: string } } }).default.meta?.asOn ?? "—");
      setRows([
        { n: "Inventory & bookings", d: DATA_AS_ON }, { n: "SAP collections", d: a(cp) }, { n: "EOI / Advance", d: a(eoi) },
        { n: "Cost & budget", d: a(cost) }, { n: "Project tracker", d: a(trk) }, { n: "Home loans", d: a(loan) },
      ]);
    }).catch(() => setRows([{ n: "Inventory & bookings", d: DATA_AS_ON }]));
  }, [open, rows]);
  return (
    <Sheet open={open} onClose={onClose} title="Data status">
      <p className="m-sub" style={{ marginBottom: 8 }}>The dashboard shows data as of each extract below.</p>
      {rows ? rows.map(r => <Row key={r.n} icon={<Icons.Database size={18} />} title={r.n} value={r.d} />) : [0, 1, 2, 3].map(i => <Skel key={i} h={52} style={{ marginBottom: 8 }} />)}
    </Sheet>
  );
}

export function MobileShell({ outlet }: { outlet: ReactNode }) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const userLabel = useAuthStore(s => s.userLabel);
  const [bell, setBell] = useState(false);
  const root = isRoot(pathname);
  const active = tabFor(pathname);
  const full = sp.get("view") === "full";
  const canFull = MOBILE_SCREENS.has(pathname) && !NO_FULL.has(pathname);
  const native = MOBILE_SCREENS.has(pathname) && !full;
  const name = displayName(userLabel);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname, full]);

  const back = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) nav(-1); else nav("/", { replace: true });
  };
  const toggleFull = () => nav(full ? pathname : `${pathname}?view=full`);

  return (
    <ToastHost>
      <div className="m-app">
        <header className="m-top">
          {root ? (
            <>
              <div className="m-brand"><img src="/brand/smartworld-mark.png" alt="" /><span>SmartDB</span></div>
            </>
          ) : (
            <>
              <button type="button" className="m-ico" onClick={back} aria-label="Back"><Icons.ArrowLeft size={22} /></button>
              <h1>{full ? `${titleFor(pathname)} · full view` : titleFor(pathname)}</h1>
              {canFull && (
                <button type="button" className="m-ico" onClick={toggleFull} aria-label={full ? "Back to mobile view" : "Open full desktop view"}>
                  {full ? <Icons.Minimize2 size={20} /> : <Icons.Maximize2 size={20} />}
                </button>
              )}
            </>
          )}
          <button type="button" className="m-ico" onClick={() => setBell(true)} aria-label="Data status"><Icons.Bell size={21} /></button>
          <button type="button" className="m-avatar" onClick={() => nav("/m/more")} aria-label="Account">{initials(name)}</button>
        </header>

        <main className="m-main m-page" key={pathname + (full ? "f" : "")} style={!native ? { maxWidth: "none", padding: `calc(var(--m-top) + 6px) 0 calc(var(--m-bot) + 14px)` } : undefined}>
          <Suspense fallback={<ScreenSkeleton />}>{outlet}</Suspense>
        </main>

        <nav className="m-nav" aria-label="Primary">
          {TABS.map(t => (
            <button key={t.key} type="button" className={active === t.key ? "on" : ""} onClick={() => nav(t.path)} aria-current={active === t.key ? "page" : undefined}>
              <span className="pill"><Ico n={t.icon} size={21} sw={active === t.key ? 2.4 : 2} /></span>
              {t.label}
            </button>
          ))}
        </nav>
        <DataStatus open={bell} onClose={() => setBell(false)} />
      </div>
    </ToastHost>
  );
}
