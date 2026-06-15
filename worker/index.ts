const API_ORIGIN = "https://worldcup26.ir";

type RawTeam = {
  id: string;
  name_en: string;
  fifa_code: string;
  iso2: string;
  flag: string;
  groups: string;
};

type RawGame = {
  id: string;
  home_team_id?: string;
  away_team_id?: string;
  home_team_name_en?: string;
  away_team_name_en?: string;
  home_score: string;
  away_score: string;
  group: string;
  matchday: string;
  local_date: string;
  stadium_id: string;
  finished: string;
  time_elapsed: string;
  type: string;
};

type RawStanding = {
  team_id: string;
  mp: string;
  w: string;
  l: string;
  d: string;
  pts: string;
  gf: string;
  ga: string;
  gd: string;
};

type RawGroup = {
  name: string;
  teams: RawStanding[];
};

type RawStadium = {
  id: string;
  fifa_name?: string;
  name_en: string;
  city_en: string;
  capacity: number;
};

function json(data: unknown, status = 200, cache = "public, max-age=30, s-maxage=30") {
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

async function fetchJson(path: string) {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Touchline26/1.0",
    },
  });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

function parseMinute(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(parsed, 120) : 0;
}

async function getTournament() {
  const [gamesPayload, groupsPayload, teamsPayload, stadiumsPayload] = await Promise.all([
    fetchJson("/get/games"),
    fetchJson("/get/groups"),
    fetchJson("/get/teams"),
    fetchJson("/get/stadiums"),
  ]);

  const teams = ((teamsPayload.teams ?? []) as RawTeam[]).map((team) => ({
    id: team.id,
    name: team.name_en,
    code: team.fifa_code,
    iso2: team.iso2,
    flag: team.flag,
    group: team.groups,
  }));

  const matches = ((gamesPayload.games ?? []) as RawGame[])
    .filter((game) => game.home_team_name_en && game.away_team_name_en)
    .map((game) => {
      const finished = game.finished.toUpperCase() === "TRUE";
      const timeValue = game.time_elapsed.toLowerCase();
      const live = !finished && timeValue !== "notstarted" && parseMinute(timeValue) > 0;
      return {
        id: game.id,
        homeId: game.home_team_id ?? "",
        awayId: game.away_team_id ?? "",
        homeName: game.home_team_name_en ?? "TBD",
        awayName: game.away_team_name_en ?? "TBD",
        homeScore: Number(game.home_score) || 0,
        awayScore: Number(game.away_score) || 0,
        group: game.group,
        matchday: Number(game.matchday) || 0,
        localDate: game.local_date,
        stadiumId: game.stadium_id,
        status: finished ? "finished" : live ? "live" : "scheduled",
        minute: finished ? 90 : parseMinute(timeValue),
        type: game.type,
      };
    });

  const groups = ((groupsPayload.groups ?? []) as RawGroup[]).map((group) => ({
    name: group.name,
    standings: group.teams.map((standing) => ({
      teamId: standing.team_id,
      played: Number(standing.mp) || 0,
      won: Number(standing.w) || 0,
      drawn: Number(standing.d) || 0,
      lost: Number(standing.l) || 0,
      points: Number(standing.pts) || 0,
      goalsFor: Number(standing.gf) || 0,
      goalsAgainst: Number(standing.ga) || 0,
      goalDifference: Number(standing.gd) || 0,
    })),
  }));

  const stadiums = ((stadiumsPayload.stadiums ?? []) as RawStadium[]).map((stadium) => ({
    id: stadium.id,
    name: stadium.fifa_name || stadium.name_en,
    city: stadium.city_en,
    capacity: Number(stadium.capacity) || 0,
  }));

  return {
    teams,
    matches,
    groups,
    stadiums,
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
            error: "Live tournament provider is temporarily unavailable.",
            detail: error instanceof Error ? error.message : "Unknown upstream error",
          },
          502,
          "no-store",
        );
      }
    }

    return json({ error: "Not found" }, 404, "no-store");
  },
};
