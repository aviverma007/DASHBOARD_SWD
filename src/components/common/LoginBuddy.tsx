import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface LoginBuddyProps {
  /** True while either credential field is focused/being typed into —
   * flips the face from attentive to a big smile with rosy cheeks. */
  happy: boolean;
}

/** A friendly Smart World mascot for the login page. The whole head
 * tilts and both pupils track the cursor anywhere on the page (spring-
 * smoothed); while the person types, the eyes squint happily, cheeks
 * blush and the mouth morphs into a wide smile. Pure SVG — no assets. */
export function LoginBuddy({ happy }: LoginBuddyProps) {
  const boxRef = useRef<HTMLDivElement>(null);

  // Raw cursor direction from the face centre, normalised to [-1, 1]
  const dirX = useMotionValue(0);
  const dirY = useMotionValue(0);
  const sx = useSpring(dirX, { stiffness: 220, damping: 22 });
  const sy = useSpring(dirY, { stiffness: 220, damping: 22 });

  // Pupils roam inside the eye whites; head tilts a few degrees
  const pupilX = useTransform(sx, (v) => v * 5.5);
  const pupilY = useTransform(sy, (v) => v * 4.5);
  const headRot = useTransform(sx, (v) => v * 7);
  const headX = useTransform(sx, (v) => v * 4);
  const headY = useTransform(sy, (v) => v * 3);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const el = boxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Normalise against the viewport so the gaze sweeps naturally
      dirX.set(Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2))));
      dirY.set(Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2))));
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [dirX, dirY]);

  return (
    <div ref={boxRef} style={{ width: 130, height: 130, margin: "0 auto 10px" }}>
      <motion.svg
        viewBox="0 0 130 130"
        width="130"
        height="130"
        style={{ rotate: headRot, x: headX, y: headY, display: "block" }}
      >
        {/* Head */}
        <circle cx="65" cy="65" r="56" fill="#F5D9A8" stroke="#1E3163" strokeWidth="3.5" />
        {/* Rocket antenna — a nod to the Smart World mark */}
        <path d="M65 4 L59 16 L71 16 Z" fill="#B8893C" />
        <line x1="65" y1="16" x2="65" y2="10" stroke="#B8893C" strokeWidth="3" />

        {/* Eye whites */}
        <motion.g animate={{ scaleY: happy ? 0.55 : 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} style={{ originX: "65px", originY: "52px" }}>
          <circle cx="44" cy="52" r="13" fill="#fff" stroke="#1E3163" strokeWidth="2.5" />
          <circle cx="86" cy="52" r="13" fill="#fff" stroke="#1E3163" strokeWidth="2.5" />
          {/* Pupils — cursor-tracking */}
          <motion.circle cx="44" cy="52" r="5.5" fill="#1E3163" style={{ x: pupilX, y: pupilY }} />
          <motion.circle cx="86" cy="52" r="5.5" fill="#1E3163" style={{ x: pupilX, y: pupilY }} />
        </motion.g>

        {/* Brows lift a touch when happy */}
        <motion.path
          d="M33 36 Q44 30 55 36" fill="none" stroke="#1E3163" strokeWidth="3" strokeLinecap="round"
          animate={{ y: happy ? -3 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}
        />
        <motion.path
          d="M75 36 Q86 30 97 36" fill="none" stroke="#1E3163" strokeWidth="3" strokeLinecap="round"
          animate={{ y: happy ? -3 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}
        />

        {/* Blushing cheeks — only while typing */}
        <motion.circle cx="30" cy="72" r="6.5" fill="#E8A0A0" animate={{ opacity: happy ? 0.85 : 0 }} transition={{ duration: 0.25 }} />
        <motion.circle cx="100" cy="72" r="6.5" fill="#E8A0A0" animate={{ opacity: happy ? 0.85 : 0 }} transition={{ duration: 0.25 }} />

        {/* Mouth: neutral ↔ wide open smile (same command structure so
            the path interpolates smoothly) */}
        <motion.path
          fill="#1E3163"
          animate={{
            d: happy
              ? "M43 82 Q65 108 87 82 Q65 96 43 82 Z"
              : "M52 86 Q65 92 78 86 Q65 90 52 86 Z",
          }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        />
      </motion.svg>
    </div>
  );
}
