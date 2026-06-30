# World Cup 2026 Fantasy Pool

A small web app for a 25-person World Cup 2026 fantasy pool: live leaderboard,
interactive "sandbox" bracket, and a per-person path-to-victory, with Elo-based
Monte Carlo simulations running entirely in the browser.

## Layout

- **`web/`** — Vite + Svelte frontend (deployed to Cloudflare Pages).
  - `src/lib/bracket.js` — bracket structure, Elo ratings, win-probability.
  - `src/lib/sim.js` / `sim.worker.js` — client-side Monte Carlo (Web Worker).
  - `src/lib/elimination.js` — overlap-aware elimination / path-to-victory.
  - `src/lib/Leaderboard.svelte`, `Bracket.svelte`, `PathToVictory.svelte` — UI.
  - `src/data/` — generated `players.json`, `baseline.json`, `schedule.json`.
- **`worker/`** — Cloudflare Worker that pulls live knockout results from ESPN's
  public API into KV every 30 min. The frontend reads `/results`; browsers never
  hit ESPN directly. Secrets live in `worker/.dev.vars` (gitignored).
- **`scripts/build_data.py`** — regenerates the frontend's JSON data from the CSV.
- Root `*.py` — original analysis scripts (elimination, Monte Carlo, etc.).

## Deploy

**Frontend** auto-deploys via Cloudflare Pages on push:
- Push to `main` → production. Push any other branch → preview URL.
- Build settings: root dir `web`, build `npm run build`, output `dist`.

**Worker** (only when `worker/` changes) is deployed manually:
```sh
cd worker && npx wrangler deploy
```

## Local dev

```sh
cd web && npm install && npm run dev          # frontend on :5173
cd worker && npm install && npx wrangler dev   # worker on :8787 (reads ESPN)
```
