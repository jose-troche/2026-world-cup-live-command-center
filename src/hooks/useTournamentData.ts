import { useCallback, useEffect, useState } from "react";
import { fallbackData } from "../data/fallback";
import type { TournamentData } from "../types";

const POLL_INTERVAL = 45_000;

export function useTournamentData() {
  const [data, setData] = useState<TournamentData>(fallbackData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    try {
      const response = await fetch("/api/tournament", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Tournament API returned ${response.status}`);
      const payload = (await response.json()) as TournamentData;
      setData(payload);
    } catch (error) {
      setData((current) => ({
        ...current,
        source: current.source === "live" ? "live" : "fallback",
        warning:
          current.source === "live"
            ? "Refresh missed. Retaining the last successful live snapshot."
            : error instanceof Error
              ? error.message
              : fallbackData.warning,
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(true), POLL_INTERVAL);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { data, loading, refreshing, refresh: () => refresh(true) };
}
