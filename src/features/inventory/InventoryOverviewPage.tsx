import { OverviewFilters } from "../../components/overview/OverviewFilters";
import { OverviewKpis } from "../../components/overview/OverviewKpis";
import { OverviewProjectBars } from "../../components/overview/OverviewProjectBars";
import { OverviewProjectTable } from "../../components/overview/OverviewProjectTable";
import { useScopedData } from "../../hooks/useScopedData";
import { useFilterStore } from "../../store/filterStore";
import { useDrilldownStore } from "../../store/drilldownStore";
import "../../components/inventory/smartworldInventory.css";

/**
 * Redesigned to match Inventory's visual language exactly — same navy
 * filter bar treatment, same .card/.kpis/.kpi/table styling (all from
 * smartworldInventory.css, imported once here), same click-to-drill
 * conventions. Underlying data/hooks (useScopedData, useFilterStore,
 * useDrilldownStore) are unchanged — this is a presentation-layer
 * redesign, not a data change.
 */
export function InventoryOverviewPage() {
  const { totals, contributions, isLoading } = useScopedData();
  const projects = useFilterStore((s) => s.projects);
  const openDrilldown = useDrilldownStore((s) => s.open);
  const showComparison = projects === "ALL" || projects.length > 1;

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      <OverviewFilters />

      <div className="wrap">
        {isLoading && (
          <div className="kpis">
            {[1, 2, 3].map((i) => (
              <div key={i} className="kpi" style={{ height: 92, background: "var(--bg)" }} />
            ))}
          </div>
        )}

        {!isLoading && (!totals || (Array.isArray(projects) && projects.length === 0)) && (
          <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
            <h3 style={{ justifyContent: "center" }}>No data available</h3>
            <p style={{ color: "var(--mut)", fontSize: 13 }}>
              No data is available for the selected projects and period. Adjust your filters to
              see results.
            </p>
          </div>
        )}

        {!isLoading && totals && (
          <>
            <OverviewKpis
              totals={totals}
              onOpenGroup={(kpiContext) =>
                openDrilldown({ level: "group", id: "group", label: "All Projects" }, kpiContext)
              }
            />

            {showComparison && contributions && contributions.length > 1 && (
              <OverviewProjectBars data={contributions} />
            )}

            {contributions && <OverviewProjectTable data={contributions} />}
          </>
        )}
      </div>
    </div>
  );
}
