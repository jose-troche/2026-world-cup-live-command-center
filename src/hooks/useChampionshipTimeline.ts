import { useEffect, useState } from "react";

export type TimelineSnapshot = {
  matchId: string;
  matchLabel: string;
  timestamp: string;
  probabilities: [string, number][];
};

type TimelineData = {
  snapshots: TimelineSnapshot[];
  loading: boolean;
};

export function useChampionshipTimeline(): TimelineData {
  const [snapshots, setSnapshots] = useState<TimelineSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/championship-timeline")
      .then((r) => r.json())
      .then((data) => {
        const typed = data as { snapshots: TimelineSnapshot[] };
        setSnapshots(typed.snapshots ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { snapshots, loading };
}
