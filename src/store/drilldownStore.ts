import { create } from "zustand";
import type { DrillPathSegment } from "../types/domain";

interface DrilldownStore {
  isOpen: boolean;
  isFullscreen: boolean;
  path: DrillPathSegment[]; // breadcrumb trail; last item is current level
  kpiContext: "available" | "booked" | "total" | null;

  open: (initialSegment: DrillPathSegment, kpiContext?: "available" | "booked" | "total") => void;
  push: (segment: DrillPathSegment) => void;
  popTo: (index: number) => void; // jump back via breadcrumb click
  close: () => void;
  toggleFullscreen: () => void;
}

export const useDrilldownStore = create<DrilldownStore>((set) => ({
  isOpen: false,
  isFullscreen: false,
  path: [],
  kpiContext: null,

  open: (initialSegment, kpiContext) =>
    set({ isOpen: true, path: [initialSegment], kpiContext: kpiContext ?? null, isFullscreen: false }),

  push: (segment) =>
    set((state) => ({ path: [...state.path, segment] })),

  popTo: (index) =>
    set((state) => ({ path: state.path.slice(0, index + 1) })),

  close: () => set({ isOpen: false, path: [], kpiContext: null, isFullscreen: false }),

  toggleFullscreen: () => set((state) => ({ isFullscreen: !state.isFullscreen })),
}));
