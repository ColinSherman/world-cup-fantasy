<script>
  import { onMount } from 'svelte';

  // names: the mathematically locked champion group (usually one, more on a tie)
  // full: the entire podium is locked — go full-blast; until then keep it subtle
  let { names, points = null, full = false } = $props();
  const title = $derived(names.length > 1 ? `${names.join(' & ')} win it all!` : `${names[0]} wins it all!`);
  const detail = $derived(
    `2026 World Cup Fantasy Champion${names.length > 1 ? 's' : ''}${points != null ? ` · ${points} pts` : ''}`
  );

  let canvas;
  let raf;
  let stopCurrent = null;

  // Confetti colors pulled from the site palette (+ white for pop).
  const COLORS = ['#ffce3a', '#e1140a', '#36c275', '#3c8aff', '#ffffff', '#ff8a3c'];

  function makePiece(w, h, fromTop) {
    return {
      x: Math.random() * w,
      y: fromTop ? -20 - Math.random() * h * 0.5 : Math.random() * -h,
      w: 6 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      vy: 1.5 + Math.random() * 2.5,
      vx: -1 + Math.random() * 2,
      rot: Math.random() * Math.PI * 2,
      vrot: -0.12 + Math.random() * 0.24,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.02 + Math.random() * 0.04,
    };
  }

  function celebrate() {
    stopCurrent?.();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // full podium locked = the real party; a lone clinch gets a gentle sprinkle
    const PIECES = full ? 200 : 40;
    const BURST_MS = full ? 12000 : 4000;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w, h;
    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    let pieces = Array.from({ length: PIECES }, () => makePiece(w, h, true));
    const start = performance.now();
    stopCurrent = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, w, h);
      stopCurrent = null;
    };

    function frame(now) {
      ctx.clearRect(0, 0, w, h);
      const raining = now - start < BURST_MS;
      let alive = 0;
      for (const p of pieces) {
        p.sway += p.swaySpeed;
        p.x += p.vx + Math.sin(p.sway) * 1.2;
        p.y += p.vy;
        p.rot += p.vrot;
        if (p.y > h + 20) {
          if (!raining) continue; // fell off after the burst window — let it die
          Object.assign(p, makePiece(w, h, false));
        }
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        // squish on one axis for a tumbling-paper look
        ctx.scale(1, 0.5 + Math.abs(Math.sin(p.sway * 1.7)) * 0.5);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive > 0) {
        raf = requestAnimationFrame(frame);
      } else {
        stopCurrent?.();
      }
    }
    raf = requestAnimationFrame(frame);
  }

  // fires on mount, and again (at full strength) the moment the podium locks
  let prevFull = null;
  $effect(() => {
    if (full !== prevFull) { prevFull = full; celebrate(); }
  });
  onMount(() => () => stopCurrent?.());
</script>

<canvas bind:this={canvas} class="confetti" aria-hidden="true"></canvas>

<button class="winner" onclick={celebrate} title="More confetti!">
  <span class="trophy">🏆</span>
  <span class="text">
    <span class="crowned">{title}</span>
    <span class="detail">{detail}</span>
  </span>
  <span class="trophy flip">🎉</span>
</button>

<style>
  .confetti {
    position: fixed; inset: 0;
    width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 200;
  }
  .winner {
    display: flex; align-items: center; justify-content: center; gap: 14px;
    width: 100%;
    margin: 0 0 16px;
    padding: 16px 18px;
    border-radius: var(--radius);
    border: 1px solid rgba(255, 206, 58, 0.45);
    background:
      linear-gradient(100deg, rgba(255,206,58,0.16), rgba(225,20,10,0.10) 50%, rgba(255,206,58,0.16)),
      var(--panel);
    color: var(--text);
    text-align: left;
    box-shadow: 0 0 24px rgba(255, 206, 58, 0.12);
    animation: glow 2.4s ease-in-out infinite;
  }
  .winner:hover { border-color: var(--gold); }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 18px rgba(255, 206, 58, 0.10); }
    50%      { box-shadow: 0 0 30px rgba(255, 206, 58, 0.28); }
  }
  .trophy { font-size: 30px; line-height: 1; animation: bounce 1.6s ease-in-out infinite; }
  .trophy.flip { animation-delay: 0.8s; }
  @keyframes bounce {
    0%, 100% { transform: translateY(0) rotate(-6deg); }
    50%      { transform: translateY(-5px) rotate(6deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .winner, .trophy { animation: none; }
  }
  .text { display: flex; flex-direction: column; gap: 2px; }
  .crowned {
    font-size: 20px; font-weight: 800; letter-spacing: -0.01em;
    background: linear-gradient(90deg, var(--gold), #fff2c4, var(--gold));
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
  }
  .detail { font-size: 12px; font-weight: 600; color: var(--muted); letter-spacing: 0.12em; text-transform: uppercase; }
  @media (max-width: 700px) {
    .crowned { font-size: 17px; }
    .trophy { font-size: 24px; }
  }
</style>
