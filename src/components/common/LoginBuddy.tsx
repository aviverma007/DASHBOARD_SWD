import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export type BuddyMode = "idle" | "typing" | "success" | "error";

interface LoginBuddyProps {
  mode: BuddyMode;
  /** 0..1 — caret position along the current line; while typing his
   * gaze sweeps left → right across the field as words appear. */
  typingProgress: number;
}

/** Human salesperson bust for the login page.
 *  idle    → head + eyes turn to follow the cursor (3-layer parallax)
 *  typing  → stops cursor-following, looks DOWN at the field and reads
 *            left→right with the caret; calm professional smile
 *  success → thumbs-up pops, happy squint, big smile
 *  error   → thumbs-down, worried brows, frown */
export function LoginBuddy({ mode, typingProgress }: LoginBuddyProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Click him and he greets you with a speech bubble for a moment
  const [speaking, setSpeaking] = useState(false);
  const speakTimer = useRef<number | null>(null);
  function greet() {
    setSpeaking(true);
    if (speakTimer.current !== null) window.clearTimeout(speakTimer.current);
    speakTimer.current = window.setTimeout(() => setSpeaking(false), 2600);
  }
  useEffect(() => () => { if (speakTimer.current !== null) window.clearTimeout(speakTimer.current); }, []);

  const dirX = useMotionValue(0);
  const dirY = useMotionValue(0);
  const sx = useSpring(dirX, { stiffness: 200, damping: 21 });
  const sy = useSpring(dirY, { stiffness: 200, damping: 21 });

  // FRONT-FACING: the face never slides sideways. Gaze lives in the
  // pupils, with only a gentle head tilt/lean for life.
  const headX = useTransform(sx, (v) => v * 2.5);
  const headY = useTransform(sy, (v) => v * 1.5);
  const headRot = useTransform(sx, (v) => v * 3.5);
  const pupilX = useTransform(sx, (v) => v * 4.2);
  const pupilY = useTransform(sy, (v) => v * 3);

  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Cursor tracking — only while idle
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (modeRef.current !== "idle") return;
      const el = boxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      dirX.set(Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2))));
      dirY.set(Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2))));
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [dirX, dirY]);

  // Mode-driven gaze: typing = down + sweeping with the caret;
  // success/error = straight ahead at the person.
  useEffect(() => {
    if (mode === "typing") {
      dirX.set((typingProgress * 2 - 1) * 0.6); // left → right with the caret
      dirY.set(0.9);                            // down at the field
    } else if (mode === "success" || mode === "error") {
      dirX.set(0);
      dirY.set(0.15);
    }
  }, [mode, typingProgress, dirX, dirY]);

  const SKIN = "#EDBE93", SKIN_DARK = "#D9A87C", HAIR = "#2B2118", NAVY = "#1E3163", GOLD = "#B8893C";

  const happyEyes = mode === "success" || (speaking && mode !== "error");
  const mouthD =
    mode === "success" || (speaking && mode !== "error") ? "M63 76 Q75 90 87 76 Q75 83 63 76 Z"
    : mode === "error" ? "M65 83 Q75 76 85 83 Q75 79.5 65 83 Z"
    : mode === "typing" ? "M65 78 Q75 83 85 78 Q75 80.5 65 78 Z"
    : "M67 78 Q75 82 83 78 Q75 80.3 67 78 Z";
  const browL =
    mode === "error" ? "M56 44 Q64 46 71 49" : "M56 46 Q64 42 71 46";
  const browR =
    mode === "error" ? "M79 49 Q86 46 94 44" : "M79 46 Q86 42 97 46";

  return (
    <div
      ref={boxRef}
      onClick={greet}
      title="Say hi"
      style={{ width: 170, height: 158, margin: "0 auto 8px", position: "relative", cursor: "pointer", userSelect: "none" }}
    >
      {/* Speech bubble */}
      <AnimatePresence>
        {speaking && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 8, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.9, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
            style={{
              position: "absolute",
              bottom: "100%",
              left: "50%",
              x: "-50%",
              marginBottom: 6,
              background: "#fff",
              color: "#1E3163",
              fontWeight: 700,
              fontSize: 14,
              whiteSpace: "nowrap",
              padding: "9px 16px",
              borderRadius: 12,
              boxShadow: "0 8px 26px rgba(0,0,0,.3)",
              zIndex: 6,
            }}
          >
            Welcome to Smart World! 👋
            {/* Bubble tail */}
            <span style={{ position: "absolute", top: "100%", left: "50%", marginLeft: -7, width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "8px solid #fff" }} />
          </motion.div>
        )}
      </AnimatePresence>
      <svg viewBox="0 0 170 158" width="170" height="158" style={{ display: "block", overflow: "visible" }}>
        {/* ── Shoulders / blazer ── */}
        <path d="M30 158 C32 128 52 116 70 112 L100 112 C118 116 138 128 140 158 Z" fill={NAVY} />
        <path d="M70 112 L85 140 L100 112 L94 110 L76 110 Z" fill="#fff" />
        <path d="M70 112 L80 130 L68 124 Z" fill="#16264F" />
        <path d="M100 112 L90 130 L102 124 Z" fill="#16264F" />
        <path d="M85 114 L80 120 L85 138 L90 120 Z" fill={GOLD} />
        <path d="M76 108 L85 118 L70 113 Z" fill="#f2f2f2" />
        <path d="M94 108 L85 118 L100 113 Z" fill="#f2f2f2" />
        <rect x="76" y="96" width="18" height="16" rx="6" fill={SKIN_DARK} />

        {/* ── Thumbs up / down hand (pops on verdicts) ── */}
        <motion.g
          initial={false}
          animate={{ opacity: mode === "success" || mode === "error" ? 1 : 0, y: mode === "success" || mode === "error" ? 0 : 26 }}
          transition={{ type: "spring", stiffness: 320, damping: 20 }}
        >
          {/* Sleeve */}
          <path d="M118 148 L134 112 L148 118 L134 152 Z" fill={NAVY} />
          <path d="M132 116 L147 122 L144 129 L129 123 Z" fill="#fff" />
          {/* Fist + thumb — rotates 180° for thumbs-down */}
          <motion.g
            initial={false}
            animate={{ rotate: mode === "error" ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            style={{ originX: "142px", originY: "104px" }}
          >
            <rect x="132" y="94" width="20" height="19" rx="6" fill={SKIN} />
            <rect x="134.5" y="97" width="15" height="2.6" rx="1.3" fill={SKIN_DARK} opacity="0.55" />
            <rect x="134.5" y="102" width="15" height="2.6" rx="1.3" fill={SKIN_DARK} opacity="0.55" />
            <rect x="134.5" y="107" width="15" height="2.6" rx="1.3" fill={SKIN_DARK} opacity="0.55" />
            <rect x="137" y="74" width="8.5" height="24" rx="4.2" fill={SKIN} />
          </motion.g>
        </motion.g>

        {/* ── Head group ── */}
        <motion.g style={{ x: headX, y: headY, rotate: headRot, originX: "85px", originY: "70px" }}>
          <ellipse cx="59" cy="62" rx="5" ry="7.5" fill={SKIN} />
          <ellipse cx="111" cy="62" rx="5" ry="7.5" fill={SKIN} />
          <path d="M60 52 C60 30 73 20 85 20 C97 20 110 30 110 52 C110 74 102 94 85 96 C68 94 60 74 60 52 Z" fill={SKIN} />
          <path d="M58 56 C56 26 70 14 85 14 C100 14 114 26 112 56 C112 44 106 30 98 30 L72 30 C64 30 58 44 58 56 Z" fill={HAIR} />

          {/* ── Face features — fixed to the skull, front-facing ── */}
          <g>
            <path d="M68 32 C74 24 96 24 102 32 C94 28 76 28 68 32 Z" fill={HAIR} />

            <motion.path fill="none" stroke={HAIR} strokeWidth="3" strokeLinecap="round"
              animate={{ d: browL, y: happyEyes ? -2.5 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} />
            <motion.path fill="none" stroke={HAIR} strokeWidth="3" strokeLinecap="round"
              animate={{ d: browR, y: happyEyes ? -2.5 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} />

            <motion.g animate={{ scaleY: happyEyes ? 0.5 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} style={{ originX: "85px", originY: "55px" }}>
              <ellipse cx="74" cy="55" rx="7.5" ry="6.5" fill="#fff" stroke={HAIR} strokeWidth="1.6" />
              <ellipse cx="97" cy="55" rx="7.5" ry="6.5" fill="#fff" stroke={HAIR} strokeWidth="1.6" />
              <motion.circle cx="74" cy="55" r="3.4" fill={NAVY} style={{ x: pupilX, y: pupilY }} />
              <motion.circle cx="97" cy="55" r="3.4" fill={NAVY} style={{ x: pupilX, y: pupilY }} />
            </motion.g>

            <path d="M85 60 L83 69 Q85 71.5 87 69 Z" fill={SKIN_DARK} />

            <motion.ellipse cx="67" cy="68" rx="5" ry="3.4" fill="#E8A0A0" animate={{ opacity: happyEyes ? 0.7 : 0 }} transition={{ duration: 0.25 }} />
            <motion.ellipse cx="103" cy="68" rx="5" ry="3.4" fill="#E8A0A0" animate={{ opacity: happyEyes ? 0.7 : 0 }} transition={{ duration: 0.25 }} />

            <motion.path
              fill="#8C3B2E"
              animate={{ d: mouthD }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            />
          </g>
        </motion.g>
      </svg>
    </div>
  );
}
