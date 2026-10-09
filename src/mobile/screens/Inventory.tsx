import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import rawData from "../../data/smartworldInventory.json";
import type { RawInventoryDataset, RawUnit, FilterState } from "../../types/smartworldRaw";
import { makeCatOf, baseUnits, stats, groupByKey, STL, BLL, CAT } from "../../utils/smartworldLogic";
import {
  Card, CardHead, Chip, Chips, Empty, FilterBar, FullViewLink, Hero, Kpi, Legend, Pill, Progress, Row, List,
  SearchBar, Section, SegBar, Sheet, type FilterField, type FilterValues,
} from "../ui";
import { fN, pct, pctN, shortName, sqftL } from "../fmt";

const RD = rawData as unknown as RawInventoryDataset;
const C_AV = "#16a06f", C_BK = "#1e3163", C_MG = "#e0a21a";
const CLS = ["av", "bk", "mg"] as const;
const TONE = ["ok", "gold", "warn"] as const;

export default function Inventory() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const catOf = useMemo(() => makeCatOf(RD), []);
  const [proj, setProj] = useState<number | null>(null);
  const [tower, setTower] = useState<number | null>(null);
  const [filters, setFilters] = useState<FilterValues>({});
  const [q, setQ] = useState("");
  const [unit, setUnit] = useState<RawUnit | null>(null);

  const fields: FilterField[] = useMemo(() => [
    { key: "cfg", label: "Configuration", allLabel: "All BHK", options: RD.CFG.map((c, i) => ({ k: String(i), l: c })) },
    { key: "status", label: "Status", allLabel: "All status", options: [{ k: "av", l: "Available" }, { k: "bk", l: "Booked" }, { k: "blk", l: "Blocked unit" }] },
    { key: "cat", label: "Category", allLabel: "All categories", options: CAT.map((c, i) => ({ k: String(i), l: c })) },
  ], []);

  const state: FilterState = useMemo(() => ({
    proj: new Set<number>(),
    status: (filters.status as FilterState["status"]) || "all",
    cat: filters.cat ? Number(filters.cat) : -1,
    cfg: filters.cfg ? Number(filters.cfg) : -1,
  }), [filters]);

  /** units after the filter bar (all projects) — same baseUnits() as desktop */
  const arr = useMemo(() => baseUnits(RD.U, state, catOf), [state, catOf]);
  const scoped = useMemo(() => (proj === null ? arr : arr.filter(u => u[0] === proj)), [arr, proj]);
  const s = useMemo(() => stats(scoped), [scoped]);

  /** project ranking: most available first (desktop `pae`) */
  const projects = useMemo(() => {
    const m = new Map<number, RawUnit[]>();
    arr.forEach(u => { const l = m.get(u[0]) ?? []; l.push(u); m.set(u[0], l); });
    return [...m.entries()]
      .map(([i, us]) => ({ i, us, av: us.filter(u => u[8] === 0).length, bk: us.filter(u => u[8] === 1).length }))
      .sort((a, b) => b.av / b.us.length - a.av / a.us.length || b.av - a.av);
  }, [arr]);

  const towers = useMemo(() => (proj === null ? [] : groupByKey(scoped, u => u[1])), [scoped, proj]);

  const floors = useMemo(() => {
    if (proj === null || tower === null) return [];
    const m = new Map<number, RawUnit[]>();
    scoped.filter(u => u[1] === tower).forEach(u => { const l = m.get(u[2]) ?? []; l.push(u); m.set(u[2], l); });
    return [...m.entries()].sort((a, b) => b[0] - a[0])
      .map(([f, us]) => ({ f, label: RD.FL[us[0][3]] ?? String(f), us: us.sort((a, b) => a[12].localeCompare(b[12], undefined, { numeric: true })) }));
  }, [scoped, proj, tower]);

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return scoped.filter(u => u[12].toLowerCase().includes(t)).slice(0, 30);
  }, [scoped, q]);

  const twName = (i: number) => RD.TW[i] || "Unassigned tower";
  const pickProject = (p: number | null) => { setProj(p); setTower(null); setQ(""); };

  const UnitTile = ({ u }: { u: RawUnit }) => (
    <button type="button" className={`m-unit ${CLS[u[8]]}`} onClick={() => setUnit(u)}
      style={{ cursor: "pointer", padding: "0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minHeight: 44 }}
      aria-label={`${u[12]} ${STL[u[8]]}`}>{u[12].replace(/^T\d+-/, "")}</button>
  );

  return (
    <div className="m-stack">
      <div>
        <h1 className="m-h1">Inventory</h1>
        <p className="m-sub">{RD.P.length} projects · {fN(RD.U.length)} units</p>
      </div>

      <Chips>
        <Chip on={proj === null} onClick={() => pickProject(null)}>All projects</Chip>
        {RD.P.map((p, i) => <Chip key={p} on={proj === i} onClick={() => pickProject(i)}>{shortName(p)}</Chip>)}
      </Chips>
      <FilterBar fields={fields} values={filters} onApply={v => { setFilters(v); setTower(null); }} quick={["cfg", "status"]} />

      {s.t === 0 ? (
        <Empty title="No units match" sub="Try another project or reset the filters." />
      ) : (
        <>
          <Hero label={`Available · ${proj === null ? "all projects" : shortName(RD.P[proj])}`} value={`${fN(s.av)} units`}
            sub={`${sqftL(s.areaAv)} available · ${pct(s.av, s.t)} of ${fN(s.t)} units`}
            cells={[{ v: fN(s.bk), l: "Booked" }, { v: fN(s.bl), l: "Blocked" }, { v: fN(s.t), l: "Total" }]} />

          <Card>
            <CardHead title="Inventory status" sub={`${fN(s.t)} units`} />
            <div style={{ margin: "12px 0 10px" }}>
              <SegBar parts={[{ v: s.av, c: C_AV }, { v: s.bk, c: C_BK }, { v: s.bl, c: C_MG }]} />
            </div>
            <Legend items={[
              { l: "Available", c: C_AV, v: fN(s.av) },
              { l: "Booked", c: C_BK, v: fN(s.bk) },
              { l: "Blocked", c: C_MG, v: fN(s.bl) },
            ]} />
          </Card>

          <div className="m-grid2">
            <Kpi label="Available area" value={sqftL(s.areaAv)} color={C_AV} />
            <Kpi label="Booked area" value={sqftL(s.areaBk)} color={C_BK} />
          </div>
          {s.bl > 0 && (
            <p className="m-sub" style={{ margin: "0 2px" }}>
              {fN(s.bl)} blocked units ({sqftL(s.areaBl)}) are held back by the developer, not available for sale.
            </p>
          )}

          <SearchBar value={q} onChange={setQ} placeholder={proj === null ? "Search unit number" : `Search unit in ${shortName(RD.P[proj])}`} />

          {q.trim() ? (
            hits.length ? (
              <List>
                {hits.map((u, i) => (
                  <Row key={`${u[12]}-${i}`} title={u[12]} sub={`${shortName(RD.P[u[0]])} · ${RD.CFG[u[4]]} · ${RD.FL[u[3]]}`}
                    right={<Pill tone={TONE[u[8]]}>{STL[u[8]]}</Pill>} onClick={() => setUnit(u)} />
                ))}
              </List>
            ) : <Empty title="No unit found" sub="Check the unit number or the selected project." />
          ) : proj === null ? (
            <>
              <Section title="Projects" />
              {projects.map(p => (
                <Card key={p.i} onClick={() => pickProject(p.i)}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <b style={{ fontSize: 14.5, fontWeight: 800 }}>{shortName(RD.P[p.i])}</b>
                      <Pill tone="ok">{pct(p.av, p.us.length)} available</Pill>
                    </div>
                    <SegBar parts={[{ v: p.av, c: C_AV }, { v: p.bk, c: C_BK }, { v: p.us.length - p.av - p.bk, c: C_MG }]} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--m-mut)" }}>
                      <span>{fN(p.av)} available · {fN(p.bk)} booked</span><span>{fN(p.us.length)} units</span>
                    </div>
                  </div>
                </Card>
              ))}
            </>
          ) : tower === null ? (
            <>
              <Section title="Towers" />
              <List>
                {towers.map(t => (
                  <Row key={t.k} title={twName(t.k)} sub={`${fN(t.av)} of ${fN(t.us.length)} available`}
                    right={<div style={{ width: 84, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                      <b className="m-num" style={{ fontSize: 13 }}>{pct(t.av, t.us.length)}</b>
                      <div style={{ width: "100%" }}><Progress pct={pctN(t.av, t.us.length)} color={C_AV} /></div>
                    </div>}
                    onClick={() => setTower(t.k)} />
                ))}
              </List>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" className="m-btn" style={{ width: "auto", minHeight: 44, padding: "0 16px" }} onClick={() => setTower(null)}>‹ Towers</button>
                <b style={{ fontSize: 16 }}>{twName(tower)}</b>
              </div>
              <Legend items={[{ l: "Available", c: C_AV }, { l: "Booked", c: C_BK }, { l: "Blocked", c: C_MG }]} />
              {floors.map(fl => (
                <Card key={fl.f}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                    <b>{fl.label}</b>
                    <span style={{ color: "var(--m-mut)" }}>{fl.us.filter(u => u[8] === 0).length} of {fl.us.length} available</span>
                  </div>
                  <div className="m-units">{fl.us.map((u, i) => <UnitTile key={`${u[12]}-${i}`} u={u} />)}</div>
                </Card>
              ))}
            </>
          )}
        </>
      )}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!unit} onClose={() => setUnit(null)} title={unit ? unit[12] : ""}>
        {unit && (
          <div className="m-stack">
            <div><Pill tone={TONE[unit[8]]}>{STL[unit[8]]}{unit[8] === 2 ? ` · ${BLL[unit[9]]}` : ""}</Pill></div>
            {([
              ["Project", RD.P[unit[0]]],
              ["Tower", RD.TW[unit[1]] || "—"],
              ["Floor", RD.FL[unit[3]]],
              ["Configuration", RD.CFG[unit[4]]],
              ["Unit type", RD.UT[unit[5]]],
              ["Super area", `${fN(unit[6])} sq ft`],
            ] as const).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 14, padding: "8px 0", borderBottom: "1px solid var(--m-line)" }}>
                <span style={{ color: "var(--m-mut)" }}>{k}</span><b style={{ textAlign: "right", overflowWrap: "anywhere" }}>{v}</b>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
