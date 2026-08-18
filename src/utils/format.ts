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
