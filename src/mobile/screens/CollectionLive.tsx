import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AreaChart, BarChart, Card, CardHead, Donut, Empty, FilterBar, FullViewLink, Hero, HBars, Kpi, List, Pill, Progress, Row, ScreenSkeleton, SearchBar, SegBar, Section, Seg, Sheet, Legend, type FilterField, type FilterValues } from "../ui";
import { fN, inrCr, pct, pctN } from "../fmt";

/* Same source & semantics as the desktop Collection page (/collections/data on the VendorGlobe API). */
const API_BASE = "http://192.168.66.28:5002";
const GREEN = "#16a06f", RED = "#d64545", NAVY = "#1e3163", GOLD = "#b8893c", TEAL = "#0e7490", GREY = "#d5daea";
const CAT = ["#1e3163", "#0e7490", "#16a06f", "#b8893c", "#d64545", "#6b5f8f", "#2a78d6", "#eb6834"];

interface Led {
  proj: string; phase: string | null; reg: string; unit: string | null; allot: string | null;
  unitType: string | null; plan: string | null; planType: string | null; allotDate: string | null;
  tcv: number; dem: number; rec: number; due: number;
  letter: string | null; letterDate: string | null; letterDue: string | null;
  rm: string | null; rmFinal: string | null; remarks: string | null; rmStatus: string | null;
  funding: string | null; bank: string | null; sanctAmt: number; bba: string | null; bbaDate: string | null; statusV: string | null;
}
interface Tgt { rm: string; proj: string; tgt: number; recd: number }
interface Rcpt { proj: string; reg: string | null; unit: string | null; amt: number; mode: string | null; bank: string | null; rcptDate: string | null; rm: string | null }
interface Allot { label: string; done: number; pending: number; total: number; tcv: number; called: number; recd: number; due: number; fut: number; kind: "proj" | "phase" | "total"; proj: string | null }
interface Raw { asOf: Record<string, string | null>; errors: string[]; ledger: Led[]; receipts: Rcpt[]; allot: Allot[]; targets: Tgt[] }

function unpack<T>(p: { cols: string[]; rows: unknown[][] }): T[] {
  return p.rows.map(r => Object.fromEntries(p.cols.map((c, i) => [c, r[i]])) as T);
}
const fD = (iso: string | null) => !iso ? "—" : new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" });
const TODAY = new Date().toISOString().slice(0, 10);
const sumBy = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
const group = <T,>(a: T[], key: (x: T) => string) => {
  const m = new Map<string, T[]>();
  a.forEach(x => { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k)!.push(x); });
  return m;
};

type View = "master" | "daily";
type Drill = { title: string; sub?: string } & ({ kind: "custs"; rows: Led[] } | { kind: "rcpts"; rows: Rcpt[] });

export default function CollectionLive() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [raw, setRaw] = useState<Raw | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setViewRaw] = useState<View>("master");
  const [f, setF] = useState<FilterValues>({});
  const [q, setQ] = useState("");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [cust, setCust] = useState<Led | null>(null);
  const [dq, setDq] = useState("");

  const load = useCallback(() => {
    setLoading(true); setError(null);
    fetch(`${API_BASE}/collections/data`)
      .then(r => r.json())
      .then(j => {
        if (!j.ok) throw new Error(j.error || "backend error");
        setRaw({ asOf: j.asOf, errors: j.errors || [], ledger: unpack<Led>(j.ledger), receipts: unpack<Rcpt>(j.receipts), allot: j.allot ? unpack<Allot>(j.allot) : [], targets: j.targets ? unpack<Tgt>(j.targets) : [] });
        setLoading(false);
      })
      .catch(e => { setError(String(e.message || e)); setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  /* the two files have different project / RM vocabularies → switching view clears filters */
  const setView = (v: View) => { setViewRaw(v); setF({}); setQ(""); };

  const ledger = raw?.ledger ?? [], receipts = raw?.receipts ?? [], allotAll = raw?.allot ?? [], targets = raw?.targets ?? [];
  const projOpts = useMemo(() => (view === "master"
    ? [...new Set(ledger.map(l => l.proj))] : [...new Set([...receipts.map(r => r.proj), ...targets.map(t => t.proj)])]).filter(Boolean).sort(), [view, ledger, receipts, targets]);
  const rmOpts = useMemo(() => (view === "master"
    ? [...new Set(ledger.map(l => l.rm).filter((x): x is string => !!x))] : [...new Set(targets.map(t => t.rm))]).sort(), [view, ledger, targets]);
  const fields: FilterField[] = [
    { key: "proj", label: "Project", options: projOpts.map(p => ({ k: p, l: p })), allLabel: "All projects" },
    { key: "rm", label: "RM", options: rmOpts.map(p => ({ k: p, l: p })), allLabel: "All RMs" },
  ];

  const match = (proj: string, texts: (string | null)[]) => {
    if (f.proj && proj !== f.proj) return false;
    const s = q.trim().toLowerCase();
    return !s || texts.some(t => (t || "").toLowerCase().includes(s));
  };
  const led = useMemo(() => ledger.filter(l => match(l.proj, [l.reg, l.unit, l.rm, l.bank]) && (!f.rm || l.rm === f.rm)), [ledger, f, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const rmHit = (rrm: string | null) => !f.rm || (rrm || "").toLowerCase().includes(f.rm.split("/")[0].toLowerCase().trim());
  const rcp = useMemo(() => receipts.filter(r => match(r.proj, [r.reg, r.unit, r.rm, r.bank]) && rmHit(r.rm)), [receipts, f, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const tgts = useMemo(() => targets.filter(t => (!f.proj || t.proj === f.proj) && (!f.rm || t.rm === f.rm)), [targets, f]);
  const allot = useMemo(() => allotAll.filter(a => a.kind !== "total" && (!f.proj || a.proj === f.proj)), [allotAll, f]);

  const openCusts = (title: string, rows: Led[], sub?: string) => { setCust(null); setDq(""); setDrill({ kind: "custs", title, sub, rows: [...rows].sort((a, b) => b.due - a.due) }); };
  const openRcpts = (title: string, rows: Rcpt[]) => { setCust(null); setDq(""); setDrill({ kind: "rcpts", title, rows }); };
  const closeDrill = () => { setDrill(null); setCust(null); setDq(""); };

  /* ---- master derived ---- */
  const withDue = led.filter(l => l.due > 1000);
  const totDue = sumBy(led, l => l.due), totDem = sumBy(led, l => l.dem), totRec = sumBy(led, l => l.rec);
  const futDue = sumBy(led, l => Math.max(l.tcv - l.dem, 0));
  const byProj = useMemo(() => [...group(led, l => l.proj).entries()].map(([pj, ls]) => ({
    pj, ls, due: sumBy(ls, l => l.due), dem: sumBy(ls, l => l.dem), rec: sumBy(ls, l => l.rec), fut: sumBy(ls, l => Math.max(l.tcv - l.dem, 0)),
  })).sort((a, b) => b.due - a.due), [led]);
  const byStatus = useMemo(() => [...group(led, l => l.statusV || "—").entries()].map(([st, ls]) => ({ st, ls, due: sumBy(ls, l => l.due), rec: sumBy(ls, l => l.rec), dem: sumBy(ls, l => l.dem) })).sort((a, b) => b.due - a.due), [led]);
  const byRm = useMemo(() => [...group(led, l => l.rmFinal || "Unassigned").entries()].map(([rm, ls]) => ({ rm, ls, due: sumBy(ls, l => l.due), rec: sumBy(ls, l => l.rec), dem: sumBy(ls, l => l.dem) })).sort((a, b) => b.due - a.due), [led]);
  const allotProj = allot.filter(a => a.kind === "proj");

  /* ---- daily derived ---- */
  const monthKey = useMemo(() => {
    const ds = rcp.map(r => r.rcptDate).filter((x): x is string => !!x).sort();
    return ds.length ? ds[ds.length - 1].slice(0, 7) : TODAY.slice(0, 7);
  }, [rcp]);
  const mtd = rcp.filter(r => (r.rcptDate || "").startsWith(monthKey));
  const mtdAmt = sumBy(mtd, r => r.amt);
  const dayTotals = useMemo(() => {
    const m = new Map<string, number>();
    mtd.forEach(r => m.set(r.rcptDate!, (m.get(r.rcptDate!) || 0) + r.amt));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [mtd]);
  const bestDay = dayTotals.reduce<[string, number]>((b, d) => (d[1] > b[1] ? d : b), ["", 0]);
  const monthLbl = new Date(monthKey + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const tgtTot = sumBy(tgts, t => t.tgt), tgtRec = sumBy(tgts, t => t.recd);
  const tgtPct = pctN(tgtRec, tgtTot);
  const tgtCol = tgtPct >= 60 ? GREEN : tgtPct >= 35 ? GOLD : RED;
  const modes = useMemo(() => [...group(mtd, r => (r.mode || "Unknown").trim().toUpperCase()).entries()].map(([md, rs]) => ({ md, rs, v: sumBy(rs, r => r.amt) })).sort((a, b) => b.v - a.v), [mtd]);
  const mtdProj = useMemo(() => [...group(mtd, r => r.proj).entries()].map(([pj, rs]) => ({ pj, rs, v: sumBy(rs, r => r.amt) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v), [mtd]);
  const tByP = useMemo(() => [...group(tgts, t => t.proj).entries()].map(([pj, ts]) => ({ pj, tgt: sumBy(ts, t => t.tgt), rec: sumBy(ts, t => t.recd) })).sort((a, b) => b.tgt - a.tgt), [tgts]);
  const tByRm = useMemo(() => [...group(tgts, t => t.rm).entries()].map(([rm, ts]) => ({ rm, tgt: sumBy(ts, t => t.tgt), rec: sumBy(ts, t => t.recd) })).sort((a, b) => b.tgt - a.tgt), [tgts]);
  const donutSlices = (rows: { pj: string; v: number }[]) => {
    const top = rows.slice(0, 5), rest = rows.slice(5);
    const out = top.map((x, i) => ({ label: x.pj, value: x.v, color: CAT[i] }));
    if (rest.length) out.push({ label: "Other", value: sumBy(rest, x => x.v), color: GREY });
    return out;
  };

  const rcol = (p: number) => (p >= 95 ? GREEN : p >= 80 ? GOLD : RED);
  const asOf = raw ? `Master ${raw.asOf.master?.slice(0, 10) ?? "—"} · Daily ${raw.asOf.daily?.slice(0, 10) ?? "—"}` : "";

  /* ---- drill sheet body ---- */
  const dRows = drill?.kind === "custs" ? drill.rows.filter(l => { const t = dq.trim().toLowerCase(); return !t || (l.unit || "").toLowerCase().includes(t) || l.proj.toLowerCase().includes(t); }) : [];
  const sheetTitle = cust ? `Unit ${cust.unit ?? "—"}` : drill?.title ?? "";

  return (
    <div className="m-stack">
      <div><h1 className="m-h1">Collection</h1><p className="m-sub">Live from the CRM Excel files{asOf ? ` · ${asOf}` : ""}</p></div>

      <Seg<View> value={view} options={[{ k: "master", l: "Monthly" }, { k: "daily", l: "Daily" }]} onChange={setView} />

      {loading && <ScreenSkeleton />}

      {error && !loading && (
        <Card>
          <Empty title="Collection service unreachable" sub={`${error}. Check VendorGlobeAPI on 192.168.66.28:5002 and that it can read the shared folder.`} />
          <button type="button" className="m-btn pri" style={{ marginTop: 10 }} onClick={load}>Retry</button>
        </Card>
      )}

      {raw && !loading && <>
        {raw.errors.length > 0 && <Card><p className="m-sub" style={{ color: "#96691c", fontWeight: 600 }}>{raw.errors.join(" · ")}</p></Card>}

        <FilterBar fields={fields} values={f} onApply={setF} quick={["proj"]} />
        {view === "master" && <SearchBar value={q} onChange={setQ} placeholder="Unit / reg no. / bank / RM" />}
        {view === "daily" && <SearchBar value={q} onChange={setQ} placeholder="Receipts: unit / bank / RM" />}

        {view === "master" && (led.length === 0 ? <Empty title="No units" sub="Nothing matches these filters." /> : <>
          <Hero label="Net dues outstanding" value={inrCr(totDue)} sub={`${fN(withDue.length)} units with dues · as on ${raw.asOf.master?.slice(0, 10) ?? "—"}`}
            cells={[{ v: pct(totRec, totDem, 1), l: "Recovery" }, { v: inrCr(totRec), l: "Received" }, { v: inrCr(totDem), l: "Demanded" }]}>
            <div style={{ marginTop: 12 }}><SegBar parts={[{ v: Math.max(totRec, 0), c: "#4fd1a0" }, { v: Math.max(totDue, 0), c: "#ff8a80" }]} /></div>
          </Hero>

          <div className="m-grid2">
            <Kpi label="Future dues" value={inrCr(futDue)} sub="TCV not yet demanded" color={NAVY} accent onClick={() => openCusts("Units with future dues", led.filter(l => l.tcv - l.dem > 1000))} />
            <Kpi label="Allotment pending" value={fN(sumBy(allotProj, a => a.pending))} sub={`of ${fN(sumBy(allotProj, a => a.total))} units`} color={TEAL} />
          </div>

          <Section title="Who holds the dues" />
          <Card>
            <CardHead title="Net dues by project" sub="Top projects, tap a row for units" />
            {(() => {
              const rows = byProj.map(g => ({ pj: g.pj, v: Math.max(g.due, 0) })).filter(x => x.v > 1e5);
              const sl = donutSlices(rows);
              return rows.length ? <>
                <div style={{ margin: "14px 0 10px" }}><Donut slices={sl} center={{ v: inrCr(sumBy(rows, x => x.v), 0), l: "net due" }} /></div>
                <Legend items={sl.map(s => ({ l: s.label, c: s.color, v: pct(s.value, sumBy(rows, x => x.v)) }))} />
              </> : <Empty title="No dues" />;
            })()}
          </Card>

          <Section title="Recovery by project" />
          <Card>
            <HBars format={v => `${v.toFixed(1)}%`} rows={[...byProj].map(g => ({ g, p: pctN(g.rec, g.dem) })).sort((a, b) => a.p - b.p).map(({ g, p }) => ({
              label: g.pj, value: Math.min(p, 100), color: rcol(p), sub: `${inrCr(g.rec)} of ${inrCr(g.dem)} demanded`, onClick: () => openCusts(g.pj, g.ls),
            }))} />
          </Card>

          <Section title="Status" />
          <List>
            {byStatus.map(g => (
              <Row key={g.st} title={g.st} sub={`${fN(g.ls.length)} units · ${pct(g.rec, g.dem)} recovered`} value={inrCr(g.due)} valueSub="net due" onClick={() => openCusts(g.st, g.ls)} />
            ))}
          </List>

          <Section title="By RM" />
          <List>
            {byRm.slice(0, 12).map((g, i) => (
              <Row key={g.rm} rank={i + 1} title={g.rm} sub={`${fN(g.ls.length)} units · ${pct(g.rec, g.dem)} recovered`} value={inrCr(g.due)} valueSub="net due" onClick={() => openCusts(`${g.rm} · units`, g.ls)} />
            ))}
          </List>
          {byRm.length > 12 && <p className="m-sub" style={{ textAlign: "center" }}>Top 12 of {fN(byRm.length)} RMs. Use the RM filter for others.</p>}

          {allot.length > 0 && <>
            <Section title="Allotment status" />
            <List>
              {allotProj.map(a => (
                <Row key={a.label} title={a.label} sub={`${fN(a.done)} done · ${a.pending ? fN(a.pending) + " pending" : "all allotted"}`}
                  value={`${fN(a.total)} units`} valueSub={`due ₹${a.due.toFixed(2)} Cr`}
                  right={a.pending ? <Pill tone="warn">{fN(a.pending)}</Pill> : <Pill tone="ok">Done</Pill>} />
              ))}
            </List>
          </>}
        </>)}

        {view === "daily" && <>
          <Hero label={`Collected · ${monthLbl}`} value={inrCr(mtdAmt)} sub={`${fN(mtd.length)} receipts over ${fN(dayTotals.length)} collection days`}
            cells={[{ v: bestDay[0] ? inrCr(bestDay[1]) : "—", l: bestDay[0] ? `Best · ${fD(bestDay[0])}` : "Best day" }, { v: dayTotals.length ? inrCr(mtdAmt / dayTotals.length) : "—", l: "Daily avg" }, { v: mtd.length ? inrCr(mtdAmt / mtd.length) : "—", l: "Avg receipt" }]} />

          {tgts.length > 0 && (
            <Card>
              <CardHead title="Month target" sub="This month's cycle" right={<Pill tone={tgtPct >= 60 ? "ok" : tgtPct >= 35 ? "warn" : "bad"}>{tgtPct.toFixed(0)}% achieved</Pill>} />
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "10px 0 6px" }}>
                <b className="m-num" style={{ fontSize: 22, color: tgtCol }}>₹{tgtRec.toFixed(2)} Cr</b>
                <span className="m-sub">of ₹{tgtTot.toFixed(2)} Cr</span>
              </div>
              <Progress pct={tgtPct} color={tgtCol} lg />
              <p className="m-sub" style={{ marginTop: 8 }}>Balance ₹{(tgtTot - tgtRec).toFixed(2)} Cr</p>
            </Card>
          )}

          {dayTotals.length === 0 ? <Empty title="No receipts" sub="No receipts for this selection." /> : <>
            <Section title="Day by day" />
            <Card>
              <CardHead title="Daily receipts" sub={monthLbl} />
              <BarChart data={dayTotals.map(([k, v]) => ({ label: k.slice(8), value: v }))} format={inrCr} />
              <button type="button" className="m-btn" style={{ marginTop: 8 }} onClick={() => bestDay[0] && openRcpts(`Receipts on ${fD(bestDay[0])}`, mtd.filter(r => r.rcptDate === bestDay[0]))}>Best day receipts</button>
            </Card>
            <Card>
              <CardHead title="Month-to-date build-up" sub="Cumulative collections" />
              {(() => { let run = 0; return <AreaChart data={dayTotals.map(([k, v]) => { run += v; return { label: k.slice(8), value: run }; })} format={inrCr} color={GREEN} />; })()}
            </Card>

            <Section title="Mix" />
            <Card>
              <CardHead title="Share by project" sub="This month's receipts" />
              {(() => {
                const sl = donutSlices(mtdProj);
                return <>
                  <div style={{ margin: "14px 0 10px" }}><Donut slices={sl} center={{ v: inrCr(mtdAmt, 0), l: "collected" }} /></div>
                  <Legend items={sl.map(s => ({ l: s.label, c: s.color, v: pct(s.value, mtdAmt) }))} />
                </>;
              })()}
            </Card>
            <Card>
              <CardHead title="Payment mode" sub="Tap a bar for receipts" />
              <HBars format={inrCr} color={TEAL} rows={modes.map(m => ({ label: m.md.charAt(0) + m.md.slice(1).toLowerCase(), value: m.v, sub: `${fN(m.rs.length)} receipts`, onClick: () => openRcpts(`${m.md} receipts`, m.rs) }))} />
            </Card>
          </>}

          {tByP.length > 0 && <>
            <Section title="Target vs received" />
            <List>
              {tByP.map(x => { const p = pctN(x.rec, x.tgt); return (
                <Row key={x.pj} title={x.pj} sub={`₹${x.rec.toFixed(2)} of ₹${x.tgt.toFixed(2)} Cr`} value={`${p.toFixed(0)}%`} valueSub={`bal ₹${(x.tgt - x.rec).toFixed(2)} Cr`}
                  right={<Pill tone={p >= 60 ? "ok" : p >= 35 ? "warn" : "bad"}>{p.toFixed(0)}%</Pill>} />
              ); })}
            </List>
            <Section title="RM-wise target" />
            <List>
              {tByRm.slice(0, 12).map((x, i) => { const p = pctN(x.rec, x.tgt); return (
                <Row key={x.rm} rank={i + 1} title={x.rm} sub={`₹${x.rec.toFixed(2)} of ₹${x.tgt.toFixed(2)} Cr`} value={`${p.toFixed(0)}%`} valueSub="achieved"
                  onClick={() => openRcpts(`${x.rm} · receipts this month`, mtd.filter(r => (r.rm || "").toLowerCase().includes(x.rm.split("/")[0].toLowerCase().trim())))} />
              ); })}
            </List>
          </>}
        </>}
      </>}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!drill} onClose={closeDrill} title={sheetTitle}>
        {drill && cust && (
          <div>
            <button type="button" className="m-btn" style={{ marginBottom: 12 }} onClick={() => setCust(null)}>Back to list</button>
            <div className="m-grid2" style={{ marginBottom: 12 }}>
              <Kpi label="TCV" value={inrCr(cust.tcv)} sub={cust.proj} color={NAVY} />
              <Kpi label="Demanded" value={inrCr(cust.dem)} sub={`${pct(cust.dem, cust.tcv)} of TCV`} color={TEAL} />
              <Kpi label="Received" value={inrCr(cust.rec)} sub={`${pct(cust.rec, cust.dem)} of demanded`} color={GREEN} />
              <Kpi label="Net due" value={inrCr(cust.due)} color={cust.due > 1000 ? RED : GREEN} />
            </div>
            <Progress pct={pctN(cust.rec, cust.dem)} color={GREEN} lg />
            <List>
              <Row title="Project / phase" sub={`${cust.proj}${cust.phase ? ` · ${cust.phase}` : ""}`} />
              <Row title="Unit type" sub={cust.unitType || "—"} />
              <Row title="Allotment" sub={`${cust.allot || "—"} · ${fD(cust.allotDate)}`} />
              <Row title="Payment plan" sub={`${cust.plan || "—"}${cust.planType ? ` · ${cust.planType}` : ""}`} />
              <Row title="Funding" sub={`${cust.funding || "—"}${cust.bank ? ` · ${cust.bank}` : ""}${cust.sanctAmt > 0 ? ` · sanctioned ${inrCr(cust.sanctAmt)}` : ""}`} />
              <Row title="Last demand letter" sub={`${cust.letter || "—"}${cust.letterDate ? ` · ${fD(cust.letterDate)}` : ""}${cust.letterDue ? ` · due ${fD(cust.letterDue)}` : ""}`} />
              <Row title="RM" sub={`${cust.rm || "—"}${cust.rmStatus ? ` · ${cust.rmStatus}` : ""}`} />
              <Row title="BBA" sub={`${cust.bba || "—"}${cust.bbaDate ? ` · ${fD(cust.bbaDate)}` : ""}`} />
              {cust.remarks && <Row title="Remarks" sub={cust.remarks} />}
            </List>
            {(() => {
              const mine = receipts.filter(r => r.reg === cust.reg);
              return mine.length > 0 && <>
                <Section title="Receipts this month" />
                <List>{mine.map((r, i) => <Row key={i} title={fD(r.rcptDate)} sub={`${r.mode || "—"} · ${r.bank || "—"}`} value={inrCr(r.amt)} />)}</List>
              </>;
            })()}
          </div>
        )}

        {drill && !cust && drill.kind === "custs" && <>
          <div className="m-grid2" style={{ marginBottom: 12 }}>
            <Kpi label="Units" value={fN(drill.rows.length)} color={NAVY} />
            <Kpi label="Net due" value={inrCr(sumBy(drill.rows, l => Math.max(l.due, 0)))} color={RED} />
          </div>
          <SearchBar value={dq} onChange={setDq} placeholder="Search unit number" />
          <div style={{ marginTop: 8 }}>
            {dRows.length === 0 ? <Empty title="No units" sub="Try a different unit number." /> : <>
              <List>
                {dRows.slice(0, 80).map((l, i) => (
                  <Row key={l.reg + i} title={l.unit || "—"} sub={`${l.proj} · ${l.rmStatus || l.statusV || "—"}`} value={inrCr(l.due)}
                    valueSub={`${pct(l.rec, l.dem)} recd`} onClick={() => setCust(l)} />
                ))}
              </List>
              {dRows.length > 80 && <p className="m-sub" style={{ textAlign: "center", marginTop: 8 }}>Showing top 80 of {fN(dRows.length)} by net due. Search to narrow.</p>}
            </>}
          </div>
        </>}

        {drill && drill.kind === "rcpts" && <>
          <div className="m-grid2" style={{ marginBottom: 12 }}>
            <Kpi label="Receipts" value={fN(drill.rows.length)} color={NAVY} />
            <Kpi label="Amount" value={inrCr(sumBy(drill.rows, r => r.amt))} color={GREEN} />
          </div>
          {drill.rows.length === 0 ? <Empty title="No receipts" /> : <List>
            {drill.rows.slice(0, 80).map((r, i) => (
              <Row key={i} title={`${r.unit || "—"} · ${r.proj}`} sub={`${fD(r.rcptDate)} · ${r.mode || "—"}${r.bank ? ` · ${r.bank}` : ""}`} value={inrCr(r.amt)} />
            ))}
          </List>}
          {drill.rows.length > 80 && <p className="m-sub" style={{ textAlign: "center", marginTop: 8 }}>Showing first 80 of {fN(drill.rows.length)}.</p>}
        </>}
      </Sheet>
    </div>
  );
}
