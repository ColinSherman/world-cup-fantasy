// Pick'ems: predict knockout winners from Round of 16 on. Flat +1 per correct.
import { ROUND_NAMES } from './bracket.js';

export const PICK_ROUNDS = ['R16', 'QF', 'SF', 'F'];
const roundOf = (id) => id.split('#')[0];
const isPickRound = (id) => PICK_ROUNDS.includes(roundOf(id));

// Games available to pick, grouped by round — only R16+ matchups whose two teams
// are already known (present in the live fixtures feed).
export function pickGames(liveFixtures, results) {
  const byRound = {};
  for (const round of PICK_ROUNDS) byRound[round] = [];
  for (const id in liveFixtures) {
    if (!isPickRound(id)) continue;
    const fx = liveFixtures[id];
    if (!fx?.home || !fx?.away) continue;
    byRound[roundOf(id)].push({
      id, round: roundOf(id), home: fx.home, away: fx.away,
      state: fx.state, locked: fx.state !== 'pre',
      winner: results[id] || null,
    });
  }
  return PICK_ROUNDS
    .map((round) => ({ round, label: ROUND_NAMES[round], games: byRound[round].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })) }))
    .filter((r) => r.games.length);
}

// Leaderboard: correct picks per person (only resolved games count toward score).
export function pickemsStandings(players, picks, results) {
  const rows = players.map((p) => {
    const mine = picks[p.name] || {};
    let correct = 0, resolved = 0, pending = 0;
    for (const id in mine) {
      if (!isPickRound(id)) continue;
      if (results[id]) { resolved++; if (results[id] === mine[id]) correct++; }
      else pending++;
    }
    return { name: p.name, correct, resolved, pending, made: resolved + pending };
  });
  rows.sort((a, b) => b.correct - a.correct || b.resolved - a.resolved || a.name.localeCompare(b.name));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.correct !== prev) { rank = i + 1; prev = r.correct; } r.rank = rank; });
  return rows;
}
