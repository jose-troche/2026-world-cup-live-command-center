import { describe, expect, it, vi } from "vitest";
import { fallbackTeams } from "../src/data/fallback";
import worker, { buildGroupStandings, normalizeEspnMatches } from "./index";

const noopStmt = {
  bind: (..._args: unknown[]) => noopStmt,
  run: async () => ({ results: [], success: true, meta: {} }),
  all: async () => ({ results: [], success: true, meta: {} }),
  first: async () => null,
};

const noopD1 = {
  prepare: (_q: string) => noopStmt,
  exec: async (_q: string) => ({ results: [], success: true, meta: {} }),
};

const mockEnv = {
  GOAL_HISTORY: {
    get: async () => null,
    put: async () => undefined,
  },
  ASSETS: {
    fetch: async () => new Response("", { status: 404 }),
  },
  ANALYTICS: noopD1,
  ANALYTICS_KEY: "test",
} as Parameters<typeof worker.fetch>[1];

describe("ESPN scoreboard normalization", () => {
  it("maps a live Saudi Arabia lead over Uruguay into app match data", () => {
    const matches = normalizeEspnMatches({
      events: [
        {
          id: "760429",
          date: "2026-06-15T22:00Z",
          competitions: [
            {
              id: "760429",
              date: "2026-06-15T22:00Z",
              altGameNote: "FIFA World Cup, Group H",
              status: {
                clock: 2520,
                displayClock: "42'",
                period: 1,
                type: {
                  name: "STATUS_FIRST_HALF",
                  state: "in",
                  completed: false,
                },
              },
              venue: {
                id: "4643",
                fullName: "Hard Rock Stadium",
                address: { city: "Miami Gardens, Florida" },
              },
              competitors: [
                {
                  homeAway: "home",
                  score: "1",
                  team: { abbreviation: "KSA", displayName: "Saudi Arabia" },
                },
                {
                  homeAway: "away",
                  score: "0",
                  team: { abbreviation: "URU", displayName: "Uruguay" },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      homeName: "Saudi Arabia",
      awayName: "Uruguay",
      homeScore: 1,
      awayScore: 0,
      group: "H",
      status: "live",
      minute: 42,
    });
  });

  it("computes current group standings from live and finished matches", () => {
    const matches = normalizeEspnMatches({
      events: [
        {
          id: "760428",
          date: "2026-06-15T16:00Z",
          competitions: [
            {
              date: "2026-06-15T16:00Z",
              altGameNote: "FIFA World Cup, Group H",
              status: { type: { state: "post", completed: true } },
              competitors: [
                { homeAway: "home", score: "0", team: { abbreviation: "ESP" } },
                { homeAway: "away", score: "0", team: { abbreviation: "CPV" } },
              ],
            },
          ],
        },
        {
          id: "760429",
          date: "2026-06-15T22:00Z",
          competitions: [
            {
              date: "2026-06-15T22:00Z",
              altGameNote: "FIFA World Cup, Group H",
              status: { type: { state: "in", completed: false } },
              competitors: [
                { homeAway: "home", score: "1", team: { abbreviation: "KSA" } },
                { homeAway: "away", score: "0", team: { abbreviation: "URU" } },
              ],
            },
          ],
        },
      ],
    });

    const groupH = buildGroupStandings(fallbackTeams, matches).find((group) => group.name === "H");

    expect(groupH?.standings[0]).toMatchObject({
      teamId: "31",
      points: 3,
      goalsFor: 1,
      goalsAgainst: 0,
    });
    expect(groupH?.standings.find((standing) => standing.teamId === "32")).toMatchObject({
      points: 0,
      goalsAgainst: 1,
    });
  });
});

describe("viral Worker endpoints", () => {
  it("returns a viral content feed when live data is unavailable", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    try {
      const response = await worker.fetch(new Request("https://touchline26.test/api/viral"), mockEnv);
      const payload = await response.json() as { prediction?: { title: string }; powerRankings: unknown[] };

      expect(response.status).toBe(200);
      expect(payload.prediction?.title).toBeTruthy();
      expect(payload.powerRankings).toHaveLength(10);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("returns an SVG match prediction card", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    try {
      const response = await worker.fetch(new Request("https://touchline26.test/api/cards/match/14.svg"), mockEnv);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("image/svg+xml");
      expect(body).toContain("Generated by Touchline26.com");
      expect(body).toContain("Spain vs Cape Verde");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("returns generated content stories and story cards", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    try {
      const listResponse = await worker.fetch(new Request("https://touchline26.test/api/content"), mockEnv);
      const listPayload = await listResponse.json() as { stories: Array<{ slug: string; title: string }> };
      const firstStory = listPayload.stories[0];
      const storyResponse = await worker.fetch(new Request(`https://touchline26.test/api/content/${firstStory.slug}`), mockEnv);
      const story = await storyResponse.json() as { title: string; body: string[] };
      const cardResponse = await worker.fetch(new Request(`https://touchline26.test/api/cards/content/${firstStory.slug}.svg`), mockEnv);
      const card = await cardResponse.text();

      expect(listResponse.status).toBe(200);
      expect(firstStory.slug).toBeTruthy();
      expect(storyResponse.status).toBe(200);
      expect(story.title).toBe(firstStory.title);
      expect(story.body.length).toBeGreaterThan(1);
      expect(cardResponse.headers.get("Content-Type")).toContain("image/svg+xml");
      expect(card).toContain("Generated by Touchline26.com");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("returns a dry-run automation digest for scheduled social posts", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    try {
      const response = await worker.fetch(new Request("https://touchline26.test/api/automation/digest"), mockEnv);
      const payload = await response.json() as { mode: string; posts: unknown[]; platformPosts: unknown[]; note: string };

      expect(response.status).toBe(200);
      expect(payload.mode).toBe("dry-run");
      expect(payload.posts.length).toBeGreaterThan(0);
      expect(payload.platformPosts.length).toBeGreaterThan(payload.posts.length);
      expect(payload.note).toContain("credentials");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("returns platform-specific social drafts", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    try {
      const response = await worker.fetch(new Request("https://touchline26.test/api/social/outbox"), mockEnv);
      const payload = await response.json() as { mode: string; posts: Array<{ platform: string; status: string }> };

      expect(response.status).toBe(200);
      expect(payload.mode).toBe("draft");
      expect(payload.posts.some((post) => post.platform === "x")).toBe(true);
      expect(payload.posts.some((post) => post.platform === "reddit" && post.status === "manual-review-required")).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("serves crawler and AI discovery files", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    try {
      const sitemap = await worker.fetch(new Request("https://touchline26.test/sitemap.xml"), mockEnv);
      const sitemapBody = await sitemap.text();
      const robots = await worker.fetch(new Request("https://touchline26.test/robots.txt"), mockEnv);
      const llms = await worker.fetch(new Request("https://touchline26.test/llms.txt"), mockEnv);
      const llmsBody = await llms.text();
      const feed = await worker.fetch(new Request("https://touchline26.test/feed.xml"), mockEnv);
      const feedBody = await feed.text();

      expect(sitemap.headers.get("Content-Type")).toContain("application/xml");
      expect(sitemapBody).toContain("https://touchline26.test/teams/united-states");
      expect(await robots.text()).toContain("Sitemap: https://touchline26.test/sitemap.xml");
      expect(llms.headers.get("Content-Type")).toContain("text/plain");
      expect(llmsBody).toContain("Viral content feed");
      expect(feed.headers.get("Content-Type")).toContain("application/rss+xml");
      expect(feedBody).toContain("<rss version=\"2.0\">");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
