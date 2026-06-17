import type {
  Group,
  Match,
  Team,
  TeamMetrics,
  WinProbability,
} from "../types";

const knownRatings: Record<string, number> = {
  Argentina: 94,
  Spain: 93,
  France: 92,
  England: 91,
  Brazil: 91,
  Portugal: 89,
  Netherlands: 88,
  Germany: 88,
  Morocco: 87,
  Belgium: 86,
  Colombia: 86,
  Uruguay: 85,
  Croatia: 85,
  Japan: 84,
  Switzerland: 83,
  "United States": 83,
  Mexico: 82,
  Senegal: 82,
  Ecuador: 81,
  Austria: 81,
  "South Korea": 80,
  Australia: 79,
  Canada: 78,
};

function hash(input: string) {
  return [...input].reduce((value, character) => {
    return (value * 31 + character.charCodeAt(0)) >>> 0;
  }, 2166136261);
}

export function getRating(name: string) {
  return knownRatings[name] ?? 70 + (hash(name) % 13);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getTeamMetrics(team: Team): TeamMetrics {
  const seed = hash(team.name);
  const rating = getRating(team.name);
  return {
    rating,
    attack: clamp(rating + ((seed >> 1) % 9) - 4, 55, 96),
    defense: clamp(rating + ((seed >> 4) % 9) - 4, 55, 96),
    control: clamp(rating + ((seed >> 7) % 11) - 5, 55, 96),
    transition: clamp(rating + ((seed >> 10) % 11) - 5, 55, 96),
    setPieces: clamp(rating + ((seed >> 13) % 13) - 6, 55, 96),
    form: clamp(rating + ((seed >> 16) % 13) - 6, 55, 96),
  };
}

function factorial(value: number) {
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

function poisson(goals: number, lambda: number) {
  return (Math.exp(-lambda) * Math.pow(lambda, goals)) / factorial(goals);
}

export function expectedGoals(homeName: string, awayName: string) {
  const difference = getRating(homeName) - getRating(awayName);
  return {
    home: clamp(1.43 + difference * 0.025, 0.38, 2.85),
    away: clamp(1.16 - difference * 0.021, 0.32, 2.55),
  };
}

export function winProbability(match: Match): WinProbability {
  if (match.status === "finished") {
    if (match.homeScore > match.awayScore) return { home: 1, draw: 0, away: 0 };
    if (match.awayScore > match.homeScore) return { home: 0, draw: 0, away: 1 };
    return { home: 0, draw: 1, away: 0 };
  }

  const baseline = expectedGoals(match.homeName, match.awayName);
  const timeLeft = clamp((90 - match.minute) / 90, 0.02, 1);
  const homeLambda = baseline.home * timeLeft;
  const awayLambda = baseline.away * timeLeft;
  let home = 0;
  let draw = 0;
  let away = 0;

  for (let homeGoals = 0; homeGoals <= 7; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= 7; awayGoals += 1) {
      const probability = poisson(homeGoals, homeLambda) * poisson(awayGoals, awayLambda);
      const finalHome = match.homeScore + homeGoals;
      const finalAway = match.awayScore + awayGoals;
      if (finalHome > finalAway) home += probability;
      else if (finalHome < finalAway) away += probability;
      else draw += probability;
    }
  }

  const total = home + draw + away;
  return { home: home / total, draw: draw / total, away: away / total };
}

export function buildXgRace(match: Match) {
  const baseline = expectedGoals(match.homeName, match.awayName);
  const endMinute = match.status === "live" ? Math.max(match.minute, 15) : 90;
  const steps = Math.ceil(endMinute / 5);
  let home = 0;
  let away = 0;
  const points = [{ minute: 0, home: 0, away: 0 }];
  const matchSeed = Number(match.id) || hash(match.id);

  for (let step = 1; step <= steps; step += 1) {
    const minute = Math.min(step * 5, endMinute);
    const homePulse = 0.45 + Math.abs(Math.sin(step * 1.71 + matchSeed)) * 0.95;
    const awayPulse = 0.4 + Math.abs(Math.cos(step * 1.37 + matchSeed)) * 0.9;
    home += (baseline.home / 18) * homePulse;
    away += (baseline.away / 18) * awayPulse;
    points.push({
      minute,
      home: Number(home.toFixed(2)),
      away: Number(away.toFixed(2)),
    });
  }

  return points;
}

function sampleGoals(lambda: number) {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do {
    count += 1;
    product *= Math.random();
  } while (product > limit);
  return count - 1;
}

type SimulationRow = {
  id: string;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
};

export function simulateAdvancement(
  groups: Group[],
  matches: Match[],
  teams: Team[],
  iterations = 700,
) {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const counts = new Map<string, number>();

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const allThird: SimulationRow[] = [];
    const groupResults = groups.map((group) => {
      const table = new Map<string, SimulationRow>();
      group.standings.forEach((standing) => {
        table.set(standing.teamId, {
          id: standing.teamId,
          points: standing.points,
          goalsFor: standing.goalsFor,
          goalsAgainst: standing.goalsAgainst,
        });
      });

      matches
        .filter(
          (match) =>
            match.group === group.name &&
            match.type === "group" &&
            match.status !== "finished" &&
            table.has(match.homeId) &&
            table.has(match.awayId),
        )
        .forEach((match) => {
          const xg = expectedGoals(match.homeName, match.awayName);
          const homeGoals = sampleGoals(xg.home);
          const awayGoals = sampleGoals(xg.away);
          const home = table.get(match.homeId)!;
          const away = table.get(match.awayId)!;
          home.goalsFor += homeGoals;
          home.goalsAgainst += awayGoals;
          away.goalsFor += awayGoals;
          away.goalsAgainst += homeGoals;
          if (homeGoals > awayGoals) home.points += 3;
          else if (awayGoals > homeGoals) away.points += 3;
          else {
            home.points += 1;
            away.points += 1;
          }
        });

      const ranked = [...table.values()].sort((a, b) => {
        const teamA = teamById.get(a.id)?.name ?? a.id;
        const teamB = teamById.get(b.id)?.name ?? b.id;
        const result =
          b.points - a.points ||
          b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
          b.goalsFor - a.goalsFor;
        return result || getRating(teamB) - getRating(teamA);
      });
      ranked.slice(0, 2).forEach((row) => counts.set(row.id, (counts.get(row.id) ?? 0) + 1));
      if (ranked[2]) allThird.push(ranked[2]);
      return ranked;
    });

    allThird
      .sort((a, b) => {
        const teamA = teamById.get(a.id)?.name ?? a.id;
        const teamB = teamById.get(b.id)?.name ?? b.id;
        return (
          b.points - a.points ||
          b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
          b.goalsFor - a.goalsFor ||
          getRating(teamB) - getRating(teamA)
        );
      })
      .slice(0, 8)
      .forEach((row) => {
        counts.set(row.id, (counts.get(row.id) ?? 0) + 1);
      });

    void groupResults;
  }

  return new Map(
    teams.map((team) => [team.id, Math.round(((counts.get(team.id) ?? 0) / iterations) * 100)]),
  );
}

export function simulateKnockout(teamA: Team, teamB: Team) {
  const difference = getRating(teamA.name) - getRating(teamB.name);
  const probabilityA = 1 / (1 + Math.exp(-difference / 7));
  return Math.random() < probabilityA ? teamA : teamB;
}

export function simulateChampionship(
  groups: Group[],
  matches: Match[],
  teams: Team[],
  iterations = 700,
): Map<string, number> {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const counts = new Map<string, number>();

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const allThird: SimulationRow[] = [];
    const qualifiers: Team[] = [];

    for (const group of groups) {
      const table = new Map<string, SimulationRow>();
      group.standings.forEach((standing) => {
        table.set(standing.teamId, {
          id: standing.teamId,
          points: standing.points,
          goalsFor: standing.goalsFor,
          goalsAgainst: standing.goalsAgainst,
        });
      });

      matches
        .filter(
          (match) =>
            match.group === group.name &&
            match.type === "group" &&
            match.status !== "finished" &&
            table.has(match.homeId) &&
            table.has(match.awayId),
        )
        .forEach((match) => {
          const xg = expectedGoals(match.homeName, match.awayName);
          const homeGoals = sampleGoals(xg.home);
          const awayGoals = sampleGoals(xg.away);
          const home = table.get(match.homeId)!;
          const away = table.get(match.awayId)!;
          home.goalsFor += homeGoals;
          home.goalsAgainst += awayGoals;
          away.goalsFor += awayGoals;
          away.goalsAgainst += homeGoals;
          if (homeGoals > awayGoals) home.points += 3;
          else if (awayGoals > homeGoals) away.points += 3;
          else {
            home.points += 1;
            away.points += 1;
          }
        });

      const ranked = [...table.values()].sort((a, b) => {
        const nameA = teamById.get(a.id)?.name ?? a.id;
        const nameB = teamById.get(b.id)?.name ?? b.id;
        return (
          b.points - a.points ||
          b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
          b.goalsFor - a.goalsFor ||
          getRating(nameB) - getRating(nameA)
        );
      });

      ranked.slice(0, 2).forEach((row) => {
        const team = teamById.get(row.id);
        if (team) qualifiers.push(team);
      });
      if (ranked[2]) allThird.push(ranked[2]);
    }

    allThird
      .sort((a, b) => {
        const nameA = teamById.get(a.id)?.name ?? a.id;
        const nameB = teamById.get(b.id)?.name ?? b.id;
        return (
          b.points - a.points ||
          b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
          b.goalsFor - a.goalsFor ||
          getRating(nameB) - getRating(nameA)
        );
      })
      .slice(0, 8)
      .forEach((row) => {
        const team = teamById.get(row.id);
        if (team) qualifiers.push(team);
      });

    // Seed by rating: strongest team is seed 1, plays weakest seed in R32
    qualifiers.sort((a, b) => getRating(b.name) - getRating(a.name));

    // Simulate 5 knockout rounds (R32 → R16 → QF → SF → Final)
    // Seed 1 plays seed 32, seed 2 plays seed 31, etc.
    const seeded = qualifiers.slice(0, 32);
    let remaining = seeded;
    while (remaining.length > 1) {
      const nextRound: Team[] = [];
      // Standard bracket: pair from opposite ends (1v last, 2v second-to-last, ...)
      for (let left = 0, right = remaining.length - 1; left < right; left += 1, right -= 1) {
        nextRound.push(simulateKnockout(remaining[left], remaining[right]));
      }
      remaining = nextRound;
    }

    const champion = remaining[0];
    if (champion) counts.set(champion.id, (counts.get(champion.id) ?? 0) + 1);
  }

  return new Map(
    teams.map((team) => [team.id, Math.round(((counts.get(team.id) ?? 0) / iterations) * 100)]),
  );
}
