import type { InventoryUnit } from "../../types/inventoryRaw";

interface ManagementBreakdownProps {
  units: InventoryUnit[]; // full scope, will be filtered to MANAGEMENT internally
}

const SUB_LABELS = ["On hold", "In progress", "Management unit"];

export function ManagementBreakdown({ units }: ManagementBreakdownProps) {
  const managementUnits = units.filter((u) => u.status === "MANAGEMENT");
  if (managementUnits.length === 0) return null;

  const byProject = new Map<number, InventoryUnit[]>();
  managementUnits.forEach((u) => {
    const arr = byProject.get(u.projectIndex) ?? [];
    arr.push(u);
    byProject.set(u.projectIndex, arr);
  });

  const rows = Array.from(byProject.entries())
    .map(([projectIndex, projectUnits]) => ({
      projectIndex,
      projectName: projectUnits[0].projectName,
      count: projectUnits.length,
      subCounts: SUB_LABELS.map(
        (_, i) => projectUnits.filter((u) => u.managementSubCategory === i).length
      ),
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <div className="mb-3.5 rounded-[10px] border border-[#ecd9b0] bg-[#fbf3e9] px-3.5 py-2.5 text-[12.5px] text-[#7a5a2a]">
        Management units: {managementUnits.length} — held back by the developer, not available for
        sale
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="px-2 pb-2 text-left text-[11px] font-normal text-inv-mut">Project</th>
              <th className="px-2 pb-2 text-right text-[11px] font-normal text-inv-mut">
                Management units
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.projectIndex} className="border-t border-inv-line">
                <td className="px-2 py-2.5">{row.projectName}</td>
                <td className="px-2 py-2.5 text-right">{row.count}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-inv-ink font-bold">
              <td className="px-2 py-2.5">Total</td>
              <td className="px-2 py-2.5 text-right">{managementUnits.length}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
