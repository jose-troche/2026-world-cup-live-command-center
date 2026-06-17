import { useMemo } from "react";
import { Flame, Share2, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { buildViralContent } from "../lib/viral";
import type { ContentStory, ViralContent } from "../lib/viral";
import type { TournamentData } from "../types";

type Props = {
  data: TournamentData;
  routeStory?: ContentStory;
};

function shareUrl(title: string, url: string) {
  if (typeof navigator !== "undefined" && navigator.share) {
    navigator.share({ title, url }).catch(() => undefined);
  } else {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title} ${url}`)}`);
  }
}

function ShareButtons({ title, url }: { title: string; url: string }) {
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${title}\n${url}`)}`;
  const bskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title}\n${url}`)}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;

  return (
    <div className="insight-share-row">
      <a href={xUrl} target="_blank" rel="noreferrer" className="share-pill">
        <Share2 size={12} /> X
      </a>
      <a href={bskyUrl} target="_blank" rel="noreferrer" className="share-pill">
        <Share2 size={12} /> Bluesky
      </a>
      <a href={waUrl} target="_blank" rel="noreferrer" className="share-pill">
        <Share2 size={12} /> WhatsApp
      </a>
    </div>
  );
}

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
      <ShareButtons title={shareTitle} url={url} />
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
        <button
          className="share-pill"
          onClick={() => shareUrl(shareTitle, pageUrl)}
        >
          <Share2 size={12} /> Share
        </button>
        <a href={cardUrl} target="_blank" rel="noreferrer" className="share-pill">
          Open card
        </a>
      </div>
    </article>
  );
}

function buildMoments(content: ViralContent, origin: string) {
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
    moments.push({
      eyebrow: "Biggest swing",
      title: topSwing.title,
      summary: `${topSwing.teamName} advancement odds moved ${topSwing.change >= 0 ? "+" : ""}${topSwing.change}% after ${topSwing.result}.`,
      shareTitle: topSwing.title,
      shareUrl: `${origin}/what-changed/${topSwing.matchId}`,
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
      shareUrl: `${origin}/upsets`,
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
      shareUrl: `${origin}/power-rankings`,
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
  const moments = useMemo(() => buildMoments(content, origin), [content, origin]);

  return (
    <div className="viral-stack">
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

      <section className="insights-moments-grid">
        {moments.map((moment) => (
          <MomentCard key={moment.title} {...moment} />
        ))}
      </section>

      <section className="insights-cards-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Share cards</span>
            <h3>Visual match cards</h3>
          </div>
        </div>
        <div className="insights-cards-grid">
          <VisualCard
            eyebrow="Power rankings"
            title="Team strength rankings"
            cardUrl={`${origin}/api/cards/power-rankings.svg`}
            shareTitle="2026 World Cup power rankings — Touchline 26"
            pageUrl={`${origin}/power-rankings`}
          />
          <VisualCard
            eyebrow="Upsets"
            title="Biggest upsets"
            cardUrl={`${origin}/api/cards/upsets.svg`}
            shareTitle="2026 World Cup biggest upsets — Touchline 26"
            pageUrl={`${origin}/upsets`}
          />
          {content.prediction && (
            <VisualCard
              eyebrow="Match prediction"
              title={`${content.prediction.homeName} vs ${content.prediction.awayName}`}
              cardUrl={content.prediction.cardUrl}
              shareTitle={`${content.prediction.homeName} vs ${content.prediction.awayName} prediction — Touchline 26`}
              pageUrl={content.prediction.pageUrl}
            />
          )}
        </div>
      </section>
    </div>
  );
}
