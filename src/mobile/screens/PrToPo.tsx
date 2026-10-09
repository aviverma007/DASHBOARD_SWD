import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardHead, Empty, FilterBar, Funnel, FullViewLink, HBars, Hero, Kpi, Legend, List, Pill, Row, ScreenSkeleton, SearchBar, Section, SegBar, Seg, Sheet, type FilterValues } from "../ui";
import { fN } from "../fmt";
// journey model, stage list and idle-days logic are reused from the desktop page (exported there)
import { STAGES, buildJourneys, idleDays, plantOf, type Journey } from "../../features/pr2po/PrToPoPage";

/* Same live endpoint + parsing as the desktop PR → PO page. */
const API_BASE = "http://192.168.66.28:5002";
type Rec = Record<string, string | null>;
type Raw = { sap_pr: Rec[]; sap_po: Rec[]; vg: Rec[]; meta: Record<string, unknown> };

const STAGE_COLS = ["#1c3f6e", "#2a5c8f", "#0E7490", "#0f8a7a", "#B8893C", "#c99a3a", "#1BAF7A", "#0f8a5f"];
const GREEN = "#16a06f", RED = "#d64545", AMBER = "#e0a030", NAVY = "#1e3163";

const DAY = 86400000;
const days = (a: number, b: number) => Math.round((b - a) / DAY);
const todayUtc = () => { const n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const fD = (t: number | null) => (t === null ? "—" : new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }));
function pDate(v: string | null | undefined): number | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s || s === "NA" || s === "None" || s.startsWith("0000")) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) { const t = Date.UTC(+m[1], +m[2] - 1, +m[3]); return Number.isFinite(t) && +m[1] > 2000 ? t : null; }
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return null;
}
const fMoney = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
};
const tatOf = (j: Journey): number | null => {
  if (!j.done) return null;
  const a = j.m.sap_created ?? j.m.qms_created, b = j.m.po_released ?? j.m.po_created;
  return a !== null && b !== null && b >= a ? days(a, b) : null;
};
const idleOf = (j: Journey) => (!j.done && !j.exception && j.pendingSince !== null ? idleDays(j.pendingSince) : null);
const stageLbl = (j: Journey) => (j.exception && !j.done ? j.exception : j.done ? "Completed" : STAGES[Math.min(j.stageIdx, 7)].pend);
const toneOf = (j: Journey): "ok" | "bad" | "warn" | undefined => (j.exception && !j.done ? "bad" : j.done ? "ok" : (idleOf(j) ?? 0) > 30 ? "warn" : undefined);

const PRESETS = [
  { k: "may", l: "Since 1 May" },
  { k: "90", l: "90 days" },
  { k: "30", l: "30 days" },
] as const;
type Preset = (typeof PRESETS)[number]["k"];
const startOf = (p: Preset) => (p === "may" ? "2026-05-01" : iso(todayUtc() - (p === "90" ? 90 : 30) * DAY));

const AGE_BANDS = [["0–3 d", 0, 3], ["4–7 d", 4, 7], ["8–15 d", 8, 15], ["16–30 d", 16, 30], ["31–60 d", 31, 60], ["> 60 d", 61, 1e9]] as const;

export default function PrToPo() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [preset, setPreset] = useState<Preset>("may");
  const [raw, setRaw] = useState<Raw | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [flow, setFlow] = useState<"sap" | "qms">("sap");
  const [fv, setFv] = useState<FilterValues>({});
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(25);
  const [sel, setSel] = useState<Journey | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    const to = iso(todayUtc());
    fetch(`${API_BASE}/pr2po/data?startdate=${startOf(preset)}&enddate=${to}`)
      .then(r => r.json())
      .then(j => { if (!alive) return; if (!j.ok) throw new Error(j.error || "backend error"); setRaw(j); setLoading(false); })
      .catch(e => { if (!alive) return; setError(String(e.message || e)); setLoading(false); });
    return () => { alive = false; };
  }, [preset, tick]);

  const journeys = useMemo(() => (raw ? buildJourneys(raw) : []), [raw]);
  const qmsDirect = useMemo(() => journeys.filter(j => j.origin === "vg").length, [journeys]);
  const flowJs = useMemo(() => journeys.filter(j => (flow === "sap" ? j.origin === "sap" : j.origin === "vg")), [journeys, flow]);

  const fields = useMemo(() => {
    const plants = [...new Set(flowJs.map(plantOf).filter((x): x is string => !!x))].sort();
    const depts = [...new Set(flowJs.map(j => j.dept).filter(d => d !== "—"))].sort();
    const vendors = [...new Set(flowJs.map(j => j.vendor).filter(v => v !== "—"))].sort();
    return [
      { key: "status", label: "Status", allLabel: "All statuses", options: [{ k: "flight", l: "In-flight" }, { k: "done", l: "Completed" }, { k: "exc", l: "Exceptions" }] },
      { key: "stage", label: "Stage", allLabel: "All stages", options: STAGES.map((s, i) => ({ k: String(i), l: s.pend })) },
      { key: "dept", label: "Department", allLabel: "All departments", options: depts.map(d => ({ k: d, l: d })) },
      { key: "plant", label: "Plant / project", allLabel: "All plants", options: plants.map(p => ({ k: p, l: p })) },
      { key: "vendor", label: "Vendor", allLabel: "All vendors", options: vendors.map(v => ({ k: v, l: v })) },
    ];
  }, [flowJs]);

  // desktop filter semantics: status + stage + dept + plant + free-text
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return flowJs.filter(j => {
      if (fv.plant && (plantOf(j) ?? "—") !== fv.plant) return false;
      if (fv.dept && j.dept !== fv.dept) return false;
      if (fv.vendor && j.vendor !== fv.vendor) return false;
      if (s && !j.id.toLowerCase().includes(s) && !j.desc.toLowerCase().includes(s) && !j.vendor.toLowerCase().includes(s) &&
          !(j.po?.EBELN ?? "").toLowerCase().includes(s) && !j.dept.toLowerCase().includes(s) && !(plantOf(j) ?? "").toLowerCase().includes(s)) return false;
      if (fv.status === "flight" && (j.done || j.exception)) return false;
      if (fv.status === "done" && !j.done) return false;
      if (fv.status === "exc" && !j.exception) return false;
      if (fv.stage && (j.done || j.exception || j.stageIdx !== Number(fv.stage))) return false;
      return true;
    });
  }, [flowJs, fv, q]);

  // mutually exclusive buckets, as on desktop
  const completed = useMemo(() => rows.filter(j => j.done), [rows]);
  const exceptions = useMemo(() => rows.filter(j => j.exception && !j.done), [rows]);
  const inFlight = useMemo(() => rows.filter(j => !j.done && !j.exception), [rows]);
  const poInFlight = inFlight.filter(j => j.reached.po_created).length;
  const tats = useMemo(() => completed.map(tatOf).filter((x): x is number => x !== null), [completed]);
  const avgTat = tats.length ? tats.reduce((a, b) => a + b, 0) / tats.length : null;
  const poValue = rows.reduce((s, j) => s + (j.reached.po_created && (!j.exception || j.done) ? j.value : 0), 0);
  const inFlightValue = inFlight.reduce((s, j) => s + j.value, 0);

  const funnel = useMemo(() => STAGES.map(s => ({
    label: s.short, value: rows.filter(j => j.reached[s.k]).length,
  })), [rows]);

  const ageing = useMemo(() => AGE_BANDS.map(([l, lo, hi]) => ({
    l, n: inFlight.filter(j => { const a = idleOf(j); return a !== null && a >= lo && a <= hi; }).length,
  })), [inFlight]);
  const stuck = inFlight.filter(j => (idleOf(j) ?? 0) > 30).length;

  const pendingWith = useMemo(() => {
    const m = new Map<string, number>();
    inFlight.forEach(j => { const k = j.pendingWith || "—"; m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [inFlight]);

  const stale = useMemo(() => {
    if (!raw) return null;
    const mx = Math.max(0, ...raw.sap_pr.map(r => pDate(r.Badat) ?? pDate(r.Erdat) ?? 0));
    return mx > 0 && days(mx, todayUtc()) > 14 ? mx : null;
  }, [raw]);

  const list = useMemo(() => [...rows].sort((a, b) => (idleOf(b) ?? -1) - (idleOf(a) ?? -1) || (b.pendingSince ?? 0) - (a.pendingSince ?? 0)), [rows]);

  const head = (
    <div>
      <h1 className="m-h1">PR → PO Journey</h1>
      <p className="m-sub">SAP PR → QMS → NFA → SAP PO · live{raw ? ` · ${fN(journeys.length)} journeys` : ""}</p>
    </div>
  );

  if (loading) return <div className="m-stack">{head}<ScreenSkeleton /></div>;
  if (error || !raw) {
    return (
      <div className="m-stack">
        {head}
        <Empty title="PR → PO data unreachable" sub={`Could not load live data${error ? ` (${error})` : ""}. The VendorGlobe API at 192.168.66.28 is only reachable on the office network.`} />
        <button type="button" className="m-btn pri" onClick={() => setTick(t => t + 1)}>Retry</button>
        <FullViewLink onClick={() => nav(pathname + "?view=full")} />
      </div>
    );
  }

  return (
    <div className="m-stack">
      {head}
      <Seg value={flow} options={[{ k: "sap", l: "SAP → QMS → SAP" }, { k: "qms", l: `QMS-direct · ${fN(qmsDirect)}` }]} onChange={k => { setFlow(k); setFv({}); setLimit(25); }} />
      <Seg value={preset} options={PRESETS.map(p => ({ k: p.k, l: p.l }))} onChange={p => { setPreset(p); setLimit(25); }} />
      <FilterBar fields={fields} values={fv} onApply={v => { setFv(v); setLimit(25); }} quick={["status", "dept"]} />

      {stale !== null && <Card><p className="m-cs" style={{ color: "#96690a" }}>SAP PR feed has no new documents since {fD(stale)}; QMS and PO data are live.</p></Card>}

      <Hero label={flow === "sap" ? "Total PRs (SAP flow)" : "QMS-direct PRs"} value={fN(rows.length)}
        sub={`${fN(inFlight.length)} pending · ${fN(completed.length)} completed · ${fN(exceptions.length)} returned/cancelled`}>
        <div style={{ marginTop: 14 }}>
          <SegBar parts={[{ v: completed.length, c: GREEN }, { v: inFlight.length, c: AMBER }, { v: exceptions.length, c: RED }]} />
          <div style={{ marginTop: 8 }}>
            <Legend items={[{ l: "Completed", c: GREEN, v: fN(completed.length) }, { l: "In-flight", c: AMBER, v: fN(inFlight.length) }, { l: "Exceptions", c: RED, v: fN(exceptions.length) }]} />
          </div>
        </div>
      </Hero>

      <div className="m-grid2">
        <Kpi label="Completed (PO approved)" value={fN(completed.length)} sub={`${rows.length ? ((completed.length / rows.length) * 100).toFixed(1) : 0}% of window`} color={GREEN} accent />
        <Kpi label="In-flight" value={fN(inFlight.length)} sub={poInFlight ? `incl. ${fN(poInFlight)} at PO stage` : fMoney(inFlightValue)} color="#1a7f9c" />
        <Kpi label="Avg PR → PO TAT" value={avgTat !== null ? `${avgTat.toFixed(0)} d` : "—"} sub={`${fN(tats.length)} completed`} color="#c99a3a" />
        <Kpi label="PO value" value={fMoney(poValue)} sub="POs created" color={NAVY} />
        <Kpi label="Waiting > 30 d" value={fN(stuck)} sub="in-flight, no movement" color={RED} />
        <Kpi label="Returned / cancelled" value={fN(exceptions.length)} sub="exception journeys" color="#7e1f14" />
      </div>

      <Card>
        <CardHead title="Journey funnel" sub="PRs that finished each step" />
        <div style={{ marginTop: 12 }}>
          <Funnel stages={funnel} colors={STAGE_COLS} />
        </div>
      </Card>

      <Card>
        <CardHead title="In-flight ageing" sub="Days since last milestone" />
        <div style={{ marginTop: 10 }}>
          <HBars format={fN} color={NAVY} rows={ageing.map((a, i) => ({ label: a.l, value: a.n, color: i >= 4 ? RED : i >= 3 ? AMBER : undefined }))} />
        </div>
      </Card>

      {pendingWith.length > 0 && (
        <Card>
          <CardHead title="Pending with" sub="In-flight PRs by who holds them" />
          <div style={{ marginTop: 10 }}>
            <HBars format={fN} color="#B8893C" rows={pendingWith.map(([l, n]) => ({ label: l, value: n }))} />
          </div>
        </Card>
      )}

      <Section title="PR list" />
      <SearchBar value={q} onChange={v => { setQ(v); setLimit(25); }} placeholder="PR / PO / vendor / plant / dept" />
      {list.length === 0 ? <Empty title="No PRs" sub="Nothing matches these filters." /> : (
        <>
          <List>
            {list.slice(0, limit).map(j => {
              const idle = idleOf(j);
              return (
                <Row key={j.origin + j.id} title={`PR ${j.id}`}
                  sub={`${j.desc !== "—" ? j.desc.slice(0, 48) : (plantOf(j) ?? "—")} · ${j.vendor !== "—" ? j.vendor.slice(0, 24) : "no vendor"}${idle !== null ? ` · idle ${idle} d` : ""}`}
                  right={<Pill tone={toneOf(j)}>{j.exception && !j.done ? j.exception : j.done ? "Completed" : STAGES[Math.min(j.stageIdx, 7)].short}</Pill>}
                  onClick={() => setSel(j)} />
              );
            })}
          </List>
          {list.length > limit && <button type="button" className="m-btn" onClick={() => setLimit(l => l + 25)}>Show more ({fN(list.length - limit)} left)</button>}
        </>
      )}

      <FullViewLink onClick={() => nav(pathname + "?view=full")} />

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `PR ${sel.id}` : ""}>
        {sel && <Detail j={sel} />}
      </Sheet>
    </div>
  );
}

function Detail({ j }: { j: Journey }) {
  const applicable = STAGES.filter(s => !j.skipStages.includes(s.k));
  let prev: number | null = null;
  const vg = j.vg;
  const qmsRows: [string, string | null | undefined][] = vg ? [
    ["QMS PR status", vg.PRH_Status_Desc], ["PR pending with", vg.PR_Pending_With],
    ["Validator 1", vg.Validator_One && `${vg.Validator_One} · ${fD(pDate(vg.Validator_One_Date))}`],
    ["Validator 2", vg.Validator_Two && `${vg.Validator_Two} · ${fD(pDate(vg.Validator_Two_Date))}`],
    ["CP team", vg.CP_Team && `${vg.CP_Team} · ${fD(pDate(vg.CP_Team_Date))}`],
    ["NFA no.", vg.NFA_No], ["NFA status", vg.NFA_Status_Desc], ["NFA pending with", vg.NFA_Pending_With],
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n): [string, string | null] | null => {
      const w = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"][n - 1];
      const team = vg[`Level_${w}_Team`], dt = pDate(vg[`Level_${w}_Date`]);
      return team || dt ? [`NFA level ${n}`, `${team ?? "—"} · ${fD(dt)}`] : null;
    }).filter((x): x is [string, string | null] => !!x),
  ] : [];
  const po = j.po;
  const poRows: [string, string | null | undefined][] = po ? [
    ["PO number", po.EBELN], ["PO date", fD(pDate(po.BADAT))], ["Vendor", po.NAME1],
    ["Release levels granted", po.FRGZU || "none"],
    ["Release indicator", po.FRGKE ? (po.FRGKE === "G" ? "G — released" : `${po.FRGKE} — blocked/in release`) : null],
    ["Value", fMoney(parseFloat(String(po.NETWR)) || 0)], ["Invoiced", fMoney(parseFloat(String(po.NETWR_INV)) || 0)],
  ] : [];
  const idle = idleOf(j);
  return (
    <div className="m-stack">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Pill tone={toneOf(j)}>{stageLbl(j)}</Pill>
        {j.origin === "vg" && <Pill>QMS-direct</Pill>}
        {idle !== null && <Pill tone={idle > 15 ? "bad" : undefined}>{idle} d waiting</Pill>}
      </div>
      <p style={{ fontSize: 14, margin: 0 }}>{j.desc}</p>

      <List>
        <Row title="Project / plant" value={plantOf(j) ?? "—"} />
        <Row title="Department" value={j.dept} />
        <Row title="Vendor" value={j.vendor} />
        <Row title="Value" value={j.value ? fMoney(j.value) : "—"} />
        {j.done && tatOf(j) !== null && <Row title="End-to-end TAT" value={`${tatOf(j)} d`} />}
      </List>

      {!j.done && !j.exception && j.pendingLevel && (
        <Card>
          <span className="m-label">Currently pending at</span>
          <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>{j.pendingLevel}</div>
          <p className="m-cs" style={{ marginTop: 4 }}>
            with {j.pendingWith || "—"}{j.pendingSince !== null ? ` · since ${fD(j.pendingSince)}` : ""}{idle !== null ? ` · ${idle} days waiting` : ""}
          </p>
        </Card>
      )}

      <Card>
        <CardHead title="Milestone timeline" sub={`gap = days from previous milestone${j.poApprox ? " · PO-approved date approximated by last change date" : ""}`} />
        <div style={{ marginTop: 12 }}>
          {applicable.map((s, i) => {
            const t = j.m[s.k], hit = j.reached[s.k];
            const gap = hit && t !== null && prev !== null ? days(prev, t) : null;
            if (t !== null) prev = t;
            const col = hit ? STAGE_COLS[STAGES.findIndex(x => x.k === s.k)] : "#c9c2b2";
            return (
              <div key={s.k} style={{ display: "flex", gap: 12, position: "relative", paddingBottom: i === applicable.length - 1 ? 0 : 16 }}>
                {i < applicable.length - 1 && <div style={{ position: "absolute", left: 7, top: 18, bottom: 0, width: 2, background: hit ? "#d8dce8" : "#eef0f6" }} />}
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: hit ? col : "#fff", border: `3px solid ${col}`, flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: hit ? 800 : 600, color: hit ? undefined : "var(--m-mut)" }}>{s.l}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", color: hit ? undefined : "var(--m-mut)" }}>{hit ? (t !== null ? fD(t) : "done · date n/a") : "pending"}</span>
                  </div>
                  {gap !== null && gap >= 0 && <div style={{ fontSize: 11.5, fontWeight: gap > 15 ? 800 : 600, color: gap > 15 ? RED : "var(--m-mut)" }}>+{gap} days</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {qmsRows.filter(([, v]) => v && v !== "NA").length > 0 && (
        <>
          <Section title="QMS / NFA detail" />
          <List>{qmsRows.filter(([, v]) => v && v !== "NA").map(([k, v]) => <Row key={k} title={k} value={String(v)} />)}</List>
        </>
      )}
      {poRows.filter(([, v]) => v).length > 0 && (
        <>
          <Section title="PO detail" />
          <List>{poRows.filter(([, v]) => v).map(([k, v]) => <Row key={k} title={k} value={String(v)} />)}</List>
        </>
      )}
    </div>
  );
}
