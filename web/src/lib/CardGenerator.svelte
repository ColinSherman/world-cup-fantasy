<script>
  import players from '../data/players.json';
  import { flagClass } from './flags.js';
  import { sanitizeResults, eliminatedInKnockout } from './bracket.js';
  import html2canvas from 'html2canvas';
  import { onMount } from 'svelte';

  // ── Card styles ───────────────────────────────────────────────────────────
  // Add a new graphic style by appending an entry here.
  const STYLES = [
    { id: 'eliminated', label: 'Eliminated', accent: '#D50000', bigword: 'ELIMINATED', tagline: 'FROM TITLE CONTENTION', mark: '✕', reasonTint: '#ffd0d0', chipLabel: 'team that did them in' },
    { id: 'advances',   label: 'Advances',   accent: '#36c275', bigword: 'ADVANCES',   tagline: 'TO THE NEXT ROUND',    mark: '★', reasonTint: '#cdeedd', chipLabel: 'team carrying them' },
    { id: 'leader',     label: 'Leader',     accent: '#ffce3a', bigword: 'IN FIRST',   tagline: 'TOP OF THE TABLE',     mark: '★', reasonTint: '#fff0c2', chipLabel: 'their big mover' },
  ];
  const FILTERS = [
    { id: 'none', label: 'Full color' },
    { id: 'bw', label: 'Black & white' },
    { id: 'duotone', label: 'Duotone (accent)' },
  ];

  let styleId = $state('eliminated');
  const style = $derived(STYLES.find((s) => s.id === styleId));

  let selected = $state(players[0].name);
  let name = $state(players[0].name.toUpperCase());
  let bigword = $state(STYLES[0].bigword);
  let tagline = $state(STYLES[0].tagline);
  let accent = $state(STYLES[0].accent);
  let reason = $state('');
  let photoFilter = $state('none');
  let showEmblem = $state(true);

  let posX = $state(50);
  let posY = $state(28);
  let zoom = $state(110);

  let keyTeam = $state(null);          // highlighted team
  let outTeams = $state(new Set());    // struck-through (eliminated) teams
  let rendering = $state(false);
  let toast = $state('');

  const currentPlayer = $derived(players.find((p) => p.name === selected));

  // ── Live results → real eliminations ──
  const RESULTS_URL = import.meta.env.VITE_RESULTS_URL ||
    (import.meta.env.DEV ? 'http://localhost:8787/results' : 'https://wcf-results.colinlsherman.workers.dev/results');
  let koDead = $state(new Set()); // teams knocked out in the bracket (from live results)

  function autoOutFor(playerName) {
    const p = players.find((x) => x.name === playerName);
    return new Set((p?.teams ?? []).filter((t) => !t.alive || koDead.has(t.name)).map((t) => t.name));
  }

  onMount(async () => {
    try {
      const d = await (await fetch(RESULTS_URL)).json();
      koDead = eliminatedInKnockout(sanitizeResults(d.results || {}));
    } catch { /* offline / worker down — fall back to group-stage status */ }
    outTeams = autoOutFor(selected); // reseed once live data is in
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });

  // Preset text/accent when the style changes.
  let lastStyle = STYLES[0].id;
  $effect(() => {
    if (styleId !== lastStyle) {
      lastStyle = styleId;
      bigword = style.bigword;
      tagline = style.tagline;
      accent = style.accent;
    }
  });

  // Auto-fill + reseed eliminations when the player changes.
  let lastPlayer = players[0].name;
  $effect(() => {
    if (selected !== lastPlayer) {
      lastPlayer = selected;
      name = selected.toUpperCase();
      keyTeam = null;
      outTeams = autoOutFor(selected);
    }
  });

  function toggleKey(t) { keyTeam = keyTeam === t ? null : t; }
  function toggleOut(t) {
    const s = new Set(outTeams);
    s.has(t) ? s.delete(t) : s.add(t);
    outTeams = s;
  }

  // ── Photo handling (filter applied to pixels so preview === export) ──
  let originalImg = null;
  let photoUrl = $state(null);

  function hexToRgb(h) {
    const m = h.replace('#', '');
    return { r: parseInt(m.slice(0, 2), 16), g: parseInt(m.slice(2, 4), 16), b: parseInt(m.slice(4, 6), 16) };
  }

  function processPhoto() {
    if (!originalImg) { photoUrl = null; return; }
    const c = document.createElement('canvas');
    c.width = originalImg.naturalWidth; c.height = originalImg.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(originalImg, 0, 0);
    if (photoFilter !== 'none') {
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const a = img.data;
      const acc = hexToRgb(accent);
      const sh = { r: acc.r * 0.22, g: acc.g * 0.22, b: acc.b * 0.22 };
      const hi = { r: acc.r + (255 - acc.r) * 0.82, g: acc.g + (255 - acc.g) * 0.82, b: acc.b + (255 - acc.b) * 0.82 };
      for (let i = 0; i < a.length; i += 4) {
        const lum = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
        if (photoFilter === 'bw') { a[i] = a[i + 1] = a[i + 2] = lum; }
        else { const t = lum / 255; a[i] = sh.r + (hi.r - sh.r) * t; a[i + 1] = sh.g + (hi.g - sh.g) * t; a[i + 2] = sh.b + (hi.b - sh.b) * t; }
      }
      ctx.putImageData(img, 0, 0);
    }
    photoUrl = c.toDataURL('image/png');
  }

  // Reprocess when the filter or (for duotone) the accent changes.
  let lastFilterKey = '';
  $effect(() => {
    const key = photoFilter + '|' + (photoFilter === 'duotone' ? accent : '');
    if (key !== lastFilterKey) { lastFilterKey = key; processPhoto(); }
  });

  function onFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => { originalImg = img; processPhoto(); };
    img.src = URL.createObjectURL(f);
  }

  // ── Drag-to-pan the photo ──
  let dragging = false, dragStart = null;
  function onPointerDown(e) {
    if (!photoUrl) return;
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, px: posX, py: posY };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const dispW = viewportEl ? viewportEl.getBoundingClientRect().width : 540;
    const dispH = dispW * (1350 / 1080);
    const dxp = ((e.clientX - dragStart.x) / dispW) * 100;
    const dyp = ((e.clientY - dragStart.y) / dispH) * 100;
    posX = Math.max(0, Math.min(100, dragStart.px - dxp));
    posY = Math.max(0, Math.min(100, dragStart.py - dyp));
  }
  function onPointerUp() {
    dragging = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }

  // ── Preview scaling + export ──
  let cardEl, viewportEl, vpboxEl, stageEl;
  function fit() {
    if (!stageEl || !viewportEl || !vpboxEl) return;
    const w = Math.min(stageEl.clientWidth, 560);
    const s = w / 1080;
    viewportEl.style.transform = `scale(${s})`;
    viewportEl.style.transformOrigin = 'top left';
    vpboxEl.style.height = 1350 * s + 'px';
  }

  function flash(msg) { toast = msg; setTimeout(() => (toast = ''), 1800); }

  async function renderCanvas() {
    await document.fonts.ready;
    // Capture a clone at natural size with no parent transform — avoids the
    // scaled-preview coordinate bug that jumbled html2canvas output.
    const clone = cardEl.cloneNode(true);
    clone.style.transform = 'none';
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed; left:-10000px; top:0; width:1080px; height:1350px; z-index:-1;';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    try {
      return await html2canvas(clone, {
        scale: 2, backgroundColor: '#0B0E13', useCORS: true, logging: false,
        width: 1080, height: 1350, windowWidth: 1080, windowHeight: 1350,
      });
    } finally {
      holder.remove();
    }
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
    } catch (e) { flash('Render failed — try again'); }
    finally { rendering = false; }
  }

  async function copyImage() {
    if (!cardEl || !navigator.clipboard?.write) { flash('Clipboard not supported'); return; }
    rendering = true;
    try {
      const canvas = await renderCanvas();
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash('Copied to clipboard');
    } catch (e) { flash('Copy failed — use Download'); }
    finally { rendering = false; }
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
        <div class="seg">
          {#each STYLES as s}
            <button class="segbtn" class:active={s.id === styleId} style:--a={s.accent} onclick={() => (styleId = s.id)}>{s.label}</button>
          {/each}
        </div>

        <div class="row">
          <div>
            <label>Player</label>
            <select bind:value={selected}>{#each players as p}<option value={p.name}>{p.name}</option>{/each}</select>
          </div>
          <div class="accent-field">
            <label>Accent</label>
            <input type="color" bind:value={accent} />
          </div>
        </div>

        <label>Player photo</label>
        <input type="file" accept="image/*" onchange={onFileChange} />
        <div class="hint">Drag the photo in the preview to reposition, or use the sliders.</div>

        <div class="row">
          <div><label>Horizontal</label><input type="range" min="0" max="100" bind:value={posX} /></div>
          <div><label>Vertical</label><input type="range" min="0" max="100" bind:value={posY} /></div>
          <div><label>Zoom</label><input type="range" min="100" max="280" bind:value={zoom} /></div>
        </div>

        <div class="row">
          <div>
            <label>Photo filter</label>
            <select bind:value={photoFilter}>{#each FILTERS as f}<option value={f.id}>{f.label}</option>{/each}</select>
          </div>
          <div class="check-field">
            <label>Flag emblem</label>
            <button class="toggle" class:on={showEmblem} onclick={() => (showEmblem = !showEmblem)}>{showEmblem ? 'On' : 'Off'}</button>
          </div>
        </div>

        <label>Name on card</label>
        <input type="text" bind:value={name} />
        <label>Big word</label>
        <input type="text" bind:value={bigword} />
        <label>Bottom bar</label>
        <input type="text" bind:value={tagline} />
        <label>Subtitle / reason <span class="muted">(optional)</span></label>
        <input type="text" bind:value={reason} placeholder="Dominated by Susan S" />

        <label>Teams <span class="muted">— Key = highlight {style.chipLabel}; Out = struck</span></label>
        <div class="team-edit">
          {#each (currentPlayer?.teams ?? []) as team}
            <div class="te-row">
              <span class="te-flag {flagClass(team.name)}"></span>
              <span class="te-name" class:struck={outTeams.has(team.name)}>{team.name}</span>
              <button class="tg" class:on={keyTeam === team.name} onclick={() => toggleKey(team.name)}>Key</button>
              <button class="tg" class:on={outTeams.has(team.name)} onclick={() => toggleOut(team.name)}>Out</button>
            </div>
          {/each}
        </div>

        <button class="btn accent dl-btn" onclick={download} disabled={rendering}>{rendering ? 'Rendering…' : 'Download PNG'}</button>
        <div class="row" style="margin-top:10px">
          <button class="btn" onclick={copyImage} disabled={rendering}>Copy image</button>
          <button class="btn" onclick={() => (keyTeam = null)}>Clear key</button>
        </div>
        {#if toast}<div class="toast">{toast}</div>{/if}
      </div>
    </div>

    <div class="stage" bind:this={stageEl}>
      <div class="vpbox" bind:this={vpboxEl}>
        <div class="viewport" bind:this={viewportEl}>
          <div class="card" bind:this={cardEl} style:--card-accent={accent} style:--reason-tint={style.reasonTint}>
            <div class="photo-layer" class:grabbable={!!photoUrl} onpointerdown={onPointerDown}>
              {#if photoUrl}
                <div class="photo" style:background-image="url({photoUrl})" style:background-position="{posX}% {posY}%" style:background-size="{zoom}%"></div>
              {:else}
                <div class="photo-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" width="170" height="170"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
                  <div style="font-size:22px;font-weight:600">Upload a player photo</div>
                </div>
              {/if}
            </div>
            <div class="topshade"></div>
            <div class="shade"></div>
            <div class="sidebar"></div>
            <div class="rot">WORLD CUP FANTASY · 2026</div>
            <div class="content">
              {#if showEmblem && keyTeam}<span class="emblem {flagClass(keyTeam)}"></span>{/if}
              <div class="who">{name || selected.toUpperCase()}</div>
              <div class="elim">{bigword || style.bigword}</div>
              <span class="tagbar">{tagline}</span>
              {#if reason.trim()}<div class="reason-text">{reason}</div>{/if}
              <div class="teams">
                {#each (currentPlayer?.teams ?? []) as team}
                  <button class="chip" class:dead={outTeams.has(team.name)} class:killer={team.name === keyTeam} onclick={() => toggleKey(team.name)}>
                    <span class="cflag {flagClass(team.name)}"></span>
                    <span class="cname">{team.name}</span>
                    {#if team.name === keyTeam}<span class="mark">{style.mark}</span>{/if}
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
  .form-panel { width: 380px; flex-shrink: 0; }
  .form-inner { padding: 18px; }

  label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--muted); margin: 14px 0 6px; }
  .form-inner > label:first-child { margin-top: 0; }
  .muted { text-transform: none; letter-spacing: 0; opacity: 0.8; }
  input[type=text], select { width: 100%; padding: 9px 11px; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; color: var(--text); font-size: 14px; font-family: inherit; }
  input[type=file] { width: 100%; font-size: 12px; color: var(--muted); }
  input[type=range] { width: 100%; accent-color: var(--accent); }
  input[type=color] { width: 100%; height: 38px; padding: 2px; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; }
  .row { display: flex; gap: 10px; }
  .row > div { flex: 1; }
  .accent-field { max-width: 78px; }
  .check-field { max-width: 92px; }
  .hint { font-size: 11px; color: var(--muted); margin-top: 6px; line-height: 1.4; }

  .seg { display: flex; gap: 8px; }
  .segbtn { flex: 1; padding: 9px 6px; border-radius: 8px; font-size: 13px; font-weight: 700; background: var(--panel2); border: 1px solid var(--line); color: var(--muted); cursor: pointer; }
  .segbtn.active { color: #fff; border-color: var(--a); background: color-mix(in srgb, var(--a) 22%, var(--panel2)); }
  .toggle { width: 100%; height: 38px; border-radius: 8px; font-weight: 700; font-size: 13px; background: var(--panel2); border: 1px solid var(--line); color: var(--muted); cursor: pointer; }
  .toggle.on { background: color-mix(in srgb, var(--accent) 22%, var(--panel2)); border-color: var(--accent); color: #fff; }

  .team-edit { display: flex; flex-direction: column; gap: 6px; }
  .te-row { display: flex; align-items: center; gap: 8px; }
  .te-flag { width: 22px; height: 15px; border-radius: 2px; box-shadow: 0 0 0 1px rgba(0,0,0,.3); flex: none; }
  .te-name { flex: 1; font-size: 13px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .te-name.struck { text-decoration: line-through; color: var(--muted); }
  .tg { padding: 4px 9px; border-radius: 6px; font-size: 12px; font-weight: 700; background: var(--panel2); border: 1px solid var(--line); color: var(--muted); cursor: pointer; }
  .tg.on { background: color-mix(in srgb, var(--accent) 26%, var(--panel2)); border-color: var(--accent); color: #fff; }

  .dl-btn { width: 100%; margin-top: 20px; padding: 13px; font-size: 15px; }
  .btn:disabled { opacity: 0.55; cursor: default; }
  .row .btn { flex: 1; }
  .toast { margin-top: 12px; padding: 8px 12px; border-radius: 8px; background: rgba(54,194,117,0.14); color: var(--green); font-size: 13px; font-weight: 600; text-align: center; }

  /* Stage / preview */
  .stage { flex: 1; min-width: 320px; }
  .viewport { width: 1080px; transform-origin: top left; }
  .vpbox { overflow: hidden; border-radius: 14px; box-shadow: 0 8px 40px rgba(0,0,0,0.4); }

  /* ── Card (1080×1350) — explicit offsets, no `inset` (html2canvas-safe) ── */
  .card { position: relative; width: 1080px; height: 1350px; background: #0B0E13; overflow: hidden; color: #fff; font-family: 'Archivo', Arial, sans-serif; }
  .photo-layer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
  .photo-layer.grabbable { cursor: grab; }
  .photo-layer.grabbable:active { cursor: grabbing; }
  .photo { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-repeat: no-repeat; }
  .photo-placeholder { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 14px; color: #3a414e; }
  .shade { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; background: linear-gradient(to bottom, rgba(11,14,19,.15) 0%, rgba(11,14,19,0) 28%, rgba(11,14,19,.55) 58%, rgba(11,14,19,.95) 82%, #0B0E13 100%); }
  .topshade { position: absolute; top: 0; left: 0; right: 0; height: 240px; pointer-events: none; background: linear-gradient(to bottom, rgba(11,14,19,.65), rgba(11,14,19,0)); }
  .sidebar { position: absolute; left: 0; top: 0; bottom: 0; width: 18px; background: var(--card-accent); }
  .rot { position: absolute; left: 30px; bottom: 800px; transform: rotate(-90deg); transform-origin: left bottom; font-weight: 800; font-size: 22px; letter-spacing: 6px; color: #fff; white-space: nowrap; pointer-events: none; }
  .content { position: absolute; left: 64px; right: 56px; bottom: 54px; pointer-events: none; }
  .content .chip { pointer-events: auto; }
  .emblem { display: block; width: 130px; height: 87px; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,.5); margin-bottom: 22px; }
  .who { font-weight: 800; font-size: 46px; letter-spacing: 3px; color: #fff; text-transform: uppercase; margin-bottom: 2px; text-shadow: 0 2px 14px rgba(0,0,0,.6); }
  .elim { font-family: 'Anton', sans-serif; font-weight: 400; font-size: 188px; line-height: .86; letter-spacing: 1px; color: #fff; text-transform: uppercase; margin: 2px 0 18px; text-shadow: 0 3px 20px rgba(0,0,0,.55); }
  .tagbar { display: inline-block; background: #fff; color: #0B0E13; font-weight: 700; font-size: 30px; letter-spacing: 6px; padding: 11px 22px 10px; text-transform: uppercase; }
  .reason-text { margin-top: 18px; font-size: 26px; font-weight: 600; color: var(--reason-tint); letter-spacing: .5px; }
  .teams { display: flex; flex-wrap: wrap; gap: 11px; margin-top: 26px; }
  .chip { display: inline-flex; align-items: center; gap: 11px; padding: 10px 17px; border-radius: 7px; font-size: 24px; font-weight: 600; letter-spacing: .3px; background: rgba(255,255,255,.12); color: #fff; border: 1px solid rgba(255,255,255,.22); cursor: pointer; font-family: inherit; }
  .cflag { width: 34px; height: 23px; border-radius: 3px; box-shadow: 0 0 0 1px rgba(0,0,0,.3); flex: none; }
  .chip.dead { background: transparent; color: rgba(255,255,255,.4); border-color: rgba(255,255,255,.14); }
  .chip.dead .cname { text-decoration: line-through; }
  .chip.dead .cflag { filter: grayscale(1); opacity: .5; }
  .chip.killer { background: var(--card-accent); color: #fff; border-color: var(--card-accent); font-weight: 800; }
  .mark { font-size: 22px; line-height: 1; }

  @media (max-width: 820px) { .form-panel { width: 100%; } }
</style>
