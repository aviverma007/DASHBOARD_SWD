import { useEffect, useRef, useState } from "react";

interface InvFilterBarProps {
  projectNames: string[];
  selectedProjects: Set<number>;
  onToggleProject: (index: number) => void;
  onSelectAllProjects: () => void;
  status: "all" | "available" | "booked" | "management";
  onStatusChange: (status: "all" | "available" | "booked" | "management") => void;
  category: "all" | "residential" | "commercial";
  onCategoryChange: (category: "all" | "residential" | "commercial") => void;
}

export function InvFilterBar({
  projectNames,
  selectedProjects,
  onToggleProject,
  onSelectAllProjects,
  status,
  onStatusChange,
  category,
  onCategoryChange,
}: InvFilterBarProps) {
  const [projectPanelOpen, setProjectPanelOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setProjectPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const projectLabel = selectedProjects.size ? `${selectedProjects.size} selected` : "All projects";

  return (
    <div
      className="flex flex-wrap items-end gap-3.5 px-5 py-4"
      style={{ background: "linear-gradient(115deg,#111C36 0%,#1E3163 55%,#2A4488 100%)" }}
    >
      <div className="relative" ref={containerRef}>
        <label className="mb-1 block text-[10px] uppercase tracking-[1.5px] text-[#A9B2C7]">
          Project
        </label>
        <button
          onClick={() => setProjectPanelOpen((v) => !v)}
          className="min-w-[180px] rounded-lg border border-[#33406B] bg-[#1D2A4A] px-3.5 py-2 text-left text-[13.5px] text-white hover:border-inv-gold"
        >
          {projectLabel} <span className="text-inv-gold">▾</span>
        </button>

        {projectPanelOpen && (
          <div className="absolute top-[calc(100%+6px)] left-0 z-50 min-w-[260px] max-h-[340px] overflow-auto rounded-[9px] border border-inv-line bg-white p-2 shadow-[0_12px_34px_rgba(20,33,61,0.2)]">
            <label className="mb-1.5 flex items-center gap-2.5 rounded-md border-b border-inv-line px-2.5 py-1.5 pb-2.5 font-semibold text-inv-ink">
              <input
                type="checkbox"
                checked={selectedProjects.size === 0}
                onChange={onSelectAllProjects}
                className="h-[15px] w-[15px] accent-inv-gold"
              />
              All projects
            </label>
            {projectNames.map((name, i) => (
              <label
                key={name}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-inv-ink hover:bg-[#FBFAF5]"
              >
                <input
                  type="checkbox"
                  checked={selectedProjects.has(i)}
                  onChange={() => onToggleProject(i)}
                  className="h-[15px] w-[15px] accent-inv-gold"
                />
                {name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-[1.5px] text-[#A9B2C7]">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value as typeof status)}
          className="min-w-[150px] rounded-lg border border-[#33406B] bg-[#1D2A4A] px-3.5 py-2 text-[13.5px] text-white"
        >
          <option value="all">All</option>
          <option value="available">Available</option>
          <option value="booked">Booked</option>
          <option value="management">Management</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-[1.5px] text-[#A9B2C7]">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as typeof category)}
          className="min-w-[150px] rounded-lg border border-[#33406B] bg-[#1D2A4A] px-3.5 py-2 text-[13.5px] text-white"
        >
          <option value="all">All</option>
          <option value="residential">Residential</option>
          <option value="commercial">Commercial</option>
        </select>
      </div>
    </div>
  );
}
