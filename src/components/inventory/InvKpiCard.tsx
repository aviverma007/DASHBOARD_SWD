import type { ReactNode } from "react";

interface InvKpiCardProps {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  accentIndex: number; // cycles through the 6-color accent rotation like the source tool
  onClick?: () => void;
}

const ACCENT_COLORS = [
  "var(--color-inv-blue)",
  "var(--color-inv-available)",
  "var(--color-inv-gold)",
  "var(--color-inv-clay)",
  "var(--color-inv-plum)",
  "var(--color-inv-mgmt)",
];

export function InvKpiCard({ label, value, unit, sub, accentIndex, onClick }: InvKpiCardProps) {
  const accent = ACCENT_COLORS[accentIndex % ACCENT_COLORS.length];

  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-inv-line bg-inv-card px-4 py-3.5 text-left transition-shadow hover:shadow-[0_2px_10px_rgba(20,33,61,0.06)]"
      style={{ borderTopWidth: 3, borderTopColor: accent }}
    >
      <div className="flex items-center gap-1 text-xs text-inv-mut">
        {label}
        {onClick && <span style={{ color: "var(--color-inv-gold)" }}>›</span>}
      </div>
      <div
        className="mt-0.5 text-[25px] font-normal tracking-tight text-inv-ink"
        style={{ fontFamily: "var(--font-serif-display)" }}
      >
        {value}
        {unit && <small className="ml-1 text-xs font-normal text-inv-mut">{unit}</small>}
      </div>
      <div className="text-[11.5px] text-inv-mut">{sub}</div>
    </button>
  );
}

export function InvCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3.5 rounded-[13px] border border-inv-line bg-inv-card p-4.5 pb-5 shadow-[var(--shadow-inv-card)] transition-transform hover:-translate-y-px">
      <h3
        className="mb-3 flex items-center gap-2 text-[15px] font-bold text-inv-ink"
        style={{ fontFamily: "var(--font-serif-display)" }}
      >
        <span className="h-0.5 w-3.5 shrink-0" style={{ background: "var(--color-inv-gold)" }} />
        {title}
        {hint && <span className="ml-auto text-[11px] font-medium text-inv-gold">{hint}</span>}
      </h3>
      {children}
    </div>
  );
}
