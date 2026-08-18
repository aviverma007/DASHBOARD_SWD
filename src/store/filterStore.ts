import { create } from "zustand";
import type { FilterState, CrossFilter, ProjectSelection, PeriodFilter } from "../types/filters";

interface FilterStore extends FilterState {
  setGroup: (groupId: string | null) => void;
  setProjects: (projects: ProjectSelection) => void;
  setPeriod: (period: PeriodFilter) => void;
  addCrossFilter: (filter: Omit<CrossFilter, "id">) => void;
  removeCrossFilter: (id: string) => void;
  clearCrossFilters: () => void;
  resetAll: () => void;
}

const DEFAULT_STATE: FilterState = {
  groupId: null,
  projects: "ALL",
  period: { granularity: "yearly", value: "FY2026" },
  crossFilters: [],
};

export const useFilterStore = create<FilterStore>((set) => ({
  ...DEFAULT_STATE,

  setGroup: (groupId) => set({ groupId }),
  setProjects: (projects) => set({ projects }),
  setPeriod: (period) => set({ period }),

  addCrossFilter: (filter) =>
    set((state) => {
      // Replace any existing cross-filter on the same dimension rather
      // than stacking duplicates (e.g. clicking a different project bar
      // should replace, not add to, the previous project cross-filter).
      const withoutSameDimension = state.crossFilters.filter(
        (f) => f.dimension !== filter.dimension
      );
      const id = `${filter.dimension}-${filter.value}-${Date.now()}`;
      return { crossFilters: [...withoutSameDimension, { ...filter, id }] };
    }),

  removeCrossFilter: (id) =>
    set((state) => ({
      crossFilters: state.crossFilters.filter((f) => f.id !== id),
    })),

  clearCrossFilters: () => set({ crossFilters: [] }),

  resetAll: () => set(DEFAULT_STATE),
}));
