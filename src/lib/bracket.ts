import type { Team } from "../types";
import { getRating } from "./analytics";

export type GroupRole = "winnerId" | "runnerUpId" | "thirdId";

export type GroupSelection = {
  winnerId: string;
  runnerUpId: string;
  thirdId: string;
  thirdAdvances: boolean;
};

export type GroupSelections = Record<string, GroupSelection>;

const bracketSeedOrder = [
  0, 31, 15, 16, 7, 24, 8, 23,
  3, 28, 12, 19, 4, 27, 11, 20,
  1, 30, 14, 17, 6, 25, 9, 22,
  2, 29, 13, 18, 5, 26, 10, 21,
];

export function rankTeams(teams: Team[]) {
  return [...teams].sort(
    (a, b) => getRating(b.name) - getRating(a.name) || a.name.localeCompare(b.name),
  );
}

export function buildDefaultGroupSelections(teams: Team[]): GroupSelections {
  const groups = teams.reduce<Record<string, Team[]>>((result, team) => {
    if (!team.group) return result;
    (result[team.group] ??= []).push(team);
    return result;
  }, {});
  const selections = Object.fromEntries(
    Object.entries(groups)
      .filter(([group, groupTeams]) => group && groupTeams.length)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, groupTeams]) => {
        const ranked = rankTeams(groupTeams);
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

  Object.entries(selections)
    .sort(([, a], [, b]) => {
      const teamA = teams.find((team) => team.id === a.thirdId);
      const teamB = teams.find((team) => team.id === b.thirdId);
      return getRating(teamB?.name ?? "") - getRating(teamA?.name ?? "");
    })
    .slice(0, 8)
    .forEach(([, selection]) => {
      selection.thirdAdvances = true;
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
