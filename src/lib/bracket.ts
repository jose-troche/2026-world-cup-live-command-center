import type { Group, Match, Stadium, Team } from "../types";
import { getRating } from "./analytics";

export type GroupRole = "winnerId" | "runnerUpId" | "thirdId";

export type GroupSelection = {
  winnerId: string;
  runnerUpId: string;
  thirdId: string;
  thirdAdvances: boolean;
};

export type GroupSelections = Record<string, GroupSelection>;

export type KnockoutMatchMeta = {
  matchId: string;
  localDate: string;
  utcDate?: string;
  venueName: string;
  status: Match["status"];
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
};

export type BracketMatchMetas = {
  round32: KnockoutMatchMeta[];
  round16: KnockoutMatchMeta[];
  quarters: KnockoutMatchMeta[];
  semis: KnockoutMatchMeta[];
  final: KnockoutMatchMeta[];
};

// The ESPN Round of 32 matches (sorted by date, 0-indexed) define these pairings in R16:
//   R16-1: R32[0] vs R32[2],   R16-2: R32[1] vs R32[4],
//   R16-3: R32[3] vs R32[5],   R16-4: R32[6] vs R32[7],
//   R16-5: R32[10] vs R32[11], R16-6: R32[8] vs R32[9],
//   R16-7: R32[13] vs R32[15], R16-8: R32[12] vs R32[14]
//
// We reorder R32 display so sequential pairing produces R16, QF, SF, Final
// in the correct ESPN bracket order (QF-1=R16-1+R16-2, QF-2=R16-5+R16-6, etc.)
export const R32_DISPLAY_ORDER = [0, 2, 1, 4, 10, 11, 8, 9, 3, 5, 6, 7, 13, 15, 12, 14];

// ESPN R16 matches (sorted by date, 0-indexed) produce this display ordering:
// display[0]=R16-1, display[1]=R16-2, display[2]=R16-5, display[3]=R16-6,
// display[4]=R16-3, display[5]=R16-4, display[6]=R16-7, display[7]=R16-8
export const R16_DISPLAY_ORDER = [0, 1, 4, 5, 2, 3, 6, 7];

export function rankTeams(teams: Team[]) {
  return [...teams].sort(
    (a, b) => getRating(b.name) - getRating(a.name) || a.name.localeCompare(b.name),
  );
}

function rankTeamsByStandings(teams: Team[], standings: Group["standings"]) {
  const standingByTeam = new Map(standings.map((s) => [s.teamId, s]));
  return [...teams].sort((a, b) => {
    const sa = standingByTeam.get(a.id);
    const sb = standingByTeam.get(b.id);
    if (!sa || !sb) return getRating(b.name) - getRating(a.name);
    return (
      sb.points - sa.points ||
      sb.goalDifference - sa.goalDifference ||
      sb.goalsFor - sa.goalsFor ||
      getRating(b.name) - getRating(a.name) ||
      a.name.localeCompare(b.name)
    );
  });
}

export function buildDefaultGroupSelections(teams: Team[], groups?: Group[]): GroupSelections {
  const groupMap = new Map((groups ?? []).map((g) => [g.name, g]));

  const groupedTeams = teams.reduce<Record<string, Team[]>>((result, team) => {
    if (!team.group) return result;
    (result[team.group] ??= []).push(team);
    return result;
  }, {});

  const selections = Object.fromEntries(
    Object.entries(groupedTeams)
      .filter(([group, groupTeams]) => group && groupTeams.length)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, groupTeams]) => {
        const groupData = groupMap.get(group);
        const hasRealStandings =
          groupData && groupData.standings.some((s) => s.played > 0);
        const ranked = hasRealStandings
          ? rankTeamsByStandings(groupTeams, groupData.standings)
          : rankTeams(groupTeams);
        return [
          group,
          {
            winnerId: ranked[0]?.id ?? "",
            runnerUpId: ranked[1]?.id ?? "",
            thirdId: ranked[2]?.id ?? "",
            thirdAdvances: false,
          },
        ];
      }),
  );

  // Pick the 8 best third-place teams by actual points/GD/GF, then model rating
  const thirdPlaceEntries = Object.entries(selections).map(([group, sel]) => {
    const groupData = groupMap.get(group);
    const thirdTeam = teams.find((t) => t.id === sel.thirdId);
    const standing = groupData?.standings.find((s) => s.teamId === sel.thirdId);
    return { group, sel, thirdTeam, standing };
  });

  const hasAnyStandings = thirdPlaceEntries.some((e) => (e.standing?.played ?? 0) > 0);

  thirdPlaceEntries
    .sort((a, b) => {
      if (hasAnyStandings) {
        const sa = a.standing;
        const sb = b.standing;
        if (sa && sb) {
          return (
            sb.points - sa.points ||
            sb.goalDifference - sa.goalDifference ||
            sb.goalsFor - sa.goalsFor
          );
        }
        if (sa) return -1;
        if (sb) return 1;
      }
      return (
        getRating(b.thirdTeam?.name ?? "") - getRating(a.thirdTeam?.name ?? "")
      );
    })
    .slice(0, 8)
    .forEach(({ group }) => {
      selections[group].thirdAdvances = true;
    });

  return selections;
}

export function updateGroupRole(
  selection: GroupSelection,
  role: GroupRole,
  teamId: string,
): GroupSelection {
  const next = { ...selection };
  const previousId = next[role];
  const otherRole = (["winnerId", "runnerUpId", "thirdId"] as GroupRole[]).find(
    (candidate) => candidate !== role && next[candidate] === teamId,
  );

  next[role] = teamId;
  if (otherRole) next[otherRole] = previousId;
  return next;
}

export function getQualifiedTeams(teams: Team[], selections: GroupSelections) {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const ids = Object.keys(selections)
    .sort()
    .flatMap((group) => {
      const selection = selections[group];
      return [
        selection.winnerId,
        selection.runnerUpId,
        ...(selection.thirdAdvances ? [selection.thirdId] : []),
      ];
    });

  return ids.map((id) => teamById.get(id)).filter((team): team is Team => Boolean(team));
}

// Kept for backward compatibility (tests still cover this)
const bracketSeedOrder = [
  0, 31, 15, 16, 7, 24, 8, 23,
  3, 28, 12, 19, 4, 27, 11, 20,
  1, 30, 14, 17, 6, 25, 9, 22,
  2, 29, 13, 18, 5, 26, 10, 21,
];

export function seedRoundOf32(teams: Team[]) {
  const ranked = rankTeams(teams).slice(0, 32);
  if (ranked.length !== 32) return ranked;
  return bracketSeedOrder.map((index) => ranked[index]);
}

export function pairTeams(teams: Team[]) {
  return Array.from({ length: Math.ceil(teams.length / 2) }, (_, index) =>
    teams.slice(index * 2, index * 2 + 2),
  );
}

// Parses "Group A Winner" / "Group B 2nd Place" / "Group C 3rd Place" labels
// and resolves to a team ID from current group selections.
function resolveGroupPositionId(
  label: string,
  selections: GroupSelections,
): string | undefined {
  const winnerMatch = /^Group\s+([A-L])\s+(?:Winner|1st\s+Place)$/i.exec(label);
  if (winnerMatch) return selections[winnerMatch[1].toUpperCase()]?.winnerId;

  const runnerUpMatch = /^Group\s+([A-L])\s+(?:2nd\s+Place|Runner.?[Uu]p)$/i.exec(label);
  if (runnerUpMatch) return selections[runnerUpMatch[1].toUpperCase()]?.runnerUpId;

  const thirdMatch = /^Third\s+Place\s+Group\s+([A-L\/]+)$/i.exec(label);
  if (thirdMatch) {
    const groups = thirdMatch[1].split("/").map((g) => g.trim().toUpperCase());
    // Find which group in the list has its 3rd place advancing
    const advancingGroup = groups.find((g) => selections[g]?.thirdAdvances);
    if (advancingGroup) return selections[advancingGroup].thirdId;
  }

  return undefined;
}

export function resolveKnockoutTeam(
  matchTeamId: string,
  matchTeamName: string,
  selections: GroupSelections,
  teamById: Map<string, Team>,
): Team | undefined {
  // If it's a real team in our known teams map
  const direct = teamById.get(matchTeamId);
  if (direct) return direct;

  // Otherwise try resolving a group-position placeholder
  const resolvedId = resolveGroupPositionId(matchTeamName, selections);
  if (resolvedId) return teamById.get(resolvedId);

  return undefined;
}

function sortByDate(matches: Match[]) {
  return [...matches].sort((a, b) => {
    const ta = a.utcDate ? Date.parse(a.utcDate) : 0;
    const tb = b.utcDate ? Date.parse(b.utcDate) : 0;
    return ta - tb;
  });
}

function toMatchMeta(match: Match, stadiumById: Map<string, Stadium>): KnockoutMatchMeta {
  return {
    matchId: match.id,
    localDate: match.localDate,
    utcDate: match.utcDate,
    venueName: stadiumById.get(match.stadiumId)?.name ?? "",
    status: match.status,
    homeId: match.homeId,
    awayId: match.awayId,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
  };
}

export function buildBracketMatchMetas(matches: Match[], stadiums: Stadium[]): BracketMatchMetas {
  const stadiumById = new Map(stadiums.map((s) => [s.id, s]));

  function roundMetas(type: string, displayOrder?: number[]) {
    const sorted = sortByDate(matches.filter((m) => m.type === type));
    if (displayOrder) {
      return displayOrder.map((i) => sorted[i]).filter(Boolean).map((m) => toMatchMeta(m, stadiumById));
    }
    return sorted.map((m) => toMatchMeta(m, stadiumById));
  }

  return {
    round32: roundMetas("round-of-32", R32_DISPLAY_ORDER),
    round16: roundMetas("round-of-16", R16_DISPLAY_ORDER),
    quarters: roundMetas("quarterfinals"),
    semis: roundMetas("semifinals"),
    final: roundMetas("final"),
  };
}

// Build the flat R32 team display array (32 teams, in draw order)
// by resolving each slot from ESPN match data and group selections.
export function buildR32DisplayTeams(
  matches: Match[],
  selections: GroupSelections,
  teamById: Map<string, Team>,
): Array<Team | undefined> {
  const r32Sorted = sortByDate(matches.filter((m) => m.type === "round-of-32"));
  return R32_DISPLAY_ORDER.flatMap((i) => {
    const match = r32Sorted[i];
    if (!match) return [undefined, undefined];
    return [
      resolveKnockoutTeam(match.homeId, match.homeName, selections, teamById),
      resolveKnockoutTeam(match.awayId, match.awayName, selections, teamById),
    ];
  });
}

// Pre-fill picks for any knockout rounds that are already finished.
export function prefillPicksFromMatches(
  matches: Match[],
  teamById: Map<string, Team>,
): { round32: string[]; round16: string[]; quarters: string[]; semis: string[]; final: string[] } {
  const picks: { round32: string[]; round16: string[]; quarters: string[]; semis: string[]; final: string[] } = {
    round32: [],
    round16: [],
    quarters: [],
    semis: [],
    final: [],
  };

  function fillRound(type: string, key: keyof typeof picks, displayOrder?: number[]) {
    const sorted = sortByDate(matches.filter((m) => m.type === type));
    const display = displayOrder ? displayOrder.map((i) => sorted[i]).filter(Boolean) : sorted;
    display.forEach((match, displayIdx) => {
      if (match.status !== "finished") return;
      const winnerId = match.homeScore >= match.awayScore ? match.homeId : match.awayId;
      const winner = teamById.get(winnerId);
      if (winner) picks[key][displayIdx] = winner.id;
    });
  }

  fillRound("round-of-32", "round32", R32_DISPLAY_ORDER);
  fillRound("round-of-16", "round16", R16_DISPLAY_ORDER);
  fillRound("quarterfinals", "quarters");
  fillRound("semifinals", "semis");
  fillRound("final", "final");

  return picks;
}

export function formatBracketDate(localDate: string): string {
  // localDate is "MM/DD/YYYY HH:MM" in ET
  const parts = localDate.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!parts) return localDate;
  const [, month, day, , hour, minute] = parts;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = monthNames[parseInt(month, 10) - 1] ?? month;
  const h = parseInt(hour, 10);
  const amPm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${monthName} ${parseInt(day, 10)}, ${h12}:${minute} ${amPm} ET`;
}
