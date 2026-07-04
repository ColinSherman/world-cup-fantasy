// Cumulative points per player across the tournament timeline.
// Baseline = group-stage total; each knockout win a player's team gets adds 3,
// effective from that game's scheduled date. Returns checkpoints (x-axis) and
// one cumulative series per player.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MIDX = Object.fromEntries(MON.map((m, i) => [m, i]));
const fmt = (d) => `${MON[d.getMonth()]} ${d.getDate()}`;

function parseDate(s) {
  const [m, d] = String(s).split(' ');
  return new Date(2026, MIDX[m] ?? 0, parseInt(d) || 1);
}

export function scoreTrajectory(players, effective, schedule) {
  // Every decided knockout game → { winning team, date }.
  const wins = [];
  for (const gid in effective) {
    const winner = effective[gid];
    const sc = schedule[gid];
    if (!winner || !sc) continue;
    wins.push({ team: winner, t: +parseDate(sc.date) });
  }

  // Checkpoints: "Groups" baseline, then each distinct result date in order.
  const dates = [...new Set(wins.map((w) => w.t))].sort((a, b) => a - b);
  const checkpoints = [{ label: 'Groups', t: -Infinity }, ...dates.map((t) => ({ label: fmt(new Date(t)), t }))];

  const series = players.map((p) => {
    const owned = new Set(p.teams.filter((t) => t.alive).map((t) => t.name));
    const relevant = wins.filter((w) => owned.has(w.team));
    const pts = checkpoints.map((cp) => p.total + 3 * relevant.filter((w) => w.t <= cp.t).length);
    return { name: p.name, pts, final: pts[pts.length - 1] };
  });

  // Rank each player at each checkpoint (1 = best), for the "who's in first" read.
  const ranks = series.map(() => []);
  checkpoints.forEach((_, ci) => {
    const order = series.map((s, i) => ({ i, v: s.pts[ci] })).sort((a, b) => b.v - a.v);
    let rank = 0, prev = null;
    order.forEach((o, idx) => { if (o.v !== prev) { rank = idx + 1; prev = o.v; } ranks[o.i][ci] = rank; });
  });
  series.forEach((s, i) => (s.ranks = ranks[i]));

  return { checkpoints, series, hasData: checkpoints.length > 1 };
}
