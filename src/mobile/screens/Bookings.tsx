import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PDRN } from "../../utils/pdrnLogic";
import {
  ROWS, CANCELLED, AS_ON, MON, ymKey, qKey, fyKey, ymLbl, BANDS, bandOf, type Bk,
} from "../../components/bookings/bookingsShared";
import {
  Card, CardHead, Chip, Chips, Donut, Empty, FilterBar, FullViewLink, HBars, Hero, Insight, Kpi, Legend,
  List, Row, SearchBar, Section, Seg, Sheet, AreaChart, BarChart, type FilterField, type FilterValues,
} from "../ui";
import { cr, fN, inrCr, pct, pctN, shortName } from "../fmt";

type Mode = "all" | "y" | "q" | "m";
type Metric = "value" | "units";

const PALETTE = ["#1e3163", "#b8893c", "#0e7490", "#16a06f", "#7b5cb8", "#c0392b"];
const PAGE = 12;

const fyLbl = (fyEnd: string) => `FY ${String(Number(fyEnd) - 1).slice(2)}-${fyEnd.slice(2)}`;
const qLbl = (k: string) => `Q${k.split("-Q")[1]} ${fyLbl(k.split("-Q")[0])}`;
const sum = (a: Bk[], f: (b: Bk) => number) => a.reduce((s, b) => s + f(b), 0);
const bookedOn = (b: Bk) =>
  b.day >= 0
    ? new Date(new Date("2022-01-01T00:00:00").getTime() + b.day * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : `${MON[b.m - 1] ?? "—"} ${b.y > 0 ? b.y : ""}`;

export default function Bookings() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [mode, setMode] = useState<Mode>("all");
  const [key, setKey] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [metric, setMetric] = useState<Metric>("value");
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [detail, setDetail] = useState<Bk | null>(null);

  const options = useMemo(() => {
    const clean = (a: string[]) => a.filter(k => k !== "undated").sort().reverse();
    if (mode === "y") return clean([...new Set(ROWS.map(fyKey))]);
    if (mode === "q") return clean([...new Set(ROWS.map(qKey))]);
    if (mode === "m") return clean([...new Set(ROWS.map(ymKey))]);
    return [];
  }, [mode]);
  const sel = key && options.includes(key) ? key : options[0] ?? "";
  const lbl = (k: string) => (mode === "y" ? fyLbl(k) : mode === "q" ? qLbl(k) : ymLbl(k));

  const fields: FilterField[] = useMemo(() => [
    { key: "p", label: "Project", allLabel: "All projects", options: PDRN.P.map((p, i) => ({ k: String(i), l: shortName(p) })) },
    { key: "cfg", label: "Configuration", allLabel: "All configs", options: PDRN.CFG.map((c, i) => ({ k: String(i), l: c })) },
    { key: "band", label: "Ticket size", allLabel: "All sizes", options: BANDS.map((b, i) => ({ k: String(i), l: b.label })) },
  ], []);

  const inScope = (b: Bk) =>
    (!filters.p || b.p === Number(filters.p)) &&
    (!filters.cfg || b.cfg === Number(filters.cfg)) &&
    (!filters.band || bandOf(b) === Number(filters.band));
  const inPeriod = (b: Bk) =>
    mode === "all" || (mode === "y" ? fyKey(b) === sel : mode === "q" ? qKey(b) === sel : ymKey(b) === sel);

  const rows = useMemo(() => ROWS.filter(b => inScope(b) && inPeriod(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, sel, filters]);
  const cancelled = useMemo(() => CANCELLED.filter(b => inScope(b) && inPeriod(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, sel, filters]);

  const total = rows.length;
  const tcv = sum(rows, b => b.tsv);
  const area = sum(rows, b => b.area);
  const avgRate = area ? tcv / area : 0;
  const reg = rows.filter(b => b.bba >= 0).length;
  const valN = sum(rows, b => b.valN), recN = sum(rows, b => b.recN);
  const demN = sum(rows, b => b.demN);

  /** monthly trend ignores the period selector (it shows the lead-up), keeps project/config/ticket filters */
  const trend = useMemo(() => {
    const m = new Map<string, { n: number; v: number }>();
    ROWS.filter(inScope).forEach(b => {
      const k = ymKey(b);
      if (k === "undated") return;
      const e = m.get(k) ?? { n: 0, v: 0 };
      e.n++; e.v += b.tsv; m.set(k, e);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
      .map(([k, e]) => ({ label: ymLbl(k).replace("'", " '"), value: metric === "value" ? e.v : e.n }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, metric]);

  const byProject = useMemo(() => {
    const g = new Map<number, { v: number; n: number }>();
    rows.forEach(b => { const e = g.get(b.p) ?? { v: 0, n: 0 }; e.v += b.tsv; e.n++; g.set(b.p, e); });
    return [...g.entries()].sort((a, b) => b[1].v - a[1].v);
  }, [rows]);

  const cfgMix = useMemo(() => {
    const g = new Map<number, number>();
    rows.forEach(b => g.set(b.cfg, (g.get(b.cfg) ?? 0) + 1));
    const sorted = [...g.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5).map(([c, n], i) => ({ label: PDRN.CFG[c], value: n, color: PALETTE[i] }));
    const rest = sorted.slice(5).reduce((s, [, n]) => s + n, 0);
    if (rest) top.push({ label: "Other", value: rest, color: "#9aa3b5" });
    return top;
  }, [rows]);

  const records = useMemo(() => {
    const s = q.trim().toLowerCase();
    const arr = [...rows].sort((a, b) => (b.y - a.y) || (b.m - a.m) || (b.tsv - a.tsv));
    if (!s) return arr;
    return arr.filter(b =>
      PDRN.P[b.p].toLowerCase().includes(s) || PDRN.CFG[b.cfg].toLowerCase().includes(s) ||
      b.unit.toLowerCase().includes(s) || b.name.toLowerCase().includes(s) || (PDRN.TW[b.tw] ?? "").toLowerCase().includes(s));
  }, [rows, q]);

  const scope = mode === "all" ? "All time" : lbl(sel);

  return (
    <div className="m-stack">
      <div>
        <h1 className="m-h1">Bookings</h1>
        <p className="m-sub">{fN(ROWS.length)} active bookings{AS_ON ? ` · as on ${AS_ON}` : ""}</p>
      </div>

      <Seg<Mode> value={mode} onChange={m => { setMode(m); setKey(""); setShown(PAGE); }}
        options={[{ k: "all", l: "All" }, { k: "y", l: "FY" }, { k: "q", l: "Quarter" }, { k: "m", l: "Month" }]} />
      {mode !== "all" && (
        <Chips>
          {options.map(k => <Chip key={k} on={k === sel} onClick={() => { setKey(k); setShown(PAGE); }}>{lbl(k)}</Chip>)}
        </Chips>
      )}
      <FilterBar fields={fields} values={filters} onApply={v => { setFilters(v); setShown(PAGE); }} quick={["p", "cfg"]} />

      {total === 0 ? (
        <Empty title="No bookings in this view" sub="Try a different period or reset the filters." />
      ) : (
        <>
          <Hero label={`Agreement value · ${scope}`} value={inrCr(tcv)}
            sub={`${fN(total)} bookings · avg ticket ${inrCr(tcv / total)}`}
            cells={[{ v: fN(total), l: "Bookings" }, { v: `₹${fN(avgRate)}`, l: "Avg ₹/sq ft" }]} />

          <div className="m-grid2">
            <Kpi label="Units sold" value={fN(total)} sub="active bookings" accent />
            <Kpi label="Area sold" value={`${(area / 1e5).toFixed(2)} L`} sub="sq ft" />
            <Kpi label="Avg rate" value={`₹${fN(avgRate)}`} sub="per sq ft" />
            <Kpi label="BBA registered" value={fN(reg)} sub={`${pct(reg, total)} of bookings`} color="#16a06f" />
          </div>

          <div className="m-hscroll">
            <Insight label="Collection rate" value={pct(recN, valN)} pct={pctN(recN, valN)} color="#16a06f"
              sub={`${cr(recN / 1e7)} of ${cr(valN / 1e7)}`} />
            <Insight label="BBA registered" value={pct(reg, total)} pct={pctN(reg, total)} color="#b8893c"
              sub={`${fN(reg)} of ${fN(total)} units`} />
            <Insight label="Outstanding" value={inrCr(Math.max(demN - recN, 0))} pct={pctN(Math.max(demN - recN, 0), valN)} color="#c0392b"
              sub={`${fN(cancelled.length)} cancelled · ${inrCr(sum(cancelled, b => b.tsv))}`} />
          </div>

          <Card>
            <CardHead title="Monthly trend" sub="Last 12 months · tap or drag to read"
              right={<div style={{ minWidth: 132 }}><Seg<Metric> value={metric} onChange={setMetric} options={[{ k: "value", l: "Value" }, { k: "units", l: "Units" }]} /></div>} />
            {metric === "value"
              ? <AreaChart data={trend} format={v => inrCr(v, 0)} unit="agreement value" />
              : <BarChart data={trend} format={v => fN(v)} unit="bookings" />}
          </Card>

          <Section title="By project" />
          <Card>
            <HBars color="#1e3163" format={v => inrCr(v, 0)}
              rows={byProject.map(([p, e]) => ({
                label: shortName(PDRN.P[p]), value: e.v, sub: `${fN(e.n)} units · ${pct(e.v, tcv)} of value`,
                onClick: () => { setFilters(f => ({ ...f, p: String(p) })); setShown(PAGE); },
              }))} />
          </Card>

          <Section title="Configuration mix" />
          <Card>
            <Donut slices={cfgMix} center={{ v: fN(total), l: "units" }} />
            <div style={{ marginTop: 12 }}>
              <Legend items={cfgMix.map(s => ({ l: s.label, c: s.color, v: pct(s.value, total) }))} />
            </div>
          </Card>

          <Section title="Recent bookings" />
          <SearchBar value={q} onChange={v => { setQ(v); setShown(PAGE); }} placeholder="Search unit, project, tower, customer" />
          {records.length === 0 ? <Empty title="No matching bookings" sub="Try a different search." /> : (
            <>
              <List>
                {records.slice(0, shown).map((b, i) => (
                  <Row key={`${b.unit}-${i}`} title={`${PDRN.TW[b.tw] ? PDRN.TW[b.tw] + " · " : ""}${b.unit}`}
                    sub={`${shortName(PDRN.P[b.p])} · ${PDRN.CFG[b.cfg]} · ${MON[b.m - 1] ?? "—"} '${String(b.y).slice(2)}`}
                    value={cr(b.tsv / 1e7, 2)} valueSub={`${fN(Math.round(b.area))} sq ft`} onClick={() => setDetail(b)} />
                ))}
              </List>
              {shown < records.length && (
                <button type="button" className="m-btn" onClick={() => setShown(s => s + PAGE)}>
                  Show more ({fN(records.length - shown)} left)
                </button>
              )}
            </>
          )}
        </>
      )}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? `Unit ${detail.unit}` : ""}>
        {detail && (
          <div className="m-stack">
            <div className="m-card" style={{ boxShadow: "none", background: "var(--m-soft)" }}>
              <span className="m-label">Agreement value</span>
              <div className="m-num" style={{ fontSize: 26, fontWeight: 800 }}>{inrCr(detail.tsv, 2)}</div>
              <small style={{ color: "var(--m-mut)" }}>₹{fN(detail.tsv / Math.max(detail.area, 1))} per sq ft</small>
            </div>
            {([
              ["Booked", bookedOn(detail)],
              ["Project", PDRN.P[detail.p]],
              ["Tower", PDRN.TW[detail.tw] ?? "—"],
              ["Unit", detail.unit],
              ["Configuration", PDRN.CFG[detail.cfg]],
              ["Super area", `${fN(Math.round(detail.area))} sq ft`],
              ["Customer", detail.name],
              ["Payment plan", detail.plan],
              ["Received (incl. tax)", inrCr(detail.rec, 2)],
              ["Value (with tax)", inrCr(detail.tcvT, 2)],
              ["Due now", inrCr(Math.max(detail.due, 0), 2)],
              ["BBA", detail.bba >= 0 ? "Registered" : "Not registered"],
            ] as const).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 14, fontSize: 14, padding: "8px 0", borderBottom: "1px solid var(--m-line)" }}>
                <span style={{ color: "var(--m-mut)", flex: "0 0 auto" }}>{k}</span>
                <b style={{ textAlign: "right", minWidth: 0, overflowWrap: "anywhere" }}>{v}</b>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
