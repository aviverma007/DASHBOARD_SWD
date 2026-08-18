import { KpiStrip } from "../../components/kpi/KpiStrip";
import { ProjectComparisonChart } from "../../components/charts/ProjectComparisonChart";
import { ProjectBreakupTable } from "../../components/tables/ProjectBreakupTable";
import { SkeletonBlock } from "../../components/common/SkeletonBlock";
import { EmptyState } from "../../components/common/EmptyState";
import { useScopedData } from "../../hooks/useScopedData";
import { useFilterStore } from "../../store/filterStore";

export function InventoryOverviewPage() {
  const { totals, contributions, isLoading } = useScopedData();
  const projects = useFilterStore((s) => s.projects);
  const showComparison = projects === "ALL" || projects.length > 1;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SkeletonBlock className="h-36" />
          <SkeletonBlock className="h-36" />
          <SkeletonBlock className="h-36" />
        </div>
        <SkeletonBlock className="h-72" />
      </div>
    );
  }

  if (!totals || (Array.isArray(projects) && projects.length === 0)) {
    return (
      <EmptyState
        title="No data available"
        message="No data is available for the selected projects and period. Adjust your filters to see results."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-charcoal">Inventory / Sales Overview</h1>
        <p className="text-sm text-charcoal-soft">
          Group-level totals with project-wise breakup. Click any KPI to drill down.
        </p>
      </div>

      <KpiStrip totals={totals} />

      {showComparison && contributions && contributions.length > 1 && (
        <ProjectComparisonChart data={contributions} />
      )}

      {contributions && <ProjectBreakupTable data={contributions} />}
    </div>
  );
}
