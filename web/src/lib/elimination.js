// Overlap-aware mathematical elimination + path-to-victory.
// Ported from pairwise.py / elimination.py (verified this session).
import { GAMES, ALIVE_TEAMS, sanitizeResults, resolveBracket } from './bracket.js';

const IDX_OF = Object.fromEntries(GAMES.map((g, i) => [g.id, i]));
const N_GAMES = GAMES.length;
const FINAL_IDX = N_GAMES - 1;
const ALIVE = new Set(ALIVE_TEAMS);

const aliveAndQualified = (player) => player.teams.filter((t) => t.alive).map((t) => t.name);

// Max FUTURE weighted wins over the bracket given decided games (resolved) and a weight fn.
function dpMaxWeighted(resolved, wtOf) {
  const dp = new Array(N_GAMES);
  for (let i = 0; i < N_GAMES; i++) {
    const g = GAMES[i];
    const winner = resolved[g.id]?.winner;
    if (winner) { dp[i] = new Map([[wtOf(winner), 0]]); continue; }
    const child = g.feeders.map((f) => (f.team !== undefined ? new Map([[wtOf(f.team), 0]]) : dp[IDX_OF[f.game]]));
    const [A, B] = child;
    const bestA = Math.max(...A.values()), bestB = Math.max(...B.values());
    const out = new Map();
    const add = (w, val, otherBest) => { const c = val + w + otherBest; if (!out.has(w) || c > out.get(w)) out.set(w, c); };
    for (const [w, v] of A) add(w, v, bestB);
    for (const [w, v] of B) add(w, v, bestA);
    dp[i] = out;
  }
  return Math.max(...dp[FINAL_IDX].values());
}

// Sum of weights over already-decided games' winners.
function lockedWeighted(resolved, wtOf) {
  let s = 0;
  for (const id in resolved) { const w = resolved[id].winner; if (w) s += wtOf(w); }
  return s;
}

export function floorCeiling(player, results) {
  const resolved = resolveBracket(sanitizeResults(results));
  const owned = new Set(aliveAndQualified(player));
  const wt = (t) => (owned.has(t) ? 1 : 0);
  const floor = player.total + 3 * lockedWeighted(resolved, wt);
  const ceiling = floor + 3 * dpMaxWeighted(resolved, wt);
  return { floor, ceiling };
}

// Returns Map name -> { by: [dominator names] } for everyone mathematically eliminated.
export function eliminatedList(players, results) {
  const resolved = resolveBracket(sanitizeResults(results));
  const ownedAlive = new Map(players.map((p) => [p.name, new Set(aliveAndQualified(p))]));
  const out = new Map();
  for (const P of players) {
    const Po0 = ownedAlive.get(P.name);
    const doms = [];
    for (const Q of players) {
      if (Q === P) continue;
      const Qo0 = ownedAlive.get(Q.name);
      const wtOf = (t) => (Po0.has(t) && !Qo0.has(t) ? 1 : Qo0.has(t) && !Po0.has(t) ? -1 : 0);
      const margin = (P.total - Q.total) + 3 * lockedWeighted(resolved, wtOf) + 3 * dpMaxWeighted(resolved, wtOf);
      if (margin < 0) doms.push(Q.name);
    }
    if (doms.length) out.set(P.name, { by: doms });
  }
  return out;
}

// Standings by locked floor (what's guaranteed so far).
export function floorStandings(players, results) {
  return players
    .map((p) => ({ name: p.name, ...floorCeiling(p, results) }))
    .sort((a, b) => b.floor - a.floor || b.ceiling - a.ceiling);
}

/**
 * Path-to-victory summary for one player.
 * proj: output of simulateMany (poolWin, champ, roundProb) for the current scenario.
 */
export function pathInfo(name, players, results, proj) {
  const P = players.find((p) => p.name === name);
  if (!P) return null;
  const elim = eliminatedList(players, results);
  const stand = floorStandings(players, results);
  const me = stand.find((s) => s.name === name);
  const leaderRow = stand[0];
  const isLeader = leaderRow.name === name;
  const winPct = proj?.poolWin?.[name] ?? 0;

  if (elim.has(name)) {
    return { name, status: 'out', by: elim.get(name).by, winPct: 0, floor: me.floor, ceiling: me.ceiling };
  }

  const leader = players.find((p) => p.name === leaderRow.name);
  const myAlive = new Set(aliveAndQualified(P));
  const leaderAlive = new Set(leader ? aliveAndQualified(leader) : []);
  const champOf = (t) => proj?.champ?.[t] ?? 0;

  const leverage = [...myAlive].filter((t) => !leaderAlive.has(t)).sort((a, b) => champOf(b) - champOf(a));
  const shared = [...myAlive].filter((t) => leaderAlive.has(t));
  const threats = isLeader ? [] : [...leaderAlive].filter((t) => !myAlive.has(t)).sort((a, b) => champOf(b) - champOf(a));

  return {
    name,
    status: isLeader ? 'leader' : 'contender',
    winPct,
    floor: me.floor,
    ceiling: me.ceiling,
    rank: stand.findIndex((s) => s.name === name) + 1,
    leader: leaderRow.name,
    gap: Math.max(0, leaderRow.floor - me.floor),
    leverage: leverage.map((t) => ({ team: t, champ: champOf(t) })),
    shared,
    threats: threats.map((t) => ({ team: t, champ: champOf(t) })),
  };
}
