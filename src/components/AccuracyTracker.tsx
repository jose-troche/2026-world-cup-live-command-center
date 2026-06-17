import { useEffect, useMemo, useState } from "react";
import { Target } from "lucide-react";
import { winProbability } from "../lib/analytics";
import type { Match, Team } from "../types";
import { ShareButtons } from "./ShareButtons";

type Choice = "home" | "draw" | "away";

type PollData = {
  home: number;
  draw: number;
  away: number;
  total: number;
};

type PredictionRecord = {
  match: Match;
  modelPick: Choice;
  modelConfidence: number;
  fanPick: Choice | null;
  fanConfidence: number;
  actual: Choice;
  modelCorrect: boolean;
  fanCorrect: boolean;
};

type Props = {
  matches: Match[];
  teams: Team[];
};

function majorityPick(poll: PollData): Choice | null {
  if (!poll.total) return null;
  if (poll.home >= poll.draw && poll.home >= poll.away) return "home";
  if (poll.away >= poll.draw) return "away";
  return "draw";
}

function actualResult(match: Match): Choice {
  if (match.homeScore > match.awayScore) return "home";
  if (match.awayScore > match.homeScore) return "away";
  return "draw";
}

function topChoice(prob: { home: number; draw: number; away: number }): Choice {
  if (prob.home >= prob.draw && prob.home >= prob.away) return "home";
  if (prob.away >= prob.draw) return "away";
  return "draw";
}

async function fetchPollsBatched(matchIds: string[]): Promise<Record<string, PollData>> {
  const results: Record<string, PollData> = {};
  const batchSize = 8;
  for (let i = 0; i < matchIds.length; i += batchSize) {
    const batch = matchIds.slice(i, i + batchSize);
    const responses = await Promise.allSettled(
      batch.map((id) =>
        fetch(`/api/polls/${encodeURIComponent(id)}`).then((r) => r.json() as Promise<PollData>),
      ),
    );
    batch.forEach((id, j) => {
      const res = responses[j];
      if (res.status === "fulfilled") results[id] = res.value;
    });
  }
  return results;
}

export function AccuracyTracker({ matches, teams: _teams }: Props) {
  const [pollResults, setPollResults] = useState<Record<string, PollData>>({});
  const [loading, setLoading] = useState(true);

  const finishedMatches = useMemo(
    () => matches.filter((m) => m.status === "finished"),
    [matches],
  );

  useEffect(() => {
    if (!finishedMatches.length) {
      setLoading(false);
      return;
    }
    fetchPollsBatched(finishedMatches.map((m) => m.id))
      .then(setPollResults)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [finishedMatches]);

  const records = useMemo<PredictionRecord[]>(() => {
    return finishedMatches
      .filter((m) => pollResults[m.id]?.total > 0)
      .map((match) => {
        const poll = pollResults[match.id];
        const prob = winProbability(match);
        const modelPick = topChoice(prob);
        const modelConf = Math.round(Math.max(prob.home, prob.draw, prob.away) * 100);
        const fanPick = majorityPick(poll);
        const fanConf = fanPick ? Math.round((poll[fanPick] / poll.total) * 100) : 0;
        const actual = actualResult(match);
        return {
          match,
          modelPick,
          modelConfidence: modelConf,
          fanPick,
          fanConfidence: fanConf,
          actual,
          modelCorrect: modelPick === actual,
          fanCorrect: fanPick === actual,
        };
      });
  }, [finishedMatches, pollResults]);

  const modelScore = records.filter((r) => r.modelCorrect).length;
  const fanScore = records.filter((r) => r.fanCorrect).length;
  const total = records.length;
  const modelPct = total ? Math.round((modelScore / total) * 100) : 0;
  const fanPct = total ? Math.round((fanScore / total) * 100) : 0;

  function verdictBadge() {
    if (!total) return null;
    if (modelPct > fanPct) return `Model leads fans ${modelPct}% vs ${fanPct}%`;
    if (fanPct > modelPct) return `Fans beating the model! ${fanPct}% vs ${modelPct}%`;
    return `Dead heat — model and fans both at ${modelPct}%`;
  }

  if (loading) {
    return null;
  }

  if (!total) {
    return (
      <section className="panel" style={{ padding: 24 }}>
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <div>
            <span className="eyebrow">Community vs model</span>
            <h3><Target size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Prediction accuracy</h3>
          </div>
        </div>
        <p className="accuracy-empty">
          Vote on matches in the Match Center to see how fans compare to the model.
        </p>
      </section>
    );
  }

  const shareText = `${verdictBadge()} at #WorldCup26 — Touchline 26`;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/insights` : "";

  return (
    <section className="panel accuracy-panel" style={{ padding: 24 }}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Community vs model</span>
          <h3><Target size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />Prediction accuracy</h3>
        </div>
        <div className="insight-share-row">
          <ShareButtons title={shareText} url={shareUrl} />
        </div>
      </div>

      <div className="accuracy-hero">
        <div className="accuracy-score-card">
          <span className="score-label">Model accuracy</span>
          <span className="score-num">{modelPct}%</span>
          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
            {modelScore}/{total} correct
          </span>
        </div>
        <div className="accuracy-score-card">
          <span className="score-label">Fan accuracy</span>
          <span className="score-num" style={{ color: fanPct >= modelPct ? "var(--lime)" : "var(--coral)" }}>
            {fanPct}%
          </span>
          <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
            {fanScore}/{total} correct
          </span>
        </div>
        {verdictBadge() && (
          <div className="accuracy-verdict-badge">{verdictBadge()}</div>
        )}
      </div>

      <div className="accuracy-match-table">
        {records.map(({ match, modelPick, fanPick, actual, modelCorrect, fanCorrect }) => (
          <div key={match.id} className="accuracy-match-row">
            <span className="accuracy-match-name">
              {match.homeName} vs {match.awayName}
            </span>
            <span className="accuracy-pick">
              Fans: {fanPick ?? "—"}
            </span>
            <span className="accuracy-pick">
              Model: {modelPick}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <span className={`accuracy-correct ${modelCorrect ? "yes" : "no"}`}>
                Model {modelCorrect ? "✓" : "✗"}
              </span>
              {fanPick && (
                <span className={`accuracy-correct ${fanCorrect ? "yes" : "no"}`}>
                  Fans {fanCorrect ? "✓" : "✗"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
        Based on {total} match{total !== 1 ? "es" : ""} with fan votes · Result: {
          records.filter(r => r.actual === "home").length
        }H / {records.filter(r => r.actual === "draw").length}D / {
          records.filter(r => r.actual === "away").length
        }A
      </p>
    </section>
  );
}
