<script>
  import players from '../data/players.json';
  import { onMount } from 'svelte';

  let selected = $state(players[0].name);
  let name = $state(players[0].name.toUpperCase());
  let bigword = $state('ELIMINATED');
  let tagline = $state('FROM TITLE CONTENTION');
  let reason = $state('');
  let posY = $state(20);
  let zoom = $state(100);
  let killer = $state(null);
  let photoUrl = $state(null);

  const currentPlayer = $derived(players.find(p => p.name === selected));

  $effect(() => {
    const _ = selected;
    name = selected.toUpperCase();
    killer = null;
  });

  let cardEl;
  let viewportEl;
  let vpboxEl;
  let stageEl;

  function toggleKiller(teamName) {
    killer = killer === teamName ? null : teamName;
  }

  function onFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(f);
  }

  function fit() {
    if (!stageEl || !viewportEl || !vpboxEl) return;
    const w = Math.min(stageEl.clientWidth, 560);
    const s = w / 1080;
    viewportEl.style.transform = `scale(${s})`;
    viewportEl.style.transformOrigin = 'top left';
    vpboxEl.style.height = (1350 * s) + 'px';
  }

  onMount(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    document.head.appendChild(script);
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });

  async function download() {
    if (!window.html2canvas || !cardEl) return;
    await document.fonts.ready;
    const canvas = await window.html2canvas(cardEl, {
      scale: 2,
      backgroundColor: '#0B0E13',
      useCORS: true,
      logging: false,
      width: 1080,
      height: 1350,
    });
    const a = document.createElement('a');
    a.download = (name || 'player').replace(/\s+/g, '_') + '_eliminated.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  }
</script>

<div class="wrap">
  <div class="form-panel panel">
    <div class="form-inner">
      <h2>Elimination card</h2>
      <p class="sub">World Cup Fantasy 2026 · click a team chip in the preview to mark who eliminated the player</p>

      <label>Player photo</label>
      <input type="file" accept="image/*" onchange={onFileChange} />
      <div class="hint">Portrait shots work best. Use sliders to frame.</div>

      <div class="row">
        <div>
          <label>Vertical framing</label>
          <input type="range" min="0" max="100" bind:value={posY} />
        </div>
        <div>
          <label>Zoom</label>
          <input type="range" min="100" max="260" bind:value={zoom} />
        </div>
      </div>

      <label>Player (auto-fills teams)</label>
      <select bind:value={selected}>
        {#each players as p}
          <option value={p.name}>{p.name}</option>
        {/each}
      </select>

      <label>Name on card</label>
      <input type="text" bind:value={name} />

      <label>Big word</label>
      <input type="text" bind:value={bigword} />

      <label>Bottom bar</label>
      <input type="text" bind:value={tagline} />

      <label>Subtitle / reason (optional)</label>
      <input type="text" bind:value={reason} placeholder="Dominated by Susan S" />

      <button class="btn accent dl-btn" onclick={download}>Download PNG</button>
      <button class="btn clear-btn" onclick={() => killer = null}>Clear team highlight</button>
      <div class="hint" style="margin-top:12px">Dead group-stage teams appear struck through. Click a chip to mark that team as the killer (red ✕).</div>
    </div>
  </div>

  <div class="stage" bind:this={stageEl}>
    <div class="vpbox" bind:this={vpboxEl}>
      <div class="viewport" bind:this={viewportEl}>
        <div class="card" bind:this={cardEl}>
          {#if photoUrl}
            <div class="photo"
                 style:background-image="url({photoUrl})"
                 style:background-position="center {posY}%"
                 style:background-size="{zoom}%"></div>
          {:else}
            <div class="photo-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" width="170" height="170">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
              </svg>
              <div style="font-size:22px;font-weight:600">Upload a player photo</div>
            </div>
          {/if}
          <div class="topshade"></div>
          <div class="shade"></div>
          <div class="sidebar"></div>
          <div class="rot">WORLD CUP FANTASY · 2026</div>
          <div class="content">
            <div class="who">{name || selected.toUpperCase()}</div>
            <div class="elim">{bigword || 'ELIMINATED'}</div>
            <span class="tagbar">{tagline}</span>
            {#if reason.trim()}
              <div class="reason-text">{reason}</div>
            {/if}
            <div class="teams">
              {#each (currentPlayer?.teams ?? []) as team}
                <div
                  class="chip"
                  class:dead={!team.alive}
                  class:killer={team.name === killer}
                  onclick={() => toggleKiller(team.name)}
                >{team.name}</div>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Layout */
  .wrap {
    display: flex;
    gap: 28px;
    padding: 28px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .form-panel {
    width: 360px;
    flex-shrink: 0;
  }
  .form-inner {
    padding: 20px;
  }
  h2 { margin-bottom: 4px; }
  .sub {
    font-size: 13px;
    color: var(--muted);
    margin: 0 0 4px;
    line-height: 1.4;
  }
  label {
    display: block;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--muted);
    margin: 14px 0 6px;
  }
  input[type=text], select {
    width: 100%;
    padding: 9px 11px;
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
  }
  input[type=file] { width: 100%; font-size: 12px; color: var(--muted); }
  input[type=range] { width: 100%; accent-color: var(--accent); }
  .row { display: flex; gap: 10px; }
  .row > div { flex: 1; }
  .hint { font-size: 11px; color: var(--muted); margin-top: 5px; }
  .dl-btn { width: 100%; margin-top: 20px; padding: 13px; font-size: 15px; }
  .clear-btn { width: 100%; margin-top: 10px; padding: 11px; font-size: 14px; }

  /* Stage */
  .stage { flex: 1; min-width: 320px; }
  .viewport { width: 1080px; transform-origin: top left; }
  .vpbox { overflow: hidden; border-radius: 14px; }

  /* Card (1080×1350) — matches elimination_card.html exactly */
  .card {
    position: relative;
    width: 1080px;
    height: 1350px;
    background: #0B0E13;
    overflow: hidden;
    color: #fff;
    font-family: 'Archivo', Arial, sans-serif;
  }
  .photo {
    position: absolute;
    inset: 0;
    background-position: center 20%;
    background-size: cover;
    background-repeat: no-repeat;
  }
  .photo-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 14px;
    color: #3a414e;
  }
  .shade {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom,
      rgba(11,14,19,.15) 0%,
      rgba(11,14,19,0) 28%,
      rgba(11,14,19,.55) 58%,
      rgba(11,14,19,.95) 82%,
      #0B0E13 100%);
  }
  .topshade {
    position: absolute;
    left: 0; right: 0; top: 0;
    height: 240px;
    background: linear-gradient(to bottom, rgba(11,14,19,.65), rgba(11,14,19,0));
  }
  .sidebar {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 18px;
    background: #D50000;
  }
  .rot {
    position: absolute;
    left: 30px;
    bottom: 800px;
    transform: rotate(-90deg);
    transform-origin: left bottom;
    font-weight: 800;
    font-size: 22px;
    letter-spacing: 6px;
    color: #fff;
    white-space: nowrap;
  }
  .content {
    position: absolute;
    left: 64px;
    right: 56px;
    bottom: 54px;
  }
  .who {
    font-weight: 800;
    font-size: 46px;
    letter-spacing: 3px;
    color: #fff;
    text-transform: uppercase;
    margin-bottom: 2px;
    text-shadow: 0 2px 14px rgba(0,0,0,.6);
  }
  .elim {
    font-family: 'Anton', sans-serif;
    font-weight: 400;
    font-size: 188px;
    line-height: .86;
    letter-spacing: 1px;
    color: #fff;
    text-transform: uppercase;
    margin: 2px 0 18px;
    text-shadow: 0 3px 20px rgba(0,0,0,.55);
  }
  .tagbar {
    display: inline-block;
    background: #fff;
    color: #0B0E13;
    font-weight: 700;
    font-size: 30px;
    letter-spacing: 6px;
    padding: 11px 22px 10px;
    text-transform: uppercase;
  }
  .reason-text {
    margin-top: 18px;
    font-size: 26px;
    font-weight: 600;
    color: #ffd0d0;
    letter-spacing: .5px;
  }
  .teams {
    display: flex;
    flex-wrap: wrap;
    gap: 11px;
    margin-top: 26px;
  }
  .chip {
    padding: 10px 17px;
    border-radius: 7px;
    font-size: 24px;
    font-weight: 600;
    letter-spacing: .3px;
    background: rgba(255,255,255,.12);
    color: #fff;
    border: 1px solid rgba(255,255,255,.22);
    cursor: pointer;
  }
  .chip.dead {
    background: transparent;
    color: rgba(255,255,255,.4);
    border-color: rgba(255,255,255,.14);
    text-decoration: line-through;
  }
  .chip.killer {
    background: #D50000;
    color: #fff;
    border-color: #D50000;
    font-weight: 800;
  }
  .chip.killer::after { content: " ✕"; }
</style>
