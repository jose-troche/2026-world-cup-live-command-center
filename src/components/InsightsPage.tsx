import { useMemo } from "react";
import { Flame, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { buildViralContent, getMatchPath, SHARE_HASHTAGS } from "../lib/viral";
import type { ContentStory, ViralContent } from "../lib/viral";
import type { TournamentData } from "../types";
import { AccuracyTracker } from "./AccuracyTracker";
import { ShareButtons } from "./ShareButtons";

type Props = {
  data: TournamentData;
  routeStory?: ContentStory;
};

function MomentCard({
  eyebrow,
  title,
  summary,
  shareTitle,
  shareUrl: url,
  icon,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  shareTitle: string;
  shareUrl: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="panel insight-moment-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        <span className="insight-icon">{icon}</span>
      </div>
      <p className="insight-summary">{summary}</p>
      <div className="insight-share-row">
        <ShareButtons title={shareTitle} url={url} />
      </div>
    </article>
  );
}

function VisualCard({
  eyebrow,
  title,
  cardUrl,
  shareTitle,
  pageUrl,
}: {
  eyebrow: string;
  title: string;
  cardUrl: string;
  shareTitle: string;
  pageUrl: string;
}) {
  return (
    <article className="panel insight-visual-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
      </div>
      <a href={cardUrl} target="_blank" rel="noreferrer" className="card-preview-link">
        <img src={cardUrl} alt={title} className="card-preview-img" loading="lazy" />
      </a>
      <div className="insight-share-row">
        <ShareButtons title={shareTitle} url={pageUrl} />
        <a href={cardUrl} target="_blank" rel="noreferrer" className="share-pill">
          Open card
        </a>
      </div>
    </article>
  );
}

function buildMoments(content: ViralContent, origin: string, matches: import("../types").Match[]) {
  const moments: Array<{
    eyebrow: string;
    title: string;
    summary: string;
    shareTitle: string;
    shareUrl: string;
    icon: React.ReactNode;
  }> = [];

  const topSwing = content.whatChanged[0];
  if (topSwing) {
    const swingMatch = matches.find((m) => m.id === topSwing.matchId);
    const swingSummary = topSwing.matchType === "knockout"
      ? `${topSwing.teamName} ${topSwing.change >= 0 ? "advanced" : "were eliminated"} — odds moved ${topSwing.change >= 0 ? "+" : ""}${topSwing.change}% from a ${topSwing.before}% pre-match position.`
      : `${topSwing.teamName} advancement odds moved ${topSwing.change >= 0 ? "+" : ""}${topSwing.change}% after ${topSwing.result}.`;
    moments.push({
      eyebrow: "Biggest swing",
      title: topSwing.title,
      summary: swingSummary,
      shareTitle: topSwing.title,
      shareUrl: swingMatch ? `${origin}${getMatchPath(swingMatch)}` : `${origin}/insights`,
      icon: <TrendingUp size={19} />,
    });
  }

  const topUpset = content.upsets[0];
  if (topUpset) {
    moments.push({
      eyebrow: "Biggest upset",
      title: topUpset.title,
      summary: `${topUpset.winnerName} (rated ${topUpset.winnerRating}) beat ${topUpset.loserName} (rated ${topUpset.favoriteRating}) ${topUpset.score} — upset score ${topUpset.upsetScore}.`,
      shareTitle: topUpset.title,
      shareUrl: `${origin}/insights`,
      icon: <Flame size={19} />,
    });
  }

  const topRanked = content.powerRankings[0];
  if (topRanked) {
    moments.push({
      eyebrow: "Current #1",
      title: `${topRanked.teamName} lead the power rankings`,
      summary: `${topRanked.teamName} sit top with a model score of ${topRanked.score}. ${topRanked.note}.`,
      shareTitle: `${topRanked.teamName} are the top-ranked team at World Cup 2026`,
      shareUrl: `${origin}/insights`,
      icon: <Trophy size={19} />,
    });
  }

  const liveStory = content.contentStories.find((s) => s.phase === "during") ?? content.contentStories[0];
  if (liveStory) {
    moments.push({
      eyebrow: "Latest story",
      title: liveStory.title,
      summary: liveStory.summary,
      shareTitle: liveStory.title,
      shareUrl: liveStory.pageUrl.startsWith("http") ? liveStory.pageUrl : `${origin}${liveStory.pageUrl}`,
      icon: <Sparkles size={19} />,
    });
  }

  return moments;
}

export function InsightsPage({ data, routeStory }: Props) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const content = useMemo(() => buildViralContent(data, origin), [data, origin]);
  const moments = useMemo(() => buildMoments(content, origin, data.matches), [content, data.matches, origin]);

  return (
    <div className="viral-stack">
      {routeStory && (
        <article className="panel story-article">
          <span className="eyebrow">{routeStory.phase}</span>
          <h2 className="story-headline">{routeStory.title}</h2>
          <p className="story-lead">{routeStory.summary}</p>
          <div className="story-body">
            {routeStory.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <img
            className="story-card-img"
            src={routeStory.cardUrl}
            alt={`Share card: ${routeStory.title}`}
            loading="lazy"
          />
          <ShareButtons title={routeStory.title} url={routeStory.pageUrl.startsWith("http") ? routeStory.pageUrl : `${origin}${routeStory.pageUrl}`} />
        </article>
      )}

      <section className="insights-cards-section">
        <section className="lab-intro viral-intro">
          <div>
            <span className="eyebrow">Shareable visuals</span>
            <h2>Post-ready cards</h2>
            <p>
              Snapshot cards generated from live tournament data — drop them straight into X, Bluesky, or wherever you share.
            </p>
          </div>
        </section>
        <div className="insights-cards-grid">
          <VisualCard
            eyebrow="Power rankings"
            title="Team strength rankings"
            cardUrl={`${origin}/api/cards/power-rankings.svg`}
            shareTitle="2026 World Cup power rankings — Touchline 26"
            pageUrl={`${origin}/insights`}
          />
          <VisualCard
            eyebrow="Upsets"
            title="Biggest upsets"
            cardUrl={`${origin}/api/cards/upsets.svg`}
            shareTitle="2026 World Cup biggest upsets — Touchline 26"
            pageUrl={`${origin}/insights`}
          />
        </div>
      </section>

      <section className="lab-intro viral-intro">
        <div>
          <span className="eyebrow">Insights</span>
          <h2>Today's biggest moments</h2>
          <p>
            The most statistically significant events from the tournament — probability swings, upsets, and the model's top story, ready to share.
          </p>
        </div>
        <div className="model-badge"><Sparkles size={16} /> {moments.length} moments</div>
      </section>

      <section className="insights-moments-grid">
        {moments.map((moment) => (
          <MomentCard key={moment.title} {...moment} />
        ))}
      </section>

      <AccuracyTracker matches={data.matches} teams={data.teams} />
    </div>
  );
}
