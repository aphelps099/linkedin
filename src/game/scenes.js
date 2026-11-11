// SYNERGY.EXE theater: the lit scenes, where Synergy performs. The break room,
// the desk where he posts, the meeting he has to sit through, the lift, and
// the two ways it can end.

import { G, $, reduce, pad2, clock } from './state.js';
import { FACT, WORDS, FILLER, INTRO, MEETING, FLOORS } from './level.js';
import { C, SP, HEAD, frame, PERSON, KEV, LIN, PEOPLE, ICONS, ICON_KEYS, PEG5, avatar } from './art.js';
import { pen, unitsOf, burst, sparks, hud, toast } from './ui.js';
import { Score } from './score.js';

const { R, wire, bmp, text, ticks, chip } = pen;

/* ---------- shared set pieces ---------- */
function litRoom(fy) {
  const W = G.W, H = G.H;
  R(0, 0, W, H, C.wall); R(0, fy - 5, W, 5, C.wall2); R(0, fy, W, H - fy, C.carpet);
  for (let x = 0; x < W; x += 12) R(x, fy + 6 + (x / 12 % 2) * 6, 6, 1, C.carpet2);
  R(22, 0, 40, 3, C.ink); R(24, 3, 36, 2, '#fff6cf'); R(100, 0, 40, 3, C.ink); R(102, 3, 36, 2, '#fff6cf');
}
// state: 'broken' blinks a warning, 'fixed' shows a green light
function coffee(x, fy, state = 'broken') {
  R(x, fy - 46, 22, 24, C.ink); R(x + 3, fy - 42, 16, 6, '#3a4672'); R(x + 5, fy - 32, 12, 8, '#0d1226');
  if (state === 'fixed') { R(x + 13, fy - 41, 7, 9, C.led); R(x + 15, fy - 38, 3, 3, C.ink); }
  else { R(x + 13, fy - 41, 7, 9, (G.t * 2 | 0) % 2 ? C.signal : '#b89c1f'); R(x + 16, fy - 39, 1, 4, C.ink); R(x + 16, fy - 34, 1, 1, C.ink); }
}
function breakRoom(fy, state) {
  litRoom(fy);
  R(6, fy - 92, 42, 46, C.ink); R(8, fy - 90, 38, 42, C.sky); R(26, fy - 90, 2, 42, C.ink);
  [[9, 18], [17, 28], [29, 14], [37, 22]].forEach(([x, h]) => R(x, fy - 48 - h, 7, h, '#6f9fd6'));
  if (fy > 150) { R(86, fy - 132, 66, 34, C.paper); wire(86, fy - 132, 66, 34, C.ink);
    text('EVERY SETBACK', 119, fy - 123, C.ink, { align:'center' }); text('IS CONTENT', 119, fy - 114, C.ink, { align:'center' }); R(104, fy - 104, 30, 1, C.signal); }
  R(106, fy - 22, 54, 22, C.wood); R(106, fy - 22, 54, 2, C.wood2); R(132, fy - 18, 1, 16, C.wood2);
  coffee(110, fy, state);
  R(141, fy - 62, 12, 16, '#7fb3ff'); R(139, fy - 46, 16, 46, '#c8cede'); R(143, fy - 36, 8, 6, '#8e97b3');
}
const blink = () => (G.t % 3.2) < .12;
let sayU = 0, sayAt = -1;
const sayUnits = () => { if (sayAt !== G.layout) { sayAt = G.layout; sayU = unitsOf($('say')); } return sayU; };

/* ---------- title ---------- */
export function drawTitle() {
  const W = G.W, H = G.H;
  R(0, 0, W, H, C.void);
  for (let y = 4; y < H; y += 8) for (let x = 4; x < W; x += 8) R(x, y, 1, 1, '#0a1533');
  const k = H < 200 ? 3 : 5, x = (W - 16 * k) / 2, y = Math.max(6, Math.floor(H * .42) - 20 * k / 2 - 20);
  bmp(frame('idle'), SP, x, y, false, k);
  if ((G.t % 3.4) < .13) R(x + 7 * k, y + 5 * k, 6 * k, 2 * k, C.visor);
}

/* ---------- break room ---------- */
let intro = { i:0, n:0, done:false };
export function enterIntro() {
  intro = { i:0, n:0, done:false };
  Score.setLevel(0); Score.duck(false);
  $('say').hidden = false; $('sayHint').textContent = 'Tap or press space'; paintSay();
  Score.voice('welcome', .5);
}
function paintSay() {
  const s = INTRO[intro.i];
  $('sayWho').textContent = s.name; $('sayLine').textContent = s.text.slice(0, intro.n | 0);
  $('sayR').textContent = intro.done ? s.react : '';
}
function finishLine() {
  const s = INTRO[intro.i]; intro.done = true; paintSay();
  if (s.burst) { burst(s.who === 'kev' ? 64 : 92, G.H - sayUnits() - 60, s.burst, 20); Score.accent('promote'); }
  else if (s.react === '0 reactions') Score.accent('flat');
}
export function advanceIntro() {
  const s = INTRO[intro.i];
  if (!intro.done) { intro.n = s.text.length; finishLine(); return; }
  if (intro.i < INTRO.length - 1) { intro = { i:intro.i + 1, n:0, done:false }; paintSay(); return; }
  $('say').hidden = true; Score.accent('off'); Score.voice('describe', .3);
  G.go('floor', { i:0, fresh:true });
}
export function stepIntro(dt) {
  const s = INTRO[intro.i];
  if (!intro.done) { const b = intro.n | 0; intro.n += dt * 34; if ((intro.n | 0) !== b) { if ((intro.n | 0) % 2 === 0) Score.accent('type'); paintSay(); }
    if (intro.n >= s.text.length) finishLine(); }
}
export function drawIntro() {
  const fy = G.H - sayUnits() - 12; breakRoom(fy, 'broken');
  const who = INTRO[intro.i].who;
  bmp(frame('idle'), SP, 12, fy - 40, false, 2);
  if (blink()) R(12 + 14, fy - 40 + 10, 12, 4, C.visor);
  bmp(PERSON, KEV, 54, fy - 40, false, 2); bmp(PERSON, LIN, 82, fy - 40, true, 2);
  ticks(who === 'syn' ? 28 : who === 'kev' ? 64 : 92, fy - 46, who === 'syn' ? C.cobalt : C.ink);
}

/* ---------- the desk: write the post ---------- */
const HEADLINE = { 'Associate':'Associate | Break Room Operations', 'Senior Associate':'Senior Associate | Cross-Functional Alignment',
  'Thought Leader':'Thought Leader | Keynote Listener | Ex-Associate' };
const FACT_HINT = 'Leadership prefers fewer specifics. Tap the highlighted line to cut it.';
let post = { desk:1, lines:[], phase:'typing', ch:0, cut:false, acc:0, pu:0 };

function buildLines(desk) {
  const got = G.run.collected, s = [[], [], [], []];
  got.forEach(w => s[WORDS[w].slot].push({ t:WORDS[w].line, w }));
  const tags = got.length ? [{ t:desk === 1 ? '#Grateful #Growth' : '#Leadership #Resilience #Synergy #Mindset', tag:true }] : [];
  return [...s[0], { t:FACT, fact:true }, ...s[2], ...s[3], ...tags];
}
const total = () => post.lines.reduce((n, l) => n + l.t.length, 0);
const liveLines = () => post.lines.filter(l => !(l.fact && post.cut));
function meters() {
  $('pW').textContent = liveLines().reduce((n, l) => n + l.t.split(/\s+/).length, 0); $('pF').textContent = pad2(post.cut ? 0 : 1);
}
function paintTyping() {
  let left = post.ch | 0, i = 0;
  while (i < post.lines.length - 1 && left >= post.lines[i].t.length) { left -= post.lines[i].t.length; i++; }
  post.cur = i; post.frac = post.ch / total();
  $('pLine').textContent = post.lines[i].t.slice(0, left); $('pProg').textContent = `Line ${i + 1} of ${post.lines.length}`;
}
export function enterPost({ desk }) {
  const run = G.run;
  post = { desk, lines:buildLines(desk), phase:'typing', ch:0, cut:false, acc:0, cur:0, pu:0, at:-1 };
  Score.setLevel(desk === 1 ? 1 : 2); Score.watch(false); Score.duck(true); Score.accent('lights'); G.fade = 1;
  $('post').classList.add('drafting'); $('pAlt').hidden = true;
  $('pAv').replaceChildren(avatar(HEAD, SP)); $('pTitle').textContent = HEADLINE[run.title];
  $('pBody').textContent = ''; $('pC').textContent = ''; $('pNote').textContent = ''; $('pLine').textContent = '';
  $('pR').textContent = 'No reactions yet'; $('pCm').textContent = ''; $('pGo').textContent = 'Skip';
  post.lines.forEach(l => { const el = document.createElement('p'); if (l.tag) el.className = 'tag';
    if (l.fact) { el.className = 'fact'; el.addEventListener('click', cutFact);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); cutFact(); } }); }
    l.el = el; $('pBody').appendChild(el); });
  $('pIcons').innerHTML = ICON_KEYS.map(k => `<svg viewBox="0 0 11 11" shape-rendering="crispEdges" aria-label="${k}">` +
    ICONS[k].map((r, j) => [...r].map((c, i) => c === '#' ? `<rect x="${i}" y="${j}" width="1" height="1"/>` : '').join('')).join('') + '</svg>').join('');
  meters(); $('post').hidden = false; paintTyping();
}
function ready() {
  post.phase = 'ready'; post.ch = total(); post.frac = 1; post.at = -1;
  post.lines.forEach(l => { l.el.textContent = l.t; });
  $('post').classList.remove('drafting'); $('pGo').textContent = 'Post'; $('pAlt').hidden = true; $('pBody').scrollTop = 0;
  const f = post.lines.find(l => l.fact).el;
  if (post.desk === 2) { f.classList.toggle('live', !post.cut); f.tabIndex = 0; f.setAttribute('role', 'button');
    $('pNote').textContent = post.cut ? 'Fact removed. Nothing left to dispute.' : FACT_HINT; }
  else $('pNote').textContent = 'One fact detected. Acceptable at your level.';
}
function cutFact() {
  if (post.desk !== 2 || post.phase !== 'ready') return;
  post.cut = !post.cut; const f = post.lines.find(l => l.fact).el; f.classList.toggle('cut', post.cut); f.classList.toggle('live', !post.cut);
  $('pNote').textContent = post.cut ? 'Fact removed. Nothing left to dispute.' : FACT_HINT;
  meters(); Score.accent(post.cut ? 'word' : 'bump', 3); if (post.cut) Score.voice('optimized', .15);
}
function publish() {
  const run = G.run, n = run.collected.length, kev = run.lost ? 'This. As I said in my post.' : 'This.';
  let target, comments, lit;
  if (post.desk === 1) { target = 8 * n * n; lit = Math.min(6, n + 1);
    comments = n ? [['kev', kev]].concat(n >= 3 ? [['arj', 'So needed.']] : []) : [];
    post.note = n ? 'Promoted to Senior Associate.' : 'Nobody reacts. Catch more words on the next floor.'; post.next = 'done'; post.title = 'Senior Associate'; }
  else if (!post.cut) { target = 3; lit = 1; comments = [['lin', 'Bit specific.']]; post.note = 'Three reactions. The fact is holding you back.'; post.next = 'revise'; post.title = run.title; }
  else { target = Math.min(9999, Math.max(12, 100 * n * n)); lit = 6; post.title = 'Thought Leader';
    comments = [['kev', kev], ['lin', 'Love this. Sharing with my team.'], ['rec', 'Great insights! Open to new opportunities?'], ['pat', 'Out of office. Reposted.']];
    post.note = 'Promoted to Thought Leader. Access granted.'; post.next = 'done'; Score.duck(false); Score.setLevel(4); }
  post.phase = 'counting'; post.target = target; post.acc = 0; post.comments = comments; post.lit = lit; post.shown = 0;
  post.first = comments.length ? PEOPLE[comments[0][0]].n : 'Kevin';
  $('pNote').textContent = ''; $('pGo').textContent = '…'; $('pAlt').hidden = true; Score.accent('publish');
  if (target >= 2000) { burst(G.W / 2, G.H * .28, 40, 110); Score.accent('big'); Score.voice('humbledShare', .4); }
  else if (target >= 100) { burst(G.W / 2, G.H * .28, 12, 110); Score.accent('promote'); Score.voice('share', .4); Score.voice('shareF', 1.9, .8); }
  else if (target < 10) { Score.accent('flat'); if (post.next === 'revise') Score.accent('linda'); }
}
// Keep the fact, post it anyway, and take the consequences.
function standBy() {
  if (post.phase !== 'revise') return;
  const run = G.run;
  post.phase = 'done'; post.kept = true; run.reactions += post.target; hud();
  if (run.honest) { const li = commentRow('arj', 'It is broken. I checked.'); $('pC').appendChild(li); $('pC').scrollTop = 1e4; $('pCm').textContent = '2 comments'; }
  $('pNote').textContent = 'No promotion. The lift only goes down.'; $('pGo').textContent = 'Go back down'; $('pAlt').hidden = true;
  Score.accent('lights');
}
function commentRow(id, what) {
  const who = PEOPLE[id], li = document.createElement('li'), d = document.createElement('div'), b = document.createElement('b'), i = document.createElement('i'), s = document.createElement('span');
  b.textContent = who.n; i.textContent = who.h; s.textContent = what; d.append(b, i, s);
  li.append(avatar(PERSON.slice(0, 10), who.pal, id === 'lin'), d); return li;
}
export function stepPost(dt) {
  if (post.phase === 'typing') { const b = post.ch | 0; post.ch += dt * 40; if ((post.ch | 0) !== b) { if ((post.ch | 0) % 2 === 0) Score.accent('type'); paintTyping(); }
    if (post.ch >= total()) ready(); }
  else if (post.phase === 'counting') {
    post.acc = Math.min(1, post.acc + dt / 1.6); const e = 1 - Math.pow(1 - post.acc, 3), v = Math.round(post.target * e);
    $('pR').textContent = !v ? 'No reactions yet' : v === 1 ? post.first : `${post.first} and ${(v - 1).toLocaleString('en-US')} others`;
    if (post.target > 0 && Math.random() < .3) Score.accent('react');
    [...$('pIcons').children].forEach((s, i) => { const on = i < Math.ceil(post.lit * e); s.classList.toggle('on', on); s.classList.toggle('hot', on && post.target > 2000 && i === 4); });
    const want = Math.floor(post.comments.length * e + .001);
    while (post.shown < want) { const [id, what] = post.comments[post.shown++]; $('pC').appendChild(commentRow(id, what)); $('pC').scrollTop = 1e4; }
    $('pCm').textContent = post.shown ? `${post.shown} comment${post.shown > 1 ? 's' : ''}` : '';
    if (post.acc >= 1) { post.phase = post.next; $('pNote').textContent = post.note;
      if (post.next === 'done') { const run = G.run; run.reactions += post.target; run.title = post.title; if (post.desk === 2) run.facts = 0; $('pTitle').textContent = HEADLINE[run.title]; hud(); }
      $('pGo').textContent = post.next === 'revise' ? 'Revise' : post.desk === 1 ? 'Keep climbing' : 'Take the lift';
      $('pAlt').hidden = post.next !== 'revise'; }
  }
}
export function postButton() {
  if (post.phase === 'typing') ready();
  else if (post.phase === 'ready') publish();
  else if (post.phase === 'revise') { $('pC').textContent = ''; $('pR').textContent = 'No reactions yet'; $('pCm').textContent = '';
    [...$('pIcons').children].forEach(s => s.classList.remove('on', 'hot')); ready(); }
  else if (post.phase === 'done') {
    const run = G.run, id = FLOORS[G.floor].id;
    $('post').hidden = true; G.fade = 1;
    if (post.desk === 1) { run.posted[id] = true; Score.duck(false); Score.accent('off'); G.go('play', { say:'PROMOTED: SENIOR ASSOCIATE' }); }
    else { run.posted[id] = post.kept ? 'kept' : 'cut'; run.ending = post.kept ? 'b' : 'a';
      run.post = liveLines().map(l => l.t); run.words = Number($('pW').textContent);
      Score.duck(false); G.go('lift', {}); }
  }
}
$('pGo').addEventListener('click', postButton);
$('pAlt').addEventListener('click', standBy);
export function drawPost() {
  if (post.at !== G.layout) { post.at = G.layout; post.pu = unitsOf($('post')); }
  const W = G.W, t = G.t, fy = Math.max(52, G.H - post.pu - 10), k = fy >= 100 ? 3 : 2, typing = post.phase === 'typing';
  const ox = Math.floor((W - 47 * k) / 2) + 3 * k, a = typing ? (t * 13 | 0) % 2 : 0;
  const P = (x, y, w, h, c) => R(ox + x * k, fy - (y + h) * k, w * k, h * k, c);
  litRoom(fy);
  if (k === 3) { R(108, fy - 150, 44, 46, C.ink); R(110, fy - 148, 40, 42, C.sky); R(129, fy - 148, 2, 42, C.ink);
    [[112, 16], [120, 26], [133, 12], [141, 20]].forEach(([x, h]) => R(x, fy - 106 - h, 7, h, '#6f9fd6'));
    R(6, fy - 112, 34, 2, C.wood2); coffee(12, fy - 112); }
  else coffee(4, fy);
  P(-3, 0, 2, 14, '#2a3a78'); P(-3, 4, 13, 2, '#2a3a78');
  P(15, 10, 29, 1, C.wood2); P(17, 0, 1, 10, C.wood2); P(41, 0, 1, 10, C.wood2);
  P(29, 11, 8, 1, C.ink); P(32, 12, 2, 2, C.ink); P(25, 14, 16, 12, C.ink); P(26, 15, 14, 10, '#10204f');
  const rows = Math.floor(10 * k / 4), sx = ox + 27 * k, sw = 12 * k, top = fy - 24 * k, f = Math.min(1, post.frac || 0) * rows;
  for (let r = 0; r < rows; r++) { if (r > f) break; const full = Math.round(sw * (.55 + .45 * Math.abs(Math.sin(r * 2.3 + post.desk)))), w = r + 1 > f ? Math.round(full * (f - r)) : full;
    R(sx, top + r * 4, w, 2, r % 3 === 1 ? '#7fa8ff' : '#dfe8ff'); if (typing && r + 1 > f && (t * 4 | 0) % 2) R(sx + w + 1, top + r * 4, 2, 2, C.signal); }
  P(17, 11, 9, 1, C.ink); P(42, 11, 2, 3, C.white); P(42, 14, 2, 1, C.tan);
  bmp(frame('sit'), SP, ox, fy - 24 * k - (typing && a ? 1 : 0), false, k);
  P(12, 0, 1, 4, C.cream); P(12, 0, 3, 1, C.tan);
  P(13, 12, 5, 1, C.cream); P(18 + a, 12 + (a ? 1 : 0), 2, 1, C.tan); P(21 + (1 - a), 12 + (a ? 0 : 1), 2, 1, C.tan);
  if (typing) { ticks(ox + 33 * k, fy - 26 * k - 3, C.cobalt);
    const l = post.lines[post.cur]; chip(l.fact ? 'FACT' : l.tag ? 'HASHTAGS' : l.w, ox + 33 * k, fy - 26 * k - 22, l.fact ? C.signal : C.cream, C.ink, C.ink); }
}

/* ---------- the boardroom: the meeting he cannot walk around ---------- */
const QUIET = 9;
let meet = null;
const SEATS = [{ id:'lin', x:44 }, { id:'kev', x:72 }, { id:'arj', x:100 }, { id:'rec', x:128 }];

export function enterMeeting() {
  meet = { good:0, facts:0, asked:0, phase:'ask', who:'Linda, Governance', speaker:'lin', line:MEETING.prompts[0], n:0, t:0, used:new Set(), picks:[], mu:0, at:-1, after:null };
  Score.setLevel(6); Score.duck(false); Score.watch(false); G.fade = 1; Score.accent('lights');
  $('meet').hidden = false; $('mGo').hidden = true; $('mPick').textContent = ''; $('mR').textContent = ''; $('mQuiet').hidden = true;
  paintMeet();
}
function paintMeet() { $('mWho').textContent = meet.who; $('mLine').textContent = meet.line.slice(0, meet.n | 0); }
function say(who, speaker, line, after) { Object.assign(meet, { phase:'talk', who, speaker, line, n:0, t:0, after }); $('mPick').textContent = ''; $('mQuiet').hidden = true; meet.at = -1; paintMeet(); }
function ask(line) { Object.assign(meet, { phase:'ask', who:'Linda, Governance', speaker:'lin', line, n:0, t:0 }); meet.asked++; $('mR').textContent = ''; meet.at = -1; paintMeet(); }

function choices() {
  const run = G.run, pool = run.collected.filter(w => !meet.used.has(w)), out = [];
  for (let i = 0; i < 2; i++) {
    const w = pool.length ? pool.splice((meet.asked * 3 + i * 2) % pool.length, 1)[0] : null;
    out.push(w ? { kind:'buzz', word:w, text:WORDS[w].say } : { kind:'fill', text:FILLER[(meet.asked + i) % FILLER.length] });
  }
  out.splice(meet.asked % 3, 0, { kind:'fact', text:FACT });
  return out;
}
function offer() {
  meet.phase = 'pick'; meet.t = QUIET; meet.picks = choices(); meet.at = -1;
  const ol = $('mPick'); ol.textContent = '';
  meet.picks.forEach((c, i) => { const li = document.createElement('li'), b = document.createElement('button'), n = document.createElement('i'), s = document.createElement('span');
    n.textContent = i + 1; s.textContent = c.text; b.append(n, s); if (c.kind === 'fact') b.className = 'fact';
    b.addEventListener('click', () => pick(i)); li.appendChild(b); ol.appendChild(li); });
  $('mQuiet').hidden = false; $('mBar').style.transform = 'scaleX(1)'; $('mR').textContent = 'Say something';
}
export function pick(i) {
  if (!meet || meet.phase !== 'pick' || !meet.picks[i]) return;
  const c = meet.picks[i], run = G.run, fy = G.H - meet.mu - 12;
  const next = () => (meet.good >= 3 || meet.facts >= 3) ? wrap() : ask(c.kind === 'fact' ? MEETING.again[(meet.facts - 1) % 3] : MEETING.prompts[meet.good]);
  if (c.kind === 'fact') {
    meet.facts++; Score.accent('flat');
    if (meet.facts >= 3) { run.honest = true; run.reactions += 1; hud(); burst(110, fy - 62, 1, 4);
      say('Arjun, Finance', 'arj', MEETING.listened, next); $('mR').textContent = '+1 reaction. Someone listened.'; }
    else { say('Linda, Governance', 'lin', MEETING.offline, next); $('mR').textContent = '0 reactions'; }
  } else {
    if (c.word) meet.used.add(c.word);
    meet.good++; const gain = c.kind === 'buzz' ? 60 * meet.good : 12;
    run.reactions += gain; hud(); burst(96, fy - 66, c.kind === 'buzz' ? 10 : 3, 90);
    Score.accent('promote'); Score.voice(meet.good === 2 ? 'humbledShare' : 'share', .1);
    say('Linda, Governance', 'lin', MEETING.praise[meet.good - 1], next); $('mR').textContent = `+${gain} reactions`;
  }
}
function wrap() {
  say('Linda, Governance', 'lin', meet.facts >= 3 ? 'Noted. Facilities has a form for that. Meeting adjourned.' : MEETING.wrap, () => {
    meet.phase = 'out'; $('mGo').hidden = false; $('mR').textContent = meet.facts >= 3 ? 'Meeting survived. Honestly.' : 'Meeting survived.'; Score.accent('ding'); });
}
export const leaveMeeting = () => { $('meet').hidden = true; G.go('lift', {}); };
$('mGo').addEventListener('click', () => { if (meet && meet.phase === 'out') leaveMeeting(); });
export function meetingKey(key) {
  if (!meet) return false;
  if (meet.phase === 'pick' && '123'.includes(key)) { pick(Number(key) - 1); return true; }
  if (key === ' ' || key === 'Enter') {
    if (meet.phase === 'ask' || meet.phase === 'talk') { if (meet.n < meet.line.length) { meet.n = meet.line.length; paintMeet(); } else meet.t = 9; return true; }
    if (meet.phase === 'out') { leaveMeeting(); return true; }
  }
  return false;
}
export const tapMeeting = () => { if (meet && (meet.phase === 'ask' || meet.phase === 'talk')) meetingKey(' '); };
export function stepMeeting(dt) {
  const m = meet;
  if (m.phase === 'ask' || m.phase === 'talk') {
    if (m.n < m.line.length) { const b = m.n | 0; m.n += dt * 34; if ((m.n | 0) !== b) { if ((m.n | 0) % 2 === 0) Score.accent('type'); paintMeet(); } }
    else { m.t += dt; if (m.phase === 'ask' && m.t > .35) offer(); else if (m.phase === 'talk' && m.t > 1.5) { const f = m.after; m.after = null; if (f) f(); } }
  } else if (m.phase === 'pick') {
    m.t -= dt; $('mBar').style.transform = `scaleX(${Math.max(0, m.t / QUIET)})`;
    if (m.t <= 0) { G.run.bumps++; Score.accent('caught'); Score.voice('followup', .3); $('mR').textContent = 'Silence. Noted.';
      say('Linda, Governance', 'lin', MEETING.mute, () => ask(MEETING.again[m.asked % 3])); }
  }
}
export function drawMeeting() {
  const m = meet, W = G.W, t = G.t;
  if (m.at !== G.layout) { m.at = G.layout; m.mu = unitsOf($('meet')); }
  const fy = Math.max(74, G.H - m.mu - 12);
  litRoom(fy);
  // the people who dialled in
  const gy = fy - 122;
  if (gy > 12) { R(40, gy, 108, 46, C.ink);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const x = 43 + i * 26, y = gy + 3 + j * 21; R(x, y, 24, 19, '#2c3558');
      if (i === 1 && j === 1) text('MUTED', x + 12, y + 7, '#55608a', { align:'center' }); else { R(x + 8, y + 3, 8, 7, '#55608a'); R(x + 5, y + 11, 14, 8, '#55608a'); } }
    R(92, gy + 46, 4, 6, C.ink); }
  // the table and who is at it
  for (const s of SEATS) { const hop = m.speaker === s.id && m.n < m.line.length && (t * 9 | 0) % 2 ? 1 : 0;
    bmp(PERSON.slice(0, 13), PEOPLE[s.id].pal, s.x, fy - 54 - hop, s.id === 'lin' || s.id === 'rec', 2); if (m.speaker === s.id) ticks(s.x + 10, fy - 60, C.ink); }
  R(38, fy - 30, 120, 5, C.wood2); R(38, fy - 25, 120, 4, C.wood); R(44, fy - 21, 4, 21, C.wood2); R(148, fy - 21, 4, 21, C.wood2);
  for (const s of SEATS) { R(s.x + 3, fy - 35, 14, 5, C.ink); R(s.x + 7, fy - 36, 6, 1, '#7fa8ff'); }
  bmp(frame('idle'), SP, 2, fy - 40, false, 2);
  if (blink()) R(2 + 14, fy - 40 + 10, 12, 4, C.visor);
  if (m.phase === 'pick') { ticks(18, fy - 46, C.cobalt); if (m.t < 3 && (t * 6 | 0) % 2) text('…', 18, fy - 58, C.ink, { align:'center' }); }
  chip(`${Math.max(m.good, 0)} OF 3`, W - 22, 6, C.ink, C.ink, C.paper);
}

/* ---------- the lift ---------- */
let lift = null;
export function enterLift({ from, to, down, then }) {
  lift = { t:0, from, to, down, then, len:reduce ? 1.1 : 2.3, rang:false };
  Score.duck(true); Score.watch(false); G.fade = .6;
}
export function stepLift(dt) {
  const l = lift; l.t += dt;
  if (!l.rang && l.t > l.len - .5) { l.rang = true; Score.accent('ding'); }
  if (l.t >= l.len) { const f = l.then; lift = null; Score.duck(false); G.fade = 1; f(); }
}
export function drawLift() {
  const l = lift, W = G.W, H = G.H, t = G.t, mid = H >> 1, k = Math.min(1, l.t / (l.len - .5));
  R(0, 0, W, H, C.void);
  const off = (t * 90 * (l.down ? -1 : 1)) % 16;
  for (let y = -16; y < H + 16; y += 16) { R(46, y + off, 3, 1, C.dim); R(111, y + off, 3, 1, C.dim); }
  R(48, 0, 1, H, C.faint); R(111, 0, 1, H, C.faint);
  wire(54, mid - 30, 52, 60, C.cobalt); R(79, mid - 29, 2, 58, C.dim);
  bmp(frame('idle'), SP, 72, mid + 9, false, 1);
  const arrived = k >= 1, show = arrived ? l.to : l.from;
  text(show.no, W / 2, mid - 62, arrived ? C.signal : C.cobalt, { font:PEG5, k:3, align:'center' });
  if (!arrived) { const ax = W / 2, ay = mid - 74 + (l.down ? 6 : 0), s = l.down ? -1 : 1, b = (t * 4 | 0) % 2;
    for (let i = 0; i < 4; i++) R(ax - i, ay + i * s + (b ? s : 0), 1 + i * 2, 1, C.signal); }
  text((arrived ? l.to.name : l.down ? 'Going down' : 'Going up').toUpperCase(), W / 2, mid + 40, arrived ? C.cream : C.dim, { align:'center' });
}

/* ---------- ending one: the roof, the ship, the launch ---------- */
let roof = null;
const STARS = Array.from({ length:46 }, (_, i) => ({ x:(i * 53 + 17) % 160, y:(i * 97 + 31) % 300, b:i % 5 === 0 }));
export function enterRoof() { roof = { t:0, lit:false, counted:0, boom:false, card:false }; Score.setLevel(7); Score.duck(false); G.fade = 1; }
export function skipRoof() { if (roof && roof.t > 1 && roof.t < 11.6) { roof.t = 11.6; G.parts.length = 0; G.fade = 1; } }
export function stepRoof(dt) {
  const r = roof; r.t += dt;
  const n = r.t < 3.2 ? 0 : Math.min(3, 1 + Math.floor((r.t - 3.2) / .8));
  if (n > r.counted) { r.counted = n; Score.accent('count'); if (n === 1) Score.accent('launch'); }
  if (!r.boom && r.t >= 5.7) { r.boom = true; Score.setLevel(4); G.shake = .8; }
  if (r.t > 5.7 && r.t < 9 && !reduce) { const y = shipY(r.t); for (let i = 0; i < 2; i++) G.parts.push({ x:104 + (Math.random() - .5) * 10, y:y + 4, vx:(Math.random() - .5) * 30, vy:40 + Math.random() * 50,
    life:.7 + Math.random() * .5, icon:ICON_KEYS[(Math.random() * 6) | 0], hot:Math.random() < .4, delay:0 }); }
  if (!r.card && r.t >= 12.2) { r.card = true; Score.setLevel(0); G.go('end', {}); }
}
const roofY = () => G.H - 44;
const shipY = t => roofY() - (t < 5.7 ? 0 : Math.pow(t - 5.7, 2) * 26);
export function drawRoof() {
  const r = roof, W = G.W, H = G.H, t = r.t, fy = roofY();
  if (t >= 11.6) { drawEnd(); return; }
  const rise = t < 5.7 ? 0 : Math.min(H, Math.pow(t - 5.7, 2) * 9);        // the building falls away
  R(0, 0, W, H, C.night);
  for (const s of STARS) { const y = (s.y + rise * (s.b ? 2.2 : 1.2)) % 300; if (y < H) R(s.x, y, 1, s.b && t > 6.5 ? 3 : 1, s.b ? C.cream : C.dim); }
  const gy = fy + rise;
  [[0, 30, 22], [24, 52, 18], [44, 38, 26], [118, 60, 20], [140, 34, 20]].forEach(([x, h, w]) => { R(x, gy - h, w, h, '#0a1230'); for (let j = 4; j < h - 4; j += 7) for (let i = 3; i < w - 3; i += 6) R(x + i, gy - h + j, 2, 2, (i + j) % 4 ? C.faint : C.dim); });
  R(0, gy, W, H, '#070e26'); R(0, gy, W, 1, C.cobalt); for (let x = 0; x < W; x += 2) R(x, gy + 2, 1, 1, C.dim);
  wire(8, gy - 26, 16, 26, C.dim); R(15, gy - 25, 2, 25, C.dim);                 // where the lift lets out
  R(88, gy, 32, 2, C.signal);                                                    // the pad
  const sy = shipY(t), sx = 96;
  // the ship: TL-1
  R(sx + 5, sy - 52, 6, 4, C.cobalt); R(sx + 3, sy - 48, 10, 4, C.cobalt); R(sx + 1, sy - 44, 14, 6, C.cobalt);
  R(sx, sy - 38, 16, 30, C.cream); R(sx + 2, sy - 38, 2, 30, C.white); R(sx + 5, sy - 32, 6, 6, C.ink); R(sx + 6, sy - 31, 4, 4, t > 2.4 ? C.led : C.sky);
  R(sx - 5, sy - 14, 5, 14, C.cobalt); R(sx + 16, sy - 14, 5, 14, C.cobalt); R(sx + 3, sy - 8, 10, 4, C.ink);
  text('TL', sx + 8, sy - 22, C.ink, { align:'center' }); text('1', sx + 8, sy - 15, C.ink, { align:'center' });
  if (t > 5.7 && (G.t * 20 | 0) % 2) { R(sx + 4, sy - 4, 8, 6, C.signal); R(sx + 6, sy + 2, 4, 5, C.hot); }
  if (t < 2.4) { const x = 14 + (t / 2.4) * 80; bmp(frame((G.t * 10 | 0) % 2 ? 'runA' : 'runB'), SP, x - 8, fy - 20, false, 1); }
  if (t >= 3.2 && t < 5.7) text(String(3 - Math.min(2, Math.floor((t - 3.2) / .8))), W / 2, Math.max(10, fy - 130), C.signal, { font:PEG5, k:5, align:'center' });
  if (t > 7.6) { const a = Math.min(1, (t - 7.6) / .8), b = Math.min(1, Math.max(0, (t - 8.6) / .8));
    text('SAME ROLE.'.slice(0, Math.ceil(a * 10)), W / 2, H * .36, C.cream, { font:PEG5, k:2, align:'center' });
    text('HIGHER ALTITUDE.'.slice(0, Math.ceil(b * 16)), W / 2, H * .36 + 20, C.signal, { font:PEG5, k:1, align:'center' }); }
}

/* ---------- ending two: go back down and fix it ---------- */
const FIXES = 5;
const AFTER = [
  { who:'kev', name:'Kevin, Partnerships', text:'Is there oat milk?', react:'+1 reaction' },
  { who:'lin', name:'Linda, Governance', text:'Finally.', react:'+1 reaction' },
  { who:'syn', name:'Synergy', text:'The coffee machine works.', react:'Facts: 01' },
];
let fix = null;
export function enterCoffee() {
  fix = { t:0, phase:'walk', n:0, i:0, typed:0, done:false, jolt:0 };
  Score.setLevel(0); Score.duck(false); G.fade = 1;
  $('say').hidden = false; $('sayWho').textContent = 'Synergy'; $('sayLine').textContent = FACT; $('sayR').textContent = ''; $('sayHint').textContent = '';
}
function paintFix() {
  const f = fix;
  if (f.phase === 'fix') { $('sayWho').textContent = 'Synergy'; $('sayLine').textContent = ['It is the filter.', 'It was always the filter.', 'Nobody looked.', 'Almost.', 'One more.'][Math.min(4, f.n)];
    $('sayR').textContent = `Fixed ${f.n} of ${FIXES}`; $('sayHint').textContent = 'Tap or press space to fix'; }
  else if (f.phase === 'talk') { const s = AFTER[f.i]; $('sayWho').textContent = s.name; $('sayLine').textContent = s.text.slice(0, f.typed | 0); $('sayR').textContent = f.done ? s.react : ''; $('sayHint').textContent = 'Tap or press space'; }
}
export function advanceCoffee() {
  const f = fix; if (!f) return;
  if (f.phase === 'fix') {
    f.n++; f.jolt = .12; Score.accent('fix', f.n); sparks(121, G.H - sayUnits() - 12 - 30, 5, false);
    if (f.n >= FIXES) { f.phase = 'pour'; f.t = 0; Score.accent('pour'); $('sayLine').textContent = '…'; $('sayR').textContent = ''; $('sayHint').textContent = ''; }
    else paintFix();
  } else if (f.phase === 'talk') {
    const s = AFTER[f.i];
    if (!f.done) { f.typed = s.text.length; f.done = true; landLine(); return; }
    if (f.i < AFTER.length - 1) { f.i++; f.typed = 0; f.done = false; paintFix(); return; }
    $('say').hidden = true; G.go('end', {});
  }
}
function landLine() {
  const s = AFTER[fix.i]; paintFix();
  if (s.who !== 'syn') { G.run.reactions += 1; hud(); burst(s.who === 'kev' ? 64 : 92, G.H - sayUnits() - 60, 1, 6); Score.accent('react'); }
}
export function stepCoffee(dt) {
  const f = fix; f.t += dt; if (f.jolt > 0) f.jolt -= dt;
  if (f.phase === 'walk' && f.t > 1.5) { f.phase = 'fix'; paintFix(); }
  else if (f.phase === 'pour' && f.t > 1.5) { f.phase = 'talk'; f.i = 0; f.typed = 0; f.done = false; Score.accent('fixed');
    $('real').textContent = 'the coffee machine works.'; $('real').classList.add('fixed'); paintFix(); }
  else if (f.phase === 'talk' && !f.done) { const s = AFTER[f.i], b = f.typed | 0; f.typed += dt * 34; if ((f.typed | 0) !== b) { if ((f.typed | 0) % 2 === 0) Score.accent('type'); paintFix(); }
    if (f.typed >= s.text.length) { f.done = true; landLine(); } }
}
export function drawCoffee(final) {
  const f = fix, fy = final ? endFloor() : G.H - sayUnits() - 12, t = G.t;
  const working = final || (f && (f.phase === 'talk' || (f.phase === 'pour' && f.t > 1.1)));
  breakRoom(fy, working ? 'fixed' : 'broken');
  const sx = final ? 84 : f.phase === 'walk' ? -10 + Math.min(1, f.t / 1.4) * 94 : 84;
  const pose = !final && f.phase === 'walk' && f.t < 1.4 ? ((t * 10 | 0) % 2 ? 'runA' : 'runB') : 'idle';
  bmp(frame(pose), SP, sx, fy - 40 - (f && f.jolt > 0 ? 2 : 0), false, 2);
  if (blink()) R(sx + 14, fy - 30, 12, 4, C.visor);
  if (f && f.phase === 'fix') for (let i = 0; i < FIXES; i++) R(110 + i * 5, fy - 52, 3, 3, i < f.n ? C.led : C.ink);
  if (f && f.phase === 'pour') { const h = Math.min(8, Math.floor(f.t * 7)); R(120, fy - 32, 2, h, '#5a3b22'); }
  if (working) { R(118, fy - 27, 6, 3, C.white); for (let i = 0; i < 3; i++) R(119 + i * 2, fy - 31 - ((t * 6 + i * 3 | 0) % 5), 1, 1, C.grey); }
  if (final || (f && f.phase === 'talk')) { bmp(PERSON, KEV, 46, fy - 40, false, 2); if (final || f.i >= 1) bmp(PERSON, LIN, 20, fy - 40, false, 2);
    if (!final) { const who = AFTER[f.i].who; ticks(who === 'syn' ? sx + 16 : who === 'kev' ? 56 : 30, fy - 46, who === 'syn' ? C.cobalt : C.ink); } }
}

/* ---------- the last card's backdrop ---------- */
// The card's copy sits on the lower half, so the room is staged in the upper half.
const endFloor = () => Math.round(G.H * .44);
export function drawEnd() {
  if (G.run && G.run.ending === 'b') { drawCoffee(true); return; }
  const fy = endFloor(); breakRoom(fy, 'broken'); bmp(frame('idle'), SP, 12, fy - 40, false, 2); if (blink()) R(26, fy - 30, 12, 4, C.visor);
}
