// Regenerate src/data/baseline.json — the leaderboard's initial-paint projection.
// Runs the same in-browser Monte Carlo engine (sim.js) over the final results, so
// the first render matches what the Web Worker computes a moment later.
//
// Inputs are all committed static data; run from web/ with: node scripts/rebuild-baseline.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { simulateMany } from '../src/lib/sim.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const read = (name) => JSON.parse(readFileSync(join(dataDir, name), 'utf8'));

const players = read('players.json');
const results = read('results.json');
const res = simulateMany(players, results, { n: 200000, seed: 999 });

const r5 = (x) => Math.round(x * 1e5) / 1e5;
const mapVals = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
const out = {
  n: res.n,
  poolWin: mapVals(res.poolWin, r5),
  pool2nd: mapVals(res.pool2nd, r5),
  pool3rd: mapVals(res.pool3rd, r5),
  expFinal: mapVals(res.expFinal, r5),
  champ: mapVals(res.champ, r5),
  roundProb: mapVals(res.roundProb, (a) => a.map(r5)),
};
writeFileSync(join(dataDir, 'baseline.json'), JSON.stringify(out, null, 1) + '\n');
console.log('baseline.json rebuilt · champion poolWin:',
  Object.entries(out.poolWin).sort((a, b) => b[1] - a[1])[0]);
