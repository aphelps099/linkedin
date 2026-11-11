// SYNERGY.EXE screen plumbing: canvas fit, the main pen, meters, toasts,
// reaction particles, cards and the save file.

import { G, $, reduce, pad2 } from './state.js';
import { makePen, C, ICONS, ICON_KEYS, measure } from './art.js';

const cv = $('c'), view = $('view'), screen = $('screen'), root = document.documentElement;
export const ctx = cv.getContext('2d', { alpha:false });
export const pen = makePen(ctx);

// Integer device pixels per unit, as large as fits. The screen element takes the canvas's exact
// size, so the DOM overlays always line up with it.
const MIN_H = 180, MAX_H = 330;
export function fit() {
  const dpr = Math.min(4, window.devicePixelRatio || 1), r = view.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return;
  const S = Math.max(1, Math.min(Math.floor(r.width * dpr / G.W), Math.floor(r.height * dpr / MIN_H)));
  const H = Math.max(120, Math.min(MAX_H, Math.floor(r.height * dpr / S)));
  if (S === G.S && H === G.H && cv.width === G.W * S && cv.height === H * S) return;
  G.S = S; G.H = H; G.u = S / dpr; G.layout++;
  cv.width = G.W * S; cv.height = H * S;
  screen.style.width = (G.W * S / dpr) + 'px'; screen.style.height = (H * S / dpr) + 'px';
  root.style.setProperty('--u', G.u + 'px');
  root.style.setProperty('--l1', 8 * Math.max(1, Math.round(G.u / 2.6)) + 'px');
  root.style.setProperty('--l2', 8 * Math.max(1, Math.round(G.u / 1.4)) + 'px');
}
export const unitsOf = el => Math.ceil(el.offsetHeight / G.u);
export const begin = () => { ctx.setTransform(G.S, 0, 0, G.S, 0, 0); ctx.imageSmoothingEnabled = false; };

/* ---------- meters ---------- */
export function hud() {
  const r = G.run; if (!r) return;
  $('hw').textContent = pad2(r.collected.length); $('hf').textContent = pad2(r.facts); $('hr').textContent = r.reactions.toLocaleString('en-US');
}
export function tray() {
  const r = G.run, el = $('tray'); el.textContent = '';
  if (!r) return;
  for (const w of r.collected) { const i = document.createElement('i'); i.textContent = w; el.appendChild(i); }
  if (r.lost) { const i = document.createElement('i'); i.className = 'gone'; i.textContent = r.lost; i.title = 'Kevin took credit'; el.appendChild(i); }
}
// toast() speaks now and drops anything waiting; hint() waits its turn.
const waiting = [];
export const toast = (msg, t = 1.7) => { waiting.length = 0; G.toast = { msg, t }; };
export const hint = (msg, t = 2.6) => { if (G.toast) waiting.push({ msg, t }); else G.toast = { msg, t }; };
export function drawToast(dt) {
  const q = G.toast; if (!q) return;
  q.t -= dt;
  pen.chip(q.msg, G.W / 2, 22, C.signal, C.signal);
  if (q.t <= 0) G.toast = waiting.shift() || null;
}

/* ---------- reactions and sparks ---------- */
// world:true particles live in floor coordinates and scroll with the camera.
export function burst(x, y, n, wide = 30, world = false) {
  if (reduce) n = Math.min(n, 4);
  for (let i = 0; i < n; i++) G.parts.push({ x:x + (Math.random() - .5) * wide, y:y - Math.random() * 6, vy:-(18 + Math.random() * 26),
    vx:(Math.random() - .5) * 10, life:1.4 + Math.random() * .8, icon:ICON_KEYS[(Math.random() * 6) | 0], hot:Math.random() < .25, delay:i * .05, world });
}
export function sparks(x, y, n = 8, world = true) {
  if (reduce) n = Math.min(n, 3);
  for (let i = 0; i < n; i++) G.parts.push({ x, y, vx:(Math.random() - .5) * 60, vy:-Math.random() * 50, life:.5, sq:true, world });
}
export function drawParts(dt, cx = 0, cy = 0) {
  const P = G.parts;
  for (let i = P.length - 1; i >= 0; i--) { const q = P[i];
    if (q.delay > 0) { q.delay -= dt; continue; }
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.sq) q.vy += 160 * dt;
    if (q.life <= 0) { P.splice(i, 1); continue; }
    const x = q.world ? q.x - cx : q.x, y = q.world ? q.y - cy : q.y;
    if (q.sq) pen.R(x, y, 2, 2, i % 2 ? C.signal : C.cobalt); else pen.bmp(ICONS[q.icon], q.hot ? C.hot : C.cobalt, x - 5, y - 5); }
}

/* ---------- cards ---------- */
export function showCard({ h, p, sig = '', go, alt = '', more = '', keys = '' }) {
  $('cH').textContent = h; $('cP').textContent = p; $('cS').textContent = sig; $('cGo').textContent = go;
  $('cAlt').textContent = alt; $('cAlt').hidden = !alt; $('cMore').textContent = more; $('cMore').hidden = !more;
  $('cK').innerHTML = keys; $('card').hidden = false;
}
export const hideCard = () => { $('card').hidden = true; };

/* ---------- save file ---------- */
const KEY = 'synergy.exe/2';
export function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
export function save(patch) {
  const s = Object.assign(load(), patch);
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: play on without a save */ }
  return s;
}

export { C, measure };
