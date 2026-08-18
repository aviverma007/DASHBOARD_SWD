import type { DrillLevel, PeriodGranularity } from "./domain";

export type ProjectSelection = "ALL" | string[];

export interface PeriodFilter {
  granularity: PeriodGranularity;
  value: string; // e.g. "2026-08" | "FY2026-Q2" | "FY2026"
}

/** A cross-filter is any filter that originated from an interaction
 * (clicking a KPI, chart segment, or table row) rather than from the
 * filter bar itself. Kept separate from base filters so "Clear all
 * cross-filters" can reset interactions without touching Group/Project/Period. */
export interface CrossFilter {
  id: string; // unique per active cross-filter, used for chip removal
  source: "kpi" | "chart" | "table" | "drilldown";
  dimension: string; // e.g. "project", "tower", "status"
  value: string;
  label: string; // display label for the chip
}

export interface FilterState {
  groupId: string | null;
  projects: ProjectSelection;
  period: PeriodFilter;
  crossFilters: CrossFilter[];
}

/** Describes a filterable dimension so new dimensions (Tower, Unit Type,
 * Sales Status, etc.) can be added via config rather than new components. */
export interface FilterDimensionConfig {
  key: string;
  label: string;
  appliesToLevel?: DrillLevel;
  enabled: boolean; // false = defined but not yet wired up
}
