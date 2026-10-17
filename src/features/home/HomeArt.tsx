import { motion, useReducedMotion } from "framer-motion";

/* Original illustrations for the Home hero — drawn in code so they match the
 * page palette (violet / orchid / rose / amber) and carry no figures. */

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/* ---------- isometric tower: windows light up as the tower "sells out" ---------- */
export function IsoTower() {
  const reduce = useReducedMotion();
  const s = 7, cx = 86, cy = 112;
  const P = (x: number, y: number, z: number) => [cx + (x - y) * 0.866 * s, cy + (x + y) * 0.5 * s - z * s];
  const poly = (pts: number[][]) => pts.map(p => p.join(",")).join(" ");
  const quad = (a: number[], b: number[], c: number[], d: number[]) => poly([a, b, c, d]);

  type Win = { pts: string; lit: string; dark: string; order: number };
  const tower = (ox: number, oy: number, W: number, D: number, H: number, faces: [string, string, string], seed: number) => {
    const at = (x: number, y: number, z: number) => P(x + ox, y + oy, z);
    const wins: Win[] = [];
    for (let f = 0; f < H; f++) {
      for (let i = 0; i < W; i++) {
        const z0 = f + 0.28, z1 = f + 0.74, x0 = i + 0.22, x1 = i + 0.78;
        wins.push({ pts: quad(at(x0, D, z0), at(x1, D, z0), at(x1, D, z1), at(x0, D, z1)), lit: hash(seed + f * 7 + i) > 0.5 ? "#ffd38a" : "#ff9ecb", dark: "#33267f", order: hash(seed + f * 13 + i * 3) });
      }
      for (let j = 0; j < D; j++) {
        const z0 = f + 0.28, z1 = f + 0.74, y0 = j + 0.22, y1 = j + 0.78;
        wins.push({ pts: quad(at(W, y0, z0), at(W, y1, z0), at(W, y1, z1), at(W, y0, z1)), lit: hash(seed + f * 5 + j + 40) > 0.45 ? "#ffc56e" : "#ff8ec0", dark: "#271c66", order: hash(seed + f * 17 + j * 11 + 5) });
      }
    }
    return {
      left: quad(at(0, D, 0), at(W, D, 0), at(W, D, H), at(0, D, H)),
      right: quad(at(W, 0, 0), at(W, D, 0), at(W, D, H), at(W, 0, H)),
      top: quad(at(0, 0, H), at(W, 0, H), at(W, D, H), at(0, D, H)),
      crown: quad(at(0.6, 0.6, H + 0.6), at(W - 0.6, 0.6, H + 0.6), at(W - 0.6, D - 0.6, H + 0.6), at(0.6, D - 0.6, H + 0.6)),
      faces, wins,
    };
  };
  const back = tower(-5.2, -1.6, 3, 3, 8, ["#8f78f2", "#6a52d4", "#c9b8ff"], 3);
  const main = tower(0, 0, 4, 3, 12, ["#7a61ef", "#5640c8", "#cdbdff"], 11);
  const ground = quad(P(-8, -4.5, 0), P(7.5, -4.5, 0), P(7.5, 6, 0), P(-8, 6, 0));
  const trees = [[-6.5, 4.2], [-3.2, 5.1], [5.8, 1.2], [6.2, 4.4], [1.5, 5.4]];

  const renderTower = (t: ReturnType<typeof tower>, k: string, base: number) => (
    <g key={k}>
      <polygon points={t.left} fill={t.faces[0]} />
      <polygon points={t.right} fill={t.faces[1]} />
      <polygon points={t.top} fill={t.faces[2]} />
      <polygon points={t.crown} fill="#ffffff" opacity={0.35} />
      {t.wins.map((w, i) => (
        <motion.polygon key={i} points={w.pts}
          initial={{ fill: reduce ? w.lit : w.dark }} animate={{ fill: w.order < 0.82 ? w.lit : w.dark }}
          transition={{ duration: 0.35, delay: reduce ? 0 : base + w.order * 2.6 }} />
      ))}
    </g>
  );

  return (
    <svg viewBox="0 0 172 150" width="100%" height="100%" role="img" aria-label="Illustration of a residential tower with its windows lighting up">
      <polygon points={ground} fill="#ffffff" opacity={0.22} />
      <ellipse cx={P(2, 1.5, 0)[0]} cy={P(2, 1.5, 0)[1] + 6} rx={46} ry={11} fill="#241a4d" opacity={0.18} />
      {renderTower(back, "b", 0.4)}
      {renderTower(main, "m", 0.7)}
      {trees.map(([x, y], i) => {
        const [tx, ty] = P(x, y, 0);
        return <g key={i}><rect x={tx - 0.7} y={ty - 5} width={1.4} height={5} fill="#3e2f7a" /><circle cx={tx} cy={ty - 7} r={4.2} fill={i % 2 ? "#5b43d6" : "#8b6cff"} /></g>;
      })}
    </svg>
  );
}

/* ---------- city skyline at dusk, under the same glow as the hero ---------- */
const BACK = [[0, 70], [16, 58], [30, 76], [44, 50], [60, 66], [78, 44], [96, 62], [112, 54], [130, 72], [146, 48], [164, 64], [182, 56], [200, 70], [218, 52], [240, 60]];
const FRONT: [number, number, number][] = [ // x, width, height
  [0, 22, 46], [24, 16, 64], [42, 26, 38], [70, 18, 84], [90, 24, 56], [116, 14, 70], [132, 28, 44], [162, 20, 92], [184, 24, 60], [210, 16, 76], [228, 14, 50],
];

export function DuskSkyline() {
  const reduce = useReducedMotion();
  const H = 160;
  const backPath = `M0 ${H} ` + BACK.map(([x, h]) => `L${x} ${H - h - 30} L${x + 14} ${H - h - 30}`).join(" ") + ` L240 ${H} Z`;
  const wins: { x: number; y: number; lit: boolean; tw: boolean; d: number }[] = [];
  FRONT.forEach(([x, w, h], bi) => {
    for (let yy = H - h + 6; yy < H - 6; yy += 7) {
      for (let xx = x + 3; xx < x + w - 4; xx += 5) {
        const r = hash(bi * 97 + xx * 3 + yy);
        wins.push({ x: xx, y: yy, lit: r > 0.48, tw: r > 0.9, d: hash(xx + yy) * 4 });
      }
    }
  });
  return (
    <svg viewBox="0 0 240 160" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration of a city skyline at dusk">
      <defs>
        <linearGradient id="hmSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1640" />
          <stop offset="0.42" stopColor="#5a3fc4" />
          <stop offset="0.74" stopColor="#ff8ec0" />
          <stop offset="1" stopColor="#f2b26b" />
        </linearGradient>
        <radialGradient id="hmSun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff1d6" />
          <stop offset="0.55" stopColor="#ffc98a" />
          <stop offset="1" stopColor="#ff8ec0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="160" fill="url(#hmSky)" />
      {[[30, 22], [74, 14], [126, 30], [196, 18], [222, 34], [156, 10]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.9} fill="#fff" opacity={0.8} />
      ))}
      <circle cx="168" cy="104" r="34" fill="url(#hmSun)" />
      <circle cx="168" cy="104" r="15" fill="#ffe2b4" />
      <path d={backPath} fill="#7a5fd6" opacity={0.55} />
      {FRONT.map(([x, w, h], i) => (
        <g key={i}>
          <rect x={x} y={H - h} width={w} height={h} fill="#140f2a" />
          {i % 3 === 1 && <rect x={x + w / 2 - 0.6} y={H - h - 9} width={1.2} height={9} fill="#140f2a" />}
        </g>
      ))}
      {wins.map((w, i) => (
        <rect key={i} x={w.x} y={w.y} width={2.4} height={3} rx={0.4}
          fill={w.lit ? (i % 4 ? "#ffd38a" : "#ff9ecb") : "#2a2148"}
          className={w.tw && !reduce ? "hm-twinkle" : undefined} style={w.tw ? { animationDelay: `${w.d}s` } : undefined} />
      ))}
    </svg>
  );
}
