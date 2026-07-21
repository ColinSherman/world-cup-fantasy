# World Cup 2026 Fantasy Pool

An interactive dashboard for a 25-person World Cup fantasy pool. Each player drafted
six national teams and earns points as those teams advance through the knockout
bracket. The app ran live throughout the 2026 tournament and is now preserved as a
**static archive** of the final results — no backend, no API calls, fully
self-contained.

Every projection is computed **in the browser**: an Elo-based Monte Carlo runs in a
Web Worker, and podium finishes are settled by an exhaustive proof over every
remaining bracket outcome. The bracket stays fully interactive — rewrite any result
in the *sandbox* and watch the odds and standings re-simulate instantly.

> **Final results:** Spain beat Argentina 1–0 (AET) in the final. In the fantasy pool,
> **Nicole L** took the title with 61 points, ahead of **Fred S** (52) and **Colin S** (51).

## Features

- **Leaderboard** — live standings with each player's teams, plus Monte Carlo odds of
  finishing **1st / 2nd / 3rd**.
- **Auto podium** — the champion banner and 🥇🥈🥉 podium reveal themselves the moment
  a place becomes *mathematically clinched*, not merely likely. Tie-aware, and immune
  to sandbox tinkering (it reads only the real results).
- **Sandbox bracket** — click any matchup to send a different team through; the whole
  table, podium odds, and path-to-victory re-compute against your hypothetical.
- **Path to victory** — per-player breakdown of which remaining outcomes they need.
- **Confetti** — a light sprinkle while places are in play, full celebration once the
  entire podium is locked (respects `prefers-reduced-motion`).
- Responsive: two-column desktop layout, tabbed mobile layout with a bottom nav.

## How it works

**In-browser Monte Carlo** (`src/lib/sim.js`, run off the main thread via
`sim.worker.js`). Pairwise win probabilities come from an Elo model; the bracket is
compiled to typed-array feeder references and played out with a seeded xorshift PRNG —
100k runs per interactive update, 200k for the precomputed initial paint. The
sandbox's win-% *delta* uses common random numbers
(same seed for both projections) so Monte Carlo noise cancels and the change is clean.

**Deterministic podium proof** (`podiumLocks` in `sim.js`). Once few enough games
remain, it enumerates *every* possible completion of the bracket (2^undecided) and
reports a place as locked only if the same player(s) hold it in all of them — a proof,
not an estimate. Competition ranking makes it tie-aware: three players tied for 2nd
lock the 2nd step together and absorb 3rd. Covered by `src/lib/podium.test.js`.

## Tech

- **Svelte 5** (runes: `$state` / `$derived` / `$effect`) + **Vite**
- **Web Workers** for off-main-thread simulation
- **flag-icons** for team flags
- Zero runtime dependencies on any server — deploys as static files to
  **Cloudflare Pages**

## Project structure

```
web/                     Vite + Svelte frontend (the app)
  src/
    App.svelte           top-level composition + state
    lib/
      sim.js             Monte Carlo engine + deterministic podium proof
      sim.worker.js      runs the sim off the main thread
      simClient.js       promise wrapper around the worker
      bracket.js         bracket structure, Elo ratings, win probability
      scoring.js         standings from a results map
      elimination.js     overlap-aware elimination / path-to-victory
      Leaderboard.svelte, Bracket.svelte, Podium.svelte,
      WinnerBanner.svelte, PathToVictory.svelte   — UI
      podium.test.js     node:test coverage for tie handling
    data/                frozen static data (see below)
  scripts/
    rebuild-baseline.mjs regenerates baseline.json from the committed data
worker/                  Cloudflare Worker (decommissioned — see below)
```

### Data (`web/src/data/`)

All frozen after the tournament:

- `players.json` — the 25 entrants, their six teams, and group-stage points.
- `results.json` — the winner of every knockout game (all 31, R32 → Final).
- `fixtures.json` — final scores per game.
- `schedule.json` — kickoff dates / venues.
- `baseline.json` — the leaderboard's initial-paint projection; regenerate with
  `node scripts/rebuild-baseline.mjs`.

## Local development

```sh
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # static bundle → dist/
npm test           # podium/tie unit tests (node:test)
```

## The `worker/` directory (historical)

During the tournament, a Cloudflare Worker pulled live knockout results from ESPN's
public scoreboard API into KV every couple of minutes, and the frontend polled a
single `/results` endpoint (browsers never hit ESPN directly). Now that results are
frozen and served statically, **the Worker is no longer deployed** and its warmer cron
has been removed. The code is kept as a record of the live-data architecture; to fully
retire the deployed instance, run `cd worker && npx wrangler delete`.

## Deploy

The frontend is a static bundle. On Cloudflare Pages: root directory `web`, build
command `npm run build`, output directory `dist`. Any static host works equally well.
