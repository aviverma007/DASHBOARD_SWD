import { useEffect, useRef, useState } from "react";
import type { PeriodFilter } from "../../utils/pdrnLogic";

interface PdrnFiltersProps {
  projects: string[];
  selectedProjects: Set<string>;          // empty = All
  onProjectsChange: (s: Set<string>) => void;
  period: PeriodFilter;
  onPeriodChange: (p: PeriodFilter) => void;
  years: number[];
  onReset: () => void;
}

const QUARTERS = ["Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

const PILL: React.CSSProperties = {
  appearance: "none" as const,
  background: "#1D2A4A",
  color: "#fff",
  border: "1px solid #33406B",
  borderRadius: 7,
  padding: "8px 13px",
  fontSize: 13,
  fontFamily: "inherit",
  cursor: "pointer",
};
const PILL_ACTIVE: React.CSSProperties = {
  ...PILL,
  background: "#B8893C",
  border: "1px solid #B8893C",
};
const LBL: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  letterSpacing: "1.5px",
  textTransform: "uppercase" as const,
  color: "#A9B2C7",
  marginBottom: 5,
};

export function PdrnFilters({ projects, selectedProjects, onProjectsChange, period, onPeriodChange, years, onReset }: PdrnFiltersProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const msRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (msRef.current && !msRef.current.contains(e.target as Node)) setPanelOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function toggle(name: string) {
    const next = new Set(selectedProjects);
    if (next.has(name)) next.delete(name); else next.add(name);
    // if all selected, revert to empty (= All)
    if (next.size === projects.length) onProjectsChange(new Set());
    else onProjectsChange(next);
  }

  function setPeriodType(type: PeriodFilter["type"]) {
    onPeriodChange({ type, year: period.year ?? years[years.length - 1] });
  }

  const label = selectedProjects.size === 0
    ? "All projects"
    : selectedProjects.size === 1
    ? [...selectedProjects][0].replace("Smartworld ", "").replace("SMARTWORLD ", "")
    : `${selectedProjects.size} projects`;

  return (
    <div style={{
      background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)",
      padding: "12px 22px",
      borderBottom: "3px solid var(--gold)",
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-end",
      gap: 12,
    }}>
      {/* Multi-select project */}
      <div ref={msRef} style={{ position: "relative" }}>
        <label style={LBL}>Project</label>
        <button
          type="button"
          onClick={() => setPanelOpen(v => !v)}
          style={{ ...PILL, minWidth: 180, textAlign: "left" as const }}
        >
          {label} <span style={{ color: "#B8893C", marginLeft: 6 }}>▾</span>
        </button>
        {panelOpen && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 60,
            background: "#fff", border: "1px solid var(--line)", borderRadius: 9,
            boxShadow: "0 12px 34px rgba(20,33,61,.2)", padding: 8,
            minWidth: 260, maxHeight: 300, overflowY: "auto",
          }}>
            <label style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "6px 9px", borderBottom: "1px solid var(--line)",
              marginBottom: 5, paddingBottom: 10,
              fontSize: 13, color: "var(--ink)", cursor: "pointer", fontWeight: 600,
            }}>
              <input
                type="checkbox"
                checked={selectedProjects.size === 0}
                onChange={() => onProjectsChange(new Set())}
                style={{ accentColor: "#B8893C", width: 15, height: 15 }}
              />
              All projects
            </label>
            {projects.map(name => (
              <label key={name} style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: "6px 9px", borderRadius: 6,
                fontSize: 13, color: "var(--ink)", cursor: "pointer",
              }}>
                <input
                  type="checkbox"
                  checked={selectedProjects.has(name)}
                  onChange={() => toggle(name)}
                  style={{ accentColor: "#B8893C", width: 15, height: 15 }}
                />
                {name}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Period type buttons */}
      <div>
        <label style={LBL}>Period</label>
        <div style={{ display: "flex", gap: 5 }}>
          {(["all","year","quarter","month"] as const).map(t => (
            <button key={t} onClick={() => setPeriodType(t)}
              style={period.type === t ? PILL_ACTIVE : PILL}>
              {t === "all" ? "All time" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Year */}
      {period.type !== "all" && (
        <div>
          <label style={LBL}>Year</label>
          <select value={period.year ?? years[years.length-1]}
            onChange={e => onPeriodChange({...period, year: +e.target.value})}
            style={PILL}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {/* Quarter */}
      {period.type === "quarter" && (
        <div>
          <label style={LBL}>Quarter</label>
          <select value={period.quarter ?? 1}
            onChange={e => onPeriodChange({...period, type:"quarter", quarter:+e.target.value})}
            style={PILL}>
            {QUARTERS.map((q,i) => <option key={i+1} value={i+1}>{q}</option>)}
          </select>
        </div>
      )}

      {/* Month */}
      {period.type === "month" && (
        <div>
          <label style={LBL}>Month</label>
          <select value={period.month ?? 1}
            onChange={e => onPeriodChange({...period, type:"month", month:+e.target.value})}
            style={PILL}>
            {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
      )}

      <div style={{ flex: 1 }} />
      <button onClick={onReset} style={{
        background:"none", border:"none", color:"#c7cedf",
        fontSize:12.5, fontFamily:"inherit", cursor:"pointer", paddingBottom:8,
      }}>Reset</button>
    </div>
  );
}
