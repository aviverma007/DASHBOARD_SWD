import { X, RotateCcw } from "lucide-react";
import { ProjectFilter } from "./ProjectFilter";
import { PeriodFilter } from "./PeriodFilter";
import { useFilterStore } from "../../store/filterStore";

export function FilterBar() {
  const { crossFilters, removeCrossFilter, clearCrossFilters, resetAll } = useFilterStore();

  return (
    <div className="border-b border-border-subtle bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <ProjectFilter />
        <PeriodFilter />

        <div className="flex-1" />

        <button
          onClick={resetAll}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-charcoal-soft hover:bg-surface"
        >
          <RotateCcw size={13} />
          Reset dashboard
        </button>
      </div>

      {crossFilters.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-charcoal-soft">Active filters:</span>
          {crossFilters.map((filter) => (
            <span
              key={filter.id}
              className="flex items-center gap-1.5 rounded-full bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal-dark"
            >
              {filter.label}
              <button
                onClick={() => removeCrossFilter(filter.id)}
                aria-label={`Remove filter ${filter.label}`}
                className="rounded-full hover:bg-teal/20"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            onClick={clearCrossFilters}
            className="text-xs font-medium text-charcoal-soft underline hover:text-charcoal"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
