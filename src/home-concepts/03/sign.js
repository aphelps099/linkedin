// The marquee's lights: a run of bulbs around the sign and along the arrow,
// drawn on one canvas over the page. Pure of the DOM: layout takes rects,
// draw takes a moment and a mood. Bulbs chase, alternate, sparkle or hold;
// nothing full-field flashes faster than twice a second.
const SPACING = 21, RADIUS = 5.6;

function sprite(size, core, mid, edge) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'), g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, core); g.addColorStop(.18, mid); g.addColorStop(.42, edge); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return c;
}

// Points every SPACING px along a rounded rectangle, clockwise from the top-left corner.
function roundedRectPath(x, y, w, h, r) {
  const pts = [];
  const arc = (cx, cy, a0, a1) => { const len = Math.abs(a1 - a0) * r, n = Math.max(1, Math.round(len / SPACING)); for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  const line = (x0, y0, x1, y1) => { const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / SPACING)); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
  line(x + r, y, x + w - r, y); arc(x + w - r, y + r, -Math.PI / 2, 0);
  line(x + w, y + r, x + w, y + h - r); arc(x + w - r, y + h - r, 0, Math.PI / 2);
  line(x + w - r, y + h, x + r, y + h); arc(x + r, y + h - r, Math.PI / 2, Math.PI);
  line(x, y + h - r, x, y + r); arc(x + r, y + r, Math.PI, Math.PI * 1.5);
  return pts;
}

// A ring of bulbs round the start button, chasing clockwise.
function ringPath(cx, cy, r) {
  const n = Math.max(12, Math.round(2 * Math.PI * r / SPACING)), pts = [];
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / n * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return pts;
}

const hash = (i, k) => { let h = (i * 374761393 + k * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function createSign(canvas) {
  const ctx = canvas.getContext('2d');
  const warm = sprite(64, '#fff9e3', '#ffe14d', 'rgba(255,184,0,.55)'), cool = sprite(64, '#ffffff', '#dbe8ff', 'rgba(43,120,255,.5)');
  let dpr = 1, W = 0, H = 0, ring = [], halo = [];

  function resize(width, height) {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = width; H = height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
  }
  // `panel` is the sign's rect in canvas px; the bulbs sit on its edge. `button`
  // is the start button's rect; a ring of bulbs runs round it.
  function layout({panel, button}) {
    ring = roundedRectPath(panel.x, panel.y, panel.w, panel.h, 28).map(([x, y], i) => ({x, y, i}));
    halo = button ? ringPath(button.x + button.w / 2, button.y + button.h / 2, button.w / 2 + 22) : [];
  }

  // mood: {kind:'chase'|'alternate'|'sparkle'|'hold'|'off', speed, beat, gain, cool}
  function draw(t, mood = {kind:'chase', speed:7, gain:1}) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const gain = Math.min(1.35, mood.gain ?? 1);
    const lit = (i, n) => {
      switch (mood.kind) {
        case 'chase': return ((i - Math.floor(t * (mood.speed || 7))) % 3 + 3) % 3 === 0 ? 1 : 0;
        case 'alternate': return (i + (mood.beat || 0)) % 2 === 0 ? 1 : 0;
        case 'sparkle': return hash(i, Math.floor(t * 5)) < .22 ? 1 : 0;
        case 'hold': return 1;
        case 'breathe': return .35 + .35 * Math.sin(t * 2 + i / n * Math.PI * 2);
        default: return 0;
      }
    };
    const img = mood.cool ? cool : warm;
    // sockets first, then light
    ctx.fillStyle = '#1b1b1f';
    for (const b of ring) { ctx.beginPath(); ctx.arc(b.x, b.y, RADIUS + 1.5, 0, Math.PI * 2); ctx.fill(); }
    for (const [x, y] of halo) { ctx.beginPath(); ctx.arc(x, y, RADIUS + 1.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalCompositeOperation = 'lighter';
    const n = ring.length, size = RADIUS * 2 * 3.4;
    for (const b of ring) {
      const v = lit(b.i, n) * gain; if (v <= 0) continue;
      ctx.globalAlpha = Math.min(1, v);
      ctx.drawImage(img, b.x - size / 2, b.y - size / 2, size, size);
    }
    // The button's ring always runs, a classic; it holds when the sign holds.
    halo.forEach(([x, y], i) => {
      const on = mood.kind === 'off' ? 0 : mood.kind === 'hold' ? 1 : ((i + Math.floor(t * 10)) % 3 + 3) % 3 === 0 ? 1 : 0;
      if (!on) return;
      ctx.globalAlpha = Math.min(1, gain);
      ctx.drawImage(warm, x - size / 2, y - size / 2, size, size);
    });
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  return {resize, layout, draw, get count() { return ring.length; }};
}
