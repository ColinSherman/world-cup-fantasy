<script>
  import { flagClass } from './flags.js';

  let { rows, proj, projActual = null, realWon = {}, sandboxActive = false, eliminated, identity, onSelect } = $props();

  const pct = (p) => (p == null ? '—' : p < 0.001 ? '<0.1%' : (p * 100).toFixed(1) + '%');
  // win% change vs the real (actual-only) projection — only meaningful while sandboxing
  function delta(name) {
    if (!sandboxActive || !projActual) return 0;
    return (proj?.poolWin?.[name] ?? 0) - (projActual?.poolWin?.[name] ?? 0);
  }
</script>

<div class="lb">
  <div class="head">
    <span class="c-rank">#</span>
    <span class="c-name">Player</span>
    <span class="c-teams">Teams</span>
    <span class="c-pts">Pts</span>
    <span class="c-win">Win&nbsp;%</span>
  </div>
  {#each rows as r (r.name)}
    {@const out = eliminated?.has(r.name)}
    {@const realKo = r.teams.reduce((s, t) => s + (t.alive ? 3 * (realWon[t.name] || 0) : 0), 0)}
    {@const sbKo = r.ko - realKo}
    {@const d = delta(r.name)}
    <button class="row" class:me={r.name === identity} class:out onclick={() => onSelect(r.name)}>
      <span class="c-rank">{r.rank}</span>
      <span class="c-name">
        <span class="nametxt">{r.name}</span>
        {#if out}<span class="pill outpill">OUT</span>{/if}
      </span>
      <span class="c-teams">
        {#each r.teams as t}
          {@const realW = realWon[t.name] || 0}
          {@const sbW = Math.max(0, t.wins - realW)}
          <span class="chip {t.status}" class:pred={sbW > 0}
            title="{t.name}{realW ? ` · ${realW} won` : ''}{sbW ? ` · ${sbW} predicted` : ''}">
            <span class={flagClass(t.name)}></span>{#if t.wins}<b class:predw={sbW > 0}>{t.wins}</b>{/if}
          </span>
        {/each}
      </span>
      <span class="c-pts"><b>{r.total}</b>{#if realKo}<small>+{realKo}</small>{/if}{#if sbKo}<small class="predpts">+{sbKo}</small>{/if}</span>
      <span class="c-win">
        {pct(proj?.poolWin?.[r.name])}
        {#if sandboxActive && Math.abs(d) >= 0.003}
          <span class="wdelta {d > 0 ? 'up' : 'down'}">{d > 0 ? '▲' : '▼'}{(Math.abs(d) * 100).toFixed(1)}</span>
        {/if}
      </span>
    </button>
  {/each}
</div>

<style>
  .lb { padding: 4px 0 8px; overflow-x: hidden; }
  .head, .row {
    display: grid;
    grid-template-columns: 26px minmax(0,1fr) minmax(0,1.6fr) 52px 58px;
    grid-template-areas: "rank name teams pts win";
    align-items: center; gap: 6px; padding: 6px 12px; width: 100%; text-align: left;
    box-sizing: border-box;
  }
  .head { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
  .row { background: transparent; border: 0; border-top: 1px solid var(--line); color: var(--text); border-radius: 8px; }
  .row:hover { background: rgba(255,255,255,0.04); }
  .row.me { background: rgba(60,138,255,0.12); }
  .row.out { opacity: 0.55; }
  .c-rank { grid-area: rank; color: var(--muted); font-weight: 700; font-size: 13px; }
  .c-name { grid-area: name; font-weight: 600; display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden; }
  .nametxt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .c-teams { grid-area: teams; display: flex; flex-wrap: wrap; gap: 2px; min-width: 0; }
  .c-pts { grid-area: pts; }
  .c-win { grid-area: win; }

  @media (max-width: 700px) {
    .head, .row {
      grid-template-columns: 22px minmax(0,1fr) 46px 50px;
      grid-template-areas: "rank name pts win" ". teams teams teams";
      row-gap: 4px;
      padding: 6px 10px;
      gap: 5px;
    }
    .head .c-teams { display: none; }
    .c-teams { padding-bottom: 2px; }
  }

  .chip { display: inline-flex; align-items: center; line-height: 1; padding: 2px 3px; border-radius: 4px; }
  .chip :global(.fi) { width: 18px; height: 12px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,0.25); }
  .chip b { font-size: 9px; vertical-align: super; color: var(--green); margin-left: 1px; }
  .chip b.predw { color: var(--gold); }
  .chip.dead { opacity: 0.3; filter: grayscale(1); }
  .chip.out { opacity: 0.45; filter: grayscale(0.6); }
  .chip.alive { background: rgba(54,194,117,0.10); }
  .chip.pred { background: rgba(255,206,58,0.12); outline: 1px dashed rgba(255,206,58,0.5); }
  .c-pts { text-align: right; font-variant-numeric: tabular-nums; font-size: 13px; }
  .c-pts small { color: var(--green); font-weight: 700; margin-left: 2px; font-size: 11px; }
  .c-pts small.predpts { color: var(--gold); }
  .c-win { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--gold); font-size: 13px; }
  .wdelta { display: block; font-size: 10px; font-weight: 700; margin-top: 1px; }
  .wdelta.up { color: var(--green); }
  .wdelta.down { color: #ff6b61; }
  .outpill { background: rgba(225,20,10,0.18); color: #ff8a82; font-size: 9px; padding: 1px 5px; flex-shrink: 0; }
</style>
