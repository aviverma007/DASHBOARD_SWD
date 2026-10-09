import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import rawData from "../../data/smartworldInventory.json";
import type { RawInventoryDataset, RawUnit } from "../../types/smartworldRaw";
import { fArea } from "../../utils/smartworldLogic";
import { Card, CardHead, Chip, Chips, Empty, FullViewLink, Legend, Pill, Progress, SegBar, Sheet } from "../ui";
import { fN, pct, pctN, shortName } from "../fmt";

const RD = rawData as unknown as RawInventoryDataset;
const C_AV = "#16a06f", C_BK = "#1e3163", C_BL = "#e0a21a";
const CLS = ["av", "bk", "mg"] as const;
const STATUS = ["Available", "Booked", "Blocked"];
const TONE = ["ok", "gold", "warn"] as const;
const numSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export default function StackPlans() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [proj, setProj] = useState(0);
  const [tower, setTower] = useState<number | "all">("all");
  const [unit, setUnit] = useState<RawUnit | null>(null);

  /** per-project units (same grouping as desktop: u[0] === projectIndex) */
  const byProject = useMemo(() => {
    const m = new Map<number, RawUnit[]>();
    RD.U.forEach(u => { const l = m.get(u[0]) ?? []; l.push(u); m.set(u[0], l); });
    return m;
  }, []);
  const units = byProject.get(proj) ?? [];
  const cnt = (us: RawUnit[]) => ({
    t: us.length, av: us.filter(u => u[8] === 0).length, bk: us.filter(u => u[8] === 1).length, bl: us.filter(u => u[8] === 2).length,
  });
  const s = useMemo(() => cnt(units), [units]);
  const areaAv = useMemo(() => units.filter(u => u[8] === 0).reduce((a, u) => a + u[6], 0), [units]);
  const all = useMemo(() => cnt(RD.U), []);

  /** towers sorted like desktop (natural order on tower name) */
  const towers = useMemo(
    () => [...new Set(units.map(u => u[1]))].sort((a, b) => numSort(RD.TW[a] ?? "", RD.TW[b] ?? "")),
    [units]
  );
  const twName = (i: number) => RD.TW[i] || "Unassigned";
  const tw = tower !== "all" && towers.includes(tower) ? tower : "all";

  /** floors high → low, each with its units per tower */
  const floors = useMemo(() => {
    const fl = new Map<number, { label: string; byTower: Map<number, RawUnit[]> }>();
    units.filter(u => tw === "all" || u[1] === tw).forEach(u => {
      const e = fl.get(u[2]) ?? { label: RD.FL[u[3]] ?? `Floor ${u[2]}`, byTower: new Map<number, RawUnit[]>() };
      const l = e.byTower.get(u[1]) ?? [];
      l.push(u);
      e.byTower.set(u[1], l);
      fl.set(u[2], e);
    });
    return [...fl.entries()].sort((a, b) => b[0] - a[0]).map(([n, e]) => ({
      n, label: e.label,
      groups: [...e.byTower.entries()]
        .sort((a, b) => numSort(twName(a[0]), twName(b[0])))
        .map(([t, us]) => ({ t, us: us.sort((a, b) => numSort(a[12], b[12])) })),
    }));
  }, [units, tw]);

  const configs = useMemo(() => [...new Set(units.map(u => RD.CFG[u[4]]))].sort(), [units]);
  const pickProject = (i: number) => { setProj(i); setTower("all"); };
  const tag = (u: RawUnit) => u[12].replace(/^T\d+-/, "");

  return (
    <div className="m-stack">
      <div>
        <h1 className="m-h1">Stack plans</h1>
        <p className="m-sub">{RD.P.length} projects · {fN(all.t)} units · {fN(all.av)} available</p>
      </div>

      <Chips>
        {RD.P.map((p, i) => <Chip key={p} on={proj === i} onClick={() => pickProject(i)}>{shortName(p)}</Chip>)}
      </Chips>

      {/* availability summary header */}
      <Card>
        <CardHead title={shortName(RD.P[proj])} sub={`${fN(s.t)} units · ${towers.length} tower${towers.length === 1 ? "" : "s"}`}
          right={<Pill tone="ok">{pct(s.av, s.t)} available</Pill>} />
        <div style={{ display: "flex", gap: 8, margin: "14px 0 12px" }}>
          {([["Available", s.av, C_AV], ["Booked", s.bk, C_BK], ["Blocked", s.bl, C_BL]] as const).map(([l, v, c]) => (
            <div key={l} style={{ flex: 1, minWidth: 0, borderRadius: 12, padding: "9px 10px", background: `${c}14` }}>
              <b className="m-num" style={{ display: "block", fontSize: 20, fontWeight: 800, color: c, lineHeight: 1.1 }}>{fN(v)}</b>
              <span style={{ fontSize: 11.5, color: "var(--m-mut)", fontWeight: 600 }}>{l} · {pct(v, s.t)}</span>
            </div>
          ))}
        </div>
        <SegBar parts={[{ v: s.av, c: C_AV }, { v: s.bk, c: C_BK }, { v: s.bl, c: C_BL }]} />
        <p className="m-sub" style={{ marginTop: 10 }}>{fArea(areaAv)} available area</p>
        {s.bl > 0 && (
          <p className="m-sub" style={{ marginTop: 4 }}>
            {s.bl} blocked unit{s.bl !== 1 ? "s" : ""} — held back by the developer, not available for sale.
          </p>
        )}
      </Card>

      {s.t === 0 ? <Empty title="No units" sub="This project has no stack data." /> : (
        <>
          {towers.length > 1 && (
            <div>
              <span className="m-label">Tower</span>
              <div style={{ marginTop: 6 }}>
                <Chips>
                  <Chip on={tw === "all"} onClick={() => setTower("all")}>All towers</Chip>
                  {towers.map(t => <Chip key={t} on={tw === t} onClick={() => setTower(t)}>{twName(t)}</Chip>)}
                </Chips>
              </div>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <b style={{ fontSize: 15 }}>Floor by floor</b>
            <span className="m-sub">{floors.length} floors · top to bottom</span>
          </div>
          <Legend items={[{ l: "Available", c: C_AV }, { l: "Booked", c: C_BK }, ...(s.bl > 0 ? [{ l: "Blocked", c: C_BL }] : [])]} />

          <div className="m-card" style={{ padding: "6px 12px" }}>
            {floors.map((f, i) => (
              <div key={f.n} style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: i ? "1px solid var(--m-line)" : undefined }}>
                <div style={{ flex: "0 0 46px", fontSize: 12, fontWeight: 800, color: "var(--m-mut)", paddingTop: 10 }}>
                  {f.label.replace(/ ?floor/i, "")}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {f.groups.map(g => (
                    <div key={g.t}>
                      {tw === "all" && towers.length > 1 && <div style={{ fontSize: 11, color: "var(--m-mut)", fontWeight: 700, marginBottom: 3 }}>{twName(g.t)}</div>}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {g.us.map((u, k) => (
                          <button key={`${u[12]}-${k}`} type="button" className={`m-unit ${CLS[u[8]]}`} onClick={() => setUnit(u)}
                            aria-label={`${u[12]} ${STATUS[u[8]]}`}
                            style={{ cursor: "pointer", minWidth: 40, height: 40, padding: "0 6px", fontSize: 11 }}>{tag(u)}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Card>
            <CardHead title="By configuration" />
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              {configs.map(c => {
                const cs = cnt(units.filter(u => RD.CFG[u[4]] === c));
                return (
                  <div key={c}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, gap: 8 }}>
                      <b>{c}</b><span style={{ color: "var(--m-mut)" }}>{cs.av} avail · {pct(cs.av, cs.t)} · {cs.t} total</span>
                    </div>
                    <Progress pct={pctN(cs.av, cs.t)} color={C_AV} />
                  </div>
                );
              })}
            </div>
          </Card>

          {towers.length > 1 && (
            <Card>
              <CardHead title="By tower" />
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {towers.map(t => {
                  const ts = cnt(units.filter(u => u[1] === t));
                  return (
                    <div key={t}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, gap: 8 }}>
                        <b>{twName(t)}</b><span style={{ color: "var(--m-mut)" }}>{ts.av} avail · {pct(ts.av, ts.t)} · {ts.t} units</span>
                      </div>
                      <SegBar parts={[{ v: ts.av, c: C_AV }, { v: ts.bk, c: C_BK }, { v: ts.bl, c: C_BL }]} />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!unit} onClose={() => setUnit(null)} title={unit ? unit[12] : ""}>
        {unit && (
          <div className="m-stack">
            <div><Pill tone={TONE[unit[8]]}>{STATUS[unit[8]]}</Pill></div>
            {([
              ["Project", RD.P[unit[0]]],
              ["Tower", RD.TW[unit[1]] || "—"],
              ["Floor", RD.FL[unit[3]] ?? String(unit[2])],
              ["Configuration", RD.CFG[unit[4]]],
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
