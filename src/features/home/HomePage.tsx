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

/** Landing page — brutalist bento dashboard: the full Smart World
 * summary as bold interactive chart cards (real data), plus one-click
 * module tiles. Design: thick borders, hard offset shadows, dotted
 * texture, spring animations. */

/* ---------------- brutalist design tokens ---------------- */
const INK = "#111111";
const PALETTE = ["#f87171", "#60a5fa", "#4ade80", "#fbbf24", "#a78bfa", "#B8893C"];
const BCARD: React.CSSProperties = {
  background: "#fff", border: `3px solid ${INK}`, boxShadow: `8px 8px 0 0 ${INK}`,
  padding: "20px 22px", position: "relative", overflow: "hidden",
};
const BTITLE: React.CSSProperties = {
  fontFamily: "Inter, system-ui, sans-serif",
  fontWeight: 900, textTransform: "uppercase", fontSize: 17, letterSpacing: "-0.5px",
  borderBottom: `3px solid ${INK}`, paddingBottom: 8, marginBottom: 14, color: INK,
};
const DOTS: React.CSSProperties = {
  position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.06,
  backgroundImage: "radial-gradient(#000 1.5px, transparent 1.5px)", backgroundSize: "10px 10px",
};
const MONO: React.CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };

/* ---------------- 1. monthly sales — brutalist bars ---------------- */
function BBars({ months }: { months: { lbl: string; cr: number }[] }) {
  const [hov, setHov] = useState<number | null>(null);
  const mx = Math.max(...months.map(m => m.cr), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 190, paddingTop: 34 }}>
      {months.map((m, i) => (
        <div key={m.lbl} style={{ position: "relative", flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }}>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${Math.max((m.cr / mx) * 100, 4)}%` }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: i * 0.08 }}
            whileHover={{ scaleY: 1.06, scaleX: 1.04 }}
            onHoverStart={() => setHov(i)} onHoverEnd={() => setHov(null)}
            style={{
              width: "100%", background: PALETTE[i % 5], border: `3px solid ${INK}`,
              transformOrigin: "bottom", cursor: "pointer", position: "relative",
              display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 4,
            }}
          >
            <div style={{ ...DOTS, opacity: 0.16, backgroundSize: "4px 4px" }} />
            <span style={{ ...MONO, fontSize: 10, fontWeight: 700, color: "rgba(0,0,0,.75)", writingMode: months.length > 9 ? "vertical-rl" : undefined }}>{m.lbl}</span>
          </motion.div>
          <AnimatePresence>
            {hov === i && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                style={{
                  position: "absolute", bottom: "100%", marginBottom: 2, left: "50%", transform: "translateX(-50%)",
                  background: INK, color: "#fff", padding: "3px 9px", fontSize: 13, fontWeight: 900,
                  whiteSpace: "nowrap", border: `3px solid ${INK}`, zIndex: 5, pointerEvents: "none",
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

/* ---------------- 2. sales mix — brutalist donut ---------------- */
function BDonut({ slices, centerTop, centerSub }: { slices: { label: string; value: number; disp: string }[]; centerTop: string; centerSub: string }) {
  const [hov, setHov] = useState<string | null>(null);
  const tot = slices.reduce((s, d) => s + d.value, 0) || 1;
  let cum = 0;
  const coords = (p: number) => [Math.cos(2 * Math.PI * p), Math.sin(2 * Math.PI * p)];
  const spring = { type: "spring" as const, stiffness: 300, damping: 20 };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "center" }}>
      <div style={{ position: "relative", width: "min(300px, 78%)", aspectRatio: "1" }}>
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
                fill={PALETTE[i % PALETTE.length]} stroke={INK} strokeWidth={0.045} strokeLinejoin="round"
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
          <motion.circle cx={0} cy={0} r={0.55} fill="#fff" stroke={INK} strokeWidth={0.045}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, ...spring }} />
        </motion.svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <AnimatePresence mode="popLayout">
            <motion.div key={hov ?? "tot"} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }}
              transition={spring} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: hov ? 17 : 21, fontWeight: 900, color: INK, textAlign: "center", lineHeight: 1.1 }}>
                {hov ? slices.find(d => d.label === hov)?.disp : centerTop}
              </span>
              <span style={{ fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "2px", background: INK, color: "#fff", padding: "1px 6px", marginTop: 4 }}>
                {hov ?? centerSub}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div style={{ width: "100%", marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {slices.map((sl, i) => (
          <motion.div key={sl.label}
            onMouseEnter={() => setHov(sl.label)} onMouseLeave={() => setHov(null)}
            animate={{ opacity: hov && hov !== sl.label ? 0.3 : 1, scale: hov === sl.label ? 1.04 : 1 }}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 7px", cursor: "pointer", border: "2px solid transparent" }}
            whileHover={{ border: `2px solid ${INK}` }}
          >
            <span style={{ width: 12, height: 12, background: PALETTE[i % PALETTE.length], border: `2px solid ${INK}`, flexShrink: 0 }} />
            <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sl.label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 900, fontSize: 11.5, color: INK }}>{((sl.value / tot) * 100).toFixed(0)}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 3. project absorption — brutalist radar ---------------- */
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
        <span style={{ position: "absolute", fontSize: 64, fontWeight: 900, textTransform: "uppercase", color: INK, opacity: 0.05, pointerEvents: "none" }}>SOLD</span>
        <svg viewBox={`0 0 ${SZ} ${SZ}`} style={{ width: "100%", height: "100%", maxWidth: 270, overflow: "visible" }}>
          {[100, 75, 50, 25].map(lv => (
            <path key={lv} d={axes.map((_, i) => { const c = pt(lv, i); return `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`; }).join(" ") + " Z"}
              fill="none" stroke="rgba(0,0,0,.12)" strokeWidth={2} strokeDasharray="4 4" />
          ))}
          {axes.map((_, i) => { const o = pt(100, i); return <line key={i} x1={C} y1={C} x2={o.x} y2={o.y} stroke="rgba(0,0,0,.12)" strokeWidth={2} />; })}
          <motion.path d={path} fill="rgba(184,137,60,0.4)" stroke={INK} strokeWidth={4} strokeLinejoin="round"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
            style={{ transformOrigin: "50% 50%" }} />
          {axes.map((d, i) => {
            const c = pt(d.value, i);
            const hovd = hov === d.label;
            return (
              <g key={i} onMouseEnter={() => setHov(d.label)} onMouseLeave={() => setHov(null)} style={{ cursor: "pointer" }}>
                <circle cx={c.x} cy={c.y} r={18} fill="transparent" />
                <motion.circle cx={c.x} cy={c.y} r={6} stroke={INK}
                  animate={{ scale: hovd ? 1.9 : 1, strokeWidth: hovd ? 4 : 3, fill: hovd ? PALETTE[i % PALETTE.length] : "#ffffff" }}
                  transition={{ type: "spring", stiffness: 400, damping: 15 }} />
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ flex: "1 1 170px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
        {axes.map((d, i) => (
          <motion.div key={d.label}
            onMouseEnter={() => setHov(d.label)} onMouseLeave={() => setHov(null)}
            animate={{ x: hov === d.label ? 8 : 0 }}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", cursor: "pointer", border: "2px solid transparent", background: hov === d.label ? "#fafafa" : "transparent", borderColor: hov === d.label ? INK : "transparent" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ width: 12, height: 12, background: PALETTE[i % PALETTE.length], border: `2px solid ${INK}`, flexShrink: 0 }} />
              <span style={{ ...MONO, fontSize: 11, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            </div>
            <span style={{ fontWeight: 900, fontSize: 12.5, color: INK, whiteSpace: "nowrap", marginLeft: 8 }}>{d.disp}</span>
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
      lbl: new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(" ", "'").toUpperCase(),
      cr: v / 1e7,
    }));
  }, []);

  // sales value share by project (top 5 + other)
  const mix = useMemo(() => {
    const by = new Map<number, number>();
    PDRN.R.forEach(r => by.set(r.projIdx, (by.get(r.projIdx) || 0) + r.tsv));
    const rows = [...by.entries()].map(([i, v]) => ({ label: (PDRN.P[i] || `#${i}`).toUpperCase(), value: v })).sort((a, b) => b.value - a.value);
    const top = rows.slice(0, 5);
    const rest = rows.slice(5).reduce((s, r) => s + r.value, 0);
    const out = top.map(r => ({ ...r, disp: fCr(r.value) }));
    if (rest > 0) out.push({ label: "OTHER", value: rest, disp: fCr(rest) });
    return out;
  }, []);

  // absorption radar: sold% per project (INV.U tuples: [0]=projIdx)
  const radar = useMemo(() => INV.P.map((name, i) => {
    const total = INV.U.filter(u => (u[0] as number) === i).length;
    const pdrnIdx = PDRN.P.indexOf(name);
    const s = pdrnIdx >= 0 ? PDRN.R.filter(r => r.projIdx === pdrnIdx).length : 0;
    const pct = total ? Math.min((s / total) * 100, 100) : 0;
    return { label: name.toUpperCase(), value: pct, disp: `${pct.toFixed(0)}%` };
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
  const greeting = hour < 12 ? "GOOD MORNING" : hour < 17 ? "GOOD AFTERNOON" : "GOOD EVENING";

  const KPIS: { k: string; v: number; fmt: (n: number) => string; col: string }[] = [
    { k: "Projects", v: projects, fmt: n => Math.round(n).toString(), col: PALETTE[0] },
    { k: "Total units", v: totalUnits, fmt: n => Math.round(n).toLocaleString("en-IN"), col: PALETTE[1] },
    { k: "Units sold", v: sold, fmt: n => Math.round(n).toLocaleString("en-IN"), col: PALETTE[2] },
    { k: "Sales value", v: tsvCr, fmt: n => fCr(n * 1e7), col: PALETTE[3] },
  ];

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "#f4f4f2", position: "relative" }}>
      {/* dotted texture background */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", opacity: 0.05, backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1180, margin: "0 auto", padding: "30px 22px 50px" }}>
        {/* header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ marginBottom: 26 }}>
          <div style={{ fontSize: "clamp(34px, 5vw, 56px)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "-2px", color: INK, lineHeight: 1, fontFamily: "Inter, system-ui, sans-serif" }}>
            Smart World
          </div>
          <p style={{ ...MONO, fontWeight: 700, color: "#71717a", textTransform: "uppercase", letterSpacing: "3px", fontSize: 12, margin: "8px 0 0" }}>
            {greeting}{userLabel ? `, ${userLabel}` : ""} — company overview · data as on {DATA_AS_ON}
          </p>
        </motion.div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 18, marginBottom: 24 }}>
          {KPIS.map((s, i) => (
            <motion.div key={s.k} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.3 }}
              whileHover={{ x: 3, y: 3, boxShadow: `4px 4px 0 0 ${INK}` }}
              style={{ ...BCARD, padding: "16px 18px", borderTop: `10px solid ${s.col}` }}>
              <div style={{ ...MONO, fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#71717a" }}>{s.k}</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: INK, marginTop: 4, letterSpacing: "-1px" }}>
                <AnimatedNumber value={s.v} format={s.fmt} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* bento grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 22, marginBottom: 26 }}>
          {/* left column: bars + radar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.32 }} style={BCARD}>
              <h3 style={BTITLE}>Monthly Sales — ₹ Cr</h3>
              <BBars months={trend} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.32 }} style={{ ...BCARD, background: "#fafafa", display: "flex", flexDirection: "column", flex: 1 }}>
              <h3 style={BTITLE}>Project Absorption</h3>
              <BRadar axes={radar} />
            </motion.div>
          </div>

          {/* right column: donut full height */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.32 }} style={{ ...BCARD, display: "flex", flexDirection: "column" }}>
            <div style={DOTS} />
            <h3 style={{ ...BTITLE, textAlign: "center" }}>Sales Mix by Project</h3>
            <BDonut slices={mix} centerTop={fCr(tsvCr * 1e7)} centerSub="TOTAL" />
            {caseStats && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ marginTop: 16, borderTop: `3px solid ${INK}`, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ ...MONO, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#71717a" }}>CRM — cases resolved</span>
                <span style={{ fontWeight: 900, fontSize: 20, color: INK }}>
                  {((caseStats.resolved / Math.max(caseStats.total, 1)) * 100).toFixed(1)}%
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#71717a", marginLeft: 6 }}>of {caseStats.total.toLocaleString("en-IN")}</span>
                </span>
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* modules */}
        <div style={{ ...MONO, fontSize: 12, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "#71717a", marginBottom: 14 }}>
          ▞▞ Jump into
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
          {visibleModules.map((m, i) => {
            const Icon = Icons[m.icon] as React.ComponentType<{ size?: number; strokeWidth?: number }>;
            return (
              <motion.div key={m.path} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 + i * 0.03, duration: 0.28 }}>
                <NavLink to={m.path} style={{ textDecoration: "none" }}>
                  <motion.div
                    whileHover={{ x: 4, y: 4, boxShadow: `2px 2px 0 0 ${INK}` }} whileTap={{ x: 6, y: 6, boxShadow: `0px 0px 0 0 ${INK}` }}
                    style={{ background: "#fff", border: `3px solid ${INK}`, boxShadow: `6px 6px 0 0 ${INK}`, padding: "13px 14px", display: "flex", alignItems: "center", gap: 11, cursor: "pointer" }}
                  >
                    <span style={{ width: 34, height: 34, background: PALETTE[i % PALETTE.length], border: `2.5px solid ${INK}`, display: "flex", alignItems: "center", justifyContent: "center", color: INK, flexShrink: 0 }}>
                      <Icon size={17} strokeWidth={2.5} />
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase", letterSpacing: "-0.3px", color: INK, lineHeight: 1.15 }}>{m.label}</span>
                    <span style={{ marginLeft: "auto", fontWeight: 900, color: INK }}>→</span>
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
