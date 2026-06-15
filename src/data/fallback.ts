import type { Group, Match, Stadium, Team, TournamentData } from "../types";

const teamSeed = [
  ["1", "Mexico", "MEX", "MX", "A"],
  ["2", "South Africa", "RSA", "ZA", "A"],
  ["3", "South Korea", "KOR", "KR", "A"],
  ["4", "Czech Republic", "CZE", "CZ", "A"],
  ["5", "Canada", "CAN", "CA", "B"],
  ["6", "Bosnia and Herzegovina", "BIH", "BA", "B"],
  ["7", "Qatar", "QAT", "QA", "B"],
  ["8", "Switzerland", "SUI", "CH", "B"],
  ["9", "Brazil", "BRA", "BR", "C"],
  ["10", "Morocco", "MAR", "MA", "C"],
  ["11", "Haiti", "HAI", "HT", "C"],
  ["12", "Scotland", "SCO", "gb-sct", "C"],
  ["13", "United States", "USA", "US", "D"],
  ["14", "Paraguay", "PAR", "PY", "D"],
  ["15", "Australia", "AUS", "AU", "D"],
  ["16", "Turkiye", "TUR", "TR", "D"],
] as const;

export const fallbackTeams: Team[] = teamSeed.map(([id, name, code, iso2, group]) => ({
  id,
  name,
  code,
  iso2,
  group,
  flag: `https://flagcdn.com/w80/${iso2.toLowerCase()}.png`,
}));

export const fallbackMatches: Match[] = [
  {
    id: "1",
    homeId: "1",
    awayId: "2",
    homeName: "Mexico",
    awayName: "South Africa",
    homeScore: 2,
    awayScore: 0,
    group: "A",
    matchday: 1,
    localDate: "06/11/2026 13:00",
    stadiumId: "1",
    status: "finished",
    minute: 90,
    type: "group",
  },
  {
    id: "2",
    homeId: "3",
    awayId: "4",
    homeName: "South Korea",
    awayName: "Czech Republic",
    homeScore: 2,
    awayScore: 1,
    group: "A",
    matchday: 1,
    localDate: "06/11/2026 20:00",
    stadiumId: "2",
    status: "finished",
    minute: 90,
    type: "group",
  },
  {
    id: "4",
    homeId: "13",
    awayId: "14",
    homeName: "United States",
    awayName: "Paraguay",
    homeScore: 4,
    awayScore: 1,
    group: "D",
    matchday: 1,
    localDate: "06/12/2026 18:00",
    stadiumId: "7",
    status: "finished",
    minute: 90,
    type: "group",
  },
  {
    id: "14",
    homeId: "17",
    awayId: "18",
    homeName: "Spain",
    awayName: "Cape Verde",
    homeScore: 0,
    awayScore: 0,
    group: "H",
    matchday: 1,
    localDate: "06/15/2026 12:00",
    stadiumId: "10",
    status: "scheduled",
    minute: 0,
    type: "group",
  },
];

const groupRows: Record<string, Array<[string, number, number, number, number]>> = {
  A: [
    ["1", 3, 2, 0, 1],
    ["3", 3, 2, 1, 1],
    ["4", 0, 1, 2, -1],
    ["2", 0, 0, 2, -2],
  ],
  B: [
    ["5", 1, 1, 1, 0],
    ["6", 1, 1, 1, 0],
    ["7", 1, 1, 1, 0],
    ["8", 1, 1, 1, 0],
  ],
  C: [
    ["12", 3, 1, 0, 1],
    ["9", 1, 1, 1, 0],
    ["10", 1, 1, 1, 0],
    ["11", 0, 0, 1, -1],
  ],
  D: [
    ["13", 3, 4, 1, 3],
    ["15", 3, 2, 0, 2],
    ["16", 0, 0, 2, -2],
    ["14", 0, 1, 4, -3],
  ],
};

export const fallbackGroups: Group[] = Object.entries(groupRows).map(([name, rows]) => ({
  name,
  standings: rows.map(([teamId, points, goalsFor, goalsAgainst, goalDifference]) => ({
    teamId,
    played: 1,
    won: points === 3 ? 1 : 0,
    drawn: points === 1 ? 1 : 0,
    lost: points === 0 ? 1 : 0,
    points,
    goalsFor,
    goalsAgainst,
    goalDifference,
  })),
}));

export const fallbackStadiums: Stadium[] = [
  { id: "1", name: "Mexico City Stadium", city: "Mexico City", capacity: 83000 },
  { id: "7", name: "Atlanta Stadium", city: "Atlanta", capacity: 75000 },
  { id: "10", name: "Philadelphia Stadium", city: "Philadelphia", capacity: 69000 },
];

export const fallbackData: TournamentData = {
  teams: fallbackTeams,
  matches: fallbackMatches,
  groups: fallbackGroups,
  stadiums: fallbackStadiums,
  source: "fallback",
  updatedAt: new Date("2026-06-15T00:00:00Z").toISOString(),
  warning: "Live provider unavailable. Showing the bundled tournament snapshot.",
};
