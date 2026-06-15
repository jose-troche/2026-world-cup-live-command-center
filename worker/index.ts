import { fallbackTeams } from "../src/data/fallback";
import type { Group, Match, Stadium, Team } from "../src/types";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const UPSTREAM_TIMEOUT_MS = 4_500;

type EspnScoreboard = {
  events?: EspnEvent[];
};

type EspnEvent = {
  id?: string;
  date?: string;
  season?: {
    slug?: string;
  };
  competitions?: EspnCompetition[];
};

type EspnCompetition = {
  id?: string;
  date?: string;
  altGameNote?: string;
  status?: EspnStatus;
  venue?: {
    id?: string;
    fullName?: string;
    address?: {
      city?: string;
      country?: string;
    };
  };
  competitors?: EspnCompetitor[];
};

type EspnStatus = {
  clock?: number;
  displayClock?: string;
  period?: number;
  type?: {
    name?: string;
    state?: string;
    completed?: boolean;
  };
};

type EspnCompetitor = {
  homeAway?: "home" | "away";
  score?: string;
  team?: {
    id?: string;
    abbreviation?: string;
    displayName?: string;
    shortDisplayName?: string;
    name?: string;
  };
};

type MatchWithSort = Match & {
  sortTime: number;
};

const teamsByCode = new Map(fallbackTeams.map((team) => [team.code.toUpperCase(), team]));
const teamsByName = new Map(fallbackTeams.map((team) => [normalizeName(team.name), team]));
const teamsById = new Map(fallbackTeams.map((team) => [team.id, team]));

function json(data: unknown, status = 200, cache = "public, max-age=15, s-maxage=15") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cache,
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function fetchJson<T>(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Touchline26/1.0",
      },
    });

    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeName(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTeam(competitor?: EspnCompetitor) {
  const code = competitor?.team?.abbreviation?.toUpperCase();
  if (code && teamsByCode.has(code)) return teamsByCode.get(code)!;

  const names = [
    competitor?.team?.displayName,
    competitor?.team?.shortDisplayName,
    competitor?.team?.name,
  ];

  for (const name of names) {
    const team = teamsByName.get(normalizeName(name));
    if (team) return team;
  }

  return undefined;
}

function getScore(competitor?: EspnCompetitor) {
  return Number(competitor?.score) || 0;
}

function getCompetitorId(competitor: EspnCompetitor, team?: Team) {
  if (team) return team.id;
  return `espn-${competitor.team?.id ?? competitor.team?.abbreviation ?? normalizeName(getCompetitorName(competitor))}`;
}

function getCompetitorName(competitor: EspnCompetitor, team?: Team) {
  return (
    team?.name ??
    competitor.team?.displayName ??
    competitor.team?.shortDisplayName ??
    competitor.team?.name ??
    "TBD"
  );
}

function parseMinute(status?: EspnStatus) {
  if (status?.type?.completed) return 90;
  const displayMinute = Number.parseInt(status?.displayClock ?? "", 10);
  if (Number.isFinite(displayMinute)) return Math.min(displayMinute, 120);
  const clockMinute = Math.floor((status?.clock ?? 0) / 60);
  return Number.isFinite(clockMinute) ? Math.min(clockMinute, 120) : 0;
}

function getStatus(status?: EspnStatus): Match["status"] {
  if (status?.type?.completed || status?.type?.state === "post") return "finished";
  if (status?.type?.state === "in") return "live";
  return "scheduled";
}

function getLocalDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("month")}/${part("day")}/${part("year")} ${part("hour")}:${part("minute")}`;
}

function getGroup(competition: EspnCompetition, homeTeam?: Team, awayTeam?: Team) {
  const noteMatch = /Group\s+([A-L])/i.exec(competition.altGameNote ?? "");
  if (noteMatch) return noteMatch[1].toUpperCase();
  if (homeTeam?.group && homeTeam.group === awayTeam?.group) return homeTeam.group;
  return homeTeam?.group ?? awayTeam?.group ?? "";
}

export function normalizeEspnMatches(payload: EspnScoreboard) {
  const matches: MatchWithSort[] = (payload.events ?? [])
    .map((event): MatchWithSort | undefined => {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors ?? [];
      const home = competitors.find((competitor) => competitor.homeAway === "home");
      const away = competitors.find((competitor) => competitor.homeAway === "away");
      const homeTeam = getTeam(home);
      const awayTeam = getTeam(away);
      const group = competition ? getGroup(competition, homeTeam, awayTeam) : "";
      const date = competition?.date ?? event.date;

      if (!competition || !home || !away) return undefined;

      return {
        id:
          event.id ??
          competition.id ??
          `${getCompetitorId(home, homeTeam)}-${getCompetitorId(away, awayTeam)}-${date ?? ""}`,
        homeId: getCompetitorId(home, homeTeam),
        awayId: getCompetitorId(away, awayTeam),
        homeName: getCompetitorName(home, homeTeam),
        awayName: getCompetitorName(away, awayTeam),
        homeScore: getScore(home),
        awayScore: getScore(away),
        group,
        matchday: 0,
        localDate: getLocalDate(date),
        ...(date ? { utcDate: date } : {}),
        stadiumId: competition.venue?.id ?? "",
        status: getStatus(competition.status),
        minute: parseMinute(competition.status),
        type: group ? "group" : event.season?.slug ?? "knockout",
        sortTime: date ? Date.parse(date) : 0,
      };
    })
    .filter((match): match is MatchWithSort => Boolean(match))
    .sort((a, b) => a.sortTime - b.sortTime);

  for (const group of new Set(matches.map((match) => match.group).filter(Boolean))) {
    matches
      .filter((match) => match.group === group)
      .forEach((match, index) => {
        match.matchday = Math.floor(index / 2) + 1;
      });
  }

  return matches.map(({ sortTime, ...match }) => match);
}

export function normalizeEspnStadiums(payload: EspnScoreboard) {
  const stadiums = new Map<string, Stadium>();

  for (const event of payload.events ?? []) {
    const venue = event.competitions?.[0]?.venue;
    if (!venue?.id || stadiums.has(venue.id)) continue;
    stadiums.set(venue.id, {
      id: venue.id,
      name: venue.fullName ?? "Venue to be confirmed",
      city: venue.address?.city ?? "",
      ...(venue.address?.country ? { countryCode: venue.address.country } : {}),
      capacity: 0,
    });
  }

  return [...stadiums.values()];
}

export function buildGroupStandings(teams: Team[], matches: Match[]) {
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

async function getTournament() {
  const espnPayload = await fetchJson<EspnScoreboard>(ESPN_SCOREBOARD_URL);
  const matches = normalizeEspnMatches(espnPayload);

  if (!matches.length) throw new Error("ESPN scoreboard returned no tournament matches");

  return {
    teams: fallbackTeams,
    matches,
    groups: buildGroupStandings(fallbackTeams, matches),
    stadiums: normalizeEspnStadiums(espnPayload),
    source: "live",
    updatedAt: new Date().toISOString(),
  };
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "touchline-26" }, 200, "no-store");
    }

    if (url.pathname === "/api/tournament") {
      try {
        return json(await getTournament());
      } catch (error) {
        return json(
          {
            error: "Live tournament data is temporarily unavailable.",
            detail: error instanceof Error ? error.message : "Unknown upstream error",
          },
          502,
          "no-store",
        );
      }
    }

    return json({ error: "The requested endpoint was not found." }, 404, "no-store");
  },
};
