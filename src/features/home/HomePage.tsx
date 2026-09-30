import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import { canAccess } from "../../config/users";
import { INV, PDRN, fCr } from "../../utils/pdrnLogic";
import { DATA_AS_ON } from "../../config/dataInfo";
import { AnimatedNumber } from "../../components/common/AnimatedNumber";
import "../../components/inventory/smartworldInventory.css";

/** Landing page — the full Smart World summary as interactive chart
 * cards (real data, spring animations), styled to match the rest of
 * the dashboard: soft cards, Georgia headings, navy/gold. */

/* ---------------- house design tokens ---------------- */
const NAVY = "#1E3163", GOLD = "#B8893C", GREEN = "#1BAF7A";
const CHART_CAT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const CARD: React.CSSProperties = {
  background: "#fff", border: "1px solid #eae6da", borderRadius: 12,
  boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)",
  padding: "16px 18px", position: "relative", overflow: "hidden",
};
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };
const GLASS = (c1: string, c2: string): React.CSSProperties => ({
  background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)`,
  border: "1px solid rgba(255,255,255,.35)", borderRadius: 14,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 10px 24px rgba(20,33,61,.28), 0 2px 6px rgba(20,33,61,.18)",
  padding: "14px 16px", color: "#fff", position: "relative", overflow: "hidden",
});

/* ---------------- 1. monthly sales — animated bars ---------------- */
function BBars({ months }: { months: { lbl: string; cr: number }[] }) {
  const [hov, setHov] = useState<number | null>(null);
  const mx = Math.max(...months.map(m => m.cr), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 9, height: 185, paddingTop: 34 }}>
      {months.map((m, i) => (
        <div key={m.lbl} style={{ position: "relative", flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max((m.cr / mx) * 100, 3)}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: i * 0.08 }}
              whileHover={{ scaleY: 1.06, scaleX: 1.05 }}
              onHoverStart={() => setHov(i)} onHoverEnd={() => setHov(null)}
              style={{
                width: "100%", background: i === months.length - 1 ? GOLD : NAVY,
                opacity: i === months.length - 1 ? 1 : 0.88,
                borderRadius: "5px 5px 0 0", transformOrigin: "bottom", cursor: "pointer",
              }}
            />
          </div>
          <div style={{ fontSize: 9.5, color: "var(--mut)", fontWeight: 700, marginTop: 6, whiteSpace: "nowrap" }}>{m.lbl}</div>
          <AnimatePresence>
            {hov === i && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                style={{
                  position: "absolute", bottom: "100%", marginBottom: 2, left: "50%", transform: "translateX(-50%)",
                  background: "#14213D", color: "#fff", padding: "4px 10px", fontSize: 12.5, fontWeight: 800,
                  whiteSpace: "nowrap", borderRadius: 8, boxShadow: "0 6px 16px rgba(20,33,61,.35)", zIndex: 5, pointerEvents: "none",
                }}
              >
                ₹{m.cr >= 100 ? Math.round(m.cr).toLocaleString("en-IN") : m.cr.toFixed(1)} Cr
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 2. sales mix — animated donut ---------------- */
function BDonut({ slices, centerTop, centerSub }: { slices: { label: string; value: number; disp: string }[]; centerTop: string; centerSub: string }) {
  const [hov, setHov] = useState<string | null>(null);
  const tot = slices.reduce((s, d) => s + d.value, 0) || 1;
  let cum = 0;
  const coords = (p: number) => [Math.cos(2 * Math.PI * p), Math.sin(2 * Math.PI * p)];
  const spring = { type: "spring" as const, stiffness: 300, damping: 20 };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "center" }}>
      <div style={{ position: "relative", width: "min(290px, 76%)", aspectRatio: "1" }}>
        <motion.svg
          viewBox="-1.2 -1.2 2.4 2.4" style={{ width: "100%", height: "100%", overflow: "visible" }}
          initial={{ rotate: -180, scale: 0 }} animate={{ rotate: -90, scale: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
        >
          {slices.map((sl, i) => {
            const p0 = cum / tot, p1 = (cum + sl.value) / tot;
            cum += sl.value;
            const [x0, y0] = coords(p0), [x1, y1] = coords(p1);
            const large = sl.value / tot > 0.5 ? 1 : 0;
            const hovd = hov === sl.label, dim = hov !== null && !hovd;
            return (
              <motion.path
                key={sl.label}
                d={`M ${x0} ${y0} A 1 1 0 ${large} 1 ${x1} ${y1} L 0 0`}
                fill={CHART_CAT[i % CHART_CAT.length]} stroke="#fff" strokeWidth={0.03} strokeLinejoin="round"
                animate={{
                  translateX: hovd ? (x0 + x1) * 0.08 : 0, translateY: hovd ? (y0 + y1) * 0.08 : 0,
                  scale: hovd ? 1.05 : 1, opacity: dim ? 0.3 : 1,
                }}
                transition={spring}
                onMouseEnter={() => setHov(sl.label)} onMouseLeave={() => setHov(null)}
                style={{ cursor: "pointer" }}
              />
            );
          })}
          <motion.circle cx={0} cy={0} r={0.56} fill="#fff" stroke="#eae6da" strokeWidth={0.015}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, ...spring }} />
        </motion.svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <AnimatePresence mode="popLayout">
            <motion.div key={hov ?? "tot"} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
              transition={spring} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontFamily: "Georgia,serif", fontSize: hov ? 16 : 20, fontWeight: 700, color: "var(--ink)", textAlign: "center", lineHeight: 1.1 }}>
                {hov ? slices.find(d => d.label === hov)?.disp : centerTop}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--mut)", marginTop: 4, maxWidth: 130, textAlign: "center" }}>
                {hov ?? centerSub}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div style={{ width: "100%", marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
        {slices.map((sl, i) => (
          <motion.div key={sl.label}
            onMouseEnter={() => setHov(sl.label)} onMouseLeave={() => setHov(null)}
            animate={{ opacity: hov && hov !== sl.label ? 0.35 : 1, scale: hov === sl.label ? 1.03 : 1 }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 7px", cursor: "pointer", borderRadius: 7, background: hov === sl.label ? "#faf8f2" : "transparent" }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_CAT[i % CHART_CAT.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sl.label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 11.5, color: "var(--mut)" }}>{((sl.value / tot) * 100).toFixed(0)}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 3. project absorption — animated radar ---------------- */
function BRadar({ axes }: { axes: { label: string; value: number; disp: string }[] }) {
  const [hov, setHov] = useState<string | null>(null);
  const N = axes.length, SZ = 200, C = SZ / 2, R = 80;
  const pt = (v: number, i: number) => {
    const a = (Math.PI / 180) * ((360 / N) * i - 90);
    return { x: C + (v / 100) * R * Math.cos(a), y: C + (v / 100) * R * Math.sin(a) };
  };
  const path = axes.map((d, i) => { const c = pt(d.value, i); return `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`; }).join(" ") + " Z";
  return (
    <div style={{ display: "flex", gap: 18, flex: 1, alignItems: "stretch", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 200px", minHeight: 220, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ position: "absolute", fontFamily: "Georgia,serif", fontSize: 58, fontWeight: 700, color: NAVY, opacity: 0.05, pointerEvents: "none" }}>SOLD</span>
        <svg viewBox={`0 0 ${SZ} ${SZ}`} style={{ width: "100%", height: "100%", maxWidth: 270, overflow: "visible" }}>
          {[100, 75, 50, 25].map(lv => (
            <path key={lv} d={axes.map((_, i) => { const c = pt(lv, i); return `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`; }).join(" ") + " Z"}
              fill="none" stroke="#e5e0d2" strokeWidth={1.5} strokeDasharray="4 4" />
          ))}
          {axes.map((_, i) => { const o = pt(100, i); return <line key={i} x1={C} y1={C} x2={o.x} y2={o.y} stroke="#e5e0d2" strokeWidth={1.5} />; })}
          <motion.path d={path} fill="rgba(184,137,60,0.28)" stroke={GOLD} strokeWidth={2.5} strokeLinejoin="round"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
            style={{ transformOrigin: "50% 50%" }} />
          {axes.map((d, i) => {
            const c = pt(d.value, i);
            const hovd = hov === d.label;
            return (
              <g key={i} onMouseEnter={() => setHov(d.label)} onMouseLeave={() => setHov(null)} style={{ cursor: "pointer" }}>
                <circle cx={c.x} cy={c.y} r={18} fill="transparent" />
                <motion.circle cx={c.x} cy={c.y} r={4.5} stroke={NAVY}
                  animate={{ scale: hovd ? 1.9 : 1, strokeWidth: hovd ? 3 : 2, fill: hovd ? CHART_CAT[i % CHART_CAT.length] : "#ffffff" }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }} />
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ flex: "1 1 170px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}>
        {axes.map((d, i) => (
          <motion.div key={d.label}
            onMouseEnter={() => setHov(d.label)} onMouseLeave={() => setHov(null)}
            animate={{ x: hov === d.label ? 7 : 0 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 9px", cursor: "pointer", borderRadius: 8, background: hov === d.label ? "#faf8f2" : "transparent" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_CAT[i % CHART_CAT.length], flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 12, color: "var(--ink)", whiteSpace: "nowrap", marginLeft: 8 }}>{d.disp}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- module tiles ---------------- */
const MODULES: { icon: keyof typeof Icons; label: string; path: string }[] = [
  { icon: "LayoutDashboard", label: "Business Overview", path: "/overview" },
  { icon: "Target",          label: "Target vs Actual",  path: "/target" },
  { icon: "ReceiptText",     label: "Bookings",          path: "/bookings" },
  { icon: "FileSignature",   label: "EOI / Advance",     path: "/eoi" },
  { icon: "Handshake",       label: "Channel Partners",  path: "/channel-partners" },
  { icon: "Filter",          label: "Gallery Footfall",  path: "/gallery-footfall" },
  { icon: "Zap",             label: "Digital Leads",     path: "/digital-leads" },
  { icon: "Building2",       label: "Inventory",         path: "/inventory" },
  { icon: "Building",        label: "Projects",          path: "/projects" },
  { icon: "HardHat",         label: "Project Tracker",   path: "/project-tracker" },
  { icon: "Headset",         label: "Case Management",   path: "/case-management" },
  { icon: "Landmark",        label: "Loan Details",      path: "/loan-details" },
  { icon: "Banknote",        label: "Collection",        path: "/collections" },
  { icon: "Wallet",          label: "Cost",              path: "/cost" },
  { icon: "Workflow",        label: "PR to PO",          path: "/pr-to-po" },
  { icon: "FileText",        label: "Reports",           path: "/reports" },
  { icon: "NotebookPen",     label: "Notes",             path: "/notes" },
  { icon: "BookOpen",        label: "Guide",             path: "/guide" },
];

/* ---------------- the page ---------------- */
export function HomePage() {
  const userLabel = useAuthStore((s) => s.userLabel);
  const access = useAuthStore((s) => s.access);
  const visibleModules = MODULES.filter(m => canAccess(access, m.path));

  const totalUnits = INV.U.length;
  const sold = PDRN.R.length;
  const tsvCr = PDRN.R.reduce((s, r) => s + r.tsv, 0) / 1e7;
  const projects = INV.P.length;

  // last 8 months of real bookings
  const trend = useMemo(() => {
    const m = new Map<string, number>();
    PDRN.R.forEach(r => { const k = `${r.year}-${String(r.month).padStart(2, "0")}`; m.set(k, (m.get(k) || 0) + r.tsv); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([k, v]) => ({
      lbl: new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(" ", "'"),
      cr: v / 1e7,
    }));
  }, []);

  // sales value share by project (top 5 + other)
  const mix = useMemo(() => {
    const by = new Map<number, number>();
    PDRN.R.forEach(r => by.set(r.projIdx, (by.get(r.projIdx) || 0) + r.tsv));
    const rows = [...by.entries()].map(([i, v]) => ({ label: PDRN.P[i] || `#${i}`, value: v })).sort((a, b) => b.value - a.value);
    const top = rows.slice(0, 5);
    const rest = rows.slice(5).reduce((s, r) => s + r.value, 0);
    const out = top.map(r => ({ ...r, disp: fCr(r.value) }));
    if (rest > 0) out.push({ label: "Other", value: rest, disp: fCr(rest) });
    return out;
  }, []);

  // absorption radar: sold% per project (INV.U tuples: [0]=projIdx)
  const radar = useMemo(() => INV.P.map((name, i) => {
    const total = INV.U.filter(u => (u[0] as number) === i).length;
    const pdrnIdx = PDRN.P.indexOf(name);
    const s = pdrnIdx >= 0 ? PDRN.R.filter(r => r.projIdx === pdrnIdx).length : 0;
    const pct = total ? Math.min((s / total) * 100, 100) : 0;
    return { label: name, value: pct, disp: `${pct.toFixed(0)}%` };
  }).filter(a => a.value > 0).slice(0, 6), []);

  // CRM tile — heavy dataset, lazy after first paint
  const [caseStats, setCaseStats] = useState<{ total: number; resolved: number } | null>(null);
  useEffect(() => {
    let alive = true;
    import("../../components/cases/caseShared").then(m => {
      if (alive) setCaseStats({ total: m.CASES.length, resolved: m.CASES.filter(m.isClosed).length });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const KPIS: { k: string; v: number; fmt: (n: number) => string; g: [string, string] }[] = [
    { k: "Projects", v: projects, fmt: n => Math.round(n).toString(), g: ["#c0392b", "#7e1f14"] },
    { k: "Total units", v: totalUnits, fmt: n => Math.round(n).toLocaleString("en-IN"), g: [NAVY, "#0f2547"] },
    { k: "Units sold", v: sold, fmt: n => Math.round(n).toLocaleString("en-IN"), g: ["#1e9a6c", "#0f6647"] },
    { k: "Sales value", v: tsvCr, fmt: n => fCr(n * 1e7), g: ["#B8893C", "#8a6425"] },
  ];

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "#f6f4ef", position: "relative" }}>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "28px 22px 46px" }}>
        {/* header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "Georgia,serif", fontSize: "clamp(26px, 3.4vw, 36px)", fontWeight: 700, color: "var(--ink)", lineHeight: 1.1 }}>
            {greeting}{userLabel ? `, ${userLabel}` : ""} 👋
          </div>
          <div style={{ fontSize: 13, color: "var(--mut)", marginTop: 5 }}>
            Here's where Smart World stands — data as on <strong style={{ color: GOLD }}>{DATA_AS_ON}</strong>.
          </div>
        </motion.div>

        {/* KPI strip — glass gradients like the other tabs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 20 }}>
          {KPIS.map((s, i) => (
            <motion.div key={s.k} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.3 }}
              whileHover={{ y: -3, boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 16px 32px rgba(20,33,61,.34), 0 3px 8px rgba(20,33,61,.2)" }}
              style={GLASS(s.g[0], s.g[1])}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", opacity: 0.85 }}>{s.k}</div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 27, fontWeight: 700, margin: "4px 0 0" }}>
                <AnimatedNumber value={s.v} format={s.fmt} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* bento grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14, marginBottom: 24 }}>
          {/* left column: bars + radar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.32 }} style={CARD}>
              <h3 style={H3}>Monthly Sales — ₹ Cr</h3>
              <div style={CAP}>last 8 months of bookings · latest in gold · hover a bar for the value</div>
              <BBars months={trend} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.32 }} style={{ ...CARD, display: "flex", flexDirection: "column", flex: 1 }}>
              <h3 style={H3}>Project Absorption</h3>
              <div style={CAP}>units sold as a share of each project's stock</div>
              <BRadar axes={radar} />
            </motion.div>
          </div>

          {/* right column: donut full height */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.32 }} style={{ ...CARD, display: "flex", flexDirection: "column" }}>
            <h3 style={H3}>Sales Mix by Project</h3>
            <div style={CAP}>share of total sales value · hover a slice or legend row</div>
            <BDonut slices={mix} centerTop={fCr(tsvCr * 1e7)} centerSub="Total" />
            {caseStats && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ marginTop: 14, borderTop: "1px solid #eae6da", paddingTop: 11, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: "var(--mut)" }}>CRM — cases resolved</span>
                <span style={{ fontFamily: "Georgia,serif", fontWeight: 700, fontSize: 19, color: GREEN }}>
                  {((caseStats.resolved / Math.max(caseStats.total, 1)) * 100).toFixed(1)}%
                  <span style={{ fontFamily: "inherit", fontSize: 11, fontWeight: 400, color: "var(--mut)", marginLeft: 6 }}>of {caseStats.total.toLocaleString("en-IN")}</span>
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* modules */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--mut)", marginBottom: 10 }}>
          Jump into
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {visibleModules.map((m, i) => {
            const Icon = Icons[m.icon] as React.ComponentType<{ size?: number; strokeWidth?: number }>;
            return (
              <motion.div key={m.path} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 + i * 0.03, duration: 0.28 }}>
                <NavLink to={m.path} style={{ textDecoration: "none" }}>
                  <motion.div
                    whileHover={{ y: -3, boxShadow: "0 4px 8px rgba(20,33,61,.08), 0 14px 30px rgba(20,33,61,.13)" }}
                    whileTap={{ y: 0, scale: 0.98 }}
                    style={{ ...CARD, padding: "13px 14px", display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}
                  >
                    <span style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(30,49,99,.08)", display: "flex", alignItems: "center", justifyContent: "center", color: NAVY, flexShrink: 0 }}>
                      <Icon size={18} strokeWidth={2.2} />
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>{m.label}</span>
                    <span style={{ marginLeft: "auto", color: GOLD, fontSize: 15, fontWeight: 700 }}>›</span>
                  </motion.div>
                </NavLink>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
