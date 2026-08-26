import { fArea, pct } from "../../utils/smartworldLogic";
import type { Stats } from "../../utils/smartworldLogic";

interface SwKpisProps {
  s: Stats;
  onAll: () => void;
  onStatus: (v: number) => void;
}

/** Direct port of the KPI-cards array in renderOverview(), with the two
 * ₹-value cards (Value available / Value booked) replaced by area
 * equivalents — this app shows area, not value, throughout. */
export function SwKpis({ s, onAll, onStatus }: SwKpisProps) {
  const totalArea = s.areaAv + s.areaBk + s.areaBl;
  const items = [
    {
      k: "Total units",
      v: s.t.toLocaleString("en-IN"),
      u: "units",
      sub: `${fArea(totalArea)} total area · ${s.av.toLocaleString("en-IN")} open to sell`,
      onClick: onAll,
    },
    {
      k: "Available",
      v: s.av.toLocaleString("en-IN"),
      u: "units",
      sub: `${pct(s.av, s.t)}% of stock · ${fArea(s.areaAv)}`,
      onClick: () => onStatus(0),
    },
    {
      k: "Booked · absorption",
      v: s.bk.toLocaleString("en-IN"),
      u: "units",
      sub: `${pct(s.bk, s.t)}% absorbed · ${fArea(s.areaBk)} sold`,
      onClick: () => onStatus(1),
    },
    {
      k: "Blocked units",
      v: s.bl.toLocaleString("en-IN"),
      u: "units",
      sub: `not for sale · ${pct(s.bl, s.t)}% of stock · ${fArea(s.areaBl)}`,
      onClick: () => onStatus(2),
    },
    {
      k: "Area available",
      v: fArea(s.areaAv),
      sub: `area except blocked units · ${pct(Math.round(s.areaAv), Math.round(totalArea))}% of total area`,
      onClick: () => onStatus(0),
    },
    {
      k: "Area booked",
      v: fArea(s.areaBk),
      sub: `sold stock · ${pct(Math.round(s.areaBk), Math.round(totalArea))}% of total area`,
      onClick: () => onStatus(1),
    },
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
