import { useMemo, useState } from "react";
import type { InventoryUnit } from "../../types/inventoryRaw";
import { formatCrore } from "../../utils/format";

interface UnitRecordTableProps {
  units: InventoryUnit[];
  onRowClick: (unit: InventoryUnit) => void;
}

const STATUS_PILL: Record<InventoryUnit["status"], string> = {
  AVAILABLE: "bg-[#e2f3ec] text-[#0f6e56]",
  BOOKED: "bg-[#eee9df] text-[#6b6b6b]",
  MANAGEMENT: "bg-[#f7ead9] text-[#8a531b]",
};

const STATUS_LABEL: Record<InventoryUnit["status"], string> = {
  AVAILABLE: "Available",
  BOOKED: "Booked",
  MANAGEMENT: "Management",
};

const PER_PAGE = 10;

export function UnitRecordTable({ units, onRowClick }: UnitRecordTableProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? units.filter((u) => {
          const haystack = `${u.projectName} ${u.towerName} ${u.configName} ${u.unitTypeName} ${u.floorLabel} ${u.unitLabel}`.toLowerCase();
          return haystack.includes(q);
        })
      : units;
    // Sort available-first, then by value descending — matches source tool.
    return base.slice().sort((a, b) => {
      const statusOrder = { AVAILABLE: 0, BOOKED: 1, MANAGEMENT: 2 } as const;
      return statusOrder[a.status] - statusOrder[b.status] || b.cost - a.cost;
    });
  }, [units, query]);

  const total = filtered.length;
  const pages = Math.ceil(total / PER_PAGE) || 1;
  const safePage = Math.min(page, pages - 1);
  const from = total ? safePage * PER_PAGE : 0;
  const to = Math.min(from + PER_PAGE, total);
  const pageRows = filtered.slice(from, to);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
        placeholder="Search project, tower, config, floor…"
        className="mb-2.5 w-full rounded-lg border border-[#cfc8b8] px-2.5 py-2 text-[13px]"
      />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="px-2 pb-2 text-left text-[11px] font-normal text-inv-mut">Project</th>
              <th className="px-2 pb-2 text-left text-[11px] font-normal text-inv-mut">Tower</th>
              <th className="px-2 pb-2 text-left text-[11px] font-normal text-inv-mut">Floor</th>
              <th className="px-2 pb-2 text-left text-[11px] font-normal text-inv-mut">Config</th>
              <th className="px-2 pb-2 text-right text-[11px] font-normal text-inv-mut">Area</th>
              <th className="px-2 pb-2 text-right text-[11px] font-normal text-inv-mut">Value</th>
              <th className="px-2 pb-2 text-left text-[11px] font-normal text-inv-mut">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((unit) => (
              <tr
                key={unit.index}
                onClick={() => onRowClick(unit)}
                className="cursor-pointer border-t border-inv-line hover:bg-inv-bg"
              >
                <td className="truncate px-2 py-2.5">{unit.projectName.replace("Smartworld ", "")}</td>
                <td className="truncate px-2 py-2.5">{unit.towerName || "—"}</td>
                <td className="truncate px-2 py-2.5">{unit.floorLabel}</td>
                <td className="truncate px-2 py-2.5">{unit.configName}</td>
                <td className="px-2 py-2.5 text-right">{unit.area.toLocaleString("en-IN")} sq ft</td>
                <td className="px-2 py-2.5 text-right">{formatCrore(unit.cost)}</td>
                <td className="px-2 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${STATUS_PILL[unit.status]}`}>
                    {STATUS_LABEL[unit.status]}
                  </span>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-inv-mut">
                  No units match this search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-inv-mut">
        {total > PER_PAGE ? (
          <>
            <span>
              {from + 1}–{to} of {total.toLocaleString("en-IN")} units
            </span>
            <span>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage <= 0}
                className="ml-2 rounded-md border border-inv-line bg-white px-3 py-1.5 text-xs text-inv-ink hover:border-inv-gold disabled:cursor-default disabled:opacity-40"
              >
                ‹ Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                disabled={safePage >= pages - 1}
                className="ml-2 rounded-md border border-inv-line bg-white px-3 py-1.5 text-xs text-inv-ink hover:border-inv-gold disabled:cursor-default disabled:opacity-40"
              >
                Next ›
              </button>
            </span>
          </>
        ) : (
          <span>{total.toLocaleString("en-IN")} units</span>
        )}
      </div>
    </div>
  );
}
