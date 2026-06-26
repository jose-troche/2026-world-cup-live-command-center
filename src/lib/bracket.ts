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

// The ESPN Round of 32 matches (sorted by date, 0-indexed) define these pairings in R16.
// Note: date order ≠ FIFA bracket position order (e.g. Brazil/Japan = M76 but 2nd by date).
//   R16-1 (Houston):      R32[0] vs R32[3],   R16-2 (Philadelphia): R32[2] vs R32[5],
//   R16-3 (NY/NJ):        R32[1] vs R32[4],   R16-4 (Mexico City):  R32[6] vs R32[7],
//   R16-5 (Dallas):       R32[11] vs R32[10], R16-6 (Seattle):       R32[9] vs R32[8],
//   R16-7 (Atlanta):      R32[14] vs R32[13], R16-8 (Vancouver):     R32[12] vs R32[15]
//
// QF bracket order: QF-1=R16-1+R16-2 (Houston+Philadelphia), QF-2=R16-5+R16-6 (Dallas+Seattle),
//   QF-3=R16-3+R16-4 (NY/NJ+Mexico), QF-4=R16-7+R16-8 (Atlanta+Vancouver)
export const R32_DISPLAY_ORDER = [0, 3, 2, 5, 11, 10, 9, 8, 1, 4, 6, 7, 14, 13, 12, 15];

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

// A group is "complete" when all 4 teams have played all 3 group-stage matches.
export function isGroupComplete(groupName: string, groups: Group[]): boolean {
  const group = groups.find((g) => g.name === groupName);
  if (!group || group.standings.length === 0) return false;
  return group.standings.every((s) => s.played >= 3);
}

// Resolves a group-position label to a team ID.
// `strict=true` (default for display): only resolves when the group is fully complete.
// `strict=false` (for simulation): resolves from current standings regardless of completion.
// Third-place slots are always left unresolved here — ESPN fills them directly once confirmed.
function resolveGroupPositionId(
  label: string,
  selections: GroupSelections,
  groups: Group[],
  strict: boolean,
): string | undefined {
  const winnerMatch = /^Group\s+([A-L])\s+(?:Winner|1st\s+Place)$/i.exec(label);
  if (winnerMatch) {
    const g = winnerMatch[1].toUpperCase();
    if (!strict || isGroupComplete(g, groups)) return selections[g]?.winnerId;
    return undefined;
  }

  const runnerUpMatch = /^Group\s+([A-L])\s+(?:2nd\s+Place|Runner.?[Uu]p)$/i.exec(label);
  if (runnerUpMatch) {
    const g = runnerUpMatch[1].toUpperCase();
    if (!strict || isGroupComplete(g, groups)) return selections[g]?.runnerUpId;
    return undefined;
  }

  // Third-place slots: only resolve for simulation (not for display), using thirdAdvances flag.
  const thirdMatch = /^Third\s+Place\s+Group\s+([A-L\/]+)$/i.exec(label);
  if (thirdMatch && !strict) {
    const gs = thirdMatch[1].split("/").map((g) => g.trim().toUpperCase());
    const advancing = gs.find((g) => selections[g]?.thirdAdvances);
    if (advancing) return selections[advancing].thirdId;
  }

  return undefined;
}

// Resolves a knockout match slot to a Team.
// For DISPLAY: strict=true — only shows confirmed teams (group complete or ESPN direct).
// For SIMULATION: strict=false — uses current standings for all groups.
export function resolveKnockoutTeam(
  matchTeamId: string,
  matchTeamName: string,
  selections: GroupSelections,
  teamById: Map<string, Team>,
  groups: Group[] = [],
  strict = true,
): Team | undefined {
  const direct = teamById.get(matchTeamId);
  if (direct) return direct;

  const resolvedId = resolveGroupPositionId(matchTeamName, selections, groups, strict);
  if (resolvedId) return teamById.get(resolvedId);

  return undefined;
}

export type R32Slot = { team: Team | undefined; projected: boolean };

// Builds the 32-slot R32 display array in draw order.
// Confirmed slots (ESPN-direct or fully-complete group) → projected: false.
// Projected slots (group in progress, current standings leader) → projected: true.
// Truly unknown slots (third-place not yet announced, no resolution) → team: undefined.
export function buildR32DisplaySlots(
  matches: Match[],
  selections: GroupSelections,
  teamById: Map<string, Team>,
  groups: Group[],
): R32Slot[] {
  const r32Sorted = sortByDate(matches.filter((m) => m.type === "round-of-32"));
  return R32_DISPLAY_ORDER.flatMap((i) => {
    const match = r32Sorted[i];
    if (!match) return [{ team: undefined, projected: false }, { team: undefined, projected: false }];

    const resolveSlot = (id: string, name: string): R32Slot => {
      // ESPN-confirmed or standings-confirmed (group complete)
      const confirmed = resolveKnockoutTeam(id, name, selections, teamById, groups, true);
      if (confirmed) return { team: confirmed, projected: false };
      // Projected from current (incomplete) standings
      const projected = resolveKnockoutTeam(id, name, selections, teamById, groups, false);
      return { team: projected, projected: true };
    };

    return [resolveSlot(match.homeId, match.homeName), resolveSlot(match.awayId, match.awayName)];
  });
}

// Builds a flat 32-team array for simulation — always resolves all slots.
export function buildR32SimTeams(
  matches: Match[],
  selections: GroupSelections,
  teamById: Map<string, Team>,
): Array<Team | undefined> {
  const r32Sorted = sortByDate(matches.filter((m) => m.type === "round-of-32"));
  return R32_DISPLAY_ORDER.flatMap((i) => {
    const match = r32Sorted[i];
    if (!match) return [undefined, undefined];
    return [
      resolveKnockoutTeam(match.homeId, match.homeName, selections, teamById, [], false),
      resolveKnockoutTeam(match.awayId, match.awayName, selections, teamById, [], false),
    ];
  });
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
