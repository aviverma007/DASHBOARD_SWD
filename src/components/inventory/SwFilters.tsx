import { useEffect, useRef, useState } from "react";
import { CAT } from "../../utils/smartworldLogic";
import type { FilterState } from "../../types/smartworldRaw";

interface SwFiltersProps {
  P: string[];
  CFG: string[];
  state: FilterState;
  onChangeState: (next: FilterState) => void;
}

/** Direct port of renderFilters() — Project multi-select + Status/Category/Configuration selects. */
export function SwFilters({ P, CFG, state, onChangeState }: SwFiltersProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const msRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (msRef.current && !msRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleProject(i: number, checked: boolean) {
    const nextProj = new Set(state.proj);
    if (checked) nextProj.add(i);
    else nextProj.delete(i);
    onChangeState({ ...state, proj: nextProj });
  }

  function selectAllProjects() {
    onChangeState({ ...state, proj: new Set() });
  }

  return (
    <div className="filters">
      <div className="filt">
        <label>Project</label>
        <div className="ms" ref={msRef}>
          <button
            className="msbtn"
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
          >
            {state.proj.size ? `${state.proj.size} selected` : "All projects"}{" "}
            <span style={{ color: "var(--gold)" }}>▾</span>
          </button>
          <div className={`mspanel${panelOpen ? " open" : ""}`}>
            <label className="msi msall">
              <input
                type="checkbox"
                checked={state.proj.size === 0}
                onChange={selectAllProjects}
              />
              All projects
            </label>
            {P.map((n, i) => (
              <label className="msi" key={n}>
                <input
                  type="checkbox"
                  className="pc"
                  checked={state.proj.has(i)}
                  onChange={(e) => toggleProject(i, e.target.checked)}
                />
                {n}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="filt">
        <label>Status</label>
        <select
          value={state.status}
          onChange={(e) => onChangeState({ ...state, status: e.target.value as FilterState["status"] })}
        >
          <option value="all">All</option>
          <option value="av">Available</option>
          <option value="bk">Booked</option>
          <option value="blk">Management unit</option>
        </select>
      </div>

      <div className="filt">
        <label>Category</label>
        <select
          value={state.cat}
          onChange={(e) => onChangeState({ ...state, cat: +e.target.value })}
        >
          <option value={-1}>All</option>
          {CAT.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="filt">
        <label>Configuration</label>
        <select
          value={state.cfg}
          onChange={(e) => onChangeState({ ...state, cfg: +e.target.value })}
        >
          <option value={-1}>All</option>
          {CFG.map((n, i) => (
            <option key={n} value={i}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
