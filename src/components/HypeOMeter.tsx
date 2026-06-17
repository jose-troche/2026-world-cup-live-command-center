import { useEffect, useMemo, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { computeHypeScore, simulateAdvancement } from "../lib/analytics";
import type { Group, Match, Team } from "../types";

type Filter = "all" | "live" | "upcoming";

type Props = {
  matches: Match[];
  teams: Team[];
  groups: Group[];
  onSelectMatch: (match: Match) => void;
};

function hypeEmoji(score: number) {
  if (score >= 70) return "🔥🔥🔥";
  if (score >= 40) return "🔥🔥";
  return "🔥";
}

function hypeTier(score: number): "high" | "mid" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "mid";
  return "low";
}

function parseMatchDate(match: Match): Date {
  if (match.utcDate) return new Date(match.utcDate);
  const [datePart, timePart = "00:00"] = match.localDate.split(" ");
  const [month, day, year] = datePart.split("/");
  const [hour, minute] = timePart.split(":");
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Kickoff!";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function HypeOMeter({ matches, teams, groups, onSelectMatch }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const advancementProbs = useMemo(
    () => simulateAdvancement(groups, matches, teams),
    [groups, matches, teams],
  );

  const hypeData = useMemo(() => {
    const nonFinished = matches.filter((m) => m.status !== "finished");
    const filtered =
      filter === "live"
        ? nonFinished.filter((m) => m.status === "live")
        : filter === "upcoming"
          ? nonFinished.filter((m) => m.status === "scheduled")
          : nonFinished;

    return filtered
      .map((m) => ({ match: m, score: computeHypeScore(m, advancementProbs) }))
      .sort((a, b) => b.score - a.score);
  }, [matches, advancementProbs, filter]);

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "all", label: "All upcoming" },
    { key: "live", label: "Live now" },
    { key: "upcoming", label: "Scheduled" },
  ];

  return (
    <div className="hype-panel panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Match intelligence</span>
          <h3>
            <Flame size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Hype-O-Meter
          </h3>
        </div>
      </div>

      <div className="hype-filter-row">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            className={`hype-filter-btn${filter === key ? " active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {hypeData.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
          No matches found for this filter.
        </p>
      ) : (
        <div className="scenario-match-list">
          {hypeData.map(({ match, score }) => {
            const tier = hypeTier(score);
            const kickoff = parseMatchDate(match);
            const msUntil = kickoff.getTime() - now;
            const isLive = match.status === "live";
            const groupLabel = match.group ? `Group ${match.group}` : "";

            return (
              <div
                key={match.id}
                className="hype-match-row"
                onClick={() => onSelectMatch(match)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onSelectMatch(match)}
              >
                <div className="hype-match-header">
                  <span>
                    {match.homeName} vs {match.awayName}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isLive ? (
                      <span className="hype-live-badge">LIVE</span>
                    ) : (
                      <span className="hype-countdown">{formatCountdown(msUntil)}</span>
                    )}
                    <span style={{ fontSize: 16 }}>{hypeEmoji(score)}</span>
                  </span>
                </div>
                <div className="hype-bar-track">
                  <div
                    className={`hype-bar-fill tier-${tier}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <div className="hype-match-meta">
                  <span>{groupLabel}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                    Hype score: {score}/100
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
