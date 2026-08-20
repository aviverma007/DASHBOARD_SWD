import { useMemo, useRef, useState, useEffect } from "react";
import rawTarget from "../../data/targetData.json";
import rawSales from "../../data/salesPDRN.json";
import "../../components/inventory/smartworldInventory.css";
import { CollapsibleCard } from "../../components/common/CollapsibleCard";

// ── Types ────────────────────────────────────────────────────────────────────

interface ProjectTarget {
  name: string;
  units: { monthly: number[]; total: number };
  area: { monthly: number[]; total: number };
  rate: { monthly: number[]; total: number };
  sale_value: { monthly: number[]; total: number };
}

interface TargetData {
  months: string[];
  projects: ProjectTarget[];
}

interface PdrnData {
  P: string[];
  TW: string[];
  FL: string[];
  CFG: string[];
  R: number[][];
}

const TD = rawTarget as TargetData;
const PD = rawSales as unknown as PdrnData;

const MONTHS = TD.months; // ['Apr-26'..'Mar-27']

// Map PDRN booking year/month to a month index (0=Apr-26, 11=Mar-27)
function pdrnMonthIdx(year: number, month: number): number {
  // Apr-26=0, May-26=1, ..., Mar-26=12-ish
  // FY Apr 2026 = year 2026 month 4
  if (year === 2026) return month - 4; // Apr=0, May=1 ... Dec=8
  if (year === 2027) return 9 + month - 1; // Jan=9, Feb=10, Mar=11
  return -1;
}

// Compute actual bookings from PDRN per project and per month
function buildActuals(): Record<string, { units: number[]; value: number[] }> {
  const result: Record<string, { units: number[]; value: number[] }> = {};
  PD.R.forEach((r) => {
    const proj = PD.P[r[0]] ?? "";
    const mIdx = pdrnMonthIdx(r[7], r[8]);
    if (!result[proj]) result[proj] = { units: Array(12).fill(0), value: Array(12).fill(0) };
    if (mIdx >= 0 && mIdx < 12) {
      result[proj].units[mIdx] += 1;
      result[proj].value[mIdx] += r[6] / 1e7; // Cr
    }
  });
  return result;
}

// ── Filter state ─────────────────────────────────────────────────────────────

type MonthFilter = "all" | string; // "all" or one of MONTHS values

// ── Multi-select project dropdown ─────────────────────────────────────────────

function ProjectDropdown({
  projects,
  selected,
  onChange,
}: {
  projects: string[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
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
    if (next.has(name)) next.delete(name);
    else next.add(name);
    if (next.size === projects.length) onChange(new Set());
    else onChange(next);
  }

  const label =
    selected.size === 0
      ? "All projects"
      : selected.size === 1
      ? [...selected][0]
      : `${selected.size} projects`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>
        Project
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          minWidth: 180, background: "#1D2A4A", color: "#fff",
          border: "1px solid #33406B", borderRadius: 7, padding: "9px 34px 9px 13px",
          fontSize: 13.5, fontFamily: "inherit", cursor: "pointer", textAlign: "left",
        }}
      >
        {label} <span style={{ color: "#B8893C" }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 9,
          boxShadow: "0 12px 34px rgba(20,33,61,.2)", padding: 8,
          minWidth: 260, maxHeight: 300, overflowY: "auto",
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 9px", borderBottom: "1px solid var(--line)", marginBottom: 5, paddingBottom: 10, fontSize: 13, color: "var(--ink)", cursor: "pointer", fontWeight: 600 }}>
            <input type="checkbox" checked={selected.size === 0} onChange={() => onChange(new Set())} style={{ accentColor: "#B8893C", width: 15, height: 15 }} />
            All projects
          </label>
          {projects.map((name) => (
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

// ── Donut ────────────────────────────────────────────────────────────────────

interface DonutSeg {
  label: string;
  value: number;
  color: string;
}

function Donut({ segs, center, sub }: { segs: DonutSeg[]; center: string; sub?: string }) {
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  const r = 54, cx = 66, cy = 66, sw = 20, C = 2 * Math.PI * r;
  let off = 0;

  const spaceIdx = center.search(/\s/);
  const hasLong = center.length > 8 && spaceIdx > -1;
  const line1 = hasLong ? center.slice(0, spaceIdx) : center;
  const line2 = hasLong ? center.slice(spaceIdx + 1) : null;
  const fs1 = line2 ? 14 : center.length > 6 ? 14 : 17;

  return (
    <svg viewBox="0 0 132 132" width="132" height="132">
      {segs.map((s, i) => {
        const len = (s.value / total) * C;
        const dash = -off;
        off += len;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
            strokeWidth={sw} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={dash}
            transform={`rotate(-90 ${cx} ${cy})`}>
            <title>{s.label}: {s.value.toLocaleString("en-IN")} ({((s.value / total) * 100).toFixed(1)}%)</title>
          </circle>
        );
      })}
      {line2 ? (
        <>
          <text x={cx} y={cy - 8} textAnchor="middle" fontFamily="Georgia,serif" fontSize={fs1} fontWeight="700" fill="var(--ink)">{line1}</text>
          <text x={cx} y={cy + 6} textAnchor="middle" fontFamily="Georgia,serif" fontSize={10.5} fontWeight="700" fill="var(--ink)">{line2}</text>
          <text x={cx} y={cy + 18} textAnchor="middle" fontSize="8" letterSpacing="1" fill="var(--mut)">TOTAL</text>
        </>
      ) : (
        <>
          <text x={cx} y={cy - 2} textAnchor="middle" fontFamily="Georgia,serif" fontSize={fs1} fontWeight="700" fill="var(--ink)">{line1}</text>
          <text x={cx} y={cy + 13} textAnchor="middle" fontSize="8.5" letterSpacing="1" fill="var(--mut)">{sub ?? "TOTAL"}</text>
        </>
      )}
    </svg>
  );
}

function DonutLegend({ segs, total }: { segs: DonutSeg[]; total: number }) {
  return (
    <div className="dlg">
      {segs.map((s) => (
        <div key={s.label} className="li">
          <span className="sw" style={{ background: s.color }} />
          {s.label}
          <b>{s.value.toLocaleString("en-IN")}</b>
          <span className="pc">{total ? ((s.value / total) * 100).toFixed(1) : "0"}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TargetActualPage() {
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState<MonthFilter>("all");

  const actuals = useMemo(() => buildActuals(), []);
  const allProjectNames = TD.projects.map((p) => p.name);

  // Which target projects are visible
  const visibleProjects = useMemo(() =>
    selectedProjects.size === 0 ? TD.projects : TD.projects.filter((p) => selectedProjects.has(p.name)),
    [selectedProjects]
  );

  // Aggregate targets and actuals for visible projects and selected month
  const agg = useMemo(() => {
    let tgtUnits = 0, tgtValue = 0, actUnits = 0, actValue = 0;
    const rows: { name: string; tgtUnits: number; actUnits: number; tgtValue: number; actValue: number }[] = [];

    visibleProjects.forEach((p) => {
      const act = actuals[p.name] ?? { units: Array(12).fill(0), value: Array(12).fill(0) };
      const mRange = selectedMonth === "all" ? Array.from({ length: 12 }, (_, i) => i) : [MONTHS.indexOf(selectedMonth)];

      const pTgtU = mRange.reduce((s, i) => s + (p.units.monthly[i] ?? 0), 0);
      const pActU = mRange.reduce((s, i) => s + (act.units[i] ?? 0), 0);
      const pTgtV = mRange.reduce((s, i) => s + (p.sale_value.monthly[i] ?? 0), 0);
      const pActV = mRange.reduce((s, i) => s + (act.value[i] ?? 0), 0);

      tgtUnits += pTgtU;
      actUnits += pActU;
      tgtValue += pTgtV;
      actValue += pActV;
      rows.push({ name: p.name, tgtUnits: pTgtU, actUnits: pActU, tgtValue: pTgtV, actValue: pActV });
    });

    return { tgtUnits, actUnits, tgtValue, actValue, rows };
  }, [visibleProjects, selectedMonth, actuals]);

  const achievedPct = agg.tgtUnits > 0 ? Math.round((agg.actUnits / agg.tgtUnits) * 100) : 0;
  const shortfall = Math.max(0, agg.tgtUnits - agg.actUnits);
  const overColor = achievedPct >= 100 ? "#1a7a4a" : achievedPct >= 75 ? "#B8893C" : "#c0392b";

  // Donut segs
  const statusSegs: DonutSeg[] = [
    { label: "Achieved", value: agg.actUnits, color: "#1a7a4a" },
    { label: "Shortfall", value: shortfall, color: "#c0392b" },
  ].filter((s) => s.value > 0);

  const valueSegs: DonutSeg[] = [
    { label: "Actual Value", value: Math.round(agg.actValue * 10) / 10, color: "#1a7a4a" },
    { label: "Target Remaining", value: Math.max(0, Math.round((agg.tgtValue - agg.actValue) * 10) / 10), color: "#c0392b" },
  ].filter((s) => s.value > 0);

  // Month-wise trend data for visible projects
  const monthTrend = MONTHS.map((m, i) => {
    const tgt = visibleProjects.reduce((s, p) => s + (p.units.monthly[i] ?? 0), 0);
    const act = visibleProjects.reduce((s, p) => s + (actuals[p.name]?.units[i] ?? 0), 0);
    return { month: m, tgt, act };
  });

  const maxBar = Math.max(...monthTrend.map((r) => Math.max(r.tgt, r.act)), 1);

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      {/* Navy Filter Bar */}
      <div style={{
        background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)",
        padding: "12px 22px 14px",
        borderBottom: "3px solid var(--gold)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: 14,
      }}>
        <ProjectDropdown projects={allProjectNames} selected={selectedProjects} onChange={setSelectedProjects} />

        <div>
          <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value as MonthFilter)}
            style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}
          >
            <option value="all">Full year (FY 2026-27)</option>
            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ flex: 1 }} />
        <button onClick={() => { setSelectedProjects(new Set()); setSelectedMonth("all"); }}
          style={{ background: "none", border: "none", color: "#c7cedf", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", paddingBottom: 9 }}>
          Reset
        </button>
      </div>

      <div className="wrap">
        {/* KPI Strip */}
        <div className="kpis">
          {[
            { k: "Target Units", v: agg.tgtUnits.toLocaleString("en-IN"), s: "FY 2026-27 plan", color: "#1E3163" },
            { k: "Actual Units", v: agg.actUnits.toLocaleString("en-IN"), s: `${achievedPct}% achieved`, color: "#1a7a4a" },
            { k: "Shortfall", v: shortfall.toLocaleString("en-IN"), s: "units remaining", color: shortfall === 0 ? "#1a7a4a" : "#c0392b" },
            { k: "Target Value", v: `₹${agg.tgtValue.toFixed(1)} Cr`, s: "sale value target", color: "#1E3163" },
            { k: "Actual Value", v: `₹${agg.actValue.toFixed(1)} Cr`, s: "from PDRN bookings", color: "#1a7a4a" },
            { k: "Achievement", v: `${achievedPct}%`, s: achievedPct >= 100 ? "target met ✓" : "of unit target", color: overColor },
          ].map((item) => (
            <div key={item.k} className="kpi" style={{ borderTopColor: item.color, borderTopWidth: 3 }}>
              <div className="k">{item.k}</div>
              <div className="v" style={{ color: item.color, fontSize: 22 }}>{item.v}</div>
              <div className="s">{item.s}</div>
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div className="blkbar" style={{ marginBottom: 14 }}>
          Target vs Actual for FY 2026-27 · Targets from management plan · Actuals from PDRN active bookings
          {selectedMonth !== "all" && <> · Showing: <strong>{selectedMonth}</strong></>}
        </div>

        {/* Donut cards */}
        <div className="grid g2">
          <CollapsibleCard defaultOpen title={<>Unit achievement <span className="hint">target vs actual</span></>}>
            <div className="dual-donut">
              <div className="dual-donut-col">
                <div className="dual-donut-label">Units sold vs target</div>
                <div className="donut-wrap">
                  <Donut segs={statusSegs} center={agg.actUnits.toLocaleString("en-IN")} sub="ACTUAL" />
                  <DonutLegend segs={statusSegs} total={agg.tgtUnits} />
                </div>
              </div>
              <div className="dual-donut-col">
                <div className="dual-donut-label">Achievement %</div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: 132 }}>
                  <div style={{ fontFamily: "Georgia,serif", fontSize: 42, fontWeight: 700, color: overColor, lineHeight: 1 }}>{achievedPct}%</div>
                  <div style={{ fontSize: 13, color: "var(--mut)", marginTop: 6 }}>of {agg.tgtUnits.toLocaleString("en-IN")} target units</div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ background: "#e8e4dc", borderRadius: 4, height: 12, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(achievedPct, 100)}%`, background: overColor, borderRadius: 4, transition: "width 0.4s" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleCard>

          <CollapsibleCard defaultOpen title={<>Value achievement <span className="hint">₹ Cr · target vs actual</span></>}>
            <div className="dual-donut">
              <div className="dual-donut-col">
                <div className="dual-donut-label">Sale Value (₹ Cr)</div>
                <div className="donut-wrap">
                  <Donut segs={valueSegs} center={`₹${agg.actValue.toFixed(0)} Cr`} sub="ACTUAL" />
                  <DonutLegend segs={valueSegs} total={agg.tgtValue} />
                </div>
              </div>
              <div className="dual-donut-col">
                <div className="dual-donut-label">Value %</div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: 132 }}>
                  {(() => {
                    const vPct = agg.tgtValue > 0 ? Math.round((agg.actValue / agg.tgtValue) * 100) : 0;
                    const vColor = vPct >= 100 ? "#1a7a4a" : vPct >= 75 ? "#B8893C" : "#c0392b";
                    return <>
                      <div style={{ fontFamily: "Georgia,serif", fontSize: 42, fontWeight: 700, color: vColor, lineHeight: 1 }}>{vPct}%</div>
                      <div style={{ fontSize: 13, color: "var(--mut)", marginTop: 6 }}>of ₹{agg.tgtValue.toFixed(1)} Cr target</div>
                      <div style={{ marginTop: 12 }}>
                        <div style={{ background: "#e8e4dc", borderRadius: 4, height: 12, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(vPct, 100)}%`, background: vColor, borderRadius: 4, transition: "width 0.4s" }} />
                        </div>
                      </div>
                    </>;
                  })()}
                </div>
              </div>
            </div>
          </CollapsibleCard>
        </div>

        {/* Month-wise trend */}
        <CollapsibleCard title={<>Monthly target vs actual <span className="hint">units · FY 2026-27</span></>}>
          <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 180, overflowX: "auto" }}>
            {monthTrend.map((row, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 54, flex: 1, gap: 4 }}>
                <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 140 }}>
                  {/* Target bar */}
                  <div title={`Target: ${row.tgt}`} style={{
                    width: 18, background: "#c0bbb0", borderRadius: "3px 3px 0 0",
                    height: `${(row.tgt / maxBar) * 100}%`, minHeight: row.tgt ? 4 : 0,
                  }} />
                  {/* Actual bar */}
                  <div title={`Actual: ${row.act}`} style={{
                    width: 18, borderRadius: "3px 3px 0 0",
                    background: row.act >= row.tgt ? "#1a7a4a" : row.act >= row.tgt * 0.75 ? "#B8893C" : "#c0392b",
                    height: `${(row.act / maxBar) * 100}%`, minHeight: row.act ? 4 : 0,
                  }} />
                </div>
                <div style={{ fontSize: 10, color: "var(--mut)", textAlign: "center", lineHeight: 1.2 }}>{row.month.replace("-", "\n")}</div>
              </div>
            ))}
          </div>
          <div className="legend" style={{ marginTop: 10 }}>
            <span><span className="sw" style={{ background: "#c0bbb0" }} /> Target</span>
            <span><span className="sw" style={{ background: "#1a7a4a" }} /> Actual (≥100%)</span>
            <span><span className="sw" style={{ background: "#B8893C" }} /> Actual (75–99%)</span>
            <span><span className="sw" style={{ background: "#c0392b" }} /> Actual (&lt;75%)</span>
          </div>
        </CollapsibleCard>

        {/* Project-wise breakdown */}
        <CollapsibleCard defaultOpen title={<>Project-wise target vs actual <span className="hint">units · click row to filter</span></>}>
          {agg.rows.map((row) => {
            const pct = row.tgtUnits > 0 ? Math.round((row.actUnits / row.tgtUnits) * 100) : 0;
            const color = pct >= 100 ? "#1a7a4a" : pct >= 75 ? "#B8893C" : "#c0392b";
            const maxU = Math.max(...agg.rows.map((r) => r.tgtUnits), 1);
            return (
              <div className="barrow" key={row.name} style={{ cursor: "default" }}>
                <div className="lbl">
                  <span className="nm">{row.name}</span>
                  <span className="r" style={{ display: "flex", gap: 12 }}>
                    <span style={{ color: "#c0bbb0" }}>Target: {row.tgtUnits}</span>
                    <span style={{ color }}>Actual: {row.actUnits} ({pct}%)</span>
                    <span style={{ color: "var(--gold)" }}>₹{row.actValue.toFixed(1)} Cr</span>
                  </span>
                </div>
                {/* Stacked: target (grey) + actual overlay */}
                <div style={{ position: "relative", height: 10, background: "#e8e4dc", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(row.tgtUnits / maxU) * 100}%`, background: "#c0bbb0", borderRadius: 3 }} />
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.min((row.actUnits / maxU) * 100, (row.tgtUnits / maxU) * 100)}%`, background: color, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
          <div className="legend" style={{ marginTop: 10 }}>
            <span><span className="sw" style={{ background: "#c0bbb0" }} /> Target</span>
            <span><span className="sw" style={{ background: "#1a7a4a" }} /> ≥100%</span>
            <span><span className="sw" style={{ background: "#B8893C" }} /> 75–99%</span>
            <span><span className="sw" style={{ background: "#c0392b" }} /> &lt;75%</span>
          </div>
        </CollapsibleCard>

        {/* Monthly table */}
        <CollapsibleCard title={<>Monthly detail table <span className="hint">target · actual · shortfall per month</span></>}>
          <div className="mxwrap">
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="n">Target Units</th>
                  <th className="n">Actual Units</th>
                  <th className="n">Shortfall</th>
                  <th className="n">Achievement</th>
                  <th className="n">Target Value (₹ Cr)</th>
                  <th className="n">Actual Value (₹ Cr)</th>
                </tr>
              </thead>
              <tbody>
                {monthTrend.map((row, i) => {
                  const sf = Math.max(0, row.tgt - row.act);
                  const pct = row.tgt > 0 ? Math.round((row.act / row.tgt) * 100) : 0;
                  const color = pct >= 100 ? "#1a7a4a" : pct >= 75 ? "#B8893C" : "#c0392b";
                  const tgtV = visibleProjects.reduce((s, p) => s + (p.sale_value.monthly[i] ?? 0), 0);
                  const actV = visibleProjects.reduce((s, p) => s + (actuals[p.name]?.value[i] ?? 0), 0);
                  return (
                    <tr key={i} style={{ background: selectedMonth === MONTHS[i] ? "#FBF8F1" : undefined }}>
                      <td>{row.month}</td>
                      <td className="n">{row.tgt.toLocaleString("en-IN")}</td>
                      <td className="n" style={{ color: "#1a7a4a", fontWeight: 600 }}>{row.act.toLocaleString("en-IN")}</td>
                      <td className="n" style={{ color: sf > 0 ? "#c0392b" : "#1a7a4a" }}>{sf > 0 ? `-${sf}` : "✓"}</td>
                      <td className="n" style={{ color, fontWeight: 600 }}>{row.tgt > 0 ? `${pct}%` : "—"}</td>
                      <td className="n" style={{ color: "var(--mut)" }}>{tgtV.toFixed(1)}</td>
                      <td className="n" style={{ color: "#1a7a4a", fontWeight: 600 }}>{actV.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      </div>
    </div>
  );
}
