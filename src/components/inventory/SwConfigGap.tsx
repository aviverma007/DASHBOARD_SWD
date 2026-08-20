import type { RawUnit } from "../../types/smartworldRaw";

interface SwConfigGapProps {
  arr: RawUnit[];
  rowsP: number[]; // project indices, availability-sorted
  cols: number[]; // config indices, 0..CFG.length-1
  P: string[];
  CFG: string[];
  onCellClick: (projectIndex: number, configIndex: number) => void;
}

/** Direct port of the "config gap matrix" block inside renderOverview(). */
export function SwConfigGap({ arr, rowsP, cols, P, CFG, onCellClick }: SwConfigGapProps) {
  const gaps: string[] = [];

  const rows = rowsP.map((i) => {
    const cells = cols.map((b) => {
      const us = arr.filter((u) => u[0] === i && u[4] === b);
      if (!us.length) {
        return { empty: true as const, b };
      }
      const av = us.filter((u) => u[8] === 0).length;
      const ratio = av / us.length;
      const cls = av === 0 ? "g_0" : ratio < 0.15 ? "g_1" : ratio > 0.6 ? "g_3" : "g_2";
      if (av === 0 && us.length >= 5) {
        gaps.push(`${CFG[b]} sold out at ${P[i].replace("Smartworld ", "")}`);
      }
      return { empty: false as const, b, av, total: us.length, cls };
    });
    return { i, cells };
  });

  return (
    <div className="mxwrap">
      <table className="mx">
          <thead>
            <tr>
              <th>Project</th>
              {cols.map((b) => (
                <th key={b}>{CFG[b]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.i}>
                <td>{P[row.i]}</td>
                {row.cells.map((cell) =>
                  cell.empty ? (
                    <td key={cell.b} style={{ color: "#cfc9ba" }}>
                      ·
                    </td>
                  ) : (
                    <td
                      key={cell.b}
                      className={`cell ${cell.cls}`}
                      title={`${cell.av} available of ${cell.total}`}
                      onClick={() => onCellClick(row.i, cell.b)}
                    >
                      {cell.av}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend" style={{ marginTop: 12 }}>
        <span>
          <span className="sw g_0" /> sold out
        </span>
        <span>
          <span className="sw g_1" /> low (&lt;15% available)
        </span>
        <span>
          <span className="sw g_2" /> available
        </span>
        <span>
          <span className="sw g_3" /> high availability (&gt;60%)
        </span>
      </div>
      {gaps.length > 0 && (
        <div className="insight" style={{ marginTop: 10 }}>
          Gaps — demand you can't currently fill: {gaps.slice(0, 8).join(" · ")}
          {gaps.length > 8 ? " …" : ""}.
        </div>
      )}
    </div>
  );
}
