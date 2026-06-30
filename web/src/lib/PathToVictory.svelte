<script>
  import { flagClass } from './flags.js';

  let { info } = $props();
  const pct = (p) => (p < 0.001 ? '<0.1%' : (p * 100).toFixed(1) + '%');
</script>

{#if !info}
  <div class="pad muted">Pick who you are to see your path to victory.</div>
{:else if info.status === 'out'}
  <div class="pad">
    <div class="big out">Eliminated</div>
    <p class="muted">Mathematically out of title contention — there's no remaining result that lets you finish first.</p>
    <p>Dominated by <b>{info.by.join(', ')}</b>: they already match or beat your whole roster.</p>
  </div>
{:else}
  <div class="pad">
    <div class="statline">
      <div>
        <div class="big">{pct(info.winPct)}</div>
        <div class="muted">title odds</div>
      </div>
      <div>
        <div class="big">{info.status === 'leader' ? '1st' : '#' + info.rank}</div>
        <div class="muted">{info.status === 'leader' ? 'front-runner' : `${info.gap} behind leader`}</div>
      </div>
      <div>
        <div class="big">{info.floor}–{info.ceiling}</div>
        <div class="muted">floor → ceiling</div>
      </div>
    </div>

    {#if info.status === 'leader'}
      <p class="lead-msg">You're out front. Protect it: your danger is any rival's unique team going deep.</p>
    {/if}

    {#if info.leverage.length}
      <h4>Your edge — teams that gain you ground {#if info.status !== 'leader'}on {info.leader}{/if}</h4>
      <div class="teamlist">
        {#each info.leverage as t}
          <span class="tcard hot"><span class="row1"><span class={flagClass(t.team)}></span> {t.team}</span><small>{pct(t.champ)} to win it all</small></span>
        {/each}
      </div>
    {/if}

    {#if info.threats.length}
      <h4>What hurts you — {info.leader}'s teams you don't have</h4>
      <div class="teamlist">
        {#each info.threats.slice(0, 4) as t}
          <span class="tcard cold"><span class="row1"><span class={flagClass(t.team)}></span> {t.team}</span><small>{pct(t.champ)}</small></span>
        {/each}
      </div>
    {/if}

    {#if info.shared.length}
      <p class="muted small">Shared with {info.status === 'leader' ? 'the field' : info.leader} (keep pace but don't gain):
        {#each info.shared as t, i}<span class="shared"><span class={flagClass(t)}></span> {t}</span>{#if i < info.shared.length - 1}, {/if}{/each}
      </p>
    {/if}
  </div>
{/if}

<style>
  .pad { padding: 16px; }
  .big { font-size: 30px; font-weight: 800; line-height: 1; }
  .big.out { color: var(--accent); }
  .statline { display: flex; gap: 22px; margin-bottom: 14px; }
  .statline .muted { font-size: 12px; margin-top: 4px; }
  h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 16px 0 8px; }
  .teamlist { display: flex; flex-wrap: wrap; gap: 8px; }
  .tcard { display: inline-flex; flex-direction: column; padding: 7px 11px; border-radius: 9px; font-weight: 600; font-size: 14px; border: 1px solid var(--line); }
  .tcard .row1 { display: inline-flex; align-items: center; gap: 6px; }
  .tcard small { font-weight: 600; font-size: 11px; color: var(--muted); margin-top: 2px; }
  :global(.fi) { border-radius: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,0.25); }
  .tcard :global(.fi) { width: 20px; height: 14px; }
  .shared :global(.fi) { width: 16px; height: 11px; vertical-align: -1px; }
  .tcard.hot { background: rgba(54,194,117,0.12); border-color: rgba(54,194,117,0.3); }
  .tcard.cold { background: rgba(225,20,10,0.10); border-color: rgba(225,20,10,0.25); }
  .lead-msg { color: var(--gold); font-weight: 600; }
  .small { font-size: 12px; }
  p { line-height: 1.6; }
</style>
