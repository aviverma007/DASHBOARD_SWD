import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CP, CP_YEAR_OPTIONS, filterRecords, summariseByChannelPartner, monthlyTrend, monthlyTrendForCp,
  cancelledRebookingSummary, byProjectForCp, topByCancelled, fArea, fCr,
} from "../../utils/cpLogic";
import type { PeriodScope } from "../../utils/cpLogic";
import {
  Card, CardHead, Section, Hero, Kpi, Seg, List, Row, SearchBar, Sheet, FilterBar, Empty, Pill, SegBar, Legend,
  AreaChart, BarChart, HBars, FullViewLink, type FilterField, type FilterValues,
} from "../ui";
import { fN, pct, pctN, shortName } from "../fmt";

type Metric = "units" | "area" | "tsv";
const METRICS: { k: Metric; l: string }[] = [{ k: "units", l: "Units" }, { k: "area", l: "Area" }, { k: "tsv", l: "Value" }];
const QUARTERS = ["Q1 · Apr–Jun", "Q2 · Jul–Sep", "Q3 · Oct–Dec", "Q4 · Jan–Mar"];
const SHOW = 25;

export default function ChannelPartners() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [metric, setMetric] = useState<Metric>("units");
  const [f, setF] = useState<FilterValues>({});
  const [q, setQ] = useState("");
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  const fields: FilterField[] = useMemo(() => [
    { key: "fy", label: "Financial year", allLabel: "All time", options: CP_YEAR_OPTIONS.map(y => ({ k: String(y.fy), l: y.label })) },
    { key: "qtr", label: "Quarter (needs a year)", allLabel: "Full year", options: QUARTERS.map((l, i) => ({ k: String(i), l })) },
    { key: "proj", label: "Project", allLabel: "All projects", options: CP.P.map(p => ({ k: p, l: shortName(p) })) },
  ], []);

  const period: PeriodScope = useMemo(() => {
    if (!f.fy) return { type: "all" };
    if (f.qtr) return { type: "quarter", fy: +f.fy, quarter: +f.qtr };
    return { type: "year", fy: +f.fy };
  }, [f]);

  const scoped = useMemo(() => filterRecords(f.proj ? new Set([f.proj]) : null, period), [f.proj, period]);
  const all = useMemo(() => summariseByChannelPartner(scoped), [scoped]);
  const cps = useMemo(() => all.filter(s => s.name !== "Direct"), [all]);
  const direct = all.find(s => s.name === "Direct");
  const tot = useMemo(() => ({
    units: cps.reduce((s, c) => s + c.units, 0), area: cps.reduce((s, c) => s + c.area, 0), tsv: cps.reduce((s, c) => s + c.tsv, 0),
  }), [cps]);
  const cancel = useMemo(() => cancelledRebookingSummary(scoped), [scoped]);
  const topCancel = useMemo(() => topByCancelled(scoped, 5), [scoped]);
  const trend = useMemo(() => monthlyTrend(scoped, true), [scoped]);

  const ranked = useMemo(() => [...cps].filter(c => c[metric] > 0).sort((a, b) => b[metric] - a[metric]), [cps, metric]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? ranked.map((c, i) => ({ c, rank: i + 1 })).filter(x => x.c.name.toLowerCase().includes(t)) : ranked.map((c, i) => ({ c, rank: i + 1 }));
  }, [ranked, q]);
  const list = q || more ? shown : shown.slice(0, SHOW);

  const fmtM = (c: { units: number; area: number; tsv: number }, m: Metric = metric) =>
    m === "units" ? fN(c.units) : m === "area" ? fArea(c.area) : fCr(c.tsv);
  const trendVal = (t: (typeof trend)[number]) => (metric === "units" ? t.units : metric === "area" ? t.area : t.tsv);
  const trendFmt = (n: number) => (metric === "units" ? fN(n) : metric === "area" ? `${n.toFixed(2)} L sq ft` : `₹${n.toFixed(1)} Cr`);
  const trendData = trend.slice(-12).map(t => ({ label: t.label, value: trendVal(t) }));

  const top5 = ranked.slice(0, 5);
  const top5Share = tot[metric] > 0 ? pctN(top5.reduce((s, c) => s + c[metric], 0), tot[metric]) : 0;

  const periodLabel = !f.fy ? "All time" : `${CP_YEAR_OPTIONS.find(y => String(y.fy) === f.fy)?.label ?? ""}${f.qtr ? ` · Q${+f.qtr + 1}` : ""}`;
  const sel = open !== null ? cps.find(c => c.cpIdx === open) ?? all.find(c => c.cpIdx === open) : undefined;

  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Channel partners</h1><p className="m-sub">{periodLabel} · {f.proj ? shortName(f.proj) : "All projects"} · {fN(cps.length)} partners</p></div>
      <FilterBar fields={fields} values={f} onApply={v => { setF(v.fy ? v : { ...v, qtr: "" }); setMore(false); }} quick={["fy", "proj"]} />

      <Hero label="Sold via channel partners" value={fCr(tot.tsv)} sub={`${fN(tot.units)} units · ${fArea(tot.area)}`}
        cells={[{ v: fN(cps.length), l: "Partners" }, { v: tot.units ? fCr(tot.tsv / tot.units) : "—", l: "Avg / unit" }, { v: String(cancel.cancelled), l: "Cancelled" }]} />

      {direct && direct.units > 0 && (
        <p className="m-sub" style={{ margin: 0 }}>
          {fN(direct.units)} units ({fCr(direct.tsv)}) sold directly, without a partner — excluded above.
        </p>
      )}

      <Section title="Leaderboard" />
      <Seg value={metric} options={METRICS} onChange={m => { setMetric(m); setMore(false); }} />
      {top5.length > 0 && (
        <Card>
          <CardHead title={`Top 5 · ${pct(top5.reduce((s, c) => s + c[metric], 0), tot[metric])} of total`} sub={`by ${METRICS.find(m => m.k === metric)?.l.toLowerCase()}`} />
          <div style={{ marginTop: 10 }}>
            <HBars rows={top5.map(c => ({ label: c.name, value: c[metric], onClick: () => setOpen(c.cpIdx) }))} format={n => fmtM({ units: n, area: n, tsv: n })} />
          </div>
          <p className="m-sub" style={{ margin: "8px 0 0" }}>Concentration {top5Share.toFixed(0)}%</p>
        </Card>
      )}
      <SearchBar value={q} onChange={setQ} placeholder="Search channel partner" />
      {list.length ? (
        <List>
          {list.map(({ c, rank }) => (
            <Row key={c.cpIdx} rank={rank} title={c.name} sub={metric === "units" ? `${fArea(c.area)} · ${fCr(c.tsv)}` : metric === "area" ? `${fN(c.units)} units · ${fCr(c.tsv)}` : `${fN(c.units)} units · ${fArea(c.area)}`}
              value={fmtM(c)} onClick={() => setOpen(c.cpIdx)} />
          ))}
        </List>
      ) : <Empty title="No partners" sub="Nothing matches this period, project or search." />}
      {!q && !more && shown.length > SHOW && <button type="button" className="m-btn" onClick={() => setMore(true)}>Show all {fN(shown.length)} partners</button>}

      <Section title="Monthly trend" />
      <Card>
        <CardHead title={`${METRICS.find(m => m.k === metric)?.l} by month`} sub="All channel partners, last 12 months in scope" />
        {trendData.length > 1 ? <AreaChart data={trendData} format={trendFmt} /> : trendData.length === 1 ? <BarChart data={trendData} format={trendFmt} /> : <Empty title="No bookings" />}
      </Card>

      <Section title="Cancellations & rebooking" />
      <Card>
        <div className="m-grid2" style={{ marginBottom: 12 }}>
          <Kpi label="Cancelled" value={fN(cancel.cancelled)} sub={fCr(cancel.cancelledTsv)} color="#c0392b" />
          <Kpi label="Rebooked" value={fN(cancel.rebooked)} sub={`${pct(cancel.rebooked, cancel.cancelled)} recovered`} color="#1a7a4a" />
        </div>
        <SegBar parts={[{ v: cancel.rebooked, c: "#1a7a4a" }, { v: cancel.stillVacant, c: "#c0392b" }]} />
        <Legend items={[{ l: "Rebooked", c: "#1a7a4a", v: String(cancel.rebooked) }, { l: "Still vacant", c: "#c0392b", v: String(cancel.stillVacant) }]} />
        {topCancel.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <span className="m-label">Most cancellations</span>
            {topCancel.map(c => (
              <Row key={c.cpIdx} title={c.name} sub={`${c.rebooked} rebooked`} value={String(c.cancelled)} valueSub="cancelled" onClick={() => setOpen(c.cpIdx)} />
            ))}
          </div>
        )}
      </Card>

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={open !== null} onClose={() => setOpen(null)} title={sel?.name ?? "Channel partner"}>
        {sel && <CpDetail s={sel} />}
      </Sheet>
    </div>
  );
}

function CpDetail({ s }: { s: { cpIdx: number; name: string; units: number; area: number; tsv: number; cancelled: number; rebooked: number } }) {
  const projs = useMemo(() => byProjectForCp(s.cpIdx), [s.cpIdx]);
  const tr = useMemo(() => monthlyTrendForCp(s.cpIdx).slice(-12), [s.cpIdx]);
  const allTime = useMemo(() => projs.reduce((a, p) => ({ units: a.units + p.units, tsv: a.tsv + p.tsv }), { units: 0, tsv: 0 }), [projs]);
  return (
    <div className="m-stack">
      <div className="m-grid2">
        <Kpi label="Units (scope)" value={fN(s.units)} sub={fArea(s.area)} accent />
        <Kpi label="Value (scope)" value={fCr(s.tsv)} sub={s.units ? `${fCr(s.tsv / s.units)} / unit` : undefined} />
        <Kpi label="Cancelled" value={String(s.cancelled)} color="#c0392b" />
        <Kpi label="Rebooked" value={String(s.rebooked)} color="#1a7a4a" />
      </div>
      <Pill tone="gold">All-time: {fN(allTime.units)} units · {fCr(allTime.tsv)}</Pill>
      <Card>
        <CardHead title="By project" sub="All-time active units" />
        {projs.length ? projs.map(p => (
          <Row key={p.projIdx} title={shortName(p.name)} sub={fArea(p.area)} value={`${fN(p.units)} units`} valueSub={fCr(p.tsv)} />
        )) : <Empty title="No active units" />}
      </Card>
      {tr.length > 0 && (
        <Card>
          <CardHead title="Units by month" sub="Last 12 booking months" />
          <BarChart data={tr.map(t => ({ label: t.label, value: t.units }))} format={n => `${fN(n)} units`} />
        </Card>
      )}
    </div>
  );
}
