import { useCallback, useEffect, useRef, useState } from "react";
import { fallbackData } from "../data/fallback";
import { simulateAdvancement, simulateChampionship } from "../lib/analytics";
import type { GoalEvent, GoalWithImpact, Match, TournamentData } from "../types";

const POLL_INTERVAL = 45_000;
const MAX_GOAL_HISTORY = 10;

export function getTournamentAvailabilityMessage(hasLiveSnapshot: boolean) {
  return hasLiveSnapshot
    ? "Live updates are temporarily paused. Showing the most recent update."
    : "Live updates are temporarily paused. You can continue with the saved tournament snapshot.";
}

function detectGoals(prev: Map<string, Match>, next: Match[]): GoalEvent[] {
  const events: GoalEvent[] = [];
  for (const match of next) {
    if (match.status === "scheduled") continue;
    const prevMatch = prev.get(match.id);
    if (!prevMatch) continue;
    const prevTotal = prevMatch.homeScore + prevMatch.awayScore;
    const nextTotal = match.homeScore + match.awayScore;
    if (nextTotal <= prevTotal) continue;
    const now = new Date().toISOString();
    if (match.homeScore > prevMatch.homeScore) {
      events.push({
        matchId: match.id,
        homeName: match.homeName,
        awayName: match.awayName,
        scorerTeam: "home",
        scoreBefore: { home: prevMatch.homeScore, away: prevMatch.awayScore },
        scoreAfter: { home: match.homeScore, away: match.awayScore },
        minute: match.minute,
        detectedAt: now,
      });
    }
    if (match.awayScore > prevMatch.awayScore) {
      events.push({
        matchId: match.id,
        homeName: match.homeName,
        awayName: match.awayName,
        scorerTeam: "away",
        scoreBefore: { home: prevMatch.homeScore, away: prevMatch.awayScore },
        scoreAfter: { home: match.homeScore, away: match.awayScore },
        minute: match.minute,
        detectedAt: now,
      });
    }
  }
  return events;
}

async function fireNotification(event: GoalEvent) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  if (Notification.permission !== "granted") return;
  const scorer = event.scorerTeam === "home" ? event.homeName : event.awayName;
  new Notification(
    `GOAL! ${event.homeName} ${event.scoreAfter.home}-${event.scoreAfter.away} ${event.awayName}`,
    {
      body: `${event.minute}' — ${scorer} score! Tap to view analysis.`,
      icon: "/favicon.ico",
      tag: `goal-${event.matchId}-${event.scoreAfter.home}-${event.scoreAfter.away}`,
    },
  );
}

export function useTournamentData() {
  const [data, setData] = useState<TournamentData>(fallbackData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [latestGoal, setLatestGoal] = useState<GoalEvent | null>(null);
  const [goalHistory, setGoalHistory] = useState<GoalWithImpact[]>([]);

  const prevMatchesRef = useRef<Map<string, Match>>(new Map());
  const prevAdvancementRef = useRef<Map<string, number>>(new Map());
  const prevChampionshipRef = useRef<Map<string, number>>(new Map());
  const isFirstPollRef = useRef(true);

  const refresh = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    try {
      const response = await fetch("/api/tournament", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Tournament data is unavailable");
      const payload = (await response.json()) as TournamentData;
      setData(payload);

      const goals = detectGoals(prevMatchesRef.current, payload.matches);
      const nextMatchMap = new Map(payload.matches.map((m) => [m.id, m]));
      const currentAdv = simulateAdvancement(payload.groups, payload.matches, payload.teams);
      const currentChamp = simulateChampionship(payload.groups, payload.matches, payload.teams);

      if (!isFirstPollRef.current && goals.length > 0) {
        const advBefore = new Map(prevAdvancementRef.current);
        const champBefore = new Map(prevChampionshipRef.current);
        const newItems: GoalWithImpact[] = goals.map((event) => ({
          event,
          advancementBefore: advBefore,
          advancementAfter: new Map(currentAdv),
          championshipBefore: champBefore,
          championshipAfter: new Map(currentChamp),
        }));
        setGoalHistory((prev) => [...newItems.reverse(), ...prev].slice(0, MAX_GOAL_HISTORY));
        setLatestGoal(goals[goals.length - 1]);
        for (const goal of goals) {
          void fireNotification(goal);
        }
      }

      prevMatchesRef.current = nextMatchMap;
      prevAdvancementRef.current = currentAdv;
      prevChampionshipRef.current = currentChamp;
      isFirstPollRef.current = false;
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

  return {
    data,
    loading,
    refreshing,
    refresh: () => refresh(true),
    latestGoal,
    goalHistory,
  };
}
