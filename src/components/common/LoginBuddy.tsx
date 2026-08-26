import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface LoginBuddyProps {
  /** True while either credential field is focused — flips the face
   * from professional-attentive to a warm smile. */
  happy: boolean;
}

/** A human salesperson bust (navy blazer, gold tie) for the login
 * page. The head genuinely TURNS toward the cursor: the whole head
 * rotates and shifts, while the facial features (brows/eyes/nose/
 * mouth) parallax further across the head and the pupils travel
 * furthest — three layers of movement that read as a 3-D head turn,
 * not just moving eyes. Smiles while the person types. Pure SVG. */
export function LoginBuddy({ happy }: LoginBuddyProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  const dirX = useMotionValue(0);
  const dirY = useMotionValue(0);
  const sx = useSpring(dirX, { stiffness: 200, damping: 21 });
  const sy = useSpring(dirY, { stiffness: 200, damping: 21 });

  // Layered "turn": head < features < pupils
  const headX = useTransform(sx, (v) => v * 4);
  const headY = useTransform(sy, (v) => v * 2.5);
  const headRot = useTransform(sx, (v) => v * 6);
  const faceX = useTransform(sx, (v) => v * 7);
  const faceY = useTransform(sy, (v) => v * 4.5);
  const fringeX = useTransform(sx, (v) => v * 2.5);
  const pupilX = useTransform(sx, (v) => v * 3.2);
  const pupilY = useTransform(sy, (v) => v * 2.4);

  useEffect(() => {
    function onMove(e: MouseEvent) {
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

  const SKIN = "#EDBE93", SKIN_DARK = "#D9A87C", HAIR = "#2B2118", NAVY = "#1E3163", GOLD = "#B8893C";

  return (
    <div ref={boxRef} style={{ width: 150, height: 158, margin: "0 auto 8px" }}>
      <svg viewBox="0 0 150 158" width="150" height="158" style={{ display: "block", overflow: "visible" }}>
        {/* ── Shoulders / blazer (static base) ── */}
        <path d="M20 158 C22 128 42 116 60 112 L90 112 C108 116 128 128 130 158 Z" fill={NAVY} />
        {/* Shirt */}
        <path d="M60 112 L75 140 L90 112 L84 110 L66 110 Z" fill="#fff" />
        {/* Lapels */}
        <path d="M60 112 L70 130 L58 124 Z" fill="#16264F" />
        <path d="M90 112 L80 130 L92 124 Z" fill="#16264F" />
        {/* Tie */}
        <path d="M75 114 L70 120 L75 138 L80 120 Z" fill={GOLD} />
        {/* Collar */}
        <path d="M66 108 L75 118 L60 113 Z" fill="#f2f2f2" />
        <path d="M84 108 L75 118 L90 113 Z" fill="#f2f2f2" />
        {/* Neck */}
        <rect x="66" y="96" width="18" height="16" rx="6" fill={SKIN_DARK} />

        {/* ── Head group: rotates + shifts toward the cursor ── */}
        <motion.g style={{ x: headX, y: headY, rotate: headRot, originX: "75px", originY: "70px" }}>
          {/* Ears (fixed to the skull — features slide past them) */}
          <ellipse cx="47" cy="64" rx="6" ry="9" fill={SKIN} />
          <ellipse cx="103" cy="64" rx="6" ry="9" fill={SKIN} />
          {/* Skull / face shape — human oval with a jaw */}
          <path d="M50 52 C50 30 63 20 75 20 C87 20 100 30 100 52 C100 74 92 94 75 96 C58 94 50 74 50 52 Z" fill={SKIN} />
          {/* Back/side hair */}
          <path d="M48 56 C46 26 60 14 75 14 C90 14 104 26 102 56 C102 44 96 30 88 30 L62 30 C54 30 48 44 48 56 Z" fill={HAIR} />

          {/* ── Face features: parallax further = the "turn" ── */}
          <motion.g style={{ x: faceX, y: faceY }}>
            {/* Fringe follows features a little, for depth */}
            <motion.path d="M58 32 C64 24 86 24 92 32 C84 28 66 28 58 32 Z" fill={HAIR} style={{ x: fringeX }} />

            {/* Brows */}
            <motion.path d="M56 46 Q64 42 71 46" fill="none" stroke={HAIR} strokeWidth="3" strokeLinecap="round"
              animate={{ y: happy ? -2.5 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} />
            <motion.path d="M79 46 Q86 42 94 46" fill="none" stroke={HAIR} strokeWidth="3" strokeLinecap="round"
              animate={{ y: happy ? -2.5 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} />

            {/* Eyes */}
            <motion.g animate={{ scaleY: happy ? 0.5 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} style={{ originX: "75px", originY: "55px" }}>
              <ellipse cx="64" cy="55" rx="7.5" ry="6.5" fill="#fff" stroke={HAIR} strokeWidth="1.6" />
              <ellipse cx="87" cy="55" rx="7.5" ry="6.5" fill="#fff" stroke={HAIR} strokeWidth="1.6" />
              <motion.circle cx="64" cy="55" r="3.4" fill={NAVY} style={{ x: pupilX, y: pupilY }} />
              <motion.circle cx="87" cy="55" r="3.4" fill={NAVY} style={{ x: pupilX, y: pupilY }} />
            </motion.g>

            {/* Nose */}
            <path d="M75 58 L72 70 Q75 73 78 70 Z" fill={SKIN_DARK} />

            {/* Blush while typing */}
            <motion.ellipse cx="57" cy="70" rx="5" ry="3.4" fill="#E8A0A0" animate={{ opacity: happy ? 0.7 : 0 }} transition={{ duration: 0.25 }} />
            <motion.ellipse cx="93" cy="70" rx="5" ry="3.4" fill="#E8A0A0" animate={{ opacity: happy ? 0.7 : 0 }} transition={{ duration: 0.25 }} />

            {/* Mouth: composed neutral ↔ warm open smile */}
            <motion.path
              fill="#8C3B2E"
              animate={{
                d: happy
                  ? "M61 78 Q75 94 89 78 Q75 86 61 78 Z"
                  : "M66 80 Q75 84 84 80 Q75 82.5 66 80 Z",
              }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            />
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
}
