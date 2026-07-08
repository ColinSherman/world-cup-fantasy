<script>
  // Final podium, revealed automatically as places become mathematically locked.
  // `podium` comes from podiumLocks() over ACTUAL results only — sandbox picks never
  // reach it, so playing with the bracket can't fake a clinch.
  let { podium, pts = {} } = $props();

  const MEDALS = ['🥇', '🥈', '🥉'];
  // slots: skip places absorbed by a tie above (locked-empty), show TBD while contested
  const slots = $derived(
    podium.ranks
      .filter((r) => r.names === null || r.names.length > 0)
      .map((r) => ({
        medal: MEDALS[r.rank - 1],
        locked: r.names !== null,
        label: r.names ? r.names.join(' & ') : 'TBD',
        pts: r.names?.length === 1 ? pts[r.names[0]] : null,
      }))
  );
</script>

<div class="podium panel">
  {#each slots as s, i}
    {#if i > 0}<div class="sep"></div>{/if}
    <div class="slot" class:locked={s.locked}>
      <span class="medal">{s.medal}</span>
      <span class="who">
        <span class="names">{s.label}</span>
        {#if s.locked}
          <span class="tag">clinched{s.pts != null ? ` · ${s.pts} pts` : ''}</span>
        {:else}
          <span class="tag open">still in play</span>
        {/if}
      </span>
    </div>
  {/each}
</div>

<style>
  .podium {
    display: flex; align-items: stretch; justify-content: center;
    gap: 0; margin-bottom: 16px; padding: 10px 8px;
  }
  .sep { width: 1px; background: var(--line); margin: 4px 2px; }
  .slot {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 6px 10px; border-radius: 8px; opacity: 0.55; min-width: 0;
  }
  .slot.locked { opacity: 1; }
  .medal { font-size: 26px; line-height: 1; flex-shrink: 0; }
  .slot:not(.locked) .medal { filter: grayscale(1) brightness(0.8); }
  .who { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
  .names { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .slot:not(.locked) .names { color: var(--muted); font-weight: 600; }
  .tag { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--green); }
  .tag.open { color: var(--muted); }

  @media (max-width: 700px) {
    .podium { flex-direction: column; gap: 2px; padding: 8px 12px; }
    .sep { width: auto; height: 1px; margin: 2px 4px; }
    .slot { justify-content: flex-start; padding: 5px 4px; }
    .medal { font-size: 22px; }
  }
</style>
