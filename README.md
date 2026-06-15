# Touchline 26

A real-time 2026 World Cup analytics command center designed for Cloudflare's free tier.

## Features

- Live match dashboard with 45-second polling
- Poisson-based in-match win probability
- Model-estimated xG race and pressure map
- Monte Carlo group advancement probabilities
- Interactive knockout path simulator
- Team comparison explorer with tactical radar charts
- Responsive desktop and mobile layouts
- Automatic bundled-data fallback when the live provider is unavailable

## Stack

- React 19 + TypeScript
- Vite and the official Cloudflare Vite plugin
- Cloudflare Worker with static assets
- Recharts for data visualization
- Lucide for interface icons

## Data And Models

Live scores, fixtures, teams, groups, and stadiums come from the free, no-key
[worldcup26.ir API](https://worldcup26.ir/api-docs), backed by the
[open-source World Cup 2026 project](https://github.com/rezarahiminia/worldcup2026).
The Worker normalizes and caches that feed for 30 seconds.

The public feed does not provide live shot locations or provider xG. Touchline 26 therefore labels
xG, win probability, advancement probability, team ratings, and bracket outcomes as model estimates.
They are directional analytics, not betting advice.

## Local Development

```bash
npm install
npm run dev
```

The Cloudflare Vite plugin runs both the React client and Worker API locally.
Open `http://localhost:5173`.

## Verification

```bash
npm test
npm run build
```

## Deploy To Cloudflare

1. Create a free Cloudflare account and authenticate Wrangler:

```bash
npx wrangler login
```

2. Deploy the Worker and static assets:

```bash
npm run deploy
```

Cloudflare will assign a `*.workers.dev` URL. No API key, KV namespace, D1 database, or paid binding
is required. Static asset requests are free, while `/api/tournament` uses the Workers request quota.

For Git-based deployment, use:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Node.js version: 20 or newer

## API Routes

- `GET /api/tournament` returns the normalized tournament payload.
- `GET /api/health` returns a lightweight service check.
