import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { TONE, type TvDept, type TvKpi } from "./types";
import { VisualView, useCountUp } from "./Visuals";

type Scene = { kind: "intro" } | { kind: "overview" } | { kind: "wheel" } | { kind: "story"; i: number } | { kind: "recap" };
const SECS = { intro: 4.5, overview: 10, wheel: 14, story: 12, recap: 8 };
const WHEEL_STEP_MS = 2300;

interface Box { x: number; y: number; w: number; h: number; fs: number; mode: "grid" | "hero" | "mini" | "hidden" | "wheel"; rot?: number; z?: number; op?: number }

/** Where every KPI card sits in a scene (1920×1080 canvas). Cards keep their identity
 *  and glide between these boxes — that is the morph. */
function layout(scene: Scene, kpis: TvKpi[], focusId: string | null, wi: number): Box[] {
  const n = kpis.length;
  if (scene.kind === "wheel") {
    // RadialScrollGallery-style arc: cards sit on a big circle whose top edge crosses the screen.
    const R = 1200, cy = 440 + R, step = 20;
    return kpis.map((_, i) => {
      let p = (((i - wi) % n) + n) % n; if (p > n / 2) p -= n;
      const a = p * step, rad = (a * Math.PI) / 180, ap = Math.abs(p);
      const sc = p === 0 ? 1.2 : 1 - 0.12 * ap, w = 400 * sc, h = 290 * sc;
      return { x: 960 + R * Math.sin(rad) - w / 2, y: cy - R * Math.cos(rad) - h / 2, w, h, fs: w / 15.5, mode: "wheel" as const,
        rot: a, z: 20 - Math.round(ap), op: ap > 2.01 ? 0 : p === 0 ? 1 : 0.9 - 0.18 * ap };
    });
  }
  if (scene.kind === "intro") return kpis.map(() => ({ x: 860, y: 470, w: 200, h: 140, fs: 12, mode: "hidden" as const }));
  if (scene.kind === "story" && focusId) {
    const fi = Math.max(0, kpis.findIndex(k => k.id === focusId));
    const others = kpis.map((_, i) => i).filter(i => i !== fi);
    const cols = others.length > 4 ? 2 : 1, rows = Math.ceil(others.length / cols);
    const top = 160, heroH = others.length > 6 ? 410 : 470;
    const miniTop = top + heroH + 26, avail = 960 - miniTop, gap = 12;
    const mh = Math.min(92, (avail - gap * (rows - 1)) / rows), mw = (720 - gap * (cols - 1)) / cols;
    const out: Box[] = new Array(n);
    out[fi] = { x: 80, y: top, w: 720, h: heroH, fs: 41, mode: "hero" };
    others.forEach((idx, j) => {
      const c = j % cols, r = Math.floor(j / cols);
      out[idx] = { x: 80 + c * (mw + gap), y: miniTop + r * (mh + gap), w: mw, h: mh, fs: mh / 3.7, mode: "mini" };
    });
    return out;
  }
  const cols = n <= 3 ? n : n === 4 ? 2 : 3, rows = Math.ceil(n / cols), gap = 30;
  const W = 1760, H = 760;
  const cw = (W - gap * (cols - 1)) / cols;
  const ch = Math.min(rows === 1 ? 520 : 9999, (H - gap * (rows - 1)) / rows);
  const oy = 190 + (H - (ch * rows + gap * (rows - 1))) / 2;
  return kpis.map((_, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const ox = 80 + (W - (inRow * cw + gap * (inRow - 1))) / 2;
    return { x: ox + c * (cw + gap), y: oy + r * (ch + gap), w: cw, h: ch, fs: Math.min(cw / 15.5, ch / 9.2), mode: "grid" as const };
  });
}

function KpiCard({ k, b, focus, dim, run, index, hov, setHov }: { k: TvKpi; b: Box; focus: boolean; dim: boolean; run: string; index: number; hov: string | null; setHov: (id: string | null) => void }) {
  const [c1, c2] = TONE[k.tone];
  const big = b.mode === "grid" || b.mode === "hero" || b.mode === "wheel";
  const wheel = b.mode === "wheel";
  const shown = useCountUp(k.value, big ? run : "static", big ? 1.5 : 0.01);
  const blur = wheel && hov && hov !== k.id ? 4 : 0;
  return (
    <motion.div className={`tv-card ${b.mode}`} initial={false}
      onHoverStart={() => wheel && setHov(k.id)} onHoverEnd={() => wheel && setHov(null)}
      whileHover={wheel ? { scale: 1.14 } : undefined}
      animate={{ left: b.x, top: b.y, width: b.w, height: b.h, fontSize: b.fs, rotate: b.rot ?? 0, filter: `blur(${blur}px)`,
        opacity: b.mode === "hidden" ? 0 : b.op ?? (dim ? 0.8 : 1),
        boxShadow: focus || (wheel && b.rot === 0) ? `0 0 0 2px ${c1}cc, 0 0 70px 8px ${c1}55, 0 30px 70px rgba(0,0,0,.5)` : "0 14px 40px rgba(0,0,0,.32)" }}
      transition={{ type: "spring", stiffness: 58, damping: 17, mass: 1.05, delay: b.mode === "hidden" || wheel ? 0 : Math.min(index * 0.06, 0.36), opacity: { duration: 0.7 }, filter: { duration: 0.35 } }}
      style={{ zIndex: b.z ?? 1, background: `linear-gradient(150deg, ${c1}c4 0%, ${c2}7a 100%)` }}>
      <div className="tv-glow" />
      {big ? (<>
        <div className="tv-k-label">{k.label}</div>
        <div className="tv-k-value">{k.format(shown)}</div>
        {k.sub && <div className="tv-k-sub">{k.sub}</div>}
      </>) : (<>
        <div className="tv-k-label mini">{k.label}</div>
        <div className="tv-k-value mini">{k.format(k.value)}</div>
      </>)}
    </motion.div>
  );
}

export function Player({ dept, onExit, onDone, nextName }: { dept: TvDept; onExit: () => void; onDone?: () => void; nextName?: string }) {
  const scenes = useMemo<Scene[]>(() => [{ kind: "intro" }, { kind: "overview" }, ...(dept.kpis.length >= 4 ? [{ kind: "wheel" as const }] : []), ...dept.stories.map((_, i) => ({ kind: "story" as const, i })), { kind: "recap" }], [dept]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ui, setUi] = useState(true);
  const [wi, setWi] = useState(0);
  const [hov, setHov] = useState<string | null>(null);
  const idle = useRef<number>(0);
  const scene = scenes[idx];
  const story = scene.kind === "story" ? dept.stories[scene.i] : null;
  const focusId = story?.focus ?? null;
  const boxes = useMemo(() => layout(scene, dept.kpis, focusId, wi), [scene, dept.kpis, focusId, wi]);
  const focusKpi = dept.kpis.find(k => k.id === focusId);
  const color = focusKpi ? TONE[focusKpi.tone][0] : "#d6ac5e";
  const dur = scene.kind === "wheel" ? Math.min(28, Math.max(SECS.wheel, (dept.kpis.length * WHEEL_STEP_MS) / 1000 + 1.5)) : SECS[scene.kind];

  const go = useCallback((d: number) => {
    const n = idx + d;
    if (n >= scenes.length) { if (onDone) onDone(); else setIdx(0); }   // endless loop
    else setIdx(n < 0 ? scenes.length - 1 : n);
  }, [idx, scenes.length, onDone]);

  const fs = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === "Enter") go(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") go(-1);
      else if (e.key === " " || e.key === "p" || e.key === "P") { e.preventDefault(); setPaused(p => !p); }
      else if (e.key === "f" || e.key === "F") fs();
      else if (e.key === "Escape") onExit();
      setUi(true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [go, onExit]);

  useEffect(() => { setWi(0); setHov(null); }, [idx]);
  useEffect(() => {
    if (scene.kind !== "wheel" || paused) return;
    const t = window.setInterval(() => setWi(w => w + 1), WHEEL_STEP_MS);
    return () => window.clearInterval(t);
  }, [scene.kind, paused]);

  useEffect(() => {
    const wake = () => { setUi(true); window.clearTimeout(idle.current); idle.current = window.setTimeout(() => setUi(false), 3200); };
    wake();
    window.addEventListener("mousemove", wake);
    return () => { window.removeEventListener("mousemove", wake); window.clearTimeout(idle.current); };
  }, []);

  const runKey = `${dept.id}-${idx}`;
  return (
    <div className={`tv-play ${ui ? "" : "noui"}`}>
      {/* header */}
      <div className="tv-head">
        <div className="tv-logo"><img src="/brand/smartworld-logo.png" alt="Smart World" /></div>
        <AnimatePresence mode="wait">
          {scene.kind !== "intro" && (
            <motion.div key={dept.id} className="tv-dname" initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {dept.name}{dept.live && <span className="tv-live"><i />LIVE</span>}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      <div className="tv-dots">
        {scenes.map((_, i) => <i key={i} className={i === idx ? "on" : i < idx ? "past" : ""} />)}
      </div>

      {/* intro splash */}
      <AnimatePresence>
        {scene.kind === "intro" && (
          <motion.div key="intro" className="tv-intro" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.08, filter: "blur(10px)" }} transition={{ duration: 0.8 }}>
            <div className="tv-intro-k">SMARTDB · LIVE PREVIEW</div>
            <div className="tv-intro-t">{dept.name}</div>
            <div className="tv-intro-s">{dept.tagline}</div>
            <div className="tv-intro-a">{dept.live ? "● Live data" : "Data"} as on {dept.asOn}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* the morphing KPI cards */}
      {dept.kpis.map((k, i) => (
        <KpiCard key={k.id} k={k} b={boxes[i]} index={i} focus={focusId === k.id} dim={!!focusId && focusId !== k.id} run={runKey} hov={hov} setHov={setHov} />
      ))}

      {/* wheel caption */}
      <AnimatePresence mode="wait">
        {scene.kind === "wheel" && (() => { const k = dept.kpis[wi % dept.kpis.length]; return (
          <motion.div key={`w${k.id}`} className="tv-wcap" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.5 }}>
            <div className="a">{k.label}</div>
            <div className="b">{k.sub || dept.tagline}</div>
          </motion.div>); })()}
      </AnimatePresence>

      {/* story panel */}
      <AnimatePresence mode="wait">
        {story && (
          <motion.div key={`s${dept.id}${scene.kind === "story" ? scene.i : ""}`} className="tv-story glass" initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
            <div className="tv-headline">{story.headline}</div>
            {story.detail && <div className="tv-detail">{story.detail}</div>}
            <VisualView v={story.visual} color={color} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* overview / recap captions */}
      <AnimatePresence>
        {(scene.kind === "overview" || scene.kind === "recap") && (
          <motion.div key={scene.kind} className="tv-cap" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: 0.5 }}>
            {scene.kind === "overview" ? `${dept.name} — at a glance` : nextName ? `Up next: ${nextName}` : `${dept.name} — the full picture`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* footer: data as-on + progress */}
      {paused && <div className="tv-paused">❚❚ Paused</div>}
      <div className="tv-foot"><span>{dept.live ? "● Live · " : ""}Data as on {dept.asOn}</span><span>Smart World Developers · SmartDB</span></div>
      <div className="tv-bar"><i key={runKey} style={{ animationDuration: `${dur}s`, animationPlayState: paused ? "paused" : "running" }} onAnimationEnd={() => go(1)} /></div>

      {/* close: invisible hot zone, the × only appears when the pointer is top-right */}
      <div className="tv-hot"><button className="tv-x" onClick={onExit} aria-label="Close preview"><X /></button></div>
    </div>
  );
}
