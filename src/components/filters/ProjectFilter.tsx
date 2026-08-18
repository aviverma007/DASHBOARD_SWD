import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { useFilterStore } from "../../store/filterStore";
import { getProjectList } from "../../services/inventoryService";

interface ProjectOption {
  id: string;
  name: string;
}

export function ProjectFilter() {
  const { projects, setProjects } = useFilterStore();
  const [options, setOptions] = useState<ProjectOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getProjectList().then(setOptions);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIds = projects === "ALL" ? options.map((o) => o.id) : projects;
  const filteredOptions = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggleProject(id: string) {
    if (projects === "ALL") {
      // Deselecting from "All" starts an explicit list without this one.
      setProjects(options.map((o) => o.id).filter((oid) => oid !== id));
      return;
    }
    if (projects.includes(id)) {
      const next = projects.filter((pid) => pid !== id);
      setProjects(next.length === 0 ? [] : next);
    } else {
      const next = [...projects, id];
      setProjects(next.length === options.length ? "ALL" : next);
    }
  }

  function selectAll() {
    setProjects("ALL");
  }

  function clearAll() {
    setProjects([]);
  }

  const label =
    projects === "ALL"
      ? "All Projects"
      : projects.length === 0
      ? "No projects selected"
      : projects.length === 1
      ? options.find((o) => o.id === projects[0])?.name ?? "1 project"
      : `${projects.length} projects`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm font-medium text-charcoal hover:border-brand-blue/40"
      >
        <span className="max-w-[160px] truncate">{label}</span>
        <ChevronDown size={15} className="text-charcoal-soft" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-40 mt-1.5 w-72 rounded-xl border border-border-subtle bg-white p-2 shadow-lg">
          <div className="flex items-center gap-2 rounded-lg border border-border-subtle px-2.5 py-1.5">
            <Search size={14} className="text-charcoal-soft" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full text-sm outline-none"
            />
          </div>

          <div className="mt-2 flex items-center justify-between px-1 text-xs">
            <button onClick={selectAll} className="font-medium text-brand-blue hover:underline">
              Select all
            </button>
            <button onClick={clearAll} className="font-medium text-charcoal-soft hover:underline">
              Clear selection
            </button>
          </div>

          <div className="mt-1.5 max-h-64 overflow-y-auto scrollbar-thin">
            {filteredOptions.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  onClick={() => toggleProject(option.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected ? "border-brand-blue bg-brand-blue" : "border-border-subtle"
                    }`}
                  >
                    {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                  </span>
                  <span className="truncate text-charcoal">{option.name}</span>
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <p className="px-2.5 py-3 text-sm text-charcoal-soft">No projects match “{search}”.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
