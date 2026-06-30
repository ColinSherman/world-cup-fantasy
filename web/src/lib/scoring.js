// Deterministic leaderboard given a results map (actual + sandbox picks merged).
import { gamesWonByTeam, eliminatedInKnockout } from './bracket.js';

export function standings(players, results) {
  const won = gamesWonByTeam(results);
  const outKO = eliminatedInKnockout(results);
  const rows = players.map((p) => {
    let ko = 0;
    const teams = p.teams.map((t) => {
      const wins = won[t.name] || 0;
      ko += t.alive ? 3 * wins : 0;
      let status = 'alive';
      if (!t.alive) status = 'dead';            // failed to qualify from the group
      else if (outKO.has(t.name)) status = 'out'; // knocked out in the bracket
      return { ...t, wins, status };
    });
    return { name: p.name, base: p.total, ko, total: p.total + ko, teams };
  });
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.total !== prev) { rank = i + 1; prev = r.total; } r.rank = rank; });
  return rows;
}
