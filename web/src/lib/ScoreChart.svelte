<script>
  let { traj, identity = '' } = $props();

  // viewBox layout
  const W = 720, H = 340;
  const pad = { l: 34, r: 104, t: 16, b: 30 };

  const cps = $derived(traj?.checkpoints ?? []);
  const series = $derived(traj?.series ?? []);
  const n = $derived(cps.length);

  const leader = $derived(
    series.length ? series.reduce((a, b) => (b.final > a.final || (b.final === a.final && b.name < a.name) ? b : a)) : null
  );

  const yBounds = $derived.by(() => {
    let lo = Infinity, hi = -Infinity;
    for (const s of series) for (const v of s.pts) { if (v < lo) lo = v; if (v > hi) hi = v; }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (hi === lo) hi = lo + 1;
    return { lo: Math.floor(lo - 1), hi: Math.ceil(hi + 1) };
  });

  const xAt = (i) => (n <= 1 ? (W - pad.l - pad.r) / 2 + pad.l : pad.l + (i * (W - pad.l - pad.r)) / (n - 1));
  const yAt = (v) => pad.t + (1 - (v - yBounds.lo) / (yBounds.hi - yBounds.lo)) * (H - pad.t - pad.b);
  const line = (s) => s.pts.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');

  let hovered = $state(null);

  // Which players get a colored line + end label by default.
  const highlighted = $derived(new Set([leader?.name, identity].filter(Boolean)));
  const colorOf = (name) =>
    name === identity ? 'var(--gold)' : name === leader?.name ? 'var(--green)' : 'var(--blue)';

  // End labels: leader, you, and whoever is hovered (dedup, avoid vertical overlap).
  const endLabels = $derived.by(() => {
    const names = [...new Set([leader?.name, identity, hovered].filter(Boolean))];
    const rows = names
      .map((nm) => series.find((s) => s.name === nm))
      .filter(Boolean)
      .map((s) => ({ name: s.name, final: s.final, y: yAt(s.final) }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < rows.length; i++) if (rows[i].y - rows[i - 1].y < 15) rows[i].y = rows[i - 1].y + 15;
    return rows;
  });

  // horizontal gridlines
  const grid = $derived.by(() => {
    const { lo, hi } = yBounds;
    const step = Math.max(1, Math.round((hi - lo) / 4));
    const out = [];
    for (let v = lo; v <= hi; v += step) out.push(v);
    return out;
  });
</script>

{#if !traj?.hasData}
  <div class="empty">The trajectory chart fills in as knockout games are played.</div>
{:else}
  <div class="chartwrap">
    <svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Points over time">
      <!-- gridlines + y labels -->
      {#each grid as v}
        <line class="grid" x1={pad.l} x2={W - pad.r} y1={yAt(v)} y2={yAt(v)} />
        <text class="ylab" x={pad.l - 6} y={yAt(v) + 3} text-anchor="end">{v}</text>
      {/each}
      <!-- x checkpoint labels -->
      {#each cps as c, i}
        <text class="xlab" x={xAt(i)} y={H - 10} text-anchor="middle">{c.label}</text>
      {/each}

      <!-- non-highlighted lines (dim, hoverable) -->
      {#each series as s}
        {#if !highlighted.has(s.name) && s.name !== hovered}
          <polyline class="ln dim" points={line(s)} role="button" tabindex="-1"
            onmouseenter={() => (hovered = s.name)} onmouseleave={() => (hovered = null)} />
        {/if}
      {/each}

      <!-- highlighted lines -->
      {#each series as s}
        {#if highlighted.has(s.name) && s.name !== hovered}
          <polyline class="ln hi" points={line(s)} style:stroke={colorOf(s.name)}
            onmouseenter={() => (hovered = s.name)} onmouseleave={() => (hovered = null)} />
          {#each s.pts as v, i}<circle cx={xAt(i)} cy={yAt(v)} r="3" fill={colorOf(s.name)} />{/each}
        {/if}
      {/each}

      <!-- hovered line on top -->
      {#each series as s}
        {#if s.name === hovered}
          <polyline class="ln hover" points={line(s)} />
          {#each s.pts as v, i}<circle cx={xAt(i)} cy={yAt(v)} r="3" fill="#fff" />{/each}
        {/if}
      {/each}

      <!-- end labels -->
      {#each endLabels as l}
        <text class="endlab" x={W - pad.r + 8} y={l.y + 3}
          style:fill={l.name === hovered ? '#fff' : colorOf(l.name)}>{l.name} · {l.final}</text>
      {/each}
    </svg>
    <div class="legend">
      <span><i style="background:var(--green)"></i>leader</span>
      {#if identity}<span><i style="background:var(--gold)"></i>you</span>{/if}
      <span class="muted">hover any line to trace a player</span>
    </div>
  </div>
{/if}

<style>
  .chartwrap { padding: 12px 14px 10px; }
  svg { width: 100%; height: auto; display: block; overflow: visible; }
  .grid { stroke: var(--line); stroke-width: 1; }
  .ylab, .xlab { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
  .ln { fill: none; stroke-linejoin: round; stroke-linecap: round; }
  .ln.dim { stroke: rgba(255,255,255,0.13); stroke-width: 1.5; cursor: pointer; }
  .ln.dim:hover { stroke: rgba(255,255,255,0.4); }
  .ln.hi { stroke-width: 3; }
  .ln.hover { stroke: #fff; stroke-width: 3; cursor: pointer; }
  .endlab { font-size: 12px; font-weight: 700; }
  .legend { display: flex; gap: 14px; align-items: center; font-size: 12px; color: var(--text); margin-top: 8px; padding-left: 4px; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; vertical-align: -1px; }
  .legend .muted { color: var(--muted); margin-left: auto; }
  .empty { padding: 28px 16px; color: var(--muted); font-size: 14px; text-align: center; }
</style>
