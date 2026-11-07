// Day One: the film's page. React draws the whole thread once; seek(t) then moves the camera
// and writes the few things that change (counters, "…more", Load more, the sticky bar, Doug's
// reply) straight into the DOM, from timeline.js's frameAt(t). No animation, no timers: the
// same t always gives the same frame.
//
//   window.__dayOne = {ready, layout, seek(t), seekPainted(t), renderAudio(), info()}
//   ?company=Name    the company (default Brightwick)
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import './day-one.css';
import SCRIPT from './script.json';
import AVATARS from './avatars.json';
import {prepare} from './rows.js';
import * as T from './timeline.js';
import {Context, Lockup, Commentary, CountsRow, ActionBar, CommentsHead} from './Post.jsx';
import {Comment, LoadMore} from './Comment.jsx';

const params = new URLSearchParams(location.search);
const company = params.get('company') || T.COMPANY;
const data = prepare(SCRIPT, AVATARS, company);

function Film() {
  const {post, rows, loadAfter} = data;
  const [who, ...what] = post.social_context.split(' celebrates ');
  return <div className="stage">
    <div className="viewport" id="viewport">
      <div className="content" id="content">
        <div className="feed-gap" />
        <article className="card" id="card">
          <Context who={who} what={`celebrates ${what.join(' celebrates ')}`} />
          <Lockup post={post} crops={AVATARS.crops} />
          <Commentary post={post} />
          <div id="counts-home"><CountsRow /></div>
          <div className="divider" />
          <ActionBar />
          <section className="comments">
            <CommentsHead post={post} />
            {rows.map(r => <React.Fragment key={r.n}>
              <Comment row={r} crops={AVATARS.crops} />
              {r.n === loadAfter && <LoadMore />}
            </React.Fragment>)}
          </section>
        </article>
        <div className="card-tail" />
      </div>
    </div>
    <div className="sticky" id="sticky"><CountsRow /><div className="divider" /><ActionBar /></div>
  </div>;
}

const root = createRoot(document.getElementById('root'));
flushSync(() => root.render(<Film />));

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const el = {
  viewport:$('#viewport'), content:$('#content'), sticky:$('#sticky'),
  commentary:$('.commentary'), load:$('.load'), spin:$('.load .spinner g'),
  later:$$('.comments > .c').filter(c => +c.dataset.row > data.loadAfter),
  jamie:$(`.c[data-row="${T.JAMIE_ROW}"]`), doug:$(`.c[data-row="${T.DOUG_ROW}"]`),
  reactN:$$('[data-n="reactions"]'), right:$$('[data-n="right"]'), discs:$$('[data-discs]'),
};

let last = {};
function apply(st) {
  const k = st.k, tx = 180 - 180 * k;
  let ty = T.READ_Y - st.a * k;
  if (k === 1) ty = Math.round(ty * 3) / 3;              // whole device pixels while the scale is 1
  el.content.style.transform = `matrix(${k},0,0,${k},${tx},${ty})`;
  if (st.sticky !== last.sticky || (st.sticky && k !== last.k)) {
    el.sticky.style.display = st.sticky ? 'block' : 'none';
    el.sticky.style.transform = st.sticky ? `matrix(${k},0,0,${k},${tx},0)` : '';
    el.viewport.style.clipPath = st.sticky ? `inset(${T.BAR_H * k}px 0 0 0)` : '';
  }
  if (st.expanded !== last.expanded) el.commentary.classList.toggle('open', st.expanded);
  if (st.text.reactions !== last.reactions) for (const n of el.reactN) n.textContent = st.text.reactions;
  if (st.text.right !== last.right) for (const n of el.right) n.textContent = st.text.right;
  const order = st.cluster.join();
  if (order !== last.order) for (const d of el.discs) for (const kind of st.cluster) d.appendChild(d.querySelector(`.disc-${kind}`));
  if (st.loadMore !== last.loadMore) {
    for (const c of ['pressed', 'loading', 'done']) el.load.classList.toggle(c, st.loadMore === c);
  }
  if (st.loadMore === 'loading') el.spin.setAttribute('transform', `rotate(${st.spinner} 10 10)`);
  if (st.loaded !== last.loaded) for (const c of el.later) c.classList.toggle('later', !st.loaded);
  if (st.doug !== last.doug) { el.jamie.classList.toggle('has-reply', st.doug); el.doug.classList.toggle('shown', st.doug); }
  last = {k, sticky:st.sticky, expanded:st.expanded, reactions:st.text.reactions, right:st.text.right, order, loadMore:st.loadMore, loaded:st.loaded, doug:st.doug};
}

// "…more" at a word boundary: the words that fit three lines with "…more" after them on the
// third (the way the app clamps), built once from the full text as this machine lays it out.
function buildClamp() {
  const box = el.commentary, full = box.querySelector('.commentary-text'), more = box.querySelector('.more');
  const probe = more.cloneNode(true); probe.style.cssText = 'position:absolute;visibility:hidden;'; box.appendChild(probe);
  const mw = probe.getBoundingClientRect().width; probe.remove();
  box.classList.add('open');
  const top = full.getBoundingClientRect().top, right = full.getBoundingClientRect().right, range = document.createRange();
  const walker = document.createTreeWalker(full, NodeFilter.SHOW_TEXT);
  let cut = 0, at = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const s = node.data;
    for (let j = 0; j < s.length; j++) {
      const end = at + j + 1, isEnd = j + 1 === s.length || s[j + 1] === ' ';
      if (s[j] === ' ' || !isEnd) continue;
      range.setStart(node, 0); range.setEnd(node, j + 1);
      const rects = range.getClientRects(), r = rects[rects.length - 1];
      const line = Math.round((r.top - top) / 21);
      if (line < 2 || (line === 2 && r.right + mw <= right)) cut = end;
    }
    at += s.length;
  }
  box.classList.remove('open');
  // The parts up to `cut` characters.
  const clamp = document.createElement('div'); clamp.className = 'commentary-clamp';
  let left = cut;
  for (const p of data.post.text) {
    if (left <= 0) break;
    const str = typeof p === 'string' ? p : p.mention, take = str.slice(0, left);
    left -= take.length;
    if (typeof p === 'string') clamp.appendChild(document.createTextNode(take));
    else { const m = document.createElement('span'); m.className = 'mention'; m.textContent = take; clamp.appendChild(m); }
  }
  const m = more.cloneNode(true); clamp.appendChild(m);
  box.appendChild(clamp); box.classList.add('clamped');
  return cut;
}

// Row tops in content px, measured with the fonts this machine has (SF Pro on a Mac, Inter here).
function measure() {
  const probe = {k:1, a:T.READ_Y, sticky:false, expanded:true, text:T.countsText(T.OPEN), cluster:T.clusterAt(0), loadMore:'done', loaded:true, doug:true, spinner:0};
  last = {}; apply(probe);
  el.content.style.transform = 'none';
  const base = el.content.getBoundingClientRect().top, box = n => { const r = n.getBoundingClientRect(); return {top:+(r.top - base).toFixed(3), height:+r.height.toFixed(3)}; };
  const rows = {};
  for (const c of $$('.c[data-row]')) rows[c.dataset.row] = box(c);
  const counts = box($('#counts-home .counts'));
  const card = box($('#card'));
  last = {}; apply({...probe, loadMore:'idle', loaded:false, doug:false});
  el.content.style.transform = 'none';
  const loadMore = box(el.load);
  const commentaryClamped = box(el.commentary);
  last = {};
  return {rows, counts, loadMore, card, commentaryClamped};
}

async function settleAssets() {
  await document.fonts.ready;
  await Promise.all($$('img').map(i => i.decode().catch(() => { throw Error(`Avatar ${i.src} did not load.`); })));
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// The score (score.js, the sound agent's) rendered offline, if it is there yet.
const SCORE = import.meta.glob('./score.js');
async function renderAudio(opts = {}) {
  const load = SCORE['./score.js'];
  if (!load) return null;
  const m = await load();
  const fn = m.renderAudio || m.renderScore || m.render || m.default;
  api.audioMarks = null;
  if (typeof fn !== 'function') return null;
  const out = await fn({layout:api.layout, ticks:T.ticks(), cues:T.cues(), ...opts});
  // score.js's own page call: a finished WAV (base64) and its marks.
  if (typeof out?.wav === 'string') {
    const s = atob(out.wav), u = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    api.wav = u; api.audioMarks = out.marks ?? null;
    return {sampleRate:out.sampleRate, seconds:out.seconds, loudness:out.loudness ?? null, bytes:u.length, marks:!!out.marks};
  }
  const buf = out?.buffer ?? out;
  let channels, sampleRate;
  if (buf && typeof buf.getChannelData === 'function') { sampleRate = buf.sampleRate; channels = Array.from({length:buf.numberOfChannels}, (_, i) => buf.getChannelData(i)); }
  else if (buf?.channels) ({channels, sampleRate} = buf);
  else throw Error('score.js returned no AudioBuffer or {channels, sampleRate}.');
  // A 32-bit float WAV, kept on the page for the Node side to pull in slices.
  const n = channels[0].length, nc = channels.length, bytes = new ArrayBuffer(44 + n * nc * 4), v = new DataView(bytes);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * nc * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 3, true); v.setUint16(22, nc, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * nc * 4, true); v.setUint16(32, nc * 4, true); v.setUint16(34, 32, true); w(36, 'data'); v.setUint32(40, n * nc * 4, true);
  const f = new Float32Array(bytes, 44);
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) f[i * nc + c] = channels[c][i];
  api.wav = new Uint8Array(bytes);
  return {sampleRate, channels:nc, frames:n, seconds:n / sampleRate, bytes:api.wav.length};
}
function slice(name, at, len) {
  const u = api[name].subarray(at, at + len);
  let s = '';
  for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768));
  return btoa(s);
}

const api = window.__dayOne = {
  layout:null, company, data,
  seek(t) { const st = T.frameAt(t, api.layout); apply(st); return {frame:st.frame, a:st.a, k:st.k, sticky:st.sticky, counts:st.counts}; },
  // seek, then wait two animation frames so the compositor has drawn it: a screenshot taken
  // straight after a DOM change can catch a frame mid-raster (different bytes run to run).
  seekPainted(t) { const r = api.seek(t); return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => res(r)))); },
  renderAudio, slice,
  info() {
    const cam = T.buildCamera(api.layout);
    return {company, fps:T.FPS, frames:T.FRAMES, duration:T.DURATION, layout:api.layout, notes:cam.notes, arrivals:cam.arrivals,
      segments:cam.segments.map(s => ({kind:s.kind, B0:+(s.t0 / T.BEAT).toFixed(4), B1:+(s.t1 / T.BEAT).toFixed(4)})),
      ticks:T.ticks(), cues:T.cues(), rowBeats:T.rowBeats(), hasScore:!!SCORE['./score.js']};
  },
};
api.ready = (async () => {
  await settleAssets();
  api.clampAt = buildClamp();
  api.layout = measure();
  T.buildCamera(api.layout);
  api.seek(0);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return true;
})();
