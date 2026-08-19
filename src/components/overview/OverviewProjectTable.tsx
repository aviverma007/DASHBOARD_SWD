import type { ProjectContribution } from "../../types/domain";
import { useDrilldownStore } from "../../store/drilldownStore";
import { fArea } from "../../utils/smartworldLogic";

interface OverviewProjectTableProps {
  data: ProjectContribution[];
}

/**
 * Replaces ProjectBreakupTable — same data, same row-click-to-drill
 * behavior, restyled to Inventory's plain table markup (th/td, td.n for
 * right-aligned numeric columns) inside a .card shell instead of the
 * Tailwind rounded-2xl card it used before.
 */
export function OverviewProjectTable({ data }: OverviewProjectTableProps) {
  const openDrilldown = useDrilldownStore((s) => s.open);

  return (
    <div className="card">
      <h3>Project-wise Breakup</h3>
      <div className="mxwrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th className="n">Available</th>
              <th className="n">Booked</th>
              <th className="n">Total</th>
              <th className="n">Booked %</th>
              <th className="n">Area</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={row.projectId}
                onClick={() =>
                  openDrilldown({ level: "project", id: row.projectId, label: row.projectName }, "total")
                }
              >
                <td>{row.projectName}</td>
                <td className="n" style={{ color: "var(--av)" }}>
                  {row.availableUnits.toLocaleString("en-IN")}
                </td>
                <td className="n" style={{ color: "var(--bk)" }}>
                  {row.bookedUnits.toLocaleString("en-IN")}
                </td>
                <td className="n" style={{ fontWeight: 600 }}>
                  {row.totalUnits.toLocaleString("en-IN")}
                </td>
                <td className="n" style={{ color: "var(--mut)" }}>
                  {row.bookedPercent.toFixed(1)}%
                </td>
                <td className="n" style={{ color: "var(--mut)" }}>
                  {fArea(row.totalArea)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
