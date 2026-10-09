import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardHead, Empty, FilterBar, FullViewLink, HBars, Hero, Kpi, Legend, List, Pill, Progress, Ring, Row, SearchBar, Section, SegBar, Seg, Sheet, type FilterValues } from "../ui";
import { fN } from "../fmt";
import raw from "../../data/projectTracker.json";

/* Same data + definitions as the desktop Project Tracker: activities = leaf WBS tasks,
   Overdue = planned end passed and not complete, Slip = planned end later than baseline. */
const EPOCH = Date.UTC(2022, 0, 1);
const DAY = 86400000;
const fD = (d: number) => (d < 0 ? "—" : new Date(EPOCH + d * DAY).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }));
const AS_ON = Math.round((Date.UTC(2026, 8, 28) - EPOCH) / DAY);

interface TrkFile {
  meta: { asOn: string };
  PROJECTS: string[]; STATUS: string[]; TRADES: string[]; OWNERS: string[]; TOWERS: string[]; FLOORS: string[];
  T: (string | number)[][];
}
const D = raw as unknown as TrkFile;

interface Task {
  proj: number; name: string; pct: number; st: number;
  ps: number; pe: number; as: number; ae: number; be: number;
  trade: number; owner: number; tower: number; floor: number;
  done: boolean; active: boolean; overdue: boolean; slip: number;
}
const ACTS: Task[] = D.T.filter(t => (t[15] as number) === 1).map(t => {
  const st = t[4] as number, pct = t[3] as number, pe = t[6] as number, be = t[9] as number;
  const sName = D.STATUS[st];
  const done = sName === "Complete" || sName === "Quality checked" || pct >= 100;
  return {
    proj: t[0] as number, name: t[1] as string, pct, st,
    ps: t[5] as number, pe, as: t[7] as number, ae: t[8] as number, be,
    trade: t[10] as number, owner: t[11] as number, tower: t[12] as number, floor: t[13] as number,
    done, active: sName === "Started",
    overdue: !done && pe >= 0 && pe < AS_ON,
    slip: pe >= 0 && be >= 0 && pe > be ? pe - be : 0,
  };
});
const TOWER_ORDER = ["T1", "T2", "T3", "T4", "T5", "T6", "EWS", "Clubhouse", "NTA"];
const GREEN = "#16a06f", RED = "#d64545", BLUE = "#1a7f9c", GREY = "#9a927e", AMBER = "#e0a030";
const avg = (xs: Task[]) => (xs.length ? xs.reduce((s, t) => s + t.pct, 0) / xs.length : 0);
const pcol = (p: number) => (p >= 60 ? GREEN : p >= 30 ? "#b8893c" : BLUE);
const statusOf = (t: Task): [string, "ok" | "bad" | undefined, string] =>
  t.overdue ? ["Overdue", "bad", RED] : t.done ? ["Complete", "ok", GREEN] : t.active ? ["In progress", undefined, BLUE] : [D.STATUS[t.st] || "Not started", undefined, GREY];
const loc = (t: Task) => `${D.TOWERS[t.tower] || "—"}${D.FLOORS[t.floor] ? ` · ${D.FLOORS[t.floor]}` : ""}`;
const AGE = [["0–30 d", 0, 30], ["31–90 d", 31, 90], ["91–180 d", 91, 180], ["> 180 d", 181, 1e9]] as const;

export default function Tracker() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [fv, setFv] = useState<FilterValues>({});
  const [status, setStatus] = useState<"all" | "done" | "run" | "todo" | "late">("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(30);
  const [sel, setSel] = useState<Task | null>(null);

  const projF = fv.proj ? Number(fv.proj) : -1;

  const fields = useMemo(() => {
    const present = new Set(ACTS.filter(t => projF < 0 || t.proj === projF).map(t => D.TOWERS[t.tower]).filter(Boolean));
    const towers = [...TOWER_ORDER.filter(t => present.has(t)), ...[...present].filter(t => !TOWER_ORDER.includes(t)).sort()];
    return [
      { key: "proj", label: "Project", allLabel: "All projects", options: D.PROJECTS.map((p, i) => ({ k: String(i), l: p })) },
      { key: "tower", label: "Tower / area", allLabel: "All towers", options: towers.map(t => ({ k: t, l: t })) },
      { key: "trade", label: "Trade", allLabel: "All trades", options: D.TRADES.map((t, i) => ({ k: String(i), l: t })).filter(o => o.l) },
    ];
  }, [projF]);

  // scope without the status chip, so status counts stay visible
  const base = useMemo(() => {
    const s = q.trim().toLowerCase();
    return ACTS.filter(t => {
      if (projF >= 0 && t.proj !== projF) return false;
      if (fv.tower && D.TOWERS[t.tower] !== fv.tower) return false;
      if (fv.trade && t.trade !== Number(fv.trade)) return false;
      if (s && !t.name.toLowerCase().includes(s) && !(D.TRADES[t.trade] || "").toLowerCase().includes(s) &&
          !(D.OWNERS[t.owner] || "").toLowerCase().includes(s) && !(D.TOWERS[t.tower] || "").toLowerCase().includes(s)) return false;
      return true;
    });
  }, [projF, fv, q]);

  const done = base.filter(t => t.done);
  const run = base.filter(t => t.active && !t.done);
  const todo = base.filter(t => !t.done && !t.active);
  const late = base.filter(t => t.overdue);
  const slipped = base.filter(t => t.slip > 0);
  const overall = avg(base);
  const avgLate = late.length ? late.reduce((s, t) => s + (AS_ON - t.pe), 0) / late.length : 0;
  const avgSlip = slipped.length ? slipped.reduce((s, t) => s + t.slip, 0) / slipped.length : 0;

  const scoped = useMemo(() => base.filter(t =>
    status === "all" ? true : status === "done" ? t.done : status === "run" ? t.active && !t.done :
    status === "todo" ? !t.done && !t.active && !t.overdue : t.overdue), [base, status]);
  const list = useMemo(() => [...scoped].sort((a, b) => (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0) || a.pe - b.pe), [scoped]);

  // per-project cards (respect tower/trade/search, ignore project filter)
  const projects = useMemo(() => D.PROJECTS.map((name, pi) => {
    const s = q.trim().toLowerCase();
    const a = ACTS.filter(t => t.proj === pi && (!fv.tower || D.TOWERS[t.tower] === fv.tower) && (!fv.trade || t.trade === Number(fv.trade)) &&
      (!s || t.name.toLowerCase().includes(s)));
    const dueNow = a.filter(t => t.pe >= 0 && t.pe < AS_ON).length;
    return { pi, name, a, pct: avg(a), d: a.filter(t => t.done).length, run: a.filter(t => t.active && !t.done).length,
      od: a.filter(t => t.overdue).length, slip: a.filter(t => t.slip > 0).length, dueNow };
  }).filter(p => p.a.length), [fv.tower, fv.trade, q]);

  const towers = useMemo(() => {
    const m = new Map<string, Task[]>();
    base.forEach(t => { const k = D.TOWERS[t.tower]; if (!k) return; if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); });
    return [...m.entries()].map(([k, ts]) => ({ k, ts, pct: avg(ts), od: ts.filter(t => t.overdue).length }))
      .sort((a, b) => (TOWER_ORDER.indexOf(a.k) + 99 * +(TOWER_ORDER.indexOf(a.k) < 0)) - (TOWER_ORDER.indexOf(b.k) + 99 * +(TOWER_ORDER.indexOf(b.k) < 0)));
  }, [base]);

  const trades = useMemo(() => {
    const m = new Map<number, Task[]>();
    base.forEach(t => { if (D.TRADES[t.trade]) { if (!m.has(t.trade)) m.set(t.trade, []); m.get(t.trade)!.push(t); } });
    return [...m.entries()].map(([ti, ts]) => ({ ti, ts, pct: avg(ts), od: ts.filter(t => t.overdue).length }))
      .sort((a, b) => b.ts.length - a.ts.length).slice(0, 8);
  }, [base]);

  const bands = AGE.map(([l, lo, hi]) => ({ l, n: late.filter(t => { const d = AS_ON - t.pe; return d >= lo && d <= hi; }).length }));

  const reset = () => { setFv({}); setStatus("all"); setQ(""); setLimit(30); };

  return (
    <div className="m-stack">
      <div>
        <h1 className="m-h1">Project Tracker</h1>
        <p className="m-sub">Construction schedule progress · {fN(ACTS.length)} site activities · as on {D.meta.asOn}</p>
      </div>
      <FilterBar fields={fields} values={fv} onApply={v => { setFv(v); setLimit(30); }} quick={["proj", "tower"]} />

      <Hero label={projF >= 0 ? D.PROJECTS[projF] : "Overall construction progress"} value={`${overall.toFixed(0)}%`}
        sub={`avg completion across ${fN(base.length)} activities`}>
        <div style={{ marginTop: 12 }}>
          <Progress pct={overall} color="#d6ac5e" lg />
          <div style={{ marginTop: 14 }}>
            <SegBar parts={[{ v: done.length, c: GREEN }, { v: run.filter(t => !t.overdue).length, c: BLUE }, { v: todo.filter(t => !t.overdue).length, c: GREY }, { v: late.length, c: RED }]} />
            <div style={{ marginTop: 8 }}>
              <Legend items={[{ l: "Complete", c: GREEN, v: fN(done.length) }, { l: "Running", c: BLUE, v: fN(run.filter(t => !t.overdue).length) }, { l: "Not started", c: GREY, v: fN(todo.filter(t => !t.overdue).length) }, { l: "Overdue", c: RED, v: fN(late.length) }]} />
            </div>
          </div>
        </div>
      </Hero>

      <div className="m-grid2">
        <Kpi label="Completed" value={fN(done.length)} sub={`${base.length ? Math.round((done.length / base.length) * 100) : 0}% of activities`} color={GREEN} accent />
        <Kpi label="In progress" value={fN(run.length)} sub="running on site now" color={BLUE} />
        <Kpi label="Overdue" value={fN(late.length)} sub={`avg ${Math.round(avgLate)} d past planned end`} color={RED} />
        <Kpi label="Slipped vs baseline" value={fN(slipped.length)} sub={`avg ${Math.round(avgSlip)} d later`} color={AMBER} />
      </div>

      {projF < 0 && projects.length > 0 && (
        <>
          <Section title="Projects" />
          {projects.map(p => (
            <Card key={p.pi} onClick={() => { setFv(v => ({ ...v, proj: String(p.pi), tower: "" })); setLimit(30); }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <Ring pct={p.pct} size={64} stroke={8} color={pcol(p.pct)} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 className="m-ct">{p.name}</h3>
                  <p className="m-cs">{fN(p.d)} of {fN(p.a.length)} activities done · {fN(p.run)} running</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    <Pill tone={p.od ? "bad" : "ok"}>{p.od ? `${fN(p.od)} overdue` : "On schedule"}</Pill>
                    {p.slip > 0 && <Pill tone="warn">{fN(p.slip)} slipped</Pill>}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--m-mut)", marginBottom: 4 }}>
                  <span>Actual · {p.a.length ? Math.round((p.d / p.a.length) * 100) : 0}% done</span>
                  <span>Due by now · {p.a.length ? Math.round((p.dueNow / p.a.length) * 100) : 0}%</span>
                </div>
                <Progress pct={p.a.length ? (p.d / p.a.length) * 100 : 0} color={pcol(p.pct)} />
                <div style={{ height: 4 }} />
                <Progress pct={p.a.length ? (p.dueNow / p.a.length) * 100 : 0} color="#b9c0d2" />
                <p className="m-cs" style={{ marginTop: 6 }}>Planned end passed for {fN(p.dueNow)} activities; {fN(p.d)} are complete.</p>
              </div>
            </Card>
          ))}
        </>
      )}

      {towers.length > 0 && (
        <Card>
          <CardHead title="Tower-wise progress" sub="Avg completion of each tower's activities" />
          <div style={{ marginTop: 10 }}>
            <HBars format={v => `${v.toFixed(0)}%`} rows={towers.map(t => ({
              label: t.k, value: t.pct, color: pcol(t.pct), sub: `${fN(t.ts.filter(x => x.done).length)} / ${fN(t.ts.length)} done · ${fN(t.od)} overdue`,
              onClick: () => { setFv(v => ({ ...v, tower: t.k })); setLimit(30); },
            }))} />
          </div>
        </Card>
      )}

      {trades.length > 0 && (
        <Card>
          <CardHead title="Trade progress" sub="Top trades by activity count" />
          <div style={{ marginTop: 10 }}>
            <HBars format={v => `${v.toFixed(0)}%`} rows={trades.map(t => ({
              label: D.TRADES[t.ti], value: t.pct, color: pcol(t.pct), sub: `${fN(t.ts.length)} activities · ${fN(t.od)} overdue`,
            }))} />
          </div>
        </Card>
      )}

      {late.length > 0 && (
        <Card>
          <CardHead title="Overdue ageing" sub="Days past planned end" />
          <div style={{ marginTop: 10 }}>
            <HBars format={fN} rows={bands.map((b, i) => ({ label: b.l, value: b.n, color: i >= 2 ? RED : AMBER }))} />
          </div>
        </Card>
      )}

      <Section title="Activities" />
      <Seg value={status} options={[{ k: "all", l: "All" }, { k: "late", l: `Overdue · ${fN(late.length)}` }, { k: "run", l: "Running" }, { k: "done", l: "Done" }]}
        onChange={s => { setStatus(s); setLimit(30); }} />
      <SearchBar value={q} onChange={v => { setQ(v); setLimit(30); }} placeholder="Activity / trade / owner / tower" />
      {list.length === 0 ? (
        <>
          <Empty title="No activities" sub="Nothing matches these filters." />
          <button type="button" className="m-btn" onClick={reset}>Reset filters</button>
        </>
      ) : (
        <>
          <List>
            {list.slice(0, limit).map((t, i) => {
              const [lbl, tone] = statusOf(t);
              return (
                <Row key={i + t.name} title={t.name}
                  sub={`${projF < 0 ? D.PROJECTS[t.proj] + " · " : ""}${loc(t)} · ${t.pct.toFixed(0)}% · ends ${fD(t.pe)}`}
                  right={<Pill tone={tone}>{lbl}</Pill>} onClick={() => setSel(t)} />
              );
            })}
          </List>
          {list.length > limit && <button type="button" className="m-btn" onClick={() => setLimit(l => l + 30)}>Show more ({fN(list.length - limit)} left)</button>}
        </>
      )}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!sel} onClose={() => setSel(null)} title="Activity detail">
        {sel && (
          <div className="m-stack">
            <div>
              <h3 className="m-ct" style={{ fontSize: 15 }}>{sel.name}</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <Pill tone={statusOf(sel)[1]}>{statusOf(sel)[0]}</Pill>
                {sel.slip > 0 && <Pill tone="warn">{sel.slip} d slip</Pill>}
              </div>
            </div>
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="m-label">Progress</span><b className="m-num" style={{ fontSize: 20, color: pcol(sel.pct) }}>{sel.pct.toFixed(0)}%</b>
              </div>
              <div style={{ marginTop: 8 }}><Progress pct={sel.pct} color={sel.done ? GREEN : pcol(sel.pct)} lg /></div>
            </Card>
            <List>
              <Row title="Project" value={D.PROJECTS[sel.proj]} />
              <Row title="Tower / location" value={loc(sel)} />
              <Row title="Trade" value={D.TRADES[sel.trade] || "—"} />
              <Row title="Owner" value={D.OWNERS[sel.owner] || "—"} />
              <Row title="Planned" value={`${fD(sel.ps)} → ${fD(sel.pe)}`} />
              <Row title="Actual" value={`${fD(sel.as)} → ${fD(sel.ae)}`} />
              <Row title="Baseline end" value={fD(sel.be)} />
              {sel.slip > 0 && <Row title="Slip vs baseline" value={`${sel.slip} days later`} />}
              {sel.overdue && <Row title="Overdue by" value={`${AS_ON - sel.pe} days`} />}
            </List>
          </div>
        )}
      </Sheet>
    </div>
  );
}
