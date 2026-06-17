import type { Group, Match, Team } from "../types";

export function buildGroupStandings(teams: Team[], matches: Match[]): Group[] {
  const teamsById = new Map(teams.map((t) => [t.id, t]));

  const standings = new Map(
    teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
      },
    ]),
  );

  for (const match of matches) {
    if (!match.group || match.status === "scheduled") continue;
    const home = standings.get(match.homeId);
    const away = standings.get(match.awayId);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goalsFor += match.homeScore;
    home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore;
    away.goalsAgainst += match.homeScore;

    if (match.homeScore > match.awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (match.awayScore > match.homeScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  for (const standing of standings.values()) {
    standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
  }

  return [...new Set(teams.map((team) => team.group))]
    .sort()
    .map<Group>((name) => ({
      name,
      standings: teams
        .filter((team) => team.group === name)
        .map((team) => standings.get(team.id)!)
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.goalDifference - a.goalDifference ||
            b.goalsFor - a.goalsFor ||
            (teamsById.get(a.teamId)?.name ?? "").localeCompare(teamsById.get(b.teamId)?.name ?? ""),
        ),
    }));
}
