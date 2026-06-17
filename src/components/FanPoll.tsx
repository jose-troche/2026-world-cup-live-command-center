import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import type { Match, Team, WinProbability } from "../types";
import { Flag } from "./Flag";
import { ShareButtons } from "./ShareButtons";

type Choice = "home" | "draw" | "away";

type PollData = {
  home: number;
  draw: number;
  away: number;
  total: number;
};

type Props = {
  match: Match;
  modelProbability: WinProbability;
  homeTeam?: Team;
  awayTeam?: Team;
};

function storageKey(matchId: string) {
  return `voted:${matchId}`;
}

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function resultLabel(match: Match): Choice | null {
  if (match.status !== "finished") return null;
  if (match.homeScore > match.awayScore) return "home";
  if (match.awayScore > match.homeScore) return "away";
  return "draw";
}

export function FanPoll({ match, modelProbability, homeTeam, awayTeam }: Props) {
  const [voted, setVoted] = useState<Choice | null>(() => {
    try {
      return (localStorage.getItem(storageKey(match.id)) as Choice | null);
    } catch {
      return null;
    }
  });
  const [pollData, setPollData] = useState<PollData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setVoted(() => {
      try {
        return (localStorage.getItem(storageKey(match.id)) as Choice | null);
      } catch {
        return null;
      }
    });
    setPollData(null);
  }, [match.id]);

  useEffect(() => {
    if (!voted) return;
    fetch(`/api/polls/${encodeURIComponent(match.id)}`)
      .then((r) => r.json())
      .then((data) => setPollData(data as PollData))
      .catch(() => {});
  }, [match.id, voted]);

  async function vote(choice: Choice) {
    if (submitting || voted) return;
    setSubmitting(true);
    try {
      await fetch(`/api/polls/${encodeURIComponent(match.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      localStorage.setItem(storageKey(match.id), choice);
      setVoted(choice);
      const res = await fetch(`/api/polls/${encodeURIComponent(match.id)}`);
      setPollData(await res.json() as PollData);
    } catch {
      // silently fail — voting is a nice-to-have
    } finally {
      setSubmitting(false);
    }
  }

  const actual = resultLabel(match);
  const showResults = voted !== null || match.status === "finished";
  const total = pollData?.total ?? 0;
  const homePct = pct(pollData?.home ?? 0, total);
  const drawPct = pct(pollData?.draw ?? 0, total);
  const awayPct = pct(pollData?.away ?? 0, total);

  const modelHomePct = Math.round(modelProbability.home * 100);
  const modelDrawPct = Math.round(modelProbability.draw * 100);
  const modelAwayPct = Math.round(modelProbability.away * 100);

  const bars: Array<{ key: Choice; label: string; fanPct: number; modelPct: number }> = [
    { key: "home", label: match.homeName, fanPct: homePct, modelPct: modelHomePct },
    { key: "draw", label: "Draw", fanPct: drawPct, modelPct: modelDrawPct },
    { key: "away", label: match.awayName, fanPct: awayPct, modelPct: modelAwayPct },
  ];

  function verdictText() {
    if (!voted || !actual || !total) return null;
    const correct = voted === actual;
    const winner = actual === "home" ? match.homeName : actual === "away" ? match.awayName : "a draw";
    const majorityPick = homePct >= drawPct && homePct >= awayPct ? "home" : awayPct >= drawPct ? "away" : "draw";
    const fansCorrect = majorityPick === actual;
    if (correct && fansCorrect) return `You and the fans called it — ${winner}!`;
    if (correct && !fansCorrect) return `You got it right! Most fans missed this one — ${winner}.`;
    if (!correct && fansCorrect) return `Most fans got it — ${winner}. Better luck next match.`;
    return `Everyone missed this one — ${winner}. What an upset!`;
  }

  return (
    <article id="community-vote" className="panel fan-poll-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Community vote</span>
          <h3>Who wins?</h3>
        </div>
        {total > 0 && (
          <span className="fan-poll-count">
            <Users size={13} />
            {total.toLocaleString()} vote{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {!showResults ? (
        <div className="fan-poll-buttons">
          {[
            { key: "home" as Choice, team: homeTeam, label: match.homeName },
            { key: "draw" as Choice, team: undefined, label: "Draw" },
            { key: "away" as Choice, team: awayTeam, label: match.awayName },
          ].map(({ key, team, label }) => (
            <button
              key={key}
              className="fan-poll-btn"
              onClick={() => vote(key)}
              disabled={submitting}
            >
              {team && <Flag team={team} size="sm" />}
              <span>{label}</span>
            </button>
          ))}
          <div className="insight-share-row" style={{ marginTop: 8 }}>
            <ShareButtons
              title={`Who wins? ${match.homeName} vs ${match.awayName} — cast your vote on Touchline 26`}
              url={typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}#community-vote` : ""}
            />
          </div>
        </div>
      ) : (
        <div className="fan-poll-results">
          {bars.map(({ key, label, fanPct, modelPct }) => {
            const isVoted = voted === key;
            const isActual = actual === key;
            return (
              <div
                key={key}
                className={`fan-poll-bar-row${isVoted ? " is-voted" : ""}${isActual ? " is-actual" : ""}`}
              >
                <div className="fan-poll-bar-label">
                  <span>{label}</span>
                  <div className="fan-poll-pcts">
                    <span className="fan-pct">{fanPct}%</span>
                    <span className="model-pct">model: {modelPct}%</span>
                  </div>
                </div>
                <div className="fan-poll-track">
                  <div
                    className="fan-poll-fill fan"
                    style={{ width: `${fanPct}%` }}
                  />
                  <div
                    className="fan-poll-fill model"
                    style={{ width: `${modelPct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {verdictText() && (
            <p className="fan-poll-verdict">{verdictText()}</p>
          )}
          {match.status !== "finished" && voted && (
            <p className="fan-poll-voted-note">Your pick is locked in. Results update live.</p>
          )}
          {total > 0 && (() => {
            const leader = homePct >= drawPct && homePct >= awayPct ? match.homeName : awayPct >= drawPct ? match.awayName : "a draw";
            const leaderPct = Math.max(homePct, drawPct, awayPct);
            const shareTitle = `${leaderPct}% of fans pick ${leader} in ${match.homeName} vs ${match.awayName} — Touchline 26`;
            const shareUrl = typeof window !== "undefined" ? window.location.href : "";
            return (
              <div className="insight-share-row" style={{ marginTop: 12 }}>
                <ShareButtons title={shareTitle} url={shareUrl} />
              </div>
            );
          })()}
        </div>
      )}
    </article>
  );
}
