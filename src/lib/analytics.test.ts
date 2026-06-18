import { describe, expect, it } from "vitest";
import { buildXgRace, computeHypeScore, expectedGoals, getRating, getTeamMetrics, winProbability } from "./analytics";
import type { Match, Team } from "../types";

const baseMatch: Match = {
  id: "test",
  homeId: "1",
  awayId: "2",
  homeName: "Brazil",
  awayName: "Haiti",
  homeScore: 0,
  awayScore: 0,
  group: "C",
  matchday: 1,
  localDate: "06/13/2026 18:00",
  stadiumId: "1",
  status: "scheduled",
  minute: 0,
  type: "group",
};

describe("analytics model", () => {
  it("rates known contenders above unseeded teams", () => {
    expect(getRating("Brazil")).toBeGreaterThan(getRating("Haiti"));
  });

  it("gives the stronger team more expected goals", () => {
    const xg = expectedGoals("Brazil", "Haiti");
    expect(xg.home).toBeGreaterThan(xg.away);
  });

  it("returns normalized probabilities", () => {
    const probability = winProbability(baseMatch);
    expect(probability.home + probability.draw + probability.away).toBeCloseTo(1, 4);
    expect(probability.home).toBeGreaterThan(probability.away);
  });

  it("returns certainty for a finished match", () => {
    const finished: Match = { ...baseMatch, status: "finished", homeScore: 2, awayScore: 1 };
    expect(winProbability(finished)).toEqual({ home: 1, draw: 0, away: 0 });
  });
});

describe("getTeamMetrics", () => {
  const team: Team = { id: "1", name: "Brazil", code: "BRA", iso2: "BR", flag: "", group: "C" };

  it("returns rating matching getRating", () => {
    expect(getTeamMetrics(team).rating).toBe(getRating("Brazil"));
  });

  it("returns all metrics within the valid 55–96 range", () => {
    const metrics = getTeamMetrics(team);
    for (const key of ["attack", "defense", "control", "transition", "setPieces", "form"] as const) {
      expect(metrics[key]).toBeGreaterThanOrEqual(55);
      expect(metrics[key]).toBeLessThanOrEqual(96);
    }
  });

  it("is deterministic for the same team", () => {
    expect(getTeamMetrics(team)).toEqual(getTeamMetrics(team));
  });
});

describe("buildXgRace", () => {
  it("starts at minute 0 with all zeros", () => {
    const first = buildXgRace(baseMatch)[0];
    expect(first).toEqual({ minute: 0, projHome: 0, projAway: 0, actualHome: 0, actualAway: 0 });
  });

  it("increments actualHome when there are goals", () => {
    const match: Match = { ...baseMatch, status: "finished", homeScore: 2, awayScore: 0, minute: 90 };
    const points = buildXgRace(match);
    const last = points[points.length - 1];
    expect(last.actualHome).toBe(2);
    expect(last.actualAway).toBe(0);
  });

  it("produces monotonically non-decreasing projected xG", () => {
    const points = buildXgRace({ ...baseMatch, status: "finished", minute: 90 });
    for (let i = 1; i < points.length; i++) {
      expect(points[i].projHome).toBeGreaterThanOrEqual(points[i - 1].projHome);
    }
  });
});

describe("computeHypeScore", () => {
  it("returns a value between 0 and 100", () => {
    const score = computeHypeScore(baseMatch, new Map());
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("inflates the score for live matches vs scheduled", () => {
    const liveMatch: Match = { ...baseMatch, status: "live", minute: 45 };
    const liveScore = computeHypeScore(liveMatch, new Map());
    const scheduledScore = computeHypeScore(baseMatch, new Map());
    expect(liveScore).toBeGreaterThan(scheduledScore);
  });

  it("scores an evenly matched high-quality game higher than a mismatch", () => {
    const evenMatch: Match = { ...baseMatch, homeName: "Brazil", awayName: "Argentina" };
    const mismatch: Match = { ...baseMatch, homeName: "Brazil", awayName: "Haiti" };
    expect(computeHypeScore(evenMatch, new Map())).toBeGreaterThan(computeHypeScore(mismatch, new Map()));
  });
});
