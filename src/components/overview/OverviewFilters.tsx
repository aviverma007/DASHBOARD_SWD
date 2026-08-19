import { useEffect, useRef, useState } from "react";
import { useFilterStore } from "../../store/filterStore";
import { getProjectList } from "../../services/inventoryService";

interface ProjectOption {
  id: string;
  name: string;
}

const PERIOD_VALUES = ["FY2025", "FY2026", "FY2027"];

/**
 * Overview's filter bar, restyled to match Inventory's navy gradient bar
 * (SwFilters.tsx) — same markup classes (.filters/.filt/.msbtn/.mspanel/
 * select), same underlying data and functionality as the original
 * Tailwind FilterBar (Project selection via filterStore, Period value,
 * Reset dashboard). No new filters introduced.
 */
export function OverviewFilters() {
  const { projects, setProjects, period, setPeriod, resetAll } = useFilterStore();
  const [options, setOptions] = useState<ProjectOption[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const msRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getProjectList().then(setOptions);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (msRef.current && !msRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedIds = projects === "ALL" ? options.map((o) => o.id) : projects;

  function toggleProject(id: string) {
    if (projects === "ALL") {
      setProjects(options.map((o) => o.id).filter((oid) => oid !== id));
      return;
    }
    if (projects.includes(id)) {
      setProjects(projects.filter((pid) => pid !== id));
    } else {
      const next = [...projects, id];
      setProjects(next.length === options.length ? "ALL" : next);
    }
  }

  function selectAll() {
    setProjects("ALL");
  }

  const projectLabel =
    projects === "ALL"
      ? "All projects"
      : projects.length === 0
      ? "No projects selected"
      : projects.length === 1
      ? options.find((o) => o.id === projects[0])?.name ?? "1 project"
      : `${projects.length} projects`;

  return (
    <div
      className="flex flex-wrap items-end gap-3.5 px-5 py-4"
      style={{ background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)" }}
    >
      <div className="relative" ref={msRef}>
        <label className="mb-1 block text-[10px] uppercase tracking-[1.5px] text-[#A9B2C7]">
          Project
        </label>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="min-w-[180px] rounded-lg border border-[#33406B] bg-[#1D2A4A] px-3.5 py-2 text-left text-[13.5px] text-white hover:border-[#B8893C]"
        >
          {projectLabel} <span style={{ color: "#B8893C" }}>▾</span>
        </button>

        {panelOpen && (
          <div className="absolute top-[calc(100%+6px)] left-0 z-50 min-w-[260px] max-h-[340px] overflow-auto rounded-[9px] border border-[#e4e0d6] bg-white p-2 shadow-[0_12px_34px_rgba(20,33,61,0.2)]">
            <label className="mb-1.5 flex items-center gap-2.5 rounded-md border-b border-[#e4e0d6] px-2.5 py-1.5 pb-2.5 font-semibold text-[#14213D]">
              <input
                type="checkbox"
                checked={projects === "ALL"}
                onChange={selectAll}
                className="h-[15px] w-[15px] accent-[#B8893C]"
              />
              All projects
            </label>
            {options.map((option) => (
              <label
                key={option.id}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-[#14213D] hover:bg-[#FBFAF5]"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(option.id)}
                  onChange={() => toggleProject(option.id)}
                  className="h-[15px] w-[15px] accent-[#B8893C]"
                />
                {option.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-[1.5px] text-[#A9B2C7]">
          Period
        </label>
        <select
          value={period.value}
          onChange={(e) => setPeriod({ granularity: "yearly", value: e.target.value })}
          className="min-w-[130px] rounded-lg border border-[#33406B] bg-[#1D2A4A] px-3.5 py-2 text-[13.5px] text-white"
        >
          {PERIOD_VALUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={resetAll}
        className="pb-2 text-[12.5px] font-medium text-[#c7cedf] hover:text-[#B8893C]"
      >
        Reset dashboard
      </button>
    </div>
  );
}
