import { useState, useMemo } from "react";
import { Bell, Clipboard, Share2 } from "lucide-react";
import { buildGoalImpactContent } from "../lib/viral";
import type { GoalImpactReport, PlatformPost } from "../lib/viral";
import type { GoalWithImpact, TournamentData } from "../types";

type PlatformId = PlatformPost["platform"];

const PLATFORM_LABELS: Record<PlatformId, string> = {
  x: "X",
  bluesky: "Bluesky",
  reddit: "Reddit",
  linkedin: "LinkedIn",
};

function signedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value}%`;
}

function PlatformTabs({ report }: { report: GoalImpactReport }) {
  const [activeTab, setActiveTab] = useState<PlatformId>("x");
  const [copied, setCopied] = useState(false);
  const platforms: PlatformId[] = ["x", "bluesky", "reddit", "linkedin"];
  const post = report.platformPosts.find((p) => p.platform === activeTab);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="platform-tabs-wrap">
      <div className="platform-tabs">
        {platforms.map((id) => (
          <button
            key={id}
            className={`platform-tab${activeTab === id ? " active" : ""}`}
            onClick={() => setActiveTab(id)}
          >
            {PLATFORM_LABELS[id]}
          </button>
        ))}
      </div>

      {post && (
        <div className="platform-post-panel">
          {post.threads && post.threads.length > 1 ? (
            <div className="thread-posts">
              {post.threads.map((tweet, i) => (
                <div key={i} className="thread-tweet">
                  <span className="thread-label">Tweet {i + 1}/{post.threads!.length}</span>
                  <textarea readOnly value={tweet} rows={3} />
                  <div className="platform-post-actions">
                    <span className="char-counter">{tweet.length} / 280</span>
                    <button onClick={() => copyText(tweet)}>
                      <Clipboard size={13} /> Copy
                    </button>
                  </div>
                </div>
              ))}
              {post.intentUrl && (
                <a className="platform-share-btn" href={post.intentUrl} target="_blank" rel="noreferrer">
                  <Share2 size={14} /> Post thread on X
                </a>
              )}
            </div>
          ) : (
            <>
              <textarea readOnly value={post.text} rows={4} />
              <div className="platform-post-actions">
                {post.charLimit > 0 && (
                  <span className={`char-counter${post.charCount > post.charLimit ? " over" : ""}`}>
                    {post.charCount} / {post.charLimit}
                  </span>
                )}
                <button onClick={() => copyText(post.text)}>
                  <Clipboard size={13} /> {copied ? "Copied!" : "Copy"}
                </button>
                {post.intentUrl && (
                  <a href={post.intentUrl} target="_blank" rel="noreferrer">
                    <Share2 size={13} /> Share on {PLATFORM_LABELS[activeTab]}
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RankingsShift({ championshipBefore, championshipAfter, teams }: {
  championshipBefore: Map<string, number>;
  championshipAfter: Map<string, number>;
  teams: TournamentData["teams"];
}) {
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const afterSorted = [...championshipAfter.entries()]
    .filter(([id]) => teamById.has(id))
    .sort((a, b) => b[1] - a[1]);

  const beforeRankMap = new Map(
    [...championshipBefore.entries()]
      .filter(([id]) => teamById.has(id))
      .sort((a, b) => b[1] - a[1])
      .map(([id], i) => [id, i + 1]),
  );

  const top10 = afterSorted.slice(0, 10).map(([id, afterPct], i) => {
    const team = teamById.get(id)!;
    const afterRank = i + 1;
    const beforeRank = beforeRankMap.get(id) ?? afterRank;
    const beforePct = championshipBefore.get(id) ?? afterPct;
    return { team, afterRank, beforeRank, afterPct, beforePct };
  });

  if (top10.every((r) => r.beforeRank === r.afterRank)) return null;

  return (
    <div className="rankings-shift">
      <div className="swing-label rankings-shift-title">Title odds — top 10 ranking shift</div>
      <div className="rankings-shift-list">
        {top10.map(({ team, afterRank, beforeRank, afterPct, beforePct }) => {
          const moved = beforeRank - afterRank;
          const changed = moved !== 0;
          return (
            <div key={team.id} className={`rankings-shift-row${changed ? " changed" : ""}`}>
              <span className="rs-rank">{afterRank}</span>
              <span className={`rs-move ${moved > 0 ? "up" : moved < 0 ? "down" : "same"}`}>
                {moved > 0 ? `▲${moved}` : moved < 0 ? `▼${Math.abs(moved)}` : "—"}
              </span>
              <span className="rs-flag">{team.flag}</span>
              <span className="rs-name">{team.name}</span>
              <span className="rs-pct">
                <span className="rs-before">{beforePct}%</span>
                <span className="rs-arrow">→</span>
                <span className={`rs-after${afterPct > beforePct ? " positive" : afterPct < beforePct ? " negative" : ""}`}>
                  {afterPct}%
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalCard({ item, teams, origin }: { item: GoalWithImpact; teams: TournamentData["teams"]; origin: string }) {
  const [expanded, setExpanded] = useState(true);
  const report = useMemo(
    () =>
      buildGoalImpactContent(
        item.event,
        item.advancementBefore,
        item.advancementAfter,
        item.championshipBefore,
        item.championshipAfter,
        teams,
        origin,
      ),
    [item, teams, origin],
  );

  const { event, swings } = report;
  const homeSwing = swings.find((s) => s.teamName === event.homeName);
  const awaySwing = swings.find((s) => s.teamName === event.awayName);

  const detectedTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(event.detectedAt));

  return (
    <article className="panel news-goal-card">
      <button className="news-goal-header" onClick={() => setExpanded((v) => !v)}>
        <div className="news-goal-score">
          <span className="news-goal-minute">{event.minute}'</span>
          <h3>
            {event.homeName} <strong>{event.scoreAfter.home}–{event.scoreAfter.away}</strong> {event.awayName}
          </h3>
          <span className="news-goal-scorer">
            {event.scorerTeam === "home" ? event.homeName : event.awayName} score
          </span>
        </div>
        <span className="news-goal-time">{detectedTime}</span>
        <span className="news-expand-toggle">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <>
          <div className="goal-swings">
            {[homeSwing, awaySwing].filter(Boolean).map((swing) => swing && (
              <div key={swing.teamId} className="swing-row">
                <span className="swing-name">{swing.teamName}</span>
                <div className="swing-stats">
                  <div className="swing-stat">
                    <span className="swing-label">Advancement</span>
                    <div className="swing-bars">
                      <div className="swing-bar-wrap">
                        <div className="swing-bar before" style={{ width: `${swing.advancementBefore}%` }} />
                      </div>
                      <div className="swing-bar-wrap">
                        <div className="swing-bar after" style={{ width: `${swing.advancementAfter}%` }} />
                      </div>
                    </div>
                    <span className={`swing-delta ${swing.advancementDelta >= 0 ? "positive" : "negative"}`}>
                      {swing.advancementBefore}% → {swing.advancementAfter}% ({signedPercent(swing.advancementDelta)})
                    </span>
                  </div>
                  <div className="swing-stat">
                    <span className="swing-label">Championship</span>
                    <div className="swing-bars">
                      <div className="swing-bar-wrap">
                        <div className="swing-bar before" style={{ width: `${Math.min(swing.championshipBefore * 4, 100)}%` }} />
                      </div>
                      <div className="swing-bar-wrap">
                        <div className="swing-bar after" style={{ width: `${Math.min(swing.championshipAfter * 4, 100)}%` }} />
                      </div>
                    </div>
                    <span className={`swing-delta ${swing.championshipDelta >= 0 ? "positive" : "negative"}`}>
                      {swing.championshipBefore}% → {swing.championshipAfter}% ({signedPercent(swing.championshipDelta)})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <RankingsShift
            championshipBefore={item.championshipBefore}
            championshipAfter={item.championshipAfter}
            teams={teams}
          />

          <PlatformTabs report={report} />
        </>
      )}
    </article>
  );
}

export function GoalImpactPage({ goalHistory, data }: { goalHistory: GoalWithImpact[]; data: TournamentData }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="news-stack">
      <section className="lab-intro">
        <div>
          <span className="eyebrow">Live feed</span>
          <h2>Goal-by-goal impact</h2>
          <p>
            Every goal detected this session — with before/after title odds and ready-to-post content for each platform.
          </p>
        </div>
        <div className="model-badge">
          <Bell size={15} /> {goalHistory.length} goal{goalHistory.length !== 1 ? "s" : ""} this session
        </div>
      </section>

      {goalHistory.length === 0 ? (
        <div className="panel news-empty">
          <Bell size={32} />
          <p>No goals detected yet this session.</p>
          <p>Keep this tab open — each goal scored in any live match will appear here automatically within 45 seconds.</p>
        </div>
      ) : (
        <div className="news-goal-list">
          {goalHistory.map((item) => (
            <GoalCard
              key={`${item.event.matchId}-${item.event.detectedAt}`}
              item={item}
              teams={data.teams}
              origin={origin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
