<script>
  import { flagClass } from './flags.js';
  import { pickGames, pickemsStandings } from './pickems.js';

  let { players, liveFixtures = {}, results = {}, picks = {}, identity = '', onPick } = $props();

  const rounds = $derived(pickGames(liveFixtures, results));
  const standings = $derived(pickemsStandings(players, picks, results));
  const myPicks = $derived(identity ? (picks[identity] || {}) : {});
  const myRow = $derived(standings.find((r) => r.name === identity));

  let busy = $state(null); // gameId currently submitting

  async function choose(g, team) {
    if (!identity || g.locked || busy) return;
    if (myPicks[g.id] === team) return;
    busy = g.id;
    try { await onPick(g.id, team); } finally { busy = null; }
  }

  const resultClass = (g) => {
    const my = myPicks[g.id];
    if (!g.winner || !my) return '';
    return my === g.winner ? 'hit' : 'miss';
  };
</script>

<div class="pk">
  {#if !identity}
    <div class="prompt">Pick who you are (top-right “I am…”) to make your picks.</div>
  {:else}
    <div class="mystat">
      Making picks as <b>{identity}</b>
      {#if myRow}<span class="muted"> · {myRow.correct} correct{myRow.pending ? ` · ${myRow.pending} pending` : ''}</span>{/if}
    </div>
  {/if}

  {#if !rounds.length}
    <div class="prompt">Matchups open for picking once the Round of 16 is set.</div>
  {/if}

  {#each rounds as r}
    <div class="round">
      <div class="rlabel">{r.label}</div>
      <div class="games">
        {#each r.games as g}
          {@const my = myPicks[g.id]}
          <div class="game {resultClass(g)}" class:locked={g.locked}>
            {#each [g.home, g.away] as team}
              <button class="opt"
                class:picked={my === team}
                class:winner={g.winner === team}
                class:loser={g.winner && g.winner !== team}
                disabled={!identity || g.locked || busy === g.id}
                onclick={() => choose(g, team)}>
                <span class="fl {flagClass(team)}"></span>
                <span class="tn">{team}</span>
                {#if my === team && !g.winner}<span class="tick">✓</span>{/if}
                {#if g.winner === team}<span class="tick win">▶</span>{/if}
              </button>
            {/each}
            <div class="stat">
              {#if g.winner}
                {#if my}<span class={resultClass(g)}>{my === g.winner ? '✓ nailed it' : '✗ missed'}</span>
                {:else}<span class="muted">final</span>{/if}
              {:else if g.locked}
                <span class="muted">🔴 locked</span>
              {:else if my}
                <span class="muted">picked · tap to change</span>
              {:else}
                <span class="muted">make a pick</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}

  <div class="board">
    <div class="rlabel">Pick’ems leaderboard <span class="muted">— +1 per correct</span></div>
    {#each standings as row}
      <div class="brow" class:me={row.name === identity}>
        <span class="brank">{row.rank}</span>
        <span class="bname">{row.name}</span>
        {#if row.pending}<span class="pend">{row.pending} pending</span>{/if}
        <span class="bpts">{row.correct}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .pk { padding: 12px 14px 16px; }
  .prompt { padding: 16px; color: var(--muted); font-size: 14px; text-align: center; }
  .mystat { font-size: 13px; margin-bottom: 12px; }
  .muted { color: var(--muted); }
  .round { margin-bottom: 16px; }
  .rlabel { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); font-weight: 700; margin: 4px 0 8px; }
  .games { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
  .game { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--panel2); }
  .game.hit { border-color: rgba(54,194,117,0.55); }
  .game.miss { border-color: rgba(225,20,10,0.4); }
  .opt {
    width: 100%; display: flex; align-items: center; gap: 9px; padding: 10px 11px;
    background: transparent; border: 0; border-bottom: 1px solid var(--line); color: var(--text);
    font-size: 14px; font-weight: 600; text-align: left; cursor: pointer; font-family: inherit;
  }
  .opt:last-of-type { border-bottom: 0; }
  .opt:not(:disabled):hover { background: rgba(255,255,255,0.05); }
  .opt.picked { background: rgba(60,138,255,0.16); color: #eaf1ff; }
  .opt.winner { background: rgba(54,194,117,0.16); color: #eafff2; }
  .opt.loser { opacity: 0.5; }
  .opt:disabled { cursor: default; }
  .fl { width: 26px; height: 18px; border-radius: 3px; box-shadow: 0 0 0 1px rgba(0,0,0,.3); flex: none; }
  .tn { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tick { font-weight: 800; color: var(--blue); }
  .tick.win { color: var(--green); }
  .stat { padding: 6px 11px; font-size: 11px; border-top: 1px solid var(--line); background: var(--panel); }
  .stat .hit { color: var(--green); font-weight: 700; }
  .stat .miss { color: #ff6b61; font-weight: 700; }

  .board { margin-top: 18px; border-top: 1px solid var(--line); padding-top: 12px; }
  .brow { display: grid; grid-template-columns: 26px 1fr auto auto; align-items: center; gap: 8px; padding: 6px 4px; border-top: 1px solid var(--line); }
  .brow:first-of-type { border-top: 0; }
  .brow.me { background: rgba(60,138,255,0.12); border-radius: 8px; }
  .brank { color: var(--muted); font-weight: 700; font-size: 13px; }
  .bname { font-weight: 600; font-size: 14px; }
  .pend { font-size: 11px; color: var(--muted); }
  .bpts { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--gold); font-size: 15px; padding-right: 4px; }
</style>
