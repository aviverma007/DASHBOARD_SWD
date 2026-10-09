import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AreaChart, BarChart, Card, CardHead, Chip, Chips, Empty, FilterBar, FullViewLink, Funnel, Hero, HBars, Legend, Seg, type FilterValues } from "../ui";
import { fN, pct } from "../fmt";
import {
  FF, FF_RECORDS, ffApply, ffFunnel, ffInsights, ffMonthly, ffWeekday, periodPresets,
  type FfDim, type FfFilter, type FfRecord,
} from "../../utils/footfallLogic";

const opts = (names: string[]) => names.map((l, i) => ({ k: String(i), l })).filter(o => o.l);
const FILTER_DIMS: { key: FfDim; label: string; names: string[]; all: string }[] = [
  { key: "p", label: "Project", names: FF.P, all: "All projects" },
  { key: "src", label: "Source", names: FF.SRC, all: "All sources" },
  { key: "g", label: "Gallery", names: FF.G, all: "All galleries" },
  { key: "loc", label: "Location", names: FF.LOC, all: "All locations" },
  { key: "age", label: "Age band", names: FF.AGE, all: "All ages" },
  { key: "stg", label: "Stage", names: FF.STG, all: "All stages" },
  { key: "cat", label: "Category", names: FF.CAT, all: "All categories" },
];

type By = "p" | "src" | "loc" | "age";
const BY: { k: By; l: string; names: string[] }[] = [
  { k: "p", l: "Project", names: FF.P }, { k: "src", l: "Source", names: FF.SRC },
  { k: "loc", l: "Area", names: FF.LOC }, { k: "age", l: "Age", names: FF.AGE },
];

export default function Footfall() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const presets = useMemo(() => periodPresets(), []);
  const [perKey, setPerKey] = useState("all");
  const [fv, setFv] = useState<FilterValues>({});
  const [by, setBy] = useState<By>("p");

  const fields = useMemo(() => FILTER_DIMS.map(d => ({ key: d.key, label: d.label, options: opts(d.names), allLabel: d.all })), []);
  const per = presets.find(p => p.key === perKey) ?? presets[0];
  const rows: FfRecord[] = useMemo(() => {
    const filters: FfFilter[] = FILTER_DIMS.filter(d => fv[d.key]).map(d => ({ dim: d.key, val: Number(fv[d.key]), label: fv[d.key] }));
    const dimRows = ffApply(FF_RECORDS, filters);
    return per.key === "all" ? dimRows : dimRows.filter(r => r.day >= per.from && r.day <= per.to);
  }, [fv, per]);

  const total = rows.length;
  const fun = useMemo(() => ffFunnel(rows), [rows]);
  const ins = useMemo(() => ffInsights(rows), [rows]);
  const monthly = useMemo(() => ffMonthly(rows), [rows]);
  const weekday = useMemo(() => ffWeekday(rows), [rows]);
  const breakdown = useMemo(() => {
    const b = BY.find(x => x.k === by)!;
    const m = new Map<number, number>();
    rows.forEach(r => { const k = r[by]; if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].sort((a, c) => c[1] - a[1]).slice(0, 8).map(([k, v]) => ({ label: b.names[k], value: v }));
  }, [rows, by]);
  const withDay = rows.filter(r => r.day >= 0).length;

  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Gallery Footfall</h1><p className="m-sub">Site visits · till {FF.meta.asOn}</p></div>

      <Chips>
        {presets.map(p => <Chip key={p.key} on={p.key === perKey} onClick={() => setPerKey(p.key)}>{p.label}</Chip>)}
      </Chips>
      <FilterBar fields={fields} values={fv} onApply={setFv} quick={["p", "src"]} />

      <Hero label="Site visits" value={fN(total)} sub={`${per.label} · ${fN(withDay)} with a visit date`}
        cells={[{ v: fN(fun.steps[1].value), l: "In pipeline" }, { v: fN(fun.steps[3].value), l: "Booked" }, { v: pct(fun.steps[3].value, total, 1), l: "Visit → booked" }]} />

      {total === 0 ? <Empty title="No visits match" sub="Try a wider period or fewer filters." /> : <>
        <Card>
          <CardHead title="Conversion funnel" sub="Current opportunity stage of each visit" />
          <div style={{ marginTop: 12 }}>
            <Funnel stages={fun.steps.map(s => ({ label: s.label, value: s.value, sub: `${fN(s.value)} · ${s.pctOfTotal.toFixed(s.pctOfTotal < 10 ? 1 : 0)}%` }))} />
          </div>
          <div style={{ marginTop: 10 }}>
            <Legend items={[{ l: "Closed lost", c: "#d64545", v: fN(fun.lost) }, { l: "No stage", c: "#9aa3b5", v: fN(fun.blank) }]} />
          </div>
        </Card>

        <Card>
          <CardHead title="Visits by month" sub="Drag across the chart" />
          <AreaChart data={monthly.map(m => ({ label: m.label, value: m.value }))} format={fN} unit="visits" />
        </Card>

        <Card>
          <CardHead title="Who visits" />
          <div style={{ margin: "10px 0" }}><Seg value={by} options={BY.map(b => ({ k: b.k, l: b.l }))} onChange={setBy} /></div>
          <HBars format={fN} rows={breakdown.map(b => ({ label: b.label, value: b.value, sub: `${pct(b.value, total, 1)} of visits` }))} />
          {!breakdown.length && <Empty title="Not captured" sub="No values recorded for this view." />}
        </Card>

        <Card>
          <CardHead title="Weekday pattern" sub="Tap a bar" />
          <BarChart data={weekday.map(w => ({ label: w.label, value: w.value }))} format={fN} unit="visits" height={160} />
        </Card>

        <h2 className="m-h2" style={{ fontSize: 16, margin: "4px 0 0" }}>Key insights</h2>
        {ins.map(i => (
          <Card key={i.k}>
            <span className="m-label">{i.k}</span>
            <b className="m-num" style={{ display: "block", fontSize: 16, margin: "6px 0 3px", letterSpacing: "-0.02em" }}>{i.v}</b>
            <small style={{ fontSize: 12, color: "var(--m-mut)" }}>{i.hint}</small>
          </Card>
        ))}
      </>}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />
    </div>
  );
}
