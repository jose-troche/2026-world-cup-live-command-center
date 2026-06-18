import { describe, expect, it } from "vitest";
import { buildGroupStandings } from "./standings";
import type { Match, Team } from "../types";

const makeTeam = (id: string, name: string, group: string): Team => ({
  id,
  name,
  code: name.slice(0, 3).toUpperCase(),
  iso2: "XX",
  flag: "",
  group,
});

const makeMatch = (
  id: string,
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number,
  group: string,
  status: Match["status"] = "finished",
): Match => ({
  id,
  homeId,
  awayId,
  homeName: homeId,
  awayName: awayId,
  homeScore,
  awayScore,
  group,
  matchday: 1,
  localDate: "06/15/2026 12:00",
  stadiumId: "1",
  status,
  minute: status === "finished" ? 90 : 0,
  type: "group",
});

const teamA = makeTeam("1", "Alpha", "A");
const teamB = makeTeam("2", "Beta", "A");
const teamC = makeTeam("3", "Gamma", "A");

describe("buildGroupStandings", () => {
  it("initializes all stats to zero with no played matches", () => {
    const groups = buildGroupStandings([teamA, teamB], []);
    const standing = groups[0].standings[0];
    expect(standing).toMatchObject({ played: 0, won: 0, drawn: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 });
  });

  it("gives a win 3 points and a loss 0 points", () => {
    const match = makeMatch("m1", "1", "2", 2, 0, "A");
    const groups = buildGroupStandings([teamA, teamB], [match]);
    const standings = groups[0].standings;
    const winner = standings.find((s) => s.teamId === "1")!;
    const loser = standings.find((s) => s.teamId === "2")!;
    expect(winner).toMatchObject({ played: 1, won: 1, lost: 0, points: 3, goalsFor: 2, goalsAgainst: 0, goalDifference: 2 });
    expect(loser).toMatchObject({ played: 1, won: 0, lost: 1, points: 0, goalsFor: 0, goalsAgainst: 2, goalDifference: -2 });
  });

  it("gives each team 1 point for a draw", () => {
    const match = makeMatch("m1", "1", "2", 1, 1, "A");
    const groups = buildGroupStandings([teamA, teamB], [match]);
    const standings = groups[0].standings;
    standings.forEach((s) => expect(s).toMatchObject({ drawn: 1, points: 1, goalDifference: 0 }));
  });

  it("skips scheduled matches", () => {
    const match = makeMatch("m1", "1", "2", 0, 0, "A", "scheduled");
    const groups = buildGroupStandings([teamA, teamB], [match]);
    groups[0].standings.forEach((s) => expect(s.played).toBe(0));
  });

  it("sorts by points desc, then goal difference desc, then goals for desc", () => {
    const matches = [
      makeMatch("m1", "1", "3", 3, 0, "A"),
      makeMatch("m2", "2", "3", 1, 1, "A"),
    ];
    const groups = buildGroupStandings([teamA, teamB, teamC], matches);
    const order = groups[0].standings.map((s) => s.teamId);
    expect(order[0]).toBe("1");
    expect(order[1]).toBe("2");
    expect(order[2]).toBe("3");
  });

  it("returns groups in alphabetical order", () => {
    const teamZ = makeTeam("10", "Zeta", "Z");
    const teamG = makeTeam("11", "Gamma", "G");
    const groups = buildGroupStandings([teamZ, teamA, teamG], []);
    expect(groups.map((g) => g.name)).toEqual(["A", "G", "Z"]);
  });

  it("accumulates stats across multiple matches", () => {
    const matches = [
      makeMatch("m1", "1", "2", 2, 1, "A"),
      makeMatch("m2", "1", "2", 0, 0, "A"),
    ];
    const groups = buildGroupStandings([teamA, teamB], matches);
    const teamAStanding = groups[0].standings.find((s) => s.teamId === "1")!;
    expect(teamAStanding).toMatchObject({ played: 2, won: 1, drawn: 1, points: 4, goalsFor: 2, goalsAgainst: 1 });
  });
});
