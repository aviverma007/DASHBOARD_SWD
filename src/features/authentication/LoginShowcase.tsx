import { motion } from "framer-motion";

/** Big white showcase card for the right half of the login screen:
 * dashboard-flavoured visuals (donut, bars, trend line, KPI chips)
 * gently floating around a headline — deliberately number-free so
 * nothing confidential shows pre-login. Hidden on small screens via
 * the .swd-login-visual CSS in LoginPage. */

/** Slow infinite bob; phase/duration vary per piece so the motion
 * never syncs into a mechanical pattern. */
const float = (dy: number, dur: number, delay = 0, rot = 0) => ({
  animate: { y: [0, -dy, 0], rotate: rot ? [0, rot, 0] : undefined },
  transition: { duration: dur, delay, repeat: Infinity, ease: "easeInOut" as const },
});

const cardShadow = "0 6px 18px rgba(20,33,61,.10), 0 2px 6px rgba(20,33,61,.06)";

function DonutChart() {
  // Sold / Available / Blocked share — green, light yellow, red
  const C = 2 * Math.PI * 34;
  return (
    <svg width="120" height="120" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r="34" fill="none" stroke="#f0ede5" strokeWidth="14" />
      <circle cx="48" cy="48" r="34" fill="none" stroke="#1a7a4a" strokeWidth="14"
        strokeDasharray={`${C * 0.61} ${C}`} strokeLinecap="round" transform="rotate(-90 48 48)" />
      <circle cx="48" cy="48" r="34" fill="none" stroke="#e3b93c" strokeWidth="14"
        strokeDasharray={`${C * 0.29} ${C}`} strokeDashoffset={-C * 0.63} strokeLinecap="round" transform="rotate(-90 48 48)" />
      <circle cx="48" cy="48" r="34" fill="none" stroke="#d64545" strokeWidth="14"
        strokeDasharray={`${C * 0.05} ${C}`} strokeDashoffset={-C * 0.94} strokeLinecap="round" transform="rotate(-90 48 48)" />

    </svg>
  );
}

function MiniBars() {
  const bars = [34, 52, 40, 66, 48, 78];
  return (
    <svg width="140" height="84" viewBox="0 0 140 84">
      {bars.map((h, i) => (
        <g key={i}>
          <rect x={8 + i * 22} y={70 - h} width="13" height={h} rx="3" fill={i === 5 ? "#1a7a4a" : "#1E3163"} opacity={i === 5 ? 1 : 0.82 - (5 - i) * 0.09} />
        </g>
      ))}
      <line x1="4" y1="70.5" x2="136" y2="70.5" stroke="#e4e0d6" strokeWidth="1.5" />
    </svg>
  );
}

function TrendLine() {
  return (
    <svg width="170" height="76" viewBox="0 0 170 76">
      <path d="M6 58 C30 52 40 40 62 44 C86 48 96 26 118 22 C136 19 152 14 164 10" fill="none" stroke="#1a7a4a" strokeWidth="3" strokeLinecap="round" />
      <path d="M6 58 C30 52 40 40 62 44 C86 48 96 26 118 22 C136 19 152 14 164 10 L164 72 L6 72 Z" fill="rgba(26,122,74,.10)" stroke="none" />
      {[[6, 58], [62, 44], [118, 22], [164, 10]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.4" fill="#1a7a4a" stroke="#fff" strokeWidth="1.6" />
      ))}
    </svg>
  );
}

export function LoginShowcase() {
  return (
    <div
      className="swd-login-visual"
      style={{
        // Full-bleed right panel: top of the viewport to the bottom,
        // flush against the right edge; only the left corners round.
        width: "min(46vw, 780px)",
        minWidth: 480,
        alignSelf: "stretch",
        minHeight: "100vh",
        background: "#fff",
        borderRadius: "32px 0 0 32px",
        // White glow on the LEFT edge, with a soft blue drop for depth
        boxShadow: "-28px 0 70px rgba(255,255,255,.85), -10px 0 30px rgba(30,64,120,.16), 0 24px 70px rgba(30,64,120,.22)",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Soft backdrop tint so floating white tiles read against it */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #fdfcf9 0%, #f4f1ea 100%)" }} />

      {/* ── Floating visuals ── */}
      <motion.div {...float(14, 5.6, 0, 1.5)} style={{ position: "absolute", top: "7%", left: 42, background: "#fff", borderRadius: 16, padding: "12px 14px", boxShadow: cardShadow }}>
        <DonutChart />
        <div style={{ fontSize: 10, color: "#8a93a6", textAlign: "center", letterSpacing: "1px" }}>INVENTORY MIX</div>
      </motion.div>

      <motion.div {...float(18, 6.8, 0.9, -1.5)} style={{ position: "absolute", top: "10%", right: 48, background: "#fff", borderRadius: 16, padding: "14px 14px 8px", boxShadow: cardShadow }}>
        <div style={{ fontSize: 10, color: "#8a93a6", letterSpacing: "1px", marginBottom: 4 }}>MONTHLY SALES</div>
        <MiniBars />
      </motion.div>

      <motion.div {...float(12, 6.1, 1.6)} style={{ position: "absolute", top: "46%", left: 52, background: "#fff", borderRadius: 16, padding: "14px 14px 8px", boxShadow: cardShadow }}>
        <div style={{ fontSize: 10, color: "#8a93a6", letterSpacing: "1px", marginBottom: 2 }}>RATE TREND ₹/SQFT</div>
        <TrendLine />
      </motion.div>

      {/* KPI chips */}
      <motion.div {...float(10, 5.2, 0.4)} style={{ position: "absolute", top: "33%", left: "46%", background: "#14213d", color: "#fff", borderRadius: 999, padding: "10px 18px", fontSize: 13.5, fontWeight: 600, boxShadow: cardShadow, whiteSpace: "nowrap" }}>
        Sales <span style={{ opacity: 0.75, fontWeight: 400 }}>at a glance</span>
      </motion.div>
      <motion.div {...float(13, 7.2, 2.2)} style={{ position: "absolute", top: "52%", right: 60, background: "#fff", border: "1.5px solid #e4e0d6", borderRadius: 999, padding: "10px 18px", fontSize: 13.5, fontWeight: 700, color: "#1a7a4a", boxShadow: cardShadow, whiteSpace: "nowrap" }}>
        Value <span style={{ color: "#8a93a6", fontWeight: 400 }}>&amp; rate insights</span>
      </motion.div>
      <motion.div {...float(9, 6.4, 3.1)} style={{ position: "absolute", top: "24%", left: "38%", background: "#fff", border: "1.5px solid #e4e0d6", borderRadius: 999, padding: "8px 15px", fontSize: 12.5, fontWeight: 700, color: "#B8893C", boxShadow: cardShadow, whiteSpace: "nowrap" }}>
        Projects · Towers · Units
      </motion.div>

      {/* ── Headline (reference-style) ── */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "7%", textAlign: "center", padding: "0 48px" }}>
        <div style={{ fontFamily: "Georgia,serif", fontSize: 30, fontWeight: 700, color: "#14213d", lineHeight: 1.22 }}>
          Real-estate analytics
        </div>
        <div style={{ fontSize: 19, color: "#4a5568", marginTop: 4, lineHeight: 1.35 }}>
          that take your sales &amp; inventory to the{" "}
          <span style={{ color: "#B8893C", fontWeight: 800, fontFamily: "Georgia,serif" }}>Next level.</span>
        </div>
      </div>
    </div>
  );
}
