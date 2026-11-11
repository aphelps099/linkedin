// SYNERGY.EXE browser playthrough. Opens the game in headless Chromium and
// plays the whole tower with the real controls: the planner (src/game/plan.js)
// picks the route, and a small pilot inside the page presses the buttons on
// the game's own clock. Needs Playwright; not part of `npm run build`.
//
//   npm start                                  (or: npx vite)
//   node scripts/play-game.mjs                 ending one: optimize the fact, take the ship
//   node scripts/play-game.mjs --ending b      ending two: keep the fact, onboard the new hire
//   node scripts/play-game.mjs --url http://localhost:5173/game/ --shots /tmp/shots --touch

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { FLOORS, parseFloor, T } from '../src/game/level.js';
import { explore, goalsOf, lengthOf } from '../src/game/plan.js';
import { standable } from '../src/game/physics.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = (name, fallback) => { const i = process.argv.indexOf('--' + name); return i < 0 ? fallback : process.argv[i + 1]; };
const URL = arg('url', 'http://localhost:3000/game/'), ENDING = arg('ending', 'a'), SHOTS = arg('shots', ''), TOUCH = process.argv.includes('--touch');
if (SHOTS) mkdirSync(SHOTS, { recursive:true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`); return ok; };
const note = m => console.log('      ' + m);

/* ---------- the pilot: runs inside the page, on the game's fixed step ---------- */
function installPilot() {
  const B = window.BOT = { queue:[], leg:null, phase:'idle', frame:0, result:null, mode:'route', log:[],
    run(legs) { B.queue = legs.slice(); B.leg = null; B.result = null; B.mode = 'route'; },
    boss() { B.queue = []; B.leg = null; B.result = null; B.mode = 'boss'; },
    stop() { B.queue = []; B.leg = null; B.mode = 'route'; } };
  const cell = p => ({ cx:Math.floor(p.x / 8), cy:Math.round(p.y / 8) });
  const steer = (keys, p, tx, slack = .4) => { const dx = tx - p.x, stop = p.vx * p.vx / 3000; keys.left = dx < -(stop + slack); keys.right = dx > stop + slack; };
  SYN.hook = (keys, F) => {
    const p = F.p; keys.left = keys.right = keys.jump = false;
    if (B.mode === 'boss') return boss(keys, F, p);
    if (!B.leg) { if (!B.queue.length) return; B.leg = B.queue.shift(); B.phase = 'align'; }
    const L = B.leg, tx = L.cx * 8 + 4, z = F.zones.find(q => q.inside), fail = why => { B.result = { ok:false, why, at:cell(p) }; B.leg = null; B.queue = []; };
    if (B.phase === 'align') {
      if (!p.ground || p.stun > 0 || F.freeze || SYN.state !== 'play') return;
      // a chair rolling at him: hop straight up, which is allowed even when the host is looking
      if (F.chairs.some(c => Math.abs(c.y - p.y) < 2 && Math.abs(c.x + 4.5 - p.x) < 15 && (c.x + 4.5 - p.x) * c.dir < 0)) { keys.jump = true; return; }
      if (Math.round(p.y / 8) !== L.cy || Math.abs(p.x - tx) > 14) return fail('off route');
      if (z && z.phase !== 'closed') return;                                   // the host is looking: hold still
      if (Math.abs(p.x - tx) > .45 || Math.abs(p.vx) > .5) { steer(keys, p, tx, .3); return; }
      if (z && z.t < L.input / 120 + .14) return;                              // not enough time before the next look
      // do not walk into a chair: let it roll out of the way first (but not forever)
      const end = L.to.cx * 8 + 4, lo = Math.min(p.x, end) - 12, hi = Math.max(p.x, end) + 12;
      if (L.to.cy === L.cy && F.chairs.some(c => Math.abs(c.y - p.y) < 2 && c.x + 9 > lo && c.x < hi) && (B.waited = (B.waited || 0) + 1) < 480) return;
      B.waited = 0;
      B.phase = 'run'; B.frame = 0;
    }
    if (B.phase === 'run') {
      const r = L.recipe, f = B.frame++, dir = f >= r.delay && f < r.delay + r.run ? r.d : 0;
      keys.left = dir < 0; keys.right = dir > 0; keys.jump = f < r.hold;
      if (p.stun > 0) return fail('bumped');
      if (f >= Math.max(r.hold, r.delay + r.run) && p.ground && Math.abs(p.vx) < .5) {
        const c = cell(p);
        if (c.cx !== L.to.cx || c.cy !== L.to.cy) return fail('landed elsewhere');
        B.leg = null; if (!B.queue.length) B.result = { ok:true };
      } else if (f > 720) fail('timeout');
    }
  };
  // The VP: wait on the left platform, and land on him when he is out of office.
  function boss(keys, F, p) {
    const b = F.boss; if (!b) { B.result = { ok:true }; B.mode = 'route'; return; }
    if (p.stun > 0) return;
    const GROUND = (F.h - 3) * 8, PLAT = (F.h - 7) * 8, home = 50;
    if (b.state === 'dazed' && b.t > .5) {
      const side = b.x < F.px / 2 ? 1 : -1, ax = b.x + side * 31;
      if (p.ground && p.y === GROUND) { if (Math.abs(p.x - ax) > 2.5 || Math.abs(p.vx) > 30) steer(keys, p, ax, 1); else { keys.jump = true; keys[side > 0 ? 'left' : 'right'] = true; } }
      else if (p.ground) { keys[ax > p.x ? 'right' : 'left'] = true; }
      else { keys.jump = p.vy < 0; if (p.y < GROUND - 26 || p.vy < 0) steer(keys, p, b.x, 1.5); else steer(keys, p, ax, 1); }
    } else {
      if (p.ground && p.y === PLAT) steer(keys, p, home, 2);
      else if (p.ground) { if (Math.abs(p.x - home) > 3 || Math.abs(p.vx) > 20) steer(keys, p, home, 1); else keys.jump = true; }
      else { keys.jump = p.vy < 0; steer(keys, p, home, 1); }
    }
  }
}

/* ---------- route to a goal, re-planning after every bump ---------- */
const floors = new Map();
function floorOf(i) { if (!floors.has(i)) { const f = parseFloor(FLOORS[i]); floors.set(i, { f, goals:goalsOf(f), cache:new Map() }); } return floors.get(i); }

async function standing(page) {
  try { return (await page.waitForFunction(() => { const p = SYN.p, F = SYN.floor; return SYN.state === 'call' ? null : SYN.state !== 'play' ? { gone:true } : (p && p.ground && p.stun <= 0 && !F.freeze && Math.abs(p.vx) < 1) ? { x:p.x, y:p.y } : null; }, null, { timeout:20000 })).jsonValue(); }
  catch (e) { return null; }
}
async function goTo(page, i, id, done, tries = 40) {
  const { f, goals, cache } = floorOf(i);
  for (let n = 0; n < tries; n++) {
    if (await page.evaluate(done)) return true;
    const s = await standing(page);
    if (!s || s.gone) return page.evaluate(done);
    // Standing on the lip of a ledge, his centre can be over thin air: start from the tile that is holding him up.
    const cy = Math.round(s.y / T), under = [Math.floor(s.x / T), Math.floor((s.x - 3.9) / T), Math.floor((s.x + 3.9) / T)].find(cx => standable(f, cx, cy));
    if (under === undefined) { await page.waitForTimeout(300); continue; }
    const r = explore(f, { x:under * T + T / 2, y:s.y }, goals, cache), route = r.route(id);
    if (!route) { note(`no route to ${id} from ${under},${cy}; waiting`); await page.waitForTimeout(400); continue; }
    let at = r.start; const legs = route.map(e => { const leg = { cx:at.cx, cy:at.cy, to:e.to, recipe:e.recipe, input:lengthOf(e.recipe) }; at = e.to; return leg; });
    await page.evaluate(l => BOT.run(l), legs);
    await page.waitForFunction(() => BOT.result || (SYN.state !== 'play' && SYN.state !== 'call'), null, { timeout:90000 }).catch(() => {});
    const res = await page.evaluate(() => BOT.result);
    if (res && !res.ok) { note(`${id}: ${res.why} at ${res.at.cx},${res.at.cy}; re-planning`); await page.waitForTimeout(150 + Math.random() * 900); }   // and not in step with the same chair
  }
  return page.evaluate(done);
}
const has = w => `SYN.collected.includes(${JSON.stringify(w)}) || SYN.run.lost === ${JSON.stringify(w)}`;
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path:`${SHOTS}/${name}.png` }); };
const label = (page, id) => page.textContent('#' + id);
const waitLabel = (page, id, text, timeout = 30000) => page.waitForFunction(([i, t]) => document.getElementById(i).textContent === t && !document.getElementById(i).hidden, [id, text], { timeout });
const waitState = (page, s, timeout = 30000) => page.waitForFunction(x => SYN.state === x, s, { timeout });

/* ---------- the run ---------- */
const browser = await chromium.launch();
const ctx = await browser.newContext(TOUCH ? { viewport:{ width:390, height:780 }, deviceScaleFactor:2, hasTouch:true, isMobile:true } : { viewport:{ width:390, height:780 }, deviceScaleFactor:2 });
const page = await ctx.newPage();
const errors = [], failed = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', r => failed.push(r.url()));
const tap = sel => TOUCH ? page.tap(sel) : page.click(sel);

try {
  const resp = await page.goto(URL, { waitUntil:'load' });
  check('page loads', resp.status() === 200, String(resp.status()));
  check('title card', (await label(page, 'cGo')) === 'Start career' && await page.isVisible('#card'));
  await page.waitForTimeout(500); await shot(page, '01-title');

  await tap('#cGo');
  check('break room opens', await page.evaluate(() => SYN.state) === 'intro');
  const speakers = [];
  for (let i = 0; i < 4; i++) {
    await page.waitForFunction(() => document.getElementById('sayR').textContent !== '', null, { timeout:15000 });
    speakers.push((await label(page, 'sayWho')).split(',')[0]);
    if (i === 1) await shot(page, '02-break-room');
    if (TOUCH) await page.tap('#screen', { position:{ x:60, y:60 } }); else await page.keyboard.press('Space');
    await page.waitForTimeout(200);
  }
  check('break room: four lines', speakers.join('|') === 'Synergy|Kevin|Linda|Synergy', speakers.join(' / '));
  await waitState(page, 'play');
  check('floor 02 begins', await page.evaluate(() => SYN.floor.def.id) === 'open-plan');
  await page.waitForFunction(() => SYN.loaded() === SYN.voices, null, { timeout:15000 }).catch(() => {});
  check('all voice takes decoded', await page.evaluate(() => SYN.loaded() === SYN.voices), `${await page.evaluate(() => SYN.loaded())} of ${await page.evaluate(() => SYN.voices)}`);
  check('audio running', await page.evaluate(() => SYN.audio.running));

  // real keys move him
  const x0 = await page.evaluate(() => SYN.p.x);
  if (TOUCH) { const b = await page.locator('#dir').boundingBox(); await page.touchscreen.tap(b.x + b.width * .75, b.y + b.height / 2); await page.mouse.move(b.x + b.width * .75, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(260); await page.mouse.up(); }
  else { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(260); await page.keyboard.up('ArrowRight'); }
  const x1 = await page.evaluate(() => SYN.p.x);
  check(TOUCH ? 'touch rocker moves Synergy' : 'arrow keys move Synergy', x1 > x0 + 6, `x ${x0.toFixed(0)} to ${x1.toFixed(0)}`);
  if (!TOUCH) { await page.keyboard.press('KeyP'); const paused = await page.evaluate(() => SYN.paused && !document.getElementById('paused').hidden); await page.keyboard.press('KeyP');
    check('P pauses and resumes', paused && !(await page.evaluate(() => SYN.paused))); }
  await page.waitForTimeout(400);
  await page.evaluate(installPilot);

  // 02 open plan
  check('02 secret mug', await goTo(page, 0, 'mug:0', () => SYN.run.mugs.includes('open-plan')));
  for (const w of ['HUMBLED', 'THRILLED', 'JOURNEY']) check(`02 phrase ${w}`, await goTo(page, 0, 'word:' + w, has(w)));
  await shot(page, '03-open-plan');
  check('02 locked lift until posted', await page.evaluate(() => !SYN.run.posted['open-plan']));
  await goTo(page, 0, 'desk', () => SYN.state === 'post');
  await waitState(page, 'post'); await page.waitForTimeout(700); await shot(page, '04-desk-typing');
  await waitLabel(page, 'pGo', 'Post');
  const body1 = await page.evaluate(() => [...document.querySelectorAll('#pBody p')].map(e => e.textContent));
  check('desk 1 post keeps the fact', body1.includes('The onboarding is a PDF.'), `${body1.length} lines`);
  await tap('#pGo'); await waitLabel(page, 'pGo', 'Keep climbing'); await shot(page, '05-desk-posted');
  note(`desk 1: ${await label(page, 'pR')} · ${await label(page, 'pNote')}`);
  await tap('#pGo'); await waitState(page, 'play');
  await goTo(page, 0, 'lift', () => SYN.state !== 'play');
  await waitState(page, 'lift'); await page.waitForTimeout(900); await shot(page, '06-lift');

  // 03 meetings
  await page.waitForFunction(() => SYN.state === 'play' && SYN.floor.def.id === 'meeting-rooms', null, { timeout:15000 });
  check('03 meetings reached', true);
  check('03 phrase THOUGHTS?', await goTo(page, 1, 'word:THOUGHTS?', has('THOUGHTS?')));
  check('03 phrase RESILIENCE (in a meeting)', await goTo(page, 1, 'word:RESILIENCE', has('RESILIENCE')));
  await shot(page, '07-meeting-room');
  check('03 phrase VISIONARY', await goTo(page, 1, 'word:VISIONARY', has('VISIONARY')));
  check('03 print room', await goTo(page, 1, 'printer', () => SYN.floor.printed > 0));
  check('03 secret mug', await goTo(page, 1, 'mug:0', () => SYN.run.mugs.includes('meeting-rooms')));
  await shot(page, '08-print-room');
  check('03 phrase ALIGNMENT (in a meeting)', await goTo(page, 1, 'word:ALIGNMENT', has('ALIGNMENT')));
  const kevin = await page.evaluate(() => ({ lost:SYN.run.lost, bumps:SYN.run.bumps }));
  note(`before the lift: ${await page.evaluate(() => SYN.collected.join(', '))}${kevin.lost ? ` · Kevin kept ${kevin.lost}` : ''} · ${kevin.bumps} bumps`);
  await goTo(page, 1, 'lift', () => SYN.state !== 'play');

  // 04 boardroom
  await waitState(page, 'meeting', 20000);
  check('04 boardroom: the meeting starts', true);
  for (let round = 0; round < 12; round++) {
    const s = await (await page.waitForFunction(() => !document.getElementById('mGo').hidden ? 'out' : document.querySelectorAll('#mPick button').length ? 'pick' : null, null, { timeout:30000 })).jsonValue();
    if (s === 'out') break;
    if (round === 0) await shot(page, '09-boardroom');
    await tap(ENDING === 'b' ? '#mPick button.fact' : '#mPick button:not(.fact)');
    await page.waitForFunction(() => !document.querySelectorAll('#mPick button').length, null, { timeout:5000 });
  }
  note(`meeting: ${await label(page, 'mR')} · reactions ${await label(page, 'hr')}`);
  check('04 meeting survived', await page.isVisible('#mGo') && (ENDING === 'b') === await page.evaluate(() => SYN.run.honest));
  await tap('#mGo');

  // 05 executive
  await page.waitForFunction(() => SYN.state === 'play' && SYN.floor.def.id === 'executive', null, { timeout:15000 });
  check('05 executive floor reached', true);
  await page.evaluate(() => BOT.boss());
  await page.waitForTimeout(6000); await shot(page, '10-the-vp');
  await page.waitForFunction(() => !SYN.floor.boss || SYN.state !== 'play', null, { timeout:240000 }).catch(() => {});
  check('05 the VP takes it offline', await page.evaluate(() => SYN.state === 'play' && !SYN.floor.boss), `${await page.evaluate(() => SYN.run.bumps)} bumps so far`);
  await page.evaluate(() => BOT.stop());
  for (const w of ['SYNERGY', '7 LESSONS', 'AGREE?']) check(`05 phrase ${w}`, await goTo(page, 3, 'word:' + w, has(w)));
  check('05 secret mug', await goTo(page, 3, 'mug:0', () => SYN.run.mugs.includes('executive')));
  const words = await page.evaluate(() => SYN.collected.length);
  check('phrases caught', words >= 9, `${words} of 10${kevin.lost ? ' (Kevin kept one)' : ''}`);
  await goTo(page, 3, 'desk', () => SYN.state === 'post');
  await waitState(page, 'post'); await waitLabel(page, 'pGo', 'Post');
  await tap('#pGo'); await waitLabel(page, 'pGo', 'Revise');
  const flat = `${await label(page, 'pR')} · ${await label(page, 'pC')}`;
  check('desk 2 with the fact: 3 reactions, "Bit specific."', /and 2 others/.test(flat) && /Bit specific\./.test(flat), flat);
  await shot(page, '11-bit-specific');
  if (ENDING === 'b') {
    check('desk 2 offers "Stand by it"', await page.isVisible('#pAlt'));
    await tap('#pAlt'); await waitLabel(page, 'pGo', 'Go back down'); await shot(page, '12-stood-by-it');
    await tap('#pGo');
    await waitState(page, 'onboard', 20000);
    check('ending two: back in the break room', true);
    await page.waitForFunction(() => /onboard/i.test(document.getElementById('sayHint').textContent), null, { timeout:10000 });
    for (let i = 0; i < 5; i++) { if (TOUCH) await page.tap('#screen', { position:{ x:60, y:60 } }); else await page.keyboard.press('Space'); await page.waitForTimeout(220); }
    await page.waitForFunction(() => document.getElementById('real').textContent === 'someone got onboarded.', null, { timeout:10000 });
    check('the new hire is onboarded', true); await page.waitForTimeout(600); await shot(page, '13-fixed');
    for (let i = 0; i < 12 && await page.evaluate(() => SYN.state) === 'onboard'; i++) { if (TOUCH) await page.tap('#screen', { position:{ x:60, y:60 } }); else await page.keyboard.press('Space'); await page.waitForTimeout(450); }
    await waitState(page, 'end', 15000);
    check('end card: "Onboarding: one minute. No PDF."', (await label(page, 'cS')) === 'Onboarding: one minute. No PDF.' && /onboarded someone/.test(await label(page, 'cH')), await label(page, 'cP'));
  } else {
    await tap('#pGo'); await page.waitForSelector('#pBody p.fact.live', { timeout:8000 });
    await tap('#pBody p.fact.live');
    check('the fact is optimized', await page.evaluate(() => { const f = document.querySelector('#pBody p.fact.cut'); return !!f && /optimizing the onboarding process/.test(f.textContent); }));
    await tap('#pGo'); await waitLabel(page, 'pGo', 'Take the lift');
    const big = await label(page, 'pR');
    check('the optimized post goes viral', /and [\d,]+ others/.test(big) && (await label(page, 'hf')) === '00', `${big} · facts ${await label(page, 'hf')}`);
    await shot(page, '12-viral');
    await tap('#pGo');
    await waitState(page, 'roof', 20000);
    check('ending one: the roof', true);
    await page.waitForTimeout(6600); await shot(page, '13-launch');
    await waitState(page, 'end', 20000);
    check('end card: "Onboarding: still a PDF."', (await label(page, 'cS')) === 'Onboarding: still a PDF.' && (await label(page, 'cGo')) === 'Circle back', await label(page, 'cP'));
  }
  await page.waitForTimeout(700); await shot(page, '14-end');
  note((await label(page, 'cK')).replace(/\s+/g, ' '));
  check('save file records the ending', await page.evaluate(e => { const s = JSON.parse(localStorage.getItem('synergy.exe/2')); return s.endings[e] === true && s.run === null && s.best > 0; }, ENDING));
  await tap('#cGo'); await page.waitForTimeout(300);
  check('"Circle back" returns to the title', await page.evaluate(() => SYN.state) === 'title' && (await label(page, 'cGo')) === 'Start career');
} catch (e) {
  check('run completed', false, String(e).split('\n')[0]);
  await shot(page, 'failure');
  note(`state ${await page.evaluate(() => SYN.state).catch(() => '?')} · ${JSON.stringify(await page.evaluate(() => SYN.p && ({ x:SYN.p.x | 0, y:SYN.p.y | 0, floor:SYN.floor.def.id, words:SYN.collected })).catch(() => null))}`);
}
check('no page or console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
check('no failed requests', failed.length === 0, failed.slice(0, 3).join(' | '));
await browser.close();
const bad = results.filter(r => !r.ok);
console.log(`\n${results.length - bad.length} of ${results.length} checks passed (ending ${ENDING}${TOUCH ? ', touch' : ''})`);
process.exit(bad.length ? 1 : 0);
