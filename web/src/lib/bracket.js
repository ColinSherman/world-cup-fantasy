// Static bracket + Elo constants for the 2026 WC knockout stage.
// Scoring: a team earns 3 points per knockout game it WINS (advancer = 3, no draws).

export const ELO = {
  Spain: 2144, Argentina: 2144, France: 2123, England: 2028, Brazil: 2009,
  Netherlands: 2030, Portugal: 2010, Colombia: 1990, Croatia: 1970, Germany: 1965,
  Belgium: 1935, Morocco: 1925, Japan: 1875, Switzerland: 1860, Senegal: 1855,
  Norway: 1850, Ecuador: 1850, Austria: 1845, Sweden: 1815, 'United States': 1810,
  Mexico: 1800, Algeria: 1785, 'Ivory Coast': 1770, Canada: 1765, Paraguay: 1760,
  'Bosnia and Herzegovina': 1760, Egypt: 1755, Australia: 1745, 'South Africa': 1730,
  Ghana: 1720, 'DR Congo': 1715, 'Cape Verde': 1650,
};

// Round of 32 matchups, in official game order (1-indexed by position).
export const R32 = [
  ['South Africa', 'Canada'], ['Brazil', 'Japan'], ['Germany', 'Paraguay'], ['Netherlands', 'Morocco'],
  ['Ivory Coast', 'Norway'], ['France', 'Sweden'], ['Mexico', 'Ecuador'], ['England', 'DR Congo'],
  ['Belgium', 'Senegal'], ['United States', 'Bosnia and Herzegovina'], ['Spain', 'Austria'], ['Portugal', 'Croatia'],
  ['Switzerland', 'Algeria'], ['Australia', 'Egypt'], ['Argentina', 'Cape Verde'], ['Colombia', 'Ghana'],
];
// Each later round pairs winners of earlier games (1-indexed into the previous round's list).
export const R16 = [[1, 4], [3, 6], [2, 5], [7, 8], [12, 11], [10, 9], [15, 14], [13, 16]];
export const QF = [[2, 1], [5, 6], [3, 4], [7, 8]];
export const SF = [[1, 2], [3, 4]];

export const ROUND_NAMES = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', F: 'Final' };
export const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'F'];
// Date windows for each round (per-fixture kickoff times fill in from the live feed).
export const ROUND_DATE = { R32: 'Jun 28 – Jul 3', R16: 'Jul 4 – 7', QF: 'Jul 9 – 11', SF: 'Jul 14 – 15', F: 'Jul 19' };

// Build an ordered list of games with their feeders.
function buildGames() {
  const g = [];
  R32.forEach((pair, i) => g.push({ id: `R32#${i + 1}`, round: 'R32', feeders: [{ team: pair[0] }, { team: pair[1] }] }));
  R16.forEach((p, i) => g.push({ id: `R16#${i + 1}`, round: 'R16', feeders: [{ game: `R32#${p[0]}` }, { game: `R32#${p[1]}` }] }));
  QF.forEach((p, i) => g.push({ id: `QF#${i + 1}`, round: 'QF', feeders: [{ game: `R16#${p[0]}` }, { game: `R16#${p[1]}` }] }));
  SF.forEach((p, i) => g.push({ id: `SF#${i + 1}`, round: 'SF', feeders: [{ game: `QF#${p[0]}` }, { game: `QF#${p[1]}` }] }));
  g.push({ id: 'F#1', round: 'F', feeders: [{ game: 'SF#1' }, { game: 'SF#2' }] });
  return g;
}
export const GAMES = buildGames();
export const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));

export const ALIVE_TEAMS = Object.keys(ELO);

// Feeder game ids per game (empty for R32, which feeds from teams).
export const CHILDREN = Object.fromEntries(
  GAMES.map((g) => [g.id, g.feeders.filter((f) => f.game !== undefined).map((f) => f.game)])
);

// Traditional left-to-right bracket layout: each game is vertically centered between the
// two games that feed it. Returns absolute positions keyed by game id.
export function bracketLayout({ gameH = 48, vgap = 26, colW = 168, colGap = 38, padTop = 16 } = {}) {
  // Leaf (R32) order via DFS from the final → a non-crossing top-to-bottom ordering.
  const order = [];
  (function dfs(id) {
    const ch = CHILDREN[id];
    if (!ch.length) { order.push(id); return; }
    ch.forEach(dfs);
  })('F#1');
  const rowOf = Object.fromEntries(order.map((id, i) => [id, i]));
  const colOf = { R32: 0, R16: 1, QF: 2, SF: 3, F: 4 };
  const unit = gameH + vgap;
  const center = {};
  const pos = {};
  for (const round of ROUND_ORDER) {
    for (const g of GAMES.filter((x) => x.round === round)) {
      const cy = round === 'R32'
        ? padTop + rowOf[g.id] * unit + gameH / 2
        : (center[CHILDREN[g.id][0]] + center[CHILDREN[g.id][1]]) / 2;
      center[g.id] = cy;
      pos[g.id] = { x: colOf[round] * (colW + colGap), y: cy - gameH / 2, cy, col: colOf[round] };
    }
  }
  const width = colOf.F * (colW + colGap) + colW;
  const height = padTop + order.length * unit - vgap + padTop;
  return { pos, width, height, gameH, colW, colGap, order };
}

// Elo win probability of a over b (no draws).
export function winProb(a, b) {
  return 1 / (1 + 10 ** ((ELO[b] - ELO[a]) / 400));
}

// Given a results map {gameId: winner}, return per-game {a, b, winner}.
// Cascades: a decided winner that's no longer a valid participant is treated as undecided.
export function resolveBracket(results) {
  const out = {};
  for (const g of GAMES) {
    const sides = g.feeders.map((f) => (f.team !== undefined ? f.team : out[f.game]?.winner ?? null));
    let winner = results[g.id] ?? null;
    if (winner !== null && !sides.includes(winner)) winner = null; // invalidated by an upstream change
    out[g.id] = { id: g.id, round: g.round, a: sides[0], b: sides[1], winner };
  }
  return out;
}

// A sanitized copy of results with any now-invalid downstream picks removed.
export function sanitizeResults(results) {
  const resolved = resolveBracket(results);
  const clean = {};
  for (const id in results) if (resolved[id]?.winner === results[id]) clean[id] = results[id];
  return clean;
}

// Count knockout games won per team under a results map.
export function gamesWonByTeam(results) {
  const won = {};
  for (const id in results) {
    const w = results[id];
    if (w) won[w] = (won[w] || 0) + 1;
  }
  return won;
}

// Teams eliminated by a LOST knockout game under a results map.
export function eliminatedInKnockout(results) {
  const resolved = resolveBracket(results);
  const out = new Set();
  for (const id in resolved) {
    const { a, b, winner } = resolved[id];
    if (winner) out.add(winner === a ? b : a);
  }
  return out;
}
