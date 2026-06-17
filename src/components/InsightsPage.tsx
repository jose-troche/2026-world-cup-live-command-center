import { useMemo, useState } from "react";
import { ArrowUpRight, Clipboard, Newspaper, Share2, Sparkles } from "lucide-react";
import { buildViralContent } from "../lib/viral";
import type { ContentStory } from "../lib/viral";
import type { TournamentData } from "../types";

type Props = {
  data: TournamentData;
  routeStory?: ContentStory;
};

export function InsightsPage({ data, routeStory }: Props) {
  const [copied, setCopied] = useState("");
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const content = useMemo(() => buildViralContent(data, origin), [data, origin]);

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      setCopied("");
    }
  }

  return (
    <div className="viral-stack">
      <section className="lab-intro viral-intro">
        <div>
          <span className="eyebrow">Content engine</span>
          <h2>Stories and posts from live data</h2>
          <p>
            Generated stories, social post templates, and shareable content — all derived from the same live model powering the rest of Touchline 26.
          </p>
        </div>
        <div className="model-badge"><Sparkles size={16} /> {content.socialPosts.length} posts ready</div>
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
          <div className="viral-actions">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${routeStory.title}\n${routeStory.pageUrl}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 size={14} />
              X
            </a>
            <a
              href={`https://bsky.app/intent/compose?text=${encodeURIComponent(`${routeStory.title}\n${routeStory.pageUrl}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 size={14} />
              Bluesky
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${routeStory.summary} ${routeStory.pageUrl}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 size={14} />
              WhatsApp
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(routeStory.pageUrl)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 size={14} />
              Facebook
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(routeStory.pageUrl)}&text=${encodeURIComponent(routeStory.title)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 size={14} />
              Telegram
            </a>
            <button onClick={() => copyUrl(routeStory.summary)}>
              <Clipboard size={14} />
              Copy summary
            </button>
            <a href={routeStory.cardUrl} target="_blank" rel="noreferrer">
              <ArrowUpRight size={14} />
              Open card
            </a>
          </div>
          {copied === routeStory.summary && <p className="copy-status">Summary copied.</p>}
        </article>
      )}

      <section className="viral-grid">
        <article className="panel viral-list story-list">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Content engine</span>
              <h3>Generated stories</h3>
            </div>
            <Newspaper size={19} />
          </div>
          {content.contentStories.slice(0, 6).map((story) => (
            <div className="story-row" key={story.slug}>
              <span>{story.phase}</span>
              <a href={story.pageUrl}>{story.title}</a>
              <p>{story.summary}</p>
              <div>
                <button onClick={() => copyUrl(story.summary)}>Copy summary</button>
                <a href={story.cardUrl} target="_blank" rel="noreferrer">Card</a>
              </div>
            </div>
          ))}
        </article>

        <article className="panel viral-list post-list">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Automation queue</span>
              <h3>Post templates</h3>
            </div>
          </div>
          {content.socialPosts.map((post) => (
            <div className="post-template" key={`${post.phase}-${post.title}`}>
              <span>{post.phase}</span>
              <strong>{post.title}</strong>
              <p>{post.body}</p>
              <div>
                <button onClick={() => copyUrl(post.body)}>Copy text</button>
                <a href={post.cardUrl} target="_blank" rel="noreferrer">Card</a>
              </div>
            </div>
          ))}
        </article>
      </section>

      <section className="panel seo-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SEO and AI visibility</span>
            <h3>Generated page inventory</h3>
          </div>
          <span>{content.seoPages.length} targets</span>
        </div>
        <div className="seo-grid">
          {content.seoPages.slice(0, 12).map((page) => (
            <a href={page.path} key={page.path}>
              <strong>{page.title}</strong>
              <span>{page.description}</span>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
