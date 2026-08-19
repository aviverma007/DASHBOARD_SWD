import { KpiCard } from "./KpiCard";
import type { InventoryTotals } from "../../utils/calculations";
import { useDrilldownStore } from "../../store/drilldownStore";

interface KpiStripProps {
  totals: InventoryTotals;
}

const DEFINITIONS = {
  available: "Available Units ÷ Total Units × 100.",
  booked: "Booked Units ÷ Total Units × 100.",
  total: "Available Units + Booked Units. Management units are tracked separately and excluded from Total.",
};

export function KpiStrip({ totals }: KpiStripProps) {
  const openDrilldown = useDrilldownStore((s) => s.open);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard
        kpi={totals.available}
        accent="teal"
        definition={DEFINITIONS.available}
        onClick={() =>
          openDrilldown({ level: "group", id: "group", label: "All Projects" }, "available")
        }
      />
      <KpiCard
        kpi={totals.booked}
        accent="amber"
        definition={DEFINITIONS.booked}
        onClick={() =>
          openDrilldown({ level: "group", id: "group", label: "All Projects" }, "booked")
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
      {totals.managementUnits > 0 && (
        <p className="col-span-full text-xs text-charcoal-soft">
          {totals.managementUnits} unit(s) marked Management are held back by the developer and
          excluded from Total.
        </p>
      )}
    </div>
  );
}
