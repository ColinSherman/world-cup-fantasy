<script>
  import { GAMES, CHILDREN, ROUND_NAMES, ROUND_DATE, ROUND_ORDER, bracketLayout } from './bracket.js';
  import { flagClass } from './flags.js';

  let { resolved, pick, ownedTeams = new Set(), schedule = {}, actual = {}, liveFixtures = {} } = $props();

  // Per-game status: 'final' (locked real result), 'pred' (sandbox pick), or '' (upcoming).
  const status = (id) => {
    const w = resolved[id]?.winner;
    if (!w) return '';
    return actual[id] === w ? 'final' : 'pred';
  };

  const L = bracketLayout({ vgap: 38 });
  const HEAD = 42;
  const yOff = HEAD;

  // column header x positions (one per round)
  const cols = ROUND_ORDER.map((round) => {
    const g = GAMES.find((x) => x.round === round);
    return { round, x: L.pos[g.id].x };
  });

  // connector elbows: each child game → its parent game
  const links = [];
  for (const g of GAMES) {
    for (const cId of CHILDREN[g.id]) {
      const c = L.pos[cId], p = L.pos[g.id];
      const cx = c.x + L.colW, cy = c.cy + yOff, px = p.x, py = p.cy + yOff;
      const mid = (cx + px) / 2;
      links.push(`M ${cx} ${cy} H ${mid} V ${py} H ${px}`);
    }
  }

  // Mobile round stepper — "active" = first round with a game not yet finalized for real
  const activeRound = $derived(
    ROUND_ORDER.find((r) => GAMES.filter((g) => g.round === r).some((g) => !actual[g.id])) ?? 'F'
  );
  let mobileRound = $state('R32');
  // Sync to active round once on mount / when active changes (but don't override user selection)
  let synced = false;
  $effect(() => {
    if (!synced) { mobileRound = activeRound; synced = true; }
  });

  const mobileGames = $derived(GAMES.filter((g) => g.round === mobileRound));
</script>

<!-- ── Desktop: full bracket canvas ── -->
<div class="wrap desktop-only">
  <div class="canvas" style="width:{L.width}px; height:{L.height + HEAD}px;">
    <svg class="links" width={L.width} height={L.height + HEAD}>
      {#each links as d}<path {d} fill="none" stroke="var(--line)" stroke-width="1.5" />{/each}
    </svg>

    {#each cols as c}
      <div class="rhead" style="left:{c.x}px; width:{L.colW}px;">
        <span class="rn">{ROUND_NAMES[c.round]}</span>
        <span class="rd">{ROUND_DATE[c.round]}</span>
      </div>
    {/each}

    {#each GAMES as g}
      {@const rg = resolved[g.id]}
      {@const p = L.pos[g.id]}
      {@const st = status(g.id)}
      {@const score = liveFixtures[g.id]?.score}
      <div class="game" style="left:{p.x}px; top:{p.y + yOff}px; width:{L.colW}px;">
       <div class="box" class:final={st === 'final'} class:pred={st === 'pred'}>
        {#each [rg.a, rg.b] as team}
          <button
            class="side"
            class:winner={rg.winner && rg.winner === team}
            class:predwin={st === 'pred' && rg.winner === team}
            class:dim={rg.winner && rg.winner !== team}
            class:tbd={!team}
            class:owned={team && ownedTeams.has(team)}
            disabled={!team}
            onclick={() => team && pick(g.id, team)}
          >
            <span class="fl">{#if team}<span class={flagClass(team)}></span>{:else}·{/if}</span>
            <span class="nm">{team ?? 'TBD'}</span>
            {#if team && ownedTeams.has(team)}<span class="dot" title="your team"></span>{/if}
          </button>
        {/each}
       </div>
        <div class="when">
          {#if st === 'final'}
            <span class="final-tag">● FINAL{score ? ` · ${score}` : ''}</span>
          {:else if st === 'pred'}
            <span class="pred-tag">✎ your pick</span>
          {:else if schedule[g.id]}
            <span>{schedule[g.id].date} · {schedule[g.id].time}</span>
            <span class="city">{schedule[g.id].city}</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<!-- ── Mobile: round tabs + card list ── -->
<div class="mobile-only">
  <div class="rtabs">
    {#each ROUND_ORDER as r}
      {@const label = r === 'F' ? 'Final' : r}
      {@const done = GAMES.filter(g => g.round === r).every(g => actual[g.id])}
      {@const cur = r === activeRound}
      <button
        class="rtab"
        class:active={mobileRound === r}
        class:current={cur}
        onclick={() => mobileRound = r}
      >
        {label}
        {#if done}<span class="tick">✓</span>{/if}
      </button>
    {/each}
  </div>

  <div class="rdate">{ROUND_DATE[mobileRound]}</div>

  <div class="cards">
    {#each mobileGames as g}
      {@const rg = resolved[g.id]}
      {@const st = status(g.id)}
      {@const score = liveFixtures[g.id]?.score}
      <div class="card" class:final={st === 'final'} class:pred={st === 'pred'}>
        <div class="card-teams">
          {#each [{ team: rg.a, side: 'a' }, { team: rg.b, side: 'b' }] as slot}
            <button
              class="mside"
              class:winner={rg.winner && rg.winner === slot.team}
              class:predwin={st === 'pred' && rg.winner === slot.team}
              class:dim={rg.winner && rg.winner !== slot.team}
              class:tbd={!slot.team}
              class:owned={slot.team && ownedTeams.has(slot.team)}
              disabled={!slot.team}
              onclick={() => slot.team && pick(g.id, slot.team)}
            >
              <span class="mfl">{#if slot.team}<span class={flagClass(slot.team)}></span>{:else}<span class="tbd-dot">·</span>{/if}</span>
              <span class="mnm">{slot.team ?? 'TBD'}</span>
              {#if slot.team && ownedTeams.has(slot.team)}<span class="dot" title="your team"></span>{/if}
            </button>
            {#if slot.side === 'a'}
              <span class="vs">{rg.winner ? (rg.winner === rg.a ? '▶' : '◀') : 'vs'}</span>
            {/if}
          {/each}
        </div>
        <div class="card-meta">
          {#if st === 'final'}
            <span class="final-tag">● FINAL{score ? ` · ${score}` : ''}</span>
          {:else if st === 'pred'}
            <span class="pred-tag">✎ your pick</span>
          {:else if schedule[g.id]}
            <span>{schedule[g.id].date} · {schedule[g.id].time}</span>
            <span class="city">{schedule[g.id].city}</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  /* ── desktop bracket ── */
  .desktop-only { display: block; }
  .mobile-only  { display: none; }
  @media (max-width: 700px) {
    .desktop-only { display: none; }
    .mobile-only  { display: block; }
  }

  .wrap { overflow: auto; padding: 12px 16px 18px; }
  .canvas { position: relative; }
  .links { position: absolute; inset: 0; pointer-events: none; }
  .rhead { position: absolute; top: 6px; display: flex; flex-direction: column; gap: 1px; }
  .rn { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text); font-weight: 700; }
  .rd { font-size: 10px; color: var(--muted); }
  .game { position: absolute; }
  .box { background: var(--panel2); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
  .box.final { border-color: rgba(54,194,117,0.55); }
  .box.pred { border-color: rgba(255,206,58,0.5); border-style: dashed; }
  .side {
    width: 100%; display: flex; align-items: center; gap: 7px; padding: 6px 8px;
    background: transparent; border: 0; border-bottom: 1px solid var(--line); color: var(--text);
    font-size: 12.5px; font-weight: 600; text-align: left;
  }
  .side:last-of-type { border-bottom: 0; }
  .side:not(.tbd):hover { background: rgba(255,255,255,0.05); }
  .side.winner { background: rgba(54,194,117,0.16); color: #eafff2; }
  .side.winner .nm { font-weight: 700; }
  .side.predwin { background: rgba(255,206,58,0.16); color: #fff7df; }
  .side.dim { opacity: 0.5; }
  .side.tbd { color: var(--muted); cursor: default; }
  .side.owned .nm { color: var(--gold); }
  .fl { width: 19px; display: flex; align-items: center; justify-content: center; color: var(--muted); }
  .fl :global(.fi) { width: 19px; height: 13px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,0.25); }
  .nm { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--gold); flex: none; }
  .when { position: absolute; top: 100%; left: 1px; margin-top: 3px; font-size: 10px; color: var(--muted); display: flex; flex-direction: column; line-height: 1.25; }
  .when .city { color: var(--muted); opacity: 0.8; }
  .final-tag { color: var(--green); font-weight: 700; letter-spacing: 0.04em; }
  .pred-tag { color: var(--gold); font-weight: 700; }

  /* ── mobile round tabs ── */
  .rtabs {
    display: flex; overflow-x: auto; gap: 6px; padding: 12px 12px 0;
    scrollbar-width: none;
  }
  .rtabs::-webkit-scrollbar { display: none; }
  .rtab {
    flex: none; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700;
    background: var(--panel2); border: 1px solid var(--line); color: var(--muted);
    white-space: nowrap; display: flex; align-items: center; gap: 4px;
  }
  .rtab.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  .rtab.current:not(.active) { border-color: var(--accent); color: var(--text); }
  .tick { font-size: 10px; color: var(--green); }

  .rdate { font-size: 11px; color: var(--muted); padding: 6px 14px 4px; }

  /* ── mobile game cards ── */
  .cards { display: flex; flex-direction: column; gap: 8px; padding: 6px 10px 14px; }
  .card {
    background: var(--panel2); border: 1px solid var(--line); border-radius: 10px; overflow: hidden;
  }
  .card.final { border-color: rgba(54,194,117,0.55); }
  .card.pred { border-color: rgba(255,206,58,0.5); border-style: dashed; }
  .card-teams { display: flex; align-items: stretch; }
  .mside {
    flex: 1; display: flex; align-items: center; gap: 8px; padding: 11px 10px;
    background: transparent; border: 0; color: var(--text); font-size: 13px; font-weight: 600;
    text-align: left; min-width: 0;
  }
  .mside:not(.tbd):hover { background: rgba(255,255,255,0.05); }
  .mside.winner { background: rgba(54,194,117,0.16); color: #eafff2; }
  .mside.predwin { background: rgba(255,206,58,0.16); color: #fff7df; }
  .mside.dim { opacity: 0.45; }
  .mside.tbd { color: var(--muted); cursor: default; }
  .mside.owned .mnm { color: var(--gold); }
  .mside:first-child { border-right: 1px solid var(--line); flex-direction: row-reverse; text-align: right; }
  .mfl { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .mfl :global(.fi) { width: 22px; height: 15px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,0.25); }
  .tbd-dot { color: var(--muted); font-size: 18px; }
  .mnm { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vs {
    flex: none; width: 36px; display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800; color: var(--muted); border-left: 1px solid var(--line);
    border-right: 1px solid var(--line); background: var(--panel);
  }
  .card-meta {
    display: flex; justify-content: space-between; align-items: center;
    padding: 5px 10px; font-size: 11px; color: var(--muted);
    border-top: 1px solid var(--line); background: var(--panel);
  }
  .city { opacity: 0.7; }
</style>
