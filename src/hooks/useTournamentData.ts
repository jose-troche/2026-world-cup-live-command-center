import { useCallback, useEffect, useState } from "react";
import { fallbackData } from "../data/fallback";
import type { TournamentData } from "../types";

const POLL_INTERVAL = 45_000;

export function getTournamentAvailabilityMessage(hasLiveSnapshot: boolean) {
  return hasLiveSnapshot
    ? "Live updates are temporarily paused. Showing the most recent update."
    : "Live updates are temporarily paused. You can continue with the saved tournament snapshot.";
}

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
      if (!response.ok) throw new Error("Tournament data is unavailable");
      const payload = (await response.json()) as TournamentData;
      setData(payload);
    } catch {
      setData((current) => ({
        ...current,
        source: current.source === "live" ? "live" : "fallback",
        warning: getTournamentAvailabilityMessage(current.source === "live"),
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
