import type { ProjectContribution } from "../../types/domain";
import { formatNumber, formatPercent } from "../../utils/format";
import { useDrilldownStore } from "../../store/drilldownStore";

interface ProjectBreakupTableProps {
  data: ProjectContribution[];
}

export function ProjectBreakupTable({ data }: ProjectBreakupTableProps) {
  const openDrilldown = useDrilldownStore((s) => s.open);

  return (
    <div className="overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-charcoal">Project-wise Breakup</h3>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface text-xs font-semibold uppercase tracking-wide text-charcoal-soft">
              <th className="px-4 py-2.5 text-left">Project</th>
              <th className="num px-4 py-2.5 text-right">Sold</th>
              <th className="num px-4 py-2.5 text-right">Unsold</th>
              <th className="num px-4 py-2.5 text-right">Total</th>
              <th className="num px-4 py-2.5 text-right">Sold %</th>
              <th className="num px-4 py-2.5 text-right">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.projectId}
                onClick={() =>
                  openDrilldown({ level: "project", id: row.projectId, label: row.projectName }, "total")
                }
                className="cursor-pointer border-b border-border-subtle last:border-0 hover:bg-surface"
              >
                <td className="px-4 py-2.5 font-medium text-charcoal">{row.projectName}</td>
                <td className="num px-4 py-2.5 text-right text-teal-dark">{formatNumber(row.soldUnits)}</td>
                <td className="num px-4 py-2.5 text-right text-amber-dark">{formatNumber(row.unsoldUnits)}</td>
                <td className="num px-4 py-2.5 text-right font-semibold text-charcoal">
                  {formatNumber(row.totalUnits)}
                </td>
                <td className="num px-4 py-2.5 text-right text-charcoal-soft">
                  {formatPercent(row.soldPercent)}
                </td>
                <td className="num px-4 py-2.5 text-right text-charcoal-soft">
                  {formatPercent(row.contributionPercent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border-subtle px-4 py-2 text-xs text-charcoal-soft">
        Area figures available in the drill-down panel.
      </p>
    </div>
  );
}
