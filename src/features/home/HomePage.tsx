import { NavLink } from "react-router-dom";
import * as Icons from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "../../store/authStore";
import { INV, PDRN, fCr } from "../../utils/pdrnLogic";
import { DATA_AS_ON } from "../../config/dataInfo";
import { AnimatedNumber } from "../../components/common/AnimatedNumber";
import AnimatedGradient from "../../components/ui/animated-gradient";
import "../../components/inventory/smartworldInventory.css";

/** Landing page — greets the user, shows the company snapshot, and
 * offers one-click cards into every module. Reached from the sidebar
 * Home tab or by clicking the Smart World logo in the header. */

const MODULES: { icon: keyof typeof Icons; label: string; desc: string; path: string }[] = [
  { icon: "LayoutDashboard", label: "Overview",        desc: "Sold vs available, TSV, rates and drill-downs per project", path: "/overview" },
  { icon: "Target",          label: "Target vs Actual", desc: "AOP plan vs achieved — units, TSV, area and rate pace",  path: "/target" },
  { icon: "Handshake",       label: "Channel Partners", desc: "CP rankings, rate ranges, trends and cancellations",     path: "/channel-partners" },
  { icon: "Filter",          label: "Gallery Footfall", desc: "Customer footfall and CP gallery visits",                path: "/gallery-footfall" },
  { icon: "Zap",             label: "Digital Leads",    desc: "Digital enquiries, channels and funnels",                path: "/digital-leads" },
  { icon: "Building2",       label: "Inventory",        desc: "Stock by project, tower, floor and unit status",         path: "/inventory" },
  { icon: "Building",        label: "Projects",         desc: "Project cards with mix, absorption and site plans",      path: "/projects" },
  { icon: "FileText",        label: "Reports",          desc: "Excel exports of every dataset",                         path: "/reports" },
  { icon: "NotebookPen",     label: "Notes",            desc: "Your personal scratchpad, saved in this browser",        path: "/notes" },
  { icon: "BookOpen",        label: "Guide",            desc: "Every formula, colour and shortcut explained",           path: "/guide" },
];

export function HomePage() {
  const userLabel = useAuthStore((s) => s.userLabel);

  // Honest company snapshot straight from the datasets
  const totalUnits = INV.U.length;
  const sold = PDRN.R.length;
  const tsvCr = PDRN.R.reduce((s, r) => s + r.tsv, 0) / 1e7;
  const projects = INV.P.length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const KPIS = [
    { k: "Projects", v: projects, fmt: (n: number) => Math.round(n).toString() },
    { k: "Total units", v: totalUnits, fmt: (n: number) => Math.round(n).toLocaleString("en-IN") },
    { k: "Units sold", v: sold, fmt: (n: number) => Math.round(n).toLocaleString("en-IN") },
    { k: "Sales value", v: tsvCr, fmt: (n: number) => fCr(n * 1e7) },
  ];

  return (
    <div className="sw-inv" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 22px 44px" }}>
        {/* Hero: greeting + snapshot on a live navy/gold gradient */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: "relative", borderRadius: 18, overflow: "hidden", padding: "26px 26px 24px", marginBottom: 26, background: "#1E3163" }}
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

        {/* Module cards */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--mut)", marginBottom: 10 }}>
          Jump into
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 13 }}>
          {MODULES.map((m, i) => {
            const Icon = Icons[m.icon] as React.ComponentType<{ size?: number; strokeWidth?: number }>;
            return (
              <motion.div key={m.path} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 + i * 0.045, duration: 0.34, ease: [0.22, 1, 0.36, 1] }}>
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
