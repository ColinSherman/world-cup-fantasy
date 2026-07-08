<script>
  import { flagClass } from './flags.js';

  // Final podium, revealed automatically as places become mathematically locked.
  // `podium` comes from podiumLocks() over ACTUAL results only — sandbox picks never
  // reach it, so playing with the bracket can't fake a clinch.
  // `rows` are actual-results standings, used for each winner's teams + score.
  let { podium, rows = [] } = $props();

  const byName = $derived(Object.fromEntries(rows.map((r) => [r.name, r])));
  const MEDALS = ['🥇', '🥈', '🥉'];
  const HEIGHTS = [86, 58, 40];
  // classic stand order: silver left, gold center, bronze right
  const stands = $derived(
    [podium.ranks[1], podium.ranks[0], podium.ranks[2]].map((r) => ({
      rank: r.rank,
      medal: MEDALS[r.rank - 1],
      locked: r.names !== null,
      // locked-empty = place absorbed by a tie above (e.g. joint 2nd leaves no 3rd)
      absorbed: r.names !== null && r.names.length === 0,
      players: r.names ? r.names.map((n) => byName[n]).filter(Boolean) : [],
      h: HEIGHTS[r.rank - 1],
    }))
  );
</script>

<div class="podium panel">
  {#each stands as s}
    <div class="stand" class:won={s.locked && !s.absorbed}>
      <div class="above">
        {#if s.locked && !s.absorbed}
          <span class="medal">{s.medal}</span>
          {#each s.players as p}
            <div class="pname">{p.name}</div>
            <div class="pts">{p.total} pts</div>
            <div class="flags">
              {#each p.teams as t}
                {@const tpts = t.gp + 3 * t.wins}
                <span class="chip" title="{t.name} · {tpts} pts ({t.gp} group + {3 * t.wins} knockout)">
                  <span class={flagClass(t.name)}></span><b>{tpts}</b>
                </span>
              {/each}
            </div>
          {/each}
        {:else if s.absorbed}
          <span class="medal dim">{s.medal}</span>
          <div class="pname open">—</div>
        {:else}
          <span class="medal dim">{s.medal}</span>
          <div class="pname open">TBD</div>
          <div class="tag">still in play</div>
        {/if}
      </div>
      <div class="block b{s.rank}" style="height:{s.h}px"><span class="num">{s.rank}</span></div>
    </div>
  {/each}
</div>

<style>
  .podium {
    display: flex; align-items: flex-end; justify-content: center;
    gap: 8px; margin-bottom: 16px; padding: 18px 16px 0;
    overflow: hidden;
  }
  .stand { flex: 1; max-width: 240px; display: flex; flex-direction: column; justify-content: flex-end; min-width: 0; }
  .above { display: flex; flex-direction: column; align-items: center; gap: 3px; padding-bottom: 10px; text-align: center; }

  .medal { font-size: 30px; line-height: 1; }
  .medal.dim { filter: grayscale(1) brightness(0.75); opacity: 0.7; }
  .pname { font-weight: 800; font-size: 15px; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pname.open { color: var(--muted); font-weight: 600; }
  .pts { font-size: 12px; font-weight: 700; color: var(--green); font-variant-numeric: tabular-nums; }
  .tag { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }

  /* all flags full-color here — the podium celebrates the whole roster */
  .flags { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; margin-top: 2px; }
  .chip { display: inline-flex; align-items: center; gap: 2px; line-height: 1; padding: 2px 4px; border-radius: 4px; background: rgba(255,255,255,0.05); }
  .chip :global(.fi) { width: 18px; height: 12px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,0.25); }
  .chip b { font-size: 10px; font-variant-numeric: tabular-nums; color: var(--text); opacity: 0.85; }

  .block {
    display: flex; align-items: center; justify-content: center;
    border-radius: 8px 8px 0 0;
    border: 1px solid var(--line); border-bottom: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015));
  }
  .num { font-size: 24px; font-weight: 800; color: var(--muted); opacity: 0.55; }
  .b1 { background: linear-gradient(180deg, rgba(255,206,58,0.28), rgba(255,206,58,0.05)); border-color: rgba(255,206,58,0.45); }
  .b2 { background: linear-gradient(180deg, rgba(185,196,214,0.22), rgba(185,196,214,0.04)); border-color: rgba(185,196,214,0.4); }
  .b3 { background: linear-gradient(180deg, rgba(205,143,82,0.22), rgba(205,143,82,0.04)); border-color: rgba(205,143,82,0.45); }
  .b1 .num { color: var(--gold); }
  .b2 .num { color: #b9c4d6; }
  .b3 .num { color: #cd8f52; }
  .stand:not(.won) .block { opacity: 0.55; }

  @media (max-width: 700px) {
    .podium { gap: 5px; padding: 14px 8px 0; }
    .medal { font-size: 24px; }
    .pname { font-size: 12px; }
    .pts { font-size: 11px; }
    .chip { padding: 1px 2px; }
    .chip :global(.fi) { width: 15px; height: 10px; }
    .num { font-size: 18px; }
  }
</style>
