// /videostudio/: the monitor. The draft cut composited on the audio clock, a format
// toggle (each format re-laid out, never cropped), the transport, a scrub bar in bars
// and beats with the song's sections, the cut list and the compile's lint.
// The song: a track of the song book chosen by hand, or Let the post choose (casting.js
// castSong picks the track and the lines with the voice bank's takes, as /allhands/ does); the
// sample post or a pasted one. Each track plays its own form (forms.js formOf): the Drop Edition
// opens cold (drop.js withColdOpen: the impact at frame 0, then the rewind, picture and sound
// together); Offsite plays the river, which has no impact to open on.
// Unlisted and noindex. ?format=16:9  ?scale=.5  ?av=-20 (ms)  ?f=960 (open on a frame)  ?cut=studio (the first draft)
// ?track=hustle (by hand; default: the post chooses)
// Export: Download MP4 per format, rendered offline and frame-exact (render/export.js).
import './studio.css';
import SHOTS from './media/shots.json';
import {FORMS, formOf} from '../allhands/forms.js';
import {lyricsFromPost, SAMPLE_POST} from '../allhands/lyrics.js';
import {loadWords} from '../allhands/voice.js';
import {prepareLady} from '../allhands/lady.js';
import {castSong, settleCast} from '../allhands/casting.js';
import {AVAILABLE} from '../allhands/voices/voice-table.js';
import {TRACKS} from '../allhands/songbook/index.js';
import {prepareColdOpen} from '../allhands/engine.js';
import {compile, shotIndex} from './edl/compile.js';
import {stepAtTime, barSteps, beatSteps} from './edl/anchors.js';
import {FORMATS} from './layouts.js';
import {needsProxy, mediaSource} from './media/shots.js';
import {studioFilm, SCENE_LABELS as STUDIO_LABELS} from './studio-film.js';
import {treatmentFor} from './treatments/index.js';
import {createPreview} from './render/preview.js';
import {exportFilm, exportSupport, exportName, songFeatures} from './render/export.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const FPS = 24;
const el = {
  screen:$('[data-screen]'), canvas:$('[data-canvas]'), veil:$('[data-veil]'), spec:$('[data-spec]'), perf:$('[data-perf]'),
  play:$('[data-play]'), formats:$('[data-formats]'), status:$('[data-status]'),
  bar:$('[data-bar]'), frame:$('[data-frame]'), time:$('[data-time]'), section:$('[data-section]'), layout:$('[data-layout]'), scene:$('[data-scene]'),
  layers:$('[data-layers]'), layerCount:$('[data-layer-count]'), lint:$('[data-lint]'), lintCount:$('[data-lint-count]'),
  track:$('[data-track]'), sections:$('[data-sections]'), ruler:$('[data-ruler]'), scenes:$('[data-scenes]'), cuts:$('[data-cuts]'), head:$('[data-head]'),
  mediaNote:$('[data-media-note]'),
  title:$('[data-track-title]'), kicker:$('[data-kicker]'), tracks:$('[data-tracks]'), songLine:$('[data-song-line]'), songMode:$('[data-song-mode]'), post:$('[data-post]'), postGo:$('[data-post-go]'), postSample:$('[data-post-sample]'), postSummary:$('[data-post-summary]'),
};
const ex = {formats:$('[data-export-formats]'), master:$('[data-export-master]'), progress:$('[data-export-progress]'), fill:$('[data-export-fill]'),
  phase:$('[data-export-phase]'), eta:$('[data-export-eta]'), cancel:$('[data-export-cancel]'), note:$('[data-export-note]'), files:$('[data-export-files]'), spec:$('[data-export-spec]')};
const pad = (n, w) => String(Math.max(0, n)).padStart(w, '0');
const clock = s => `${pad(Math.floor(s / 60), 2)}:${pad(Math.floor(s % 60), 2)}.${pad(Math.floor((s % 1) * 1000), 3)}`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));

// The track's own treatment (treatments/index.js: Offsite is cut with offsite-psych, every other track
// with the drop60 draft) unless ?cut=studio asks for the first draft.
const studio = params.get('cut') === 'studio';
const treatmentOf = p => studio ? {id:'studio', title:'First draft', fn:studioFilm, labels:STUDIO_LABELS} : treatmentFor(p?.track);
let SCENE_LABELS = studio ? STUDIO_LABELS : treatmentFor().labels;
const edlFor = (p, fmt) => { const t = treatmentOf(p); SCENE_LABELS = t.labels; return t.fn(p, SHOTS, {format:fmt}); };
const shots = shotIndex(SHOTS);
let format = FORMATS[params.get('format')] ? params.get('format') : '9:16';
// The song: the track by hand, or 'auto' (the post chooses its track and her lines).
let choice = TRACKS[params.get('track')] ? params.get('track') : 'auto', post = SAMPLE_POST, lyrics = lyricsFromPost(post);
// Only lines the voice bank sings (voices/voice-table.js AVAILABLE): the studio casts as /allhands/ does.
const castingOf = () => choice === 'auto' ? castSong(post, {available:AVAILABLE}) : null;
let casting = castingOf();
const songOf = () => ({track:casting ? casting.track : choice, cast:casting?.cast});
// The track's own form (forms.js formOf: Offsite plays the river, every other track the Drop Edition);
// the film opens cold only on the Drop Edition (the river has no impact to open on).
const formNow = () => FORMS[formOf(songOf().track)] ?? FORMS.drop60;
const arrange = durations => { const form = formNow(); return settleCast(form.arrange, lyrics, durations, {...songOf(), coldOpen:form.id === 'drop60'}).plan; };
let plan = arrange({}), song = {buffers:new Map(), lady:undefined};
// The band, measured: the features the export compiles with (render/export.js songFeatures),
// for this plan. Until they land the monitor draws from the plan alone and says so.
let measured = null;
let program = build(plan, format), preview = null;

function build(p, fmt) { return compile(edlFor(p, fmt), {plan:p, shots:SHOTS, ...(measured?.plan === p ? {features:measured.features} : {})}); }

// ---- the screen: the format's aspect, as large as the room allows ----------------------------
function fit() {
  const F = FORMATS[format], box = el.screen.parentElement, meta = el.spec.parentElement;
  const availW = box.clientWidth - 2 * parseFloat(getComputedStyle(box).paddingLeft), availH = box.clientHeight - meta.offsetHeight - 58;
  const narrow = innerWidth <= 820, h = narrow ? Math.min(innerHeight * .72, availW / (F.w / F.h)) : Math.max(240, availH);
  const w = Math.min(availW, h * F.w / F.h);
  el.screen.style.width = `${Math.round(w)}px`; el.screen.style.height = `${Math.round(w * F.h / F.w)}px`;
  document.documentElement.style.setProperty('--screen-w', `${Math.round(w)}px`);
  el.spec.textContent = `${format} · ${F.w}×${F.h} · 24 fps · ${treatmentOf(plan).title}`;
  // Render at the size it is seen (in quarter steps), never above the film's own size.
  const want = params.get('scale') ? +params.get('scale') : Math.min(1, Math.max(.25, Math.ceil(w * devicePixelRatio / F.w * 4) / 4));
  if (preview && preview.compositor.scale !== want) { preview.compositor.setScale(want); preview.redraw(); }
  return want;
}

// ---- the timeline ---------------------------------------------------------------------------
const pct = f => `${(100 * f / program.frames).toFixed(4)}%`;
const frameOfStep = s => Math.round(plan.timing[Math.min(plan.timing.length - 1, s)] * FPS);
function timeline() {
  const BS = barSteps(plan), QS = beatSteps(plan), bars = plan.bars.length;
  el.sections.innerHTML = plan.sections.map(s => `<span style="left:${pct(frameOfStep(s.from * BS))};width:${pct(frameOfStep(s.to * BS) - frameOfStep(s.from * BS))}"${/^Drop|Sink/.test(s.name) ? ' data-drop' : ''} data-label="${esc(s.name)}">${esc(s.name)}</span>`).join('');
  let ruler = '';
  for (let b = 0; b <= bars; b++) for (let q = 0; q < BS / QS && (b < bars || q === 0); q++) {
    const f = frameOfStep(b * BS + q * QS);
    ruler += q ? `<i style="left:${pct(f)}"></i>` : `<i data-bar style="left:${pct(f)}"></i>${b < bars && b % 2 === 0 ? `<span style="left:${pct(f)}">${b}</span>` : ''}`;
  }
  el.ruler.innerHTML = ruler;
  const scenes = new Map();
  for (const c of program.clips) {
    const k = c.scene ?? c.id;
    const s = scenes.get(k) ?? {id:k, from:Infinity, to:-Infinity};
    s.from = Math.min(s.from, c.from); s.to = Math.max(s.to, c.to); scenes.set(k, s);
  }
  // The cold open is a scene of its own: the drop's impact and the rewind, before the film's own
  // first scene starts (plan.coldOpen.resume).
  const coldEnd = plan.coldOpen ? Math.round(plan.coldOpen.resume * FPS) : 0;
  if (coldEnd > 0) for (const [k, s] of scenes) { if (s.to <= coldEnd) scenes.delete(k); else s.from = Math.max(s.from, coldEnd); }
  if (coldEnd > 0) scenes.set('cold', {id:'cold', from:0, to:coldEnd});
  const list = [...scenes.values()].sort((a, b) => a.from - b.from);
  for (let i = 0; i < list.length - 1; i++) list[i].to = Math.min(list[i].to, list[i + 1].from);
  el.scenes.innerHTML = list.map(s => {
    const mid = program.frame(Math.min(program.frames - 1, Math.floor((s.from + s.to) / 2)));
    return `<button type="button" data-from="${s.from}" data-to="${s.to}" data-label="${esc(SCENE_LABELS[s.id] ?? s.id)}" style="left:calc(${pct(s.from)} + 1px);width:calc(${pct(s.to - s.from)} - 2px)" title="${esc(SCENE_LABELS[s.id] ?? s.id)}"><b>${esc(SCENE_LABELS[s.id] ?? s.id)}</b><small>${esc(mid.layout ?? '')}</small></button>`;
  }).join('');
  const transports = new Set(program.transports.flatMap(t => [t.from, t.to]));
  el.cuts.innerHTML = program.cuts.map(f => `<i style="left:${pct(f)}"${transports.has(f) ? ' data-transport' : ''}></i>`).join('');
  sceneList = list;
  fitLabels();
}
// Labels never truncate or collide. A label sits in its own span when it fits, else in its
// deliberate short form, else it moves out to a callout lane beside its row (sections above
// the row, scenes in two lanes under the blocks) with a hairline to its span; failing that it
// keeps only its title. Short forms are written, not cut.
const SHORT = {'Cold open':'Cold', 'Grid bloom':'Bloom', 'Screen share':'Share', 'Dub delay':'Dub', 'Freeze the call':'Freeze', 'Breakout rooms':'Rooms',
  'Cell split':'Split', 'Retrigger roll':'Roll', 'Poor connection':'Lag', 'Sink In':'Sink', 'Droste dive':'Droste', 'Read that again':'Again', 'Leave meeting':'Leave',
  'Freeze':'Freeze', 'Intro':'Intro', 'Verse':'Verse', 'Build':'Build', 'Drop A':'Drop A', 'Drop B':'Drop B', 'Outro':'Outro',
  'Arrivals':'Arrive', 'The call':'Call', 'The circle':'Circle', 'Choir of glass':'Choir', 'Pegs rise':'Rise', 'The board alone':'Board', 'Clap circle':'Claps',
  'The round':'Round', 'Leave the offsite':'Leave'};
const fits = node => node.scrollWidth <= node.clientWidth + .5;
function fitLabels() {
  const lanes = (n, gap = 10) => { const ends = Array(n).fill(-Infinity); return (x, w) => { const i = ends.findIndex(e => e + gap <= x); if (i < 0) return -1; ends[i] = x + w; return i; }; };
  // Sections: in the span, short in the span, or above it.
  el.sections.querySelectorAll('em').forEach(e => e.remove());
  const secLane = lanes(1);
  for (const span of el.sections.children) {
    const full = span.dataset.label, short = SHORT[full] ?? full;
    span.removeAttribute('data-out'); span.title = '';
    span.textContent = full;
    if (fits(span)) { secLane(span.offsetLeft, span.scrollWidth); continue; }
    span.textContent = short; span.title = full;
    if (fits(span)) { secLane(span.offsetLeft, span.scrollWidth); continue; }
    span.textContent = '';
    for (const text of [full, short]) {
      const em = document.createElement('em'); em.textContent = text; span.append(em);
      if (secLane(span.offsetLeft, em.offsetWidth) === 0) { span.dataset.out = ''; break; }
      em.remove();
    }
  }
  // Scenes: in the block, short in the block, or in a lane under the blocks.
  el.scenes.querySelectorAll('.vs-callout').forEach(e => e.remove());
  const sceneLane = lanes(2);
  for (const b of el.scenes.querySelectorAll('button[data-label]')) {
    const name = b.querySelector('b'), layoutCode = b.querySelector('small'), full = b.dataset.label, short = SHORT[full] ?? full;
    b.removeAttribute('data-out');
    name.textContent = full;
    if (!fits(name)) name.textContent = short;
    if (layoutCode) layoutCode.hidden = !fits(layoutCode);
    if (getComputedStyle(name).display === 'none' || (fits(name) && name.clientWidth > 0)) continue;   // phones: only the current scene is named
    b.dataset.out = '';
    for (const text of [full, short]) {
      const c = document.createElement('span'); c.className = 'vs-callout'; c.textContent = text; c.dataset.from = b.dataset.from;
      el.scenes.append(c);
      const lane = sceneLane(b.offsetLeft, c.offsetWidth + 8);
      if (lane >= 0) { c.style.left = `${b.offsetLeft}px`; c.style.top = `${44 + lane * 16}px`; c.style.setProperty('--lead', `${6 + lane * 16}px`); break; }
      c.remove();
    }
  }
}
let sceneList = [];
function lint() {
  const {errors, warnings} = program.lint, items = [];
  if (!errors.length) items.push(`<li class="is-clean">Clean. Nothing here blocks the export.${warnings.length ? ` <span>${warnings.length} notes below.</span>` : ''}</li>`);
  const row = (e, error, more = 0) => `<li class="${error ? 'is-error' : ''}"><span class="rule">${esc(e.rule)}</span><button type="button"${Number.isFinite(e.frame) ? ` data-seek="${e.frame}"` : ''}>${esc(e.message)}${more ? ` <span class="also">and ${more} more like it</span>` : ''}</button></li>`;
  // Warnings of one rule collapse into one line; errors are listed one by one.
  const byRule = new Map();
  for (const w of warnings) { if (!byRule.has(w.rule)) byRule.set(w.rule, []); byRule.get(w.rule).push(w); }
  const all = [...errors.map(e => row(e, true)), ...[...byRule.values()].map(list => row(list[0], false, list.length - 1))];
  items.push(...all.slice(0, 40));
  if (all.length > 40) items.push(`<li class="more">and ${all.length - 40} more</li>`);
  el.lint.innerHTML = items.join('');
  el.lintCount.textContent = `${errors.length} errors · ${warnings.length} warnings`;
}

// ---- readouts, once per drawn frame -----------------------------------------------------------
let shownFrame = -1;
function readout({f, t, stats, pool}) {
  // Bar and section are the film's own time, f/24 (the song as heard), not the moment a transport
  // shows: the cold open's frame 0 is bar 00:00 of the intro, showing the drop's impact.
  const fr = program.frame(f), step = Math.max(0, stepAtTime(plan, f / FPS)), BS = barSteps(plan), bar = Math.floor(step / BS);
  el.bar.textContent = `${pad(bar, 2)}:${pad(Math.floor(step % BS), 2)}`;
  el.frame.textContent = pad(f, 4);
  el.time.textContent = clock(Math.max(0, f / FPS));
  el.section.textContent = plan.sections.find(s => bar >= s.from && bar < s.to)?.name ?? 'Outro';
  el.layout.textContent = fr.layout ?? 'none';
  const scene = sceneList.find(s => f >= s.from && f < s.to);
  el.scene.textContent = scene ? SCENE_LABELS[scene.id] ?? scene.id : '';
  el.head.style.left = pct(f + .5);
  for (const b of el.scenes.children) b.toggleAttribute('aria-current', scene && +b.dataset.from === scene.from);
  el.perf.textContent = stats ? `${stats.ms.toFixed(1)} ms cpu · ${pool?.live ?? 0} decoding${pool?.driftP95 ? ` · drift p95 ${pool.driftP95.toFixed(2)} f` : ''}` : '';
  if (f === shownFrame) return;
  shownFrame = f;
  el.layerCount.textContent = `${fr.layers.length} layer${fr.layers.length === 1 ? '' : 's'}${fr.board.screen >= 0 && (fr.board.rect || fr.layers.some(l => l.gen === 'board')) ? ' · board' : ''}`;
  el.layers.innerHTML = fr.layers.map(l => {
    const who = l.chrome?.name ?? (l.gen === 'camera-off' ? 'Pat' : l.gen ? l.gen.replace(/^color:/, '') : l.shotId);
    const fx = l.fx.map(x => x.type).join(' · ');
    const src = l.kind === 'video' ? `${l.shotId} · ${l.reverse ? 'rev ' : ''}f${l.proxyFrame}${l.source !== 'stream' ? ` · ${l.source}` : ''}` : l.gen;
    return `<li><code title="${esc(l.cell.id)}">${esc(l.cell.id.replace('BOARD+STRIP', 'B+S'))}</code><span><b>${esc(who)}</b><small>${esc(src)}</small></span><em>${esc(fx || (l.transform.zoom !== 1 ? `zoom ${l.transform.zoom.toFixed(2)}` : ''))}</em></li>`;
  }).reverse().join('') + (fr.board.screen >= 0 && (fr.board.rect || fr.layers.some(l => l.gen === 'board')) ? `<li><code>board</code><span><b>${esc(program.board.screens[fr.board.screen].text)}</b><small>Peg Board · ${esc(program.board.screens[fr.board.screen].reveal)}</small></span><em></em></li>` : '')
    // Psych imagery on the dot grid: in the board's region, or its own tile.
    + (fr.board.psych || []).map(p => `<li><code>${esc(p.cell ?? 'board')}</code><span><b>${esc(p.look)}</b><small>Psych · ${esc(p.cue)}</small></span><em>${p.fade < 1 ? `fade ${p.fade.toFixed(2)}` : ''}</em></li>`).join('');
}

// ---- controls -------------------------------------------------------------------------------
function playing(on) {
  el.play.toggleAttribute('data-playing', on);
  el.screen.toggleAttribute('data-playing', on);
  el.play.querySelector('span').textContent = on ? 'Pause' : 'Play';
  el.play.setAttribute('aria-label', on ? 'Pause' : 'Play');
}
el.play.addEventListener('click', () => preview?.toggle()?.catch?.(e => status(e.message, 'warn')));
el.screen.addEventListener('click', () => { if (!el.play.disabled) preview?.toggle()?.catch?.(e => status(e.message, 'warn')); });
el.formats.addEventListener('click', e => { const b = e.target.closest('[data-format]'); if (b) setFormat(b.dataset.format); });
el.lint.addEventListener('click', e => { const b = e.target.closest('[data-seek]'); if (b) preview?.seek((+b.dataset.seek + .5) / FPS); });
el.scenes.addEventListener('click', e => { const b = e.target.closest('[data-from]'); if (b) preview?.seek((+b.dataset.from + .5) / FPS); });
function setFormat(next) {
  if (next === format || !FORMATS[next]) return;
  format = next;
  for (const b of el.formats.children) b.setAttribute('aria-pressed', String(b.dataset.format === format));
  program = build(plan, format);
  preview.setProgram(program);
  fit(); timeline(); lint(); shownFrame = -1; mediaNote();
  const u = new URL(location.href); u.searchParams.set('format', format); history.replaceState(null, '', u);
}
// Scrub: the picture follows the pointer, the sound waits for the release.
let scrubbing = false;
const timeAt = e => { const r = el.track.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * program.duration; };
el.track.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; scrubbing = true; el.track.setPointerCapture(e.pointerId); preview?.scrub(timeAt(e)); });
el.track.addEventListener('pointermove', e => { if (scrubbing) preview?.scrub(timeAt(e)); });
const release = () => { if (!scrubbing) return; scrubbing = false; preview?.endScrub(); };
el.track.addEventListener('pointerup', release); el.track.addEventListener('pointercancel', release);
addEventListener('keydown', e => {
  if (!preview || e.target.closest?.('input,textarea')) return;
  const QS = beatSteps(plan);
  if (e.code === 'Space') { e.preventDefault(); preview.toggle(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const dir = e.key === 'ArrowLeft' ? -1 : 1;
    if (e.shiftKey) { const s = Math.max(0, stepAtTime(plan, preview.time) + dir * QS); preview.seek(plan.timing[Math.min(plan.totalSteps, Math.round(s / QS) * QS)] + .5 / FPS); }
    else preview.step(dir);
  }
  else if (e.key === 'Home') { e.preventDefault(); preview.seek(0); }
  else if (['1', '2', '3'].includes(e.key)) setFormat(['9:16', '1:1', '16:9'][+e.key - 1]);
});
function status(text, tone = '') { el.status.textContent = text; el.status.dataset.tone = tone; }

// ---- media: masters an iPhone cannot decode ---------------------------------------------------------
// Synergy's main plate and Synthia's listening plate have H.264 High 4:4:4 masters (shots.js
// needsProxy), so the preview and the export always read their 540p 4:2:0 proxies. Where this
// server has no proxy for one yet, the media route serves the master in its place
// (X-Videostudio-Source: master): say so, quietly, and what it costs until the upload.
const served = new Map();
let mediaToken = 0;
async function mediaNote() {
  const token = ++mediaToken;
  const used = [...new Set(program.clips.map(c => c.shotId).filter(Boolean))].map(id => shots.get(id)).filter(needsProxy);
  const masters = [];
  for (const s of used) {
    if (!served.has(s.id)) served.set(s.id, mediaSource(s));
    const src = await served.get(s.id);
    if (src === 'master' || src === 'none') masters.push(s);
  }
  if (token !== mediaToken) return;
  el.mediaNote.hidden = !masters.length;
  const names = masters.map(s => `${s.characters[0] ?? 'A shot'}\u2019s ${s.action.includes('listen') ? 'listening ' : ''}plate`);
  el.mediaNote.textContent = masters.length ? `${names.join(' and ')} ${masters.length > 1 ? 'play from their' : 'plays from its'} H.264 4:4:4 master${masters.length > 1 ? 's: their 540p proxies are' : ': its 540p proxy is'} not on this server yet. A computer shows ${masters.length > 1 ? 'them' : 'it'}; an iPhone or iPad cannot decode ${masters.length > 1 ? 'them' : 'it'}, and an export needs several times the memory, until the proxies are uploaded.` : '';
}

// ---- export: Download MP4 per format ---------------------------------------------------------
let exporting = null, songReady = false, fileUrls = [];
const PHASES = {audio:'Rendering the band', sound:'Encoding the sound', picture:'Compositing', finishing:'Writing the file', done:'Saved'};
const minutes = s => s >= 90 ? `${Math.round(s / 60)} min left` : `${Math.max(1, Math.round(s))} s left`;
function exportState() {
  for (const b of ex.formats.children) b.disabled = !!exporting || !songReady;
  for (const b of el.tracks.children) b.disabled = !!exporting;
  el.postGo.disabled = !!exporting;
  ex.progress.hidden = !exporting;
  ex.spec.textContent = `H.264 · 24 fps · ${ex.master.checked ? 24 : 8} Mbps`;
}
function save(blob, name) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
  fileUrls.push(url);
  return url;
}
async function download(fmt) {
  if (exporting || !songReady) return;
  if (preview?.playing) preview.pause();
  const ac = new AbortController();
  exporting = ac; exportState();
  ex.files.hidden = true; ex.fill.style.width = '0%'; ex.phase.textContent = PHASES.audio; ex.eta.textContent = '';
  fileUrls.forEach(u => URL.revokeObjectURL(u)); fileUrls = [];
  try {
    const out = await exportFilm({edl:edlFor(plan, fmt), plan, shots:SHOTS, song, format:fmt, master:ex.master.checked, signal:ac.signal, features:measured?.plan === plan ? measured.features : undefined,
      onProgress:p => {
        ex.fill.style.width = `${(100 * p.fraction).toFixed(1)}%`;
        ex.phase.textContent = p.phase === 'picture' ? `Frame ${p.frame.toLocaleString('en-US')} of ${p.frames.toLocaleString('en-US')}` : PHASES[p.phase] ?? '';
        ex.eta.textContent = p.phase === 'picture' && p.frame > 24 ? minutes(p.eta) : '';
      }});
    const name = exportName(plan, fmt);
    save(new Blob([out.mp4], {type:'video/mp4'}), name);
    const vtt = URL.createObjectURL(new Blob([out.vtt], {type:'text/vtt'})), json = URL.createObjectURL(new Blob([JSON.stringify(out.sidecar, null, 1)], {type:'application/json'}));
    fileUrls.push(vtt, json);
    ex.files.innerHTML = `<span>${esc(name)} · ${(out.mp4.length / 2 ** 20).toFixed(1)} MB</span><a href="${vtt}" download="${esc(name.replace(/\.mp4$/, '.vtt'))}">Captions</a><a href="${json}" download="${esc(name.replace(/\.mp4$/, '.json'))}">Sidecar</a>`;
    ex.files.hidden = false;
    status(`Exported ${fmt} in ${Math.round(out.sidecar.stats.seconds.total)} s.`);
  } catch (e) {
    status(e.name === 'AbortError' ? 'Export cancelled.' : e.message, e.name === 'AbortError' ? '' : 'warn');
  } finally {
    exporting = null; exportState();
  }
}
ex.formats.addEventListener('click', e => { const b = e.target.closest('[data-export]'); if (b) download(b.dataset.export); });
ex.cancel.addEventListener('click', () => exporting?.abort());
ex.master.addEventListener('change', exportState);
exportSupport().then(s => {
  if (!s.video) { ex.note.textContent = s.note; ex.note.dataset.tone = 'warn'; for (const b of ex.formats.children) b.hidden = true; return; }
  ex.note.textContent = s.fallback ? 'No AAC encoder in this browser, so the sound is Opus inside the MP4. Browsers and phones play it.' : 'AAC sound, captions and a sidecar with the cut\u2019s hashes.';
});
exportState();

// ---- start ----------------------------------------------------------------------------------
async function start() {
  for (const b of el.formats.children) b.setAttribute('aria-pressed', String(b.dataset.format === format));
  const scale = fit();
  timeline(); lint(); mediaNote();
  try {
    preview = createPreview({canvas:el.canvas, program, plan, shots, song, scale, avOffset:(+params.get('av') || 0) / 1000});
  } catch (e) {
    el.veil.querySelector('span').textContent = 'This browser cannot draw the monitor (WebGL2).';
    status(e.message, 'warn');
    return;
  }
  window.__studio = {get preview() { return preview; }, get program() { return program; }, get plan() { return plan; }, get song() { return song; }, get features() { return measured?.features ?? null; }, shots:SHOTS, edlFor,
    choose:id => choose(id), cut:text => cutPost(text), get casting() { return casting; }};
  preview.on(d => { readout(d); playing(d.playing); });
  await preview.ready;
  if (params.get('f')) preview.seek((+params.get('f') + .5) / FPS);
  el.veil.hidden = true;
  el.play.disabled = false;
  addEventListener('resize', () => { fit(); fitLabels(); });
  await loadSong();
}

// ---- the song: track, post, voice, lady, the cold open --------------------------------------------
// The voice, then the lady: the plan re-arranges on Synergy's real word lengths, then the cold
// open's sound is cut from the track's own render so the preview opens on the impact too.
let loading = 0;
async function loadSong() {
  const token = ++loading, stale = () => token !== loading;
  songReady = false; exportState(); songUI();
  window.__studio.ready = false;
  status('Tuning Synergy');
  const decoder = new OfflineAudioContext(1, 1, 44100), {track} = songOf();
  try {
    const {buffers, durations} = await loadWords(decoder, formNow().voiced(lyrics, {track}));
    if (stale()) return;
    const next = arrange(durations);
    const lady = await prepareLady(decoder, next).catch(() => undefined);
    if (stale()) return;
    plan = next; song = {buffers, lady}; measured = null; program = build(plan, format);
    preview.setSong(plan, song, program);
    timeline(); lint(); shownFrame = -1; mediaNote();
    await measure(lady ? 'Ready. The band, Synergy and the lady, measured to the frame.' : 'Ready. The lady is out of the office; the band plays on.', lady ? '' : 'warn', token);
  } catch (e) {
    if (stale()) return;
    const lady = await prepareLady(decoder, plan).catch(() => undefined);
    song = {buffers:new Map(), lady};
    preview.setSong(plan, song, program);
    await measure('Synergy could not be reached. The band plays without him.', 'warn', token);
  }
  if (stale()) return;
  // The cold open's sound for the live preview (the export renders its own).
  if (plan.coldOpen) prepareColdOpen(plan, song.buffers, song.lady).then(parts => { if (!stale() && parts) { song = {...song, coldOpen:parts}; preview.setSong(plan, song, program); } }).catch(() => {});
  window.__studio.ready = true;
  songReady = true; exportState();
}
function songUI() {
  const t = TRACKS[songOf().track];
  el.title.textContent = t?.title ?? 'Circle Back';
  // The form the track plays: the Drop Edition, or the river (Offsite).
  if (el.kicker) el.kicker.textContent = `${formNow().id === 'wander' ? 'The river' : 'Drop Edition 60'} · Draft cut`;
  document.title = `Video Studio · ${t?.title ?? 'Circle Back'} · LinkedIn Beats`;
  for (const b of el.tracks.children) b.setAttribute('aria-checked', String(b.dataset.track === choice));
  el.songMode.textContent = casting ? 'The post chooses' : 'By hand';
  el.songLine.textContent = casting ? casting.line : `${t?.title ?? 'Circle Back'}, chosen by hand. The lady keeps today\u2019s lines.`;
  el.postSummary.textContent = post === SAMPLE_POST ? 'The sample' : post.replace(/\s+/g, ' ').slice(0, 48);
  el.postSample.hidden = el.post.value === SAMPLE_POST;
}
function choose(id) {
  if (id === choice || exporting || (id !== 'auto' && !TRACKS[id])) return;
  choice = id; casting = castingOf();
  const u = new URL(location.href); if (id === 'auto') u.searchParams.delete('track'); else u.searchParams.set('track', id); history.replaceState(null, '', u);
  restart();
}
function cutPost(text) {
  const next = String(text ?? '').trim();
  let l = null; try { l = lyricsFromPost(next); } catch {}
  if (!l || exporting) { status('That post has too few words to sing. Paste a few sentences.', 'warn'); return; }
  post = next; lyrics = l; casting = castingOf();
  restart();
}
// A new song: the preview stops, the plan re-arranges, the film recompiles at the top.
function restart() {
  if (preview?.playing) preview.pause();
  plan = arrange({}); song = {buffers:new Map(), lady:undefined}; measured = null; program = build(plan, format);
  preview.setSong(plan, song, program); preview.seek(0);
  fit(); timeline(); lint(); shownFrame = -1; mediaNote();
  loadSong();
}
el.tracks.addEventListener('click', e => { const b = e.target.closest('[data-track]'); if (b) choose(b.dataset.track); });
el.post.value = SAMPLE_POST;
el.post.addEventListener('input', () => { el.postSample.hidden = el.post.value === SAMPLE_POST; });
el.postGo.addEventListener('click', () => cutPost(el.post.value));
el.postSample.addEventListener('click', () => { el.post.value = SAMPLE_POST; cutPost(SAMPLE_POST); });
// Render the song offline, the way the export does, then recompile on the real mix and swap
// the program in at the same moment. Until then the borders and Synergy's mouth follow the
// plan's own levels.
async function measure(done, tone, token = loading) {
  status('Measuring the band', 'measuring');
  const p = plan;
  try {
    const features = await songFeatures(p, song);
    if (p !== plan || token !== loading) return;
    measured = {plan:p, features};
    program = build(plan, format);
    preview.setProgram(program);
    timeline(); lint(); shownFrame = -1; mediaNote();
    window.__studio.measured = true;
    status(done, tone);
  } catch (e) {
    status(`${done} The mix could not be measured, so the picture follows the plan.`, 'warn');
  }
}
status('Tuning Synergy');
start();
