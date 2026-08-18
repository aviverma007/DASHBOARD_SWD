export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

export function formatArea(value: number): string {
  // sq ft, Indian numbering convention
  if (value >= 100000) {
    return `${(value / 100000).toFixed(2)} L sqft`;
  }
  return `${formatNumber(value)} sqft`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatChange(value: number | undefined, decimals = 1): string | null {
  if (value === undefined || Number.isNaN(value)) return null;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Matches the source tool's CR() formatter: crore-denominated currency,
 * e.g. ₹9,822 Cr for large totals or ₹1.5 Cr for single-unit values. */
export function formatCrore(rupees: number): string {
  const crores = rupees / 1e7;
  const display = crores >= 100 ? Math.round(crores).toLocaleString("en-IN") : crores.toFixed(1);
  return `₹${display} Cr`;
}

export function formatRupees(rupees: number): string {
  return `₹${Math.round(rupees).toLocaleString("en-IN")}`;
}

export function formatRatePerSqft(rupees: number, area: number): string {
  if (!area) return "—";
  return `₹${Math.round(rupees / area).toLocaleString("en-IN")} / sq ft`;
}
