import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { calcOverall, fArea, fCr, fRate, LOCATIONS, projectLocation } from "../../utils/pdrnLogic";
import type { PeriodFilter, ProjectStats } from "../../utils/pdrnLogic";
import { DATA_AS_ON } from "../../config/dataInfo";
import { Card, CardHead, Chip, Chips, Donut, Empty, FullViewLink, HBars, Hero, Kpi, Legend, Pill, Progress, Section, SegBar, Sheet } from "../ui";
import { fN, shortName } from "../fmt";

const PERIOD: PeriodFilter = { type: "all" };
const C_SOLD = "#1a7a4a", C_UNS = "#c97a1a", C_BBA = "#0e7490";
const ACCENT = ["#3c6db0", "#2e7d6f", "#b8893c", "#c2674a", "#7a5c84", "#4b7b3f"];
const pc = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function Overview() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const overall = useMemo(() => calcOverall(PERIOD), []);
  const [location, setLocation] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<ProjectStats | null>(null);

  const inLoc = useMemo(
    () => (location ? overall.projects.filter(p => projectLocation(p.projectName) === location) : overall.projects),
    [overall, location]
  );
  const projs = useMemo(() => (picked.size ? inLoc.filter(p => picked.has(p.projectName)) : inLoc), [inLoc, picked]);

  /** same derivation as the desktop page */
  const v = useMemo(() => {
    if (!picked.size && !location) return overall;
    const sold = { units: projs.reduce((s, p) => s + p.sold.units, 0), area: projs.reduce((s, p) => s + p.sold.area, 0), tsv: projs.reduce((s, p) => s + p.sold.tsv, 0) };
    const unsold = { units: projs.reduce((s, p) => s + p.unsold.units, 0), area: projs.reduce((s, p) => s + p.unsold.area, 0) };
    const total = { units: sold.units + unsold.units, area: sold.area + unsold.area };
    const bba = { units: projs.reduce((s, p) => s + p.bba.units, 0), tsv: projs.reduce((s, p) => s + p.bba.tsv, 0) };
    const maxes = projs.map(p => p.rate.max).filter((x): x is number => x !== null);
    const mins = projs.map(p => p.rate.min).filter((x): x is number => x !== null);
    return {
      sold, unsold, total, bba, soldPct: total.units ? Math.round((sold.units / total.units) * 100) : 0,
      rate: { avg: sold.area > 0 ? sold.tsv / sold.area : null, max: maxes.length ? Math.max(...maxes) : null, min: mins.length ? Math.min(...mins) : null },
    };
  }, [overall, picked, location, projs]);

  const toggle = (n: string) => setPicked(s => {
    const x = new Set(s);
    if (x.has(n)) x.delete(n); else x.add(n);
    return x.size === inLoc.length ? new Set() : x;
  });
  const setLoc = (l: string) => { setLocation(l); setPicked(new Set()); };

  const ranked = useMemo(() => [...projs].sort((a, b) => b.sold.tsv - a.sold.tsv), [projs]);
  const withSales = ranked.filter(p => p.sold.tsv > 0);
  const colorOf = (p: ProjectStats) => ACCENT[p.invProjIdx % ACCENT.length];

  return (
    <div className="m-stack">
      <div>
        <h1 className="m-h1">Business overview</h1>
        <p className="m-sub">Portfolio snapshot · data as on {DATA_AS_ON}</p>
      </div>

      <Chips>
        <Chip on={!location} onClick={() => setLoc("")}>All locations</Chip>
        {LOCATIONS.map(l => <Chip key={l} on={location === l} onClick={() => setLoc(l)}>{l}</Chip>)}
      </Chips>
      <Chips>
        <Chip on={!picked.size} onClick={() => setPicked(new Set())}>All projects</Chip>
        {inLoc.map(p => <Chip key={p.invProjIdx} on={picked.has(p.projectName)} onClick={() => toggle(p.projectName)}>{shortName(p.projectName)}</Chip>)}
      </Chips>

      {projs.length === 0 ? <Empty title="No projects" sub="Try another location." /> : (
        <>
          <Hero label={picked.size ? `Selected projects (${picked.size})` : location ? `${location} portfolio` : "Total sales value (TSV)"}
            value={v.sold.tsv > 0 ? fCr(v.sold.tsv) : "—"}
            sub={`${fN(v.sold.units)} sold of ${fN(v.total.units)} units · ${v.soldPct}% absorbed`}
            cells={[{ v: fN(v.bba.units), l: "BBA regd" }, { v: fN(v.unsold.units), l: "Available" }, { v: fRate(v.rate.avg).replace("/sqft", ""), l: "Avg ₹/sqft" }]} />

          <div className="m-grid2">
            <Kpi label="Sold" value={`${fN(v.sold.units)} units`} sub={fArea(v.sold.area)} color={C_SOLD} />
            <Kpi label="Available" value={`${fN(v.unsold.units)} units`} sub={fArea(v.unsold.area)} color={C_UNS} />
            <Kpi label="BBA registered" value={`${fN(v.bba.units)} units`} sub={`${pc(v.bba.units, v.sold.units)}% of sold`} color={C_BBA} />
            <Kpi label="Total stock" value={`${fN(v.total.units)} units`} sub={fArea(v.total.area)} color="#14213d" />
          </div>

          <Card>
            <CardHead title="Absorption" sub={`${v.soldPct}% of units sold`} />
            <div style={{ margin: "12px 0 10px" }}>
              <SegBar parts={[{ v: v.sold.units, c: C_SOLD }, { v: v.unsold.units, c: C_UNS }]} />
            </div>
            <Legend items={[{ l: "Sold", c: C_SOLD, v: fN(v.sold.units) }, { l: "Available", c: C_UNS, v: fN(v.unsold.units) }]} />
            <p className="m-sub" style={{ marginTop: 10 }}>
              Avg rate {fRate(v.rate.avg)} · High {fRate(v.rate.max)} · Low {fRate(v.rate.min)}
            </p>
          </Card>

          {withSales.length > 0 && (
            <>
              <Section title="Where the value sits" />
              <Card>
                <Donut size={150} slices={withSales.map(p => ({ label: shortName(p.projectName), value: p.sold.tsv, color: colorOf(p) }))}
                  center={{ v: fCr(v.sold.tsv), l: "TSV" }} />
                <div style={{ marginTop: 14 }}>
                  <Legend items={withSales.map(p => ({ l: shortName(p.projectName), c: colorOf(p), v: `${pc(p.sold.tsv, v.sold.tsv)}%` }))} />
                </div>
              </Card>
              <Card>
                <CardHead title="Units sold by project" />
                <div style={{ marginTop: 12 }}>
                  <HBars format={n => fN(n)} rows={[...projs].sort((a, b) => b.sold.units - a.sold.units).map(p => ({
                    label: shortName(p.projectName), value: p.sold.units, color: colorOf(p), sub: `${p.soldPct}% of ${fN(p.total.units)} units`,
                    onClick: () => setSel(p),
                  }))} />
                </div>
              </Card>
            </>
          )}

          <Section title="Projects" />
          {ranked.map(p => (
            <Card key={p.invProjIdx} onClick={() => setSel(p)} style={{ borderLeft: `4px solid ${colorOf(p)}` }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 14.5, fontWeight: 800 }}>{shortName(p.projectName)}</b>
                    <div className="m-sub">{projectLocation(p.projectName) ?? "—"} · {p.sold.tsv > 0 ? `TSV ${fCr(p.sold.tsv)}` : "No sales recorded"}</div>
                  </div>
                  <Pill tone="ok">{p.soldPct}% sold</Pill>
                </div>
                <Progress pct={p.soldPct} color={C_SOLD} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--m-mut)", gap: 8 }}>
                  <span>{fN(p.sold.units)} sold · {fN(p.unsold.units)} available</span>
                  <span>{p.rate.avg === null ? "—" : fRate(p.rate.avg)}</span>
                </div>
              </div>
            </Card>
          ))}
        </>
      )}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? shortName(sel.projectName) : ""}>
        {sel && (
          <div className="m-stack">
            <div>
              <Pill tone="ok">{sel.soldPct}% sold</Pill>{" "}
              {projectLocation(sel.projectName) && <Pill>{projectLocation(sel.projectName)}</Pill>}
            </div>
            {([
              ["TSV", sel.sold.tsv > 0 ? fCr(sel.sold.tsv) : "No sales recorded"],
              ["Sold", `${fN(sel.sold.units)} units · ${fArea(sel.sold.area)}`],
              ["BBA registered", `${fN(sel.bba.units)} units · ${pc(sel.bba.units, sel.sold.units)}% of sold`],
              ["Available", `${fN(sel.unsold.units)} units · ${fArea(sel.unsold.area)}`],
              ["Total", `${fN(sel.total.units)} units · ${fArea(sel.total.area)}`],
              ["Avg rate", fRate(sel.rate.avg)],
              ["Highest rate", fRate(sel.rate.max)],
              ["Lowest rate", fRate(sel.rate.min)],
            ] as const).map(([k, val]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 14, padding: "8px 0", borderBottom: "1px solid var(--m-line)" }}>
                <span style={{ color: "var(--m-mut)" }}>{k}</span><b style={{ textAlign: "right", overflowWrap: "anywhere" }}>{val}</b>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
