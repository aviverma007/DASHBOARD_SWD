/**
 * Direct ports of the reference tool's small HTML-string-returning
 * helper functions (donut, dlegend, bar3, legend, stpill) as React
 * components. Markup structure and class names match the source.
 */
import { fNum, STL } from "../../utils/smartworldLogic";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  act?: string;
  v?: number;
}

interface SwDonutProps {
  segs: DonutSegment[];
  onSegmentClick?: (seg: DonutSegment) => void;
}

/** donut(segs) — SVG ring chart with a center total, matching the source's donut(). */
export function SwDonut({ segs, onSegmentClick }: SwDonutProps) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const r = 54;
  const cx = 66;
  const cy = 66;
  const sw = 20;
  const C = 2 * Math.PI * r;
  let off = 0;

  return (
    <svg viewBox="0 0 132 132" width="132" height="132">
      {segs.map((s, i) => {
        const len = (s.value / total) * C;
        const dashOffset = -off;
        off += len;
        return (
          <circle
            key={i}
            data-act={s.act}
            data-v={s.v}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={sw}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            onClick={() => onSegmentClick?.(s)}
          >
            <title>
              {s.label}: {fNum(s.value)} ({((s.value / total) * 100).toFixed(1)}%)
            </title>
          </circle>
        );
      })}
      <text
        x={cx}
        y={cy - 2}
        textAnchor="middle"
        fontFamily="Georgia,serif"
        fontSize="18"
        fontWeight="700"
        fill="var(--ink)"
      >
        {fNum(total)}
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="8.5" letterSpacing="1" fill="var(--mut)">
        TOTAL
      </text>
    </svg>
  );
}

interface SwDLegendProps {
  segs: DonutSegment[];
  onItemClick?: (seg: DonutSegment) => void;
}

/** dlegend(segs) — legend list beside a donut, matching the source's dlegend(). */
export function SwDLegend({ segs, onItemClick }: SwDLegendProps) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className="dlg">
      {segs.map((s, i) => (
        <div
          key={i}
          data-act={s.act}
          data-v={s.v}
          onClick={() => onItemClick?.(s)}
          className="li"
        >
          <span className="sw" style={{ background: s.color }} />
          {s.label}
          <b>{fNum(s.value)}</b>
          <span className="pc">{((s.value / total) * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

/** legend() — the small Available/Booked/Mgmt swatch legend. */
export function SwLegend() {
  return (
    <div className="legend">
      <span>
        <span className="sw" style={{ background: "var(--av)" }} /> Available
      </span>
      <span>
        <span className="sw" style={{ background: "var(--bk)" }} /> Booked
      </span>
      <span>
        <span className="sw" style={{ background: "var(--blk)" }} /> Mgmt
      </span>
    </div>
  );
}

/** bar3(av,bk,bl) — the 3-segment availability track. */
export function SwBar3({ av, bk, bl }: { av: number; bk: number; bl: number }) {
  const t = av + bk + bl || 1;
  return (
    <div className="track">
      <div className="a" style={{ width: `${(av / t) * 100}%` }} />
      <div className="b" style={{ width: `${(bk / t) * 100}%` }} />
      <div className="k3" style={{ width: `${(bl / t) * 100}%` }} />
    </div>
  );
}

/** stpill(u) — the status pill used in unit rows and unit detail. */
export function SwStatusPill({ status }: { status: 0 | 1 | 2 }) {
  const cls = status === 0 ? "pav" : status === 1 ? "pbk" : "pblk";
  return <span className={`pill ${cls}`}>{STL[status]}</span>;
}
