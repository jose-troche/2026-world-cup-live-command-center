export type Team = {
  id: string;
  name: string;
  code: string;
  iso2: string;
  flag: string;
  group: string;
};

export type Match = {
  id: string;
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  homeScore: number;
  awayScore: number;
  group: string;
  matchday: number;
  localDate: string;
  utcDate?: string;
  stadiumId: string;
  status: "live" | "finished" | "scheduled";
  minute: number;
  type: string;
};

export type Standing = {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type Group = {
  name: string;
  standings: Standing[];
};

export type Stadium = {
  id: string;
  name: string;
  city: string;
  countryCode?: string;
  capacity: number;
};

export type TournamentData = {
  teams: Team[];
  matches: Match[];
  groups: Group[];
  stadiums: Stadium[];
  source: "live" | "fallback";
  updatedAt: string;
  warning?: string;
};

export type WinProbability = {
  home: number;
  draw: number;
  away: number;
};

export type TeamMetrics = {
  attack: number;
  defense: number;
  control: number;
  transition: number;
  setPieces: number;
  form: number;
  rating: number;
};
