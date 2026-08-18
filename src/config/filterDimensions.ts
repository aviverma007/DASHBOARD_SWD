import type { FilterDimensionConfig } from "../types/filters";

/**
 * New filterable dimensions get added here, not by writing new
 * filter-bar components. `enabled: false` entries are visible in the
 * spec but intentionally not wired up yet — placeholders for Section 7
 * of the requirements ("Later we may add...").
 */
export const FILTER_DIMENSIONS: FilterDimensionConfig[] = [
  { key: "group", label: "Group", enabled: true },
  { key: "project", label: "Project", enabled: true },
  { key: "period", label: "Period", enabled: true },
  { key: "dateRange", label: "Date Range", enabled: false },
  { key: "financialYear", label: "Financial Year", enabled: false },
  { key: "tower", label: "Tower", appliesToLevel: "tower", enabled: false },
  { key: "phase", label: "Phase", enabled: false },
  { key: "unitType", label: "Unit Type", enabled: false },
  { key: "configuration", label: "Configuration", enabled: false },
  { key: "salesStatus", label: "Sales Status", enabled: false },
  { key: "geography", label: "Geography", enabled: false },
  { key: "channel", label: "Channel", enabled: false },
  { key: "customerCategory", label: "Customer Category", enabled: false },
];
