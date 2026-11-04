// The video call's chrome, drawn by the compositor so the export carries it: a name bar
// per tile (mic icon, name, role), the speaking border, "joined" and "left the meeting"
// toasts, banners ("You are viewing Synergy's screen", "Your connection is unstable"),
// Pat's camera-off tile (avatar initials) and the lady's tile (a waveform: she never has a
// face). The look is the site's meeting room (src/meeting-room/meeting-room.css): the same
// greys, the same green speaking border, TT Hoves; no third-party call marks.
//
// Text and icons are rasterised once into a Canvas2D atlas (createAtlas) and drawn as
// instanced quads (CHROME_VS/FS in shaders.js). Layout is a pure function of the layer and
// the frame (chromeQuads), so the same frame always gets the same chrome.

// Meeting-room colours, as premultiplied-ready [r, g, b] 0..1.
const hex = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
export const CHROME_COLORS = {
  bar:hex('#15171b'), text:hex('#e1e4eb'), muted:hex('#9ca3b1'), icon:hex('#b5b8c1'), green:hex('#7cdb65'),
  pill:hex('#11141c'), pillText:hex('#d9e0ed'), avatar:hex('#444751'), avatarText:hex('#d0d3df'), status:hex('#8f95a2'),
  cameraIcon:hex('#686d79'), blue:hex('#2872ff'), signal:hex('#ffe14d'), voice:hex('#a9c4ff'), tile:hex('#181a1e'),
};
const C = CHROME_COLORS;

// Fonts: the meeting room's TT Hoves, and Azeret Mono for figures.
export const FONTS = {
  sans:{family:'VS Hoves', faces:[['/home-2/fonts/tt-hoves-regular.ttf', '400'], ['/home-2/fonts/tt-hoves-demibold.ttf', '600']]},
  mono:{family:'VS Mono', faces:[['/brand/fonts/azeret-mono-variable.woff2', '100 900']]},
};
let fontsReady = null;
export function loadFonts(base = '') {
  if (fontsReady) return fontsReady;
  const set = globalThis.document?.fonts ?? globalThis.self?.fonts;
  if (!set || typeof FontFace === 'undefined') return fontsReady = Promise.resolve(false);
  const faces = [];
  for (const f of Object.values(FONTS)) for (const [url, weight] of f.faces) faces.push(new FontFace(f.family, `url(${base}${url})`, {weight}));
  return fontsReady = Promise.all(faces.map(face => face.load().then(x => { set.add(x); return true; }, () => false))).then(r => r.every(Boolean));
}

// Lucide icon paths (lucide-react 0.468, ISC), drawn on a 24-unit grid with a 2-unit stroke.
export const ICONS = {
  mic:['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
  micOff:['M2 2l20 20', 'M18.89 13.23A7.12 7.12 0 0 0 19 12v-2', 'M5 10v2a7 7 0 0 0 12 5', 'M15 9.34V5a3 3 0 0 0-5.68-1.33', 'M9 9v3a3 3 0 0 0 5.12 2.12', 'M12 19v3'],
  videoOff:['M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196', 'M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2', 'm2 2 20 20'],
  screenShare:['M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3', 'M8 21h8', 'M12 17v4', 'm17 8 5-5', 'M17 3h5v5'],
  userPlus:['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M13 7a4 4 0 1 1-8 0a4 4 0 1 1 8 0', 'M19 8v6', 'M22 11h-6'],
  logOut:['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  wifiOff:['M12 20h.01', 'M8.5 16.429a5 5 0 0 1 7 0', 'M5 12.859a10 10 0 0 1 5.17-2.69', 'M19 12.859a10 10 0 0 0-2.007-1.523', 'M2 8.82a15 15 0 0 1 4.177-2.643', 'M22 8.82a15 15 0 0 0-11.288-3.764', 'm2 2 20 20'],
};

// ---- the atlas ---------------------------------------------------------------------------------------
// Shelf-packed white-on-transparent text and icons. Entries are rasterised at device size
// (output px × render scale) so they land pixel for pixel; quads are snapped to device px.
export function createAtlas({size = 2048, scale = 1} = {}) {
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(size, size) : Object.assign(document.createElement('canvas'), {width:size, height:size});
  const ctx = canvas.getContext('2d', {willReadFrequently:false});
  const entries = new Map();
  let x = 1, y = 1, rowH = 0, dirty = true, generation = 0;
  const PAD = 2;
  function reset() { entries.clear(); ctx.clearRect(0, 0, size, size); x = 1; y = 1; rowH = 0; dirty = true; generation++; }
  function alloc(w, h) {
    if (w > size - 2 || h > size - 2) return null;
    if (x + w + PAD > size) { x = 1; y += rowH + PAD; rowH = 0; }
    if (y + h + PAD > size) return null;
    const r = {x, y, w, h};
    x += w + PAD; rowH = Math.max(rowH, h);
    return r;
  }
  const fontOf = (font, px, weight) => `${weight} ${px}px "${FONTS[font]?.family ?? FONTS.sans.family}", ${font === 'mono' ? 'ui-monospace, monospace' : 'Arial, sans-serif'}`;
  // Text at `px` output px: returns {u0, v0, u1, v1, w, h, ascent} in device px, or null when it cannot fit.
  function text(str, {px, font = 'sans', weight = 400, tracking = 0} = {}) {
    const dpx = Math.max(4, Math.round(px * scale * 2) / 2), key = `t|${font}|${weight}|${dpx}|${tracking}|${str}`;
    if (entries.has(key)) return entries.get(key);
    ctx.font = fontOf(font, dpx, weight);
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${tracking * dpx}px`;
    const m = ctx.measureText(str), asc = Math.ceil(dpx * .95), desc = Math.ceil(dpx * .3);
    const w = Math.ceil(m.width) + 4, h = asc + desc + 2;
    let r = alloc(w, h);
    if (!r) { reset(); r = alloc(w, h); if (!r) return null; }
    ctx.save(); ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.fillText(str, r.x + 2, r.y + 1 + asc); ctx.restore();
    const e = {u0:r.x, v0:r.y, u1:r.x + w, v1:r.y + h, w:w / scale, h:h / scale, ascent:(1 + asc) / scale, advance:m.width / scale, gen:generation};
    entries.set(key, e); dirty = true;
    return e;
  }
  // An icon `px` output px square.
  function icon(name, px, stroke = 2) {
    const dpx = Math.max(6, Math.round(px * scale)), key = `i|${name}|${dpx}|${stroke}`;
    if (entries.has(key)) return entries.get(key);
    let r = alloc(dpx + 2, dpx + 2);
    if (!r) { reset(); r = alloc(dpx + 2, dpx + 2); }
    ctx.save(); ctx.translate(r.x + 1, r.y + 1); ctx.scale(dpx / 24, dpx / 24);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const d of ICONS[name] || []) ctx.stroke(new Path2D(d));
    ctx.restore();
    const e = {u0:r.x, v0:r.y, u1:r.x + dpx + 2, v1:r.y + dpx + 2, w:(dpx + 2) / scale, h:(dpx + 2) / scale, gen:generation};
    entries.set(key, e); dirty = true;
    return e;
  }
  return {
    canvas, size, text, icon, reset,
    get dirty() { return dirty; }, clean() { dirty = false; },
    get generation() { return generation; },
    setScale(s) { if (s !== scale) { scale = s; reset(); } },
  };
}

// ---- layout -------------------------------------------------------------------------------------------
// One quad: {x, y, w, h, color:[r,g,b,a] straight, uv?:atlas entry, radius, mode:'fill'|'glyph'|'stroke', stroke, clip:{x,y,w,h,r}}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = u => { const x = clamp(u, 0, 1); return x * x * (3 - 2 * x); };
const initials = name => name === 'Pat' ? 'PT' : String(name || '?').split(/\s+/).filter(Boolean).map(s => s[0]).slice(0, 2).join('').toUpperCase();
// The cast's departments, as the meeting room labels them (src/meeting-room/catalog.js), for
// tiles whose clip names nobody's role. The host's role is never shown.
export const CAST_ROLES = {'Synthia':'Corporate training', 'People & Culture':'Human resources', 'Strategy':'Strategic alignment', 'Kevin':'Partnerships',
  'Keys':'Enablement', 'Operations':'Operational excellence', 'Arjun':'Finance', 'Linda':'Governance', 'Printer':'Deliverables', 'Pat':'Thought leadership'};
export const isLadyTile = l => /\blady\b|circle back/i.test(l?.chrome?.name || '');
const snap = (v, s) => Math.round(v * s) / s;

// Size of the chrome in a cell: the meeting room's proportions at film scale, never so big
// that a small tile is all chrome.
export const chromeScale = cell => clamp(Math.min(cell.h / 290, cell.w / 380), .55, 1.2);
// Legible on a phone, whatever the tile: names at 11 pt and roles at 9 pt on a 390 pt wide
// phone in portrait (9:16, 1:1: 30.5 and 24.9 px of 1080), or across an 844 pt phone held
// sideways (16:9: 25.0 and 20.5 px of 1920). Toasts, banners and Pat's card read at the name's
// size. Where a tile cannot hold the role beside the name, the role goes; the name never does.
const PHONE_PT = {'9:16':390, '1:1':390, '16:9':844};
export const LEGIBLE = Object.fromEntries(Object.entries({'9:16':1080, '1:1':1080, '16:9':1920}).map(([f, w]) => [f, {name:11 * w / PHONE_PT[f], role:9 * w / PHONE_PT[f]}]));
const NONE = {name:0, role:0};

// Pat's camera-off tile and the lady's tile: what replaces the picture.
export function tileQuads(layer, atlas, {scale = 1, time = 0, legible = NONE} = {}) {
  const out = [], {cell} = layer, k = chromeScale(cell), clip = {...cell, r:layer.radius}, kn = Math.max(k, legible.name / 24);
  const cx = cell.x + cell.w / 2, cy = cell.y + cell.h / 2 - (cell.h > 200 ? 10 * k : 0);
  if (isLadyTile(layer)) {
    // No face, ever: her voice as a waveform, bars on the meeting room's grid.
    const n = 23, bw = 5 * k, gap = 5 * k, total = n * bw + (n - 1) * gap, level = clamp(layer.chrome.speaking ?? 0, 0, 1);
    const maxH = Math.min(cell.h * .42, 140 * k), f = Math.floor(time * 24);
    for (let i = 0; i < n; i++) {
      const u = (i - (n - 1) / 2) / ((n - 1) / 2), shape = Math.cos(u * Math.PI / 2) ** 1.5;
      const wob = .55 + .45 * Math.abs(Math.sin(i * 1.93 + f * .71) * Math.cos(i * .61 - f * .37));
      const h = Math.max(bw, (6 * k) + maxH * level * shape * wob);
      out.push({x:cx - total / 2 + i * (bw + gap), y:cy - h / 2, w:bw, h, color:[...C.voice, .35 + .65 * level], radius:bw / 2, mode:'fill', clip});
    }
    return out;
  }
  // Pat: the meeting room's camera-off card. Avatar initials, name, status; the icon top right.
  const D = clamp(Math.min(cell.w, cell.h) * .3, 40, 150);
  const top = cell.h < 200 ? cy - D / 2 : cy - D / 2 - 18 * k;
  out.push({x:cx - D / 2, y:top, w:D, h:D, color:[...C.avatar, 1], radius:D / 2, mode:'fill', clip});
  const ini = atlas.text(initials(layer.chrome.name), {px:D * .36, weight:400});
  if (ini) out.push(glyph(ini, snap(cx - ini.advance / 2 - 2 / scale, scale), snap(top + D / 2 - ini.ascent + D * .36 * .36, scale), C.avatarText, 1, clip));
  if (cell.h >= 200) {
    const name = atlas.text(layer.chrome.name || 'Pat', {px:24 * kn, weight:400});
    if (name) out.push(glyph(name, snap(cx - name.advance / 2 - 2 / scale, scale), snap(top + D + 14 * k, scale), C.text, 1, clip));
    const st = atlas.text('Camera off', {px:Math.max(17 * k, legible.role)});
    if (st && top + D + 14 * k + 32 * kn + st.h < cell.y + cell.h) out.push(glyph(st, snap(cx - st.advance / 2 - 2 / scale, scale), snap(top + D + 14 * k + 32 * kn, scale), C.status, 1, clip));
  }
  const ic = atlas.icon('videoOff', 26 * k);
  out.push(glyph(ic, snap(cell.x + cell.w - 16 * k - ic.w, scale), snap(cell.y + 16 * k, scale), C.cameraIcon, 1, clip));
  return out;
}

function glyph(e, x, y, rgb, a, clip) { return {x, y, w:e.w, h:e.h, color:[...rgb, a], uv:e, mode:'glyph', clip}; }

// Everything drawn over one layer's tile: speaking border, name bar, toast, banner.
// opts.banner: the layout's banner rect (BOARD+STRIP) takes the banner instead of the tile.
export function chromeQuads(layer, atlas, {scale = 1, time = 0, bannerRect = null, avoid = null, legible = NONE} = {}) {
  const ch = layer.chrome || {}, cell = layer.cell, out = [];
  if (!ch || cell.id === 'full' || cell.w < 120 || cell.h < 80) return out;
  const k0 = chromeScale(cell), clip = {...cell, r:layer.radius};
  // The name bar's scale: the tile's, but never under the phone's 11 pt name.
  const k = Math.max(k0, legible.name / 20);
  const speaking = clamp(ch.speaking ?? 0, 0, 1);
  const op = layer.opacity ?? 1;
  // The name bar: the meeting room's strip along the bottom of the tile.
  if (ch.name) {
    const bh = Math.round(40 * k);
    let by = cell.y + cell.h - bh;
    if (avoid && avoid.y + avoid.h > by && avoid.y < cell.y + cell.h) by = cell.y;    // keep clear of the robot's mouth row
    out.push({x:cell.x, y:by, w:cell.w, h:bh, color:[...C.bar, .92 * op], radius:0, mode:'fill', clip});
    const pad = 14 * k, isz = 20 * k, muted = ch.mic === 'muted';
    const name = atlas.text(ch.name, {px:20 * k, weight:400});
    const base = by + bh / 2 + 7 * k;   // text baseline
    const dotsW = speaking > .5 ? 26 * k : 0;
    // A tile too narrow for the icon and the name gives up the icon first, then the dots.
    const withIcon = !name || cell.x + pad + isz + 9 * k + name.advance <= cell.x + cell.w - pad - dotsW * .5;
    let tx = cell.x + pad;
    if (withIcon) {
      const ic = atlas.icon(muted ? 'micOff' : 'mic', isz, 2);
      const icCol = speaking > .5 && !muted ? C.green : C.icon;
      out.push(glyph(ic, snap(cell.x + pad - 1 / scale, scale), snap(by + (bh - ic.h) / 2, scale), icCol, op, clip));
      tx += isz + 9 * k;
    }
    if (name) { out.push(glyph(name, snap(tx - 2 / scale, scale), snap(base - name.ascent, scale), C.text, op, clip)); tx += name.advance; }
    const roleText = ch.role ?? CAST_ROLES[ch.name];
    if (roleText && roleText !== 'Host') {
      const role = atlas.text(` · ${roleText}`, {px:Math.max(16 * k, legible.role), weight:400});
      if (role && tx + role.advance < cell.x + cell.w - pad - dotsW) out.push(glyph(role, snap(tx - 2 / scale, scale), snap(base - role.ascent, scale), C.muted, op, clip));
    }
    if (speaking > .5 && tx + dotsW <= cell.x + cell.w - pad) for (let i = 0; i < 3; i++) {
      const d = 5 * k;
      out.push({x:cell.x + cell.w - pad - 3 * d - 2 * 4 * k + i * (d + 4 * k), y:by + bh / 2 - d / 2, w:d, h:d, color:[...C.green, op], radius:d / 2, mode:'fill', clip});
    }
  }
  // The speaking border: the meeting room's green, inside the tile's corners.
  if (speaking > .02) out.push({x:cell.x, y:cell.y, w:cell.w, h:cell.h, color:[...C.green, speaking * op], radius:layer.radius, mode:'stroke', stroke:Math.max(2, 5 * k0), clip});
  // A toast: in on its first .18 s, out on its last .18 s.
  if (ch.toast?.text) {
    const a = smooth(ch.toast.age / .18) * smooth(ch.toast.remaining / .18);
    if (a > 0) {
      const left = /left the meeting/i.test(ch.toast.text);
      const t = atlas.text(ch.toast.text, {px:Math.max(19 * k0, legible.name), weight:400}), ic = atlas.icon(left ? 'logOut' : 'userPlus', 18 * k, 2);
      if (t) {
        const ph = 42 * k, pw = Math.min(cell.w - 24 * k, t.advance + 18 * k + 10 * k + 32 * k);
        const px = cell.x + (cell.w - pw) / 2, py = cell.y + 16 * k - (1 - a) * 10 * k;
        out.push({x:px, y:py, w:pw, h:ph, color:[...C.pill, .9 * a * op], radius:ph / 2, mode:'fill', clip});
        out.push(glyph(ic, snap(px + 16 * k, scale), snap(py + (ph - ic.h) / 2, scale), left ? C.muted : C.blue, a * op, {...clip}));
        out.push(glyph(t, snap(px + 16 * k + 18 * k + 10 * k - 2 / scale, scale), snap(py + ph / 2 + 6.5 * k - t.ascent, scale), C.pillText, a * op, {x:px, y:py, w:pw, h:ph, r:ph / 2}));
      }
    }
  }
  // A banner: the screen share or the bad connection. In the layout's banner rect when it has one.
  if (ch.banner && !bannerRect) out.push(...bannerQuads(ch.banner, {x:cell.x + 12 * k0, y:cell.y + (ch.toast ? 66 : 14) * k, w:null, h:40 * k}, atlas, {scale, k, clip, op, legible}));
  return out;
}

export function bannerQuads(text, rect, atlas, {scale = 1, k = 1, clip = null, op = 1, legible = NONE} = {}) {
  const out = [], poor = /connection|unstable|poor/i.test(text);
  const h = Math.max(rect.h, legible.name / .58), px = Math.max(h * .45, legible.name), isz = h * .46, padX = h * .38, gap = h * .3;
  const t = atlas.text(text, {px, weight:400}), ic = atlas.icon(poor ? 'wifiOff' : 'screenShare', isz, 2);
  if (!t) return out;
  const content = isz + gap + t.advance;
  const w = rect.w ?? Math.min(clip ? clip.x + clip.w - rect.x - 12 * k : 1e9, content + 2 * padX);
  const box = {x:rect.x, y:rect.y, w, h, r:Math.min(10 * k, h / 2)};
  out.push({x:box.x, y:box.y, w, h, color:[...C.pill, .92 * op], radius:box.r, mode:'fill', clip:clip ?? box});
  const ix = rect.w ? box.x + (w - content) / 2 : box.x + padX;
  out.push(glyph(ic, snap(ix, scale), snap(box.y + (h - ic.h) / 2, scale), poor ? C.signal : C.blue, op, box));
  out.push(glyph(t, snap(ix + isz + gap - 2 / scale, scale), snap(box.y + h / 2 + .35 * px - t.ascent, scale), C.pillText, op, box));
  return out;
}

// Pack quads into the instance buffer layout of CHROME_VS (20 floats each).
export function packQuads(quads, out = new Float32Array(Math.max(64, quads.length) * 20)) {
  if (out.length < quads.length * 20) out = new Float32Array(quads.length * 20 * 2);
  let o = 0;
  for (const q of quads) {
    const [r, g, b, a] = q.color, clip = q.clip ?? {x:-1e5, y:-1e5, w:2e5, h:2e5, r:0};
    out[o++] = q.x; out[o++] = q.y; out[o++] = q.w; out[o++] = q.h;
    out[o++] = r * a; out[o++] = g * a; out[o++] = b * a; out[o++] = a;
    if (q.uv) { out[o++] = q.uv.u0; out[o++] = q.uv.v0; out[o++] = q.uv.u1; out[o++] = q.uv.v1; } else { out[o++] = -1; out[o++] = -1; out[o++] = -1; out[o++] = -1; }
    out[o++] = clip.x; out[o++] = clip.y; out[o++] = clip.w; out[o++] = clip.h;
    out[o++] = q.radius ?? 0; out[o++] = q.mode === 'glyph' ? 1 : q.mode === 'stroke' ? 2 : 0; out[o++] = q.stroke ?? 0; out[o++] = clip.r ?? 0;
  }
  return {data:out, count:quads.length};
}
