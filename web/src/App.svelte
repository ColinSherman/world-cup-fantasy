<script>
  import players from './data/players.json';
  import baseline from './data/baseline.json';
  import schedule from './data/schedule.json';
  import { resolveBracket, sanitizeResults, gamesWonByTeam } from './lib/bracket.js';
  import { standings } from './lib/scoring.js';
  import { eliminatedList, pathInfo } from './lib/elimination.js';
  import { runSim } from './lib/simClient.js';
  import { onMount } from 'svelte';
  import Bracket from './lib/Bracket.svelte';
  import Leaderboard from './lib/Leaderboard.svelte';
  import PathToVictory from './lib/PathToVictory.svelte';

  // live (actual) knockout results — empty until the bracket starts / worker feeds them
  let actual = $state({});
  // per-user hypothetical picks layered on top
  let sandbox = $state({});
  let identity = $state(localStorage.getItem('wcf_me') || '');
  let proj = $state(baseline);          // projection under effective (actual + sandbox)
  let projActual = $state(baseline);    // projection under actual results only (the "real" baseline)
  let simBusy = $state(false);
  let mobileTab = $state('table'); // 'table' | 'bracket' | 'path'

  const effective = $derived(sanitizeResults({ ...actual, ...sandbox }));
  const resolved = $derived(resolveBracket(effective));
  const rows = $derived(standings(players, effective));
  const elim = $derived(eliminatedList(players, effective));
  const sandboxActive = $derived(Object.keys(sandbox).length > 0);
  // teams' wins that come from real (locked) results — used to distinguish from sandbox picks
  const realWon = $derived(gamesWonByTeam(actual));
  const ownedTeams = $derived(
    identity ? new Set(players.find((p) => p.name === identity)?.teams.filter((t) => t.alive).map((t) => t.name)) : new Set()
  );
  const info = $derived(identity ? pathInfo(identity, players, effective, proj) : null);

  function pick(id, team) {
    const next = { ...sandbox };
    if (next[id] === team) delete next[id];
    else next[id] = team;
    const merged = sanitizeResults({ ...actual, ...next });
    const s = {};
    for (const k in merged) if (actual[k] !== merged[k]) s[k] = merged[k];
    sandbox = s;
  }
  function resetSandbox() { sandbox = {}; }
  function setIdentity(name) {
    identity = name;
    localStorage.setItem('wcf_me', name);
    if (name) mobileTab = 'path'; // jump to path when you pick yourself
  }

  const RESULTS_URL = import.meta.env.VITE_RESULTS_URL ||
    (import.meta.env.DEV ? 'http://localhost:8787/results' : 'https://wcf-results.colinlsherman.workers.dev/results');
  let liveFixtures = $state({});
  async function loadResults() {
    if (!RESULTS_URL) return;
    try {
      const d = await (await fetch(RESULTS_URL)).json();
      if (d.results) actual = d.results;
      if (d.fixtures) liveFixtures = d.fixtures;
    } catch { /* worker not up / offline — keep current */ }
  }
  onMount(() => { loadResults(); const t = setInterval(loadResults, 60000); return () => clearInterval(t); });

  let simToken = 0;
  $effect(() => {
    const fixed = effective;
    const hasResults = Object.keys(fixed).length > 0;
    if (!hasResults) { proj = baseline; simBusy = false; return; }
    const token = ++simToken;
    simBusy = true;
    runSim(players, fixed, { n: 100000, seed: 999 }).then((res) => {
      if (token === simToken) { proj = res; simBusy = false; }
    });
  });

  // Projection under ACTUAL results only — the reference the sandbox delta is measured against.
  // Only needed while sandboxing. Run with the SAME seed as `proj` (even on empty results) so
  // common random numbers cancel most Monte Carlo noise, leaving a clean delta.
  let simTokenA = 0;
  $effect(() => {
    if (!sandboxActive) { projActual = baseline; return; }
    const a = actual; // dependency
    const token = ++simTokenA;
    runSim(players, a, { n: 100000, seed: 999 }).then((res) => {
      if (token === simTokenA) projActual = res;
    });
  });
</script>

<div class="app">
  <div class="topbar">
    <div class="brand">
      <div class="bar"></div>
      <div>
        <h1>World Cup Fantasy</h1>
        <div class="sub">Live table · sandbox bracket · path to victory</div>
      </div>
    </div>
    <div class="spacer"></div>
    {#if sandboxActive}
      <span class="banner">⚡ Sandbox
        <button class="btn" onclick={resetSandbox} style="padding:4px 10px">Reset</button>
      </span>
    {/if}
    <select value={identity} onchange={(e) => setIdentity(e.target.value)}>
      <option value="">I am…</option>
      {#each players as p}<option value={p.name}>{p.name}</option>{/each}
    </select>
  </div>

  <!-- Desktop layout: two-column grid -->
  <div class="grid desktop-grid">
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div class="panel">
        <div class="section-h">
          <h2>Leaderboard</h2>
          <span class="note muted">{sandboxActive ? 'projected under sandbox' : 'group stage final'}</span>
          <div class="spacer"></div>
          <span class="note muted">{simBusy ? 'simulating…' : `${(proj.n / 1000) | 0}k sims`}</span>
        </div>
        <Leaderboard {rows} {proj} {projActual} {realWon} {sandboxActive} eliminated={elim} {identity} onSelect={setIdentity} />
      </div>

      <div class="panel">
        <div class="section-h">
          <h2>Sandbox bracket</h2>
          <span class="note muted">click a team to send them through</span>
          <div class="spacer"></div>
          <span class="note muted">kickoffs in local venue time</span>
        </div>
        <Bracket {resolved} {pick} {ownedTeams} {schedule} {actual} {liveFixtures} />
      </div>
    </div>

    <div class="panel" style="position:sticky; top:14px;">
      <div class="section-h">
        <h2>{identity ? `${identity} — path to victory` : 'Path to victory'}</h2>
      </div>
      <PathToVictory {info} />
    </div>
  </div>

  <!-- Mobile layout: tabbed single panel -->
  <div class="mobile-tabs">
    {#if mobileTab === 'table'}
      <div class="panel">
        <div class="section-h">
          <h2>Leaderboard</h2>
          <div class="spacer"></div>
          <span class="note muted">{simBusy ? 'simulating…' : `${(proj.n / 1000) | 0}k sims`}</span>
        </div>
        <Leaderboard {rows} {proj} {projActual} {realWon} {sandboxActive} eliminated={elim} {identity} onSelect={setIdentity} />
      </div>
    {:else if mobileTab === 'bracket'}
      <div class="panel">
        <div class="section-h">
          <h2>Bracket</h2>
          {#if sandboxActive}
            <span class="banner-sm">⚡ Sandbox <button class="btn" onclick={resetSandbox} style="padding:2px 8px;font-size:12px">Reset</button></span>
          {/if}
          <div class="spacer"></div>
          <span class="note muted">tap to pick</span>
        </div>
        <Bracket {resolved} {pick} {ownedTeams} {schedule} {actual} {liveFixtures} />
      </div>
    {:else}
      <div class="panel">
        <div class="section-h">
          <h2>{identity ? `${identity} — path to victory` : 'Path to victory'}</h2>
        </div>
        <PathToVictory {info} />
      </div>
    {/if}
  </div>

  <!-- Mobile bottom tab bar -->
  <nav class="bottomnav">
    <button class="navbtn" class:active={mobileTab === 'table'} onclick={() => mobileTab = 'table'}>
      <span class="navicon">📊</span>
      <span>Table</span>
    </button>
    <button class="navbtn" class:active={mobileTab === 'bracket'} onclick={() => mobileTab = 'bracket'}>
      <span class="navicon">🏆</span>
      <span>Bracket</span>
      {#if sandboxActive}<span class="sandbox-dot"></span>{/if}
    </button>
    <button class="navbtn" class:active={mobileTab === 'path'} onclick={() => mobileTab = 'path'}>
      <span class="navicon">⭐</span>
      <span>My Path</span>
    </button>
  </nav>
</div>

<style>
  .desktop-grid { display: grid; }
  .mobile-tabs  { display: none; }
  .bottomnav    { display: none; }

  @media (max-width: 700px) {
    .desktop-grid { display: none; }
    .mobile-tabs  { display: block; padding-bottom: 72px; }
    .bottomnav {
      display: flex; position: fixed; bottom: 0; left: 0; right: 0;
      background: var(--panel); border-top: 1px solid var(--line);
      padding: 8px 0 max(8px, env(safe-area-inset-bottom));
      z-index: 100;
    }
  }

  .navbtn {
    flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px;
    background: transparent; border: 0; color: var(--muted); font-size: 11px; font-weight: 600;
    padding: 4px 0; position: relative;
  }
  .navbtn.active { color: var(--accent); }
  .navicon { font-size: 20px; line-height: 1; }
  .sandbox-dot {
    position: absolute; top: 2px; right: calc(50% - 14px);
    width: 7px; height: 7px; border-radius: 50%; background: var(--gold);
  }
  .banner-sm {
    background: rgba(255,206,58,0.12); color: var(--gold); border: 1px solid rgba(255,206,58,0.3);
    padding: 4px 8px; border-radius: 7px; font-size: 12px; font-weight: 600;
    display: flex; gap: 6px; align-items: center;
  }
</style>
