import { useMemo, useState } from "react";
import type { RawUnit } from "../../types/smartworldRaw";
import { SwStatusPill } from "./swPieces";

interface SwRecordsCardProps {
  arr: RawUnit[];
  P: string[];
  TW: string[];
  FL: string[];
  CFG: string[];
  UT: string[];
  onRowClick: (unit: RawUnit) => void;
}

const PER = 10;

/** recSort(a) — available-first, then largest area first. */
function recSort(a: RawUnit[]): RawUnit[] {
  return a.slice().sort((x, y) => x[8] - y[8] || y[6] - x[6]);
}

/** Direct port of recordsCard/recFilter/pagerHTML/unitRow — search box,
 * table, and pager, matching the source's "Unit records" card. The
 * "Unit cost" column is dropped — this app shows area, not value. */
export function SwRecordsCard({ arr, P, TW, FL, CFG, UT, onRowClick }: SwRecordsCardProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = !q
      ? arr
      : arr.filter((u) => {
          const t = `${P[u[0]]} ${TW[u[1]] || ""} ${CFG[u[4]]} ${UT[u[5]]} ${FL[u[3]]} ${u[12]}`.toLowerCase();
          return t.indexOf(q) >= 0;
        });
    return recSort(filtered);
  }, [arr, query, P, TW, CFG, UT, FL]);

  const tot = sorted.length;
  const pages = Math.ceil(tot / PER) || 1;
  const safePage = Math.min(Math.max(page, 0), pages - 1);
  const from = tot ? safePage * PER : 0;
  const to = Math.min(from + PER, tot);
  const rows = sorted.slice(from, to);

  function handleQueryChange(v: string) {
    setQuery(v);
    setPage(0);
  }

  return (
    <div className="card">
      <h3>
        Unit records{" "}
        <span className="hint">{arr.length.toLocaleString("en-IN")} units · available first · click a row → detail</span>
      </h3>
      <input
        className="search"
        placeholder="Search project, tower, config, floor…"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
      />
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Tower</th>
            <th>Floor</th>
            <th>Config</th>
            <th className="n">Super area</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u[12]} onClick={() => onRowClick(u)}>
              <td>{P[u[0]].replace("Smartworld ", "")}</td>
              <td>{TW[u[1]] || "—"}</td>
              <td>{FL[u[3]]}</td>
              <td>{CFG[u[4]]}</td>
              <td className="n">{u[6].toLocaleString("en-IN")} sq ft</td>
              <td>
                <SwStatusPill status={u[8]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="recpgr">
        {tot > PER ? (
          <>
            <span className="pgi">
              {from + 1}–{to} of {tot.toLocaleString("en-IN")} units
            </span>
            <span>
              <button
                className="pgb"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹ Prev
              </button>
              <button
                className="pgb"
                disabled={safePage >= pages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next ›
              </button>
            </span>
          </>
        ) : (
          <span className="pgi">{tot.toLocaleString("en-IN")} units</span>
        )}
      </div>
    </div>
  );
}
