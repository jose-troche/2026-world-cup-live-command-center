# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server with Cloudflare Vite plugin — serves React app + Worker API at http://localhost:5173
npm test           # Run Vitest suite once
npm run build      # TypeScript project builds + Vite production bundle
npm run deploy     # build → wrangler deploy (Worker + static assets)
npm run preview    # Preview production build locally
```

Run a single test file:
```bash
npx vitest run src/lib/bracket.test.ts
```

## Architecture

This is **Touchline 26**, a 2026 World Cup analytics dashboard deployed to Cloudflare's free tier with no paid bindings.

### Two-runtime split

The project compiles two separate TypeScript targets:

- **`worker/index.ts`** — Cloudflare Worker (`tsconfig.worker.json`). Handles all `/api/*`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/feed.xml` routes. Fetches and normalizes ESPN's public scoreboard feed, computes group standings, generates SVG share cards, and builds viral/SEO content. Caches API responses for 15 seconds via `Cache-Control`. Also runs on two cron schedules (`*/15 * * * *` and `0 11 * * *`) to generate automation digests.
- **`src/`** — React 19 SPA (`tsconfig.app.json`). Served as static assets; the Worker handles SPA routing via `not_found_handling: "single-page-application"`.

The `@cloudflare/vite-plugin` wires both together in dev and build.

### Data flow

1. Worker fetches `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` on each `/api/tournament` request.
2. `normalizeEspnMatches()` and `normalizeEspnStadiums()` in `worker/index.ts` convert raw ESPN JSON to the `TournamentData` shape defined in `src/types.ts`.
3. `buildGroupStandings()` computes live standings from finished matches.
4. If ESPN is unavailable, `getTournamentOrFallback()` falls back to `src/data/fallback.ts` (bundled team + match data).
5. The React hook `useTournamentData` (`src/hooks/useTournamentData.ts`) polls `/api/tournament` every 45 seconds.

### Key shared types (`src/types.ts`)

`Team`, `Match`, `Standing`, `Group`, `Stadium`, `TournamentData`, `WinProbability`, `TeamMetrics` — shared between Worker and client.

### Analytics and viral content (`src/lib/`)

- `analytics.ts` — Poisson win probability, xG estimates, team ratings. All outputs are model estimates, not provider data.
- `bracket.ts` — Monte Carlo knockout path simulator.
- `viral.ts` — Generates social posts, SVG share card URLs, SEO pages, "what changed" stories, upset rankings, and power rankings. Called by Worker routes (`/api/viral`, `/api/cards/*`, `/api/automation/digest`, `/api/social/outbox`).

### Worker API routes

| Route | Purpose |
|---|---|
| `/api/tournament` | Live normalized tournament data (502 on ESPN failure, no fallback) |
| `/api/viral` | Full viral content bundle (uses fallback if ESPN unavailable) |
| `/api/content` / `/api/content/:slug` | Narrative story pages |
| `/api/automation/digest` | Dry-run digest for scheduled social automation |
| `/api/social/outbox` | Draft posts formatted per platform (X, Bluesky, Facebook, LinkedIn, Reddit) |
| `/api/cards/match/:id.svg` | SVG prediction share card |
| `/api/cards/what-changed/:id.svg` | SVG "what changed" story card |
| `/api/cards/content/:slug.svg` | SVG content story card |
| `/api/cards/upsets.svg` | SVG upset rankings card |
| `/api/cards/power-rankings.svg` | SVG power rankings card |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt`, `/feed.xml` | SEO/discovery endpoints |

### Testing

Tests are colocated as `*.test.ts` beside their module. Test names follow behavior-focused phrasing (`it("prefills 32 qualifiers across all 12 groups")`). The Worker's exported functions (`normalizeEspnMatches`, `normalizeEspnStadiums`, `buildGroupStandings`) are tested in `worker/index.test.ts`.

### Style conventions

Two-space indentation, double quotes, semicolons, React function components. Components in `src/components/` are PascalCase. Hooks use `use` prefix. Analytics/model helpers live in `src/lib/`; display logic lives in components.

### Deployment

No KV, D1, R2, or paid bindings required. `npm run deploy` builds and deploys to `*.workers.dev`. The live domain is `touchline26.com` (referenced in `DEFAULT_ORIGIN` in `worker/index.ts` for cron-triggered automation digests).
