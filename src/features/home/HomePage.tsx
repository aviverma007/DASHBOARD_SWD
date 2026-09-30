import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import { canAccess } from "../../config/users";
import { INV, PDRN, fCr } from "../../utils/pdrnLogic";
import { DATA_AS_ON } from "../../config/dataInfo";
import { AnimatedNumber } from "../../components/common/AnimatedNumber";
import AnimatedGradient from "../../components/ui/animated-gradient";
import "../../components/inventory/smartworldInventory.css";

/** Landing page — greets the user, gives the full Smart World summary
 * (sales, inventory, CRM, procurement) over an animated graph
 * background, and offers one-click cards into every module. */

const MODULES: { icon: keyof typeof Icons; label: string; desc: string; path: string }[] = [
  { icon: "LayoutDashboard", label: "Business Overview", desc: "Sold vs available, TSV, rates and drill-downs per project", path: "/overview" },
  { icon: "Target",          label: "Target vs Actual", desc: "AOP plan vs achieved — units, TSV, area and rate pace",  path: "/target" },
  { icon: "ReceiptText",     label: "Bookings",         desc: "Booking value, trend, ticket mix and records",           path: "/bookings" },
  { icon: "FileSignature",   label: "EOI/Advance",      desc: "Customer money in hand — EOI and advance reconciliation", path: "/eoi" },
  { icon: "Handshake",       label: "Channel Partners", desc: "CP rankings, rate ranges, trends and cancellations",     path: "/channel-partners" },
  { icon: "Filter",          label: "Gallery Footfall", desc: "Customer footfall and CP gallery visits",                path: "/gallery-footfall" },
  { icon: "Zap",             label: "Digital Leads",    desc: "Digital enquiries, channels and funnels",                path: "/digital-leads" },
  { icon: "Building2",       label: "Inventory",        desc: "Stock by project, tower, floor and unit status",         path: "/inventory" },
  { icon: "Building",        label: "Projects",         desc: "Project cards with mix, absorption and site plans",      path: "/projects" },
  { icon: "HardHat",         label: "Project Tracker",  desc: "Construction schedule — floors, activities, slippage",   path: "/project-tracker" },
  { icon: "Headset",         label: "Case Management",  desc: "CRM tickets — open/closed, TAT, owners and ageing",      path: "/case-management" },
  { icon: "Landmark",        label: "Loan Details",     desc: "Home-loan funnel — sanctions, disbursements, banks",     path: "/loan-details" },
  { icon: "Banknote",        label: "Collection",       desc: "Live dues & receipts from the CRM shared-folder files",  path: "/collections" },
  { icon: "Wallet",          label: "Cost",             desc: "Budget control — approved vs utilized, WBS health, PO spend", path: "/cost" },
  { icon: "Workflow",        label: "PR to PO",         desc: "Live PR → PO journey — approvals, pending, TATs",        path: "/pr-to-po" },
  { icon: "FileText",        label: "Reports",          desc: "Excel exports of every dataset",                         path: "/reports" },
  { icon: "NotebookPen",     label: "Notes",            desc: "Your personal scratchpad, saved in this browser",        path: "/notes" },
  { icon: "BookOpen",        label: "Guide",            desc: "Every formula, colour and shortcut explained",           path: "/guide" },
];

/* ---------------- animated graph background ----------------
 * Fixed, behind everything, pointer-events none. Only transforms and
 * opacity animate, so it stays cheap on the GPU: two endless scrolling
 * "market lines", a row of breathing bars, and slow-rising dots. */
function GraphBg() {
  const W = 1600, H = 900;
  // deterministic pseudo-random wave points (stable across renders)
  const wave = (seed: number, amp: number, base: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = (i / 40) * W * 2;
      const y = base + Math.sin(i * 0.55 + seed) * amp + Math.sin(i * 0.21 + seed * 2) * amp * 0.6;
      pts.push(`${x},${y}`);
    }
    return pts.join(" ");
  };
  const bars = [42, 68, 30, 80, 55, 92, 47, 73, 38, 85, 60, 50, 78, 35, 66, 88, 44, 72];
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden", opacity: 0.55 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        {/* faint chart grid */}
        {[0.2, 0.4, 0.6, 0.8].map(f => (
          <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#1E3163" strokeOpacity={0.06} strokeWidth={1} />
        ))}
        {/* endless scrolling lines (drawn 2× wide, slid half-way, looped) */}
        <motion.g animate={{ x: [0, -W] }} transition={{ duration: 46, repeat: Infinity, ease: "linear" }}>
          <polyline points={wave(1.3, 60, H * 0.34)} fill="none" stroke="#1E3163" strokeOpacity={0.12} strokeWidth={2.5} />
          <polyline points={wave(1.3, 60, H * 0.34)} fill="none" stroke="#1E3163" strokeOpacity={0.12} strokeWidth={2.5} transform={`translate(${W * 2},0)`} />
        </motion.g>
        <motion.g animate={{ x: [0, -W] }} transition={{ duration: 68, repeat: Infinity, ease: "linear" }}>
          <polyline points={wave(4.1, 44, H * 0.52)} fill="none" stroke="#B8893C" strokeOpacity={0.14} strokeWidth={2} />
          <polyline points={wave(4.1, 44, H * 0.52)} fill="none" stroke="#B8893C" strokeOpacity={0.14} strokeWidth={2} transform={`translate(${W * 2},0)`} />
        </motion.g>
        {/* breathing bars along the bottom */}
        {bars.map((h, i) => (
          <motion.rect
            key={i}
            x={40 + i * (W / bars.length)} width={W / bars.length - 26} rx={5}
            y={H} height={h * 3.2} fill={i % 3 === 2 ? "#B8893C" : "#1E3163"} fillOpacity={0.08}
            style={{ originY: "100%", transformBox: "fill-box" }}
            initial={{ scaleY: 0.55, y: H - h * 3.2 }}
            animate={{ scaleY: [0.55, 1, 0.55] }}
            transition={{ duration: 5 + (i % 5), repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
          />
        ))}
        {/* slow-rising data points */}
        {[0.12, 0.3, 0.48, 0.64, 0.8, 0.92].map((fx, i) => (
          <motion.circle
            key={i} cx={W * fx} r={i % 2 ? 5 : 3.5}
            fill={i % 2 ? "#B8893C" : "#1E3163"} fillOpacity={0.16}
            initial={{ cy: H + 20 }}
            animate={{ cy: -30 }}
            transition={{ duration: 26 + i * 7, repeat: Infinity, ease: "linear", delay: i * 4 }}
          />
        ))}
      </svg>
    </div>
  );
}

/* Animated monthly sales bars — real figures, grow in on mount */
function TrendChart({ months }: { months: { lbl: string; cr: number }[] }) {
  const mx = Math.max(...months.map(m => m.cr), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 130, marginTop: 12 }}>
      {months.map((m, i) => (
        <div key={m.lbl} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", minWidth: 0 }}>
          <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: "#1E3163", marginBottom: 3, whiteSpace: "nowrap" }}>{m.cr >= 100 ? Math.round(m.cr) : m.cr.toFixed(0)}</div>
            <motion.div
              initial={{ height: 0 }} animate={{ height: `${(m.cr / mx) * 100}%` }}
              transition={{ delay: 0.25 + i * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: "68%", minHeight: 3, borderRadius: "5px 5px 0 0", background: i === months.length - 1 ? "var(--gold)" : "#1E3163", opacity: i === months.length - 1 ? 1 : 0.82 }}
            />
          </div>
          <div style={{ fontSize: 8.5, color: "var(--mut)", fontWeight: 700, marginTop: 5, whiteSpace: "nowrap" }}>{m.lbl}</div>
        </div>
      ))}
    </div>
  );
}

export function HomePage() {
  const userLabel = useAuthStore((s) => s.userLabel);
  const access = useAuthStore((s) => s.access);
  const visibleModules = MODULES.filter(m => canAccess(access, m.path));

  // Honest company snapshot straight from the datasets
  const totalUnits = INV.U.length;
  const sold = PDRN.R.length;
  const tsvCr = PDRN.R.reduce((s, r) => s + r.tsv, 0) / 1e7;
  const projects = INV.P.length;

  // Real monthly sales trend — last 12 months present in the sales data
  const trend = useMemo(() => {
    const m = new Map<string, number>();
    PDRN.R.forEach(r => {
      const k = `${r.year}-${String(r.month).padStart(2, "0")}`;
      m.set(k, (m.get(k) || 0) + r.tsv);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([k, v]) => ({
      lbl: new Date(`${k}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(" ", "'"),
      cr: v / 1e7,
    }));
  }, []);

  /* Cross-vertical stats — datasets are heavy, so they load lazily
   * after first paint and the tiles animate in when ready. */
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

  const KPIS = [
    { k: "Projects", v: projects, fmt: (n: number) => Math.round(n).toString() },
    { k: "Total units", v: totalUnits, fmt: (n: number) => Math.round(n).toLocaleString("en-IN") },
    { k: "Units sold", v: sold, fmt: (n: number) => Math.round(n).toLocaleString("en-IN") },
    { k: "Sales value", v: tsvCr, fmt: (n: number) => fCr(n * 1e7) },
  ];

  const soldPct = totalUnits ? (sold / totalUnits) * 100 : 0;
  const glance: { k: string; v: string; sub: string; col: string; path: string }[] = [
    { k: "Sales", v: fCr(tsvCr * 1e7), sub: `${sold.toLocaleString("en-IN")} units sold across ${projects} projects`, col: "#1E3163", path: "/overview" },
    { k: "Inventory", v: `${soldPct.toFixed(1)}%`, sub: `sold · ${(totalUnits - sold).toLocaleString("en-IN")} units still available`, col: "#B8893C", path: "/inventory" },
    ...(caseStats ? [{ k: "CRM · Cases", v: `${((caseStats.resolved / Math.max(caseStats.total, 1)) * 100).toFixed(1)}%`, sub: `resolved of ${caseStats.total.toLocaleString("en-IN")} customer cases`, col: "#1BAF7A", path: "/case-management" }] : []),
  ];

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "var(--bg)", position: "relative" }}>
      <GraphBg />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1080, margin: "0 auto", padding: "26px 22px 44px" }}>
        {/* Hero: greeting + snapshot on a live navy/gold gradient */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "relative", borderRadius: 18, overflow: "hidden", padding: "26px 26px 24px", marginBottom: 16, background: "#1E3163" }}
        >
          <AnimatedGradient
            config={{ preset: "custom", color1: "#14213d", color2: "#1E3163", color3: "#B8893C", rotation: -35, proportion: 42, scale: 0.5, speed: 14, distortion: 3, swirl: 45, swirlIterations: 6, softness: 100, offset: -120, shape: "Checks", shapeSize: 34 }}
            noise={{ opacity: 0.14, scale: 1.2 }}
            style={{ zIndex: 0 }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 27, fontWeight: 700, color: "#fff" }}>
              {greeting}{userLabel ? `, ${userLabel}` : ""} 👋
            </div>
            <div style={{ fontSize: 13.5, color: "#c7cedf", marginTop: 4 }}>
              Here's where Smart World stands — data as on <strong style={{ color: "#F5D9A8" }}>{DATA_AS_ON}</strong>.
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 20 }}
            >
              {KPIS.map((s) => (
                <div key={s.k} className="card" style={{ padding: "16px 18px", borderLeft: "4px solid var(--gold)" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "1.3px", textTransform: "uppercase", color: "var(--mut)" }}>{s.k}</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 25, fontWeight: 700, color: "var(--ink)", marginTop: 5 }}>
                    <AnimatedNumber value={s.v} format={s.fmt} />
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>

        {/* Smart World at a glance — full-company summary */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 13, marginBottom: 26 }}>
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "1.3px", textTransform: "uppercase", color: "var(--mut)" }}>Monthly sales — ₹ Cr</div>
            <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 2 }}>last 12 months of bookings, latest in gold</div>
            <TrendChart months={trend} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
            {glance.map((g, i) => (
              <motion.div key={g.k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 + i * 0.07, duration: 0.32 }}>
                <NavLink to={g.path} style={{ textDecoration: "none" }}>
                  <div className="card" style={{ padding: "14px 16px", height: "100%", borderTop: `3px solid ${g.col}`, cursor: "pointer" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.1px", textTransform: "uppercase", color: "var(--mut)" }}>{g.k}</div>
                    <div style={{ fontFamily: "Georgia,serif", fontSize: 23, fontWeight: 700, color: g.col, marginTop: 5 }}>{g.v}</div>
                    <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 3, lineHeight: 1.4 }}>{g.sub}</div>
                  </div>
                </NavLink>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Module cards */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--mut)", marginBottom: 10 }}>
          Jump into
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 13 }}>
          {visibleModules.map((m, i) => {
            const Icon = Icons[m.icon] as React.ComponentType<{ size?: number; strokeWidth?: number }>;
            return (
              <motion.div key={m.path} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04, duration: 0.34, ease: [0.22, 1, 0.36, 1] }}>
                <NavLink to={m.path} style={{ textDecoration: "none" }}>
                  <div className="card" style={{ padding: "17px 18px", display: "flex", gap: 13, alignItems: "flex-start", cursor: "pointer", height: "100%" }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(30,49,99,.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#1E3163", flexShrink: 0 }}>
                      <Icon size={20} strokeWidth={2} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>{m.label}</div>
                      <div style={{ fontSize: 12, color: "var(--mut)", marginTop: 3, lineHeight: 1.45 }}>{m.desc}</div>
                    </div>
                    <span style={{ marginLeft: "auto", color: "var(--gold)", fontSize: 15, alignSelf: "center" }}>›</span>
                  </div>
                </NavLink>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
