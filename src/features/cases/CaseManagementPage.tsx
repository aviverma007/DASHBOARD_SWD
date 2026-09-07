import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { showTip, hideTip } from "../../components/common/hoverTip";
import { Zoomable } from "../../components/common/Zoomable";
import {
  CM, CASES, type CaseRec, isClosed, tatBucket,
  fmtDay, ymOf, ymLbl, fN, fyOf, fyLbl, EPOCH_MS, AGE_BANDS, ageBand,
} from "../../components/cases/caseShared";
import { CaseDrillDrawer, type CaseDrillSeed, type CaseChip } from "../../components/cases/CaseDrillDrawer";

/* House tokens — identical family to Bookings. Structure mirrors the
 * reference CRM app: page tabs, applicability toggle, stat tickets,
 * sidebar filters, Case Type / Status / Origin panels, owner chart
 * with By Case Owner / By Team Leader toggle, TAT + ageing on the
 * open view, and the records table. */
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)" };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 16.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11.5, color: "#b8893c", marginBottom: 12 };
const NAVY = "#14213D", TEAL = "#0E7490", GOLD = "#B8893C", GREEN = "#1BAF7A", RED = "#c0392b", AMBER = "#EDA100";
const PAL = [RED, GOLD, "#546e7a", TEAL, GREEN, "#6a1b9a", "#1565c0", "#e65100"];

type Tab = "overall" | "open" | "closed" | "resolved";
const TABS: { k: Tab; l: string }[] = [
  { k: "overall", l: "Overall Tickets" },
  { k: "open", l: "Open Tickets" },
  { k: "closed", l: "Closed Tickets" },
  { k: "resolved", l: "Resolved Tickets" },
];


/** Reference SFilter — searchable dropdown, restyled to the house look. */
function SFilter({ label, value, onChange, options }: { label: string; value: number; onChange: (v: number) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ(""); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const list = [{ i: -1, n: "All" }, ...options.map((n, i) => ({ i, n }))];
  const shown = q ? list.filter(o => o.n.toLowerCase().includes(q.toLowerCase())) : list;
  return (
    <div ref={ref} style={{ position: "relative", minWidth: 150 }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,.75)", marginBottom: 4 }}>{label}</div>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, fontSize: 12.5, fontWeight: 600, color: value < 0 ? "var(--mut)" : "var(--ink)", background: "#fff", border: `1px solid ${open ? TEAL : "#d8d2c4"}`, borderRadius: 8, padding: "7px 9px", cursor: "pointer" }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value < 0 ? "All" : options[value]}</span>
        <span style={{ fontSize: 9, color: "var(--mut)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▼</span>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 5, zIndex: 40, background: "#fff", border: "1px solid #d8d2c4", borderRadius: 8, boxShadow: "0 8px 22px rgba(20,33,61,.18)", overflow: "hidden" }}>
          <div style={{ padding: 6, borderBottom: "1px solid #f0ede5" }}>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} onClick={e => e.stopPropagation()} placeholder="Search…"
              style={{ width: "100%", boxSizing: "border-box", fontSize: 12, fontWeight: 600, color: "var(--ink)", background: "#faf8f2", border: "1px solid #eae6da", borderRadius: 6, padding: "5px 8px", outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {shown.length ? shown.map(o => (
              <div key={o.i} onClick={() => { onChange(o.i); setOpen(false); setQ(""); }}
                style={{ padding: "6px 10px", fontSize: 12, fontWeight: o.i === value ? 800 : 600, cursor: "pointer", color: o.i === value ? TEAL : "var(--ink)", background: o.i === value ? "rgba(14,116,144,.08)" : "transparent" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(14,116,144,.06)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = o.i === value ? "rgba(14,116,144,.08)" : "transparent"; }}>
                {o.n}
              </div>
            )) : <div style={{ padding: "8px 10px", fontSize: 11.5, color: "var(--mut)" }}>No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CaseManagementPage() {
  const [tab, setTab] = useState<Tab>("overall");
  // sidebar filters — same set as the reference (Category = Area)
  const [searchNo, setSearchNo] = useState("");
  const [fArea, setFArea] = useState(-1);
  const [fSubA, setFSubA] = useState(-1);
  const [fTyp, setFTyp] = useState(-1);
  const [fPri, setFPri] = useState(-1);
  const [fSta, setFSta] = useState(-1);
  const [fOrg, setFOrg] = useState(-1);
  const [fOwn, setFOwn] = useState(-1);
  const [applic, setApplic] = useState(-1); // Inclusion/Exclusion toggle
  const [tatChip, setTatChip] = useState<"" | "within" | "beyond">("");
  const [ageF, setAgeF] = useState(-1);
  const [ownerMode, setOwnerMode] = useState<"owner" | "tl">("owner");
  const [perMode, setPerMode] = useState<"all" | "y" | "q" | "m" | "c">("all");
  const [perSel, setPerSel] = useState("");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const [drill, setDrill] = useState<CaseDrillSeed | null>(null);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<CaseRec | null>(null);

  const resolvedIdx = CM.STA.indexOf("Resolved");

  const qKeyOf = (d: number) => { const dt = new Date(EPOCH_MS + d * 86400000); const m = dt.getMonth() + 1; const fy = m >= 4 ? dt.getFullYear() + 1 : dt.getFullYear(); const q = m >= 4 ? Math.ceil((m - 3) / 3) : 4; return `${fy}-Q${q}`; };
  const perOptions = useMemo(() => {
    const dated = CASES.filter(c => c.open >= 0);
    if (perMode === "y") return [...new Set(dated.map(c => String(fyOf(c.open))))].sort().reverse();
    if (perMode === "q") return [...new Set(dated.map(c => qKeyOf(c.open)))].sort().reverse();
    if (perMode === "m") return [...new Set(dated.map(c => ymOf(c.open)))].sort().reverse();
    return [];
  }, [perMode]);
  useEffect(() => { if (["y", "q", "m"].includes(perMode) && perOptions.length && !perOptions.includes(perSel)) setPerSel(perOptions[0]); }, [perMode, perOptions, perSel]);
  const dayOfIso = (iso: string) => Math.floor((new Date(iso + "T00:00:00").getTime() - EPOCH_MS) / 86400000);
  const inPeriod = (c: CaseRec) => {
    if (perMode === "all") return true;
    if (c.open < 0) return false;
    if (perMode === "y") return String(fyOf(c.open)) === perSel;
    if (perMode === "q") return qKeyOf(c.open) === perSel;
    if (perMode === "m") return ymOf(c.open) === perSel;
    const lo = cFrom ? dayOfIso(cFrom) : -Infinity;
    const hi = cTo ? dayOfIso(cTo) : Infinity;
    return c.open >= lo && c.open <= hi;
  };

  const filtered = useMemo(() => CASES.filter(c =>
    (fArea < 0 || c.area === fArea) && (fSubA < 0 || c.subArea === fSubA) &&
    (fTyp < 0 || c.typ === fTyp) && (fPri < 0 || c.pri === fPri) &&
    (fSta < 0 || c.sta === fSta) && (fOrg < 0 || c.org === fOrg) &&
    (fOwn < 0 || c.own === fOwn) && (applic < 0 || c.app === applic) &&
    (!searchNo.trim() || c.caseNo.includes(searchNo.trim()) || c.account.toLowerCase().includes(searchNo.trim().toLowerCase())) &&
    inPeriod(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [fArea, fSubA, fTyp, fPri, fSta, fOrg, fOwn, applic, searchNo, perMode, perSel, cFrom, cTo]);

  // page scope per top tab (reference semantics)
  const pageRows = useMemo(() => {
    let r = filtered;
    if (tab === "open") r = r.filter(c => !isClosed(c));
    if (tab === "closed") r = r.filter(c => isClosed(c));
    if (tab === "resolved") r = r.filter(c => c.sta === resolvedIdx);
    if (tab === "open" && tatChip === "beyond") r = r.filter(c => tatBucket(c) === "overdue");
    if (tab === "open" && tatChip === "within") r = r.filter(c => tatBucket(c) !== "overdue");
    if (tab === "open" && ageF >= 0) r = r.filter(c => ageBand(c.age) === ageF);
    return r;
  }, [filtered, tab, tatChip, ageF, resolvedIdx]);

  const totalT = filtered.length;
  const closedT = filtered.filter(isClosed).length;
  const openT = totalT - closedT;

  useEffect(() => { setPage(1); }, [pageRows]);

  const resetAll = () => {
    setFArea(-1); setFSubA(-1); setFTyp(-1); setFPri(-1); setFSta(-1); setFOrg(-1); setFOwn(-1);
    setApplic(-1); setTatChip(""); setAgeF(-1); setSearchNo("");
    setPerMode("all"); setPerSel(""); setCFrom(""); setCTo("");
  };

  const statusName = (c: CaseRec) => (c.sta >= 0 ? CM.STA[c.sta] : "—");

  // ── panel data (all scoped to pageRows, like the reference) ──
  const typeDonut = useMemo(() => {
    const m = new Map<string, number>();
    pageRows.forEach(c => { const k = c.typ >= 0 ? CM.TYP[c.typ] : "Unknown"; m.set(k, (m.get(k) ?? 0) + 1); });
    const order = ["Complaint", "Query", "SPAM"];
    return [...m.entries()].sort((a, b) => {
      const ia = order.indexOf(a[0]), ib = order.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    }).map(([label, v]) => ({ label, v }));
  }, [pageRows]);

  const statusList = useMemo(() => {
    const m = new Map<string, number>();
    pageRows.forEach(c => { const k = isClosed(c) ? "Closed" : statusName(c); m.set(k, (m.get(k) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [pageRows]);

  const originList = useMemo(() => {
    const m = new Map<number, number>();
    pageRows.forEach(c => { if (c.org >= 0) m.set(c.org, (m.get(c.org) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [pageRows]);

  const byOwner = useMemo(() => {
    const names = ownerMode === "owner" ? CM.OWN : CM.TL;
    const get = (c: CaseRec) => (ownerMode === "owner" ? c.own : c.tl);
    const m = new Map<number, { t: number; o: number }>();
    pageRows.forEach(c => { const k = get(c); if (k < 0) return; if (!m.has(k)) m.set(k, { t: 0, o: 0 }); const e = m.get(k)!; e.t++; if (!isClosed(c)) e.o++; });
    return { names, items: [...m.entries()].sort((a, b) => b[1].t - a[1].t).slice(0, 20) };
  }, [pageRows, ownerMode]);

  const tatByOwner = useMemo(() => {
    const m = new Map<number, { ov: number; ar: number; wi: number }>();
    pageRows.forEach(c => {
      if (c.own < 0 || isClosed(c)) return;
      if (!m.has(c.own)) m.set(c.own, { ov: 0, ar: 0, wi: 0 });
      const e = m.get(c.own)!;
      const b = tatBucket(c);
      if (b === "overdue") e.ov++; else if (b === "atrisk") e.ar++; else e.wi++;
    });
    return [...m.entries()].sort((a, b) => (b[1].ov + b[1].ar + b[1].wi) - (a[1].ov + a[1].ar + a[1].wi)).slice(0, 15);
  }, [pageRows]);

  const ageing = useMemo(() => {
    const m = new Map<number, number>();
    filtered.filter(c => !isClosed(c)).forEach(c => { const b = ageBand(c.age); m.set(b, (m.get(b) ?? 0) + 1); });
    return m;
  }, [filtered]);

  const trend = useMemo(() => {
    const m = new Map<string, { o: number; c: number }>();
    pageRows.forEach(c => {
      if (c.open >= 0) { const k = ymOf(c.open); if (!m.has(k)) m.set(k, { o: 0, c: 0 }); m.get(k)!.o++; }
      if (c.closed >= 0) { const k = ymOf(c.closed); if (!m.has(k)) m.set(k, { o: 0, c: 0 }); m.get(k)!.c++; }
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [pageRows]);

  const PER = 25;
  const pages = Math.max(Math.ceil(pageRows.length / PER), 1);
  const shown = pageRows.slice((page - 1) * PER, page * PER);

  const pageLabel = TABS.find(t => t.k === tab)!.l;

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      <div className="tv-zoom-desktop">
      {/* ── Header: title + the 4 reference page tabs ── */}
      <div style={{ background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)", padding: "14px 22px", borderBottom: "3px solid var(--gold)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#fff", fontWeight: 700 }}>Case Management</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 2 }}>{fN(CASES.length)} customer cases · data as on {CM.meta.asOn}</div>
          </div>
          <div style={{ display: "inline-flex", background: "rgba(255,255,255,.12)", borderRadius: 999, padding: 3, gap: 2 }}>
            {TABS.map(t => (
              <button key={t.k} onClick={() => { setTab(t.k); setTatChip(""); setAgeF(-1); }}
                style={{ border: "none", background: tab === t.k ? GOLD : "transparent", color: "#fff", fontWeight: 700, fontSize: 12, padding: "7px 16px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit" }}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
        {/* Filter bar — same placement pattern as every other page */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12, marginTop: 12 }}>
          <div style={{ minWidth: 180 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,.75)", marginBottom: 4 }}>Search</div>
            <input value={searchNo} onChange={e => setSearchNo(e.target.value)} placeholder="Case number / account…"
              style={{ width: "100%", boxSizing: "border-box", fontSize: 12.5, fontWeight: 600, color: "var(--ink)", background: "#fff", padding: "8px 10px", border: "1px solid #d8d2c4", borderRadius: 8, fontFamily: "inherit", outline: "none" }} />
          </div>
          <SFilter label="Category" value={fArea} onChange={setFArea} options={CM.AREA} />
          <SFilter label="Sub Category" value={fSubA} onChange={setFSubA} options={CM.SUBA} />
          <SFilter label="Case Type" value={fTyp} onChange={setFTyp} options={CM.TYP} />
          <SFilter label="Priority" value={fPri} onChange={setFPri} options={CM.PRI} />
          <SFilter label="Case Status" value={fSta} onChange={setFSta} options={CM.STA} />
          <SFilter label="Case Origin" value={fOrg} onChange={setFOrg} options={CM.ORG} />
          <SFilter label="Case Owner" value={fOwn} onChange={setFOwn} options={CM.OWN} />
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,.75)", marginBottom: 4 }}>Period (opened)</div>
            <div style={{ display: "inline-flex", background: "rgba(255,255,255,.12)", borderRadius: 999, padding: 3, gap: 2 }}>
              {([["all", "All time"], ["y", "Year"], ["q", "Quarter"], ["m", "Month"], ["c", "Custom"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setPerMode(k)}
                  style={{ border: "none", background: perMode === k ? GOLD : "transparent", color: "#fff", fontWeight: 700, fontSize: 11.5, padding: "6px 13px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {["y", "q", "m"].includes(perMode) && (
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,.75)", marginBottom: 4 }}>
                {perMode === "y" ? "Financial year" : perMode === "q" ? "Quarter" : "Month"}
              </div>
              <select value={perSel} onChange={e => setPerSel(e.target.value)}
                style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", background: "#fff", border: "1px solid #d8d2c4", borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontFamily: "inherit" }}>
                {perOptions.map(k => (
                  <option key={k} value={k}>
                    {perMode === "y" ? fyLbl(Number(k)) : perMode === "q" ? `Q${k.split("-Q")[1]} · ${fyLbl(Number(k.split("-Q")[0]))}` : ymLbl(k)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {perMode === "c" && (
            <>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,.75)", marginBottom: 4 }}>From date</div>
                <input type="date" min="2025-04-01" value={cFrom} onChange={e => setCFrom(e.target.value)}
                  style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", background: "#fff", border: "1px solid #d8d2c4", borderRadius: 8, padding: "6px 10px", fontFamily: "inherit" }} />
              </div>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,.75)", marginBottom: 4 }}>To date</div>
                <input type="date" min={cFrom || "2025-04-01"} value={cTo} onChange={e => setCTo(e.target.value)}
                  style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", background: "#fff", border: "1px solid #d8d2c4", borderRadius: 8, padding: "6px 10px", fontFamily: "inherit" }} />
              </div>
            </>
          )}
          <button onClick={resetAll}
            style={{ border: "1px solid rgba(255,255,255,.4)", background: "rgba(255,255,255,.12)", color: "#fff", fontWeight: 700, fontSize: 12, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>
            ⟲ Reset
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "16px 20px 40px" }}>
        <div>
          {/* Applicability toggle — reference behaviour */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ background: NAVY, color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", borderRadius: 8, padding: "6px 12px", textTransform: "uppercase" }}>Case applicability</span>
            {CM.APP.map((a, i) => {
              const col = a === "Exclusion" ? RED : GREEN;
              const on = applic === i;
              return (
                <button key={a} onClick={() => setApplic(on ? -1 : i)}
                  style={{ background: on ? col : "#fff", color: on ? "#fff" : col, border: `1.5px solid ${col}`, borderRadius: 8, padding: "6px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                  {a}
                </button>
              );
            })}
            {applic >= 0 && <span style={{ fontSize: 11.5, color: "var(--mut)" }}>showing {CM.APP[applic]} only · click again to clear</span>}
          </div>

          {/* Stat tickets — Total / Open / Closed */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
            {[
              { v: totalT, l: "Total tickets", c: TEAL },
              { v: openT, l: "Open tickets", c: AMBER },
              { v: closedT, l: "Closed tickets", c: GREEN },
            ].map(s => (
              <div key={s.l}
                onMouseEnter={e => showTip(e, `<b>${s.l}</b><br/>${fN(s.v)} (${totalT ? ((s.v / totalT) * 100).toFixed(1) : 0}% of total)`)}
                onMouseMove={e => showTip(e, `<b>${s.l}</b><br/>${fN(s.v)}`)} onMouseLeave={hideTip}
                style={{ ...CARD, padding: "14px 18px", borderLeft: `5px solid ${s.c}` }}>
                <div style={{ fontFamily: "Georgia,serif", fontSize: 26, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>{fN(s.v)}</div>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)", marginTop: 5 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Open-page TAT chips (reference: '' | within | beyond) */}
          {tab === "open" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {([["", "All open"], ["within", "Within time"], ["beyond", "Beyond TAT"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTatChip(k)}
                  style={{ border: `1.5px solid ${k === "beyond" ? RED : TEAL}`, background: tatChip === k ? (k === "beyond" ? RED : TEAL) : "#fff", color: tatChip === k ? "#fff" : (k === "beyond" ? RED : TEAL), borderRadius: 999, padding: "5px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {l}
                </button>
              ))}
              {ageF >= 0 && (
                <button onClick={() => setAgeF(-1)} style={{ border: "1.5px solid #d8d2c4", background: "#faf8f2", color: "var(--ink)", borderRadius: 999, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Ageing: {AGE_BANDS[ageF].label} ✕
                </button>
              )}
            </div>
          )}

          {/* Panel row: Case Type / Status / Case Origin */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 14 }}>
            <Zoomable title="Case type">
              <div style={{ ...CARD, height: "100%" }}>
                <h3 style={H3}>Case Type</h3>
                <div style={CAP}>{pageLabel.toLowerCase()} · click a slice → filter</div>
                {(() => {
                  const tot = Math.max(typeDonut.reduce((s, i) => s + i.v, 0), 1);
                  const R = 50, C = 2 * Math.PI * R;
                  let off = 0;
                  return (
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                      <svg width={130} height={130} viewBox="0 0 130 130">
                        {typeDonut.map((it, i) => {
                          const frac = it.v / tot, dash = frac * C, o = off; off += dash;
                          const idx = CM.TYP.indexOf(it.label);
                          return (
                            <circle key={it.label} cx={65} cy={65} r={R} fill="none" stroke={PAL[i % PAL.length]}
                              strokeWidth={fTyp >= 0 && fTyp === idx ? 26 : 20}
                              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-o} transform="rotate(-90 65 65)"
                              style={{ cursor: "pointer", opacity: fTyp >= 0 && fTyp !== idx ? 0.35 : 1 }}
                              onClick={() => setDrill({ chips: [{ dim: "typ", val: idx, label: it.label }] })}
                              onMouseEnter={e => showTip(e, `<b>${it.label}</b><br/>${fN(it.v)} (${((it.v / tot) * 100).toFixed(1)}%)`)}
                              onMouseMove={e => showTip(e, `<b>${it.label}</b><br/>${fN(it.v)} (${((it.v / tot) * 100).toFixed(1)}%)`)}
                              onMouseLeave={hideTip} />
                          );
                        })}
                        <text x={65} y={62} textAnchor="middle" style={{ fontFamily: "Georgia,serif", fontSize: 17, fontWeight: 700, fill: "var(--ink)" }}>{fN(tot)}</text>
                        <text x={65} y={77} textAnchor="middle" style={{ fontSize: 8.5, fill: "var(--mut)", letterSpacing: 1 }}>CASES</text>
                      </svg>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        {typeDonut.map((it, i) => (
                          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3.5px 0" }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: PAL[i % PAL.length] }} />
                            <span style={{ fontSize: 12.5, color: "var(--ink)", flex: 1 }}>{it.label}</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{fN(it.v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Zoomable>

            <Zoomable title="Status">
              <div style={{ ...CARD, height: "100%" }}>
                <h3 style={H3}>Status</h3>
                <div style={CAP}>Closed groups Closed/Resolved/Close · click → filter</div>
                {(() => {
                  const mx = Math.max(...statusList.map(([, v]) => v), 1);
                  return statusList.map(([label, v]) => {
                    const idx = CM.STA.indexOf(label);
                    return (
                      <div key={label} className="barrow"
                        onClick={() => setDrill({ chips: [label === "Closed" ? { dim: "stg", val: "closed", label: "Closed" } : { dim: "sta", val: idx, label }] })}
                        onMouseEnter={e => showTip(e, `<b>${label}</b><br/>${fN(v)} cases`)}
                        onMouseMove={e => showTip(e, `<b>${label}</b><br/>${fN(v)} cases`)} onMouseLeave={hideTip}
                        style={{ padding: "4.5px 0", cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{label}</span>
                          <span style={{ color: "var(--mut)", fontWeight: 700 }}>{fN(v)}</span>
                        </div>
                        <div style={{ height: 9, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(v / mx) * 100}%`, background: label === "Closed" ? GREEN : label === "Re-Open" ? RED : AMBER, borderRadius: 5 }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </Zoomable>

            <Zoomable title="Case origin">
              <div style={{ ...CARD, height: "100%" }}>
                <h3 style={H3}>Case Origin</h3>
                <div style={CAP}>share of {pageLabel.toLowerCase()} · click → filter</div>
                {(() => {
                  const tot = Math.max(pageRows.length, 1);
                  const mx = Math.max(...originList.map(([, v]) => v), 1);
                  return originList.map(([k, v]) => (
                    <div key={k} className="barrow" onClick={() => setDrill({ chips: [{ dim: "org", val: k, label: CM.ORG[k] }] })}
                      onMouseEnter={e => showTip(e, `<b>${CM.ORG[k]}</b><br/>${fN(v)} cases (${((v / tot) * 100).toFixed(2)}%)`)}
                      onMouseMove={e => showTip(e, `<b>${CM.ORG[k]}</b><br/>${fN(v)} (${((v / tot) * 100).toFixed(2)}%)`)} onMouseLeave={hideTip}
                      style={{ padding: "3.5px 0", cursor: "pointer", opacity: fOrg >= 0 && fOrg !== k ? 0.45 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{CM.ORG[k]}</span>
                        <span style={{ color: "var(--mut)", fontWeight: 700 }}>{((v / tot) * 100).toFixed(2)}%</span>
                      </div>
                      <div style={{ height: 8, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(v / mx) * 100}%`, background: TEAL, borderRadius: 5 }} />
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </Zoomable>
          </div>

          {/* Number of Cases by Case Owner — with By Case Owner / By Team Leader toggle */}
          <Zoomable title="Cases by owner">
            <div style={{ ...CARD, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h3 style={H3}>Number of Cases by Case Owner</h3>
                  <div style={{ ...CAP, marginBottom: 8 }}>green = total · gold = open portion · label shows total (open) · click → filter owner</div>
                </div>
                <div style={{ display: "inline-flex", background: "#f0ede5", borderRadius: 999, padding: 3, gap: 2 }}>
                  {([["owner", "By Case Owner"], ["tl", "By Team Leader"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setOwnerMode(k)}
                      style={{ border: "none", background: ownerMode === k ? NAVY : "transparent", color: ownerMode === k ? "#fff" : "var(--mut)", fontWeight: 700, fontSize: 11.5, padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit" }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {(() => {
                const mx = Math.max(...byOwner.items.map(([, e]) => e.t), 1);
                return byOwner.items.map(([k, e]) => (
                  <div key={k} className="barrow"
                    onClick={() => setDrill({ chips: [ownerMode === "owner" ? { dim: "own", val: k, label: byOwner.names[k] } : { dim: "tl", val: k, label: byOwner.names[k] }] })}
                    onMouseEnter={ev => showTip(ev, `<b>${byOwner.names[k]}</b><br/>Total — ${fN(e.t)}<br/>Open — ${fN(e.o)} · Closed — ${fN(e.t - e.o)}`)}
                    onMouseMove={ev => showTip(ev, `<b>${byOwner.names[k]}</b><br/>Total — ${fN(e.t)} · Open — ${fN(e.o)}`)}
                    onMouseLeave={hideTip}
                    style={{ padding: "3.5px 0", cursor: "pointer", opacity: fOwn >= 0 && ownerMode === "owner" && fOwn !== k ? 0.45 : 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 170, fontSize: 12, color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", flexShrink: 0 }}>{byOwner.names[k]}</span>
                      <div style={{ flex: 1, height: 14, background: "#f0ede5", borderRadius: 6, overflow: "hidden", position: "relative" }}>
                        <div style={{ position: "absolute", inset: 0, width: `${(e.t / mx) * 100}%`, background: GREEN, borderRadius: 6 }} />
                        <div style={{ position: "absolute", inset: 0, width: `${(e.o / mx) * 100}%`, background: GOLD, borderRadius: 6 }} />
                      </div>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {fN(e.t)} <span style={{ color: AMBER }}>({fN(e.o)} open)</span>
                      </span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </Zoomable>

          {/* Open view extras: TAT split by owner + Ageing (reference open page) */}
          {tab === "open" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 14, marginBottom: 14 }}>
              <Zoomable title="TAT by owner">
                <div style={{ ...CARD, height: "100%" }}>
                  <h3 style={H3}>Cases by Status (Overdue / At Risk / Within Time) — Case Owner</h3>
                  <div style={CAP}>open cases · red = overdue · gold = at risk · green = within</div>
                  {(() => {
                    const mx = Math.max(...tatByOwner.map(([, e]) => e.ov + e.ar + e.wi), 1);
                    return tatByOwner.map(([k, e]) => {
                      const t = e.ov + e.ar + e.wi;
                      return (
                        <div key={k} className="barrow"
                          onMouseEnter={ev => showTip(ev, `<b>${CM.OWN[k]}</b><br/>Overdue — ${fN(e.ov)}<br/>At risk — ${fN(e.ar)}<br/>Within — ${fN(e.wi)}`)}
                          onMouseMove={ev => showTip(ev, `<b>${CM.OWN[k]}</b><br/>${fN(t)} open`)} onMouseLeave={hideTip}
                          style={{ padding: "3.5px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ width: 150, fontSize: 12, color: "var(--ink)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", flexShrink: 0 }}>{CM.OWN[k]}</span>
                            <div style={{ flex: 1, height: 13, display: "flex", borderRadius: 6, overflow: "hidden", background: "#f0ede5" }}>
                              <div style={{ width: `${(e.ov / mx) * 100}%`, background: RED }} />
                              <div style={{ width: `${(e.ar / mx) * 100}%`, background: GOLD }} />
                              <div style={{ width: `${(e.wi / mx) * 100}%`, background: GREEN }} />
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}>{fN(t)}</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </Zoomable>
              <Zoomable title="Cases by ageing">
                <div style={{ ...CARD, height: "100%" }}>
                  <h3 style={H3}>Cases By Ageing</h3>
                  <div style={CAP}>open cases · days since opened · click a band → filter</div>
                  {AGE_BANDS.map(b => {
                    const v = ageing.get(b.k) ?? 0;
                    const mx = Math.max(...AGE_BANDS.map(x => ageing.get(x.k) ?? 0), 1);
                    return (
                      <div key={b.k} className="barrow" onClick={() => setDrill({ chips: [{ dim: "age", val: b.k, label: AGE_BANDS[b.k].label }] })}
                        onMouseEnter={e => showTip(e, `<b>${b.label}</b><br/>${fN(v)} open cases`)}
                        onMouseMove={e => showTip(e, `<b>${b.label}</b><br/>${fN(v)} open cases`)} onMouseLeave={hideTip}
                        style={{ padding: "5px 0", cursor: "pointer", opacity: ageF >= 0 && ageF !== b.k ? 0.45 : 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                          <span style={{ color: "var(--ink)", fontWeight: 600 }}>{b.label}</span>
                          <span style={{ color: "var(--mut)", fontWeight: 700 }}>{fN(v)}</span>
                        </div>
                        <div style={{ height: 10, background: "#f0ede5", borderRadius: 5, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(v / mx) * 100}%`, background: b.k >= 4 ? RED : b.k >= 2 ? AMBER : GREEN, borderRadius: 5 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Zoomable>
            </div>
          )}

          {/* Monthly trend */}
          <Zoomable title="Monthly opened vs closed">
            <div style={{ ...CARD, marginBottom: 14 }}>
              <h3 style={H3}>Monthly opened vs closed</h3>
              <div style={CAP}>teal = opened · green = closed in month · scoped to {pageLabel.toLowerCase()}</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 165, overflowX: "auto", overflowY: "hidden", paddingBottom: 6, width: "100%", boxSizing: "border-box" }}>
                {(() => {
                  const mx = Math.max(...trend.map(([, v]) => Math.max(v.o, v.c)), 1);
                  return trend.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 44 }}
                      onMouseEnter={e => showTip(e, `<b>${ymLbl(k)}</b><br/>Opened — ${fN(v.o)}<br/>Closed — ${fN(v.c)}`)}
                      onMouseMove={e => showTip(e, `<b>${ymLbl(k)}</b><br/>Opened — ${fN(v.o)} · Closed — ${fN(v.c)}`)} onMouseLeave={hideTip}>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 125 }}>
                        <div style={{ width: 15, height: `${(v.o / mx) * 100}%`, background: TEAL, borderRadius: "3px 3px 0 0", minHeight: 2 }} />
                        <div style={{ width: 15, height: `${(v.c / mx) * 100}%`, background: GREEN, borderRadius: "3px 3px 0 0", minHeight: 2 }} />
                      </div>
                      <span style={{ fontSize: 9.5, color: "var(--mut)", whiteSpace: "nowrap" }}>{ymLbl(k)}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </Zoomable>

          {/* Records */}
          <div style={{ ...CARD }}>
            <h3 style={H3}>{pageLabel} — records</h3>
            <div style={CAP}>{fN(pageRows.length)} in scope · click a row for full detail</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #eae6da" }}>
                    {["Case no.", "Account", "Opened", "Status", "Type", "Project", "Owner", "Age (d)"].map(h => (
                      <th key={h} style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "7px 10px 7px 0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((c, i) => (
                    <tr key={`${c.caseNo}-${i}`} onClick={() => setDetail(c)}
                      style={{ borderBottom: "1px solid #f0ede5", cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                      <td style={{ padding: "7px 10px 7px 0", fontWeight: 700, color: TEAL, whiteSpace: "nowrap" }}>{c.caseNo}</td>
                      <td style={{ padding: "7px 10px 7px 0", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.account || "—"}</td>
                      <td style={{ padding: "7px 10px 7px 0", whiteSpace: "nowrap" }}>{fmtDay(c.open)}</td>
                      <td style={{ padding: "7px 10px 7px 0" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px", background: isClosed(c) ? "#e2f3ec" : "#fdf1dc", color: isClosed(c) ? "#1a7a4a" : "#b06c00" }}>{statusName(c)}</span>
                      </td>
                      <td style={{ padding: "7px 10px 7px 0", whiteSpace: "nowrap" }}>{c.typ >= 0 ? CM.TYP[c.typ] : "—"}</td>
                      <td style={{ padding: "7px 10px 7px 0", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.prj >= 0 ? CM.PRJ[c.prj] : "—"}</td>
                      <td style={{ padding: "7px 10px 7px 0", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.own >= 0 ? CM.OWN[c.own] : "—"}</td>
                      <td style={{ padding: "7px 10px 7px 0" }}>{c.age >= 0 ? c.age : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, fontSize: 12.5 }}>
              <span style={{ color: "var(--mut)" }}>Page {page} of {fN(pages)}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #d8d2c4", background: "#fff", cursor: page <= 1 ? "default" : "pointer", fontFamily: "inherit", opacity: page <= 1 ? 0.5 : 1 }}>‹ Prev</button>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid #d8d2c4", background: "#fff", cursor: page >= pages ? "default" : "pointer", fontFamily: "inherit", opacity: page >= pages ? 0.5 : 1 }}>Next ›</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      <CaseDrillDrawer
        seed={drill}
        baseRows={pageRows}
        baseLabel={pageLabel}
        onClose={() => setDrill(null)}
        onAddChip={(chip: CaseChip) => setDrill(d => (d && !d.chips.some(c => c.dim === chip.dim) ? { chips: [...d.chips, chip] } : d))}
        onRecord={(c: CaseRec) => setDetail(c)}
      />

      {/* Detail slide-over */}
      <AnimatePresence>
        {detail && (
          <>
            <motion.div key="cmov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              onClick={() => setDetail(null)} style={{ position: "fixed", inset: 0, background: "rgba(15,28,54,.35)", zIndex: 80 }} />
            <motion.div key="cmdw" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(440px, 92vw)", zIndex: 81, background: "#f6f4ef", boxShadow: "-14px 0 46px rgba(20,33,61,.35)", display: "flex", flexDirection: "column" }}>
              <div style={{ background: NAVY, padding: "16px 20px", borderBottom: "3px solid var(--gold)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", color: "#c9b27c" }}>CASE RECORD</div>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, color: "#fff", marginTop: 2 }}>{detail.caseNo}</div>
                </div>
                <button onClick={() => setDetail(null)} aria-label="Close"
                  style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 26px" }}>
                {([
                  ["Account", detail.account || "—"],
                  ["Opened", fmtDay(detail.open)],
                  ["Closed", fmtDay(detail.closed)],
                  ["Status", statusName(detail)],
                  ["Case type", detail.typ >= 0 ? CM.TYP[detail.typ] : "—"],
                  ["Priority", detail.pri >= 0 ? CM.PRI[detail.pri] : "—"],
                  ["Origin", detail.org >= 0 ? CM.ORG[detail.org] : "—"],
                  ["TAT status", detail.tat >= 0 ? CM.TAT[detail.tat] : "Within time"],
                  ["Category", detail.area >= 0 ? CM.AREA[detail.area] : "—"],
                  ["Sub category", detail.subArea >= 0 ? CM.SUBA[detail.subArea] : "—"],
                  ["Project", detail.prj >= 0 ? CM.PRJ[detail.prj] : "—"],
                  ["Case owner", detail.own >= 0 ? CM.OWN[detail.own] : "—"],
                  ["Team leader", detail.tl >= 0 ? CM.TL[detail.tl] : "—"],
                  ["Applicability", detail.app >= 0 ? CM.APP[detail.app] : "—"],
                  ["Age", detail.age >= 0 ? `${detail.age} days` : "—"],
                  ["Reassignments", String(detail.reassigns)],
                  ["HNI customer", detail.hni ? "Yes" : "No"],
                  ["Active legal case", detail.legal ? "Yes" : "No"],
                ] as const).map(([k, v]) => (
                  <div key={k} style={{ padding: "9px 0", borderBottom: "1px solid #eae6da" }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--mut)" }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 3, wordBreak: "break-word" }}>{v}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
