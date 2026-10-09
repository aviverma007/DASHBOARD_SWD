import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import rawTarget from "../../data/targetData.json";
import rawTV from "../../data/tvAnalytics.json";
import { DATA_AS_ON } from "../../config/dataInfo";
import {
  Card, CardHead, Section, Hero, Ring, Seg, Progress, Pill, Row, List, Sheet, FilterBar, Empty, BarChart,
  FullViewLink, type FilterField, type FilterValues,
} from "../ui";
import { fN, shortName } from "../fmt";

/* Same data + semantics as the desktop Target vs Actual page:
   target units / sale_value (₹ Cr) / area (raw sq ft); actual monthly_units / monthly_tsv (₹ Cr) / monthly_area (lakh sq ft). */
interface MonthMeta { year: number; month: number; label: string }
interface PT { name: string; units: number[]; area: number[]; rate: number[]; sale_value: number[] }
interface PA { name: string; monthly_units: number[]; monthly_tsv: number[]; monthly_area: number[] }
const TD = rawTarget as unknown as { months: MonthMeta[]; projects: PT[] };
const TV = rawTV as unknown as { projects: PA[] };
const TL = TD.months;

const fyEnd = (y: number, m: number) => (m >= 4 ? y + 1 : y);
const fyQ = (m: number) => (m >= 4 ? Math.floor((m - 4) / 3) : Math.floor((m + 8) / 3));
const FYS = (() => {
  const seen = new Map<number, { start: number; end: number }>();
  TL.forEach((m, i) => { const fy = fyEnd(m.year, m.month); const e = seen.get(fy); if (e) e.end = i; else seen.set(fy, { start: i, end: i }); });
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([fy, r]) => ({ k: String(fy), label: `FY ${fy - 1}-${String(fy).slice(-2)}`, ...r }));
})();
const NOW = new Date();
const TODAY_IDX = TL.findIndex(m => m.year === NOW.getFullYear() && m.month === NOW.getMonth() + 1);
const DEF_FY = (() => { const fy = String(fyEnd(NOW.getFullYear(), NOW.getMonth() + 1)); return FYS.find(y => y.k === fy)?.k ?? FYS[FYS.length - 1].k; })();
const QL = ["Q1 · Apr–Jun", "Q2 · Jul–Sep", "Q3 · Oct–Dec", "Q4 · Jan–Mar"];

type Metric = "tsv" | "units" | "area";
const METRICS: { k: Metric; l: string }[] = [{ k: "tsv", l: "Value" }, { k: "units", l: "Units" }, { k: "area", l: "Area" }];
const FMT: Record<Metric, (n: number) => string> = {
  tsv: n => `₹${n >= 100 ? fN(n) : n.toFixed(1)} Cr`, units: n => fN(n), area: n => `${n.toFixed(2)} L sq ft`,
};
const UNIT: Record<Metric, string> = { tsv: "₹ Cr", units: "units", area: "L sq ft" };

interface Pair { t: number; a: number }
const sumAt = (arr: number[] | undefined, idxs: number[]) => idxs.reduce((s, i) => s + (arr?.[i] ?? 0), 0);

function tone(p: number | null): "ok" | "warn" | "bad" | undefined {
  return p === null ? undefined : p >= 100 ? "ok" : p >= 70 ? "warn" : "bad";
}
const COL = { ok: "#16a06f", warn: "#eda100", bad: "#c0392b" } as const;
const pc = (p: Pair) => (p.t > 0 ? (p.a / p.t) * 100 : null);

export default function Target() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [f, setF] = useState<FilterValues>({ fy: DEF_FY });
  const [metric, setMetric] = useState<Metric>("tsv");
  const [series, setSeries] = useState<"t" | "a">("a");
  const [open, setOpen] = useState<string | null>(null);

  const fields: FilterField[] = useMemo(() => [
    { key: "fy", label: "Financial year", allLabel: "All periods", options: FYS.map(y => ({ k: y.k, l: y.label })) },
    { key: "qtr", label: "Quarter (needs a year)", allLabel: "Full year", options: QL.map((l, i) => ({ k: String(i), l })) },
    { key: "proj", label: "Project", allLabel: "All projects", options: TD.projects.map(p => ({ k: p.name, l: shortName(p.name) })) },
  ], []);

  const idxs = useMemo(() => {
    const out: number[] = [];
    TL.forEach((m, i) => {
      if (f.fy && String(fyEnd(m.year, m.month)) !== f.fy) return;
      if (f.fy && f.qtr && fyQ(m.month) !== +f.qtr) return;
      out.push(i);
    });
    return out;
  }, [f]);
  const todayIn = TODAY_IDX >= 0 ? idxs.filter(i => i <= TODAY_IDX) : idxs;

  const projects = useMemo(() => TD.projects.filter(p => !f.proj || p.name === f.proj), [f.proj]);
  const actOf = (name: string) => TV.projects.find(a => a.name === name);

  const val = (p: PT, a: PA | undefined, m: Metric, ix: number[]): Pair =>
    m === "tsv" ? { t: sumAt(p.sale_value, ix), a: sumAt(a?.monthly_tsv, ix) }
    : m === "units" ? { t: sumAt(p.units, ix), a: sumAt(a?.monthly_units, ix) }
    : { t: sumAt(p.area, ix) / 1e5, a: sumAt(a?.monthly_area, ix) };

  const total = (m: Metric, ix = idxs): Pair =>
    projects.reduce((s, p) => { const v = val(p, actOf(p.name), m, ix); return { t: s.t + v.t, a: s.a + v.a }; }, { t: 0, a: 0 });

  const T = { tsv: total("tsv"), units: total("units"), area: total("area") };
  const toDate = total("tsv", todayIn);
  const ach = pc(T.tsv);
  const cur = total(metric);

  const rows = useMemo(() => projects.map(p => {
    const a = actOf(p.name);
    return { name: p.name, has: !!a, tsv: val(p, a, "tsv", idxs), units: val(p, a, "units", idxs), area: val(p, a, "area", idxs) };
  }).filter(r => r.tsv.t || r.units.t || r.units.a || r.tsv.a).sort((x, y) => y.tsv.t - x.tsv.t),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [projects, idxs]);

  const months = useMemo(() => idxs.map(i => {
    const t = projects.reduce((s, p) => s + (metric === "tsv" ? p.sale_value[i] ?? 0 : metric === "units" ? p.units[i] ?? 0 : (p.area[i] ?? 0) / 1e5), 0);
    const a = projects.reduce((s, p) => { const x = actOf(p.name); return s + (metric === "tsv" ? x?.monthly_tsv[i] ?? 0 : metric === "units" ? x?.monthly_units[i] ?? 0 : x?.monthly_area[i] ?? 0); }, 0);
    return { i, label: TL[i].label.replace(/\s?\d{4}$/, "").slice(0, 8), full: TL[i].label, t, a, future: TODAY_IDX >= 0 && i > TODAY_IDX };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [idxs, projects, metric]);

  const chartData = months.map(m => ({ label: m.label, value: series === "t" ? m.t : m.a }));
  const periodLabel = `${f.fy ? FYS.find(y => y.k === f.fy)?.label : "All periods"}${f.fy && f.qtr ? ` · Q${+f.qtr + 1}` : ""}`;
  const sel = open ? rows.find(r => r.name === open) : undefined;
  const gap = T.tsv.t - T.tsv.a;

  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Target vs actual</h1><p className="m-sub">AOP plan against bookings · {periodLabel} · as on {DATA_AS_ON}</p></div>
      <FilterBar fields={fields} values={f} onApply={v => setF(v.fy ? v : { ...v, qtr: "" })} quick={["fy", "proj"]} />

      <Hero label={`Sales value achieved · ${f.proj ? shortName(f.proj) : "all projects"}`} value={FMT.tsv(T.tsv.a)} sub={`of ${FMT.tsv(T.tsv.t)} target`}
        cells={[{ v: `${fN(T.units.a)} / ${fN(T.units.t)}`, l: "Units" }, { v: `${T.area.a.toFixed(2)} L`, l: "Area (sq ft)" }, { v: gap >= 0 ? FMT.tsv(gap) : `+${FMT.tsv(-gap)}`, l: gap >= 0 ? "Shortfall" : "Ahead" }]}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
          <Ring pct={ach ?? 0} size={84} stroke={11} color={ach === null ? "#9aa3b5" : COL[tone(ach)!]} />
          <div>
            <b className="m-num" style={{ fontSize: 26, fontWeight: 800 }}>{ach === null ? "—" : `${Math.round(ach)}%`}</b>
            <div style={{ fontSize: 12, opacity: 0.85 }}>of AOP value target</div>
          </div>
        </div>
      </Hero>

      <div className="m-grid2">
        {METRICS.filter(m => m.k !== "tsv").map(m => {
          const p = pc(T[m.k]);
          return (
            <Card key={m.k}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="m-label">{m.l}</span><Pill tone={tone(p)}>{p === null ? "—" : `${Math.round(p)}%`}</Pill>
              </div>
              <b className="m-num" style={{ display: "block", fontSize: 20, margin: "6px 0 2px" }}>{FMT[m.k](T[m.k].a)}</b>
              <small style={{ display: "block", fontSize: 12, color: "var(--m-mut)", marginBottom: 8 }}>of {FMT[m.k](T[m.k].t)}</small>
              <Progress pct={p ?? 0} color={p === null ? undefined : COL[tone(p)!]} />
            </Card>
          );
        })}
      </div>
      {TODAY_IDX >= 0 && toDate.t > 0 && todayIn.length < idxs.length && (
        <Card>
          <CardHead title="Pace to date" sub={`Target through ${TL[TODAY_IDX].label}`} right={<Pill tone={tone(pc(toDate))}>{Math.round(pc(toDate) ?? 0)}%</Pill>} />
          <div style={{ margin: "10px 0 6px" }}><Progress lg pct={pc(toDate) ?? 0} color={COL[tone(pc(toDate)) ?? "warn"]} /></div>
          <p className="m-sub" style={{ margin: 0 }}>{FMT.tsv(toDate.a)} achieved vs {FMT.tsv(toDate.t)} planned so far.</p>
        </Card>
      )}

      <Section title="Month by month" />
      <Seg value={metric} options={METRICS} onChange={setMetric} />
      <Card>
        <CardHead title={series === "a" ? "Actual by month" : "Target by month"} sub={`${UNIT[metric]} · tap a bar for the figure`}
          right={<div style={{ width: 138 }}><Seg value={series} options={[{ k: "t", l: "Target" }, { k: "a", l: "Actual" }]} onChange={setSeries} /></div>} />
        {chartData.length ? <BarChart data={chartData} format={FMT[metric]} unit={series === "a" ? "actual" : "target"} /> : <Empty title="No plan months" sub="This period has no AOP months." />}
      </Card>
      {months.length > 0 && (
        <List>
          {[...months].reverse().map(m => {
            const p = m.t > 0 ? (m.a / m.t) * 100 : null;
            return (
              <Row key={m.i} title={m.full} sub={`Target ${FMT[metric](m.t)}`} value={FMT[metric](m.a)}
                valueSub={m.future && m.a === 0 ? "upcoming" : p === null ? "no target" : `${Math.round(p)}%`} />
            );
          })}
        </List>
      )}

      <Section title="By project" />
      {rows.length ? rows.map(r => {
        const p = pc(r.tsv);
        return (
          <Card key={r.name} onClick={() => setOpen(r.name)}>
            <CardHead title={shortName(r.name)} sub={r.has ? `${fN(r.units.a)} of ${fN(r.units.t)} units` : "No actuals in latest refresh"}
              right={<Pill tone={r.has ? tone(p) : undefined}>{!r.has || p === null ? "n/a" : `${Math.round(p)}%`}</Pill>} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "10px 0 6px" }}>
              <b className="m-num" style={{ fontSize: 20 }}>{FMT.tsv(r.tsv.a)}</b>
              <span style={{ fontSize: 12, color: "var(--m-mut)" }}>target {FMT.tsv(r.tsv.t)}</span>
            </div>
            <Progress pct={p ?? 0} color={r.has && p !== null ? COL[tone(p)!] : undefined} />
            {r.has && r.tsv.t > 0 && (
              <p className="m-sub" style={{ margin: "6px 0 0", color: r.tsv.a >= r.tsv.t ? COL.ok : COL.bad }}>
                {r.tsv.a >= r.tsv.t ? `Ahead by ${FMT.tsv(r.tsv.a - r.tsv.t)}` : `Short by ${FMT.tsv(r.tsv.t - r.tsv.a)}`}
              </p>
            )}
          </Card>
        );
      }) : <Empty title="No targets" sub="No project has a plan in this period." />}
      <p className="m-sub" style={{ margin: 0 }}>Current {METRICS.find(m => m.k === metric)?.l.toLowerCase()} view: {FMT[metric](cur.a)} of {FMT[metric](cur.t)}.</p>

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!sel} onClose={() => setOpen(null)} title={sel ? shortName(sel.name) : ""}>
        {sel && (
          <div className="m-stack">
            {(["tsv", "units", "area"] as Metric[]).map(m => {
              const pr = sel[m], p = pc(pr);
              return (
                <Card key={m}>
                  <CardHead title={METRICS.find(x => x.k === m)!.l} right={<Pill tone={tone(p)}>{p === null ? "—" : `${Math.round(p)}%`}</Pill>} />
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "8px 0 6px" }}>
                    <b className="m-num" style={{ fontSize: 20 }}>{FMT[m](pr.a)}</b>
                    <span style={{ fontSize: 12, color: "var(--m-mut)", alignSelf: "center" }}>target {FMT[m](pr.t)}</span>
                  </div>
                  <Progress pct={p ?? 0} color={p === null ? undefined : COL[tone(p)!]} />
                  <p className="m-sub" style={{ margin: "6px 0 0" }}>{pr.a >= pr.t ? `Ahead by ${FMT[m](pr.a - pr.t)}` : `Variance −${FMT[m](pr.t - pr.a)}`}</p>
                </Card>
              );
            })}
          </div>
        )}
      </Sheet>
    </div>
  );
}
