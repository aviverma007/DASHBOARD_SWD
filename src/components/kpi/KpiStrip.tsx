import { KpiCard } from "./KpiCard";
import type { InventoryTotals } from "../../utils/calculations";
import { useDrilldownStore } from "../../store/drilldownStore";

interface KpiStripProps {
  totals: InventoryTotals;
}

const DEFINITIONS = {
  sold: "Sold Units ÷ Total Units × 100. Source: SAP Sales/Booking Report (mock data pending confirmation).",
  unsold: "Unsold Units ÷ Total Units × 100. Source: SAP Inventory Report (mock data pending confirmation).",
  total: "Sold Units + Unsold Units. Blocked/hold units are tracked separately pending status confirmation.",
};

export function KpiStrip({ totals }: KpiStripProps) {
  const openDrilldown = useDrilldownStore((s) => s.open);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard
        kpi={totals.sold}
        accent="teal"
        definition={DEFINITIONS.sold}
        onClick={() =>
          openDrilldown({ level: "group", id: "group", label: "All Projects" }, "sold")
        }
      />
      <KpiCard
        kpi={totals.unsold}
        accent="amber"
        definition={DEFINITIONS.unsold}
        onClick={() =>
          openDrilldown({ level: "group", id: "group", label: "All Projects" }, "unsold")
        }
      />
      <KpiCard
        kpi={totals.total}
        accent="navy"
        definition={DEFINITIONS.total}
        onClick={() =>
          openDrilldown({ level: "group", id: "group", label: "All Projects" }, "total")
        }
      />
      {totals.blockedUnits > 0 && (
        <p className="col-span-full text-xs text-charcoal-soft">
          {totals.blockedUnits} unit(s) marked BLOCKED are excluded from Total pending status
          confirmation — see open assumptions.
        </p>
      )}
    </div>
  );
}
