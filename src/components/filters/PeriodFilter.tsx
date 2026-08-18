import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useFilterStore } from "../../store/filterStore";
import type { PeriodGranularity } from "../../types/domain";

const GRANULARITY_LABELS: Record<PeriodGranularity, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

// ASSUMPTION: values below are placeholders. Financial-year convention
// (Apr-Mar vs calendar year) is unconfirmed for this project — see
// blueprint Section 14.
const PERIOD_VALUES: Record<PeriodGranularity, string[]> = {
  monthly: ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"],
  quarterly: ["FY2026-Q1", "FY2026-Q2", "FY2026-Q3", "FY2026-Q4"],
  yearly: ["FY2025", "FY2026", "FY2027"],
};

export function PeriodFilter() {
  const { period, setPeriod } = useFilterStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function setGranularity(granularity: PeriodGranularity) {
    setPeriod({ granularity, value: PERIOD_VALUES[granularity][PERIOD_VALUES[granularity].length - 1] });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm font-medium text-charcoal hover:border-brand-blue/40"
      >
        <span>{period.value}</span>
        <ChevronDown size={15} className="text-charcoal-soft" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-40 mt-1.5 w-56 rounded-xl border border-border-subtle bg-white p-2 shadow-lg">
          <div className="flex gap-1 rounded-lg bg-surface p-1">
            {(Object.keys(GRANULARITY_LABELS) as PeriodGranularity[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                  period.granularity === g
                    ? "bg-white text-brand-blue shadow-sm"
                    : "text-charcoal-soft hover:text-charcoal"
                }`}
              >
                {GRANULARITY_LABELS[g]}
              </button>
            ))}
          </div>

          <div className="mt-1.5 max-h-56 overflow-y-auto scrollbar-thin">
            {PERIOD_VALUES[period.granularity].map((value) => (
              <button
                key={value}
                onClick={() => {
                  setPeriod({ granularity: period.granularity, value });
                  setIsOpen(false);
                }}
                className={`block w-full rounded-lg px-2.5 py-2 text-left text-sm ${
                  period.value === value ? "bg-brand-blue/10 font-medium text-brand-blue" : "text-charcoal hover:bg-surface"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
