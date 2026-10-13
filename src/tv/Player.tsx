import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize2, Pause, Play, X } from "lucide-react";
import { TONE, type TvDept, type TvKpi } from "./types";
import { VisualView, useCountUp } from "./Visuals";

type Scene = { kind: "intro" } | { kind: "overview" } | { kind: "story"; i: number } | { kind: "recap" };
const SECS = { intro: 4.5, overview: 10, story: 12, recap: 8 };

interface Box { x: number; y: number; w: number; h: number; fs: number; mode: "grid" | "hero" | "mini" | "hidden" }

/** Where every KPI card sits in a scene (1920×1080 canvas). Cards keep their identity
 *  and glide between these boxes — that is the morph. */
function layout(scene: Scene, kpis: TvKpi[], focusId: string | null): Box[] {
  const n = kpis.length;
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

function KpiCard({ k, b, focus, dim, run, index }: { k: TvKpi; b: Box; focus: boolean; dim: boolean; run: string; index: number }) {
  const [c1, c2] = TONE[k.tone];
  const big = b.mode === "grid" || b.mode === "hero";
  const shown = useCountUp(k.value, big ? run : "static", big ? 1.5 : 0.01);
  return (
    <motion.div className={`tv-card ${b.mode}`} initial={false}
      animate={{ left: b.x, top: b.y, width: b.w, height: b.h, fontSize: b.fs, opacity: b.mode === "hidden" ? 0 : dim ? 0.78 : 1,
        boxShadow: focus ? `0 0 0 3px ${c1}, 0 0 60px 6px ${c1}66, 0 30px 70px rgba(0,0,0,.5)` : "0 14px 40px rgba(0,0,0,.35)" }}
      transition={{ type: "spring", stiffness: 70, damping: 18, mass: 1, delay: b.mode === "hidden" ? 0 : Math.min(index * 0.05, 0.3) }}
      style={{ background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)` }}>
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
  const scenes = useMemo<Scene[]>(() => [{ kind: "intro" }, { kind: "overview" }, ...dept.stories.map((_, i) => ({ kind: "story" as const, i })), { kind: "recap" }], [dept]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ui, setUi] = useState(true);
  const idle = useRef<number>(0);
  const scene = scenes[idx];
  const story = scene.kind === "story" ? dept.stories[scene.i] : null;
  const focusId = story?.focus ?? null;
  const boxes = useMemo(() => layout(scene, dept.kpis, focusId), [scene, dept.kpis, focusId]);
  const focusKpi = dept.kpis.find(k => k.id === focusId);
  const color = focusKpi ? TONE[focusKpi.tone][0] : "#d6ac5e";
  const dur = SECS[scene.kind];

  const go = useCallback((d: number) => {
    const n = idx + d;
    if (n >= scenes.length) onDone?.();
    else setIdx(Math.max(0, n));
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
        <div className="tv-dots">
          {scenes.map((_, i) => <i key={i} className={i === idx ? "on" : i < idx ? "past" : ""} onClick={() => setIdx(i)} />)}
        </div>
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
        <KpiCard key={k.id} k={k} b={boxes[i]} index={i} focus={focusId === k.id} dim={!!focusId && focusId !== k.id} run={runKey} />
      ))}

      {/* story panel */}
      <AnimatePresence mode="wait">
        {story && (
          <motion.div key={`s${dept.id}${scene.kind === "story" ? scene.i : ""}`} className="tv-story" initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}>
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
      <div className="tv-foot"><span>{dept.live ? "● Live · " : ""}Data as on {dept.asOn}</span><span>Smart World Developers · SmartDB</span></div>
      <div className="tv-bar"><i key={runKey} style={{ animationDuration: `${dur}s`, animationPlayState: paused ? "paused" : "running" }} onAnimationEnd={() => go(1)} /></div>

      {/* controls */}
      <div className="tv-ctl">
        <button onClick={() => go(-1)} aria-label="Previous"><ChevronLeft /></button>
        <button onClick={() => setPaused(p => !p)} aria-label="Pause / play">{paused ? <Play /> : <Pause />}</button>
        <button onClick={() => go(1)} aria-label="Next"><ChevronRight /></button>
        <button onClick={fs} aria-label="Fullscreen"><Maximize2 /></button>
        <button onClick={onExit} aria-label="Back to departments"><X /></button>
      </div>
    </div>
  );
}
