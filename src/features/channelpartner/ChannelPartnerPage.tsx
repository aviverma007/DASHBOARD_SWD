import { useEffect, useMemo, useRef, useState } from "react";
import { Zoomable } from "../../components/common/Zoomable";
import { DATA_AS_ON } from "../../config/dataInfo";
import {
  CP, summariseByChannelPartner, topByUnits, topByArea, topByTsv, topByCancelled,
  monthlyTrend, cancelledRebookingSummary, filterRecords, CP_YEAR_OPTIONS,
  fArea, fCr, fRate, cpRateRanges,
} from "../../utils/cpLogic";
import type { PeriodScope } from "../../utils/cpLogic";
import { TopEntitiesBarChart } from "../../components/channelpartner/TopEntitiesBarChart";
import { CpMonthlyTrendCard } from "../../components/channelpartner/CpMonthlyTrendCard";
import { CancelledRebookingCard } from "../../components/channelpartner/CancelledRebookingCard";
import { CpDrillDrawer } from "../../components/channelpartner/CpDrillDrawer";
import { CpMonthDrawer } from "../../components/channelpartner/CpMonthDrawer";
import "../../components/inventory/smartworldInventory.css";

const TOP_N = 12;
type PeriodType = PeriodScope["type"];
const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"];
const MONTHS_LIST = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/** Multi-select project dropdown with an "All projects" master option —
 * same interaction pattern as Overview and Target vs Actual. */
function CpProjectMultiSelect({ projects, selected, onChange }: { projects: string[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    if (next.size === projects.length) onChange(new Set()); // all picked = All
    else onChange(next);
  }

  const label = selected.size === 0 ? "All projects"
    : selected.size === 1 ? [...selected][0].replace("SMARTWORLD ", "")
    : `${selected.size} projects`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Project</label>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ minWidth: 200, textAlign: "left", background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
        {label} <span style={{ color: "#B8893C", marginLeft: 6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, background: "#fff", border: "1px solid var(--line)", borderRadius: 9, boxShadow: "0 12px 34px rgba(20,33,61,.2)", padding: 8, minWidth: 280, maxHeight: 320, overflowY: "auto" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderBottom: "1px solid var(--line)", marginBottom: 5, paddingBottom: 10, fontSize: 13, color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>
            <input type="checkbox" checked={selected.size === 0} onChange={() => onChange(new Set())} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
            All projects
          </label>
          {projects.map(name => (
            <label key={name} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderRadius: 6, fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
              <input type="checkbox" checked={selected.has(name)} onChange={() => toggle(name)} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
              {name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Searchable multi-select over 400+ channel partners: type to filter
 * the list, tick any combination, All is the master option. Direct
 * (no-CP) sales are not listed — they're shown separately on the page. */
function CpSearchMultiSelect({ selected, onChange }: { selected: Set<number>; onChange: (s: Set<number>) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CP.CP
      .map((name, idx) => ({ name, idx }))
      .filter(o => o.name !== "Direct" && (!q || o.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [query]);

  function toggle(idx: number) {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    onChange(next);
  }

  const label = selected.size === 0 ? "All CPs"
    : selected.size === 1 ? CP.CP[[...selected][0]]
    : `${selected.size} CPs`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Channel partner</label>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ minWidth: 180, maxWidth: 240, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
        {label} <span style={{ color: "#B8893C", marginLeft: 6 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60, background: "#fff", border: "1px solid var(--line)", borderRadius: 9, boxShadow: "0 12px 34px rgba(20,33,61,.2)", padding: 8, minWidth: 300, maxHeight: 360, display: "flex", flexDirection: "column" }}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search channel partners…"
            style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px", fontSize: 13, fontFamily: "inherit", marginBottom: 6, color: "var(--ink)" }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderBottom: "1px solid var(--line)", marginBottom: 5, paddingBottom: 10, fontSize: 13, color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>
            <input type="checkbox" checked={selected.size === 0} onChange={() => onChange(new Set())} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
            All CPs
          </label>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {options.length === 0 && <div style={{ fontSize: 12.5, color: "var(--mut)", padding: "8px 9px" }}>No partner matches "{query.trim()}".</div>}
            {options.map(o => (
              <label key={o.idx} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 9px", borderRadius: 6, fontSize: 12.5, color: "var(--ink)", cursor: "pointer" }}>
                <input type="checkbox" checked={selected.has(o.idx)} onChange={() => toggle(o.idx)} style={{ accentColor: "#B8893C", width: 14, height: 14, flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ChannelPartnerPage() {
  const [drillCpIdx, setDrillCpIdx] = useState<number | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set()); // empty = all
  const [selectedCps, setSelectedCps] = useState<Set<number>>(new Set());            // cpIdx; empty = all
  const [drillMonth, setDrillMonth] = useState<{ key: string; label: string } | null>(null);
  const [periodType, setPeriodType] = useState<PeriodType>("all");
  const [fyIdx, setFyIdx] = useState<number>(CP_YEAR_OPTIONS.length - 1);
  const [quarter, setQuarter] = useState<number>(0); // 0-3
  const [month, setMonth] = useState<number>(1); // 1-12 calendar month
  const [monthYear, setMonthYear] = useState<number>(new Date().getFullYear());

  const period: PeriodScope = useMemo(() => {
    if (periodType === "all") return { type: "all" };
    if (periodType === "year") return { type: "year", fy: CP_YEAR_OPTIONS[fyIdx]?.fy };
    if (periodType === "quarter") return { type: "quarter", fy: CP_YEAR_OPTIONS[fyIdx]?.fy, quarter };
    return { type: "month", year: monthYear, month };
  }, [periodType, fyIdx, quarter, monthYear, month]);

  const scopedRecords = useMemo(() => {
    const recs = filterRecords(selectedProjects, period);
    return selectedCps.size > 0 ? recs.filter(r => selectedCps.has(r.cpIdx)) : recs;
  }, [selectedProjects, period, selectedCps]);

  const allCps = useMemo(() => summariseByChannelPartner(scopedRecords).filter(s => s.name !== "Direct"), [scopedRecords]);
  const directCp = useMemo(() => summariseByChannelPartner(scopedRecords).find(s => s.name === "Direct"), [scopedRecords]);

  const totalUnits = useMemo(() => allCps.reduce((s, c) => s + c.units, 0), [allCps]);
  const totalArea = useMemo(() => allCps.reduce((s, c) => s + c.area, 0), [allCps]);
  const totalTsv = useMemo(() => allCps.reduce((s, c) => s + c.tsv, 0), [allCps]);

  const cancelSummary = useMemo(() => cancelledRebookingSummary(scopedRecords), [scopedRecords]);
  const topCancelled = useMemo(() => topByCancelled(scopedRecords, 8), [scopedRecords]);

  const topUnits = useMemo(() => topByUnits(scopedRecords, TOP_N, true), [scopedRecords]);
  const topArea = useMemo(() => topByArea(scopedRecords, TOP_N, true), [scopedRecords]);
  const topTsv = useMemo(() => topByTsv(scopedRecords, TOP_N, true), [scopedRecords]);

  const trend = useMemo(() => monthlyTrend(scopedRecords, true), [scopedRecords]);
  const rateRanges = useMemo(() => cpRateRanges(scopedRecords), [scopedRecords]);

  function handleReset() {
    setSelectedProjects(new Set());
    setSelectedCps(new Set());
    setDrillMonth(null);
    setPeriodType("all");
    setFyIdx(CP_YEAR_OPTIONS.length - 1);
    setQuarter(0);
    setMonth(1);
    setMonthYear(new Date().getFullYear());
  }

  const periodLabel = periodType === "all" ? "All time"
    : periodType === "year" ? CP_YEAR_OPTIONS[fyIdx]?.label
    : periodType === "quarter" ? `${QUARTER_LABELS[quarter]} ${CP_YEAR_OPTIONS[fyIdx]?.label}`
    : `${MONTHS_LIST[month - 1]} ${monthYear}`;

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      {/* Header + filter bar */}
      <div style={{ background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)", padding: "14px 22px 14px", borderBottom: "3px solid var(--gold)" }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 20, color: "#fff", fontWeight: 700 }}>Channel Partners</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 2 }}>Broker performance, trends and cancellations</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14 }}>
        <CpProjectMultiSelect projects={CP.P} selected={selectedProjects} onChange={setSelectedProjects} />
        <CpSearchMultiSelect selected={selectedCps} onChange={setSelectedCps} />

        <div>
          <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Period</label>
          <div style={{ display: "flex", gap: 5 }}>
            {(["all", "year", "quarter", "month"] as PeriodType[]).map(t => (
              <button key={t} onClick={() => setPeriodType(t)} style={{ background: periodType === t ? "#B8893C" : "#1D2A4A", color: "#fff", border: `1px solid ${periodType === t ? "#B8893C" : "#33406B"}`, borderRadius: 7, padding: "9px 14px", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer" }}>
                {t === "all" ? "All time" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {(periodType === "year" || periodType === "quarter") && (
          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Year</label>
            <select value={fyIdx} onChange={e => setFyIdx(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
              {CP_YEAR_OPTIONS.map((y, i) => <option key={y.label} value={i}>{y.label}</option>)}
            </select>
          </div>
        )}
        {periodType === "quarter" && (
          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Quarter</label>
            <select value={quarter} onChange={e => setQuarter(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
              {QUARTER_LABELS.map((q, i) => <option key={q} value={i}>{q}</option>)}
            </select>
          </div>
        )}
        {periodType === "month" && (
          <>
            <div>
              <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Month</label>
              <select value={month} onChange={e => setMonth(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                {MONTHS_LIST.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Year</label>
              <select value={monthYear} onChange={e => setMonthYear(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
                {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />
        <span style={{ color: "#c7cedf", fontSize: 12.5, paddingBottom: 8, marginRight: 14 }}>Data as on <strong style={{ color: "#fff", fontWeight: 600 }}>{DATA_AS_ON}</strong></span>
        <button onClick={handleReset} style={{ background: "none", border: "none", color: "#c7cedf", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", paddingBottom: 9 }}>Reset</button>
        </div>
      </div>

      <div className="wrap">
        <div style={{ marginBottom: 12, fontSize: 12.5, color: "var(--mut)" }}>
          <strong>{selectedProjects.size === 0 ? "All projects" : selectedProjects.size === 1 ? [...selectedProjects][0] : `${selectedProjects.size} projects`}</strong> · {periodLabel} · {allCps.length} channel partners · click any bar or row to drill down
        </div>

        {/* KPI strip */}
        <div className="kpis">
          <div className="kpi" style={{ borderTopColor: "#1E3163", borderTopWidth: 3 }}>
            <div className="k">Channel Partners</div>
            <div className="v" style={{ color: "#1E3163", fontSize: 22 }}>{allCps.length}</div>
            <div className="s">active in scope</div>
          </div>
          <div className="kpi" style={{ borderTopColor: "#0e7490", borderTopWidth: 3 }}>
            <div className="k">CP Units Sold</div>
            <div className="v" style={{ color: "#0e7490", fontSize: 22 }}>{totalUnits.toLocaleString("en-IN")}</div>
            <div className="s">via channel partners</div>
          </div>
          <div className="kpi" style={{ borderTopColor: "#B8893C", borderTopWidth: 3 }}>
            <div className="k">CP Area Sold</div>
            <div className="v" style={{ color: "#B8893C", fontSize: 22 }}>{fArea(totalArea)}</div>
            <div className="s">total super area</div>
          </div>
          <div className="kpi" style={{ borderTopColor: "#7b1414", borderTopWidth: 3 }}>
            <div className="k">CP TSV</div>
            <div className="v" style={{ color: "#7b1414", fontSize: 22 }}>{fCr(totalTsv)}</div>
            <div className="s">total sale value</div>
          </div>
          <div className="kpi" style={{ borderTopColor: "#c0392b", borderTopWidth: 3 }}>
            <div className="k">Cancelled Units</div>
            <div className="v" style={{ color: "#c0392b", fontSize: 22 }}>{cancelSummary.cancelled}</div>
            <div className="s">all channels</div>
          </div>
          <div className="kpi" style={{ borderTopColor: "#1a7a4a", borderTopWidth: 3 }}>
            <div className="k">Rebooked Units</div>
            <div className="v" style={{ color: "#1a7a4a", fontSize: 22 }}>{cancelSummary.rebooked}</div>
            <div className="s">back into an active sale</div>
          </div>
        </div>

        {directCp && directCp.units > 0 && (
          <div className="blkbar" style={{ marginBottom: 14 }}>
            {directCp.units} units ({fArea(directCp.area)}, {fCr(directCp.tsv)}) were sold directly, without a channel partner, in this scope — excluded from the CP figures above.
          </div>
        )}

        {/* Monthly trend */}
        <div style={{ marginBottom: 16 }}>
          <Zoomable title="CP monthly trend">
          <CpMonthlyTrendCard data={trend} onBarClick={p => setDrillMonth({ key: p.key, label: p.label })} />
          </Zoomable>
        </div>

        {/* Top CP rankings */}
        <div className="resp-grid2" style={{ gap: 18, marginBottom: 18 }}>
          <Zoomable title="Top entities">
          <TopEntitiesBarChart
            title="TOP CHANNEL PARTNERS — UNITS SOLD"
            rows={topUnits}
            valueKey="units"
            formatValue={v => v.toLocaleString("en-IN")}
            barColor="#0e7490"
            onRowClick={setDrillCpIdx}
          />
          </Zoomable>
          <Zoomable title="Top entities">
          <TopEntitiesBarChart
            title="TOP CHANNEL PARTNERS — AREA SOLD (L SQFT)"
            rows={topArea}
            valueKey="area"
            formatValue={v => (v / 100000).toFixed(2)}
            barColor="#B8893C"
            onRowClick={setDrillCpIdx}
          />
          </Zoomable>
        </div>

        <div className="resp-grid2" style={{ gap: 18, marginBottom: 18 }}>
          <Zoomable title="Top entities">
          <TopEntitiesBarChart
            title="TOP CHANNEL PARTNERS — TSV (₹ CR)"
            rows={topTsv}
            valueKey="tsv"
            formatValue={v => (v / 1e7).toFixed(1)}
            barColor="#7b1414"
            onRowClick={setDrillCpIdx}
          />
          </Zoomable>
          <Zoomable title="Cancelled & rebooking">
          <CancelledRebookingCard
            cancelled={cancelSummary.cancelled}
            rebooked={cancelSummary.rebooked}
            stillVacant={cancelSummary.stillVacant}
            cancelledTsv={cancelSummary.cancelledTsv}
            topCancelled={topCancelled}
            onCpClick={setDrillCpIdx}
          />
          </Zoomable>
        </div>

        {/* Per-CP rate range: EVERY channel partner in scope with their
            own highest and lowest sold rate and the project each came
            from. Rows drill into that CP's drawer. */}
        {rateRanges.length > 0 && (
          <div className="card" style={{ marginBottom: 14, padding: "14px 18px 8px" }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#1a3752", marginBottom: 8 }}>
              CP RATE RANGE — HIGHEST &amp; LOWEST PER CHANNEL PARTNER{" "}
              <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--mut)" }}>
                {rateRanges.length} partners · sorted by highest rate · click a row → drill CP
              </span>
            </div>
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--line)", position: "sticky", top: 0, background: "var(--card)", zIndex: 1 }}>
                    <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "7px 8px 7px 0" }}>Channel partner</th>
                    <th style={{ textAlign: "right", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "7px 8px" }}>Units</th>
                    <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#1a7a4a", padding: "7px 8px" }}>Highest rate · project</th>
                    <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#c97a1a", padding: "7px 8px" }}>Lowest rate · project</th>
                    <th style={{ textAlign: "right", fontSize: 10.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--mut)", padding: "7px 0 7px 8px" }}>Last booking</th>
                  </tr>
                </thead>
                <tbody>
                  {rateRanges.map(row => (
                    <tr
                      key={row.cpIdx}
                      onClick={() => setDrillCpIdx(row.cpIdx)}
                      style={{ borderBottom: "1px solid var(--line)", cursor: "pointer" }}
                    >
                      <td style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", padding: "8px 8px 8px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>{row.name}</td>
                      <td style={{ fontSize: 12.5, color: "var(--mut)", padding: "8px 8px", textAlign: "right" }}>{row.units}</td>
                      <td style={{ padding: "8px 8px", whiteSpace: "nowrap" }}>
                        <span style={{ fontFamily: "Georgia,serif", fontSize: 13.5, fontWeight: 700, color: "#1a7a4a" }}>{fRate(row.hiRate)}</span>
                        <span style={{ fontSize: 11.5, color: "var(--mut)", marginLeft: 7 }}>{row.hiProj}</span>
                      </td>
                      <td style={{ padding: "8px 8px", whiteSpace: "nowrap" }}>
                        <span style={{ fontFamily: "Georgia,serif", fontSize: 13.5, fontWeight: 700, color: "#c97a1a" }}>{fRate(row.loRate)}</span>
                        <span style={{ fontSize: 11.5, color: "var(--mut)", marginLeft: 7 }}>{row.loProj}</span>
                      </td>
                      <td style={{ fontSize: 12.5, color: "var(--ink)", padding: "8px 0 8px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                        {row.lastDay >= 0 ? new Date(new Date("2022-01-01T00:00:00").getTime() + row.lastDay * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {drillMonth !== null && drillCpIdx === null && (
        <CpMonthDrawer
          monthKey={drillMonth.key}
          monthLabel={drillMonth.label}
          records={scopedRecords}
          onCpClick={idx => setDrillCpIdx(idx)}
          onClose={() => setDrillMonth(null)}
        />
      )}
      {drillCpIdx !== null && (
        <CpDrillDrawer cpIdx={drillCpIdx} onClose={() => setDrillCpIdx(null)} />
      )}
    </div>
  );
}
