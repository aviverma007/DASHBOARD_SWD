import type { ProjectContribution } from "../../types/domain";
import { useDrilldownStore } from "../../store/drilldownStore";

interface OverviewProjectBarsProps {
  data: ProjectContribution[];
}

/**
 * Replaces the old Recharts-based ProjectComparisonChart. Inventory's
 * own design system never uses a charting library for breakdowns like
 * this — it uses a plain sorted bar-row list (.barrow/.track, the same
 * pattern as Inventory's "Availability by project" card). Reusing that
 * pattern here — rather than reskinning Recharts to imitate it — is a
 * closer match to "feel like the same product" than parallel charting
 * systems would be.
 *
 * Same data, same click-to-drill behavior as before (opens the
 * project-level drill-down), just restyled.
 */
export function OverviewProjectBars({ data }: OverviewProjectBarsProps) {
  const openDrilldown = useDrilldownStore((s) => s.open);

  const sorted = [...data].sort(
    (a, b) => b.availableUnits / b.totalUnits - a.availableUnits / a.totalUnits
  );

  return (
    <div className="card">
      <h3>
        Available vs Booked by Project <span className="hint">click a project → drill down</span>
      </h3>
      <div className="legend">
        <span>
          <span className="sw" style={{ background: "var(--av)" }} /> Available
        </span>
        <span>
          <span className="sw" style={{ background: "var(--bk)" }} /> Booked
        </span>
      </div>
      {sorted.map((row) => {
        const total = row.totalUnits || 1;
        const availablePercent = ((row.availableUnits / total) * 100).toFixed(0);
        return (
          <div
            className="barrow"
            key={row.projectId}
            onClick={() =>
              openDrilldown({ level: "project", id: row.projectId, label: row.projectName }, "total")
            }
          >
            <div className="lbl">
              <span className="nm">{row.projectName}</span>
              <span className="r">
                {availablePercent}% avail · {row.totalUnits.toLocaleString("en-IN")} units
              </span>
            </div>
            <div className="track">
              <div className="a" style={{ width: `${(row.availableUnits / total) * 100}%` }} />
              <div className="b" style={{ width: `${(row.bookedUnits / total) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
