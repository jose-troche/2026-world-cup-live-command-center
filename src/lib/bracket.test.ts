import { describe, expect, it } from "vitest";
import type { Team } from "../types";
import { fallbackTeams } from "../data/fallback";
import {
  buildDefaultGroupSelections,
  getQualifiedTeams,
  rankTeams,
  seedRoundOf32,
  updateGroupRole,
} from "./bracket";

const teams: Team[] = Array.from({ length: 48 }, (_, index) => {
  const groupIndex = Math.floor(index / 4);
  return {
    id: String(index + 1),
    name: `Team ${String(index + 1).padStart(2, "0")}`,
    code: `T${String(index + 1).padStart(2, "0")}`,
    iso2: "US",
    flag: "",
    group: String.fromCharCode(65 + groupIndex),
  };
});

describe("knockout bracket seeding", () => {
  it("keeps the bundled fallback large enough for a complete bracket", () => {
    const selections = buildDefaultGroupSelections(fallbackTeams);
    expect(fallbackTeams).toHaveLength(48);
    expect(Object.keys(selections)).toHaveLength(12);
    expect(getQualifiedTeams(fallbackTeams, selections)).toHaveLength(32);
  });

  it("prefills 32 qualifiers across all 12 groups", () => {
    const selections = buildDefaultGroupSelections(teams);
    const qualifiers = getQualifiedTeams(teams, selections);
    expect(Object.keys(selections)).toHaveLength(12);
    expect(Object.values(selections).filter((selection) => selection.thirdAdvances)).toHaveLength(8);
    expect(qualifiers).toHaveLength(32);
    expect(new Set(qualifiers.map((team) => team.id))).toHaveLength(32);
    Object.entries(selections).forEach(([group, selection]) => {
      const ranked = rankTeams(teams.filter((team) => team.group === group));
      expect(selection.winnerId).toBe(ranked[0].id);
      expect(selection.runnerUpId).toBe(ranked[1].id);
      expect(selection.thirdId).toBe(ranked[2].id);
    });
  });

  it("swaps roles when a selected team is moved within its group", () => {
    const selection = {
      winnerId: "1",
      runnerUpId: "2",
      thirdId: "3",
      thirdAdvances: true,
    };
    expect(updateGroupRole(selection, "winnerId", "2")).toEqual({
      winnerId: "2",
      runnerUpId: "1",
      thirdId: "3",
      thirdAdvances: true,
    });
  });

  it("places the two highest seeds on opposite halves of the draw", () => {
    const qualifiers = teams.slice(0, 32);
    const ranked = rankTeams(qualifiers);
    const seeded = seedRoundOf32(qualifiers);
    expect(seeded).toHaveLength(32);
    expect(seeded[0]).toBe(ranked[0]);
    expect(seeded[16]).toBe(ranked[1]);
    expect(seeded[1]).toBe(ranked[31]);
    expect(new Set(seeded.map((team) => team.id))).toHaveLength(32);
  });
});
