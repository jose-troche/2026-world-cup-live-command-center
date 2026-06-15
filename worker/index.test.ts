import { describe, expect, it } from "vitest";
import { fallbackTeams } from "../src/data/fallback";
import { buildGroupStandings, normalizeEspnMatches } from "./index";

describe("ESPN scoreboard normalization", () => {
  it("maps a live Saudi Arabia lead over Uruguay into app match data", () => {
    const matches = normalizeEspnMatches({
      events: [
        {
          id: "760429",
          date: "2026-06-15T22:00Z",
          competitions: [
            {
              id: "760429",
              date: "2026-06-15T22:00Z",
              altGameNote: "FIFA World Cup, Group H",
              status: {
                clock: 2520,
                displayClock: "42'",
                period: 1,
                type: {
                  name: "STATUS_FIRST_HALF",
                  state: "in",
                  completed: false,
                },
              },
              venue: {
                id: "4643",
                fullName: "Hard Rock Stadium",
                address: { city: "Miami Gardens, Florida" },
              },
              competitors: [
                {
                  homeAway: "home",
                  score: "1",
                  team: { abbreviation: "KSA", displayName: "Saudi Arabia" },
                },
                {
                  homeAway: "away",
                  score: "0",
                  team: { abbreviation: "URU", displayName: "Uruguay" },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      homeName: "Saudi Arabia",
      awayName: "Uruguay",
      homeScore: 1,
      awayScore: 0,
      group: "H",
      status: "live",
      minute: 42,
    });
  });

  it("computes current group standings from live and finished matches", () => {
    const matches = normalizeEspnMatches({
      events: [
        {
          id: "760428",
          date: "2026-06-15T16:00Z",
          competitions: [
            {
              date: "2026-06-15T16:00Z",
              altGameNote: "FIFA World Cup, Group H",
              status: { type: { state: "post", completed: true } },
              competitors: [
                { homeAway: "home", score: "0", team: { abbreviation: "ESP" } },
                { homeAway: "away", score: "0", team: { abbreviation: "CPV" } },
              ],
            },
          ],
        },
        {
          id: "760429",
          date: "2026-06-15T22:00Z",
          competitions: [
            {
              date: "2026-06-15T22:00Z",
              altGameNote: "FIFA World Cup, Group H",
              status: { type: { state: "in", completed: false } },
              competitors: [
                { homeAway: "home", score: "1", team: { abbreviation: "KSA" } },
                { homeAway: "away", score: "0", team: { abbreviation: "URU" } },
              ],
            },
          ],
        },
      ],
    });

    const groupH = buildGroupStandings(fallbackTeams, matches).find((group) => group.name === "H");

    expect(groupH?.standings[0]).toMatchObject({
      teamId: "31",
      points: 3,
      goalsFor: 1,
      goalsAgainst: 0,
    });
    expect(groupH?.standings.find((standing) => standing.teamId === "32")).toMatchObject({
      points: 0,
      goalsAgainst: 1,
    });
  });
});
