import { describe, expect, it } from "vitest";
import type { Group, Match, Stadium, Team } from "../types";
import { fallbackTeams } from "../data/fallback";
import {
  buildDefaultGroupSelections,
  buildBracketMatchMetas,
  buildR32DisplayTeams,
  formatBracketDate,
  getQualifiedTeams,
  prefillPicksFromMatches,
  R16_DISPLAY_ORDER,
  R32_DISPLAY_ORDER,
  rankTeams,
  resolveKnockoutTeam,
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

  it("places the two highest seeds on opposite halves of the draw (legacy seeding)", () => {
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

describe("standings-based group selections", () => {
  it("uses standings when available to rank teams", () => {
    const groupTeams = teams.slice(0, 4);  // Group A: teams 1-4
    const groups: Group[] = [
      {
        name: "A",
        standings: [
          { teamId: "4", played: 2, won: 2, drawn: 0, lost: 0, points: 6, goalsFor: 4, goalsAgainst: 0, goalDifference: 4 },
          { teamId: "3", played: 2, won: 1, drawn: 0, lost: 1, points: 3, goalsFor: 2, goalsAgainst: 2, goalDifference: 0 },
          { teamId: "2", played: 2, won: 0, drawn: 1, lost: 1, points: 1, goalsFor: 1, goalsAgainst: 2, goalDifference: -1 },
          { teamId: "1", played: 2, won: 0, drawn: 0, lost: 2, points: 0, goalsFor: 0, goalsAgainst: 3, goalDifference: -3 },
        ],
      },
    ];

    const selections = buildDefaultGroupSelections(groupTeams, groups);
    expect(selections["A"].winnerId).toBe("4");
    expect(selections["A"].runnerUpId).toBe("3");
    expect(selections["A"].thirdId).toBe("2");
  });

  it("falls back to model ratings when no matches played", () => {
    const groupTeams = teams.slice(0, 4);
    const groups: Group[] = [
      {
        name: "A",
        standings: [
          { teamId: "1", played: 0, won: 0, drawn: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
          { teamId: "2", played: 0, won: 0, drawn: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
          { teamId: "3", played: 0, won: 0, drawn: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
          { teamId: "4", played: 0, won: 0, drawn: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 },
        ],
      },
    ];

    const withGroups = buildDefaultGroupSelections(groupTeams, groups);
    const withoutGroups = buildDefaultGroupSelections(groupTeams);
    expect(withGroups["A"].winnerId).toBe(withoutGroups["A"].winnerId);
  });
});

describe("R32 / R16 display ordering", () => {
  it("R32_DISPLAY_ORDER covers all 16 match indices exactly once", () => {
    expect(R32_DISPLAY_ORDER).toHaveLength(16);
    expect(new Set(R32_DISPLAY_ORDER).size).toBe(16);
    expect(Math.min(...R32_DISPLAY_ORDER)).toBe(0);
    expect(Math.max(...R32_DISPLAY_ORDER)).toBe(15);
  });

  it("R16_DISPLAY_ORDER covers all 8 match indices exactly once", () => {
    expect(R16_DISPLAY_ORDER).toHaveLength(8);
    expect(new Set(R16_DISPLAY_ORDER).size).toBe(8);
    expect(Math.min(...R16_DISPLAY_ORDER)).toBe(0);
    expect(Math.max(...R16_DISPLAY_ORDER)).toBe(7);
  });
});

describe("resolveKnockoutTeam", () => {
  const teamA: Team = { id: "a", name: "Team A", code: "TEA", iso2: "US", flag: "", group: "A" };
  const teamB: Team = { id: "b", name: "Team B", code: "TEB", iso2: "US", flag: "", group: "A" };
  const teamC: Team = { id: "c", name: "Team C", code: "TEC", iso2: "US", flag: "", group: "A" };
  const teamById = new Map([["a", teamA], ["b", teamB], ["c", teamC]]);
  const selections = {
    A: { winnerId: "a", runnerUpId: "b", thirdId: "c", thirdAdvances: true },
  };

  it("returns team directly when ID is in teamById", () => {
    expect(resolveKnockoutTeam("a", "anything", selections, teamById)).toBe(teamA);
  });

  it("resolves 'Group A Winner' to the winner", () => {
    expect(resolveKnockoutTeam("unknown-id", "Group A Winner", selections, teamById)).toBe(teamA);
  });

  it("resolves 'Group A 2nd Place' to runner-up", () => {
    expect(resolveKnockoutTeam("unknown-id", "Group A 2nd Place", selections, teamById)).toBe(teamB);
  });

  it("resolves third-place slot when the group advances", () => {
    expect(resolveKnockoutTeam("unknown-id", "Third Place Group A/B/C/D/F", selections, teamById)).toBe(teamC);
  });

  it("returns undefined for truly unresolvable slots", () => {
    expect(resolveKnockoutTeam("unknown-id", "Round of 32 1 Winner", selections, teamById)).toBeUndefined();
  });
});

describe("buildR32DisplayTeams", () => {
  const makeTeam = (id: string, group: string): Team => ({
    id, name: `Team ${id}`, code: id.toUpperCase(), iso2: "US", flag: "", group
  });

  it("returns 32 items (2 per each of 16 R32 matches)", () => {
    const r32Teams = [makeTeam("a1", "A"), makeTeam("a2", "A"), makeTeam("b1", "B"), makeTeam("b2", "B")];
    const teamById = new Map(r32Teams.map((t) => [t.id, t]));
    const r32Matches: Match[] = Array.from({ length: 16 }, (_, i) => ({
      id: `r32-${i}`,
      homeId: r32Teams[i % r32Teams.length].id,
      awayId: r32Teams[(i + 1) % r32Teams.length].id,
      homeName: r32Teams[i % r32Teams.length].name,
      awayName: r32Teams[(i + 1) % r32Teams.length].name,
      homeScore: 0,
      awayScore: 0,
      group: "",
      matchday: 0,
      localDate: "06/28/2026 15:00",
      utcDate: `2026-06-${28 + i}T19:00Z`,
      stadiumId: "",
      status: "scheduled" as const,
      minute: 0,
      type: "round-of-32",
    }));

    const selections = { A: { winnerId: "a1", runnerUpId: "a2", thirdId: "a1", thirdAdvances: false } };
    const result = buildR32DisplayTeams([...r32Matches], selections, teamById);
    expect(result).toHaveLength(32);
  });
});

describe("prefillPicksFromMatches", () => {
  const teamA: Team = { id: "a", name: "Team A", code: "TEA", iso2: "US", flag: "", group: "A" };
  const teamB: Team = { id: "b", name: "Team B", code: "TEB", iso2: "US", flag: "", group: "A" };
  const teamById = new Map([["a", teamA], ["b", teamB]]);

  it("fills in winners for finished matches", () => {
    const matches: Match[] = [
      {
        id: "r32-0",
        homeId: "a", awayId: "b",
        homeName: "Team A", awayName: "Team B",
        homeScore: 2, awayScore: 1,
        group: "", matchday: 0,
        localDate: "06/28/2026 15:00",
        utcDate: "2026-06-28T19:00Z",
        stadiumId: "", status: "finished", minute: 90, type: "round-of-32",
      },
    ];
    // Pad to 16 matches to satisfy the display order
    const paddedMatches = Array.from({ length: 16 }, (_, i) =>
      i === 0 ? matches[0] : {
        ...matches[0],
        id: `r32-${i}`,
        utcDate: `2026-06-${28 + i}T19:00Z`,
        status: "scheduled" as const,
      }
    );
    const result = prefillPicksFromMatches(paddedMatches, teamById);
    // R32_DISPLAY_ORDER[0] = 0, so display position 0 = match 0 = team A wins
    expect(result.round32[0]).toBe("a");
  });

  it("leaves unplayed matches empty", () => {
    const matches: Match[] = [{
      id: "r32-0",
      homeId: "a", awayId: "b",
      homeName: "Team A", awayName: "Team B",
      homeScore: 0, awayScore: 0,
      group: "", matchday: 0,
      localDate: "06/28/2026 15:00",
      utcDate: "2026-06-28T19:00Z",
      stadiumId: "", status: "scheduled", minute: 0, type: "round-of-32",
    }];
    const result = prefillPicksFromMatches(matches, teamById);
    expect(result.round32).toHaveLength(0);
  });
});

describe("buildBracketMatchMetas", () => {
  it("returns correct count for each round", () => {
    const stadiums: Stadium[] = [{ id: "s1", name: "Test Stadium", city: "City", capacity: 0 }];
    const makeMatch = (type: string, i: number): Match => ({
      id: `${type}-${i}`,
      homeId: "a", awayId: "b",
      homeName: "A", awayName: "B",
      homeScore: 0, awayScore: 0,
      group: "", matchday: 0,
      localDate: "06/28/2026 15:00",
      utcDate: `2026-06-${28 + i}T${String(i).padStart(2, "0")}:00Z`,
      stadiumId: "s1", status: "scheduled", minute: 0, type,
    });
    const matches = [
      ...Array.from({ length: 16 }, (_, i) => makeMatch("round-of-32", i)),
      ...Array.from({ length: 8 }, (_, i) => makeMatch("round-of-16", i + 16)),
      ...Array.from({ length: 4 }, (_, i) => makeMatch("quarterfinals", i + 24)),
      ...Array.from({ length: 2 }, (_, i) => makeMatch("semifinals", i + 28)),
      makeMatch("final", 30),
    ];
    const metas = buildBracketMatchMetas(matches, stadiums);
    expect(metas.round32).toHaveLength(16);
    expect(metas.round16).toHaveLength(8);
    expect(metas.quarters).toHaveLength(4);
    expect(metas.semis).toHaveLength(2);
    expect(metas.final).toHaveLength(1);
  });
});

describe("formatBracketDate", () => {
  it("formats a localDate string to readable form", () => {
    expect(formatBracketDate("06/28/2026 19:00")).toBe("Jun 28, 7:00 PM ET");
    expect(formatBracketDate("07/04/2026 17:00")).toBe("Jul 4, 5:00 PM ET");
    expect(formatBracketDate("07/19/2026 19:00")).toBe("Jul 19, 7:00 PM ET");
  });
});
