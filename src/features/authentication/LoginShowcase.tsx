import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/** Right panel of the login screen: pure white on a white page (no
 * shadow), with ONE full-width visual that FLIPS to a new chart type
 * every second — pie → bars → line → area → horizontal bars — all
 * number-free so nothing confidential shows pre-login. */

const NAVY = "#1E3163", GREEN = "#1a7a4a", YELLOW = "#e3b93c", RED = "#d64545", GOLD = "#B8893C", GRID = "#eceff3";

const VB_W = 560, VB_H = 320;

function PieFull() {
  // Simple 3-slice pie, brand status colours
  const cx = VB_W / 2, cy = 158, r = 128;
  const slice = (a0: number, a1: number, fill: string) => {
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return <path d={`M${cx} ${cy} L${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`} fill={fill} />;
  };
  const t = -Math.PI / 2;
  const a1 = t + 2 * Math.PI * 0.61, a2 = a1 + 2 * Math.PI * 0.29;
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: "block" }}>
      {slice(t, a1, GREEN)}
      {slice(a1, a2, YELLOW)}
      {slice(a2, t + 2 * Math.PI, RED)}
      <circle cx={cx} cy={cy} r={52} fill="#fff" />
    </svg>
  );
}

function BarsFull() {
  const bars = [96, 150, 118, 190, 140, 226, 172, 246];
  const bw = 44, gap = 22, x0 = (VB_W - bars.length * (bw + gap) + gap) / 2;
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: "block" }}>
      {[60, 130, 200].map(y => <line key={y} x1="30" y1={y} x2={VB_W - 30} y2={y} stroke={GRID} strokeWidth="1.5" strokeDasharray="4 5" />)}
      {bars.map((h, i) => (
        <rect key={i} x={x0 + i * (bw + gap)} y={278 - h} width={bw} height={h} rx="7"
          fill={i === bars.length - 1 ? GREEN : NAVY} opacity={i === bars.length - 1 ? 1 : 0.55 + i * 0.055} />
      ))}
      <line x1="30" y1="278.5" x2={VB_W - 30} y2="278.5" stroke="#dfe3ea" strokeWidth="2" />
    </svg>
  );
}

function LineFull() {
  const pts: [number, number][] = [[40, 236], [110, 210], [180, 224], [250, 158], [320, 176], [390, 104], [460, 118], [520, 58]];
  const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: "block" }}>
      {[70, 140, 210].map(y => <line key={y} x1="30" y1={y} x2={VB_W - 30} y2={y} stroke={GRID} strokeWidth="1.5" strokeDasharray="4 5" />)}
      <path d={d} fill="none" stroke={GREEN} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill={GREEN} stroke="#fff" strokeWidth="2.5" />)}
      <line x1="30" y1="278.5" x2={VB_W - 30} y2="278.5" stroke="#dfe3ea" strokeWidth="2" />
    </svg>
  );
}

function AreaFull() {
  const line = "M40 240 C110 218 150 170 220 186 C290 202 330 96 400 88 C450 82 490 66 520 54";
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: "block" }}>
      {[70, 140, 210].map(y => <line key={y} x1="30" y1={y} x2={VB_W - 30} y2={y} stroke={GRID} strokeWidth="1.5" strokeDasharray="4 5" />)}
      <path d={`${line} L520 278 L40 278 Z`} fill="rgba(30,49,99,.14)" />
      <path d={line} fill="none" stroke={NAVY} strokeWidth="5" strokeLinecap="round" />
      <path d="M40 258 C120 244 180 216 250 224 C320 232 380 168 520 148" fill="none" stroke={GOLD} strokeWidth="4.5" strokeLinecap="round" strokeDasharray="1 12" />
      <line x1="30" y1="278.5" x2={VB_W - 30} y2="278.5" stroke="#dfe3ea" strokeWidth="2" />
    </svg>
  );
}

function HBarsFull() {
  const rows = [430, 330, 262, 196, 132];
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: "block" }}>
      {rows.map((w, i) => (
        <g key={i}>
          <rect x="50" y={44 + i * 50} width={VB_W - 100} height="30" rx="8" fill="#f2f4f8" />
          <rect x="50" y={44 + i * 50} width={w} height="30" rx="8" fill={i === 0 ? GREEN : NAVY} opacity={i === 0 ? 1 : 0.85 - i * 0.14} />
        </g>
      ))}
    </svg>
  );
}

const CHARTS: { label: string; C: () => React.ReactElement }[] = [
  { label: "Inventory mix", C: PieFull },
  { label: "Monthly sales", C: BarsFull },
  { label: "Rate trend", C: LineFull },
  { label: "Target vs achieved", C: AreaFull },
  { label: "Top channel partners", C: HBarsFull },
];

export function LoginShowcase() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setIdx(i => (i + 1) % CHARTS.length), 1000);
    return () => window.clearInterval(t);
  }, []);

  const { label, C } = CHARTS[idx];

  return (
    <div
      className="swd-login-visual"
      style={{
        width: "min(46vw, 780px)",
        minWidth: 480,
        alignSelf: "stretch",
        minHeight: "100vh",
        // Blend into the grey page: the panel's left edge fades from
        // the page colour into white so there's no hard seam.
        background: "linear-gradient(90deg, #f2f3f5 0%, #fbfbfc 10%, #ffffff 22%, #ffffff 100%)",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 40px",
      }}
    >
      {/* Full-width flipping chart */}
      <div style={{ width: "100%", perspective: 1400 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformStyle: "preserve-3d", width: "100%" }}
          >
            <C />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Chart-type caption + progress dots */}
      <div style={{ marginTop: 18, textAlign: "center" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: "#8a93a6" }}
          >
            {label}
          </motion.div>
        </AnimatePresence>
        <div style={{ display: "flex", gap: 7, justifyContent: "center", marginTop: 10 }}>
          {CHARTS.map((_, i) => (
            <span key={i} style={{ width: 7, height: 7, borderRadius: 999, background: i === idx ? GOLD : "#e2e6ee", transition: "background 0.25s" }} />
          ))}
        </div>
      </div>

      {/* Headline */}
      <div style={{ textAlign: "center", marginTop: 40, padding: "0 24px" }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 29, fontWeight: 700, color: "#14213d", lineHeight: 1.22 }}>
          Real-estate analytics
        </div>
        <div style={{ fontSize: 18, color: "#4a5568", marginTop: 4, lineHeight: 1.35 }}>
          that take your sales &amp; inventory to the{" "}
          <span style={{ color: GOLD, fontWeight: 800, fontFamily: "Georgia,serif" }}>Next level.</span>
        </div>
      </div>
    </div>
  );
}
