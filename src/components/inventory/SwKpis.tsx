import { CR, pct } from "../../utils/smartworldLogic";
import type { Stats } from "../../utils/smartworldLogic";

interface SwKpisProps {
  s: Stats;
  onAll: () => void;
  onStatus: (v: number) => void;
}

/** Direct port of the KPI-cards array in renderOverview(). */
export function SwKpis({ s, onAll, onStatus }: SwKpisProps) {
  const items = [
    { k: "Total units", v: s.t.toLocaleString("en-IN"), u: "units", sub: "all inventory", onClick: onAll },
    {
      k: "Available",
      v: s.av.toLocaleString("en-IN"),
      u: "units",
      sub: `${pct(s.av, s.t)}% of stock`,
      onClick: () => onStatus(0),
    },
    {
      k: "Booked · absorption",
      v: s.bk.toLocaleString("en-IN"),
      u: "units",
      sub: `${pct(s.bk, s.t)}% absorbed`,
      onClick: () => onStatus(1),
    },
    {
      k: "Management units",
      v: s.bl.toLocaleString("en-IN"),
      u: "units",
      sub: "not for sale",
      onClick: () => onStatus(2),
    },
    { k: "Value available", v: CR(s.vav), sub: "available stock", onClick: () => onStatus(0) },
    { k: "Value booked", v: CR(s.vbk), sub: "sold stock", onClick: () => onStatus(1) },
  ];

  return (
    <div className="kpis">
      {items.map((o) => (
        <div className="kpi clk" key={o.k} onClick={o.onClick}>
          <div className="k">
            {o.k} <span style={{ color: "var(--gold)" }}>›</span>
          </div>
          <div className="v">
            {o.v}
            {o.u && <small> {o.u}</small>}
          </div>
          <div className="s">{o.sub}</div>
        </div>
      ))}
    </div>
  );
}
