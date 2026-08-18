import type { ConfigGapCell } from "../../utils/inventoryStats";

interface ConfigGapMatrixProps {
  matrix: ConfigGapCell[][];
  projectOrder: number[];
  projectNames: string[];
  configNames: string[];
  gaps: string[];
  onCellClick?: (projectIndex: number, configIndex: number) => void;
}

const BAND_STYLES: Record<ConfigGapCell["band"], string> = {
  sold_out: "bg-inv-gap-soldout-bg text-inv-gap-soldout-text",
  low: "bg-inv-gap-low-bg text-inv-gap-low-text",
  available: "bg-inv-gap-available-bg text-inv-gap-available-text",
  high: "bg-inv-gap-high-bg text-inv-gap-high-text",
};

export function ConfigGapMatrix({
  matrix,
  projectOrder,
  projectNames,
  configNames,
  gaps,
  onCellClick,
}: ConfigGapMatrixProps) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-1.5 pb-1.5 text-left text-inv-mut">Project</th>
              {configNames.map((name) => (
                <th key={name} className="whitespace-nowrap px-1.5 pb-1.5 text-center text-inv-mut">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => {
              const projectIndex = projectOrder[rowIndex];
              return (
                <tr key={projectIndex}>
                  <td className="sticky left-0 z-10 whitespace-nowrap border-t border-inv-line bg-white px-2 py-2.5 text-left">
                    {projectNames[projectIndex]}
                  </td>
                  {row.map((cell) => {
                    if (cell.total === 0) {
                      return (
                        <td
                          key={cell.configIndex}
                          className="border-t border-inv-line px-2 py-2.5 text-center text-inv-line"
                          style={{ fontFamily: "var(--font-serif-display)" }}
                        >
                          ·
                        </td>
                      );
                    }
                    return (
                      <td
                        key={cell.configIndex}
                        onClick={() => onCellClick?.(cell.projectIndex, cell.configIndex)}
                        title={`${cell.available} available of ${cell.total}`}
                        className={`cursor-pointer border-t border-inv-line px-2 py-2.5 text-center hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-inv-gold ${BAND_STYLES[cell.band]}`}
                        style={{ fontFamily: "var(--font-serif-display)" }}
                      >
                        {cell.available}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-inv-mut">
        <LegendSwatch className="bg-inv-gap-soldout-bg" label="sold out" />
        <LegendSwatch className="bg-inv-gap-low-bg" label="low (<15% available)" />
        <LegendSwatch className="bg-inv-gap-available-bg" label="available" />
        <LegendSwatch className="bg-inv-gap-high-bg" label="high availability (>60%)" />
      </div>

      {gaps.length > 0 && (
        <div className="mt-2.5 rounded-r-[10px] border border-[#ecd9b0] border-l-3 border-l-inv-gold bg-[#fbf7ee] px-3.5 py-2.5 text-[13px] text-[#5a4a24]">
          Gaps — demand you can't currently fill: {gaps.slice(0, 8).join(" · ")}
          {gaps.length > 8 ? " …" : ""}.
        </div>
      )}
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}
