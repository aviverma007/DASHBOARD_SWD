import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import raw from "../../data/cpAnalytics.json";
import { Card, CardHead, Chip, Chips, Empty, FilterBar, FullViewLink, Hero, Insight, Kpi, Legend, Pill, Row, List, Section, SearchBar, SegBar, Sheet, type FilterField, type FilterValues } from "../ui";
import { fN, inrCr, pct, pctN, MONTHS } from "../fmt";

/* Same semantics as the desktop SAP Collections page: active bookings only (r[13]===0),
   TCV r[26], called r[22], received r[24]-r[25], due = called - received, future = TCV - called. */
const CD = raw as unknown as { P: string[]; R: number[][]; meta: { asOn: string } };
interface Bk { proj: string; unit: string; y: number; m: number; tcv: number; called: number; rec: number; due: number; fut: number }
const ROWS: Bk[] = CD.R.filter(r => r[13] === 0).map(r => {
  const tcv = r[26] ?? 0, called = r[22] ?? 0, rec = (r[24] ?? 0) - (r[25] ?? 0);
  return { proj: CD.P[r[0]], unit: String(r[9]), y: r[7], m: r[8], tcv, called, rec, due: called - rec, fut: tcv - called };
});
const PROJECTS = [...new Set(ROWS.map(b => b.proj))].sort((a, b) => a.localeCompare(b));
const YEARS = [...new Set(ROWS.map(b => b.y))].filter(y => y > 0).sort((a, b) => b - a);

interface Agg { label: string; n: number; dueUnits: number; tcv: number; called: number; rec: number; due: number; fut: number }
const agg = (rows: Bk[], label: string): Agg => {
  const a: Agg = { label, n: rows.length, dueUnits: 0, tcv: 0, called: 0, rec: 0, due: 0, fut: 0 };
  for (const b of rows) { a.tcv += b.tcv; a.called += b.called; a.rec += b.rec; a.due += b.due; a.fut += b.fut; if (b.due > 0) a.dueUnits++; }
  return a;
};

const GREEN = "#16a06f", RED = "#d64545", GREY = "#d5daea", NAVY = "#1e3163", GOLD = "#b8893c";
const FIELDS: FilterField[] = [
  { key: "proj", label: "Project", options: PROJECTS.map(p => ({ k: p, l: p })), allLabel: "All projects" },
  { key: "year", label: "Booking year", options: YEARS.map(y => ({ k: String(y), l: String(y) })), allLabel: "All years" },
];

export default function Collections() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [f, setF] = useState<FilterValues>({});
  const [drill, setDrill] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const scope = useMemo(() => ROWS.filter(b => (!f.proj || b.proj === f.proj) && (!f.year || String(b.y) === f.year)), [f]);
  const tot = useMemo(() => agg(scope, "Total"), [scope]);
  const byProj = useMemo(() => {
    const m = new Map<string, Bk[]>();
    scope.forEach(b => { if (!m.has(b.proj)) m.set(b.proj, []); m.get(b.proj)!.push(b); });
    return [...m.entries()].map(([p, r]) => agg(r, p)).sort((a, b) => b.due - a.due);
  }, [scope]);

  const drillRows = useMemo(() => {
    if (!drill) return [];
    const t = q.trim().toLowerCase();
    return scope.filter(b => b.proj === drill && (!t || b.unit.toLowerCase().includes(t))).sort((a, b) => b.due - a.due);
  }, [drill, scope, q]);
  const drillAgg = useMemo(() => (drill ? agg(scope.filter(b => b.proj === drill), drill) : null), [drill, scope]);

  const closeDrill = () => { setDrill(null); setQ(""); };
  const setYear = (y: string) => setF(v => ({ ...v, year: y }));

  return (
    <div className="m-stack">
      <div><h1 className="m-h1">SAP Collections</h1><p className="m-sub">{fN(ROWS.length)} active bookings · as on {CD.meta.asOn}</p></div>

      <FilterBar fields={FIELDS} values={f} onApply={setF} quick={["proj"]} />
      <Chips>
        <Chip on={!f.year} onClick={() => setYear("")}>All periods</Chip>
        {YEARS.slice(0, 6).map(y => <Chip key={y} on={f.year === String(y)} onClick={() => setYear(String(y))}>{y}</Chip>)}
      </Chips>

      {scope.length === 0 ? <Empty title="No bookings" sub="No active bookings match these filters." /> : <>
        <Hero label="Collected vs demand" value={pct(tot.rec, tot.called, 1)}
          sub={`${inrCr(tot.rec)} received of ${inrCr(tot.called)} demanded`}
          cells={[{ v: inrCr(tot.tcv, 0), l: "TCV" }, { v: fN(tot.n), l: "Bookings" }, { v: fN(tot.dueUnits), l: "Units with dues" }]}>
          <div style={{ marginTop: 12 }}><SegBar parts={[{ v: Math.max(tot.rec, 0), c: "#4fd1a0" }, { v: Math.max(tot.due, 0), c: "#ff8a80" }]} /></div>
        </Hero>

        <div className="m-grid2">
          <Kpi label="Demand raised" value={inrCr(tot.called)} sub={`${pct(tot.called, tot.tcv)} of TCV`} color={NAVY} accent />
          <Kpi label="Received" value={inrCr(tot.rec)} sub={`${pct(tot.rec, tot.called, 1)} of demand`} color={GREEN} accent />
        </div>
        <Kpi label="Net due (demand − received)" value={inrCr(tot.due)} sub={`${fN(tot.dueUnits)} units with dues`} color={RED} accent />
        <Kpi label="Future dues (TCV − demand)" value={inrCr(tot.fut)} sub="Not yet demanded" color={GOLD} />

        <Card>
          <CardHead title="Where the money sits" sub="Share of TCV" />
          <div style={{ margin: "12px 0 10px" }}>
            <SegBar parts={[{ v: Math.max(tot.rec, 0), c: GREEN }, { v: Math.max(tot.due, 0), c: RED }, { v: Math.max(tot.fut, 0), c: GREY }]} />
          </div>
          <Legend items={[{ l: "Received", c: GREEN, v: pct(tot.rec, tot.tcv) }, { l: "Net due", c: RED, v: pct(tot.due, tot.tcv) }, { l: "Future", c: GREY, v: pct(tot.fut, tot.tcv) }]} />
        </Card>

        {byProj.length > 0 && <>
          <Section title="Collection rate" />
          <div className="m-hscroll">
            {byProj.slice(0, 8).map(a => (
              <div key={a.label} style={{ minWidth: 270, scrollSnapAlign: "start" }}>
                <Insight label={a.label} value={pct(a.rec, a.called)} sub={`${inrCr(a.rec)} of ${inrCr(a.called)}`}
                  pct={pctN(a.rec, a.called)} color={pctN(a.rec, a.called) >= 75 ? GREEN : pctN(a.rec, a.called) >= 50 ? GOLD : RED} onClick={() => setDrill(a.label)} />
              </div>
            ))}
          </div>

          <Section title="Projects by net due" />
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {byProj.map(a => (
                <button key={a.label} type="button" onClick={() => setDrill(a.label)}
                  style={{ all: "unset", cursor: "pointer", display: "block", minHeight: 44, boxSizing: "border-box" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14, fontWeight: 700 }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</span>
                    <span className="m-num" style={{ color: RED }}>{inrCr(a.due)}</span>
                  </div>
                  <div style={{ margin: "6px 0 4px" }}>
                    <SegBar parts={[{ v: Math.max(a.rec, 0), c: GREEN }, { v: Math.max(a.due, 0), c: RED }, { v: Math.max(a.fut, 0), c: GREY }]} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--m-mut)" }}>
                    {inrCr(a.rec)} recd · {pct(a.rec, a.called)} collected · {inrCr(a.fut)} future
                  </div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12 }}><Legend items={[{ l: "Received", c: GREEN }, { l: "Net due", c: RED }, { l: "Future", c: GREY }]} /></div>
          </Card>

          <Section title="Top dues" />
          <List>
            {byProj.filter(a => a.due > 0).slice(0, 8).map((a, i) => (
              <Row key={a.label} rank={i + 1} title={a.label} sub={`${fN(a.dueUnits)} units with dues · ${pct(a.rec, a.called)} collected`}
                value={inrCr(a.due)} valueSub={`of ${inrCr(a.called)}`} onClick={() => setDrill(a.label)} />
            ))}
          </List>
        </>}
      </>}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!drill} onClose={closeDrill} title={drill ?? ""}>
        {drillAgg && <>
          <div className="m-grid2" style={{ marginBottom: 12 }}>
            <Kpi label="TCV" value={inrCr(drillAgg.tcv)} sub={`${fN(drillAgg.n)} bookings`} color={NAVY} />
            <Kpi label="Demand" value={inrCr(drillAgg.called)} sub={`${pct(drillAgg.called, drillAgg.tcv)} of TCV`} color="#0e7490" />
            <Kpi label="Received" value={inrCr(drillAgg.rec)} sub={`${pct(drillAgg.rec, drillAgg.called, 1)} collected`} color={GREEN} />
            <Kpi label="Net due" value={inrCr(drillAgg.due)} sub={`${fN(drillAgg.dueUnits)} units with dues`} color={RED} />
          </div>
          <SearchBar value={q} onChange={setQ} placeholder="Search unit number" />
          <div style={{ marginTop: 8 }}>
            {drillRows.length === 0 ? <Empty title="No units" sub="Try a different unit number." /> : <>
              <List>
                {drillRows.slice(0, 80).map((b, i) => (
                  <Row key={b.unit + i} title={b.unit} sub={`${b.m >= 1 && b.m <= 12 ? MONTHS[b.m - 1] + " " : ""}${b.y || ""} · TCV ${inrCr(b.tcv)}`}
                    value={inrCr(b.due)} valueSub={`recd ${inrCr(b.rec)}`} right={b.due > 1000 ? <Pill tone="bad">Due</Pill> : <Pill tone="ok">Clear</Pill>} />
                ))}
              </List>
              {drillRows.length > 80 && <p className="m-sub" style={{ textAlign: "center", marginTop: 8 }}>Showing top 80 of {fN(drillRows.length)} by net due. Search to narrow.</p>}
            </>}
          </div>
        </>}
      </Sheet>
    </div>
  );
}
