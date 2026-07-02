// Cloudflare Worker: fetches WC knockout results from ESPN's public scoreboard
// API (no key needed), caches accumulating results + live scores in KV.
// Browsers read GET /results (KV, with throttled background refresh).
//
// KV free tier allows only ~1,000 writes/day, so we WRITE ONLY WHEN THE
// MEANINGFUL STATE CHANGES (scores / winners / status) — the volatile match
// clock does not, by itself, trigger a write.

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/FIFA.WORLD/scoreboard';

const TTL_MS = 15_000;      // min gap between background refreshes (per isolate)
const WINDOW_DAYS = 3;      // rolling days re-checked each refresh

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

// ESPN displayName → our canonical name. Extend as new spellings appear.
const ALIAS = {
  "United States": "United States", "USA": "United States",
  "Ivory Coast": "Ivory Coast", "Cote d'Ivoire": "Ivory Coast", "Côte d'Ivoire": "Ivory Coast",
  "DR Congo": "DR Congo", "Congo DR": "DR Congo", "Congo": "DR Congo",
  "Cape Verde": "Cape Verde", "Cape Verde Islands": "Cape Verde", "Cabo Verde": "Cape Verde",
  "Bosnia and Herzegovina": "Bosnia and Herzegovina", "Bosnia-Herzegovina": "Bosnia and Herzegovina", "Bosnia & Herzegovina": "Bosnia and Herzegovina", "Bosnia": "Bosnia and Herzegovina",
  "South Korea": "South Korea", "Korea Republic": "South Korea",
};
const norm = (name) => ALIAS[name] || name;

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
    const state = t.state || 'pre';
    const finished = state === 'post' || t.completed === true;
    out.push({
      home: norm(c0.team?.displayName || ''),
      away: norm(c1.team?.displayName || ''),
      homeScore: parseInt(c0.score || 0),
      awayScore: parseInt(c1.score || 0),
      homeWin: c0.winner === true,
      awayWin: c1.winner === true,
      state, finished,
      clock: t.shortDetail || '',
      date: dateStr,
    });
  }
  return out;
}

const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
function recentDates(n) {
  const out = [], today = new Date();
  for (let i = n - 1; i >= 0; i--) { const d = new Date(today); d.setUTCDate(d.getUTCDate() - i); out.push(ymd(d)); }
  return out;
}
function fullDates() {
  const start = new Date('2026-06-28T00:00:00Z'), today = new Date(), dates = [];
  for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) dates.push(ymd(d));
  return dates;
}

function resolveResults(allFixtures) {
  const rank = (f) => (f.finished ? 2 : f.state === 'in' ? 1 : 0);
  const byPair = {};
  for (const f of allFixtures) {
    if (!f.home || !f.away) continue;
    const key = [f.home, f.away].sort().join('|');
    if (!byPair[key] || rank(f) >= rank(byPair[key])) byPair[key] = f;
  }
  const results = {}, fixturesOut = {};
  const winnerOf = (id) => results[id] || null;
  const partsOf = (g) => (g.round === 'R32' ? g.teams : g.feeders.map(winnerOf));
  for (const g of GAMES) {
    const [a, b] = partsOf(g);
    if (!a || !b) continue;
    const fx = byPair[[a, b].sort().join('|')];
    if (!fx) continue;
    fixturesOut[g.id] = { home: fx.home, away: fx.away, score: `${fx.homeScore}-${fx.awayScore}`, state: fx.state, finished: fx.finished, clock: fx.clock };
    if (fx.finished) {
      if (fx.homeWin) results[g.id] = fx.home;
      else if (fx.awayWin) results[g.id] = fx.away;
    }
  }
  return { results, fixtures: fixturesOut };
}

// Meaningful signature — excludes `updated`, `datesChecked`, and the volatile
// match `clock`, so a ticking clock alone does not cost a KV write.
function signature(state) {
  const fx = {};
  for (const k in (state.fixtures || {})) {
    const f = state.fixtures[k];
    fx[k] = `${f.home}|${f.away}|${f.score}|${f.state}|${f.finished}`;
  }
  return JSON.stringify({ r: state.results || {}, fx });
}

async function refresh(env, full = false) {
  const dates = full ? fullDates() : recentDates(WINDOW_DAYS);
  const all = (await Promise.all(dates.map(fetchDay))).flat();

  let existing = { results: {}, fixtures: {} };
  try { existing = JSON.parse(await env.WCF.get('state') || '{}') || existing; } catch {}

  const { results, fixtures } = resolveResults(all);
  const merged = {
    results: { ...existing.results, ...results },
    fixtures: { ...existing.fixtures, ...fixtures },
    datesChecked: dates,
  };

  const changed = signature(merged) !== signature(existing);
  if (changed) {
    merged.updated = new Date().toISOString();
    await env.WCF.put('state', JSON.stringify(merged));   // WRITE only on real change
  } else {
    merged.updated = existing.updated || new Date().toISOString();
  }
  return { state: merged, changed };
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...CORS } });

let lastRefreshAt = 0; // per-isolate throttle for on-demand refreshes

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/results') {
      const raw = await env.WCF.get('state');
      let state = raw ? safeParse(raw) : null;
      if (!state) {
        state = (await refresh(env).catch(() => null))?.state || { results: {}, fixtures: {} };
      } else if (Date.now() - lastRefreshAt > TTL_MS) {
        // Throttled background refresh; refresh() only WRITES KV if data changed,
        // so heavy polling can't exhaust the daily write quota.
        lastRefreshAt = Date.now();
        ctx.waitUntil(refresh(env).catch(() => {}));
      }
      return json(state);
    }

    if (url.pathname === '/refresh' && req.method === 'POST') {
      const secret = url.searchParams.get('key') || req.headers.get('x-refresh-key');
      if (!env.REFRESH_SECRET || secret !== env.REFRESH_SECRET) return json({ error: 'unauthorized' }, 401);
      const full = url.searchParams.get('full') === '1';
      try { const { state, changed } = await refresh(env, full); return json({ ...state, changed }); }
      catch (e) { return json({ error: String(e) }, 502); }
    }

    return json({ ok: true, endpoints: ['/results', 'POST /refresh?key=…[&full=1]'] });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(refresh(env, false).catch((e) => console.error('cron refresh failed', e)));
  },
};

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
