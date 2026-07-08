// Client-side Monte Carlo over the knockout bracket. Pure + fast (typed arrays).
import { ELO, ALIVE_TEAMS, GAMES, winProb, sanitizeResults, resolveBracket } from './bracket.js';

const TEAMS = ALIVE_TEAMS;
const N_TEAMS = TEAMS.length;
const TI = Object.fromEntries(TEAMS.map((t, i) => [t, i]));

// Pairwise win-probability matrix (idx a beats idx b).
const PW = Array.from({ length: N_TEAMS }, (_, i) =>
  Float64Array.from({ length: N_TEAMS }, (_, j) => (i === j ? 0.5 : winProb(TEAMS[i], TEAMS[j])))
);

// Compile the bracket into integer feeder references (GAMES is in topological order).
const IDX_OF = Object.fromEntries(GAMES.map((g, i) => [g.id, i]));
const COMPILED = GAMES.map((g) => {
  const ref = (f) => (f.team !== undefined ? { t: TI[f.team], g: -1 } : { t: -1, g: IDX_OF[f.game] });
  const [f0, f1] = g.feeders.map(ref);
  return { a0: f0.t, ag: f0.g, b0: f1.t, bg: f1.g };
});
const N_GAMES = COMPILED.length;
const FINAL_IDX = N_GAMES - 1;

function fixedWinnerArray(results) {
  const clean = sanitizeResults(results);
  const resolved = resolveBracket(clean);
  const arr = new Int32Array(N_GAMES).fill(-1);
  for (let i = 0; i < N_GAMES; i++) {
    const w = resolved[GAMES[i].id]?.winner;
    if (w) arr[i] = TI[w];
  }
  return arr;
}

// xorshift128 PRNG (fast, deterministic when seeded).
function makeRng(seed) {
  let x = seed >>> 0 || 123456789, y = 362436069, z = 521288629, w = 88675123;
  return function () {
    const t = x ^ (x << 11);
    x = y; y = z; z = w;
    w = (w ^ (w >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return w / 4294967296;
  };
}

/**
 * Run n simulations from a fixed (partial) results map.
 * players: [{name, total, teams:[{name, alive}]}]
 * returns { n, poolWin:{name:p}, pool2nd:{name:p}, pool3rd:{name:p}, expFinal:{name:v},
 *           champ:{team:p}, roundProb:{team:[p0..p5]} }
 */
export function simulateMany(players, results, { n = 100000, seed = 12345 } = {}) {
  const fixed = fixedWinnerArray(results);
  const P = players.length;
  // pBase = group-stage points only. The loop's `gw` counts ALL knockout wins (both the
  // already-decided games and the simulated ones), so locked points are added there exactly once.
  const pTeams = players.map((p) => p.teams.filter((t) => t.alive).map((t) => TI[t.name]));
  const pBase = players.map((p) => p.total);

  const rng = makeRng(seed);
  const gw = new Int32Array(N_TEAMS);
  const winners = new Int32Array(N_GAMES);
  for (let i = 0; i < N_GAMES; i++) if (fixed[i] >= 0) winners[i] = fixed[i];

  const poolWin = new Float64Array(P);
  const pool2nd = new Float64Array(P);
  const pool3rd = new Float64Array(P);
  const scoreSum = new Float64Array(P);
  const champ = new Int32Array(N_TEAMS);
  const roundCount = new Int32Array(N_TEAMS * 6);
  const totals = new Float64Array(P);

  for (let s = 0; s < n; s++) {
    gw.fill(0);
    // play every game in order
    for (let i = 0; i < N_GAMES; i++) {
      let w;
      if (fixed[i] >= 0) {
        w = fixed[i];
      } else {
        const c = COMPILED[i];
        const a = c.a0 >= 0 ? c.a0 : winners[c.ag];
        const b = c.b0 >= 0 ? c.b0 : winners[c.bg];
        w = rng() < PW[a][b] ? a : b;
      }
      winners[i] = w;
      gw[w]++;
    }
    champ[winners[FINAL_IDX]]++;
    for (let t = 0; t < N_TEAMS; t++) roundCount[t * 6 + gw[t]]++;

    // player totals + top-3 distinct scores (b1 > b2 > b3)
    let b1 = -Infinity, b2 = -Infinity, b3 = -Infinity;
    for (let k = 0; k < P; k++) {
      let tot = pBase[k];
      const arr = pTeams[k];
      for (let j = 0; j < arr.length; j++) tot += 3 * gw[arr[j]];
      totals[k] = tot;
      scoreSum[k] += tot;
      if (tot > b1) { b3 = b2; b2 = b1; b1 = tot; }
      else if (tot < b1 && tot > b2) { b3 = b2; b2 = tot; }
      else if (tot < b2 && tot > b3) { b3 = tot; }
    }
    let c1 = 0, c2 = 0, c3 = 0;
    for (let k = 0; k < P; k++) {
      if (totals[k] === b1) c1++;
      else if (totals[k] === b2) c2++;
      else if (totals[k] === b3) c3++;
    }
    // Ties share places: a group of m tied players occupies the next m places, and each
    // member gets 1/m credit for every place in that span (generalizes the old win split).
    const w1 = 1 / c1, w2 = c2 ? 1 / c2 : 0, w3 = c3 ? 1 / c3 : 0;
    for (let k = 0; k < P; k++) {
      const t = totals[k];
      if (t === b1) {
        poolWin[k] += w1;
        if (c1 >= 2) pool2nd[k] += w1;
        if (c1 >= 3) pool3rd[k] += w1;
      } else if (t === b2) {
        if (c1 === 1) pool2nd[k] += w2;
        if (c1 <= 2 && c1 + c2 >= 3) pool3rd[k] += w2;
      } else if (t === b3) {
        if (c1 + c2 === 2) pool3rd[k] += w3;
      }
    }
  }

  const res = { n, poolWin: {}, pool2nd: {}, pool3rd: {}, expFinal: {}, champ: {}, roundProb: {} };
  players.forEach((p, k) => {
    res.poolWin[p.name] = poolWin[k] / n;
    res.pool2nd[p.name] = pool2nd[k] / n;
    res.pool3rd[p.name] = pool3rd[k] / n;
    res.expFinal[p.name] = scoreSum[k] / n;
  });
  for (let t = 0; t < N_TEAMS; t++) {
    if (champ[t]) res.champ[TEAMS[t]] = champ[t] / n;
    const rp = [];
    for (let k = 0; k < 6; k++) rp.push(roundCount[t * 6 + k] / n);
    res.roundProb[TEAMS[t]] = rp;
  }
  return res;
}
