import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AreaChart, BarChart, Card, CardHead, Empty, FilterBar, FullViewLink, Funnel, Hero, HBars, Kpi, Legend, Pill, Section, Sheet, type FilterValues } from "../ui";
import { fN, pct } from "../fmt";
import {
  DG, RECORDS, applyChips, digInsights, digMonthly, digWeekday, digitalFunnel,
  type Chip, type DigRec,
} from "../../components/leads/digitalShared";
import { dayToDate } from "../../utils/footfallLogic";

const fyOf = (d: number) => { const dt = dayToDate(d); return dt.getMonth() + 1 >= 4 ? dt.getFullYear() + 1 : dt.getFullYear(); };
const ymOf = (d: number) => { const dt = dayToDate(d); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; };
const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymLbl = (k: string) => { const [y, m] = k.split("-").map(Number); return `${MN[m - 1]} '${String(y).slice(2)}`; };
const fyLbl = (fy: number) => `FY ${String(fy - 1).slice(2)}-${String(fy).slice(2)}`;

const dim = (names: string[]) => names.map((l, i) => ({ k: String(i), l })).filter(o => o.l);

export default function Digital() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [fv, setFv] = useState<FilterValues>({});
  const [drill, setDrill] = useState<{ dim: "p" | "sub"; val: number; label: string } | null>(null);
  const [by, setBy] = useState<"sub" | "p">("sub");

  const periodOpts = useMemo(() => {
    const dated = RECORDS.filter(r => r.day >= 0);
    const fys = [...new Set(dated.map(r => fyOf(r.day)))].sort((a, b) => b - a).map(y => ({ k: `y:${y}`, l: fyLbl(y) }));
    const ms = [...new Set(dated.map(r => ymOf(r.day)))].sort().reverse().map(m => ({ k: `m:${m}`, l: ymLbl(m) }));
    return [...fys, ...ms];
  }, []);
  const fields = useMemo(() => [
    { key: "per", label: "Period", options: periodOpts, allLabel: "All time" },
    { key: "p", label: "Project", options: dim(DG.PRJ), allLabel: "All projects" },
    { key: "sub", label: "Source", options: dim(DG.SUB), allLabel: "All sources" },
    { key: "sta", label: "Status", options: dim(DG.STA), allLabel: "All statuses" },
  ], [periodOpts]);

  const rows = useMemo(() => {
    const chips: Chip[] = (["p", "sub", "sta"] as const).filter(k => fv[k]).map(k => ({ dim: k, val: Number(fv[k]), label: fv[k] }));
    let r = applyChips(RECORDS, chips);
    const per = fv.per;
    if (per) {
      const [t, v] = per.split(":");
      r = r.filter(x => x.day >= 0 && (t === "y" ? String(fyOf(x.day)) === v : ymOf(x.day) === v));
    }
    return r;
  }, [fv]);

  const total = rows.length;
  const fun = useMemo(() => digitalFunnel(rows), [rows]);
  const ins = useMemo(() => digInsights(rows), [rows]);
  const monthly = useMemo(() => digMonthly(rows), [rows]);
  const weekday = useMemo(() => digWeekday(rows), [rows]);
  const breakdown = useMemo(() => {
    const names = by === "sub" ? DG.SUB : DG.PRJ;
    const m = new Map<number, number>();
    rows.forEach(r => { const k = by === "sub" ? r.sub : r.p; if (k >= 0) m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ k, label: names[k], value: v }));
  }, [rows, by]);

  const drillRows: DigRec[] = useMemo(() => (drill ? rows.filter(r => r[drill.dim] === drill.val) : []), [drill, rows]);
  const drillFun = useMemo(() => digitalFunnel(drillRows), [drillRows]);
  const drillStatus = useMemo(() => {
    const m = new Map<number, number>();
    drillRows.forEach(r => { if (r.sta >= 0) m.set(r.sta, (m.get(r.sta) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: DG.STA[k], value: v }));
  }, [drillRows]);

  const qual = fun.steps[1].value, booked = fun.steps[3].value;
  const perLbl = fv.per ? periodOpts.find(o => o.k === fv.per)?.l : "All time";

  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Digital Leads</h1><p className="m-sub">Presales enquiries · as on {DG.meta.asOn}</p></div>
      <FilterBar fields={fields} values={fv} onApply={setFv} quick={["per", "p"]} />

      <Hero label="Total enquiries" value={fN(total)} sub={`${perLbl} · ${fN(DG.meta.rows)} in export`}
        cells={[{ v: fN(qual), l: "Qualified" }, { v: fN(booked), l: "Booked" }, { v: pct(booked, total, 2), l: "Booked rate" }]} />

      {total === 0 ? <Empty title="No enquiries match" sub="Loosen a filter to see data." /> : <>
        <Card>
          <CardHead title="Conversion funnel" sub="Enquiry → qualified → site visit → booked" />
          <div style={{ marginTop: 12 }}>
            <Funnel stages={fun.steps.map(s => ({ label: s.label, value: s.value, sub: `${fN(s.value)} · ${s.pctOfTotal.toFixed(s.pctOfTotal < 10 ? 1 : 0)}%` }))} />
          </div>
          <p className="m-cs" style={{ marginTop: 10 }}>{fN(fun.lost)} enquiries closed-lost</p>
        </Card>

        <Section title="Key insights" />
        <div className="m-hscroll">
          {ins.map(i => (
            <Card key={i.k}>
              <span className="m-label">{i.k}</span>
              <b className="m-num" style={{ display: "block", fontSize: 17, margin: "6px 0 4px", letterSpacing: "-0.02em" }}>{i.v}</b>
              <small style={{ fontSize: 12, color: "var(--m-mut)" }}>{i.hint}</small>
            </Card>
          ))}
        </div>

        <Card>
          <CardHead title="Enquiries by month" sub="Drag across the chart" />
          <AreaChart data={monthly.map(m => ({ label: m.label, value: m.value }))} format={fN} unit="enquiries" />
        </Card>
        <Card>
          <CardHead title="Weekday pattern" sub="Tap a bar" />
          <BarChart data={weekday.map(w => ({ label: w.label, value: w.value }))} format={fN} unit="enquiries" height={160} />
        </Card>

        <Card>
          <CardHead title={by === "sub" ? "Top sources" : "Top projects"} sub="Tap a row for its funnel"
            right={<div className="m-seg" style={{ width: 150 }}>
              <button type="button" className={by === "sub" ? "on" : ""} onClick={() => setBy("sub")}>Source</button>
              <button type="button" className={by === "p" ? "on" : ""} onClick={() => setBy("p")}>Project</button>
            </div>} />
          <div style={{ marginTop: 10 }}>
            <HBars format={fN} rows={breakdown.map(b => ({ label: b.label, value: b.value, sub: `${pct(b.value, total)} of enquiries`, onClick: () => setDrill({ dim: by, val: b.k, label: b.label }) }))} />
          </div>
        </Card>
      </>}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!drill} onClose={() => setDrill(null)} title={drill?.label ?? ""}>
        <div className="m-stack">
          <div className="m-grid2">
            <Kpi label="Enquiries" value={fN(drillRows.length)} sub={`${pct(drillRows.length, total)} of scope`} />
            <Kpi label="Booked" value={fN(drillFun.steps[3].value)} sub={pct(drillFun.steps[3].value, drillRows.length, 2)} accent />
          </div>
          <Funnel stages={drillFun.steps.map(s => ({ label: s.label, value: s.value, sub: fN(s.value) }))} />
          <Legend items={[{ l: "Closed-lost", c: "#d64545", v: fN(drillFun.lost) }]} />
          <span className="m-label">Presales status</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {drillStatus.map(s => <Pill key={s.label}>{s.label} · {fN(s.value)}</Pill>)}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
