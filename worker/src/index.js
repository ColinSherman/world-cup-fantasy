// Cloudflare Worker: fetches WC knockout results from ESPN's public scoreboard
// API (no key needed), caches accumulating results in KV.
// Browsers read GET /results (KV only) — zero API calls from clients.

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/FIFA.WORLD/scoreboard';

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

// Fetch all finished/live fixtures for a given YYYYMMDD date string.
async function fetchDay(dateStr) {
  const res = await fetch(`${ESPN_URL}?dates=${dateStr}`);
  if (!res.ok) return [];
  const data = await res.json();
  const out = [];
  for (const event of (data.events || [])) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const [c0, c1] = comp.competitors || [];
    if (!c0 || !c1) continue;
    const statusShort = event.status?.type?.shortDetail || '';
    const finished = ['FT', 'Full Time'].includes(event.status?.type?.description) ||
                     event.status?.type?.completed === true;
    out.push({
      home: norm(c0.team?.displayName || ''),
      away: norm(c1.team?.displayName || ''),
      homeScore: parseInt(c0.score || 0),
      awayScore: parseInt(c1.score || 0),
      homeWin: c0.winner === true,
      awayWin: c1.winner === true,
      finished,
      date: dateStr,
    });
  }
  return out;
}

// Return array of YYYYMMDD strings from WC R32 start through today.
function datesRange() {
  const start = new Date('2026-06-28');
  const today = new Date();
  const dates = [];
  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10).replace(/-/g, ''));
  }
  return dates;
}

function resolveResults(allFixtures) {
  // Build lookup: sorted pair → fixture
  const byPair = {};
  for (const f of allFixtures) {
    if (!f.home || !f.away) continue;
    const key = [f.home, f.away].sort().join('|');
    // Prefer finished result over in-progress
    if (!byPair[key] || f.finished) byPair[key] = f;
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
      finished: fx.finished,
    };
    if (fx.finished) {
      if (fx.homeWin) results[g.id] = fx.home;
      else if (fx.awayWin) results[g.id] = fx.away;
    }
  }
  return { results, fixtures: fixturesOut };
}

async function refresh(env, full = false) {
  const dates = full ? datesRange() : [new Date().toISOString().slice(0, 10).replace(/-/g, '')];
  const all = (await Promise.all(dates.map(fetchDay))).flat();

  // Merge: keep existing KV results for games ESPN hasn't returned yet
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
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (url.pathname === '/results') {
      const cached = (await env.WCF.get('state')) || '{"results":{},"fixtures":{}}';
      return new Response(cached, { headers: { 'content-type': 'application/json', ...CORS } });
    }

    if (url.pathname === '/refresh' && req.method === 'POST') {
      const secret = url.searchParams.get('key') || req.headers.get('x-refresh-key');
      if (!env.REFRESH_SECRET || secret !== env.REFRESH_SECRET) return json({ error: 'unauthorized' }, 401);
      // ?full=1 backfills from June 28 through today (all R32 games etc.)
      const full = url.searchParams.get('full') === '1';
      try { return json(await refresh(env, full)); }
      catch (e) { return json({ error: String(e) }, 502); }
    }

    return json({ ok: true, endpoints: ['/results', 'POST /refresh?key=…[&full=1]'] });
  },

  async scheduled(event, env, ctx) {
    // Cron: fetch today's games only (1 ESPN call)
    ctx.waitUntil(refresh(env, false).catch((e) => console.error('cron refresh failed', e)));
  },
};
