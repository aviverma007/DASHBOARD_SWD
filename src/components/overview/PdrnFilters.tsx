import type { PeriodFilter } from "../../utils/pdrnLogic";

interface PdrnFiltersProps {
  projects: string[]; // all project names
  selectedProject: "all" | string;
  onProjectChange: (p: "all" | string) => void;
  period: PeriodFilter;
  onPeriodChange: (p: PeriodFilter) => void;
  years: number[];
  onReset: () => void;
}

const QUARTERS = ["Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function PdrnFilters({
  projects,
  selectedProject,
  onProjectChange,
  period,
  onPeriodChange,
  years,
  onReset,
}: PdrnFiltersProps) {
  function setPeriodType(type: PeriodFilter["type"]) {
    onPeriodChange({ type, year: period.year ?? years[years.length - 1] });
  }

  function setYear(year: number) {
    onPeriodChange({ ...period, year });
  }

  function setQuarter(q: number) {
    onPeriodChange({ ...period, type: "quarter", quarter: q });
  }

  function setMonth(m: number) {
    onPeriodChange({ ...period, type: "month", month: m });
  }

  return (
    <div
      style={{
        background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)",
        padding: "15px 22px",
        borderBottom: "3px solid var(--gold)",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "flex-end",
        gap: 14,
      }}
    >
      {/* Project filter */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: 10,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "#A9B2C7",
            marginBottom: 5,
          }}
        >
          Project
        </label>
        <select
          value={selectedProject}
          onChange={(e) => onProjectChange(e.target.value as "all" | string)}
          style={{
            appearance: "none",
            background: "#1D2A4A",
            color: "#fff",
            border: "1px solid #33406B",
            borderRadius: 7,
            padding: "9px 34px 9px 13px",
            fontSize: 13.5,
            fontFamily: "inherit",
            cursor: "pointer",
            minWidth: 200,
          }}
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Period type */}
      <div>
        <label
          style={{
            display: "block",
            fontSize: 10,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "#A9B2C7",
            marginBottom: 5,
          }}
        >
          Period
        </label>
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "year", "quarter", "month"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPeriodType(t)}
              style={{
                background: period.type === t ? "#B8893C" : "#1D2A4A",
                color: period.type === t ? "#fff" : "#a9b2c7",
                border: `1px solid ${period.type === t ? "#B8893C" : "#33406B"}`,
                borderRadius: 7,
                padding: "9px 14px",
                fontSize: 12.5,
                fontFamily: "inherit",
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {t === "all" ? "All time" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Year selector (shown unless All) */}
      {period.type !== "all" && (
        <div>
          <label
            style={{
              display: "block",
              fontSize: 10,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "#A9B2C7",
              marginBottom: 5,
            }}
          >
            Year
          </label>
          <select
            value={period.year ?? years[years.length - 1]}
            onChange={(e) => setYear(+e.target.value)}
            style={{
              appearance: "none",
              background: "#1D2A4A",
              color: "#fff",
              border: "1px solid #33406B",
              borderRadius: 7,
              padding: "9px 28px 9px 13px",
              fontSize: 13.5,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Quarter selector */}
      {period.type === "quarter" && (
        <div>
          <label
            style={{
              display: "block",
              fontSize: 10,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "#A9B2C7",
              marginBottom: 5,
            }}
          >
            Quarter
          </label>
          <select
            value={period.quarter ?? 1}
            onChange={(e) => setQuarter(+e.target.value)}
            style={{
              appearance: "none",
              background: "#1D2A4A",
              color: "#fff",
              border: "1px solid #33406B",
              borderRadius: 7,
              padding: "9px 28px 9px 13px",
              fontSize: 13.5,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {QUARTERS.map((q, i) => (
              <option key={i + 1} value={i + 1}>
                {q}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Month selector */}
      {period.type === "month" && (
        <div>
          <label
            style={{
              display: "block",
              fontSize: 10,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: "#A9B2C7",
              marginBottom: 5,
            }}
          >
            Month
          </label>
          <select
            value={period.month ?? 1}
            onChange={(e) => setMonth(+e.target.value)}
            style={{
              appearance: "none",
              background: "#1D2A4A",
              color: "#fff",
              border: "1px solid #33406B",
              borderRadius: 7,
              padding: "9px 28px 9px 13px",
              fontSize: 13.5,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ flex: 1 }} />

      <button
        onClick={onReset}
        style={{
          background: "none",
          border: "none",
          color: "#c7cedf",
          fontSize: 12.5,
          fontFamily: "inherit",
          cursor: "pointer",
          paddingBottom: 9,
        }}
      >
        Reset
      </button>
    </div>
  );
}
