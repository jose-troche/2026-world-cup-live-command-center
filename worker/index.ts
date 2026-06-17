import { fallbackData, fallbackTeams } from "../src/data/fallback";
import { buildGoalImpactContent, buildMatchPrediction, buildViralContent, buildWhatChanged, slugify } from "../src/lib/viral";
import type { GoalEvent, Group, Match, SerializedGoalWithImpact, Stadium, Team, TournamentData } from "../src/types";

interface KVNamespace {
  get<T>(key: string, type: "json"): Promise<T | null>;
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

type Env = {
  GOAL_HISTORY: KVNamespace;
  ASSETS: Fetcher;
};

const MAX_GOAL_HISTORY = 10;
const GOAL_HISTORY_KEY = "goal_history";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const UPSTREAM_TIMEOUT_MS = 4_500;
const DEFAULT_ORIGIN = "https://touchline26.com";

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

type ScheduledControllerLike = {
  cron: string;
  scheduledTime: number;
};

type ExecutionContextLike = {
  waitUntil(promise: Promise<unknown>): void;
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

function svg(data: string, status = 200, cache = "public, max-age=300, s-maxage=300") {
  return new Response(data, {
    status,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": cache,
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function text(data: string, contentType: string, status = 200, cache = "public, max-age=300, s-maxage=300") {
  return new Response(data, {
    status,
    headers: {
      "Content-Type": contentType,
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

async function getTournament(): Promise<TournamentData> {
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

async function getTournamentOrFallback() {
  try {
    return await getTournament();
  } catch (error) {
    return {
      ...fallbackData,
      source: "fallback" as const,
      warning: error instanceof Error ? error.message : fallbackData.warning,
      updatedAt: new Date().toISOString(),
    };
  }
}

function xmlEscape(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitLines(value: string, maxLength = 34) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function svgHeader(kicker: string, title: string) {
  const titleLines = splitLines(title, 30);
  return `
    <text x="74" y="86" fill="#d9ff43" font-family="monospace" font-size="23" letter-spacing="3">${xmlEscape(kicker.toUpperCase())}</text>
    ${titleLines
      .map(
        (line, index) =>
          `<text x="74" y="${157 + index * 72}" fill="#f5f7f6" font-family="Manrope, Arial, sans-serif" font-size="64" font-weight="800">${xmlEscape(line)}</text>`,
      )
      .join("")}
  `;
}

function baseCard(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img">
  <rect width="1200" height="630" fill="#07100d"/>
  <rect x="38" y="38" width="1124" height="554" rx="32" fill="#101b17" stroke="#2b3a34"/>
  <circle cx="970" cy="74" r="220" fill="#d9ff43" opacity="0.08"/>
  <path d="M78 525H1120" stroke="#2b3a34" stroke-width="2"/>
  ${body}
  <text x="74" y="562" fill="#d9ff43" font-family="monospace" font-size="24" letter-spacing="2">Generated by Touchline26.com</text>
</svg>`;
}

function predictionCard(match: Match, request: Request) {
  const card = buildMatchPrediction(match, new URL(request.url).origin);
  const rows = [
    [card.homeName, card.homePercent, "#d9ff43"],
    ["Draw", card.drawPercent, "#f1b84b"],
    [card.awayName, card.awayPercent, "#ff7043"],
  ] as const;

  return baseCard(`
    ${svgHeader(card.subtitle, card.title)}
    ${rows
      .map(
        ([label, value, color], index) => `
          <text x="74" y="${365 + index * 54}" fill="#c5cfca" font-family="Manrope, Arial, sans-serif" font-size="28" font-weight="700">${xmlEscape(label)}</text>
          <rect x="370" y="${340 + index * 54}" width="520" height="22" rx="11" fill="#24322d"/>
          <rect x="370" y="${340 + index * 54}" width="${Math.max(10, value * 5.2)}" height="22" rx="11" fill="${color}"/>
          <text x="930" y="${365 + index * 54}" fill="#f5f7f6" font-family="monospace" font-size="32">${value}%</text>
        `,
      )
      .join("")}
  `);
}

function listCard(kicker: string, title: string, rows: Array<[string, string]>) {
  return baseCard(`
    ${svgHeader(kicker, title)}
    ${rows
      .slice(0, 5)
      .map(
        ([primary, secondary], index) => `
          <text x="74" y="${330 + index * 45}" fill="#f5f7f6" font-family="Manrope, Arial, sans-serif" font-size="28" font-weight="800">${xmlEscape(primary)}</text>
          <text x="675" y="${330 + index * 45}" fill="#8b9993" font-family="Manrope, Arial, sans-serif" font-size="24">${xmlEscape(secondary)}</text>
        `,
      )
      .join("")}
  `);
}

function contentStoryCard(title: string, summary: string, phase: string) {
  const summaryLines = splitLines(summary, 58).slice(0, 4);
  return baseCard(`
    ${svgHeader(`${phase} story`, title)}
    ${summaryLines
      .map(
        (line, index) =>
          `<text x="74" y="${358 + index * 42}" fill="#c5cfca" font-family="Manrope, Arial, sans-serif" font-size="28">${xmlEscape(line)}</text>`,
      )
      .join("")}
  `);
}

async function buildAutomationDigest(origin: string) {
  const tournament = await getTournamentOrFallback();
  const content = buildViralContent(tournament, origin);
  const platformPosts = buildPlatformOutbox(content);
  return {
    mode: "dry-run",
    generatedAt: new Date().toISOString(),
    source: tournament.source,
    posts: content.socialPosts,
    platformPosts,
    cards: {
      prediction: content.prediction?.cardUrl,
      upsets: `${origin}/api/cards/upsets.svg`,
      powerRankings: `${origin}/api/cards/power-rankings.svg`,
    },
    note: "Connect platform credentials before enabling automatic publishing.",
  };
}

function buildPlatformOutbox(content: ReturnType<typeof buildViralContent>) {
  return content.socialPosts.flatMap((post) => [
    {
      platform: "x",
      phase: post.phase,
      title: post.title,
      text: `${post.body}\n${post.url}`,
      mediaUrl: post.cardUrl,
      status: "draft",
    },
    {
      platform: "bluesky",
      phase: post.phase,
      title: post.title,
      text: `${post.body}\n\n${post.url}`,
      mediaUrl: post.cardUrl,
      status: "draft",
    },
    {
      platform: "facebook",
      phase: post.phase,
      title: post.title,
      text: post.body,
      linkUrl: post.url,
      mediaUrl: post.cardUrl,
      status: "draft",
    },
    {
      platform: "linkedin",
      phase: post.phase,
      title: post.title,
      text: `${post.body}\n\nFull analytics: ${post.url}`,
      mediaUrl: post.cardUrl,
      status: "draft",
    },
    {
      platform: "reddit",
      phase: post.phase,
      title: post.title,
      text: `${post.body}\n\nRelevant Touchline 26 analytics: ${post.url}`,
      mediaUrl: post.cardUrl,
      status: "manual-review-required",
    },
  ]);
}

function buildSitemap(origin: string) {
  const tournament = fallbackData;
  const content = buildViralContent(tournament, origin);
  const urls = [
    "/",
    "/viral",
    "/groups",
    "/teams",
    "/bracket",
    "/power-rankings",
    "/upsets",
    "/feed.xml",
    ...content.seoPages.map((page) => page.path),
  ];
  const uniqueUrls = [...new Set(urls)].map((path) => `${origin}${path}`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls
  .map(
    (url) => `  <url>
    <loc>${xmlEscape(url)}</loc>
    <lastmod>${new Date(tournament.updatedAt).toISOString().slice(0, 10)}</lastmod>
  </url>`,
  )
  .join("\n")}
</urlset>`;
}

function buildRobots(origin: string) {
  return `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
}

function buildLlmsText(origin: string) {
  const content = buildViralContent(fallbackData, origin);
  const topPages = content.seoPages.slice(0, 24).map((page) => `- ${page.title}: ${origin}${page.path}`);
  return `# Touchline 26

Touchline 26 is an independent World Cup 2026 analytics command center focused on match predictions, advancement probabilities, upset tracking, power rankings, and shareable visual summaries.

## Core Resources
- Live tournament data API: ${origin}/api/tournament
- Viral content feed: ${origin}/api/viral
- Automation dry-run digest: ${origin}/api/automation/digest
- Social draft outbox: ${origin}/api/social/outbox
- Content feed: ${origin}/feed.xml
- Sitemap: ${origin}/sitemap.xml

## High-Value Pages
${topPages.join("\n")}

## Notes
Model outputs are directional analytics from public match data and internal ratings, not betting advice.
`;
}

function buildFeed(origin: string) {
  const content = buildViralContent(fallbackData, origin);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Touchline 26 World Cup Analytics</title>
    <link>${xmlEscape(origin)}</link>
    <description>Automated World Cup 2026 predictions, what-changed stories, rankings, and shareable analytics.</description>
    ${content.contentStories
      .slice(0, 40)
      .map(
        (story) => `<item>
      <title>${xmlEscape(story.title)}</title>
      <link>${xmlEscape(story.pageUrl)}</link>
      <guid>${xmlEscape(story.pageUrl)}</guid>
      <description>${xmlEscape(story.summary)}</description>
    </item>`,
      )
      .join("\n    ")}
  </channel>
</rss>`;
}

function resolveOgCardUrl(pathname: string, origin: string): string {
  const matchRoute = /^\/matches\/(.+)$/.exec(pathname);
  if (matchRoute) {
    const rawId = decodeURIComponent(matchRoute[1]);
    const byId = fallbackData.matches.find((m) => m.id === rawId);
    if (byId) return `${origin}/api/cards/match/${encodeURIComponent(byId.id)}.svg`;
    const bySlug = fallbackData.matches.find((m) => slugify(`${m.homeName}-${m.awayName}`) === rawId);
    if (bySlug) return `${origin}/api/cards/match/${encodeURIComponent(bySlug.id)}.svg`;
    return `${origin}/api/cards/match/${encodeURIComponent(rawId)}.svg`;
  }
  const contentRoute = /^\/content\/(.+)$/.exec(pathname);
  if (contentRoute) return `${origin}/api/cards/content/${contentRoute[1]}.svg`;
  return `${origin}/api/cards/power-rankings.svg`;
}

async function serveWithOgTags(env: Env, origin: string, cardImageUrl: string): Promise<Response | null> {
  try {
    const assetRes = await env.ASSETS.fetch(new Request(`${origin}/index.html`));
    if (!assetRes.ok) return null;
    const html = await assetRes.text();
    const tags = [
      `<meta property="og:image" content="${cardImageUrl}" />`,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:image" content="${cardImageUrl}" />`,
    ].join("\n    ");
    const injected = html.replace("</head>", `    ${tags}\n  </head>`);
    return new Response(injected, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/goals") {
      if (request.method === "GET") {
        const raw = await env.GOAL_HISTORY.get<SerializedGoalWithImpact[]>(GOAL_HISTORY_KEY, "json");
        return json(raw ?? [], 200, "no-store");
      }

      if (request.method === "POST") {
        let incoming: SerializedGoalWithImpact[];
        try {
          incoming = (await request.json()) as SerializedGoalWithImpact[];
        } catch {
          return json({ error: "Invalid JSON body" }, 400, "no-store");
        }
        const existing = (await env.GOAL_HISTORY.get<SerializedGoalWithImpact[]>(GOAL_HISTORY_KEY, "json")) ?? [];
        const goalKey = (g: SerializedGoalWithImpact) =>
          `${g.event.matchId}-${g.event.scoreAfter.home}-${g.event.scoreAfter.away}-${g.event.scorerTeam}`;
        const seen = new Set(existing.map(goalKey));
        const deduped = incoming.filter((g) => !seen.has(goalKey(g)));
        const updated = [...deduped, ...existing].slice(0, MAX_GOAL_HISTORY);
        await env.GOAL_HISTORY.put(GOAL_HISTORY_KEY, JSON.stringify(updated));
        return json(updated, 200, "no-store");
      }

      return json({ error: "Method not allowed" }, 405, "no-store");
    }

    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "touchline-26" }, 200, "no-store");
    }

    if (url.pathname === "/sitemap.xml") {
      return text(buildSitemap(url.origin), "application/xml; charset=utf-8");
    }

    if (url.pathname === "/robots.txt") {
      return text(buildRobots(url.origin), "text/plain; charset=utf-8");
    }

    if (url.pathname === "/llms.txt") {
      return text(buildLlmsText(url.origin), "text/plain; charset=utf-8");
    }

    if (url.pathname === "/feed.xml") {
      return text(buildFeed(url.origin), "application/rss+xml; charset=utf-8");
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

    if (url.pathname === "/api/viral") {
      const tournament = await getTournamentOrFallback();
      return json(buildViralContent(tournament, url.origin));
    }

    if (url.pathname === "/api/content") {
      const tournament = await getTournamentOrFallback();
      return json({ stories: buildViralContent(tournament, url.origin).contentStories });
    }

    const contentStory = /^\/api\/content\/(.+)$/.exec(url.pathname);
    if (contentStory) {
      const tournament = await getTournamentOrFallback();
      const content = buildViralContent(tournament, url.origin);
      const story =
        content.contentStories.find((item) => item.slug === decodeURIComponent(contentStory[1])) ??
        buildViralContent(fallbackData, url.origin).contentStories.find((item) => item.slug === decodeURIComponent(contentStory[1]));
      if (!story) return json({ error: "The requested story was not found." }, 404, "no-store");
      return json(story);
    }

    if (url.pathname === "/api/automation/digest") {
      return json(await buildAutomationDigest(url.origin), 200, "no-store");
    }

    if (url.pathname === "/api/social/outbox") {
      const tournament = await getTournamentOrFallback();
      return json({
        mode: "draft",
        generatedAt: new Date().toISOString(),
        posts: buildPlatformOutbox(buildViralContent(tournament, url.origin)),
      }, 200, "no-store");
    }

    const matchCard = /^\/api\/cards\/match\/(.+)\.svg$/.exec(url.pathname);
    if (matchCard) {
      const tournament = await getTournamentOrFallback();
      const match =
        tournament.matches.find((item) => item.id === decodeURIComponent(matchCard[1])) ??
        fallbackData.matches.find((item) => item.id === decodeURIComponent(matchCard[1]));
      if (!match) return svg(baseCard(svgHeader("Prediction", "Match not found")), 404, "no-store");
      return svg(predictionCard(match, request));
    }

    const contentCard = /^\/api\/cards\/content\/(.+)\.svg$/.exec(url.pathname);
    if (contentCard) {
      const tournament = await getTournamentOrFallback();
      const content = buildViralContent(tournament, url.origin);
      const story =
        content.contentStories.find((item) => item.slug === decodeURIComponent(contentCard[1])) ??
        buildViralContent(fallbackData, url.origin).contentStories.find((item) => item.slug === decodeURIComponent(contentCard[1]));
      if (!story) return svg(baseCard(svgHeader("Content story", "Story not found")), 404, "no-store");
      return svg(contentStoryCard(story.title, story.summary, story.phase));
    }

    if (url.pathname === "/api/cards/upsets.svg") {
      const tournament = await getTournamentOrFallback();
      const content = buildViralContent(tournament, url.origin);
      return svg(
        listCard(
          "Upset meter",
          "Biggest surprises",
          content.upsets.map((item, index) => [
            `${index + 1}. ${item.title}`,
            `${item.score} · score ${item.upsetScore}`,
          ]),
        ),
      );
    }

    if (url.pathname === "/api/cards/power-rankings.svg") {
      const tournament = await getTournamentOrFallback();
      const content = buildViralContent(tournament, url.origin);
      return svg(
        listCard(
          "Daily rankings",
          "Top teams right now",
          content.powerRankings.map((team) => [
            `${team.rank}. ${team.teamName}`,
            `${team.score} · ${team.movementLabel}`,
          ]),
        ),
      );
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (url.pathname === "/api/goal-impact" && request.method === "POST") {
      type GoalImpactBody = {
        event: GoalEvent;
        advancementBefore: Record<string, number>;
        advancementAfter: Record<string, number>;
        championshipBefore: Record<string, number>;
        championshipAfter: Record<string, number>;
      };
      const body = await request.json() as GoalImpactBody;
      const tournament = await getTournamentOrFallback();
      const report = buildGoalImpactContent(
        body.event,
        new Map(Object.entries(body.advancementBefore)),
        new Map(Object.entries(body.advancementAfter)),
        new Map(Object.entries(body.championshipBefore)),
        new Map(Object.entries(body.championshipAfter)),
        tournament.teams,
        url.origin,
      );
      return json(report, 200, "no-store");
    }

    if (url.pathname === "/api/telegraph/publish" && request.method === "POST") {
      type TelegraphPublishBody = {
        title: string;
        authorName?: string;
        content: unknown[];
      };
      const body = await request.json() as TelegraphPublishBody;
      const accountRes = await fetch(
        `https://api.telegra.ph/createAccount?short_name=Touchline26&author_name=${encodeURIComponent(body.authorName ?? "Touchline 26")}&author_url=${encodeURIComponent("https://touchline26.com")}`,
      );
      const account = await accountRes.json() as { ok: boolean; result?: { access_token: string } };
      if (!account.ok || !account.result?.access_token) {
        return json({ error: "Failed to create Telegraph account" }, 502, "no-store");
      }
      const pageRes = await fetch("https://api.telegra.ph/createPage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: account.result.access_token,
          title: body.title,
          author_name: body.authorName ?? "Touchline 26",
          author_url: "https://touchline26.com",
          content: body.content,
          return_content: false,
        }),
      });
      const page = await pageRes.json() as { ok: boolean; result?: { url: string } };
      if (!page.ok || !page.result?.url) {
        return json({ error: "Failed to publish Telegraph article" }, 502, "no-store");
      }
      return json({ url: page.result.url }, 200, "no-store");
    }

    // Serve SPA with injected og:image for social sharing routes
    if (env.ASSETS) {
      const ogCardUrl = resolveOgCardUrl(url.pathname, url.origin);
      const htmlResponse = await serveWithOgTags(env, url.origin, ogCardUrl);
      if (htmlResponse) return htmlResponse;
    }

    return json({ error: "The requested endpoint was not found." }, 404, "no-store");
  },

  scheduled(controller: ScheduledControllerLike, _env: Env, ctx: ExecutionContextLike) {
    ctx.waitUntil(
      buildAutomationDigest(DEFAULT_ORIGIN)
        .then((digest) => {
          console.log(JSON.stringify({
            event: "touchline26.automation.digest",
            cron: controller.cron,
            scheduledTime: controller.scheduledTime,
            generatedAt: digest.generatedAt,
            postCount: digest.posts.length,
            source: digest.source,
          }));
        })
        .catch((error) => {
          console.error(JSON.stringify({
            event: "touchline26.automation.digest_failed",
            cron: controller.cron,
            message: error instanceof Error ? error.message : "Unknown error",
          }));
        }),
    );
  },
};
