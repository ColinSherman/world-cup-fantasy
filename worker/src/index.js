// Cloudflare Worker: fetches WC knockout results from ESPN's public scoreboard
// API (no key needed), caches accumulating results + live scores in KV.
// Browsers read GET /results (KV, with on-demand background refresh).

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/FIFA.WORLD/scoreboard';

// How fresh KV must be before a /results hit kicks off a background refresh.
const TTL_MS = 25_000;
// Rolling window of days to re-check each refresh (catches games that finish
// late / cross the UTC midnight boundary — e.g. penalty endings on evening US games).
const WINDOW_DAYS = 3;

// Bracket (our canonical team names), mirrors web/src/lib/bracket.js.
const R32 = [
  ['South Africa', 'Canada'], ['Brazil', 'Japan'], ['Germany', 'Paraguay'], ['Netherlands', 'Morocco'],
  ['Ivory Coast', 'Norway'], ['France', 'Sweden'], ['Mexico', 'Ecuador'], ['England', 'DR Congo'],
  ['Belgium', 'Senegal'], ['United States', 'Bosnia and Herzegovina'], ['Spain', 'Austria'], ['Portugal', 'Croatia'],
  ['Switzerland', 'Algeria'], ['Australia', 'Egypt'], ['Argentina', 'Cape Verde'], ['Colombia', 'Ghana'],
];
const R16 = [[1, 4], [3, 6], [2, 5], [7, 8], [12, 11], [10, 9], [15, 14], [13, 16]];
const QF = [[2, 1], [5, 6], [3, 4], [7, 8]];
const SF = [[1, 2], [3, 4]];

function buildGames() {
  const g = [];
  R32.forEach((p, i) => g.push({ id: `R32#${i + 1}`, round: 'R32', teams: p, feeders: null }));
  R16.forEach((p, i) => g.push({ id: `R16#${i + 1}`, round: 'R16', feeders: [`R32#${p[0]}`, `R32#${p[1]}`] }));
  QF.forEach((p, i) => g.push({ id: `QF#${i + 1}`, round: 'QF', feeders: [`R16#${p[0]}`, `R16#${p[1]}`] }));
  SF.forEach((p, i) => g.push({ id: `SF#${i + 1}`, round: 'SF', feeders: [`QF#${p[0]}`, `QF#${p[1]}`] }));
  g.push({ id: 'F#1', round: 'F', feeders: ['SF#1', 'SF#2'] });
  return g;
}
const GAMES = buildGames();

// ESPN displayName → our canonical name.
const ALIAS = {
  "United States": "United States", "USA": "United States",
  "Ivory Coast": "Ivory Coast", "Cote d'Ivoire": "Ivory Coast", "Côte d'Ivoire": "Ivory Coast",
  "DR Congo": "DR Congo", "Congo DR": "DR Congo", "Congo": "DR Congo",
  "Cape Verde": "Cape Verde", "Cape Verde Islands": "Cape Verde", "Cabo Verde": "Cape Verde",
  "Bosnia and Herzegovina": "Bosnia and Herzegovina", "Bosnia": "Bosnia and Herzegovina",
  "South Korea": "South Korea", "Korea Republic": "South Korea",
};
const norm = (name) => ALIAS[name] || name;

// Fetch all fixtures (upcoming/live/finished) for a given YYYYMMDD date string.
async function fetchDay(dateStr) {
  const res = await fetch(`${ESPN_URL}?dates=${dateStr}`, { cf: { cacheTtl: 0 } });
  if (!res.ok) return [];
  const data = await res.json();
  const out = [];
  for (const event of (data.events || [])) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const [c0, c1] = comp.competitors || [];
    if (!c0 || !c1) continue;
    const t = event.status?.type || {};
    const state = t.state || 'pre';            // 'pre' | 'in' | 'post'
    const finished = state === 'post' || t.completed === true;
    out.push({
      home: norm(c0.team?.displayName || ''),
      away: norm(c1.team?.displayName || ''),
      homeScore: parseInt(c0.score || 0),
      awayScore: parseInt(c1.score || 0),
      homeWin: c0.winner === true,
      awayWin: c1.winner === true,
      state,
      finished,
      clock: t.shortDetail || '',             // e.g. "63'", "HT", "FT"
      date: dateStr,
    });
  }
  return out;
}

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

// Last N days (UTC) through today.
function recentDates(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(ymd(d));
  }
  return out;
}

// Full tournament window: R32 start through today.
function fullDates() {
  const start = new Date('2026-06-28T00:00:00Z');
  const today = new Date();
  const dates = [];
  for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) dates.push(ymd(d));
  return dates;
}

function resolveResults(allFixtures) {
  // index by sorted team pair; prefer the most-advanced status (finished > live > pre)
  const rank = (f) => (f.finished ? 2 : f.state === 'in' ? 1 : 0);
  const byPair = {};
  for (const f of allFixtures) {
    if (!f.home || !f.away) continue;
    const key = [f.home, f.away].sort().join('|');
    if (!byPair[key] || rank(f) >= rank(byPair[key])) byPair[key] = f;
  }

  const results = {};
  const fixturesOut = {};
  const winnerOf = (id) => results[id] || null;
  const partsOf = (g) => (g.round === 'R32' ? g.teams : g.feeders.map(winnerOf));

  for (const g of GAMES) {
    const [a, b] = partsOf(g);
    if (!a || !b) continue;
    const fx = byPair[[a, b].sort().join('|')];
    if (!fx) continue;
    fixturesOut[g.id] = {
      home: fx.home, away: fx.away,
      score: `${fx.homeScore}-${fx.awayScore}`,
      state: fx.state,          // pre | in | post
      finished: fx.finished,
      clock: fx.clock,
    };
    // Points only when there's an actual winner (a draw / live tie → no points).
    if (fx.finished) {
      if (fx.homeWin) results[g.id] = fx.home;
      else if (fx.awayWin) results[g.id] = fx.away;
    }
  }
  return { results, fixtures: fixturesOut };
}

async function refresh(env, full = false) {
  const dates = full ? fullDates() : recentDates(WINDOW_DAYS);
  const all = (await Promise.all(dates.map(fetchDay))).flat();

  // Merge over existing KV so already-known results/fixtures persist even if a
  // given refresh's window doesn't re-include their day.
  let existing = { results: {}, fixtures: {} };
  try { existing = JSON.parse(await env.WCF.get('state') || '{}'); } catch {}

  const { results, fixtures } = resolveResults(all);
  const merged = {
    updated: new Date().toISOString(),
    results: { ...existing.results, ...results },
    fixtures: { ...existing.fixtures, ...fixtures },
    datesChecked: dates,
  };
  await env.WCF.put('state', JSON.stringify(merged));
  return merged;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...CORS } });

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/results') {
      let raw = await env.WCF.get('state');
      let state = raw ? safeParse(raw) : null;
      if (!state) {
        // cold cache — fetch synchronously so the first load isn't empty
        state = await refresh(env).catch(() => ({ results: {}, fixtures: {} }));
      } else {
        const age = Date.now() - new Date(state.updated || 0).getTime();
        if (age > TTL_MS) {
          // stale-while-revalidate: refresh in the background, serve current now.
          // The next poll (~poll interval later) gets the fresh scores.
          ctx.waitUntil(refresh(env).catch(() => {}));
        }
      }
      return json(state);
    }

    if (url.pathname === '/refresh' && req.method === 'POST') {
      const secret = url.searchParams.get('key') || req.headers.get('x-refresh-key');
      if (!env.REFRESH_SECRET || secret !== env.REFRESH_SECRET) return json({ error: 'unauthorized' }, 401);
      const full = url.searchParams.get('full') === '1'; // backfill from June 28
      try { return json(await refresh(env, full)); }
      catch (e) { return json({ error: String(e) }, 502); }
    }

    return json({ ok: true, endpoints: ['/results', 'POST /refresh?key=…[&full=1]'] });
  },

  async scheduled(event, env, ctx) {
    // Cron warmer: keeps KV fresh even when nobody is viewing.
    ctx.waitUntil(refresh(env, false).catch((e) => console.error('cron refresh failed', e)));
  },
};

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
