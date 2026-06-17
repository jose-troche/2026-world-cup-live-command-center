import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Dices,
  RotateCcw,
  Settings2,
  Share2,
  Trophy,
} from "lucide-react";
import { getRating, simulateKnockout } from "../lib/analytics";
import {
  buildDefaultGroupSelections,
  getQualifiedTeams,
  pairTeams,
  rankTeams,
  seedRoundOf32,
  updateGroupRole,
  type GroupRole,
  type GroupSelections,
} from "../lib/bracket";
import { SHARE_HASHTAGS } from "../lib/viral";
import type { Team } from "../types";
import { Flag } from "./Flag";

type Props = {
  teams: Team[];
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

const STORAGE_KEY = "bracketlab-v1";

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

type PairProps = {
  teams: Array<Team | undefined>;
  winnerId?: string;
  onPick?: (team: Team) => void;
};

function Pair({ teams, winnerId, onPick }: PairProps) {
  return (
    <div className="bracket-pair">
      {[0, 1].map((slot) => {
        const team = teams[slot];
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
            <span>TBD</span>
          </div>
        );
      })}
    </div>
  );
}

type RoundProps = {
  label: string;
  teams: Array<Team | undefined>;
  matchCount: number;
  picks: string[];
  onPick: (index: number, team: Team) => void;
  className?: string;
};

function BracketRound({
  label,
  teams,
  matchCount,
  picks,
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
            winnerId={picks[index]}
            onPick={pair.filter(Boolean).length === 2 ? (team) => onPick(index, team) : undefined}
            key={`${label}-${index}`}
          />
        ))}
      </div>
    </div>
  );
}

export function BracketLab({ teams }: Props) {
  const teamSignature = teams
    .map((team) => `${team.id}:${team.group}:${team.name}`)
    .sort()
    .join("|");
  const defaultSelections = useMemo(
    () => buildDefaultGroupSelections(teams),
    // Preserve the user's bracket when polling returns unchanged team records.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamSignature],
  );
  const [selections, setSelections] = useState<GroupSelections>(() => {
    const saved = loadSaved();
    if (saved.selections && Object.keys(saved.selections).length === Object.keys(defaultSelections).length) {
      return saved.selections;
    }
    return defaultSelections;
  });
  const [picks, setPicks] = useState<Picks>(() => loadSaved().picks ?? emptyPicks());
  const [qualifiersOpen, setQualifiersOpen] = useState(true);
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
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
  const seededTeams = useMemo(() => seedRoundOf32(qualifiedTeams), [qualifiedTeams]);
  const thirdPlaceCount = Object.values(selections).filter(
    (selection) => selection.thirdAdvances,
  ).length;
  const fieldComplete = qualifiedTeams.length === 32 && thirdPlaceCount === 8;

  const getTeamsFromPicks = (round: RoundKey, slots: number) =>
    Array.from({ length: slots }, (_, index) => teamById.get(picks[round][index]));

  const round16Teams = getTeamsFromPicks("round32", 16);
  const quarterTeams = getTeamsFromPicks("round16", 8);
  const semiTeams = getTeamsFromPicks("quarters", 4);
  const finalTeams = getTeamsFromPicks("semis", 2);
  const championTeam = teamById.get(picks.final[0]);

  function clearBracket() {
    setPicks(emptyPicks());
  }

  function restoreSeeds() {
    setSelections(defaultSelections);
    clearBracket();
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
    const round32Winners = simulateRound(seededTeams);
    const round16Winners = simulateRound(round32Winners);
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

  return (
    <div className="lab-stack">
      <section className="lab-intro bracket-intro">
        <div>
          <span className="eyebrow">Complete knockout path</span>
          <h2>32-team bracket simulator</h2>
          <p>Set the qualifiers from every group, then pick each result or simulate the complete route from the Round of 32 to the title.</p>
        </div>
        <div className="lab-actions">
          <button className="ghost-button" onClick={clearBracket}><RotateCcw size={15} /> Clear results</button>
          <button className="primary-button" onClick={runSimulation} disabled={!fieldComplete}><Dices size={16} /> Simulate tournament</button>
        </div>
      </section>

      <section className="panel qualifier-builder">
        <button
          className="qualifier-header"
          onClick={() => setQualifiersOpen((open) => !open)}
          aria-expanded={qualifiersOpen}
        >
          <div>
            <span className="eyebrow">Qualification field</span>
            <strong><Settings2 size={17} /> Choose the 32 teams</strong>
            <p>Each group sends its winner and runner-up. Select eight third-place teams to complete the field.</p>
          </div>
          <div className="qualifier-status">
            <span>{qualifiersOpen ? "Hide groups" : "Show groups"}</span>
            <ChevronDown size={17} className={qualifiersOpen ? "open" : ""} />
          </div>
        </button>

        {qualifiersOpen && (
          <div className="group-seed-grid">
            {Object.keys(selections).sort().map((group) => {
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
                      className={selection.thirdAdvances ? "third-toggle active" : "third-toggle"}
                      onClick={() => toggleThirdPlace(group)}
                      aria-pressed={selection.thirdAdvances}
                      disabled={!selection.thirdAdvances && thirdPlaceCount >= 8}
                      title={selection.thirdAdvances ? "Remove third-place qualifier" : "Advance this group's third-place team"}
                    >
                      {selection.thirdAdvances ? <Check size={12} /> : "+"} Third advances
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
                              onChange={(event) => changeGroupRole(group, role, event.target.value)}
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
            <span>Defaults use the highest model-rated teams in each group.</span>
            <button onClick={restoreSeeds}>Restore highest seeds</button>
          </div>
        )}
      </section>

      <section className="panel bracket-board bracket-board-full">
        <BracketRound
          label="Round of 32"
          teams={seededTeams}
          matchCount={16}
          picks={picks.round32}
          onPick={(index, team) => pickWinner("round32", index, team)}
        />
        <BracketRound
          label="Round of 16"
          teams={round16Teams}
          matchCount={8}
          picks={picks.round16}
          onPick={(index, team) => pickWinner("round16", index, team)}
          className="round-16"
        />
        <BracketRound
          label="Quarterfinals"
          teams={quarterTeams}
          matchCount={4}
          picks={picks.quarters}
          onPick={(index, team) => pickWinner("quarters", index, team)}
          className="quarterfinals"
        />
        <BracketRound
          label="Semifinals"
          teams={semiTeams}
          matchCount={2}
          picks={picks.semis}
          onPick={(index, team) => pickWinner("semis", index, team)}
          className="semifinals"
        />
        <BracketRound
          label="Final"
          teams={finalTeams}
          matchCount={1}
          picks={picks.final}
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
                {(() => {
                  const url = window.location.href;
                  const title = `My 2026 World Cup bracket: ${championTeam.name} wins — Touchline 26`;
                  const tagged = `${title} ${SHARE_HASHTAGS}`;
                  return (
                    <>
                      <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${tagged}\n${url}`)}`} target="_blank" rel="noreferrer" className="share-pill">
                        <Share2 size={13} /> X
                      </a>
                      <a href={`https://bsky.app/intent/compose?text=${encodeURIComponent(`${tagged}\n${url}`)}`} target="_blank" rel="noreferrer" className="share-pill">
                        <Share2 size={13} /> Bluesky
                      </a>
                      <a href={`https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`} target="_blank" rel="noreferrer" className="share-pill">
                        <Share2 size={13} /> Reddit
                      </a>
                      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" className="share-pill">
                        <Share2 size={13} /> LinkedIn
                      </a>
                    </>
                  );
                })()}
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
      <p className="wide-note">The initial field and draw are model-seeded scenarios, not the official FIFA knockout pairings. Change any group selection to explore a different tournament path.</p>
    </div>
  );
}
