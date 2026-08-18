import { ArrowUp, ArrowDown, Info } from "lucide-react";
import type { KpiResult } from "../../types/domain";
import { formatNumber, formatArea, formatPercent, formatChange } from "../../utils/format";
import { useState } from "react";

interface KpiCardProps {
  kpi: KpiResult;
  accent: "teal" | "amber" | "navy";
  onClick?: () => void;
  definition?: string;
}

const ACCENT_STYLES = {
  teal: { bar: "bg-teal", text: "text-teal-dark", chip: "bg-teal/10" },
  amber: { bar: "bg-amber", text: "text-amber-dark", chip: "bg-amber/10" },
  navy: { bar: "bg-navy", text: "text-navy", chip: "bg-navy/10" },
};

export function KpiCard({ kpi, accent, onClick, definition }: KpiCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const styles = ACCENT_STYLES[accent];
  const change = formatChange(kpi.changePercent);
  const isPositive = (kpi.changePercent ?? 0) >= 0;

  return (
    <button
      onClick={onClick}
      className="group relative flex w-full flex-col rounded-2xl border border-border-subtle bg-white p-4 text-left shadow-card transition-shadow hover:shadow-md"
    >
      <span className={`absolute inset-x-0 top-0 h-1 rounded-t-2xl ${styles.bar}`} aria-hidden="true" />

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wide text-charcoal-soft">
          {kpi.label}
        </span>
        {definition && (
          <span
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <Info size={14} className="text-charcoal-soft/60" />
            {showTooltip && (
              <span className="absolute right-0 top-6 z-10 w-56 rounded-lg bg-charcoal p-2.5 text-xs font-normal normal-case text-white shadow-lg">
                {definition}
              </span>
            )}
          </span>
        )}
      </div>

      <div className="num mt-2 text-3xl font-bold text-charcoal">
        {formatNumber(kpi.units)}
        <span className="ml-1.5 text-sm font-medium text-charcoal-soft">units</span>
      </div>

      <div className="num mt-1 text-sm text-charcoal-soft">{formatArea(kpi.area)}</div>

      <div className="mt-3 flex items-center gap-2">
        <span className={`num rounded-full px-2 py-0.5 text-xs font-bold ${styles.chip} ${styles.text}`}>
          {formatPercent(kpi.percentage)}
        </span>
        {change && (
          <span
            className={`num flex items-center gap-0.5 text-xs font-medium ${
              isPositive ? "text-teal-dark" : "text-critical"
            }`}
          >
            {isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {change} vs prev period
          </span>
        )}
      </div>
    </button>
  );
}
