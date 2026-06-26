import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Dices,
  RotateCcw,
  Settings2,
  Trophy,
} from "lucide-react";
import { getRating, simulateKnockout } from "../lib/analytics";
import {
  buildBracketMatchMetas,
  buildDefaultGroupSelections,
  buildR32DisplayTeams,
  formatBracketDate,
  getQualifiedTeams,
  pairTeams,
  prefillPicksFromMatches,
  R16_DISPLAY_ORDER,
  rankTeams,
  resolveKnockoutTeam,
  updateGroupRole,
  type GroupRole,
  type GroupSelections,
  type KnockoutMatchMeta,
} from "../lib/bracket";
import type { Group, Match, Stadium, Team } from "../types";
import { Flag } from "./Flag";
import { ShareButtons } from "./ShareButtons";

type Props = {
  teams: Team[];
  groups: Group[];
  matches: Match[];
  stadiums: Stadium[];
};

type RoundKey = "round32" | "round16" | "quarters" | "semis" | "final";
type Picks = Record<RoundKey, string[]>;

const emptyPicks = (): Picks => ({
  round32: [],
  round16: [],
  quarters: [],
  semis: [],
  final: [],
});

// v2: bump version when bracket structure changes (invalidates old localStorage)
const STORAGE_KEY = "bracketlab-v2";

function loadSaved(): { selections?: GroupSelections; picks?: Picks } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const downstreamRounds: Record<RoundKey, RoundKey[]> = {
  round32: ["round16", "quarters", "semis", "final"],
  round16: ["quarters", "semis", "final"],
  quarters: ["semis", "final"],
  semis: ["final"],
  final: [],
};

function formatMatchMeta(meta: KnockoutMatchMeta | undefined, venueName?: string): string {
  if (!meta) return "";
  const venue = venueName ?? meta.venueName;
  const date = formatBracketDate(meta.localDate);
  if (venue) return `${date} · ${venue}`;
  return date;
}

type PairProps = {
  teams: Array<Team | undefined>;
  labels?: [string, string];
  winnerId?: string;
  meta?: KnockoutMatchMeta;
  onPick?: (team: Team) => void;
};

function Pair({ teams, labels, winnerId, meta, onPick }: PairProps) {
  const metaText = meta ? formatMatchMeta(meta) : "";
  return (
    <div className="bracket-pair">
      {metaText && <span className="bracket-match-meta">{metaText}</span>}
      {[0, 1].map((slot) => {
        const team = teams[slot];
        const label = labels?.[slot];
        return team ? (
          <button
            className={winnerId === team.id ? "winner" : ""}
            onClick={() => onPick?.(team)}
            key={team.id}
            disabled={!onPick}
            title={`${team.name} · Model rating ${getRating(team.name)}`}
          >
            <Flag team={team} size="sm" />
            <span>{team.name}</span>
            <b>{getRating(team.name)}</b>
          </button>
        ) : (
          <div className="bracket-team-placeholder" key={`tbd-${slot}`}>
            <span>{label ?? "TBD"}</span>
          </div>
        );
      })}
    </div>
  );
}

type RoundProps = {
  label: string;
  teams: Array<Team | undefined>;
  labels?: string[];
  matchCount: number;
  picks: string[];
  metas: KnockoutMatchMeta[];
  onPick: (index: number, team: Team) => void;
  className?: string;
};

function BracketRound({
  label,
  teams,
  labels,
  matchCount,
  picks,
  metas,
  onPick,
  className = "",
}: RoundProps) {
  const matchups = Array.from({ length: matchCount }, (_, index) =>
    teams.slice(index * 2, index * 2 + 2),
  );
  return (
    <div className={`bracket-column ${className}`}>
      <span className="round-label">{label}</span>
      <div className="round-matchups">
        {matchups.map((pair, index) => (
          <Pair
            teams={pair}
            labels={[labels?.[index * 2] ?? "TBD", labels?.[index * 2 + 1] ?? "TBD"]}
            winnerId={picks[index]}
            meta={metas[index]}
            onPick={pair.filter(Boolean).length === 2 ? (team) => onPick(index, team) : undefined}
            key={`${label}-${index}`}
          />
        ))}
      </div>
    </div>
  );
}

export function BracketLab({ teams, groups, matches, stadiums }: Props) {
  const teamSignature = teams
    .map((team) => `${team.id}:${team.group}:${team.name}`)
    .sort()
    .join("|");

  const groupSignature = groups
    .flatMap((g) => g.standings.map((s) => `${s.teamId}:${s.points}:${s.played}`))
    .join("|");

  const defaultSelections = useMemo(
    () => buildDefaultGroupSelections(teams, groups),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamSignature, groupSignature],
  );

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  const knockoutMatches = useMemo(
    () => matches.filter((m) => m.type !== "group"),
    [matches],
  );

  const [selections, setSelections] = useState<GroupSelections>(() => {
    const saved = loadSaved();
    if (
      saved.selections &&
      Object.keys(saved.selections).length === Object.keys(defaultSelections).length
    ) {
      return saved.selections;
    }
    return defaultSelections;
  });

  const [picks, setPicks] = useState<Picks>(() => loadSaved().picks ?? emptyPicks());
  const [qualifiersOpen, setQualifiersOpen] = useState(true);

  const groupTeams = useMemo(() => {
    return Object.fromEntries(
      Object.keys(selections).map((group) => [
        group,
        rankTeams(teams.filter((team) => team.group === group)),
      ]),
    );
  }, [selections, teams]);

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setSelections(defaultSelections);
    setPicks(emptyPicks());
  }, [defaultSelections]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ selections, picks }));
    } catch {}
  }, [selections, picks]);

  const qualifiedTeams = useMemo(
    () => getQualifiedTeams(teams, selections),
    [selections, teams],
  );

  const thirdPlaceCount = Object.values(selections).filter(
    (selection) => selection.thirdAdvances,
  ).length;
  const fieldComplete = qualifiedTeams.length === 32 && thirdPlaceCount === 8;

  // Build the R32 display teams from ESPN knockout match data (real draw order).
  // Teams only appear when ESPN has confirmed them (group is fully done).
  const r32DisplayTeams = useMemo(
    () => buildR32DisplayTeams(knockoutMatches, selections, teamById, groups),
    [knockoutMatches, selections, teamById, groups],
  );

  // Labels for placeholder slots — show group position text (e.g. "Group I Winner")
  // when the team isn't confirmed yet, or the team name when confirmed.
  const r32Labels = useMemo(() => {
    const r32Sorted = [...knockoutMatches.filter((m) => m.type === "round-of-32")].sort(
      (a, b) => (a.utcDate ? Date.parse(a.utcDate) : 0) - (b.utcDate ? Date.parse(b.utcDate) : 0),
    );
    return (
      [0, 2, 1, 4, 10, 11, 8, 9, 3, 5, 6, 7, 13, 15, 12, 14] as const
    ).flatMap((i) => {
      const m = r32Sorted[i];
      if (!m) return ["TBD", "TBD"];
      const homeResolved = resolveKnockoutTeam(m.homeId, m.homeName, selections, teamById, groups);
      const awayResolved = resolveKnockoutTeam(m.awayId, m.awayName, selections, teamById, groups);
      return [
        homeResolved ? homeResolved.name : m.homeName,
        awayResolved ? awayResolved.name : m.awayName,
      ];
    });
  }, [knockoutMatches, selections, teamById, groups]);

  // Match metadata (date + venue) for each bracket round, in display order
  const bracketMetas = useMemo(
    () => buildBracketMatchMetas(knockoutMatches, stadiums),
    [knockoutMatches, stadiums],
  );

  // When R32 data is available from ESPN, fall back to seeded teams for sim
  const hasR32Data = r32DisplayTeams.some(Boolean);
  // Flat 32-team array for simulation — use ESPN draw order when available
  const r32SimTeams: Team[] = useMemo(() => {
    if (hasR32Data) {
      // Replace undefined slots with teams from qualified list so simulation can run
      const qualified = [...qualifiedTeams];
      const used = new Set(r32DisplayTeams.filter(Boolean).map((t) => t!.id));
      const unplaced = qualified.filter((t) => !used.has(t.id));
      let unplacedIdx = 0;
      return r32DisplayTeams.map((t) => t ?? unplaced[unplacedIdx++]).filter((t): t is Team => Boolean(t));
    }
    // Fall back to model seeding when no ESPN draw data available
    return qualifiedTeams;
  }, [hasR32Data, r32DisplayTeams, qualifiedTeams]);

  const getTeamsFromPicks = (round: RoundKey, slots: number) =>
    Array.from({ length: slots }, (_, index) => teamById.get(picks[round][index]));

  // R16 teams: reorder by R16_DISPLAY_ORDER so sequential pairing matches ESPN bracket
  const round16Teams = useMemo(() => {
    const r32Winners = Array.from({ length: 16 }, (_, i) => teamById.get(picks.round32[i]));
    return R16_DISPLAY_ORDER.flatMap((i) => {
      const home = r32Winners[i * 2];
      const away = r32Winners[i * 2 + 1];
      return [home, away];
    });
  }, [picks.round32, teamById]);

  const quarterTeams = getTeamsFromPicks("round16", 8);
  const semiTeams = getTeamsFromPicks("quarters", 4);
  const finalTeams = getTeamsFromPicks("semis", 2);
  const championTeam = teamById.get(picks.final[0]);

  function clearBracket() {
    setPicks(emptyPicks());
  }

  function restoreSeeds() {
    const newSelections = buildDefaultGroupSelections(teams, groups);
    setSelections(newSelections);
    // Pre-fill picks from any already-played knockout matches
    const preFilled = prefillPicksFromMatches(knockoutMatches, teamById);
    setPicks(preFilled);
  }

  function changeGroupRole(group: string, role: GroupRole, teamId: string) {
    setSelections((current) => ({
      ...current,
      [group]: updateGroupRole(current[group], role, teamId),
    }));
    clearBracket();
  }

  function toggleThirdPlace(group: string) {
    setSelections((current) => {
      const selection = current[group];
      if (!selection.thirdAdvances && thirdPlaceCount >= 8) return current;
      return {
        ...current,
        [group]: {
          ...selection,
          thirdAdvances: !selection.thirdAdvances,
        },
      };
    });
    clearBracket();
  }

  function pickWinner(round: RoundKey, index: number, team: Team) {
    setPicks((current) => {
      const next = { ...current, [round]: [...current[round]] };
      next[round][index] = team.id;
      downstreamRounds[round].forEach((key) => {
        next[key] = [];
      });
      return next;
    });
  }

  function simulateRound(roundTeams: Team[]) {
    return pairTeams(roundTeams).map(([teamA, teamB]) => simulateKnockout(teamA, teamB));
  }

  function runSimulation() {
    if (!fieldComplete) return;
    const r32Teams = r32SimTeams.length === 32 ? r32SimTeams : qualifiedTeams;
    const round32Winners = simulateRound(r32Teams);
    const r16InputTeams = R16_DISPLAY_ORDER.flatMap((i) => {
      const home = round32Winners[i * 2];
      const away = round32Winners[i * 2 + 1];
      return [home, away].filter(Boolean) as Team[];
    });
    const round16Winners = simulateRound(r16InputTeams);
    const quarterWinners = simulateRound(round16Winners);
    const semiWinners = simulateRound(quarterWinners);
    const finalWinner = simulateRound(semiWinners);
    setPicks({
      round32: round32Winners.map((team) => team.id),
      round16: round16Winners.map((team) => team.id),
      quarters: quarterWinners.map((team) => team.id),
      semis: semiWinners.map((team) => team.id),
      final: finalWinner.map((team) => team.id),
    });
  }

  const actions = (
    <>
      <button className="ghost-button" onClick={clearBracket}>
        <RotateCcw size={15} /> Clear results
      </button>
      <button
        className="primary-button"
        onClick={runSimulation}
        disabled={!fieldComplete}
      >
        <Dices size={16} /> Simulate tournament
      </button>
    </>
  );

  return (
    <div className="lab-stack">
      <section className="lab-intro bracket-intro">
        <div>
          <span className="eyebrow">Complete knockout path</span>
          <h2>32-team bracket simulator</h2>
          <p>
            Set the qualifiers from every group, then pick each result or
            simulate the complete route from the Round of 32 to the title.
          </p>
        </div>
        <div className="lab-actions">{actions}</div>
      </section>

      <section className="panel qualifier-builder">
        <button
          className="qualifier-header"
          onClick={() => setQualifiersOpen((open) => !open)}
          aria-expanded={qualifiersOpen}
        >
          <div>
            <span className="eyebrow">Qualification field</span>
            <strong>
              <Settings2 size={17} /> Choose the 32 teams
            </strong>
            <p>
              Each group sends its winner and runner-up. Select eight third-place
              teams to complete the field.
            </p>
          </div>
          <div className="qualifier-status">
            <span>{qualifiersOpen ? "Hide groups" : "Show groups"}</span>
            <ChevronDown size={17} className={qualifiersOpen ? "open" : ""} />
          </div>
        </button>

        {qualifiersOpen && (
          <div className="group-seed-grid">
            {Object.keys(selections)
              .sort()
              .map((group) => {
                const selection = selections[group];
                const options = groupTeams[group] ?? [];
                const roleOptions: Array<{ role: GroupRole; label: string }> = [
                  { role: "winnerId", label: "Winner" },
                  { role: "runnerUpId", label: "Runner-up" },
                  { role: "thirdId", label: "Third place" },
                ];
                return (
                  <article className="group-seed-card" key={group}>
                    <div className="group-seed-title">
                      <span>Group {group}</span>
                      <button
                        className={
                          selection.thirdAdvances
                            ? "third-toggle active"
                            : "third-toggle"
                        }
                        onClick={() => toggleThirdPlace(group)}
                        aria-pressed={selection.thirdAdvances}
                        disabled={
                          !selection.thirdAdvances && thirdPlaceCount >= 8
                        }
                        title={
                          selection.thirdAdvances
                            ? "Remove third-place qualifier"
                            : "Advance this group's third-place team"
                        }
                      >
                        {selection.thirdAdvances ? (
                          <Check size={12} />
                        ) : (
                          "+"
                        )}{" "}
                        Third advances
                      </button>
                    </div>
                    <div className="group-seed-fields">
                      {roleOptions.map(({ role, label }) => {
                        const selectedTeam = teamById.get(selection[role]);
                        return (
                          <label key={role}>
                            <span>{label}</span>
                            <div>
                              <Flag team={selectedTeam} size="sm" />
                              <select
                                value={selection[role]}
                                onChange={(event) =>
                                  changeGroupRole(
                                    group,
                                    role,
                                    event.target.value,
                                  )
                                }
                              >
                                {options.map((team) => (
                                  <option value={team.id} key={team.id}>
                                    {team.name} · {getRating(team.name)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
          </div>
        )}
        {qualifiersOpen && (
          <div className="qualifier-footer">
            <span>
              {groups.some((g) => g.standings.some((s) => s.played > 0))
                ? "Field derived from live group standings."
                : "Defaults use the highest model-rated teams in each group."}
            </span>
            <button onClick={restoreSeeds}>Restore current standings</button>
          </div>
        )}
      </section>

      <section className="panel bracket-board bracket-board-full">
        <BracketRound
          label="Round of 32"
          teams={r32DisplayTeams}
          labels={r32Labels}
          matchCount={16}
          picks={picks.round32}
          metas={bracketMetas.round32}
          onPick={(index, team) => pickWinner("round32", index, team)}
        />
        <BracketRound
          label="Round of 16"
          teams={round16Teams}
          matchCount={8}
          picks={picks.round16}
          metas={bracketMetas.round16}
          onPick={(index, team) => pickWinner("round16", index, team)}
          className="round-16"
        />
        <BracketRound
          label="Quarterfinals"
          teams={quarterTeams}
          matchCount={4}
          picks={picks.quarters}
          metas={bracketMetas.quarters}
          onPick={(index, team) => pickWinner("quarters", index, team)}
          className="quarterfinals"
        />
        <BracketRound
          label="Semifinals"
          teams={semiTeams}
          matchCount={2}
          picks={picks.semis}
          metas={bracketMetas.semis}
          onPick={(index, team) => pickWinner("semis", index, team)}
          className="semifinals"
        />
        <BracketRound
          label="Final"
          teams={finalTeams}
          matchCount={1}
          picks={picks.final}
          metas={bracketMetas.final}
          onPick={(index, team) => pickWinner("final", index, team)}
          className="final"
        />
        <div className="champion-card">
          <span className="round-label">Champion</span>
          <div className={championTeam ? "trophy active" : "trophy"}>
            <Trophy size={31} />
          </div>
          {championTeam ? (
            <>
              <Flag team={championTeam} size="lg" />
              <strong>{championTeam.name}</strong>
              <span>Winner of this scenario</span>
              <div className="insight-share-row">
                <ShareButtons
                  title={`My 2026 World Cup bracket: ${championTeam.name} wins — Touchline 26`}
                  url={window.location.href}
                />
              </div>
            </>
          ) : (
            <>
              <strong>Title winner</strong>
              <span>Complete or simulate the bracket</span>
            </>
          )}
        </div>
      </section>

      {/* Mobile action bar — sticky at bottom so users can always simulate */}
      <div className="bracket-mobile-actions" aria-hidden="true">
        {actions}
      </div>

      <p className="wide-note">
        Bracket draw order follows the official FIFA Round of 32 schedule.
        Group qualifiers reflect live standings; change any selector to explore
        alternate scenarios.
      </p>
    </div>
  );
}
