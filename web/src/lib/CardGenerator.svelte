<script>
  import players from '../data/players.json';
  import { flagClass } from './flags.js';
  import html2canvas from 'html2canvas';
  import { onMount } from 'svelte';

  // ── Card styles ───────────────────────────────────────────────────────────
  // Add a new graphic style by appending an entry here. `accent` drives the
  // sidebar / highlighted-team / reason colors; `mark` is the chip badge.
  const STYLES = [
    { id: 'eliminated', label: 'Eliminated', accent: '#D50000', bigword: 'ELIMINATED', tagline: 'FROM TITLE CONTENTION', mark: '✕', reasonTint: '#ffd0d0', chipLabel: 'team that did them in' },
    { id: 'advances',   label: 'Advances',   accent: '#36c275', bigword: 'ADVANCES',   tagline: 'TO THE NEXT ROUND',    mark: '★', reasonTint: '#cdeedd', chipLabel: 'team carrying them' },
    { id: 'leader',     label: 'Leader',     accent: '#ffce3a', bigword: 'IN FIRST',   tagline: 'TOP OF THE TABLE',     mark: '★', reasonTint: '#fff0c2', chipLabel: 'their big mover' },
  ];

  let styleId = $state('eliminated');
  const style = $derived(STYLES.find((s) => s.id === styleId));

  let selected = $state(players[0].name);
  let name = $state(players[0].name.toUpperCase());
  let bigword = $state(STYLES[0].bigword);
  let tagline = $state(STYLES[0].tagline);
  let accent = $state(STYLES[0].accent);
  let reason = $state('');
  let posY = $state(20);
  let zoom = $state(100);
  let killer = $state(null);
  let photoUrl = $state(null);
  let rendering = $state(false);
  let toast = $state('');

  const currentPlayer = $derived(players.find((p) => p.name === selected));

  // Re-apply preset text/accent when the style changes (presets, so this overwrites).
  let lastStyle = STYLES[0].id;
  $effect(() => {
    if (styleId !== lastStyle) {
      lastStyle = styleId;
      bigword = style.bigword;
      tagline = style.tagline;
      accent = style.accent;
    }
  });

  // Auto-fill the name + reset highlight when the player changes.
  let lastPlayer = players[0].name;
  $effect(() => {
    if (selected !== lastPlayer) {
      lastPlayer = selected;
      name = selected.toUpperCase();
      killer = null;
    }
  });

  let cardEl, viewportEl, vpboxEl, stageEl;

  const toggleKiller = (t) => (killer = killer === t ? null : t);

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
    vpboxEl.style.height = 1350 * s + 'px';
  }

  onMount(() => {
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });

  function flash(msg) {
    toast = msg;
    setTimeout(() => (toast = ''), 1800);
  }

  async function renderCanvas() {
    await document.fonts.ready;
    return html2canvas(cardEl, {
      scale: 2, backgroundColor: '#0B0E13', useCORS: true, logging: false,
      width: 1080, height: 1350,
    });
  }

  async function download() {
    if (!cardEl) return;
    rendering = true;
    try {
      const canvas = await renderCanvas();
      const a = document.createElement('a');
      a.download = (name || 'player').replace(/\s+/g, '_') + '_' + styleId + '.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (e) {
      flash('Render failed — try again');
    } finally {
      rendering = false;
    }
  }

  async function copyImage() {
    if (!cardEl || !navigator.clipboard?.write) { flash('Clipboard not supported'); return; }
    rendering = true;
    try {
      const canvas = await renderCanvas();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash('Copied to clipboard');
    } catch (e) {
      flash('Copy failed — use Download');
    } finally {
      rendering = false;
    }
  }
</script>

<div class="page">
  <div class="topbar">
    <div class="brand">
      <div class="bar" style:background={accent}></div>
      <div>
        <h1>Card Generator</h1>
        <div class="subtitle">World Cup Fantasy · share-ready graphics · unlisted</div>
      </div>
    </div>
    <a class="back" href="/">← back to app</a>
  </div>

  <div class="wrap">
    <div class="panel form-panel">
      <div class="form-inner">
        <label>Card style</label>
        <div class="styles">
          {#each STYLES as s}
            <button class="stylebtn" class:active={s.id === styleId}
              style:--a={s.accent} onclick={() => (styleId = s.id)}>{s.label}</button>
          {/each}
        </div>

        <label>Player <span class="muted">(auto-fills teams)</span></label>
        <select bind:value={selected}>
          {#each players as p}<option value={p.name}>{p.name}</option>{/each}
        </select>

        <label>Player photo</label>
        <input type="file" accept="image/*" onchange={onFileChange} />
        <div class="hint">Portrait shots work best. Use the sliders to frame the face.</div>

        <div class="row">
          <div><label>Vertical framing</label><input type="range" min="0" max="100" bind:value={posY} /></div>
          <div><label>Zoom</label><input type="range" min="100" max="260" bind:value={zoom} /></div>
        </div>

        <label>Name on card</label>
        <input type="text" bind:value={name} />

        <div class="row">
          <div><label>Big word</label><input type="text" bind:value={bigword} /></div>
          <div class="accent-field">
            <label>Accent</label>
            <input type="color" bind:value={accent} />
          </div>
        </div>

        <label>Bottom bar</label>
        <input type="text" bind:value={tagline} />

        <label>Subtitle / reason <span class="muted">(optional)</span></label>
        <input type="text" bind:value={reason} placeholder="Dominated by Susan S" />

        <button class="btn accent dl-btn" onclick={download} disabled={rendering}>
          {rendering ? 'Rendering…' : 'Download PNG'}
        </button>
        <div class="row" style="margin-top:10px">
          <button class="btn" onclick={copyImage} disabled={rendering}>Copy image</button>
          <button class="btn" onclick={() => (killer = null)}>Clear highlight</button>
        </div>
        <div class="hint" style="margin-top:12px">
          Dead group-stage teams show struck through. Click a chip in the preview to mark the {style.chipLabel}.
        </div>
        {#if toast}<div class="toast">{toast}</div>{/if}
      </div>
    </div>

    <div class="stage" bind:this={stageEl}>
      <div class="vpbox" bind:this={vpboxEl}>
        <div class="viewport" bind:this={viewportEl}>
          <div class="card" bind:this={cardEl} style:--card-accent={accent} style:--reason-tint={style.reasonTint}>
            {#if photoUrl}
              <div class="photo" style:background-image="url({photoUrl})"
                   style:background-position="center {posY}%" style:background-size="{zoom}%"></div>
            {:else}
              <div class="photo-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" width="170" height="170">
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
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
              <div class="elim">{bigword || style.bigword}</div>
              <span class="tagbar">{tagline}</span>
              {#if reason.trim()}<div class="reason-text">{reason}</div>{/if}
              <div class="teams">
                {#each (currentPlayer?.teams ?? []) as team}
                  <button class="chip" class:dead={!team.alive} class:killer={team.name === killer}
                    onclick={() => toggleKiller(team.name)}>
                    <span class="cflag {flagClass(team.name)}"></span>
                    <span>{team.name}</span>
                    {#if team.name === killer}<span class="mark">{style.mark}</span>{/if}
                  </button>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .page { max-width: 1180px; margin: 0 auto; padding: 18px 16px 64px; }
  .topbar { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand .bar { width: 6px; height: 34px; border-radius: 2px; }
  .brand h1 { font-size: 22px; margin: 0; }
  .subtitle { font-size: 12px; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase; }
  .back { margin-left: auto; font-size: 13px; color: var(--muted); text-decoration: none; }
  .back:hover { color: var(--text); }

  .wrap { display: flex; gap: 24px; align-items: flex-start; flex-wrap: wrap; }
  .form-panel { width: 360px; flex-shrink: 0; }
  .form-inner { padding: 18px; position: relative; }

  label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin: 14px 0 6px; }
  label:first-child { margin-top: 0; }
  .muted { text-transform: none; letter-spacing: 0; opacity: 0.8; }
  input[type=text], select {
    width: 100%; padding: 9px 11px; background: var(--bg); border: 1px solid var(--line);
    border-radius: 8px; color: var(--text); font-size: 14px; font-family: inherit;
  }
  input[type=file] { width: 100%; font-size: 12px; color: var(--muted); }
  input[type=range] { width: 100%; accent-color: var(--accent); }
  input[type=color] { width: 100%; height: 38px; padding: 2px; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; }
  .row { display: flex; gap: 10px; }
  .row > div { flex: 1; }
  .accent-field { max-width: 84px; }
  .hint { font-size: 11px; color: var(--muted); margin-top: 6px; line-height: 1.4; }

  .styles { display: flex; gap: 8px; }
  .stylebtn {
    flex: 1; padding: 9px 6px; border-radius: 8px; font-size: 13px; font-weight: 700;
    background: var(--panel2); border: 1px solid var(--line); color: var(--muted); cursor: pointer;
  }
  .stylebtn.active { color: #fff; border-color: var(--a); background: color-mix(in srgb, var(--a) 22%, var(--panel2)); }

  .dl-btn { width: 100%; margin-top: 20px; padding: 13px; font-size: 15px; }
  .btn:disabled { opacity: 0.55; cursor: default; }
  .row .btn { flex: 1; }
  .toast { margin-top: 12px; padding: 8px 12px; border-radius: 8px; background: rgba(54,194,117,0.14); color: var(--green); font-size: 13px; font-weight: 600; text-align: center; }

  /* Stage / preview */
  .stage { flex: 1; min-width: 320px; }
  .viewport { width: 1080px; transform-origin: top left; }
  .vpbox { overflow: hidden; border-radius: 14px; box-shadow: 0 8px 40px rgba(0,0,0,0.4); }

  /* ── Card (1080×1350, Instagram portrait) ── */
  .card { position: relative; width: 1080px; height: 1350px; background: #0B0E13; overflow: hidden; color: #fff; font-family: 'Archivo', Arial, sans-serif; }
  .photo { position: absolute; inset: 0; background-position: center 20%; background-size: cover; background-repeat: no-repeat; }
  .photo-placeholder { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 14px; color: #3a414e; }
  .shade { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(11,14,19,.15) 0%, rgba(11,14,19,0) 28%, rgba(11,14,19,.55) 58%, rgba(11,14,19,.95) 82%, #0B0E13 100%); }
  .topshade { position: absolute; left: 0; right: 0; top: 0; height: 240px; background: linear-gradient(to bottom, rgba(11,14,19,.65), rgba(11,14,19,0)); }
  .sidebar { position: absolute; left: 0; top: 0; bottom: 0; width: 18px; background: var(--card-accent); }
  .rot { position: absolute; left: 30px; bottom: 800px; transform: rotate(-90deg); transform-origin: left bottom; font-weight: 800; font-size: 22px; letter-spacing: 6px; color: #fff; white-space: nowrap; }
  .content { position: absolute; left: 64px; right: 56px; bottom: 54px; }
  .who { font-weight: 800; font-size: 46px; letter-spacing: 3px; color: #fff; text-transform: uppercase; margin-bottom: 2px; text-shadow: 0 2px 14px rgba(0,0,0,.6); }
  .elim { font-family: 'Anton', sans-serif; font-weight: 400; font-size: 188px; line-height: .86; letter-spacing: 1px; color: #fff; text-transform: uppercase; margin: 2px 0 18px; text-shadow: 0 3px 20px rgba(0,0,0,.55); }
  .tagbar { display: inline-block; background: #fff; color: #0B0E13; font-weight: 700; font-size: 30px; letter-spacing: 6px; padding: 11px 22px 10px; text-transform: uppercase; }
  .reason-text { margin-top: 18px; font-size: 26px; font-weight: 600; color: var(--reason-tint); letter-spacing: .5px; }
  .teams { display: flex; flex-wrap: wrap; gap: 11px; margin-top: 26px; }
  .chip {
    display: inline-flex; align-items: center; gap: 11px; padding: 10px 17px; border-radius: 7px;
    font-size: 24px; font-weight: 600; letter-spacing: .3px; background: rgba(255,255,255,.12);
    color: #fff; border: 1px solid rgba(255,255,255,.22); cursor: pointer; font-family: inherit;
  }
  .cflag { width: 34px; height: 23px; border-radius: 3px; box-shadow: 0 0 0 1px rgba(0,0,0,.3); flex: none; }
  .chip.dead { background: transparent; color: rgba(255,255,255,.4); border-color: rgba(255,255,255,.14); }
  .chip.dead span:not(.cflag) { text-decoration: line-through; }
  .chip.dead .cflag { filter: grayscale(1); opacity: .5; }
  .chip.killer { background: var(--card-accent); color: #fff; border-color: var(--card-accent); font-weight: 800; }
  .mark { font-size: 22px; line-height: 1; }

  @media (max-width: 760px) {
    .form-panel { width: 100%; }
  }
</style>
