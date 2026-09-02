import { pct } from "../../utils/smartworldLogic";
import { showTip, hideTip } from "../common/hoverTip";
import type { GroupBarItem } from "../../utils/smartworldLogic";
import { SwBar3 } from "./swPieces";

interface SwGroupBarsProps {
  items: GroupBarItem[];
  names: string[];
  onClick: (key: number) => void;
}

/** Direct port of groupBars(arr, keyFn, names, act) — used for By configuration,
 * Floor rise, By size band, By price band, By unit type, Availability by project. */
export function SwGroupBars({ items, names, onClick }: SwGroupBarsProps) {
  if (items.length === 0) {
    return <div style={{ color: "var(--mut)", fontSize: 12 }}>No units in scope.</div>;
  }
  return (
    <>
      {items.map((o) => {
        const bk = o.us.filter((u) => u[8] === 1).length;
        const bl = o.us.length - o.av - bk;
        return (
          <div className="barrow" key={o.k} onClick={() => onClick(o.k)}
            onMouseEnter={(e) => showTip(e, `<b>${names[o.k]}</b><br/>Available — ${o.av} (${pct(o.av, o.us.length)}%)<br/>Booked — ${bk} · Blocked — ${bl}<br/>Total — ${o.us.length}`)}
            onMouseMove={(e) => showTip(e, `<b>${names[o.k]}</b><br/>Available — ${o.av} (${pct(o.av, o.us.length)}%)<br/>Booked — ${bk} · Blocked — ${bl}<br/>Total — ${o.us.length}`)}
            onMouseLeave={hideTip}>
            <div className="lbl">
              <span className="nm">{names[o.k]}</span>
              <span className="r">
                {pct(o.av, o.us.length)}% avail · {o.us.length}
              </span>
            </div>
            <SwBar3 av={o.av} bk={bk} bl={bl} />
          </div>
        );
      })}
    </>
  );
}

interface SwStatusBarsProps {
  items: { k: number; c: number; t: number }[];
  names: string[];
  stCode: number;
  onClick: (key: number) => void;
}

const STATUS_WORD = ["available", "booked", "blocked"];
const STATUS_COLOR = ["var(--av)", "var(--bk)", "var(--blk)"];

/** Direct port of statusBars() — used inside the drawer when a status scope is active. */
export function SwStatusBars({ items, names, stCode, onClick }: SwStatusBarsProps) {
  if (items.length === 0) {
    return <div style={{ color: "var(--mut)", fontSize: 12 }}>None in scope.</div>;
  }
  return (
    <>
      {items.map((o) => (
        <div className="barrow" key={o.k} onClick={() => onClick(o.k)}>
          <div className="lbl">
            <span className="nm">{names[o.k]}</span>
            <span className="r">
              {o.c} · {pct(o.c, o.t)}% {STATUS_WORD[stCode]}
            </span>
          </div>
          <div className="track">
            <div style={{ height: "100%", width: `${(o.c / o.t) * 100}%`, background: STATUS_COLOR[stCode] }} />
          </div>
        </div>
      ))}
    </>
  );
}
