import { useEffect, useState } from "react";
import { animate, motion } from "framer-motion";
import type { Visual } from "./types";

const PAL = ["#d6ac5e", "#3fb6d6", "#35c28f", "#9b7be0", "#ef7a5f", "#6f8ff0", "#9aa7c7"];

export function useCountUp(target: number, run: unknown, ms = 1.4) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, target, { duration: ms, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    return () => c.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, run]);
  return v;
}

const Title = ({ t }: { t: string }) => <div className="tv-vtitle">{t}</div>;

function Columns({ v, color }: { v: Extract<Visual, { type: "columns" }>; color: string }) {
  const n = v.data.length;
  const mx = Math.max(...v.data.flatMap(d => [d.value, d.value2 ?? 0]), 1);
  const W = 1000, H = 560, PL = 24, PB = 54, PT = 46;
  const slot = (W - PL * 2) / Math.max(n, 1);
  const two = v.data.some(d => d.value2 !== undefined);
  const bw = Math.min(two ? slot * 0.36 : slot * 0.6, 64);
  const y = (x: number) => PT + (H - PT - PB) * (1 - x / mx);
  const every = Math.ceil(n / 12);
  const maxI = v.data.findIndex(d => d.value === Math.max(...v.data.map(x => x.value)));
  return (
    <div>
      <Title t={v.title} />
      {v.legend && <div className="tv-legend"><i style={{ background: color }} />{v.legend[0]}<i style={{ background: "#35c28f", marginLeft: 26 }} />{v.legend[1]}</div>}
      <svg viewBox={`0 0 ${W} ${H}`} className="tv-svg">
        {[0.25, 0.5, 0.75, 1].map(f => <line key={f} x1={PL} x2={W - PL} y1={y(mx * f)} y2={y(mx * f)} stroke="rgba(255,255,255,.08)" />)}
        <line x1={PL} x2={W - PL} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.25)" />
        {v.data.map((d, i) => {
          const cx = PL + slot * i + slot / 2;
          const hot = i === n - 1 || i === maxI;
          return (
            <g key={i}>
              <motion.rect x={two ? cx - bw - 3 : cx - bw / 2} width={bw} rx={7} fill={i === n - 1 ? "#f3c97a" : color}
                initial={{ y: y(0), height: 0 }} animate={{ y: y(d.value), height: y(0) - y(d.value) }}
                transition={{ delay: 0.25 + i * 0.05, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
              {d.value2 !== undefined && (
                <motion.rect x={cx + 3} width={bw} rx={7} fill="#35c28f"
                  initial={{ y: y(0), height: 0 }} animate={{ y: y(d.value2), height: y(0) - y(d.value2) }}
                  transition={{ delay: 0.35 + i * 0.05, duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
              )}
              {hot && (
                <motion.text x={two ? cx - bw / 2 - 3 : cx} y={y(d.value) - 14} textAnchor="middle" fontSize={25} fontWeight={800} fill="#fff"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 + i * 0.03 }}>{v.format(d.value)}</motion.text>
              )}
              {(i % every === 0 || i === n - 1) && <text x={cx} y={H - 16} textAnchor="middle" fontSize={24} fill="rgba(255,255,255,.72)" fontWeight={600}>{d.label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HBars({ v, color }: { v: Extract<Visual, { type: "hbars" }>; color: string }) {
  const mx = Math.max(...v.rows.map(r => r.value), 1);
  return (
    <div>
      <Title t={v.title} />
      <div className={`tv-hb ${v.rows.length > 6 ? "dense" : ""}`}>
        {v.rows.map((r, i) => (
          <motion.div key={r.label + i} className="tv-hb-row" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.09 }}>
            <div className="tv-hb-lab"><b>{r.label}</b>{r.sub && <span>{r.sub}</span>}</div>
            <div className="tv-hb-track">
              <motion.div className="tv-hb-bar" style={{ background: i === 0 ? "linear-gradient(90deg,#d6ac5e,#f3c97a)" : `linear-gradient(90deg,${color},${color}cc)` }}
                initial={{ width: 0 }} animate={{ width: `${Math.max((r.value / mx) * 100, 1.5)}%` }}
                transition={{ delay: 0.35 + i * 0.09, duration: 1, ease: [0.16, 1, 0.3, 1] }} />
            </div>
            <div className="tv-hb-val">{v.format(r.value)}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Donut({ v }: { v: Extract<Visual, { type: "donut" }> }) {
  const tot = v.parts.reduce((s, p) => s + Math.max(p.value, 0), 0) || 1;
  const R = 150, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div>
      <Title t={v.title} />
      <div className="tv-donut">
        <svg viewBox="0 0 400 400" width={470} height={470}>
          <g transform="rotate(-90 200 200)">
            <circle cx={200} cy={200} r={R} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={54} />
            {v.parts.map((p, i) => {
              const len = (Math.max(p.value, 0) / tot) * C, off = acc; acc += len;
              return <motion.circle key={i} cx={200} cy={200} r={R} fill="none" stroke={p.color ?? PAL[i % PAL.length]} strokeWidth={54}
                strokeDasharray={`${Math.max(len - 3, 0)} ${C}`} strokeDashoffset={-off}
                initial={{ opacity: 0, strokeWidth: 20 }} animate={{ opacity: 1, strokeWidth: 54 }} transition={{ delay: 0.25 + i * 0.18, duration: 0.8 }} />;
            })}
          </g>
          <text x={200} y={200} textAnchor="middle" fontSize={v.centre.value.length > 8 ? 38 : v.centre.value.length > 6 ? 46 : 60} fontWeight={800} fill="#fff" fontFamily="Georgia,serif">{v.centre.value}</text>
          <text x={200} y={242} textAnchor="middle" fontSize={26} fill="rgba(255,255,255,.7)">{v.centre.label}</text>
        </svg>
        <div className="tv-dl">
          {v.parts.map((p, i) => (
            <motion.div key={i} className="tv-dl-row" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.12 }}>
              <i style={{ background: p.color ?? PAL[i % PAL.length] }} /><span>{p.label}</span>
              <b>{v.format(p.value)}</b><em>{((Math.max(p.value, 0) / tot) * 100).toFixed(0)}%</em>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Ring({ v, color }: { v: Extract<Visual, { type: "ring" }>; color: string }) {
  const p = Math.max(0, Math.min(100, v.pct));
  const shown = useCountUp(p, v.title, 1.6);
  const R = 180, C = 2 * Math.PI * R;
  return (
    <div>
      <Title t={v.title} />
      <div className="tv-ring">
        <svg viewBox="0 0 460 460" width={560} height={560}>
          <circle cx={230} cy={230} r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={44} />
          <g transform="rotate(-90 230 230)">
            <motion.circle cx={230} cy={230} r={R} fill="none" stroke={color} strokeWidth={44} strokeLinecap="round" strokeDasharray={C}
              initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - p / 100) }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }} />
          </g>
          <text x={230} y={248} textAnchor="middle" fontSize={118} fontWeight={800} fill="#fff" fontFamily="Georgia,serif">{shown.toFixed(0)}%</text>
          <text x={230} y={304} textAnchor="middle" fontSize={32} fill="rgba(255,255,255,.75)">{v.label}</text>
        </svg>
        {v.sub && <div className="tv-ring-sub">{v.sub}</div>}
      </div>
    </div>
  );
}

export function VisualView({ v, color }: { v: Visual; color: string }) {
  switch (v.type) {
    case "columns": return <Columns v={v} color={color} />;
    case "hbars": return <HBars v={v} color={color} />;
    case "donut": return <Donut v={v} />;
    case "ring": return <Ring v={v} color={color} />;
  }
}
