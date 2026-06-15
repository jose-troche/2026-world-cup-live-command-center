import { useEffect, useMemo, useState } from "react";
import { Dices, RotateCcw, Trophy } from "lucide-react";
import { getRating, simulateKnockout } from "../lib/analytics";
import type { Team } from "../types";
import { Flag } from "./Flag";

type Props = {
  teams: Team[];
};

type PairProps = {
  teams: Team[];
  winnerId?: string;
  onPick?: (team: Team) => void;
  compact?: boolean;
};

function Pair({ teams, winnerId, onPick, compact }: PairProps) {
  return (
    <div className={`bracket-pair ${compact ? "compact" : ""}`}>
      {teams.map((team) => (
        <button
          className={winnerId === team.id ? "winner" : ""}
          onClick={() => onPick?.(team)}
          key={team.id}
          disabled={!onPick}
        >
          <Flag team={team} size="sm" />
          <span>{team.name}</span>
          <b>{getRating(team.name)}</b>
        </button>
      ))}
      {teams.length < 2 && <div className="bracket-tbd">Awaiting winner</div>}
    </div>
  );
}

export function BracketLab({ teams }: Props) {
  const seeds = useMemo(() => {
    const ranked = [...teams].sort((a, b) => getRating(b.name) - getRating(a.name)).slice(0, 8);
    return [ranked[0], ranked[7], ranked[3], ranked[4], ranked[1], ranked[6], ranked[2], ranked[5]].filter(Boolean);
  }, [teams]);
  const [quarters, setQuarters] = useState<Record<number, string>>({});
  const [semis, setSemis] = useState<Record<number, string>>({});
  const [champion, setChampion] = useState<string>();
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  useEffect(() => {
    setQuarters({});
    setSemis({});
    setChampion(undefined);
  }, [seeds]);

  const quarterPairs = Array.from({ length: 4 }, (_, index) => seeds.slice(index * 2, index * 2 + 2));
  const semiPairs = [
    [teamById.get(quarters[0]), teamById.get(quarters[1])].filter(Boolean) as Team[],
    [teamById.get(quarters[2]), teamById.get(quarters[3])].filter(Boolean) as Team[],
  ];
  const finalPair = [teamById.get(semis[0]), teamById.get(semis[1])].filter(Boolean) as Team[];
  const championTeam = champion ? teamById.get(champion) : undefined;

  function pickQuarter(index: number, team: Team) {
    setQuarters((current) => ({ ...current, [index]: team.id }));
    setSemis({});
    setChampion(undefined);
  }

  function pickSemi(index: number, team: Team) {
    setSemis((current) => ({ ...current, [index]: team.id }));
    setChampion(undefined);
  }

  function runSimulation() {
    const qWinners = quarterPairs.map(([a, b]) => simulateKnockout(a, b));
    const sWinners = [
      simulateKnockout(qWinners[0], qWinners[1]),
      simulateKnockout(qWinners[2], qWinners[3]),
    ];
    const winner = simulateKnockout(sWinners[0], sWinners[1]);
    setQuarters(Object.fromEntries(qWinners.map((team, index) => [index, team.id])));
    setSemis(Object.fromEntries(sWinners.map((team, index) => [index, team.id])));
    setChampion(winner.id);
  }

  function reset() {
    setQuarters({});
    setSemis({});
    setChampion(undefined);
  }

  return (
    <div className="lab-stack">
      <section className="lab-intro bracket-intro">
        <div>
          <span className="eyebrow">Interactive scenario</span>
          <h2>Knockout path simulator</h2>
          <p>Pick each winner or let the strength model play out a projected contender bracket.</p>
        </div>
        <div className="lab-actions">
          <button className="ghost-button" onClick={reset}><RotateCcw size={15} /> Reset</button>
          <button className="primary-button" onClick={runSimulation}><Dices size={16} /> Simulate</button>
        </div>
      </section>

      <section className="panel bracket-board">
        <div className="bracket-column">
          <span className="round-label">Quarterfinals</span>
          {quarterPairs.map((pair, index) => (
            <Pair
              teams={pair}
              winnerId={quarters[index]}
              onPick={(team) => pickQuarter(index, team)}
              key={index}
            />
          ))}
        </div>
        <div className="bracket-column semifinals">
          <span className="round-label">Semifinals</span>
          {semiPairs.map((pair, index) => (
            <Pair
              teams={pair}
              winnerId={semis[index]}
              onPick={pair.length === 2 ? (team) => pickSemi(index, team) : undefined}
              key={index}
            />
          ))}
        </div>
        <div className="bracket-column final">
          <span className="round-label">Final</span>
          <Pair
            teams={finalPair}
            winnerId={champion}
            onPick={finalPair.length === 2 ? (team) => setChampion(team.id) : undefined}
          />
        </div>
        <div className="champion-card">
          <span className="round-label">Champion</span>
          <div className={championTeam ? "trophy active" : "trophy"}>
            <Trophy size={31} />
          </div>
          {championTeam ? (
            <>
              <Flag team={championTeam} size="lg" />
              <strong>{championTeam.name}</strong>
              <span>Projected champion</span>
            </>
          ) : (
            <>
              <strong>Your call</strong>
              <span>Build a path to the trophy</span>
            </>
          )}
        </div>
      </section>
      <p className="wide-note">The simulator starts with eight top-rated contenders to keep scenario building fast. It is not an official tournament bracket.</p>
    </div>
  );
}
