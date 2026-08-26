import { useEffect, useRef, useState } from "react";
import { DATA_AS_ON } from "../../config/dataInfo";

interface PdrnFiltersProps {
  projects: string[];
  selectedProjects: Set<string>;          // empty = All
  onProjectsChange: (s: Set<string>) => void;
  locations: string[];
  location: string;                       // "" = All locations
  onLocationChange: (loc: string) => void;
  onReset: () => void;
}

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
const LBL: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  letterSpacing: "1.5px",
  textTransform: "uppercase" as const,
  color: "#A9B2C7",
  marginBottom: 5,
};

export function PdrnFilters({ projects, selectedProjects, onProjectsChange, locations, location, onLocationChange, onReset }: PdrnFiltersProps) {
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
      {/* Location — single-select, placed before Project since it narrows it */}
      <div>
        <label style={LBL}>Location</label>
        <select
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          style={{ ...PILL, minWidth: 140 }}
        >
          <option value="">All locations</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
      </div>

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

      <div style={{ flex: 1 }} />
      <span style={{ color: "#c7cedf", fontSize: 12.5, paddingBottom: 8, marginRight: 14 }}>Data as on <strong style={{ color: "#fff", fontWeight: 600 }}>{DATA_AS_ON}</strong></span>
      <button onClick={onReset} style={{
        background:"none", border:"none", color:"#c7cedf",
        fontSize:12.5, fontFamily:"inherit", cursor:"pointer", paddingBottom:8,
      }}>Reset</button>
    </div>
  );
}
