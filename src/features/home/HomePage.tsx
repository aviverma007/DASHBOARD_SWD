import { NavLink } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight, Sparkles, PieChart, ListChecks, Building2, LineChart, Megaphone,
  Boxes, Headset, Wallet, NotebookPen, type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { canAccess } from "../../config/users";
import { DATA_AS_ON } from "../../config/dataInfo";
import { IsoTower, DuskSkyline } from "./HomeArt";
import "./home.css";

/** Home — a launch page, not a report: where everything lives and a quick way in.
 * Deliberately shows no figures; every number lives on its module page. */

type Mod = { label: string; path: string };
interface Group { title: string; blurb: string; icon: LucideIcon; art: string; mods: Mod[] }

const GROUPS: Group[] = [
  {
    title: "Sales", icon: LineChart,
    blurb: "Bookings, targets against actuals and the full business overview.",
    art: "radial-gradient(80% 90% at 15% 110%, #ff8ec0 0%, transparent 60%), radial-gradient(90% 80% at 100% 0%, #8b6cff 0%, transparent 65%), #2a1f4f",
    mods: [
      { label: "Business Overview", path: "/overview" }, { label: "Bookings", path: "/bookings" },
      { label: "Target vs Actual", path: "/target" }, { label: "EOI / Advance", path: "/eoi" }, { label: "Reports", path: "/reports" },
    ],
  },
  {
    title: "Leads & partners", icon: Megaphone,
    blurb: "Where enquiries come from and how they move to a site visit.",
    art: "radial-gradient(90% 90% at 0% 0%, #ff8ec0 0%, transparent 60%), radial-gradient(80% 90% at 100% 100%, #e9a55b 0%, transparent 60%), #3b1d3a",
    mods: [
      { label: "Digital Leads", path: "/digital-leads" }, { label: "Gallery Footfall", path: "/gallery-footfall" },
      { label: "Channel Partners", path: "/channel-partners" },
    ],
  },
  {
    title: "Inventory & projects", icon: Boxes,
    blurb: "Stock by tower and floor, stack plans and construction progress.",
    art: "radial-gradient(90% 90% at 100% 100%, #5fd0e6 0%, transparent 55%), radial-gradient(80% 80% at 0% 0%, #6d5cff 0%, transparent 60%), #17224a",
    mods: [
      { label: "Inventory", path: "/inventory" }, { label: "Projects", path: "/projects" }, { label: "Project Tracker", path: "/project-tracker" },
    ],
  },
  {
    title: "Customers", icon: Headset,
    blurb: "Service cases, home loans and collections for every booking.",
    art: "radial-gradient(90% 90% at 0% 100%, #46d3b0 0%, transparent 55%), radial-gradient(80% 80% at 100% 0%, #8b6cff 0%, transparent 60%), #13303a",
    mods: [
      { label: "Case Management", path: "/case-management" }, { label: "Loan Details", path: "/loan-details" },
      { label: "Collection", path: "/collections" },
    ],
  },
  {
    title: "Procurement & cost", icon: Wallet,
    blurb: "Budgets, purchase orders and what is still to be delivered.",
    art: "radial-gradient(90% 90% at 100% 0%, #e9a55b 0%, transparent 55%), radial-gradient(80% 90% at 0% 100%, #c27cff 0%, transparent 60%), #3a2418",
    mods: [{ label: "Cost", path: "/cost" }, { label: "PR to PO", path: "/pr-to-po" }],
  },
  {
    title: "Workspace", icon: NotebookPen,
    blurb: "Your notes and the guide to how every figure is worked out.",
    art: "radial-gradient(90% 90% at 50% 120%, #cdbdff 0%, transparent 60%), radial-gradient(70% 70% at 100% 0%, #6d5cff 0%, transparent 60%), #1d1a2e",
    mods: [{ label: "Notes", path: "/notes" }, { label: "Guide", path: "/guide" }],
  },
];

const PROJECTS = ["Sky Arc", "The Edition", "One DXP", "Trump Residences", "Nature's Court", "Le Courtyard", "Suites"];

/* decorative shapes only — no values */
const BAR_SHAPE = [38, 62, 46, 84, 58, 96, 70, 52, 88, 64, 100, 76];
const PAIR_SHAPE = [[58, 34], [80, 52], [44, 30], [92, 70], [66, 40], [74, 58], [50, 28], [86, 64], [62, 46], [96, 72]];

/** "Open Ask SmartDB" = the launcher's Ctrl+K shortcut. */
const openAssistant = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));

export function HomePage() {
  const userLabel = useAuthStore((s) => s.userLabel);
  const access = useAuthStore((s) => s.access);
  const reduce = useReducedMotion();
  const groups = GROUPS.map(g => ({ ...g, mods: g.mods.filter(m => canAccess(access, m.path)) })).filter(g => g.mods.length);
  const primary = groups.flatMap(g => g.mods)[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  // one orchestrated load: hero copy, then the collage
  const rise = (i: number) => reduce ? {} : {
    initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay: 0.08 * i, ease: [0.2, 0.7, 0.2, 1] as const },
  };

  return (
    <div className="hm">
      <div className="hm-wrap">
        {/* ── hero ── */}
        <section className="hm-hero">
          <div className="hm-glow" aria-hidden />
          <div>
            <motion.p className="hm-hello" {...rise(0)}>{greeting}{userLabel ? `, ${userLabel}` : ""}</motion.p>
            <motion.h1 className="hm-h1" {...rise(1)}>Every part of Smart World, in one place.</motion.h1>
            <motion.p className="hm-lead" {...rise(2)}>
              Sales, leads, inventory, customer care, procurement and cost, side by side.
              Open a module to see its figures and drill down to the record behind each one.
            </motion.p>
            <motion.div className="hm-ctas" {...rise(3)}>
              {primary && (
                <NavLink to={primary.path} className="hm-btn hm-btn--solid">Open {primary.label.toLowerCase()} <ArrowUpRight /></NavLink>
              )}
              <button type="button" className="hm-btn hm-btn--ghost" onClick={openAssistant}><Sparkles /> Ask SmartDB</button>
            </motion.div>
            <motion.div className="hm-asof" {...rise(4)}>Data refreshed on {DATA_AS_ON}</motion.div>
          </div>

          <motion.div className="hm-collage" aria-hidden {...rise(3)}>
            <div className="hm-chips">
              <span className="hm-chip"><Sparkles /></span>
              <span className="hm-chip"><PieChart /></span>
              <span className="hm-chip"><ListChecks /></span>
            </div>
            <div className="hm-card hm-lavcard">
              <h3>Unit by unit</h3>
              <div className="hm-art"><IsoTower /></div>
              <p>Every tower, floor and unit across the portfolio</p>
            </div>
            <div className="hm-card hm-photo">
              <DuskSkyline />
              <span>Gurugram and Noida</span>
            </div>
            <div className="hm-card hm-darkcard">
              <div>
                <h3>Live reports</h3>
                <p>PR to PO, collections and digital leads update through the day.</p>
              </div>
              <div className="hm-bars">
                {BAR_SHAPE.map((h, i) => (
                  <motion.span key={i} className="hm-bar"
                    style={{ height: `${h}%`, background: i % 3 === 2 ? "#ff8ec0" : i % 2 ? "#cdbdff" : "#8b6cff" }}
                    initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: 1 }}
                    transition={{ duration: 0.6, delay: 0.6 + i * 0.04, ease: "easeOut" }} />
                ))}
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── projects strip ── */}
        <div className="hm-strip">
          {PROJECTS.map(p => <span key={p}><Building2 aria-hidden />{p}</span>)}
        </div>

        {/* ── feature row ── */}
        <section className="hm-feature">
          <div>
            <h2 className="hm-h2">See the whole picture, then drill in</h2>
            <p>
              Every chart opens up. Go from a project to its towers and units, from a channel to the enquiries
              behind it, or from a budget to the purchase orders that used it.
            </p>
            <button type="button" className="hm-btn hm-btn--ghost" onClick={openAssistant}><Sparkles /> Ask a question instead</button>
          </div>
          <div className="hm-stage" aria-hidden>
            <div className="hm-white">
              <h4>Collections</h4>
              <small>received against demand</small>
              <svg viewBox="0 0 220 90" width="100%" height="96" preserveAspectRatio="none" style={{ display: "block", marginTop: 8 }}>
                <defs>
                  <linearGradient id="hmfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#8b6cff" stopOpacity=".28" /><stop offset="1" stopColor="#8b6cff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 62 C22 58 34 30 56 34 S92 64 116 52 S152 18 176 26 S206 44 220 36 L220 90 L0 90 Z" fill="url(#hmfill)" />
                <path d="M0 62 C22 58 34 30 56 34 S92 64 116 52 S152 18 176 26 S206 44 220 36" fill="none" stroke="#5b43d6" strokeWidth="2.4" />
                <circle cx="176" cy="26" r="4.5" fill="#fff" stroke="#5b43d6" strokeWidth="2.4" />
              </svg>
            </div>
            <div className="hm-profile">
              <Headset aria-hidden style={{ width: 26, height: 26, color: "#cdbdff" }} />
              <b>Customer care</b>
              <span>Open cases by age, owner and project</span>
            </div>
            <div className="hm-violet">
              <h4>Lead flow</h4>
              <small>enquiries and qualified leads by month</small>
              <div className="hm-pairs">
                {PAIR_SHAPE.map(([a, b], i) => (
                  <div className="hm-pair" key={i}>
                    <i style={{ height: a * 0.86, background: "#cdbdff" }} />
                    <i style={{ height: b * 0.86, background: "#1b1630" }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── module groups ── */}
        <div className="hm-tiles-head">
          <h2 className="hm-h2">Go straight to your work</h2>
        </div>
        <section className="hm-tiles">
          {groups.map(g => (
            <article className="hm-tile" key={g.title}>
              <div className="hm-tile-art" style={{ background: g.art }} aria-hidden />
              <g.icon className="hm-tile-ic" aria-hidden />
              <h3>{g.title}</h3>
              <p>{g.blurb}</p>
              <nav className="hm-links" aria-label={g.title}>
                {g.mods.map(m => <NavLink key={m.path} to={m.path} className="hm-link">{m.label}</NavLink>)}
              </nav>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
