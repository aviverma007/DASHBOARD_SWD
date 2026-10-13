import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import * as Lucide from "lucide-react";
import { ALL_DEFS } from "./registry";
import { Player } from "./Player";
import { Backdrop } from "./Backdrop";
import { TONE, type TvDept, type TvDeptDef } from "./types";
import "./tv.css";

const Icon = ({ n, size = 34 }: { n: string; size?: number }) => {
  const C = (Lucide as unknown as Record<string, React.ComponentType<{ size?: number }>>)[n] ?? Lucide.Circle;
  return <C size={size} />;
};

/** scales the 1920×1080 canvas to whatever screen it runs on (TV, laptop, projector) */
function useScale() {
  const [s, setS] = useState(1);
  useEffect(() => {
    const f = () => setS(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return s;
}

export default function TvPage() {
  const scale = useScale();
  const [sp, setSp] = useSearchParams();
  const [queue, setQueue] = useState<TvDeptDef[]>([]);        // departments to play, in order
  const [qi, setQi] = useState(0);
  const [dept, setDept] = useState<TvDept | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const cache = useRef(new Map<string, Promise<TvDept>>());
  const grid = useRef<HTMLDivElement>(null);

  const fetchDept = (d: TvDeptDef) => {
    if (!cache.current.has(d.id)) cache.current.set(d.id, d.load());
    return cache.current.get(d.id)!;
  };
  const goFull = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {}); };
  const start = async (defs: TvDeptDef[], at = 0) => {
    goFull();                                                          // go full screen straight from the click
    setErr(null); if (!dept) setLoading(defs[at].name); setQueue(defs); setQi(at);
    try {
      const d = await fetchDept(defs[at]);
      setDept(d);
      if (defs[at + 1]) fetchDept(defs[at + 1]).catch(() => {});      // warm the next one
    } catch (e) {
      cache.current.delete(defs[at].id);
      setErr(`${defs[at].name}: ${e instanceof Error ? e.message : String(e)}`);
      setQueue([]);
    }
    setLoading(null);
  };
  const exit = () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); setDept(null); setQueue([]); setSp({}, { replace: true }); };
  const next = () => {
    void start(queue, (qi + 1) % queue.length);            // endless loop
  };

  // keep the show current: silently re-load the playing department every 5 min
  useEffect(() => {
    if (!dept) return;
    const def = ALL_DEFS.find(x => x.id === dept.id);
    if (!def) return;
    const t = window.setInterval(() => {
      def.load().then(d => { cache.current.set(def.id, Promise.resolve(d)); setDept(cur => (cur && cur.id === d.id ? d : cur)); }).catch(() => {});
    }, 5 * 60 * 1000);
    return () => window.clearInterval(t);
  }, [dept?.id]);

  // kiosk link: /tv?dept=sales  or  /tv?dept=all
  useEffect(() => {
    const d = sp.get("dept");
    if (!d || dept || loading) return;
    if (d === "all") void start(ALL_DEFS.slice(1));
    else { const f = ALL_DEFS.find(x => x.id === d); if (f) void start([f]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // arrow-key / remote navigation on the picker
  useEffect(() => {
    if (dept || loading) return;
    const key = (e: KeyboardEvent) => {
      const els = Array.from(grid.current?.querySelectorAll<HTMLButtonElement>("button.tv-tile") ?? []);
      if (!els.length) return;
      const cur = els.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 3 : e.key === "ArrowUp" ? -3 : 0;
      if (!step) return;
      e.preventDefault();
      els[Math.max(0, Math.min(els.length - 1, (cur < 0 ? 0 : cur + step)))].focus();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dept, loading]);

  return (
    <div className="tv-root">
      <div className="tv-stage" style={{ transform: `translate(-50%,-50%) scale(${scale})` }}>
        <div className="tv-bg"><i className="o1" /><i className="o2" /><i className="o3" /><Backdrop /></div>
        <AnimatePresence mode="wait">
          {dept ? (
            <motion.div key={dept.id} className="tv-fill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
              <Player dept={dept} onExit={exit} onDone={queue.length > 1 ? next : undefined} nextName={queue.length > 1 ? queue[(qi + 1) % queue.length]?.name : undefined} />
            </motion.div>
          ) : (
            <motion.div key="picker" className="tv-fill tv-picker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.45 }}>
              <div className="tv-p-head">
                <div className="tv-logo big"><img src="/brand/smartworld-logo.png" alt="Smart World" /></div>
                <div>
                  <div className="tv-p-k">SMARTDB · TV PREVIEW</div>
                  <h1>Choose a department to start the show</h1>
                </div>
                <div className="tv-p-btns">
                  <button className="tv-pill gold" onClick={() => start(ALL_DEFS.slice(1))}><Lucide.Play size={22} /> Play all departments</button>
                  <button className="tv-pill" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}><Lucide.Maximize2 size={22} /> Fullscreen</button>
                  <button className="tv-pill" onClick={() => { window.location.href = "/"; }}><Lucide.X size={22} /> Close</button>
                </div>
              </div>
              {err && <div className="tv-err">⚠ {err}</div>}
              <div className="tv-tiles" ref={grid}>
                {ALL_DEFS.map((d, i) => {
                  const [c1, c2] = TONE[d.tone];
                  return (
                    <motion.button key={d.id} className={`tv-tile ${d.id === "exec" ? "wide" : ""}`} onClick={() => start([d], 0)}
                      onMouseEnter={() => { void fetchDept(d).catch(() => cache.current.delete(d.id)); }}
                      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 90, damping: 16 }}
                      style={{ background: `linear-gradient(150deg, ${c1} 0%, ${c2} 100%)` }} autoFocus={i === 0}>
                      <span className="ic"><Icon n={d.icon} /></span>
                      <span className="nm">{d.name}</span>
                      <span className="tg">{d.tagline}</span>
                      <span className="pg">{d.pages}</span>
                    </motion.button>
                  );
                })}
              </div>
              <div className="tv-p-foot">Use ← → ↑ ↓ and Enter on a TV remote · in the show: Space = pause · F = fullscreen · Esc = back</div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {loading && (
            <motion.div className="tv-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="spin" /><div>Preparing {loading}…</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
