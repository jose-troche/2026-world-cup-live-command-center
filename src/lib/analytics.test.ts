import { describe, expect, it } from "vitest";
import { expectedGoals, getRating, winProbability } from "./analytics";
import type { Match } from "../types";

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
});
