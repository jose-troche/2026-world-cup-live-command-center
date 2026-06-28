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
  buildR32DisplaySlots,
  buildR32SimTeams,
  formatBracketDate,
  getQualifiedTeams,
  prefillPicksFromMatches,
  R32_DISPLAY_ORDER,
  rankTeams,
  resolveKnockoutTeam,
  updateGroupRole,
  type GroupRole,
  type GroupSelections,
  type KnockoutMatchMeta,
  type R32Slot,
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

const STORAGE_KEY = "bracketlab-v3";

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

function formatMatchMeta(meta: KnockoutMatchMeta | undefined): string {
  if (!meta) return "";
  const date = formatBracketDate(meta.localDate);
  return meta.venueName ? `${date} · ${meta.venueName}` : date;
}

type TeamSlot = { team?: Team; projected?: boolean };

type PairProps = {
  slots: [TeamSlot, TeamSlot];
  label0?: string;
  label1?: string;
  winnerId?: string;
  meta?: KnockoutMatchMeta;
  onPick?: (team: Team) => void;
};

function Pair({ slots, label0, label1, winnerId, meta, onPick }: PairProps) {
  const metaText = meta ? formatMatchMeta(meta) : "";
  return (
    <div className="bracket-pair">
      {metaText && <span className="bracket-match-meta">{metaText}</span>}
      {([0, 1] as const).map((i) => {
        const { team, projected } = slots[i];
        const label = i === 0 ? label0 : label1;
        if (team) {
          return (
            <button
              key={team.id}
              className={[
                winnerId === team.id ? "winner" : "",
                projected ? "projected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onPick?.(team)}
              disabled={!onPick}
              title={
                projected
                  ? `${team.name} · current leader (not yet confirmed)`
                  : `${team.name} · Model rating ${getRating(team.name)}`
              }
            >
              <Flag team={team} size="sm" />
              <span>
                {team.name}
                {projected && <em className="proj-tag"> ~</em>}
              </span>
              <b>{getRating(team.name)}</b>
            </button>
          );
        }
        return (
          <div className="bracket-team-placeholder" key={`tbd-${i}`}>
            <span>{label ?? "TBD"}</span>
          </div>
        );
      })}
    </div>
  );
}

type RoundProps = {
  label: string;
  slots: Array<TeamSlot | undefined>;
  labels?: string[];
  matchCount: number;
  picks: string[];
  metas: KnockoutMatchMeta[];
  onPick: (index: number, team: Team) => void;
  className?: string;
};

function BracketRound({
  label,
  slots,
  labels,
  matchCount,
  picks,
  metas,
  onPick,
  className = "",
}: RoundProps) {
  const pairs = Array.from({ length: matchCount }, (_, index) =>
    slots.slice(index * 2, index * 2 + 2),
  );
  return (
    <div className={`bracket-column ${className}`}>
      <span className="round-label">{label}</span>
      <div className="round-matchups">
        {pairs.map((pair, index) => {
          const s0: TeamSlot = pair[0] ?? {};
          const s1: TeamSlot = pair[1] ?? {};
          const canPick = Boolean(s0.team) && Boolean(s1.team);
          return (
            <Pair
              key={`${label}-${index}`}
              slots={[s0, s1]}
              label0={labels?.[index * 2] ?? "TBD"}
              label1={labels?.[index * 2 + 1] ?? "TBD"}
              winnerId={picks[index]}
              meta={metas[index]}
              onPick={canPick ? (team) => onPick(index, team) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

// Converts a plain Team | undefined to a TeamSlot (never projected for non-R32 rounds)
function toSlot(team: Team | undefined): TeamSlot {
  return { team, projected: false };
}

export function BracketLab({ teams, groups, matches, stadiums }: Props) {
  const teamSignature = teams
    .map((t) => `${t.id}:${t.group}:${t.name}`)
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

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

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
  const [qualifiersOpen, setQualifiersOpen] = useState(
    () => !matches.filter((m) => m.type === "group").every((m) => m.status === "finished"),
  );

  const groupTeams = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(selections).map((group) => [
          group,
          rankTeams(teams.filter((t) => t.group === group)),
        ]),
      ),
    [selections, teams],
  );

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

  const thirdPlaceCount = Object.values(selections).filter((s) => s.thirdAdvances).length;
  const fieldComplete = qualifiedTeams.length === 32 && thirdPlaceCount === 8;

  // R32 display slots — confirmed teams shown normally, projected shown with ~ indicator.
  const r32Slots: R32Slot[] = useMemo(
    () => buildR32DisplaySlots(knockoutMatches, selections, teamById, groups),
    [knockoutMatches, selections, teamById, groups],
  );

  // Labels for slots that have no team at all (truly unknown, e.g. third-place TBD).
  const r32Labels = useMemo(() => {
    const r32Sorted = [...knockoutMatches.filter((m) => m.type === "round-of-32")].sort(
      (a, b) =>
        (a.utcDate ? Date.parse(a.utcDate) : 0) - (b.utcDate ? Date.parse(b.utcDate) : 0),
    );
    return R32_DISPLAY_ORDER.flatMap((i) => {
      const m = r32Sorted[i];
      if (!m) return ["TBD", "TBD"];
      const homeResolved = resolveKnockoutTeam(
        m.homeId, m.homeName, selections, teamById, groups,
      );
      const awayResolved = resolveKnockoutTeam(
        m.awayId, m.awayName, selections, teamById, groups,
      );
      return [
        homeResolved ? homeResolved.name : m.homeName,
        awayResolved ? awayResolved.name : m.awayName,
      ];
    });
  }, [knockoutMatches, selections, teamById, groups]);

  // Match metadata (date + venue) for each bracket round.
  const bracketMetas = useMemo(
    () => buildBracketMatchMetas(knockoutMatches, stadiums),
    [knockoutMatches, stadiums],
  );

  // R16 teams flow directly from R32 picks in sequential display order.
  // R32_DISPLAY_ORDER already arranges R32 so sequential pairing gives the correct R16 matchups.
  const round16Slots = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => toSlot(teamById.get(picks.round32[i]))),
    [picks.round32, teamById],
  );

  const quarterSlots = useMemo(
    () => Array.from({ length: 8 }, (_, i) => toSlot(teamById.get(picks.round16[i]))),
    [picks.round16, teamById],
  );

  const semiSlots = useMemo(
    () => Array.from({ length: 4 }, (_, i) => toSlot(teamById.get(picks.quarters[i]))),
    [picks.quarters, teamById],
  );

  const finalSlots = useMemo(
    () => Array.from({ length: 2 }, (_, i) => toSlot(teamById.get(picks.semis[i]))),
    [picks.semis, teamById],
  );

  const championTeam = teamById.get(picks.final[0]);

  function clearBracket() {
    setPicks(emptyPicks());
  }

  function restoreSeeds() {
    const newSelections = buildDefaultGroupSelections(teams, groups);
    setSelections(newSelections);
    // Pre-fill picks from any already-completed knockout matches, clear the rest.
    setPicks(prefillPicksFromMatches(knockoutMatches, teamById));
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
        [group]: { ...selection, thirdAdvances: !selection.thirdAdvances },
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

  function runSimulation() {
    // Build 32 sim teams using unchecked resolution (projects current-standings leaders
    // for incomplete groups and the best-8 third-place selection for 3rd-place slots).
    const simTeams = buildR32SimTeams(knockoutMatches, selections, teamById);

    // Preserve picks from already-completed knockout matches; simulate the rest.
    const confirmed = prefillPicksFromMatches(knockoutMatches, teamById);

    // Simulate R32: 32 teams → 16 winners, in R32 display order.
    const r32Winners = simTeams.map((t, i) => {
      // If the pair has a confirmed result, use that winner.
      const pairIdx = Math.floor(i / 2);
      if (confirmed.round32[pairIdx]) return teamById.get(confirmed.round32[pairIdx]);
      return t;
    });
    // Build winner-per-pair by simulating each pair that doesn't have a confirmed result.
    const round32Picks: string[] = Array.from({ length: 16 }, (_, pairIdx) => {
      if (confirmed.round32[pairIdx]) return confirmed.round32[pairIdx];
      const a = r32Winners[pairIdx * 2];
      const b = r32Winners[pairIdx * 2 + 1];
      if (!a || !b) return confirmed.round32[pairIdx] ?? "";
      return simulateKnockout(a, b).id;
    });

    // R16: winners flow sequentially from R32 (no reordering needed).
    const r16Input = round32Picks.map((id) => teamById.get(id)).filter(Boolean) as Team[];
    const round16Picks: string[] = Array.from({ length: 8 }, (_, pairIdx) => {
      if (confirmed.round16[pairIdx]) return confirmed.round16[pairIdx];
      const a = r16Input[pairIdx * 2];
      const b = r16Input[pairIdx * 2 + 1];
      if (!a || !b) return "";
      return simulateKnockout(a, b).id;
    });

    const qfInput = round16Picks.map((id) => teamById.get(id)).filter(Boolean) as Team[];
    const quarterPicks: string[] = Array.from({ length: 4 }, (_, pairIdx) => {
      if (confirmed.quarters[pairIdx]) return confirmed.quarters[pairIdx];
      const a = qfInput[pairIdx * 2];
      const b = qfInput[pairIdx * 2 + 1];
      if (!a || !b) return "";
      return simulateKnockout(a, b).id;
    });

    const sfInput = quarterPicks.map((id) => teamById.get(id)).filter(Boolean) as Team[];
    const semiPicks: string[] = Array.from({ length: 2 }, (_, pairIdx) => {
      if (confirmed.semis[pairIdx]) return confirmed.semis[pairIdx];
      const a = sfInput[pairIdx * 2];
      const b = sfInput[pairIdx * 2 + 1];
      if (!a || !b) return "";
      return simulateKnockout(a, b).id;
    });

    const finalInput = semiPicks.map((id) => teamById.get(id)).filter(Boolean) as Team[];
    const finalPicks: string[] = [
      confirmed.final[0] ??
        (finalInput[0] && finalInput[1] ? simulateKnockout(finalInput[0], finalInput[1]).id : ""),
    ];

    setPicks({
      round32: round32Picks,
      round16: round16Picks,
      quarters: quarterPicks,
      semis: semiPicks,
      final: finalPicks,
    });
  }

  const actions = (
    <>
      <button className="ghost-button" onClick={clearBracket}>
        <RotateCcw size={15} /> Clear results
      </button>
      <button className="primary-button" onClick={runSimulation} disabled={!fieldComplete}>
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
            Set the qualifiers from every group, then pick each result or simulate
            the complete route from the Round of 32 to the title.
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
              Each group sends its winner and runner-up. Select eight third-place teams
              to complete the field.
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
                        className={selection.thirdAdvances ? "third-toggle active" : "third-toggle"}
                        onClick={() => toggleThirdPlace(group)}
                        aria-pressed={selection.thirdAdvances}
                        disabled={!selection.thirdAdvances && thirdPlaceCount >= 8}
                        title={
                          selection.thirdAdvances
                            ? "Remove third-place qualifier"
                            : "Advance this group's third-place team"
                        }
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
                                onChange={(e) => changeGroupRole(group, role, e.target.value)}
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
                ? "Field derived from live group standings. ~ indicates group not yet finished."
                : "Defaults use the highest model-rated teams in each group."}
            </span>
            <button onClick={restoreSeeds}>Restore current standings</button>
          </div>
        )}
      </section>

      <section className="panel bracket-board bracket-board-full">
        <BracketRound
          label="Round of 32"
          slots={r32Slots}
          labels={r32Labels}
          matchCount={16}
          picks={picks.round32}
          metas={bracketMetas.round32}
          onPick={(index, team) => pickWinner("round32", index, team)}
        />
        <BracketRound
          label="Round of 16"
          slots={round16Slots}
          matchCount={8}
          picks={picks.round16}
          metas={bracketMetas.round16}
          onPick={(index, team) => pickWinner("round16", index, team)}
          className="round-16"
        />
        <BracketRound
          label="Quarterfinals"
          slots={quarterSlots}
          matchCount={4}
          picks={picks.quarters}
          metas={bracketMetas.quarters}
          onPick={(index, team) => pickWinner("quarters", index, team)}
          className="quarterfinals"
        />
        <BracketRound
          label="Semifinals"
          slots={semiSlots}
          matchCount={2}
          picks={picks.semis}
          metas={bracketMetas.semis}
          onPick={(index, team) => pickWinner("semis", index, team)}
          className="semifinals"
        />
        <BracketRound
          label="Final"
          slots={finalSlots}
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
        Bracket draw order follows the official FIFA Round of 32 schedule. ~ marks
        teams whose group stage hasn't finished yet. Group qualifiers reflect live
        standings; change any selector to explore alternate scenarios.
      </p>
    </div>
  );
}
