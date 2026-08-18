import { useEffect, useState } from "react";
import { getDataFreshness } from "../services/inventoryService";
import type { DataFreshness } from "../types/domain";

export function useDataFreshness() {
  const [data, setData] = useState<DataFreshness | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDataFreshness().then((result) => {
      if (!cancelled) {
        setData(result);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading };
}
