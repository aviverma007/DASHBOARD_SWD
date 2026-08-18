import { useEffect, useState } from "react";
import { useFilterStore } from "../store/filterStore";
import { getInventoryTotals, getProjectContributions } from "../services/inventoryService";
import type { InventoryTotals } from "../utils/calculations";
import type { ProjectContribution } from "../types/domain";

/**
 * Re-fetches inventory totals and project contributions whenever the
 * project selection changes. Period filtering against real historical
 * snapshots is not yet wired to mock data (mock data is a single
 * point-in-time snapshot) — see open assumption on period granularity.
 */
export function useScopedData() {
  const projects = useFilterStore((s) => s.projects);
  const [totals, setTotals] = useState<InventoryTotals | null>(null);
  const [contributions, setContributions] = useState<ProjectContribution[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    Promise.all([getInventoryTotals(projects), getProjectContributions(projects)]).then(
      ([totalsResult, contributionsResult]) => {
        if (!cancelled) {
          setTotals(totalsResult);
          setContributions(contributionsResult);
          setIsLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [projects]);

  return { totals, contributions, isLoading };
}
