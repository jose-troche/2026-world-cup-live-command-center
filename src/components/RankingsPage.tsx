import { useMemo } from "react";
import { Flame, Trophy } from "lucide-react";
import { buildPowerRankings, buildViralContent } from "../lib/viral";
import type { TournamentData } from "../types";

type Props = {
  data: TournamentData;
};

export function RankingsPage({ data }: Props) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const content = useMemo(() => buildViralContent(data, origin), [data, origin]);
  const powerRankings = useMemo(() => buildPowerRankings(data, 32), [data]);

  return (
    <div className="viral-stack">
      <section className="lab-intro viral-intro">
        <div>
          <span className="eyebrow">Model rankings</span>
          <h2>Power rankings and upsets</h2>
          <p>
            Daily team strength ratings derived from match results and pre-tournament ratings, plus model-scored upsets ranked by surprise factor.
          </p>
        </div>
        <div className="model-badge"><Trophy size={16} /> {powerRankings.length} teams ranked</div>
      </section>

      <section className="viral-grid">
        <article className="panel viral-list power-list">
          <div className="section-heading">
            <div>
              <span className="eyebrow">All teams</span>
              <h3>Power rankings</h3>
            </div>
            <Trophy size={19} />
          </div>
          {powerRankings.map((team) => (
            <div className="viral-row" key={team.teamId}>
              <div>
                <strong>{team.rank}. {team.teamName}</strong>
                <span>{team.note} · {team.movementLabel}</span>
              </div>
              <b>{team.score}</b>
            </div>
          ))}
        </article>

        <article className="panel viral-list">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Arguments</span>
              <h3>Upset meter</h3>
            </div>
            <Flame size={19} />
          </div>
          {content.upsets.length ? content.upsets.slice(0, 10).map((item, index) => (
            <div className="viral-row" key={item.matchId}>
              <div>
                <strong>{index + 1}. {item.title}</strong>
                <span>{item.score} · upset score {item.upsetScore}</span>
              </div>
              <b>{item.winnerRating}</b>
            </div>
          )) : <p className="empty-copy">No model-rated upsets yet.</p>}
        </article>
      </section>
    </div>
  );
}
