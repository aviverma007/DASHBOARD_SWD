import { useMemo, useState } from "react";
import { Zoomable } from "../common/Zoomable";
import { CM, isClosed, type CaseRec } from "./caseShared";

/** MIS Reports — the manual Excel MIS (RM ageing, TL pending summary,
 * inclusion/exclusion, exclusion by category, resolved summary)
 * rebuilt live from the case dataset. Ageing buckets follow the MIS:
 * 24 Hrs · 48 Hrs · 96 Hrs · 5-8 d · 9-15 d · 16-30 d · >30 d. */

const NAVY = "#14213D", TEAL = "#0E7490", GREEN = "#1BAF7A", RED = "#c0392b";
const CARD: React.CSSProperties = { background: "#fff", border: "1px solid #eae6da", borderRadius: 12, boxShadow: "0 2px 4px rgba(20,33,61,.05), 0 8px 22px rgba(20,33,61,.07)", padding: "14px 16px", marginBottom: 14 };
const H3: React.CSSProperties = { fontFamily: "Georgia,serif", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", margin: "0 0 2px" };
const CAP: React.CSSProperties = { fontSize: 11, color: "var(--mut)", marginBottom: 10 };
const TH: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "8px 10px", borderBottom: "2px solid #eae6da", textAlign: "right", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "6px 10px", textAlign: "right", borderBottom: "1px solid #f0ede5", whiteSpace: "nowrap" };
const fN = (n: number) => n.toLocaleString("en-IN");

/* MIS ageing buckets on age-in-days */
const BUCKETS: { l: string; lo: number; hi: number }[] = [
  { l: "Within 24 Hrs", lo: 0, hi: 0 }, { l: "Within 48 Hrs", lo: 1, hi: 1 },
  { l: "Within 96 Hrs", lo: 2, hi: 4 }, { l: "5–8 Days", lo: 5, hi: 8 },
  { l: "9–15 Days", lo: 9, hi: 15 }, { l: "16–30 Days", lo: 16, hi: 30 },
  { l: "> 30 Days", lo: 31, hi: 1e9 },
];
const bkt = (age: number) => BUCKETS.findIndex(b => age >= b.lo && age <= b.hi);

/* HOD grouping from the MIS sheet (TL → HOD). Unlisted TLs fall under "Other". */
const HOD_OF: Record<string, string> = {
  "Ashish Agrawal": "Raghav", "Rahul Vohra": "Raghav", "Raghav Aggarwal": "Raghav",
  "Manish Singla": "Raghav", "Avneesh Gupta": "Raghav", "Amit Chadha": "Raghav",
  "Rahul Jain": "Raghav", "Sonia": "Sonia", "Vineet Gupta": "Vineet Kumar",
};

type DrillOpen = (chips: { dim: "own" | "tl" | "area"; val: number; label: string }[]) => void;

function BucketTable({ title, cap, rows, nameOf, onRow, extra }: {
  title: string; cap: string;
  rows: [number, CaseRec[]][]; nameOf: (k: number) => string;
  onRow?: (k: number) => void;
  extra?: { h: string; f: (cs: CaseRec[]) => string }[];
}) {
  return (
    <Zoomable title={title}>
      <div style={CARD}>
        <h3 style={H3}>{title}</h3>
        <div style={CAP}>{cap}</div>
        <div style={{ maxHeight: 420, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 820 }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                <th style={{ ...TH, textAlign: "left" }}>Name</th>
                {BUCKETS.map(b => <th key={b.l} style={TH}>{b.l}</th>)}
                <th style={TH}>Total</th>
                {(extra ?? []).map(e => <th key={e.h} style={TH}>{e.h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, cs]) => {
                const counts = BUCKETS.map((_, bi) => cs.filter(c => bkt(Math.max(c.age, 0)) === bi).length);
                return (
                  <tr key={k} onClick={onRow ? () => onRow(k) : undefined}
                    style={{ cursor: onRow ? "pointer" : "default" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                    <td style={{ ...TD, textAlign: "left", fontWeight: 700, color: "var(--ink)" }}>{nameOf(k)}</td>
                    {counts.map((n, i) => <td key={i} style={{ ...TD, color: i >= 5 ? RED : "var(--ink)", fontWeight: i >= 5 && n > 0 ? 800 : 500 }}>{n || ""}</td>)}
                    <td style={{ ...TD, fontWeight: 800 }}>{fN(cs.length)}</td>
                    {(extra ?? []).map(e => <td key={e.h} style={TD}>{e.f(cs)}</td>)}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ position: "sticky", bottom: 0, background: "#faf9f6" }}>
                <td style={{ ...TD, textAlign: "left", fontWeight: 800 }}>Grand Total</td>
                {BUCKETS.map((_, bi) => (
                  <td key={bi} style={{ ...TD, fontWeight: 800 }}>{fN(rows.reduce((s, [, cs]) => s + cs.filter(c => bkt(Math.max(c.age, 0)) === bi).length, 0))}</td>
                ))}
                <td style={{ ...TD, fontWeight: 800 }}>{fN(rows.reduce((s, [, cs]) => s + cs.length, 0))}</td>
                {(extra ?? []).map(e => <td key={e.h} style={{ ...TD, fontWeight: 800 }}>{e.f(rows.flatMap(([, cs]) => cs))}</td>)}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Zoomable>
  );
}

export function CaseReports({ rows, openDrill }: { rows: CaseRec[]; openDrill: DrillOpen }) {
  const [grp, setGrp] = useState<"own" | "tl">("own"); // merged ageing table grouping
  const [pendScope, setPendScope] = useState<"all" | 0 | 1>("all"); // applicability filter for pending summary
  const openCases = useMemo(() => rows.filter(c => !isClosed(c)), [rows]);
  const exclIdx = CM.APP.indexOf("Exclusion");
  const inclIdx = CM.APP.indexOf("Inclusion");

  const groupBy = (cs: CaseRec[], key: (c: CaseRec) => number) => {
    const m = new Map<number, CaseRec[]>();
    cs.forEach(c => { const k = key(c); if (k < 0) return; if (!m.has(k)) m.set(k, []); m.get(k)!.push(c); });
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  };

  /* 1 — RM Wise Open Ticket, Ageing Wise */
  const rmAgeing = useMemo(() => groupBy(openCases.filter(c => pendScope === "all" || c.app === pendScope), c => c.own), [openCases, pendScope]);

  /* 2 — Pending Ticket Summary — TL wise (HOD grouped), scoped by applicability */
  const pendScoped = useMemo(() => openCases.filter(c => pendScope === "all" || c.app === pendScope), [openCases, pendScope]);
  const tlPending = useMemo(() => {
    const g = groupBy(pendScoped, c => c.tl);
    return g.sort((a, b) => (HOD_OF[CM.TL[a[0]]] ?? "zz").localeCompare(HOD_OF[CM.TL[b[0]]] ?? "zz") || b[1].length - a[1].length);
  }, [pendScoped]);

  /* 3 — Inclusion / Exclusion — RM wise, with avg ageing of exclusions */
  const rmApp = useMemo(() => groupBy(rows, c => c.own), [rows]);

  /* 5 — Resolved summary (day-approximation: same/next day ≈ within 24 hrs) */
  const resolved = useMemo(() => rows.filter(c => isClosed(c) && c.closed >= 0 && c.open >= 0), [rows]);
  const tlResolved = useMemo(() => groupBy(resolved, c => c.tl), [resolved]);

  const inclCount = (cs: CaseRec[]) => cs.filter(c => c.app === inclIdx).length;
  const exclCount = (cs: CaseRec[]) => cs.filter(c => c.app === exclIdx).length;

  return (
    <>
      {/* One ageing table, RM | TL grouping + applicability scope — merged
          from the two separate MIS sheets so nothing is duplicated. */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 10px", flexWrap: "wrap" }}>
        {(["own", "tl"] as const).map(k => (
          <button key={k} onClick={() => setGrp(k)}
            style={{ border: "1px solid #d8d2c4", background: grp === k ? NAVY : "#fff", color: grp === k ? "#fff" : "var(--ink)", fontWeight: 700, fontSize: 11.5, borderRadius: 999, padding: "5px 14px", cursor: "pointer", fontFamily: "inherit" }}>
            {k === "own" ? "By RM (Case Owner)" : "By TL (HOD-wise)"}
          </button>
        ))}
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", marginLeft: 8 }}>Scope</span>
        {(["all", inclIdx, exclIdx] as const).map(k => (
          <button key={String(k)} onClick={() => setPendScope(k as typeof pendScope)}
            style={{ border: "1px solid #d8d2c4", background: pendScope === k ? NAVY : "#fff", color: pendScope === k ? "#fff" : "var(--ink)", fontWeight: 700, fontSize: 11.5, borderRadius: 999, padding: "5px 14px", cursor: "pointer", fontFamily: "inherit" }}>
            {k === "all" ? "All" : CM.APP[k as number]}
          </button>
        ))}
      </div>
      {grp === "own" ? (
        <BucketTable title="Open Tickets — Ageing Wise (RM)"
          cap="open tickets in the current filter scope · buckets on ticket age · click an RM → drill"
          rows={rmAgeing} nameOf={k => CM.OWN[k]}
          onRow={k => openDrill([{ dim: "own", val: k, label: CM.OWN[k] }])}
          extra={[{ h: "Exclusion", f: cs => String(exclCount(cs) || "") }]} />
      ) : (
        <BucketTable title="Open Tickets — Ageing Wise (TL, HOD grouped)"
          cap="open tickets grouped by team leader (sorted by HOD: Raghav · Sonia · Vineet Kumar · other) · click a TL → drill"
          rows={tlPending} nameOf={k => `${HOD_OF[CM.TL[k]] ?? "Other"} — ${CM.TL[k]}`}
          onRow={k => openDrill([{ dim: "tl", val: k, label: CM.TL[k] }])}
          extra={[{ h: "Exclusion", f: cs => String(exclCount(cs) || "") }]} />
      )}

      <Zoomable title="Inclusion exclusion RM wise" collapsible>
        <div style={CARD}>
          <h3 style={H3}>Inclusion / Exclusion — RM wise</h3>
          <div style={CAP}>all tickets in scope · avg ageing computed on exclusion tickets · click an RM → drill</div>
          <div style={{ maxHeight: 420, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 560 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                  <th style={{ ...TH, textAlign: "left" }}>Case Owner</th>
                  <th style={TH}>Inclusion</th><th style={TH}>Exclusion</th><th style={TH}>Grand Total</th><th style={TH}>Avg Ageing (Excl)</th>
                </tr>
              </thead>
              <tbody>
                {rmApp.map(([k, cs]) => {
                  const ex = cs.filter(c => c.app === exclIdx);
                  const avg = ex.length ? (ex.reduce((s, c) => s + Math.max(c.age, 0), 0) / ex.length).toFixed(2) : "";
                  return (
                    <tr key={k} onClick={() => openDrill([{ dim: "own", val: k, label: CM.OWN[k] }])} style={{ cursor: "pointer" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                      <td style={{ ...TD, textAlign: "left", fontWeight: 700, color: "var(--ink)" }}>{CM.OWN[k]}</td>
                      <td style={TD}>{fN(inclCount(cs)) }</td>
                      <td style={{ ...TD, color: ex.length ? RED : "var(--mut)", fontWeight: ex.length ? 800 : 500 }}>{ex.length || ""}</td>
                      <td style={{ ...TD, fontWeight: 800 }}>{fN(cs.length)}</td>
                      <td style={{ ...TD, color: "var(--mut)" }}>{avg}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ position: "sticky", bottom: 0, background: "#faf9f6" }}>
                  <td style={{ ...TD, textAlign: "left", fontWeight: 800 }}>Grand Total</td>
                  <td style={{ ...TD, fontWeight: 800 }}>{fN(rows.filter(c => c.app === inclIdx).length)}</td>
                  <td style={{ ...TD, fontWeight: 800 }}>{fN(rows.filter(c => c.app === exclIdx).length)}</td>
                  <td style={{ ...TD, fontWeight: 800 }}>{fN(rows.length)}</td>
                  <td style={TD} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </Zoomable>

      <div>
        <Zoomable title="Resolved summary TL wise" collapsible>
          <div style={{ ...CARD, marginBottom: 14 }}>
            <h3 style={H3}>Resolved Summary — TL wise</h3>
            <div style={CAP}>≈ within 24 hrs = closed same/next day (dataset carries dates, not timestamps) · click a TL → drill</div>
            <div style={{ maxHeight: 380, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 420 }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, background: "#faf9f6", zIndex: 1 }}>
                    <th style={{ ...TH, textAlign: "left" }}>TL</th>
                    <th style={TH}>≈ Within 24 Hrs</th><th style={TH}>Above 24 Hrs</th><th style={TH}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tlResolved.map(([k, cs]) => {
                    const fast = cs.filter(c => c.closed - c.open <= 1).length;
                    return (
                      <tr key={k} onClick={() => openDrill([{ dim: "tl", val: k, label: CM.TL[k] }])} style={{ cursor: "pointer" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#faf8f2"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                        <td style={{ ...TD, textAlign: "left", fontWeight: 700, color: "var(--ink)" }}>{CM.TL[k]}</td>
                        <td style={{ ...TD, color: GREEN, fontWeight: 700 }}>{fN(fast)}</td>
                        <td style={{ ...TD, color: TEAL }}>{fN(cs.length - fast)}</td>
                        <td style={{ ...TD, fontWeight: 800 }}>{fN(cs.length)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ position: "sticky", bottom: 0, background: "#faf9f6" }}>
                    <td style={{ ...TD, textAlign: "left", fontWeight: 800 }}>Grand Total</td>
                    <td style={{ ...TD, fontWeight: 800 }}>{fN(resolved.filter(c => c.closed - c.open <= 1).length)}</td>
                    <td style={{ ...TD, fontWeight: 800 }}>{fN(resolved.filter(c => c.closed - c.open > 1).length)}</td>
                    <td style={{ ...TD, fontWeight: 800 }}>{fN(resolved.length)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Zoomable>
      </div>

      <div style={{ ...CARD, background: "#fdf9ef", border: "1px dashed #d9c79a" }}>
        <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 600 }}>
          Response-summary reports (RM/team-wise "responded within 24 hrs · no response") need a first-response
          timestamp per ticket, which the current export doesn't carry — share the SFDC export with the
          First Response Time column and those tables will be added here with the exact %-age format of the MIS.
        </div>
      </div>
    </>
  );
}
