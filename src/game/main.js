// SYNERGY.EXE · Career Mode. The shell: one loop, one state machine, every
// way in (keys, touch, gamepad), pause, save, and the installable app.
//
//   title → break room → open plan → meeting rooms → boardroom → executive floor
//         → the roof and the launch, or back down to onboard the new hire in person.

import { G, $, reduce, coarse, newRun, clock } from './state.js';
import { FLOORS } from './level.js';
import { DT } from './physics.js';
import { Score } from './score.js';
import { C } from './art.js';
import { pen, fit, begin, hud, tray, toast, drawToast, drawParts, showCard, hideCard, load, save } from './ui.js';
import { enterFloor, stepWorld, drawWorld, recenter, floor, debug } from './world.js';
import * as S from './scenes.js';

const TOP = FLOORS.length - 1;
let saved = load();

/* ---------- where the player is ---------- */
function chrome() {
  const m = G.mode, def = FLOORS[G.floor], playing = m === 'play';
  $('mode').textContent = m === 'title' || m === 'intro' ? (m === 'intro' ? '01 Break room' : 'Career mode')
    : m === 'roof' ? 'RF Roof' : m === 'onboard' ? '01 Break room' : m === 'end' ? 'Career mode' : `${def.no} ${def.name}`;
  $('pad').classList.toggle('idle', !playing);
  $('tray').hidden = !playing;
  $('pause').hidden = !(playing || m === 'meeting');
}
const snapshot = () => JSON.parse(JSON.stringify({ ...G.run, floor:G.floor }));

function go(mode, d = {}) {
  const run = G.run;
  if (mode === 'title') { G.mode = 'title'; title(); }
  else if (mode === 'intro') { G.mode = 'intro'; S.enterIntro(); }
  else if (mode === 'floor') {                       // step out of the lift onto FLOORS[d.i]
    G.floor = d.i; const def = FLOORS[d.i];
    saved = save({ run:snapshot() });
    hud(); tray();
    if (def.scene === 'meeting') { G.mode = 'meeting'; S.enterMeeting(); }
    else { enterFloor(d.i); G.mode = 'play'; G.fade = 1; toast(d.fresh ? 'ONBOARDING IS SELF-GUIDED. CLIMB.' : `${def.no} ${def.name.toUpperCase()}`, 2.4); }
  }
  else if (mode === 'play') { G.mode = 'play'; Score.setLevel(FLOORS[G.floor].music + (run.collected.length >= 7 ? 1 : 0)); if (d.say) toast(d.say, 2.2); }
  else if (mode === 'post') { G.mode = 'post'; clearKeys(); S.enterPost(d); }
  else if (mode === 'call') { G.mode = 'call'; clearKeys(); S.enterCall(d); }                // rung into a meeting; d.back() returns to the floor
  else if (mode === 'lift') {
    const from = FLOORS[G.floor];
    if (G.floor === TOP && run.ending) {
      const down = run.ending === 'b';
      S.enterLift({ from, to:down ? { no:'01', name:'Break room' } : { no:'RF', name:'Roof' }, down, note:down ? 'ONBOARDING: IN PERSON' : 'ONBOARDING: OPTIMIZED', then:() => go(down ? 'onboard' : 'roof') });
    } else S.enterLift({ from, to:FLOORS[G.floor + 1], note:`ONBOARDING: STEP ${G.floor + 2} OF 5`, then:() => go('floor', { i:G.floor + 1 }) });
    G.mode = 'lift'; clearKeys();
  }
  else if (mode === 'roof') { G.mode = 'roof'; G.parts.length = 0; S.enterRoof(); }
  else if (mode === 'onboard') { G.mode = 'onboard'; G.parts.length = 0; S.enterOnboard(); }
  else if (mode === 'end') { G.mode = 'end'; finish(); }
  chrome();
}
G.go = go;

/* ---------- cards ---------- */
const standalone = () => matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvent = null;
const installLabel = () => standalone() ? '' : installEvent ? 'Install app' : ios ? 'Add to home screen' : '';

function title() {
  const run = saved.run, at = run && FLOORS[run.floor];
  const best = saved.best ? `<br>Best: <b>${saved.best.toLocaleString('en-US')}</b> reactions` : '';
  showCard({
    h:'Synergy said something true. Nobody reacted.', p:'Climb the office. Catch the language. Post your way up.',
    go:at ? `Continue • ${at.no}` : 'Start career', alt:at ? 'New career' : '', more:installLabel(),
    keys:(coarse ? 'Buttons below to move and jump.' : 'Arrow keys to move. Space to jump.') + best,
  });
  $('real').textContent = 'the onboarding is a PDF.'; $('real').classList.remove('fixed');
  G.run = null; $('hw').textContent = '00'; $('hf').textContent = '01'; $('hr').textContent = '0'; tray();
  Score.setLevel(0);
}
function start(fresh) {
  Score.start(); hideCard();
  const keep = !fresh && saved.run;
  if (keep) { const { floor:i, ...run } = JSON.parse(JSON.stringify(saved.run)); G.run = Object.assign(newRun(), run); go('floor', { i }); }
  else { G.run = newRun(); hud(); tray(); go('intro'); }
}
function finish() {
  const run = G.run, b = run.ending === 'b';
  const endings = Object.assign({}, saved.endings, { [run.ending]:true }), both = endings.a && endings.b;
  saved = save({ run:null, endings, best:Math.max(saved.best || 0, run.reactions), mugs:Math.max(saved.mugs || 0, run.mugs.length) });
  Score.setLevel(0); if (b) Score.voice('honored', .5); else Score.accent('circle');
  const n = run.reactions.toLocaleString('en-US');
  showCard(b ? {
    h:'You onboarded someone.', p:`Final post: ${run.words} words, 01 fact, ${n} reactions. Nobody was promoted. Somebody knows where the door is.`,
    sig:'Onboarding: one minute. No PDF.', go:'Circle back', alt:'Share the post',
  } : {
    h:'Access granted. Thought Leader.', p:`Final post: ${run.words} words, 00 facts, ${n} reactions. Same role. Higher altitude.`,
    sig:'Onboarding: still a PDF.', go:'Circle back', alt:'Share the post',
  });
  $('cK').innerHTML = `Ending ${b ? 2 : 1} of 2 <b>•</b> Mugs ${run.mugs.length}/3 <b>•</b> ${clock(run.time)}` + (both ? '' : '<br>There is another way this ends.');
}
async function share() {
  const run = G.run; if (!run || !run.post) return;
  const text = run.post.join('\n\n') + '\n\nWritten by Synergy, a robot, in SYNERGY.EXE.', url = 'https://linkedinbeats.com/game/';
  try { if (navigator.share) { await navigator.share({ text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  let ok = false;
  try { await navigator.clipboard.writeText(text + '\n' + url); ok = true; }
  catch (e) {                                   // older browsers and insecure origins: the long way round
    const ta = document.createElement('textarea'); ta.value = text + '\n' + url; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-99em;top:0';
    document.body.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (x) { ok = false; } ta.remove();
  }
  $('cAlt').textContent = ok ? 'Copied' : 'Copy failed';
  setTimeout(() => { if (G.mode === 'end') $('cAlt').textContent = 'Share the post'; }, 1800);
}
$('cGo').addEventListener('click', () => { if (G.mode === 'end') { hideCard(); go('title'); } else if (G.mode === 'title') start(false); });
$('cAlt').addEventListener('click', () => { if (G.mode === 'end') share(); else if (G.mode === 'title') start(true); });
$('cMore').addEventListener('click', async () => {
  if (installEvent) { const e = installEvent; installEvent = null; e.prompt(); try { await e.userChoice; } catch (x) { /* dismissed */ } $('cMore').hidden = true; }
  else if (ios) { $('cP').textContent = 'In Safari, tap Share, then Add to Home Screen. It installs like an app and plays offline.'; $('cMore').hidden = true; }
});
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; if (G.mode === 'title') { $('cMore').textContent = 'Install app'; $('cMore').hidden = false; } });
addEventListener('appinstalled', () => { installEvent = null; $('cMore').hidden = true; });

/* ---------- pause ---------- */
const pausable = () => G.mode === 'play' || G.mode === 'meeting';
function pause(on) {
  if (on === G.paused || (on && !pausable())) return;
  G.paused = on; $('paused').hidden = !on; clearKeys();
  if (on) { Score.pause(); $('zP').textContent = G.mode === 'meeting' ? 'The meeting will wait. It always does.' : 'The climb will wait. Kevin will not.'; $('zGo').focus({ preventScroll:true }); }
  else Score.resume();
}
$('pause').addEventListener('click', () => pause(!G.paused));
$('zGo').addEventListener('click', () => pause(false));
$('zRetry').addEventListener('click', () => {
  pause(false); $('meet').hidden = true;
  if (saved.run) { const { floor:i, ...run } = JSON.parse(JSON.stringify(saved.run)); G.run = Object.assign(newRun(), run); go('floor', { i }); }
});
$('zQuit').addEventListener('click', () => { pause(false); $('meet').hidden = true; $('post').hidden = true; $('say').hidden = true; go('title'); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (pausable()) pause(true); else Score.pause(); }
  else if (!G.paused) Score.resume();
});

/* ---------- sound ---------- */
function sound(on) {
  Score.setOn(on); $('snd').setAttribute('aria-pressed', on);
  saved = save({ muted:!on });
}
$('snd').addEventListener('click', () => { Score.start(); sound(!Score.on); });
if (saved.muted) sound(false);

/* ---------- input: keys, touch, gamepad ---------- */
const src = { kb:{}, tp:{}, gp:{} };
function sync() { for (const k of ['left', 'right', 'jump']) G.keys[k] = G.mode === 'play' && !G.paused && !!(src.kb[k] || src.tp[k] || src.gp[k]); }
function clearKeys() { src.kb = {}; src.tp = {}; src.gp = {}; sync(); document.querySelectorAll('.pad .down').forEach(b => b.classList.remove('down')); }
// The one "do the obvious thing" button: space, enter, a tap, the jump pad, gamepad A.
function act() {
  if (G.paused) { pause(false); return; }
  const m = G.mode;
  if (m === 'title' || m === 'end') $('cGo').click();
  else if (m === 'intro') S.advanceIntro();
  else if (m === 'post') S.postButton();
  else if (m === 'meeting') S.meetingKey(' ');
  else if (m === 'roof') S.skipRoof();
  else if (m === 'call') S.skipCall();
  else if (m === 'onboard') S.advanceOnboard();
}
const KEYMAP = { ArrowLeft:'left', a:'left', A:'left', ArrowRight:'right', d:'right', D:'right', ArrowUp:'jump', w:'jump', W:'jump', ' ':'jump' };
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const onButton = e.target instanceof Element && e.target.closest('button, [role="button"]');
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (!e.repeat && (pausable() || G.paused)) pause(!G.paused); return; }
  if (e.key === 'm' || e.key === 'M') { if (!e.repeat) sound(!Score.on); return; }
  if (G.paused) { if ((e.key === ' ' || e.key === 'Enter') && !onButton) { e.preventDefault(); pause(false); } return; }
  if (G.mode === 'play') { const k = KEYMAP[e.key]; if (k) { e.preventDefault(); src.kb[k] = true; sync(); } return; }
  if (G.mode === 'meeting' && '123'.includes(e.key)) { e.preventDefault(); if (!e.repeat) S.meetingKey(e.key); return; }
  if (e.key === ' ' || e.key === 'Enter') { if (onButton) return; e.preventDefault(); if (!e.repeat) act(); }
  else if (KEYMAP[e.key]) e.preventDefault();
});
addEventListener('keyup', e => { const k = KEYMAP[e.key]; if (k) { src.kb[k] = false; sync(); } });
addEventListener('blur', clearKeys);

// The rocker: one zone for left and right, so a thumb can slide between them without lifting.
const dirEl = $('dir'), jumpEl = $('jump'), [leftEl, rightEl] = dirEl.children;
let dirPtr = null;
function setDir(k) { src.tp.left = k === 'left'; src.tp.right = k === 'right'; leftEl.classList.toggle('down', k === 'left'); rightEl.classList.toggle('down', k === 'right'); sync(); }
const dirAt = e => { const r = dirEl.getBoundingClientRect(); return e.clientX < r.left + r.width / 2 ? 'left' : 'right'; };
dirEl.addEventListener('pointerdown', e => { e.preventDefault(); dirPtr = e.pointerId; try { dirEl.setPointerCapture(e.pointerId); } catch (x) { /* already gone */ } setDir(dirAt(e)); });
dirEl.addEventListener('pointermove', e => { if (e.pointerId === dirPtr) setDir(dirAt(e)); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) dirEl.addEventListener(ev, e => { if (e.pointerId === dirPtr) { dirPtr = null; setDir(null); } });
jumpEl.addEventListener('pointerdown', e => { e.preventDefault(); try { jumpEl.setPointerCapture(e.pointerId); } catch (x) { /* already gone */ }
  jumpEl.classList.add('down'); if (G.mode === 'play' && !G.paused) { src.tp.jump = true; sync(); } else if (G.mode !== 'title' && G.mode !== 'end' && G.mode !== 'meeting' && G.mode !== 'post') act(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) jumpEl.addEventListener(ev, () => { jumpEl.classList.remove('down'); src.tp.jump = false; sync(); });
for (const el of [dirEl, jumpEl, $('screen')]) el.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// A tap on the screen moves a scene along. Buttons and the post keep their own clicks.
let taps = 0;
$('screen').addEventListener('click', e => {
  if (e.target.closest('button, [role="button"], .post')) return;
  const m = G.mode;
  if (m === 'intro' || m === 'roof' || m === 'call' || m === 'onboard') act();
  else if (m === 'meeting') S.tapMeeting();
  else if (m === 'title' && ++taps % 5 === 0) { Score.start(); setTimeout(() => Score.voice('tagline'), 250); toast('SOUND LIKE YOU MEAN BUSINESS', 2.4); }
});

let padJump = false, padStart = false;
function pollPad() {
  if (!navigator.getGamepads) return;
  let gp = null; for (const g of navigator.getGamepads()) if (g && g.connected) { gp = g; break; }
  if (!gp) { if (src.gp.left || src.gp.right || src.gp.jump) { src.gp = {}; sync(); } return; }
  const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0;
  const next = { left:ax < -.4 || b(14), right:ax > .4 || b(15), jump:b(0) || b(1) };
  if (next.jump && !padJump && (G.mode !== 'play' || G.paused)) act();
  if (b(9) && !padStart && (pausable() || G.paused)) pause(!G.paused);
  padJump = next.jump; padStart = b(9);
  if (next.left !== !!src.gp.left || next.right !== !!src.gp.right || next.jump !== !!src.gp.jump) { src.gp = next; sync(); }
}

/* ---------- the loop ---------- */
let last = 0, acc = 0, hook = null;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(.1, (now - last) / 1000 || 0); last = now;
  pollPad();
  if (!G.paused) {
    G.t += dt;
    if (G.mode === 'play') { acc += dt; let n = 0; while (acc >= DT && n++ < 14 && G.mode === 'play') { acc -= DT; if (hook) hook(G.keys, floor()); stepWorld(); } if (n >= 14) acc = 0; }
    else { acc = 0; const m = G.mode;
      if (m === 'intro') S.stepIntro(dt); else if (m === 'post') S.stepPost(dt); else if (m === 'meeting') S.stepMeeting(dt);
      else if (m === 'lift') S.stepLift(dt); else if (m === 'roof') S.stepRoof(dt); else if (m === 'call') S.stepCall(dt); else if (m === 'onboard') S.stepOnboard(dt); }
  }
  draw(G.paused ? 0 : dt);
}
function draw(dt) {
  begin();
  const m = G.mode; let cam = null;
  if (m === 'play') cam = drawWorld();
  else if (m === 'title') S.drawTitle();
  else if (m === 'intro') S.drawIntro();
  else if (m === 'post') S.drawPost();
  else if (m === 'meeting') S.drawMeeting();
  else if (m === 'lift') S.drawLift();
  else if (m === 'roof') S.drawRoof();
  else if (m === 'call') S.drawCall();
  else if (m === 'onboard') S.drawOnboard(false);
  else if (m === 'end') S.drawEnd();
  drawParts(dt, cam ? cam.cx : 0, cam ? cam.cy : 0);
  if (m !== 'title' || G.toast) drawToast(dt);
  if (G.shake > 0) G.shake -= dt;
  if (G.fade > 0) { pen.ctx.globalAlpha = Math.min(1, G.fade); pen.R(0, 0, G.W, G.H, C.void); pen.ctx.globalAlpha = 1; G.fade -= dt * (reduce ? 9 : 3); }
}

/* ---------- boot ---------- */
function refit() { fit(); recenter(); }
fit();
if (window.ResizeObserver) new ResizeObserver(refit).observe($('view'));
addEventListener('resize', refit); addEventListener('orientationchange', () => setTimeout(refit, 250));
go('title');
requestAnimationFrame(loop);

// Installable, and playable with no signal. Production only, so the dev server never serves a stale build.
// The worker takes over after this first load, so the page tells it what it already fetched.
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', async () => {
  try {
    await navigator.serviceWorker.register('sw.js');
    const reg = await navigator.serviceWorker.ready;
    const urls = [location.href, 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', ...performance.getEntriesByType('resource').map(e => e.name), ...Score.urls()];
    if (reg.active) reg.active.postMessage({ type:'warm', urls });
  } catch (e) { /* no worker: the game still plays online */ }
});

// For the console and the browser test.
window.SYN = {
  loaded:() => Score.loaded(), voices:Score.voices,
  get state() { return G.mode; }, get paused() { return G.paused; }, get run() { return G.run; }, get floor() { return floor(); },
  get p() { const f = floor(); return f ? f.p : null; }, get collected() { return G.run ? G.run.collected : []; },
  get view() { return { W:G.W, H:G.H, S:G.S }; }, get audio() { return { running:Score.running, level:Score.level, on:Score.on }; },
  keys:G.keys, press(k, down) { src.kb[k] = down; sync(); },
  set hook(f) { hook = f; }, get hook() { return hook; },
  warp:debug.warp, go, pause,
};
