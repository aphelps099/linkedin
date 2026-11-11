// SYNERGY.EXE floors: everything that moves while Synergy climbs. Lights are
// off out here. The only lit places are the rooms where a meeting is running.

import { G, reduce, clamp, buzz } from './state.js';
import { FLOORS, parseFloor, T, SOLID, ONEWAY, BALL, tileAt, patrolRange } from './level.js';
import { step, newBody, DT, EV, HW, HH } from './physics.js';
import { C, SP, frame, PERSON, PERSON_FLAT, KEV, BOSS, BOSS_PAL, MUG, MUG_PAL, MAIL, NOTE, PEG5, measure, makePen } from './art.js';
import { pen, toast, hint, burst, sparks, hud, tray } from './ui.js';
import { Score } from './score.js';

let F = null;
export const floor = () => F;

const BOSS_LINES = ['OPTIMIZE THE ONBOARDING.', 'LET’S ALIGN.', 'QUICK WIN?', 'BIG IF TRUE.', 'LOVE THE ENERGY.'];
const PRINTER_LINES = ['PRINTING: ONBOARDING.PDF', 'PAGE 1 OF 214. LOADING.', 'PRINTER: PLEASE ADVISE.'];

/* ---------- arrive ---------- */
export function enterFloor(i) {
  const def = FLOORS[i], run = G.run;
  F = parseFloor(def);
  F.i = i; F.px = F.w * T; F.py = F.h * T;
  F.words = F.words.filter(w => !run.collected.includes(w.word) && run.lost !== w.word);
  F.words.forEach(w => { w.ww = measure(w.word) + 8; });
  if (run.mugs.includes(def.id)) F.mugs = [];
  F.chairs = F.chairs.map(c => ({ ...c, dir:-1, ...patrolRange(F, c.x + 4, c.y, 5) }));
  F.kevins = F.kevins.map(k => ({ ...k, dir:1, state:'walk', t:0, holds:null, cool:2.5, said:0, ...patrolRange(F, k.x, k.y, 9) }));
  F.inboxes.forEach(b => { b.t = 1.4; });
  F.shots = [];
  F.zones = (def.zones || []).map(z => ({ x0:z.x * T, y0:z.y * T, x1:(z.x + z.w) * T, y1:(z.y + z.h) * T, name:z.name, phase:'idle', t:0, inside:false, entry:null, calls:0, done:false }));
  F.screens = (def.decor || []).filter(d => d.k === 'screen').map(d => ({ x:d.x * T, y:d.y * T, zone:F.zones[d.zone] }));
  F.revealed = false; F.printed = 0; F.atPrinter = false; F.squish = 0; F.nag = 0; F.atDesk = 0; F.deskTold = false;
  F.bossDone = !def.boss || !!run.posted[def.id];
  // He charges all the way to the wall, clear of the platforms, so you can drop on him from their ends.
  F.boss = def.boss && !F.bossDone ? { x:F.boss.x, y:F.boss.y, dir:-1, state:'intro', t:2.4, hp:3, n:0, min:20, max:F.px - 20, line:'MY DOOR IS ALWAYS OPEN.' } : null;
  if (F.bossDone) F.words.forEach(w => { w.hidden = false; });
  F.p = Object.assign(newBody(F.spawn.x, F.spawn.y), { stun:0, safe:0, knock:0, idle:0 });
  F.safe = { x:F.spawn.x, y:F.spawn.y };
  F.freeze = null; F.cam = { x:0, y:0 };
  camera(0, true); bake();
  G.parts.length = 0; G.keys.left = G.keys.right = G.keys.jump = false;
  Score.watch(false); Score.duck(false); Score.setLevel(def.boss && !F.bossDone ? 5 : def.music + (run.collected.length >= 7 ? 1 : 0));
}

/* ---------- one step ---------- */
const within = (p, x0, y0, x1, y1) => p.x + HW > x0 && p.x - HW < x1 && p.y > y0 && p.y - HH < y1;

function bump(away, msg, sound = 'bump', stun = .45) {
  const p = F.p; if (p.safe > 0) return false;
  p.stun = stun; p.knock = away; p.vx = away * 95; p.vy = -120; p.ground = false; p.sprung = true; p.safe = stun + .8;
  G.run.bumps++; G.shake = .2; Score.accent(sound); toast(msg); buzz(30);
  return true;
}

function grab(w) {
  const run = G.run;
  F.words.splice(F.words.indexOf(w), 1); run.collected.push(w.word); hud(); tray();
  Score.accent('word', run.collected.length, w.word); toast('+1 WORD'); sparks(w.x, w.y);
  if (!F.boss) Score.setLevel(F.def.music + (run.collected.length >= 7 ? 1 : 0));
}

export function stepWorld() {
  const p = F.p, run = G.run, dt = DT, k = G.keys;
  run.time += dt;
  if (F.squish > 0) F.squish -= dt;
  if (F.nag > 0) F.nag -= dt;

  if (F.freeze) {                               // called on: the room waits
    F.freeze.t -= dt;
    if (F.freeze.t <= 0) { const done = F.freeze.done; F.freeze = null; done(); }
    camera(dt); return;
  }

  if (p.stun > 0) p.stun -= dt;
  if (p.safe > 0) p.safe -= dt;
  const free = p.stun <= 0;
  const input = { dir:free ? (k.right ? 1 : 0) - (k.left ? 1 : 0) : p.knock, jump:free && k.jump };
  const ev = step(p, input, F);
  if (ev & EV.JUMP) Score.accent('jump');
  if (ev & EV.BOUNCE) { Score.accent('bounce'); F.squish = .22; }
  if (ev & EV.BONK) Score.accent('bonk');
  p.idle = input.dir || !p.ground ? 0 : p.idle + dt;

  // things to pick up
  for (const w of F.words) if (!w.hidden && within(p, w.x - w.ww / 2, w.y - 5, w.x + w.ww / 2, w.y + 6)) { grab(w); break; }
  for (const m of F.mugs) if (within(p, m.x - 4, m.y - 8, m.x + 4, m.y)) {
    F.mugs.splice(F.mugs.indexOf(m), 1); run.mugs.push(F.def.id);
    Score.accent('mug'); toast(`MUG ${run.mugs.length} OF 3`); sparks(m.x, m.y - 4, 12); break;
  }
  if (!F.revealed) for (const s of F.illusions) if (within(p, s.cx * T, s.cy * T, s.cx * T + T, s.cy * T + T)) {
    F.revealed = true; bake(); Score.accent('secret'); toast('SECRET: ' + F.def.secret.toUpperCase()); break;
  }
  if (F.printer) {
    const at = within(p, F.printer.x - 2, F.printer.y - 12, F.printer.x + 12, F.printer.y);
    if (at && !F.atPrinter) { Score.accent('printer'); if (!F.printed) Score.voice('loading', .2); toast(PRINTER_LINES[Math.min(2, F.printed++)]);
      G.parts.push({ x:F.printer.x + 5, y:F.printer.y - 10, vx:14, vy:-30, life:.9, sq:true, world:true }); }
    F.atPrinter = at;
  }

  // things in the way
  for (const c of F.chairs) {
    c.x += c.dir * 26 * dt;
    if (c.x < c.min) { c.x = c.min; c.dir = 1; } else if (c.x > c.max - 9) { c.x = c.max - 9; c.dir = -1; }
    // A narrow box, so a hop straight up clears a chair: the way out when a meeting says hold still.
    if (within(p, c.x + 1.5, c.y - 11, c.x + 7.5, c.y)) bump(p.x < c.x + 4.5 ? -1 : 1, 'OBSTACLE: CHAIR');
  }
  for (const kv of F.kevins) stepKevin(kv, dt);
  for (const b of F.inboxes) { b.t -= dt; if (b.t <= 0) { b.t = 2.6; F.shots.push({ kind:'mail', x:b.x + 9, y:b.y - 9, vx:70 * b.dir, vy:0, g:0, life:2.4 }); if (Math.abs(p.y - b.y) < 60 && Math.abs(p.x - b.x) < 150) Score.accent('mail'); } }
  for (let i = F.shots.length - 1; i >= 0; i--) {
    const s = F.shots[i]; s.life -= dt; s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    const solid = tileAt(F, Math.floor(s.x / T), Math.floor(s.y / T));
    if (s.life <= 0 || solid === SOLID || (s.g && s.vy > 0 && solid === ONEWAY)) { if (s.kind === 'note') sparks(s.x, s.y, 4); F.shots.splice(i, 1); continue; }
    if (within(p, s.x - 3, s.y - 3, s.x + 3, s.y + 3) && bump(s.vx > 0 ? 1 : -1, s.kind === 'mail' ? 'PER MY LAST EMAIL' : 'ACTION ITEM: ASSIGNED', s.kind === 'mail' ? 'mail' : 'note', .35)) F.shots.splice(i, 1);
  }
  if (F.boss) stepBoss(F.boss, dt);

  // meetings in progress
  let inZone = false;
  for (const z of F.zones) {
    const inside = p.x > z.x0 && p.x < z.x1 && p.y > z.y0 && p.y <= z.y1 + 1;
    if (z.done) { z.inside = inside; continue; }                                    // adjourned: just a room now
    if (inside && !z.inside) { z.entry = { ...F.safe }; z.phase = 'closed'; z.t = .8;   // the first look comes soon: nobody sprints through a meeting
      if (!F.zoneTold) { F.zoneTold = true; hint('HOLD STILL WHEN THE HOST LOOKS', 3); } }
    if (!inside && z.inside) { z.phase = 'idle'; Score.watch(false); }
    z.inside = inside;
    if (!inside) continue;
    inZone = true; z.t -= dt;
    if (z.t <= 0) {
      if (z.phase === 'closed') { z.phase = 'warn'; z.t = .9; Score.accent('warn'); }
      else if (z.phase === 'warn') { z.phase = 'watch'; z.t = 1.3; Score.watch(true); }
      else { z.phase = 'closed'; z.t = 1.9; Score.watch(false); }
    }
    // Looked at, on the floor, and moving: called on. A jump already in the air is allowed to land,
    // and being knocked about by a chair does not count as volunteering.
    if (z.phase === 'watch' && z.t < 1.08 && p.ground && Math.abs(p.vx) > 14 && p.stun <= 0 && p.safe <= 0) calledOn(z);
  }
  if (p.ground && !inZone && p.stun <= 0) { F.safe.x = p.x; F.safe.y = p.y; }

  // the desk and the lift
  const d = F.desk, l = F.lift, posted = run.posted[F.def.id];
  // Posting takes intent: stop at the desk. Running past it does nothing, so the floor can still be explored.
  if (d && p.ground && !posted && F.bossDone && within(p, d.x + 4, d.y - 12, d.x + d.w - 4, d.y + 1)) {
    if (Math.abs(p.vx) < 6) { F.atDesk += dt; if (F.atDesk > .3) { G.go('post', { desk:F.def.boss ? 2 : 1 }); return; } }
    else { F.atDesk = 0; if (!F.deskTold) { F.deskTold = true; hint('STOP AT THE DESK TO POST'); } }
  } else F.atDesk = 0;
  if (l && p.ground && p.stun <= 0 && within(p, l.x + 3, l.y - 12, l.x + l.w - 3, l.y + 1)) {
    if (F.def.lift === 'post' && !posted) { if (F.nag <= 0) { F.nag = 2.2; toast(F.bossDone ? 'POST FIRST. THEN THE LIFT.' : 'LIFT LOCKED. ASK THE VP.'); Score.accent('bonk'); } }
    else { G.go('lift', {}); return; }
  }
  camera(dt);
}

// Called on. The call rings, Synergy is pulled in front of the screen, and the scene cuts to the
// meeting from the inside (scenes.js), where he is asked to share. A share that lands adjourns this
// room's meeting for good and he walks on from where he stands. The fact, or silence, sends him back
// to the door he came in by, taking notes. Either way a meeting can always be ended with a good answer.
function calledOn(z) {
  const p = F.p, scr = F.screens.find(s => s.zone === z);
  G.run.bumps++; buzz([40, 70, 40]); Score.accent('ring'); Score.watch(false); G.toast = null;
  if (scr) { sparks(p.x, p.y - 10, 8); p.x = scr.x + 28; p.y = z.y1; p.face = 1; sparks(p.x, p.y - 10, 8); }
  p.vx = p.vy = 0; p.ground = true;
  F.freeze = { t:1.05, kind:'ring', done() {
    G.go('call', { first:z.calls++ === 0, back(escaped) {
      p.vx = p.vy = 0; p.ground = true; p.stun = 0; p.safe = 1; z.phase = 'idle'; z.inside = false; G.keys.left = G.keys.right = false; G.fade = .8;
      if (escaped) { z.done = true; z.phase = 'off'; Score.accent('ding'); G.go('play', { say:'MEETING ADJOURNED. WALK ON.' }); }
      else { p.x = z.entry.x; p.y = z.entry.y; G.go('play', { say:'VOLUNTEERED: TAKING NOTES' }); }
      camera(0, true);
    } });
  } };
}

/* ---------- Kevin, who takes credit ---------- */
function stepKevin(k, dt) {
  const p = F.p, run = G.run;
  k.cool -= dt; k.said -= dt;
  if (k.state === 'flat') { k.t -= dt; if (k.t <= 0) k.state = 'walk'; return; }
  const dx = p.x - k.x, near = Math.abs(p.y - k.y) < 22 && Math.abs(dx) < 62;
  let speed = 24;
  if (k.holds) { speed = 60; if (near) k.dir = dx > 0 ? -1 : 1; k.state = 'flee'; }
  else if (near && run.collected.length && k.cool <= 0) { speed = 46; k.dir = dx > 0 ? 1 : -1;
    if (k.state !== 'chase' && k.said <= 0) { toast('KEVIN: QUICK QUESTION'); k.said = 6; } k.state = 'chase'; }
  else k.state = 'walk';
  k.x += k.dir * speed * dt;
  if (k.x < k.min + 5) { k.x = k.min + 5; k.dir = 1; } else if (k.x > k.max - 5) { k.x = k.max - 5; k.dir = -1; }

  if (Math.abs(p.x - k.x) < 9 && p.y > k.y - 20 && p.y - HH < k.y) {
    if (!p.ground && p.vy > 0 && p.y < k.y - 9) {           // landed on his head
      p.vy = -175; p.sprung = true; p.cut = false; k.state = 'flat'; k.t = 1.5; Score.accent('bop'); buzz(20);
      if (k.holds) { run.collected.push(k.holds); run.lost = null; k.holds = null; k.cool = 9; hud(); tray(); Score.accent('reclaim'); toast('CREDIT RECLAIMED'); burst(k.x, k.y - 22, 5, 20, true); }
      else { k.cool = Math.max(k.cool, 5); toast('KEVIN: OW. NOTED.'); }
    } else if (!k.holds && run.collected.length && k.cool <= 0 && p.stun <= 0 && p.safe <= 0) {
      k.holds = run.collected.pop(); run.lost = k.holds; hud(); tray();
      bump(dx > 0 ? 1 : -1, 'KEVIN TOOK CREDIT: ' + k.holds, 'steal', .3); k.dir = dx > 0 ? -1 : 1;
      if (!F.taught) { F.taught = true; hint('LAND ON KEVIN TO TAKE IT BACK'); }
    }
  }
}

/* ---------- the VP of Reactions ---------- */
function stepBoss(b, dt) {
  const p = F.p, run = G.run, face = () => { b.dir = p.x < b.x ? -1 : 1; };
  b.t -= dt;
  const to = (state, t, line = '') => { b.state = state; b.t = t; b.line = line; };
  if (b.state === 'intro') { if (b.t <= 0) { to('idle', 1.6, BOSS_LINES[0]); Score.voice('onboarding', .05); } }
  else if (b.state === 'idle') { face(); if (b.t <= 0) { to('throw', 1.5, 'ACTION ITEMS.'); b.n = 3; b.next = .15; } }
  else if (b.state === 'throw') {
    face(); b.next -= dt;
    if (b.n > 0 && b.next <= 0) { b.n--; b.next = .45;
      F.shots.push({ kind:'note', x:b.x + b.dir * 8, y:b.y - 26, vx:clamp((p.x - b.x) / .95, -120, 120), vy:-150 - Math.random() * 30, g:420, life:3 }); Score.accent('note'); }
    if (b.t <= 0) { to('windup', .9, 'CIRCLING BACK.'); Score.accent('charge'); }
  }
  else if (b.state === 'windup') { face(); if (b.t <= 0) to('charge', 9); }
  else if (b.state === 'charge') {
    b.x += b.dir * 132 * dt;
    if (b.x <= b.min || b.x >= b.max) { b.x = clamp(b.x, b.min, b.max); to('dazed', 2.6, 'OUT OF OFFICE'); G.shake = .35; Score.accent('daze'); buzz(40);
      if (b.hp === 3 && !b.told) { b.told = true; toast('HE IS OUT OF OFFICE. LAND ON HIM.', 2.4); } }
  }
  else if (b.state === 'dazed') { if (b.t <= 0) to('idle', 1.2, BOSS_LINES[1 + ((Math.random() * (BOSS_LINES.length - 1)) | 0)]); }
  else if (b.state === 'hurt') { if (b.t <= 0) { if (b.hp > 0) to('idle', .9, 'NOTED.'); else to('leave', 2.6, 'LET’S TAKE THIS OFFLINE.'); } }
  else if (b.state === 'leave') {
    if (b.t <= 0) { F.boss = null; F.bossDone = true; Score.setLevel(F.def.music + 1); Score.accent('promote'); toast('DESK UNLOCKED. POST.'); burst(b.x, b.y - 20, 16, 40, true); }
    return;
  }

  const h = b.state === 'dazed' ? 24 : 32;
  if (b.state === 'intro' || b.state === 'hurt' || !within(p, b.x - 11, b.y - h, b.x + 11, b.y)) return;
  if (b.state === 'dazed') {
    if (!p.ground && p.vy > 0 && p.y < b.y - h + 12) {
      b.hp--; p.vy = -190; p.sprung = true; p.cut = false; b.state = 'hurt'; b.t = 1; b.line = '';
      run.reactions += 250; hud(); Score.accent('bosshit'); G.shake = .3; buzz(50); burst(b.x, b.y - 30, 12, 40, true);
      const w = F.words.find(x => x.hidden); if (w) { w.hidden = false; sparks(w.x, w.y, 10); toast('NEW PHRASE: ' + w.word); }
    }
    return;
  }
  bump(p.x < b.x ? -1 : 1, b.state === 'charge' ? 'CIRCLED BACK ON' : 'TOO CLOSE TO LEADERSHIP', 'bump', .5);
}

/* ---------- camera ---------- */
function camera(dt, snap) {
  const p = F.p, W = G.W, H = G.H, c = F.cam;
  const tx = clamp(p.x + p.face * 14 - W / 2, 0, Math.max(0, F.px - W));
  const ty = F.py <= H ? F.py - H : clamp(p.y - H * .6, 0, F.py - H);
  if (snap) { c.x = tx; c.y = ty; } else { c.x += (tx - c.x) * Math.min(1, dt * 4); c.y += (ty - c.y) * Math.min(1, dt * 7); }
}
export const recenter = () => F && camera(0, true);

/* ---------- the still parts, drawn once ---------- */
const litAt = (x, y) => F.zones.some(z => x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1);

const DECOR = {
  coffee(b, x, y) { b.wire(x, y - 46, 22, 24, C.dim); b.wire(x + 5, y - 32, 12, 8, C.dim); b.R(x, y - 22, 22, 22, C.deep); b.wire(x, y - 22, 22, 22, C.faint);
    b.R(x + 13, y - 41, 7, 9, C.signal); b.R(x + 16, y - 39, 1, 4, C.ink); b.R(x + 16, y - 34, 1, 1, C.ink); },
  cooler(b, x, y) { b.wire(x + 2, y - 34, 8, 12, C.dim); b.wire(x, y - 22, 12, 22, C.faint); b.R(x + 4, y - 14, 4, 3, C.faint); },
  cubicle(b, x, y) { b.wire(x, y - 18, 30, 18, C.faint); b.wire(x + 8, y - 28, 14, 9, C.faint); b.R(x + 14, y - 19, 2, 1, C.faint); },
  plant(b, x, y, d) { const c = d.lit ? C.ink : C.dim, c2 = d.lit ? '#4b5a3c' : C.faint;
    b.R(x + 2, y - 6, 6, 6, c); b.R(x + 4, y - 16, 1, 10, c2); b.R(x + 2, y - 13, 2, 1, c2); b.R(x + 5, y - 11, 3, 1, c2); b.R(x + 1, y - 17, 3, 2, c2); b.R(x + 5, y - 19, 3, 2, c2); },
  window(b, x, y, d) { const w = d.w * T, h = d.h * T; b.wire(x, y, w, h, C.faint); b.R(x + (w >> 1), y, 1, h, C.faint);
    for (let i = 3, n = 0; i < w - 6; i += 9, n++) { const t = 6 + ((n * 37 + d.x * 11) % (h - 12)); b.R(x + i, y + h - 1 - t, 6, t, C.deep); b.R(x + i + 2, y + h - t + 1, 1, 1, C.faint); b.R(x + i + 4, y + h - t + 4, 1, 1, C.faint); } },
  poster(b, x, y, d) { const w = Math.max(...d.t.map(s => measure(s))) + 10, h = d.t.length * 8 + 8; b.wire(x, y, w, h, C.faint);
    d.t.forEach((s, i) => b.text(s, x + w / 2, y + 5 + i * 8, C.dim, { align:'center' })); b.R(x + 5, y + h - 3, 10, 1, C.signal); },
  lamp(b, x, y) { b.R(x, y, 18, 2, C.dim); b.R(x + 2, y + 2, 14, 1, C.faint); for (let i = 0; i < 5; i++) b.R(x + 8 - i * 2 + (i % 2), y + 5 + i * 4, 1, 1, C.faint); },
  clock(b, x, y) { b.wire(x, y, 11, 11, C.faint); b.R(x + 5, y + 2, 1, 4, C.dim); b.R(x + 5, y + 5, 3, 1, C.dim); },
  screen() {},
};

// Wallpaper: one quiet motif per floor, tiled across the whole wall behind everything.
const WALLS = {
  none() {},
  cubicles(b) { const c = '#070f2a';       // partition after partition
    for (let y = 6; y < F.py; y += 40) for (let x = ((y / 40) % 2 ? -10 : 14); x < F.px; x += 48) { b.wire(x, y + 14, 40, 22, c); b.R(x + 13, y + 6, 14, 8, c); b.R(x + 19, y + 14, 2, 3, c); } },
  glass(b) { const c = '#070f2a';          // a window wall with the blinds down
    for (let x = 4; x < F.px; x += 56) { b.wire(x, 0, 50, F.py, c); for (let y = 6; y < F.py; y += 5) b.R(x + 3, y, 44, 1, c); } },
  panels(b) { const c = '#08112e';         // wood panelling, floor to ceiling
    for (let x = 6; x < F.px; x += 30) for (let y = 10; y < F.py; y += 76) { b.wire(x, y, 24, 66, c); b.wire(x + 4, y + 4, 16, 58, c); } },
};

function bake() {
  const cv = F.bake || (F.bake = document.createElement('canvas')), def = F.def;
  cv.width = F.px; cv.height = F.py;
  const b = makePen(cv.getContext('2d')), { R, text } = b;
  R(0, 0, F.px, F.py, C.void);
  (WALLS[def.wall] || WALLS.none)(b);
  for (let y = 4; y < F.py; y += 8) for (let x = 4; x < F.px; x += 8) R(x, y, 1, 1, '#0a1533');
  if (def.mark) text(def.no, def.mark.x * T, def.mark.y * T, '#0a1a45', { font:PEG5, k:def.mark.k });   // the floor number, wall-sized

  for (const z of F.zones) {                    // lit rooms
    const w = z.x1 - z.x0, h = z.y1 - z.y0;
    R(z.x0, z.y0, w, h, C.wall); R(z.x0, z.y1 - 5, w, 5, C.wall2);
    for (let x = z.x0 + 14; x < z.x1 - 40; x += 62) { R(x, z.y0, 40, 3, C.ink); R(x + 2, z.y0 + 3, 36, 2, '#fff6cf'); }
    R(z.x0, z.y0, 2, h - 26, C.ink); R(z.x1 - 2, z.y0, 2, h - 26, C.ink); R(z.x0, z.y0, w, 1, C.ink);
    text(z.name.toUpperCase(), z.x0 + 6, z.y0 + 9, C.tan);
  }
  for (const d of def.decor || []) (DECOR[d.k] || DECOR.screen)(b, d.x * T, d.y * T, d);

  const solid = (cx, cy) => tileAt(F, cx, cy) === SOLID || (!F.revealed && F.illusions.some(s => s.cx === cx && s.cy === cy));
  for (let cy = 0; cy < F.h; cy++) for (let cx = 0; cx < F.w; cx++) {
    const k = tileAt(F, cx, cy), x = cx * T, y = cy * T, lit = litAt(x + 4, y + 4), under = litAt(x + 4, y - 4);
    if (solid(cx, cy)) {
      if (under) { R(x, y, T, T, C.carpet); R(x + (cx % 2 ? 1 : 4), y + 4, 3, 1, C.carpet2); R(x, y, T, 1, C.ink); continue; }
      R(x, y, T, T, '#050b20');
      if (!solid(cx, cy - 1)) { R(x, y, T, 1, C.cobalt); for (let i = 0; i < T; i += 2) { R(x + i, y + 2, 1, 1, C.cobalt); R(x + i + 1, y + 4, 1, 1, C.dim); } }
      else R(x + 4, y + 4, 1, 1, '#0d1a40');
      if (!solid(cx - 1, cy)) R(x, y, 1, T, C.dim);
      if (!solid(cx + 1, cy)) R(x + T - 1, y, 1, T, C.dim);
      if (!solid(cx, cy + 1)) R(x, y + T - 1, T, 1, C.dim);
    } else if (k === ONEWAY) {
      if (lit) { R(x, y, T, 1, C.ink); R(x, y + 1, T, 2, C.wood2); }
      else { R(x, y, T, 1, C.cobalt); for (let i = 0; i < T; i += 2) { R(x + i, y + 2, 1, 1, C.cobalt); R(x + i + 1, y + 4, 1, 1, C.dim); } }
    }
  }
  if (F.revealed) for (const s of F.illusions) for (let i = 0; i < T; i += 4) R(s.cx * T + i + (s.cy % 2 ? 2 : 0), s.cy * T + 3, 1, 1, C.dim);
  for (const s of def.signs || []) text(s.t, s.x * T, s.y * T, C.dim);
}

/* ---------- draw ---------- */
export function drawWorld() {
  const { R, wire, bmp, mosaic, text, ticks, chip } = pen, p = F.p, W = G.W, H = G.H, t = G.t, run = G.run;
  const sh = G.shake > 0 && !reduce ? Math.round(Math.sin(t * 90) * 2 * Math.min(1, G.shake * 4)) : 0;
  const cx = Math.round(F.cam.x) + sh, cy = Math.round(F.cam.y);
  R(0, 0, W, H, C.void);
  if (cy < 0 || cx < 0 || cx + W > F.px) for (let y = 4 - (((cy % 8) + 8) % 8); y < H; y += 8) for (let x = 4 - (((cx % 8) + 8) % 8); x < W; x += 8) R(x, y, 1, 1, '#0a1533');
  const sx = Math.max(0, cx), sy = Math.max(0, cy), ex = Math.min(F.px, cx + W), ey = Math.min(F.py, cy + H);
  if (ex > sx && ey > sy) pen.ctx.drawImage(F.bake, sx, sy, ex - sx, ey - sy, sx - cx, sy - cy, ex - sx, ey - sy);
  const X = x => Math.round(x) - cx, Y = y => Math.round(y) - cy;
  const seen = (x, y, m = 40) => x - cx > -m && x - cx < W + m && y - cy > -m && y - cy < H + m;

  // the call on the wall: the host, six of the forty-seven, and a camera that is on
  for (const s of F.screens) {
    if (!seen(s.x, s.y, 70)) continue;
    const x = X(s.x), y = Y(s.y), z = s.zone, ph = z.phase, look = ph === 'watch', ring = !!F.freeze && (t * 10 | 0) % 2, hot = look || ring || (ph === 'warn' && (t * 8 | 0) % 2);
    R(x, y, 56, 34, C.ink);
    if (z.done) { pen.camera(x + 3, y + 2, '#39446e'); R(x + 2, y + 10, 52, 22, '#10182f'); text('MEETING', x + 28, y + 14, '#55608a', { align:'center' }); text('ENDED', x + 28, y + 22, '#55608a', { align:'center' }); continue; }
    pen.camera(x + 3, y + 2, hot ? C.signal : '#7fa8ff'); R(x + 15, y + 4, 2, 2, look ? C.signal : C.led); text('47', x + 53, y + 3, '#8794b8', { align:'right' });
    R(x + 2, y + 10, 18, 22, hot ? C.signal : '#2c3558'); R(x + 3, y + 11, 16, 20, '#39446e');
    R(x + 7, y + 15, 8, 9, LIN_SKIN); R(x + 6, y + 13, 10, 3, '#2a2f45'); R(x + 5, y + 25, 12, 6, '#5d6788');
    if (look || ring) { const e = p.x < s.x + 11 ? 0 : 1; R(x + 8, y + 18, 2, 2, C.white); R(x + 12, y + 18, 2, 2, C.white); R(x + 8 + e, y + 18, 1, 2, C.ink); R(x + 12 + e, y + 18, 1, 2, C.ink); }
    else { R(x + 8, y + 19, 2, 1, C.ink); R(x + 12, y + 19, 2, 1, C.ink); }
    for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) { const ax = x + 22 + i * 8, ay = y + 10 + j * 11, n = i + j * 4;
      R(ax, ay, 7, 10, '#2c3558'); R(ax + 2, ay + 2, 3, 3, FACES[n]); R(ax + 1, ay + 6, 5, 4, n % 3 ? '#55608a' : '#6f7aa3'); }
    if (ph === 'warn') text('?', x + 28, y - 9, C.signal, { font:PEG5, align:'center' });
  }

  // lift and desk
  const l = F.lift, d = F.desk, posted = run.posted[F.def.id];
  if (l && seen(l.x, l.y)) {
    const x = X(l.x), y = Y(l.y), open = !(F.def.lift === 'post' && !posted), c = open ? C.cobalt : C.dim;
    wire(x, y - 26, 16, 26, c); R(x + 7, y - 25, 2, 25, c); R(x + 5, y - 31, 6, 3, open ? C.led : C.dim);
    if (open) { ticks(x + 8, y - 34, C.signal); text('LIFT', x + 8, y - 46, C.signal, { align:'center' }); }
  }
  if (d && seen(d.x, d.y)) {
    const x = X(d.x), y = Y(d.y), live = F.bossDone && !posted;
    wire(x, y - 13, 36, 13, C.dim); wire(x + 11, y - 23, 14, 9, live ? C.cobalt : C.dim); R(x + 13, y - 21, 10, 5, live && (t * 2 | 0) % 2 ? C.dim : C.faint);
    if (live) { ticks(x + 18, y - 27, C.signal); text('POST', x + 18, y - 39, C.signal, { align:'center' }); }
  }
  if (F.printer && seen(F.printer.x, F.printer.y)) {
    const x = X(F.printer.x), y = Y(F.printer.y);
    wire(x, y - 9, 12, 9, C.cobalt); R(x + 2, y - 12, 8, 3, C.dim); R(x + 3, y - 5, 6, 1, C.cream); R(x + 9, y - 7, 1, 1, (t * 3 | 0) % 2 ? C.signal : C.dim);
  }
  for (const b of F.balls) { const x = X(b.cx * T), y = Y(b.cy * T), s = F.squish > 0 ? 2 : 0;
    R(x + 1, y + 1 + s, 6, 7 - s, C.cobalt); R(x, y + 2 + s, 8, 5 - s, C.cobalt); R(x + 2, y + 2 + s, 2, 1, C.sky); }
  for (const b of F.inboxes) { const x = X(b.x), y = Y(b.y); wire(x, y - 8, 9, 8, C.cobalt); R(x + 2, y - 10, 5, 2, C.cream); text('IN', x + 1, y - 17, C.dim); }

  // phrases and mugs
  for (const w of F.words) {
    if (w.hidden || !seen(w.x, w.y)) continue;
    const bob = reduce ? 0 : Math.round(Math.sin(t * 3 + w.x) * 1.5), x = X(w.x), y = Y(w.y) - 5 + bob;
    chip(w.word, x, y, C.cream, C.cobalt); ticks(x, y - 2, C.signal);
  }
  for (const m of F.mugs) if (seen(m.x, m.y)) { bmp(MUG, MUG_PAL, X(m.x) - 3, Y(m.y) - 7); if ((t * 2 | 0) % 2) ticks(X(m.x), Y(m.y) - 9, C.signal); }

  // colleagues
  for (const c of F.chairs) { const x = X(c.x), y = Y(c.y); R(x + 1, y - 12, 7, 6, C.grey); R(x, y - 5, 9, 2, C.grey); R(x + 4, y - 3, 1, 2, C.head); R(x + 1, y - 1, 7, 1, C.head); }
  for (const k of F.kevins) {
    const x = X(k.x), y = Y(k.y);
    if (k.state === 'flat') bmp(PERSON_FLAT, KEV, x - 5, y - 6, k.dir < 0);
    else bmp(PERSON, KEV, x - 5, y - 20 + ((t * 8 | 0) % 2 && k.state !== 'walk' ? 1 : 0), k.dir < 0);
    if (k.holds) chip(k.holds, x, y - 34, C.signal, C.signal);
    else if (k.state === 'chase') text('?', x, y - 30, C.signal, { font:PEG5, align:'center' });
  }
  for (const s of F.shots) { if (s.kind === 'mail') bmp(MAIL, { w:C.cream, b:C.cobalt }, X(s.x) - 3, Y(s.y) - 2); else bmp(NOTE, { y:C.signal, k:C.ink }, X(s.x) - 2, Y(s.y) - 2); }

  const b = F.boss;
  if (b) {
    const x = X(b.x), y = Y(b.y), q = b.hp >= 3 ? 1 : b.hp === 2 ? 2 : 3, flip = b.dir > 0;
    const rows = b.state === 'dazed' ? BOSS.slice(0, 12) : BOSS, h = rows.length * 2;
    const jig = b.state === 'windup' && !reduce ? ((t * 30 | 0) % 2 ? 1 : -1) : 0;
    const gone = b.state === 'leave' ? Math.max(0, b.t / 2.6) : 1;
    if (!(b.state === 'hurt' && (t * 18 | 0) % 2)) {
      if (gone < 1) mosaic(rows, BOSS_PAL, x - 12, y - h, flip, 2, 2 + Math.round((1 - gone) * 5));
      else if (q > 1) mosaic(rows, BOSS_PAL, x - 12 + jig, y - h, flip, 2, q);
      else bmp(rows, BOSS_PAL, x - 12 + jig, y - h, flip, 2);
    }
    if (b.state === 'dazed') for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.1; R(x + Math.round(Math.cos(a) * 10), y - h - 5 + Math.round(Math.sin(a) * 2), 2, 2, C.signal); }
    if (b.line) chip(b.line, clamp(x, measure(b.line) / 2 + 6, W - measure(b.line) / 2 - 6), y - h - 18, b.state === 'dazed' ? C.led : C.cream, b.state === 'dazed' ? C.led : C.cobalt);
    for (let i = 0; i < 3; i++) R(W - 8 - i * 7, H - 9, 5, 5, i < b.hp ? C.signal : C.dim);
    text('VP', W - 8 - 21 - 12, H - 9, C.dim);
  }

  // Synergy
  const pose = !p.ground ? 'jump' : Math.abs(p.vx) > 6 ? ((t * 10 | 0) % 2 ? 'runA' : 'runB') : p.idle > 14 ? 'sit' : 'idle';
  if (!((p.stun > 0 || p.safe > 0) && (t * 20 | 0) % 2)) bmp(frame(pose), SP, X(p.x) - 8, Y(p.y) - 20, p.face < 0);
  if (p.idle > 14) text('…', X(p.x), Y(p.y) - 30, C.dim, { align:'center' });

  // on camera
  const z = F.zones.find(q => q.inside);
  if (F.freeze) { const w = chip('   INCOMING CALL', W / 2, 22, C.signal, C.signal); if ((t * 10 | 0) % 2) pen.camera(Math.round(W / 2 - w / 2) + 4, 24, C.signal); wire(0, 0, W, H, C.signal); wire(1, 1, W - 2, H - 2, C.signal); }
  else if (z && (z.phase === 'watch' || (z.phase === 'warn' && (t * 8 | 0) % 2))) {
    wire(0, 0, W, H, C.signal); if (z.phase === 'watch') { wire(1, 1, W - 2, H - 2, C.signal); R(W - 27, 4, 23, 9, C.signal); text('LIVE', W - 24, 6, C.ink); }
  }
  return { cx, cy };
}
const LIN_SKIN = '#c98f66';
const FACES = ['#e8b98f', '#b98560', '#f0c9a4', '#c98f66', '#c9cfdd', '#e8b98f', '#b98560', '#f0c9a4'];

// For the browser test and the console: where things are, and a way to stand somewhere.
export const debug = {
  get floor() { return F; },
  warp(x, y) { if (!F) return; F.p.x = x; F.p.y = y; F.p.vx = F.p.vy = 0; camera(0, true); },
};
export { BALL };
