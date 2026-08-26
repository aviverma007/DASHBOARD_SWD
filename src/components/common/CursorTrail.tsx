import { useEffect, useRef } from "react";

interface TrailPoint { x: number; y: number; t: number }

const TRAIL_LIFE_MS = 550;   // how long a stroke stays visible
const TRAIL_WIDTH = 16;      // highlighter thickness
const TRAIL_COLOR = "125, 211, 252"; // light blue (sky-300)

/** Full-screen canvas that paints a fading light-blue highlighter
 * stroke along the cursor path. pointer-events: none, so it never
 * interferes with the form underneath. */
export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const points = useRef<TrailPoint[]>([]);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function onMove(e: MouseEvent) {
      points.current.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    }
    window.addEventListener("mousemove", onMove, { passive: true });

    function draw() {
      raf.current = requestAnimationFrame(draw);
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = performance.now();
      points.current = points.current.filter((p) => now - p.t < TRAIL_LIFE_MS);
      const pts = points.current;
      if (pts.length < 2) return;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // Draw newest-last segments with age-based fade — a highlighter
      // stroke that melts away behind the cursor.
      for (let i = 1; i < pts.length; i++) {
        const age = (now - pts[i].t) / TRAIL_LIFE_MS; // 0 fresh → 1 gone
        const alpha = 0.38 * (1 - age);
        ctx.strokeStyle = `rgba(${TRAIL_COLOR}, ${alpha})`;
        ctx.lineWidth = TRAIL_WIDTH * (1 - age * 0.55);
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
    raf.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 5 }}
      aria-hidden="true"
    />
  );
}
