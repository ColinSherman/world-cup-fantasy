// Unit tests for podium tie handling — focus: a 3-way tie for 2nd place must
// resolve to a single clean result on both the deterministic (podiumLocks) and
// Monte Carlo (simulateMany) paths.
//
// Run: `node --test src/lib/podium.test.js` from web/ (or `npm test`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { podiumLocks, simulateMany } from './sim.js';
import { resolveBracket, GAMES } from './bracket.js';

// Build a fully-decided results map (every remaining game: first feeder wins), so
// podiumLocks enumerates exactly one scenario and every place is provably locked.
function fullyDecidedResults() {
  const full = {};
  for (let pass = 0; pass < 6; pass++) {
    const resolved = resolveBracket(full);
    for (const g of GAMES) {
      if (!full[g.id] && resolved[g.id]?.a && !resolved[g.id]?.winner) full[g.id] = resolved[g.id].a;
    }
  }
  return full;
}
const DECIDED = fullyDecidedResults();

// Synthetic players with no alive teams: totals come straight from `total`, so the
// bracket outcome can't move them — the tie is fully under the test's control.
const mk = (name, total) => ({ name, total, teams: [] });

// A: sole 1st (20). B/C/D: three-way tie for 2nd (15). E: alone below (10).
const THREE_WAY_2ND = [mk('A', 20), mk('B', 15), mk('C', 15), mk('D', 15), mk('E', 10)];

test('podiumLocks: 3-way tie for 2nd → gold solo, three share silver, bronze absorbed', () => {
  const r = podiumLocks(THREE_WAY_2ND, DECIDED);
  assert.equal(r.decided, true, 'a fully-decided bracket must report decided:true');

  const [first, second, third] = r.ranks;

  // 1st: exactly A
  assert.deepEqual(first, { rank: 1, names: ['A'] });

  // 2nd: the three tied players, locked as one group (order-normalized)
  assert.equal(second.rank, 2);
  assert.deepEqual([...second.names].sort(), ['B', 'C', 'D']);

  // 3rd: absorbed by the tie above — locked, but empty (no bronze exists).
  // `names: []` (not null) is the contract the Podium reads to show "—" instead of "TBD".
  assert.equal(third.rank, 3);
  assert.deepEqual(third.names, [], '3rd must be locked-empty, not contested (null)');

  // The clean-result guarantee: E (real 4th on a 3-way-2nd tie) never leaks onto the podium.
  const shown = r.ranks.flatMap((x) => x.names ?? []);
  assert.ok(!shown.includes('E'), 'E must not appear anywhere on the podium');
});

test('podiumLocks: places absorbed by the tie yield no duplicate / no leftover names', () => {
  const r = podiumLocks(THREE_WAY_2ND, DECIDED);
  const all = r.ranks.flatMap((x) => x.names ?? []);
  // Exactly the four podium-relevant players (A once, B/C/D once), nobody twice.
  assert.equal(all.length, 4);
  assert.equal(new Set(all).size, 4, 'no name may be listed on two steps');
});

test('simulateMany: 3-way tie for 2nd splits 2nd and 3rd evenly and both sum to 1', () => {
  const res = simulateMany(THREE_WAY_2ND, DECIDED, { n: 2000, seed: 7 });

  // A wins every scenario.
  assert.equal(res.poolWin.A, 1);

  // The three tied players each occupy places {2,3,4} together, so they split the single
  // 2nd slot and the single 3rd slot: 1/3 apiece on each.
  for (const p of ['B', 'C', 'D']) {
    assert.ok(Math.abs(res.pool2nd[p] - 1 / 3) < 1e-9, `${p} should hold ~1/3 of 2nd`);
    assert.ok(Math.abs(res.pool3rd[p] - 1 / 3) < 1e-9, `${p} should hold ~1/3 of 3rd`);
  }
  // E is 4th — off the podium entirely.
  assert.equal(res.pool2nd.E, 0);
  assert.equal(res.pool3rd.E, 0);

  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum(res.pool2nd) - 1) < 1e-9, '2nd-place probability must sum to 1');
  assert.ok(Math.abs(sum(res.pool3rd) - 1) < 1e-9, '3rd-place probability must sum to 1');
});
