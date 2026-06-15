# Repository Guidelines

## Project Structure & Module Organization

Touchline 26 is a React 19 + TypeScript Vite app backed by a Cloudflare Worker. Client code lives in `src/`: UI in `src/components`, data hooks in `src/hooks`, helpers in `src/lib`, fallback data in `src/data`, and shared types in `src/types.ts`. Worker API routes are in `worker/index.ts`. Global styling is in `src/styles.css`. Tests are colocated as `*.test.ts`. Social/demo assets and capture tooling live in `social/` and `scripts/`.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: start Vite with the Cloudflare Vite plugin for the React app and Worker API.
- `npm test`: run the Vitest suite once.
- `npm run build`: run TypeScript project builds and create the Vite production bundle.
- `npm run preview`: preview the built app locally.
- `npm run deploy`: build, then deploy the Worker and static assets with Wrangler.
- `npm run capture:social`: generate the social demo capture from `scripts/capture-social-demo.mjs`.

## Coding Style & Naming Conventions

Use TypeScript modules with explicit imports and exported helpers for testable logic. Match the existing two-space indentation, double quotes, semicolons, and React function component style. Name components in PascalCase (`LiveDashboard.tsx`), hooks with `use` prefixes (`useTournamentData.ts`), and helpers in camelCase. Keep analytics/model code in `src/lib` and display logic in components.

## Testing Guidelines

Vitest is the test framework. Place tests next to the target module as `moduleName.test.ts`, and prefer behavior-focused names such as `it("prefills 32 qualifiers across all 12 groups")`. Add or update tests when changing bracket logic, analytics calculations, local storage behavior, or data normalization. Run `npm test` before handing off changes; run `npm run build` when touching TypeScript config, Worker code, or deployment behavior.

## Commit & Pull Request Guidelines

Recent commits use short imperative or descriptive summaries, for example `added all brackets` and `removed 502 errors`. Keep commit messages concise and focused. Pull requests should include a brief summary, verification commands run, linked issues when relevant, and screenshots or screen recordings for UI changes. Note data-source, Cloudflare, or Wrangler configuration changes explicitly.

## Security & Configuration Tips

The live tournament feed is public and no API key is required. Do not commit secrets or local Wrangler credentials. Keep `wrangler.jsonc` aligned with Worker routes under `/api/*`, and preserve the bundled fallback path so the app continues to work when the live provider is unavailable.
