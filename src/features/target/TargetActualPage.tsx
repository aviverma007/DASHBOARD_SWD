import { useEffect, useRef, useState } from "react";
import rawTarget from "../../data/targetData.json";
import "../../components/inventory/smartworldInventory.css";

interface TargetData { months: string[]; projects: { name: string }[]; }
const TD = rawTarget as unknown as TargetData;

const YEARS = [2026, 2027];
const QUARTERS = ["Q1 (Apr–Jun)", "Q2 (Jul–Sep)", "Q3 (Oct–Dec)", "Q4 (Jan–Mar)"];
const MONTHS_LIST = ["April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];

type PeriodType = "all" | "year" | "quarter" | "month";

function ProjectDropdown({ projects, selected, onChange }: { projects: string[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function toggle(name: string) {
    const next = new Set(selected);
    next.has(name) ? next.delete(name) : next.add(name);
    if (next.size === projects.length) onChange(new Set());
    else onChange(next);
  }

  const label = selected.size === 0 ? "All projects" : selected.size === 1 ? [...selected][0].replace("SMARTWORLD ", "") : `${selected.size} projects`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Project</label>
      <button type="button" onClick={() => setOpen(v => !v)} style={{ minWidth: 180, background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 34px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}>
        {label} <span style={{ color: "#B8893C" }}>▾</span>
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

export function TargetActualPage() {
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [periodType, setPeriodType] = useState<PeriodType>("all");
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(1);
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0-indexed into MONTHS_LIST

  function handleReset() {
    setSelectedProjects(new Set());
    setPeriodType("all");
    setSelectedYear(2026);
    setSelectedQuarter(1);
    setSelectedMonth(0);
  }

  return (
    <div className="sw-inv" style={{ minHeight: "100vh" }}>
      {/* Filter bar — same as Overview */}
      <div style={{
        background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)",
        padding: "12px 22px 14px",
        borderBottom: "3px solid var(--gold)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: 14,
      }}>
        {/* Project multi-select */}
        <ProjectDropdown
          projects={TD.projects.map(p => p.name)}
          selected={selectedProjects}
          onChange={setSelectedProjects}
        />

        {/* Period type buttons */}
        <div>
          <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Period</label>
          <div style={{ display: "flex", gap: 5 }}>
            {(["all", "year", "quarter", "month"] as PeriodType[]).map(t => (
              <button key={t} onClick={() => setPeriodType(t)} style={{
                background: periodType === t ? "#B8893C" : "#1D2A4A",
                color: "#fff",
                border: `1px solid ${periodType === t ? "#B8893C" : "#33406B"}`,
                borderRadius: 7,
                padding: "9px 14px",
                fontSize: 12.5,
                fontFamily: "inherit",
                cursor: "pointer",
              }}>
                {t === "all" ? "All time" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Year selector */}
        {periodType !== "all" && (
          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Year</label>
            <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {/* Quarter selector */}
        {periodType === "quarter" && (
          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Quarter</label>
            <select value={selectedQuarter} onChange={e => setSelectedQuarter(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
              {QUARTERS.map((q, i) => <option key={i + 1} value={i + 1}>{q}</option>)}
            </select>
          </div>
        )}

        {/* Month selector */}
        {periodType === "month" && (
          <div>
            <label style={{ display: "block", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "#A9B2C7", marginBottom: 5 }}>Month</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)} style={{ background: "#1D2A4A", color: "#fff", border: "1px solid #33406B", borderRadius: 7, padding: "9px 28px 9px 13px", fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" }}>
              {MONTHS_LIST.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
        )}

        <div style={{ flex: 1 }} />
        <button onClick={handleReset} style={{ background: "none", border: "none", color: "#c7cedf", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", paddingBottom: 9 }}>Reset</button>
      </div>

      {/* Placeholder body */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", flexDirection: "column", gap: 12, color: "#8a8f9e", fontFamily: "Georgia,serif" }}>
        <div style={{ fontSize: 40 }}>🎯</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#14213d" }}>Target vs Actual</div>
        <div style={{ fontSize: 13, color: "#9ca3af" }}>
          {selectedProjects.size > 0 && <span>{selectedProjects.size} project{selectedProjects.size > 1 ? "s" : ""} selected · </span>}
          {periodType === "all" && "All time"}
          {periodType === "year" && `FY ${selectedYear}`}
          {periodType === "quarter" && `Q${selectedQuarter} ${selectedYear}`}
          {periodType === "month" && `${MONTHS_LIST[selectedMonth]} ${selectedYear}`}
        </div>
      </div>
    </div>
  );
}
