import { Share2 } from "lucide-react";
import { SHARE_HASHTAGS } from "../lib/viral";

type Props = {
  title: string;
  url: string;
};

export function ShareButtons({ title, url }: Props) {
  const tagged = `${title} ${SHARE_HASHTAGS}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${tagged}\n${url}`)}`;
  const bskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${tagged}\n${url}`)}`;
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  return (
    <>
      <a href={xUrl} target="_blank" rel="noreferrer" className="share-pill">
        <Share2 size={12} /> X
      </a>
      <a href={bskyUrl} target="_blank" rel="noreferrer" className="share-pill">
        <Share2 size={12} /> Bluesky
      </a>
      <a href={redditUrl} target="_blank" rel="noreferrer" className="share-pill">
        <Share2 size={12} /> Reddit
      </a>
      <a href={linkedinUrl} target="_blank" rel="noreferrer" className="share-pill">
        <Share2 size={12} /> LinkedIn
      </a>
    </>
  );
}
