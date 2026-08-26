import type { RawUnit } from "../../types/smartworldRaw";

interface SwBlkByProjCardProps {
  arr: RawUnit[];
  P: string[];
  onRowClick: (projectIndex: number) => void;
}

/** Direct port of blkByProjCard(arr) — shown when the top Status filter is "Blocked unit". */
export function SwBlkByProjCard({ arr, P, onRowClick }: SwBlkByProjCardProps) {
  const bl = arr.filter((u) => u[8] === 2);
  if (!bl.length) return null;

  const byP = new Map<number, RawUnit[]>();
  bl.forEach((u) => {
    const list = byP.get(u[0]) ?? [];
    list.push(u);
    byP.set(u[0], list);
  });

  const rows = Array.from(byP.entries())
    .map(([i, us]) => ({ i, n: us.length }))
    .sort((a, b) => b.n - a.n);

  const total = bl.length;

  return (
    <div className="card">
      <h3>
        Blocked units by project{" "}
        <span className="hint">total {total} units · not available for sale · click a row → project</span>
      </h3>
      <div className="mxwrap">
        <table className="mx">
          <thead>
            <tr>
              <th>Project</th>
              <th style={{ textAlign: "right" }}>Blocked units</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.i} onClick={() => onRowClick(r.i)} style={{ cursor: "pointer" }}>
                <td>{P[r.i]}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{r.n}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, borderTop: "2px solid var(--ink)" }}>
              <td>Total</td>
              <td style={{ textAlign: "right" }}>{total}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
