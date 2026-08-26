import type { InventoryTotals } from "../../utils/calculations";
import { fArea } from "../../utils/smartworldLogic";

interface OverviewKpisProps {
  totals: InventoryTotals;
  onOpenGroup: (kpiContext: "available" | "booked" | "total") => void;
}

/**
 * Overview's KPI strip, restyled to match Inventory's .kpis/.kpi cards
 * (KpiStrip.tsx + KpiCard.tsx retired) — same typography, sizing, and
 * card shell as Inventory's KPI strip, with Available/Booked/Total
 * combined units + area + percentage in one card per the redesign brief,
 * rather than split across separate cards.
 */
export function OverviewKpis({ totals, onOpenGroup }: OverviewKpisProps) {
  const { available, booked, total, managementUnits } = totals;

  return (
    <>
      <div className="kpis">
        <div
          className="kpi clk"
          style={{ borderTopColor: "var(--av)" }}
          onClick={() => onOpenGroup("available")}
        >
          <div className="k">
            Available <span style={{ color: "var(--gold)" }}>›</span>
          </div>
          <div className="v">
            {available.units.toLocaleString("en-IN")} <small>units</small>
          </div>
          <div className="s">
            {fArea(available.area)} · {available.percentage.toFixed(1)}% of stock
          </div>
        </div>

        <div
          className="kpi clk"
          style={{ borderTopColor: "var(--bk)" }}
          onClick={() => onOpenGroup("booked")}
        >
          <div className="k">
            Booked <span style={{ color: "var(--gold)" }}>›</span>
          </div>
          <div className="v">
            {booked.units.toLocaleString("en-IN")} <small>units</small>
          </div>
          <div className="s">
            {fArea(booked.area)} · {booked.percentage.toFixed(1)}% absorbed
          </div>
        </div>

        <div
          className="kpi clk"
          style={{ borderTopColor: "var(--ink)" }}
          onClick={() => onOpenGroup("total")}
        >
          <div className="k">
            Total <span style={{ color: "var(--gold)" }}>›</span>
          </div>
          <div className="v">
            {total.units.toLocaleString("en-IN")} <small>units</small>
          </div>
          <div className="s">{fArea(total.area)} · sellable inventory</div>
        </div>
      </div>

      {managementUnits > 0 && (
        <div className="blkbar" style={{ marginBottom: 14 }}>
          {managementUnits} Blocked units are held back by the developer and excluded from
          Total.
        </div>
      )}
    </>
  );
}
