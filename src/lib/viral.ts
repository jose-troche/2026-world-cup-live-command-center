import type { GoalEvent, Group, Match, Standing, Team, TournamentData, WinProbability } from "../types";
import { expectedGoals, getRating, winProbability } from "./analytics";

export type ShareLink = {
  label: "X" | "Facebook" | "WhatsApp" | "Copy";
  url: string;
};

export type MatchPrediction = {
  matchId: string;
  title: string;
  subtitle: string;
  homeName: string;
  awayName: string;
  homePercent: number;
  drawPercent: number;
  awayPercent: number;
  favorite: string;
  cardUrl: string;
  pageUrl: string;
  shareText: string;
  shareLinks: ShareLink[];
};

export type WhatChangedItem = {
  matchId: string;
  title: string;
  teamName: string;
  opponentName: string;
  before: number;
  after: number;
  change: number;
  result: string;
  cardUrl: string;
};

export type UpsetItem = {
  matchId: string;
  title: string;
  winnerName: string;
  loserName: string;
  score: string;
  upsetScore: number;
  favoriteRating: number;
  winnerRating: number;
};

export type PowerRanking = {
  teamId: string;
  teamName: string;
  code: string;
  rank: number;
  score: number;
  movementLabel: string;
  note: string;
};

export type SocialPost = {
  phase: "before" | "during" | "after" | "daily";
  title: string;
  body: string;
  url: string;
  cardUrl: string;
};

export type ContentStory = {
  phase: "before" | "during" | "after" | "daily";
  slug: string;
  title: string;
  summary: string;
  body: string[];
  pageUrl: string;
  cardUrl: string;
  matchId?: string;
};

export type ViralContent = {
  generatedAt: string;
  prediction?: MatchPrediction;
  whatChanged: WhatChangedItem[];
  upsets: UpsetItem[];
  powerRankings: PowerRanking[];
  contentStories: ContentStory[];
  socialPosts: SocialPost[];
  seoPages: Array<{ title: string; path: string; description: string }>;
};

export type PlatformPost = {
  platform: "x" | "bluesky" | "whatsapp";
  text: string;
  charCount: number;
  charLimit: number;
  intentUrl: string | null;
  threads?: string[];
};

export type ChampionshipSwing = {
  teamId: string;
  teamName: string;
  teamCode: string;
  advancementBefore: number;
  advancementAfter: number;
  advancementDelta: number;
  championshipBefore: number;
  championshipAfter: number;
  championshipDelta: number;
};

export type GoalImpactReport = {
  event: GoalEvent;
  swings: ChampionshipSwing[];
  platformPosts: PlatformPost[];
  generatedAt: string;
};

type StandingSeed = Standing & { group: string };

const SITE_NAME = "Touchline 26";
const DEFAULT_ORIGIN = "https://touchline26.com";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundPercent(value: number) {
  return Math.round(value * 100);
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getMatchTime(match: Match) {
  if (match.utcDate) return Date.parse(match.utcDate);
  const [datePart, timePart = "00:00"] = match.localDate.split(" ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function absoluteUrl(origin: string, path: string) {
  const base = origin || DEFAULT_ORIGIN;
  return `${base.replace(/\/$/, "")}${path}`;
}

export function getMatchPath(match: Match) {
  return `/matches/${slugify(`${match.homeName}-${match.awayName}`)}`;
}

export function getTeamPath(team: Team) {
  return `/teams/${slugify(team.name)}`;
}

export function getGroupPath(groupName: string) {
  return `/groups/group-${slugify(groupName)}`;
}

export function getContentPath(slug: string) {
  return `/content/${slugify(slug)}`;
}

function getPredictionTitle(match: Match) {
  return `${match.homeName} vs ${match.awayName}`;
}

function mostLikely(probability: WinProbability, match: Match) {
  const entries = [
    { name: match.homeName, value: probability.home },
    { name: "Draw", value: probability.draw },
    { name: match.awayName, value: probability.away },
  ].sort((a, b) => b.value - a.value);
  return entries[0].name;
}

function buildShareLinks(text: string, pageUrl: string): ShareLink[] {
  return [
    {
      label: "X",
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text}\n${pageUrl}`)}`,
    },
    {
      label: "Facebook",
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`,
    },
    {
      label: "WhatsApp",
      url: `https://wa.me/?text=${encodeURIComponent(`${text} ${pageUrl}`)}`,
    },
    { label: "Copy", url: pageUrl },
  ];
}

export function buildMatchPrediction(match: Match, origin = DEFAULT_ORIGIN): MatchPrediction {
  const probability = winProbability(match);
  const pageUrl = absoluteUrl(origin, getMatchPath(match));
  const cardUrl = absoluteUrl(origin, `/api/cards/match/${encodeURIComponent(match.id)}.svg`);
  const title = getPredictionTitle(match);
  const shareText = `${title}: ${match.homeName} ${roundPercent(probability.home)}%, draw ${roundPercent(probability.draw)}%, ${match.awayName} ${roundPercent(probability.away)}%. Generated by ${SITE_NAME}.`;

  return {
    matchId: match.id,
    title,
    subtitle: match.status === "scheduled" ? "Pre-match win probability" : "Live win probability",
    homeName: match.homeName,
    awayName: match.awayName,
    homePercent: roundPercent(probability.home),
    drawPercent: roundPercent(probability.draw),
    awayPercent: roundPercent(probability.away),
    favorite: mostLikely(probability, match),
    cardUrl,
    pageUrl,
    shareText,
    shareLinks: buildShareLinks(shareText, pageUrl),
  };
}

function createEmptyStandings(teams: Team[]) {
  return new Map(
    teams.map((team) => [
      team.id,
      {
        teamId: team.id,
        group: team.group,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
      } satisfies StandingSeed,
    ]),
  );
}

function applyFinishedMatch(standings: Map<string, StandingSeed>, match: Match) {
  if (match.status !== "finished") return;
  const home = standings.get(match.homeId);
  const away = standings.get(match.awayId);
  if (!home || !away) return;

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

  home.goalDifference = home.goalsFor - home.goalsAgainst;
  away.goalDifference = away.goalsFor - away.goalsAgainst;
}

function standingsThrough(teams: Team[], matches: Match[], throughTime: number, includeAtTime: boolean) {
  const standings = createEmptyStandings(teams);
  matches
    .filter((match) => {
      const time = getMatchTime(match);
      return includeAtTime ? time <= throughTime : time < throughTime;
    })
    .sort((a, b) => getMatchTime(a) - getMatchTime(b))
    .forEach((match) => applyFinishedMatch(standings, match));
  return standings;
}

function estimateAdvanceChance(
  team: Team,
  standing: StandingSeed,
  groupRows: StandingSeed[],
  teamById: Map<string, Team>,
) {
  const ordered = [...groupRows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      getRating(teamById.get(b.teamId)?.name ?? "") - getRating(teamById.get(a.teamId)?.name ?? ""),
  );
  const position = ordered.findIndex((row) => row.teamId === team.id) + 1 || 4;
  const ratingBoost = (getRating(team.name) - 78) * 1.7;
  const stateBoost =
    standing.points * 14 +
    standing.goalDifference * 5 +
    standing.goalsFor * 1.5 -
    standing.played * 2 -
    Math.max(0, position - 2) * 11;
  return Math.round(clamp(35 + ratingBoost + stateBoost, 3, 98));
}

function estimateFromStandings(
  team: Team,
  standings: Map<string, StandingSeed>,
  teamById: Map<string, Team>,
) {
  const standing = standings.get(team.id);
  if (!standing) return 0;
  const groupRows = [...standings.values()].filter((row) => row.group === team.group);
  return estimateAdvanceChance(team, standing, groupRows, teamById);
}

export function buildWhatChanged(data: Pick<TournamentData, "teams" | "matches">, origin = DEFAULT_ORIGIN) {
  const teamById = new Map(data.teams.map((team) => [team.id, team]));
  return data.matches
    .filter((match) => match.status === "finished")
    .sort((a, b) => getMatchTime(b) - getMatchTime(a))
    .flatMap((match): WhatChangedItem[] => {
      const before = standingsThrough(data.teams, data.matches, getMatchTime(match), false);
      const after = standingsThrough(data.teams, data.matches, getMatchTime(match), true);
      const candidates = [teamById.get(match.homeId), teamById.get(match.awayId)].filter(
        (team): team is Team => Boolean(team),
      );

      return candidates.map((team) => {
        const opponentName = team.id === match.homeId ? match.awayName : match.homeName;
        const beforeChance = estimateFromStandings(team, before, teamById);
        const afterChance = estimateFromStandings(team, after, teamById);
        return {
          matchId: match.id,
          title: `${match.homeName} ${match.homeScore}-${match.awayScore} ${match.awayName}`,
          teamName: team.name,
          opponentName,
          before: beforeChance,
          after: afterChance,
          change: afterChance - beforeChance,
          result: `${match.homeName} ${match.homeScore}-${match.awayScore} ${match.awayName}`,
          cardUrl: absoluteUrl(origin, `/api/cards/what-changed/${encodeURIComponent(match.id)}.svg`),
        };
      });
    })
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 8);
}

export function buildUpsetMeter(data: Pick<TournamentData, "matches">) {
  return data.matches
    .filter((match) => match.status === "finished" && match.homeScore !== match.awayScore)
    .map((match): UpsetItem => {
      const homeWon = match.homeScore > match.awayScore;
      const winnerName = homeWon ? match.homeName : match.awayName;
      const loserName = homeWon ? match.awayName : match.homeName;
      const winnerRating = getRating(winnerName);
      const favoriteRating = Math.max(getRating(match.homeName), getRating(match.awayName));
      const margin = Math.abs(match.homeScore - match.awayScore);
      const ratingGap = Math.max(0, favoriteRating - winnerRating);
      return {
        matchId: match.id,
        title: `${winnerName} over ${loserName}`,
        winnerName,
        loserName,
        score: `${match.homeScore}-${match.awayScore}`,
        upsetScore: Math.round(ratingGap * 4 + margin * 6),
        favoriteRating,
        winnerRating,
      };
    })
    .filter((item) => item.upsetScore > 0)
    .sort((a, b) => b.upsetScore - a.upsetScore)
    .slice(0, 10);
}

function teamStanding(team: Team, groups: Group[]) {
  return groups.find((group) => group.name === team.group)?.standings.find((row) => row.teamId === team.id);
}

export function buildPowerRankings(data: Pick<TournamentData, "teams" | "groups">, limit = 10) {
  return data.teams
    .map((team): Omit<PowerRanking, "rank"> => {
      const standing = teamStanding(team, data.groups);
      const points = standing?.points ?? 0;
      const goalDifference = standing?.goalDifference ?? 0;
      const formScore = points * 4 + goalDifference * 2 + (standing?.goalsFor ?? 0);
      const score = getRating(team.name) * 0.72 + formScore;
      const movement = formScore >= 10 ? "rising fast" : formScore >= 4 ? "up" : formScore <= -2 ? "under pressure" : "steady";
      const note = standing?.played
        ? `${points} pts, ${goalDifference >= 0 ? "+" : ""}${goalDifference} GD`
        : "pre-tournament model strength";
      return {
        teamId: team.id,
        teamName: team.name,
        code: team.code,
        score: Number(score.toFixed(1)),
        movementLabel: movement,
        note,
      };
    })
    .sort((a, b) => b.score - a.score || a.teamName.localeCompare(b.teamName))
    .slice(0, limit)
    .map((team, index) => ({ ...team, rank: index + 1 }));
}

function selectFeaturedMatch(matches: Match[]) {
  const live = matches.find((match) => match.status === "live");
  if (live) return live;
  return (
    matches
      .filter((match) => match.status === "scheduled")
      .sort((a, b) => getMatchTime(a) - getMatchTime(b))[0] ??
    matches
      .filter((match) => match.status === "finished")
      .sort((a, b) => getMatchTime(b) - getMatchTime(a))[0]
  );
}

function buildSocialPosts(content: Omit<ViralContent, "socialPosts">, origin: string): SocialPost[] {
  const posts: SocialPost[] = [];

  if (content.prediction) {
    posts.push({
      phase: "before",
      title: content.prediction.title,
      body: content.prediction.shareText,
      url: content.prediction.pageUrl,
      cardUrl: content.prediction.cardUrl,
    });
  }

  const topChange = content.whatChanged[0];
  if (topChange) {
    posts.push({
      phase: "after",
      title: "What Changed?",
      body: `${topChange.teamName}'s advancement outlook moved from ${topChange.before}% to ${topChange.after}% after ${topChange.result}.`,
      url: absoluteUrl(origin, `/what-changed/${encodeURIComponent(topChange.matchId)}`),
      cardUrl: topChange.cardUrl,
    });
  }

  const topUpset = content.upsets[0];
  if (topUpset) {
    posts.push({
      phase: "after",
      title: "Upset Meter",
      body: `${topUpset.title} leads the Touchline 26 upset meter after a ${topUpset.score} result.`,
      url: absoluteUrl(origin, "/upsets"),
      cardUrl: absoluteUrl(origin, "/api/cards/upsets.svg"),
    });
  }

  if (content.powerRankings.length) {
    posts.push({
      phase: "daily",
      title: "Daily Power Rankings",
      body: `Touchline 26 Power Rankings: 1. ${content.powerRankings[0].teamName}, 2. ${content.powerRankings[1]?.teamName ?? "TBD"}, 3. ${content.powerRankings[2]?.teamName ?? "TBD"}.`,
      url: absoluteUrl(origin, "/power-rankings"),
      cardUrl: absoluteUrl(origin, "/api/cards/power-rankings.svg"),
    });
  }

  const liveStory = content.contentStories.find((story) => story.phase === "during");
  if (liveStory) {
    posts.push({
      phase: "during",
      title: liveStory.title,
      body: liveStory.summary,
      url: liveStory.pageUrl,
      cardUrl: liveStory.cardUrl,
    });
  }

  return posts;
}

function buildContentCardUrl(origin: string, slug: string) {
  return absoluteUrl(origin, `/api/cards/content/${encodeURIComponent(slugify(slug))}.svg`);
}

export function buildContentStories(
  data: Pick<TournamentData, "matches" | "teams" | "groups">,
  origin = DEFAULT_ORIGIN,
  whatChanged = buildWhatChanged(data, origin),
  powerRankings = buildPowerRankings(data),
) {
  const stories: ContentStory[] = [];
  const scheduled = data.matches
    .filter((match) => match.status === "scheduled")
    .sort((a, b) => getMatchTime(a) - getMatchTime(b))
    .slice(0, 6);
  const live = data.matches
    .filter((match) => match.status === "live")
    .sort((a, b) => getMatchTime(a) - getMatchTime(b))
    .slice(0, 4);
  const finished = data.matches
    .filter((match) => match.status === "finished")
    .sort((a, b) => getMatchTime(b) - getMatchTime(a))
    .slice(0, 6);

  for (const match of scheduled) {
    const prediction = buildMatchPrediction(match, origin);
    const xg = expectedGoals(match.homeName, match.awayName);
    const slug = `${slugify(`${match.homeName}-${match.awayName}`)}-prediction`;
    stories.push({
      phase: "before",
      slug,
      title: `${match.homeName} vs ${match.awayName}: prediction and probabilities`,
      summary: `${prediction.favorite} leads the model before kickoff, with ${match.homeName} at ${prediction.homePercent}%, draw at ${prediction.drawPercent}%, and ${match.awayName} at ${prediction.awayPercent}%.`,
      body: [
        `The Touchline 26 pre-match model gives ${match.homeName} a ${prediction.homePercent}% win probability, the draw ${prediction.drawPercent}%, and ${match.awayName} ${prediction.awayPercent}%.`,
        `The baseline chance-quality projection is ${xg.home.toFixed(2)} expected goals for ${match.homeName} and ${xg.away.toFixed(2)} for ${match.awayName}.`,
        `Group ${match.group || "stage"} context will update as live scores and standings move.`,
      ],
      pageUrl: absoluteUrl(origin, getContentPath(slug)),
      cardUrl: buildContentCardUrl(origin, slug),
      matchId: match.id,
    });
  }

  for (const match of live) {
    const prediction = buildMatchPrediction(match, origin);
    const slug = `${slugify(`${match.homeName}-${match.awayName}`)}-${match.minute >= 45 ? "halftime" : "live"}-analytics`;
    stories.push({
      phase: "during",
      slug,
      title: `${match.homeName} vs ${match.awayName}: ${match.minute >= 45 ? "halftime" : "live"} analytics`,
      summary: `${match.minute}' update: ${match.homeName} ${match.homeScore}-${match.awayScore} ${match.awayName}. ${prediction.favorite} is now the most likely outcome.`,
      body: [
        `The match is at ${match.minute}' with ${match.homeName} ${match.homeScore}-${match.awayScore} ${match.awayName}.`,
        `Current result probabilities: ${match.homeName} ${prediction.homePercent}%, draw ${prediction.drawPercent}%, ${match.awayName} ${prediction.awayPercent}%.`,
        "The model reacts to score, time remaining, and team-strength priors; it is directional analytics, not betting advice.",
      ],
      pageUrl: absoluteUrl(origin, getContentPath(slug)),
      cardUrl: buildContentCardUrl(origin, slug),
      matchId: match.id,
    });
  }

  for (const match of finished) {
    const matchChanges = whatChanged.filter((item) => item.matchId === match.id);
    const topChange = matchChanges.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
    const slug = `${slugify(`${match.homeName}-${match.awayName}`)}-what-changed`;
    stories.push({
      phase: "after",
      slug,
      title: `What changed after ${match.homeName} ${match.homeScore}-${match.awayScore} ${match.awayName}`,
      summary: topChange
        ? `${topChange.teamName}'s advancement outlook moved from ${topChange.before}% to ${topChange.after}% after the result.`
        : `${match.homeName} ${match.homeScore}-${match.awayScore} ${match.awayName} is ready for post-match probability review.`,
      body: [
        `Final: ${match.homeName} ${match.homeScore}-${match.awayScore} ${match.awayName}.`,
        topChange
          ? `${topChange.teamName} had the largest modeled swing, moving ${topChange.change > 0 ? "up" : "down"} ${Math.abs(topChange.change)} percentage points.`
          : "The largest probability swing will appear once both teams can be mapped to the group model.",
        "Post-match content is generated from standings deltas and model probabilities so it can publish quickly after the final whistle.",
      ],
      pageUrl: absoluteUrl(origin, getContentPath(slug)),
      cardUrl: buildContentCardUrl(origin, slug),
      matchId: match.id,
    });
  }

  if (powerRankings.length) {
    const slug = "daily-world-cup-power-rankings";
    stories.push({
      phase: "daily",
      slug,
      title: "Daily World Cup power rankings",
      summary: `${powerRankings[0].teamName} leads today's Touchline 26 power rankings, ahead of ${powerRankings[1]?.teamName ?? "the field"}.`,
      body: [
        `Top three: ${powerRankings.slice(0, 3).map((team) => `${team.rank}. ${team.teamName}`).join(", ")}.`,
        "The ranking blends model strength with current group-stage form, goal difference, and scoring output.",
        "Daily rankings are designed to create a recurring argument-friendly snapshot as the tournament changes.",
      ],
      pageUrl: absoluteUrl(origin, getContentPath(slug)),
      cardUrl: buildContentCardUrl(origin, slug),
    });
  }

  return stories;
}

function buildSeoPages(data: Pick<TournamentData, "teams" | "groups" | "matches">, contentStories: ContentStory[]) {
  const matchPages = data.matches.slice(0, 24).map((match) => ({
    title: `${match.homeName} vs ${match.awayName} prediction`,
    path: getMatchPath(match),
    description: `Win probability, match context, and shareable World Cup 2026 analytics for ${match.homeName} vs ${match.awayName}.`,
  }));
  const teamPages = data.teams.slice(0, 48).map((team) => ({
    title: `${team.name} World Cup 2026 probabilities`,
    path: getTeamPath(team),
    description: `Live standings context, team strength, and advancement outlook for ${team.name}.`,
  }));
  const groupPages = data.groups.map((group) => ({
    title: `World Cup 2026 Group ${group.name} standings and probabilities`,
    path: getGroupPath(group.name),
    description: `Live Group ${group.name} table, qualification probability, and World Cup 2026 model notes.`,
  }));
  const contentPages = contentStories.map((story) => ({
    title: story.title,
    path: getContentPath(story.slug),
    description: story.summary,
  }));
  return [...matchPages, ...teamPages, ...groupPages, ...contentPages];
}

function formatPlatformPost(
  text: string,
  url: string,
  platform: PlatformPost["platform"],
): PlatformPost {
  const limits: Record<PlatformPost["platform"], number> = {
    x: 280,
    bluesky: 300,
    whatsapp: 0,
  };
  const charLimit = limits[platform];

  const intentUrls: Record<PlatformPost["platform"], string | null> = {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text}\n${url}`)}`,
    bluesky: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text}\n${url}`)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
  };

  if (platform === "x" && charLimit > 0) {
    const full = `${text}\n${url}`;
    if (full.length <= charLimit) {
      return { platform, text: full, charCount: full.length, charLimit, intentUrl: intentUrls.x };
    }
    // Split into 2 threads: score line + odds line, then url + hashtags
    const lines = text.split("\n");
    const tweet1 = lines.slice(0, 2).join("\n");
    const tweet2 = `${lines.slice(2).join("\n")}\n${url}`.trim();
    return {
      platform,
      text: tweet1,
      charCount: tweet1.length,
      charLimit,
      intentUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet1)}`,
      threads: [tweet1, tweet2],
    };
  }

  const fullText = `${text}\n${url}`;
  return {
    platform,
    text: fullText,
    charCount: fullText.length,
    charLimit,
    intentUrl: intentUrls[platform],
  };
}

export function buildGoalImpactContent(
  event: GoalEvent,
  advancementBefore: Map<string, number>,
  advancementAfter: Map<string, number>,
  championshipBefore: Map<string, number>,
  championshipAfter: Map<string, number>,
  teams: Team[],
  origin = DEFAULT_ORIGIN,
): GoalImpactReport {
  const teamByName = new Map(teams.map((team) => [team.name, team]));
  const homeTeam = teamByName.get(event.homeName);
  const awayTeam = teamByName.get(event.awayName);

  const swings: ChampionshipSwing[] = [homeTeam, awayTeam]
    .filter((team): team is Team => Boolean(team))
    .map((team) => ({
      teamId: team.id,
      teamName: team.name,
      teamCode: team.code,
      advancementBefore: advancementBefore.get(team.id) ?? 0,
      advancementAfter: advancementAfter.get(team.id) ?? 0,
      advancementDelta: (advancementAfter.get(team.id) ?? 0) - (advancementBefore.get(team.id) ?? 0),
      championshipBefore: championshipBefore.get(team.id) ?? 0,
      championshipAfter: championshipAfter.get(team.id) ?? 0,
      championshipDelta: (championshipAfter.get(team.id) ?? 0) - (championshipBefore.get(team.id) ?? 0),
    }));

  const scoreLine = `GOAL! ${event.homeName} ${event.scoreAfter.home}-${event.scoreAfter.away} ${event.awayName} (${event.minute}')`;
  const homeSwing = swings.find((s) => s.teamName === event.homeName);
  const awaySwing = swings.find((s) => s.teamName === event.awayName);

  const oddsLine = [
    homeSwing && `${event.homeName}: title ${homeSwing.championshipBefore}%→${homeSwing.championshipAfter}% (${homeSwing.championshipDelta >= 0 ? "+" : ""}${homeSwing.championshipDelta}%)`,
    awaySwing && `${event.awayName}: title ${awaySwing.championshipBefore}%→${awaySwing.championshipAfter}% (${awaySwing.championshipDelta >= 0 ? "+" : ""}${awaySwing.championshipDelta}%)`,
  ].filter(Boolean).join(" | ");

  const hashtags = "#WorldCup2026 #Touchline26";
  const coreText = `${scoreLine}\n${oddsLine}\n${hashtags}`;
  const pageUrl = absoluteUrl(origin, `/matches/${slugify(`${event.homeName}-${event.awayName}`)}`)

  const platforms: PlatformPost["platform"][] = ["x", "bluesky", "whatsapp"];
  const platformPosts = platforms.map((platform) => formatPlatformPost(coreText, pageUrl, platform));

  return {
    event,
    swings,
    platformPosts,
    generatedAt: new Date().toISOString(),
  };
}

export function buildViralContent(data: TournamentData, origin = DEFAULT_ORIGIN): ViralContent {
  const featuredMatch = selectFeaturedMatch(data.matches);
  const whatChanged = buildWhatChanged(data, origin);
  const upsets = buildUpsetMeter(data);
  const powerRankings = buildPowerRankings(data);
  const contentStories = buildContentStories(data, origin, whatChanged, powerRankings);
  const contentWithoutPosts = {
    generatedAt: data.updatedAt,
    prediction: featuredMatch ? buildMatchPrediction(featuredMatch, origin) : undefined,
    whatChanged,
    upsets,
    powerRankings,
    contentStories,
    seoPages: buildSeoPages(data, contentStories),
  };

  return {
    ...contentWithoutPosts,
    socialPosts: buildSocialPosts(contentWithoutPosts, origin),
  };
}
