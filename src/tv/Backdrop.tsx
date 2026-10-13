import { useMemo } from "react";

/** Drifting Smart World marks and mini charts behind the cards — pure CSS motion, no re-renders. */
const rnd = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };
const NAVY = "#14224a", GOLD = "#b98a3e", GREEN = "#1d9a6c";

function Glyph({ kind, c }: { kind: number; c: string }) {
  switch (kind % 5) {
    case 0: return (<svg viewBox="0 0 120 80" fill={c}>{[10, 30, 50, 70, 90].map((x, i) => <rect key={i} x={x} y={70 - [30, 48, 26, 58, 40][i]} width="14" height={[30, 48, 26, 58, 40][i]} rx="3" />)}</svg>);
    case 1: return (<svg viewBox="0 0 120 80" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,64 30,40 52,52 78,20 114,30" /><circle cx="78" cy="20" r="6" fill={c} /></svg>);
    case 2: return (<svg viewBox="0 0 80 80" fill="none" stroke={c} strokeWidth="14"><circle cx="40" cy="40" r="26" strokeOpacity=".35" /><circle cx="40" cy="40" r="26" strokeDasharray="100 200" transform="rotate(-90 40 40)" /></svg>);
    case 3: return (<svg viewBox="0 0 120 80" fill={c} fillOpacity=".55"><path d="M4 70 L4 50 L30 34 L56 46 L84 18 L116 30 L116 70 Z" /></svg>);
    default: return (<svg viewBox="0 0 100 100" fill="none" stroke={c} strokeWidth="6"><circle cx="50" cy="50" r="40" strokeOpacity=".4" /><path d="M50 50 L50 10 A40 40 0 0 1 88 62 Z" fill={c} fillOpacity=".5" stroke="none" /></svg>);
  }
}

export function Backdrop() {
  const items = useMemo(() => {
    const r = rnd(20261013);
    return Array.from({ length: 30 }, (_, i) => {
      const logo = i % 2 === 0;
      const size = logo ? 90 + r() * 150 : 80 + r() * 130;
      return {
        i, logo, size, kind: Math.floor(r() * 5),
        c: [NAVY, GOLD, GREEN][Math.floor(r() * 3)],
        x: r() * 100, y: r() * 100,
        dx: (r() - 0.5) * 460, dy: (r() - 0.5) * 380, rot: (r() - 0.5) * 50,
        dur: 7 + r() * 9, delay: -r() * 30, op: 0.07 + r() * 0.1, blur: r() < 0.35 ? 2 + r() * 2 : 0,
      };
    });
  }, []);
  return (
    <div className="tv-drift" aria-hidden>
      {items.map(o => (
        <div key={o.i} className="tv-drift-i" style={{
          left: `${o.x}%`, top: `${o.y}%`, width: o.size, opacity: o.op, filter: o.blur ? `blur(${o.blur}px)` : undefined,
          ["--dx" as string]: `${o.dx}px`, ["--dy" as string]: `${o.dy}px`, ["--r" as string]: `${o.rot}deg`,
          animationDuration: `${o.dur}s`, animationDelay: `${o.delay}s`,
        }}>
          {o.logo ? <img src="/brand/smartworld-mark.png" alt="" /> : <Glyph kind={o.kind} c={o.c} />}
        </div>
      ))}
    </div>
  );
}
