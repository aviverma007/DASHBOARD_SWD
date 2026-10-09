import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AreaChart, Card, CardHead, Empty, FilterBar, FullViewLink, HBars, Hero, Kpi, Legend, Pill, Row, List, SearchBar, Section, SegBar, Seg, Sheet, type FilterValues } from "../ui";
import { fN, pct } from "../fmt";
import { AGE_BANDS, CASES, CM, ageBand, fmtDay, fyLbl, fyOf, isClosed, loadLiveCases, tatBucket, ymLbl, ymOf, type CaseRec } from "../../components/cases/caseShared";

export default function Cases() {
  const [stamp, setStamp] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    loadLiveCases("http://192.168.66.28:5002").then(st => { if (alive && st) setStamp(st); });
    return () => { alive = false; };
  }, []);
  return <CasesInner key={stamp ?? "snapshot"} />;
}

const opts = (names: string[]) => names.map((l, i) => ({ k: String(i), l })).filter(o => o.l);
const TAT_LBL = { overdue: "Overdue", atrisk: "At risk", within: "Within TAT" } as const;
const TAT_TONE = { overdue: "bad", atrisk: "warn", within: "ok" } as const;
const TAT_CLR = { overdue: "#d64545", atrisk: "#e0a030", within: "#16a06f" } as const;

function CasesInner() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [fv, setFv] = useState<FilterValues>({});
  const [scope, setScope] = useState<"open" | "closed" | "all">("open");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(30);
  const [sel, setSel] = useState<CaseRec | null>(null);
  const [trendKind, setTrendKind] = useState<"raised" | "closed">("raised");

  const fields = useMemo(() => {
    const dated = CASES.filter(c => c.open >= 0);
    const fys = [...new Set(dated.map(c => fyOf(c.open)))].sort((a, b) => b - a).map(y => ({ k: `y:${y}`, l: fyLbl(y) }));
    const ms = [...new Set(dated.map(c => ymOf(c.open)))].sort().reverse().slice(0, 18).map(m => ({ k: `m:${m}`, l: ymLbl(m) }));
    return [
      { key: "area", label: "Category", options: opts(CM.AREA), allLabel: "All categories" },
      { key: "sta", label: "Status", options: opts(CM.STA), allLabel: "All statuses" },
      { key: "typ", label: "Case type", options: opts(CM.TYP), allLabel: "All types" },
      { key: "pri", label: "Priority", options: opts(CM.PRI), allLabel: "All priorities" },
      { key: "prj", label: "Project", options: opts(CM.PRJ), allLabel: "All projects" },
      { key: "org", label: "Origin", options: opts(CM.ORG), allLabel: "All origins" },
      { key: "per", label: "Raised in", options: [...fys, ...ms], allLabel: "All time" },
    ];
  }, []);

  const filtered = useMemo(() => CASES.filter(c => {
    for (const k of ["area", "sta", "typ", "pri", "prj", "org"] as const) if (fv[k] && c[k] !== Number(fv[k])) return false;
    if (fv.per) {
      const [t, v] = fv.per.split(":");
      if (c.open < 0 || (t === "y" ? String(fyOf(c.open)) !== v : ymOf(c.open) !== v)) return false;
    }
    return true;
  }), [fv]);

  const open = useMemo(() => filtered.filter(c => !isClosed(c)), [filtered]);
  const closed = filtered.length - open.length;
  const tat = useMemo(() => {
    const t = { overdue: 0, atrisk: 0, within: 0 };
    open.forEach(c => { t[tatBucket(c)]++; });
    return t;
  }, [open]);
  const hniOpen = open.filter(c => c.hni === 1).length;
  const ageing = useMemo(() => {
    const m = new Array(AGE_BANDS.length).fill(0) as number[];
    open.forEach(c => { m[ageBand(c.age)]++; });
    return m;
  }, [open]);
  const trend = useMemo(() => {
    const m = new Map<string, { o: number; c: number }>();
    filtered.forEach(c => {
      if (c.open >= 0) { const k = ymOf(c.open); if (!m.has(k)) m.set(k, { o: 0, c: 0 }); m.get(k)!.o++; }
      if (c.closed >= 0) { const k = ymOf(c.closed); if (!m.has(k)) m.set(k, { o: 0, c: 0 }); m.get(k)!.c++; }
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  }, [filtered]);
  const trendTot = trend.reduce((s, [, v]) => ({ o: s.o + v.o, c: s.c + v.c }), { o: 0, c: 0 });
  const cats = useMemo(() => {
    const m = new Map<number, number>();
    open.forEach(c => { if (c.area >= 0) m.set(c.area, (m.get(c.area) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [open]);

  const list = useMemo(() => {
    const s = q.trim();
    let r = scope === "all" ? filtered : filtered.filter(c => (scope === "open") === !isClosed(c));
    if (s) r = r.filter(c => c.caseNo.includes(s));
    return [...r].sort((a, b) => b.age - a.age);
  }, [filtered, scope, q]);

  const stName = (c: CaseRec) => (c.sta >= 0 ? CM.STA[c.sta] : "—");
  const nm = (arr: string[], i: number) => (i >= 0 ? arr[i] : "—");

  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Case Management</h1><p className="m-sub">Customer cases &amp; TAT · as on {CM.meta.asOn}</p></div>
      <FilterBar fields={fields} values={fv} onApply={v => { setFv(v); setLimit(30); }} quick={["area", "sta"]} />

      <Hero label="Open cases" value={fN(open.length)} sub={`${fN(filtered.length)} total · ${fN(closed)} closed (${pct(closed, filtered.length)})`}>
        <div style={{ marginTop: 14 }}>
          <SegBar parts={[{ v: tat.overdue, c: TAT_CLR.overdue }, { v: tat.atrisk, c: TAT_CLR.atrisk }, { v: tat.within, c: TAT_CLR.within }]} />
          <div style={{ marginTop: 8 }}>
            <Legend items={(["overdue", "atrisk", "within"] as const).map(k => ({ l: TAT_LBL[k], c: TAT_CLR[k], v: fN(tat[k]) }))} />
          </div>
        </div>
      </Hero>

      <div className="m-grid2">
        <Kpi label="Beyond TAT" value={fN(tat.overdue)} sub={`${pct(tat.overdue, open.length)} of open`} color="#d64545" />
        <Kpi label="At risk" value={fN(tat.atrisk)} sub="escalated" color="#e0a030" />
        <Kpi label="Closed" value={fN(closed)} sub={`${pct(closed, filtered.length)} closure rate`} color="#16a06f" accent />
        <Kpi label="HNI open" value={fN(hniOpen)} sub="priority customers" color="#1e3163" />
      </div>

      <Card>
        <CardHead title="Open cases by age" sub="Days since raised" />
        <div style={{ marginTop: 10 }}>
          <HBars format={fN} color="#1e3163" rows={AGE_BANDS.map(b => ({ label: b.label, value: ageing[b.k], color: b.k >= 4 ? "#d64545" : undefined }))} />
        </div>
      </Card>

      <Card>
        <CardHead title="Raised vs closed" sub="Last 12 months"
          right={<div style={{ width: 150 }}><Seg value={trendKind} options={[{ k: "raised", l: "Raised" }, { k: "closed", l: "Closed" }]} onChange={setTrendKind} /></div>} />
        <div style={{ marginTop: 8 }}>
          <AreaChart data={trend.map(([k, v]) => ({ label: ymLbl(k), value: trendKind === "raised" ? v.o : v.c }))} format={fN} unit={trendKind}
            color={trendKind === "raised" ? "#1e3163" : "#16a06f"} />
        </div>
        <p className="m-cs" style={{ marginTop: 8 }}>12-month totals: {fN(trendTot.o)} raised · {fN(trendTot.c)} closed</p>
      </Card>

      {cats.length > 0 && (
        <Card>
          <CardHead title="Open cases by category" />
          <div style={{ marginTop: 10 }}>
            <HBars format={fN} rows={cats.map(([k, v]) => ({ label: CM.AREA[k], value: v, sub: `${pct(v, open.length)} of open` }))} />
          </div>
        </Card>
      )}

      <Section title="Cases" />
      <Seg value={scope} options={[{ k: "open", l: `Open · ${fN(open.length)}` }, { k: "closed", l: `Closed · ${fN(closed)}` }, { k: "all", l: "All" }]} onChange={s => { setScope(s); setLimit(30); }} />
      <SearchBar value={q} onChange={v => { setQ(v); setLimit(30); }} placeholder="Search case number" />
      {list.length === 0 ? <Empty title="No cases" sub="Nothing matches these filters." /> : (
        <>
          <List>
            {list.slice(0, limit).map(c => {
              const b = tatBucket(c);
              return (
                <Row key={c.caseNo + c.open} title={`Case ${c.caseNo}`}
                  sub={`${nm(CM.AREA, c.area)} · ${isClosed(c) ? "closed" : `${c.age}d old`}`}
                  right={<Pill tone={isClosed(c) ? undefined : TAT_TONE[b]}>{isClosed(c) ? "Closed" : TAT_LBL[b]}</Pill>}
                  onClick={() => setSel(c)} />
              );
            })}
          </List>
          {list.length > limit && <button type="button" className="m-btn" onClick={() => setLimit(l => l + 30)}>Show more ({fN(list.length - limit)} left)</button>}
        </>
      )}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `Case ${sel.caseNo}` : ""}>
        {sel && (
          <div className="m-stack">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill tone={isClosed(sel) ? undefined : TAT_TONE[tatBucket(sel)]}>{isClosed(sel) ? "Closed" : TAT_LBL[tatBucket(sel)]}</Pill>
              <Pill>{stName(sel)}</Pill>
              {sel.hni === 1 && <Pill tone="gold">HNI</Pill>}
              {sel.legal === 1 && <Pill tone="warn">Legal</Pill>}
            </div>
            <List>
              <Row title="Category" value={nm(CM.AREA, sel.area)} />
              <Row title="Sub-category" value={nm(CM.SUBA, sel.subArea)} />
              <Row title="Type" value={nm(CM.TYP, sel.typ)} />
              <Row title="Priority" value={nm(CM.PRI, sel.pri)} />
              <Row title="Origin" value={nm(CM.ORG, sel.org)} />
              <Row title="Project" value={nm(CM.PRJ, sel.prj)} />
              <Row title="Owner" value={nm(CM.OWN, sel.own)} />
              <Row title="Raised" value={fmtDay(sel.open)} />
              <Row title="Closed" value={fmtDay(sel.closed)} />
              <Row title="Age" value={`${sel.age} days`} />
              <Row title="TAT level" value={nm(CM.TAT, sel.tat)} />
              <Row title="Re-assignments" value={String(sel.reassigns)} />
            </List>
          </div>
        )}
      </Sheet>
    </div>
  );
}
