import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SAMPLE_POST, lyricsFromPost} from './lyrics.js';
import {BAR_STEPS} from './song.js';
import {FORMS, DEFAULT_FORM, stepAt, formPlays, formOf} from './forms.js';
import {TRACKS, TRACK_ORDER, DEFAULT_TRACK, DEFAULT_CAST, trackOf} from './songbook/index.js';
import {castSong, settleCast} from './casting.js';
import {loadWords} from './voice.js';
import {prepareLady} from './lady.js';
import {Performance, render, wav, STEMS, RENDER_OFFSET} from './engine.js';
import {planToCues, toPixelProject} from './pixel-export.js';
import {SONG_TABLE} from './band.js';
import {AVAILABLE} from './voices/voice-table.js';
import {createStage} from '../pegboard/stage.js';
import {ladderWhole} from '../pegboard/choreo.js';
import {claimAudio, onAudioFocus} from '../brand/audio-focus.js';
import './allhands.css';

const BAND = {
  drums:{name:'Operations', part:'Drums'},
  bass:{name:'Pat', part:'Bass', note:'Camera off'},
  keys:{name:'Keys', part:'Keyboard'},
  guitar:{name:'Kevin', part:'Guitar'},
  voice:{name:'Synergy', part:'Vocals'},
  lady:{name:'The lady', part:'Phrases', note:'Audio only'},
};
const MODES = [['sung', 'Sung'], ['spoken', 'Spoken'], ['both', 'Both']];
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const decoder = () => new OfflineAudioContext(1, 1, 44100);
const clock = s => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

// The lady's lines as the setlist prints them, in the order she says them:
// sentence case, her payoff word in capitals ("Proud of this… TEAM.").
const said = text => text.toLowerCase().replace(/\bi('|\b)/g, 'I$1').replace(/^[^A-Za-z]*[a-z]/, c => c.toUpperCase());
function ladyLines(cast) {
  const c = cast || DEFAULT_CAST, out = [];
  if (c.ladder) out.push(said(c.ladder.display));
  if (c.tag && c.impact) out.push(`${said(c.tag.display).replace(/-$/, '…')} ${c.impact.display}`);
  for (const role of ['bend', 'sink', 'lift', 'punct', 'stop']) if (c[role]) out.push(said(c[role].display));
  return out;
}

// What the stage shows at a given step: the word being sung, its line, the
// lady's latest phrase, and Synergy's stammer before a drop.
function cueAt(plan, step) {
  let word = null, line = null, lady = null;
  for (const w of plan.words) { if (w.at > step) break; word = w; }
  for (const l of plan.lines) { if (l.from > step) break; if (step < l.to) line = l; }
  for (const e of plan.lady) { if (Math.floor(e.at) > step) break; lady = e; }
  const stammerBar = plan.form === 'soundcheck' ? 15 : -1;
  const stutter = plan.stutters.find(s => s.at <= step && step < s.at + 1) || (Math.floor(step / BAR_STEPS) === stammerBar ? plan.stutters[0] : null);
  // The most recent voice owns the screen.
  if (lady && word && word.at > lady.at) lady = null;
  if (lady && step > lady.at + lady.gate / plan.step + 4 && word && word.at <= step) lady = null;
  const bar = Math.min(plan.bars.length - 1, Math.max(0, Math.floor(step / BAR_STEPS)));
  return {word, line, stutter, lady, bar, section:plan.sections.find(s => bar >= s.from && bar < s.to)?.name || 'Outro'};
}

// The Peg Board on the stage: rebuilt when the song changes, resized with the
// stage, drawn from the audio clock while playing and as a still otherwise.
function usePegStage(canvas, plan) {
  const stage = useRef(null), [ready, setReady] = useState(0);
  useEffect(() => {
    const el = canvas.current; if (!el || !plan) return;
    const s = createStage(el, {plan, table:SONG_TABLE, reduced:reduced()});
    stage.current = s;
    const resize = () => { s.resize(el.clientWidth, el.clientHeight); setReady(n => n + 1); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    return () => { ro.disconnect(); s.dispose(); if (stage.current === s) stage.current = null; };
  }, [canvas, plan]);
  return [stage, ready];
}

function App() {
  const perf = useMemo(() => new Performance(), []);
  const [draft, setDraft] = useState(SAMPLE_POST), [post, setPost] = useState(SAMPLE_POST);
  const [song, setSong] = useState(null), [error, setError] = useState(''), [status, setStatus] = useState('loading');
  const [mode, setMode] = useState('sung'), [muted, setMuted] = useState({}), [cue, setCue] = useState(null), [elapsed, setElapsed] = useState(0);
  const [rendering, setRendering] = useState(false), [form, setForm] = useState(null), [track, setTrack] = useState(DEFAULT_TRACK);
  // Let the post choose (on by default): the post picks the song and the lady's
  // lines (casting.js). The Song picker overrides it with today's cast.
  const [auto, setAuto] = useState(true);
  const canvas = useRef(null), section = useRef('Intro'), meters = useRef({}), cueKey = useRef(''), labels = useRef(null), labelKey = useRef('');
  const lyrics = useMemo(() => { try { return lyricsFromPost(post); } catch { return null; } }, [post]);
  // Only lines the voice bank sings (voices/voice-table.js AVAILABLE): Node and the page cast the same.
  const casting = useMemo(() => auto && lyrics ? castSong(post, {available:AVAILABLE}) : null, [auto, post, lyrics]);
  // The form: the one picked, if this song plays it, else the song's own (Offsite: the river).
  const playTrack = casting ? casting.track : track, playForm = form && formPlays(form, playTrack) ? form : formOf(playTrack), cast = casting?.cast;
  const [stage, stageReady] = usePegStage(canvas, song?.plan);

  // Prepare the voice before anyone presses Play: a decode-only context needs no gesture.
  useEffect(() => {
    if (!lyrics) { setStatus('idle'); setError('Paste a post with a few words in it.'); return; }
    const control = new AbortController();
    setStatus(s => s === 'playing' ? s : 'loading'); setError('');
    const songForm = FORMS[playForm];
    loadWords(decoder(), songForm.voiced(lyrics, {track:playTrack}), {signal:control.signal})
      .then(async ({buffers, durations}) => {
        // The post's cast; a recast line with no gap in Synergy's words goes back to today's.
        const {plan, cast:played} = settleCast(songForm.arrange, lyrics, durations, {track:playTrack, cast});
        const lady = await prepareLady(decoder(), plan).catch(e => { setError(`${e.message} The band will play without her.`); return undefined; });
        if (control.signal.aborted) return;
        setSong({plan, buffers, lady, cast:played, castIn:cast}); setStatus(s => s === 'playing' ? s : 'idle');
      })
      .catch(e => {
        if (control.signal.aborted) return;
        setSong({plan:songForm.arrange(lyrics, {}, {track:playTrack, cast}), buffers:new Map(), cast, castIn:cast});
        setError(`${e.message} The band will play; Synergy will not.`); setStatus('idle');
      });
    return () => control.abort();
  }, [lyrics, playForm, playTrack, cast]);

  const stop = useCallback((next = 'idle') => { perf.stop(); setStatus(next); section.current = 'Intro'; }, [perf]);
  useEffect(() => onAudioFocus('allhands', () => stop()), [stop]);
  useEffect(() => {
    const hidden = () => { if (document.hidden && perf.running) stop(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); perf.close(); };
  }, [perf, stop]);

  async function join() {
    if (status === 'playing') { stop(); return; }
    const unlocking = perf.unlock();                 // inside the tap, before any await
    claimAudio('allhands');
    try {
      await unlocking;
      if (!song) return;
      perf.start(song.plan, song.buffers, {mode, muted}, () => setStatus('ended'), song.lady);
      setStatus('playing');
    } catch (e) { setError(e.message); }
  }

  // The stage reads the audio clock; React only hears about it when a word changes.
  useEffect(() => {
    if (status !== 'playing' || !song) return;
    let frame;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const seconds = perf.position();
      if (seconds < 0) return;
      const next = cueAt(song.plan, stepAt(song.plan, seconds)), key = `${next.word?.at}:${next.line?.id}:${next.bar}:${next.stutter?.at}:${next.lady?.at}`;
      section.current = next.section;
      if (key !== cueKey.current) { cueKey.current = key; setCue(next); }
      setElapsed(e => Math.floor(seconds * 4) !== Math.floor(e * 4) ? seconds : e);
      const levels = perf.levels();
      if (levels) for (const name of STEMS) { const m = meters.current[name]; if (m) m.style.transform = `scaleY(${Math.min(1, levels[name] * 3.2).toFixed(3)})`; }
      const board = stage.current;
      if (board) { board.draw(seconds, {analysers:perf.analysers()}); chartLabels(board.chartLabels()); }
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); chartLabels([]); for (const m of Object.values(meters.current)) if (m) m.style.transform = 'scaleY(0)'; };
  }, [status, song, perf, stage]);

  // The chart's department names, in type under its pegs. Only touched when they change.
  function chartLabels(list) {
    const key = list.map(l => `${l.label}@${l.x}`).join('|');
    if (!labels.current || key === labelKey.current) return;
    labelKey.current = key;
    labels.current.replaceChildren(...list.map(l => { const el = document.createElement('span'); el.textContent = l.label; el.style.left = `${l.x}px`; el.style.top = `${l.y}px`; el.style.width = `${l.width}px`; return el; }));
  }

  // Between performances the board holds a title.
  useEffect(() => {
    if (status === 'playing' || !stage.current) return;
    stage.current.still(status === 'ended' ? 'ADJOURNED.' : status === 'loading' ? 'WARMING UP' : 'ALL HANDS', {k:2, tone:status === 'loading' ? 'blue' : 'white'});
  }, [status, stage, stageReady]);

  function chooseTrack(id) {
    if (!auto && id === track) return;
    stop(); setCue(null); setElapsed(0); setSong(null); setTrack(id); setAuto(false);
    if (form && !formPlays(form, id)) setForm(null);
  }
  function chooseAuto() {
    if (auto) return;
    stop(); setCue(null); setElapsed(0); setSong(null); setAuto(true);
  }
  function toggle(name) { const next = {...muted, [name]:!muted[name]}; setMuted(next); perf.mute(next); }
  function chooseMode(next) { setMode(next); perf.voice(next); }
  function perform(e) {
    e.preventDefault();
    try { lyricsFromPost(draft); } catch (x) { setError(x.message); return; }
    // A new post may pick a new song: nothing plays until it is ready.
    stop(); setPost(draft); setCue(null); setElapsed(0); setSong(null);
  }
  function save(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function download(kind = 'wav') {
    if (!song || rendering) return;
    setRendering(kind);
    try {
      const audio = await render(song.plan, song.buffers, {mode, muted}, song.lady), file = wav(audio), name = `all-hands-${song.plan.track || DEFAULT_TRACK}-${song.plan.form}`;
      if (kind === 'wav') { save(file, `${name}.wav`); return; }
      // Pixel Text: every word at the moment it is sung, the downbeat at 0 s,
      // the render's 50 ms lead-in carried as the editor's audio in-point.
      const audioDataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
      const duration = Math.min(120, audio.duration - RENDER_OFFSET);
      const cues = planToCues(song.plan, undefined, {lyrics, renderOffset:0, duration, hold:.5});
      const project = toPixelProject({title:`All Hands · ${trackOf(song.plan.track).title} · ${FORMS[song.plan.form].title}`, duration, bpm:song.plan.bpm, cues, format:'portrait', audioDataUrl, audioName:`${name}.wav`, options:{hold:.5, audioOffset:RENDER_OFFSET}});
      save(new Blob([JSON.stringify(project)], {type:'application/json'}), `${name}.pixel.json`);
    } catch (e) { setError(e.message || 'The render failed. Try again.'); } finally { setRendering(false); }
  }

  const playing = status === 'playing', plan = song?.plan;
  const current = playing ? cue : null;
  const stammer = current?.stutter ? current.stutter.word.split(' ')[0].slice(0, 3).toUpperCase() + '–' : null;
  const ladyLine = current?.lady ? current.lady.display : null;
  // A fragment of her ladder ("LE") reads as the whole word, fully lit, its sounding letters accented, as on the board.
  const ladyWhole = current?.lady?.role === 'ladder' && plan ? ladderWhole(plan, current.lady) : null;
  const sections = plan?.sections || FORMS[playForm].sectionsOf(playTrack), songTrack = trackOf(playTrack);
  const sectionName = playing ? current?.section || 'Intro' : status === 'ended' ? 'Adjourned' : 'Waiting room';
  const progress = plan ? Math.min(1, Math.max(0, elapsed) / plan.duration) : 0;

  return <div className="ah" data-section={playing ? (current?.section || 'Intro') : status}>
    <header className="ah-top">
      <a href="/" className="ah-mark">linkedinbeats<span>_</span></a>
      <span className="ah-title">All Hands</span>
      <span className="ah-form">{songTrack.title} · {FORMS[playForm].title} · Not for circulation</span>
    </header>

    <section className="ah-stage" aria-label="Performance">
      <canvas ref={canvas} className="ah-board" aria-hidden="true"/>
      <div className="ah-chart-labels" ref={labels} aria-hidden="true"/>
      <div className="ah-stage-meta"><span>{sectionName}</span><span>{playing && current ? `Bar ${String(current.bar + 1).padStart(2, '0')} / ${plan.bars.length}` : `${songTrack.bpm} BPM · ${songTrack.key}`}</span></div>
      <p className="ah-line" aria-live="polite"><span className={`ah-caption ${playing && !current?.line && !ladyLine ? 'empty' : ''}`}>
        {playing && ladyLine && !stammer ? (ladyWhole ? ladyWhole.map((w, i) => <React.Fragment key={i}>{i ? ' ' : ''}<span className="sung hot">{w.text.slice(0, w.lit)}</span>{w.lit < w.text.length ? <span className="sung">{w.text.slice(w.lit)}</span> : null}</React.Fragment>) : <span className="sung">{current.lady.display}</span>)
          : playing && current?.line ? current.line.words.filter(w => !!w.repeat === (current.word?.line === current.line.id && !!current.word.repeat)).map((w, i) => <span key={i} className={current.word && w.at <= current.word.at ? 'sung' : ''}>{w.display} </span>)
          : playing ? null : status === 'ended' ? 'Synergy has ended the meeting.' : 'This meeting could have been a song.'}
      </span></p>
    </section>

    <div className="ah-transport">
      <button className={`ah-join ${playing ? 'is-live' : ''}`} onClick={join} disabled={!song && status !== 'playing'}>
        <i aria-hidden="true"/>{playing ? 'Leave meeting' : status === 'loading' ? 'Synergy is warming up…' : status === 'ended' ? 'Rejoin' : 'Join with audio'}
      </button>
      <div className="ah-timeline" aria-hidden="true">
        {sections.map(s => <div key={s.name} style={{flex:s.to - s.from}} className={current?.section === s.name && playing ? 'now' : ''}><span>{s.name}</span><b>{Array.from({length:s.to - s.from}, (_, i) => <i key={i}/>)}</b></div>)}
        <em style={{transform:`scaleX(${progress})`}}/>
      </div>
      <span className="ah-clock">{clock(elapsed)} / {clock(plan?.duration || 0)}</span>
    </div>

    {error && <p className="ah-error" role="status">{error}</p>}

    <main className="ah-desk">
      <section className="ah-band" aria-labelledby="band-title">
        <h2 id="band-title">The band</h2>
        <p className="ah-hint">Tap a player to mute them. They will not notice.</p>
        <div className="ah-tiles">
          {STEMS.map(name => <button key={name} className={`ah-tile ${muted[name] ? 'muted' : ''}`} aria-pressed={!muted[name]} aria-label={`${muted[name] ? 'Unmute' : 'Mute'} ${BAND[name].name}, ${BAND[name].part}`} onClick={() => toggle(name)}>
            <span className="ah-meter"><i ref={el => { meters.current[name] = el; }}/></span>
            <strong>{BAND[name].name}</strong>
            <span>{BAND[name].part}{BAND[name].note ? ` · ${BAND[name].note}` : ''}</span>
            <small>{muted[name] ? 'Muted' : 'Live'}</small>
          </button>)}
        </div>
      </section>

      <section className="ah-voice" aria-labelledby="voice-title">
        <h2 id="song-title">The song</h2>
        <div className="ah-songs" role="radiogroup" aria-labelledby="song-title">
          {TRACK_ORDER.map(id => { const t = TRACKS[id], on = !auto && track === id; return <button key={id} role="radio" aria-checked={on} className={on ? 'on' : ''} title={t.blurb} onClick={() => chooseTrack(id)}>
            <strong>{t.title}</strong><span>{t.bpm} BPM<br/>{t.key}</span>
          </button>; })}
          <button role="radio" aria-checked={auto} className={`ah-song-auto ${auto ? 'on' : ''}`} data-slot="casting" title="The post picks the song and the lady's lines." onClick={chooseAuto}>
            <strong>Let the post choose</strong><span>{casting ? <>The post picked<br/>{TRACKS[casting.track].title}</> : <>The song and<br/>her lines</>}</span>
          </button>
        </div>
        <p className="ah-hint ah-casting" aria-live="polite">{casting ? casting.line : songTrack.blurb}</p>
        <h2 id="form-title" className="ah-gap">The form</h2>
        <div className="ah-modes ah-forms" role="radiogroup" aria-labelledby="form-title">
          {Object.values(FORMS).map(f => { const plays = formPlays(f.id, playTrack); return <button key={f.id} role="radio" aria-checked={playForm === f.id} disabled={!plays} title={plays ? undefined : `${f.title} is ${f.tracks.map(t => trackOf(t).title).join(', ')}'s alone.`} className={playForm === f.id ? 'on' : ''} onClick={() => { if (playForm !== f.id) { stop(); setCue(null); setElapsed(0); setSong(null); setForm(f.id); } }}>{f.title}</button>; })}
        </div>
        <p className="ah-hint">{FORMS[playForm].id === 'drop60' ? `${Math.round(songTrack.drop.bars * 16 * songTrack.step)} s · the lady builds, the room drops` : FORMS[playForm].note}</p>
        <h2 id="voice-title" className="ah-gap">Synergy’s delivery</h2>
        <div className="ah-modes" role="radiogroup" aria-label="Synergy’s delivery">
          {MODES.map(([id, label]) => <button key={id} role="radio" aria-checked={mode === id} className={mode === id ? 'on' : ''} onClick={() => chooseMode(id)}>{label}</button>)}
        </div>
        <p className="ah-hint">Sung runs his voice through a vocoder: the band picks the notes. Spoken is the raw take. Switch mid-song to compare.</p>
        <button className="ah-download" onClick={() => download('wav')} disabled={!song || !!rendering}>{rendering === 'wav' ? 'Rendering…' : 'Download WAV'}</button>
        <button className="ah-download ah-download-2" onClick={() => download('pixel')} disabled={!song || !!rendering}>{rendering === 'pixel' ? 'Rendering…' : 'Download for Pixel Text'}</button>
        <p className="ah-hint">The file is the performance, note for note, with your mutes. The Pixel Text project carries the song and the exact moment every word is sung: open it in the editor.</p>
      </section>

      <form className="ah-post" onSubmit={perform} aria-labelledby="post-title">
        <h2 id="post-title">The post</h2>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={7} maxLength={3000} aria-label="LinkedIn post to perform"/>
        <div className="ah-post-actions">
          <button type="submit" disabled={draft.trim() === post.trim()}>Perform this post</button>
          {draft !== SAMPLE_POST && <button type="button" className="quiet" onClick={() => setDraft(SAMPLE_POST)}>Use the sample</button>}
        </div>
        {lyrics && <dl className="ah-setlist"><dt>Hook</dt><dd>{lyrics.hook}</dd><dt>Verses</dt>{lyrics.verses.map((v, i) => <dd key={i}>{v}</dd>)}
          {playForm === 'drop60' && <><dt>The lady</dt><dd className="ah-lady-lines">{ladyLines(song && song.castIn === cast ? song.cast : cast).join(' · ')}</dd></>}</dl>}
        <p className="ah-hint">Synergy sings only the post (and his welcome). The band answers in the lexicon.</p>
      </form>
    </main>

    <footer className="ah-foot">
      <p><b>Phase 0 asks one question.</b> Would you play this at a party? Listen on good speakers, then on a phone.</p>
      <p>Synergy: eSpeak NG through a 28-band vocoder. Strategy and Synthia: the voice bank's takes, sung in key and pixelated in your browser. The lady: 57 recorded phrases, cut at her own word boundaries. The band: synthesized live in your browser. No generated music.</p>
    </footer>
  </div>;
}

// Headless render hook for scripts/render-allhands.mjs.
window.__allhands = {
  // auto: the post picks the track and the cast, as on the page (casting.js).
  // coldOpen: the film's cold open (drop.js withColdOpen), off unless asked for.
  async render({post = SAMPLE_POST, form, track, cast, auto = false, mode = 'sung', muted = {}, bars, tune, coldOpen = false} = {}) {
    const casting = auto ? castSong(post, {track, available:AVAILABLE}) : null;
    if (casting) { track = casting.track; cast = cast ?? casting.cast; }
    const songForm = FORMS[form ?? formOf(track)] || FORMS[DEFAULT_FORM], lyrics = lyricsFromPost(post), {buffers, durations} = await loadWords(decoder(), songForm.voiced(lyrics, {track}));
    const {plan} = settleCast(songForm.arrange, lyrics, durations, {track, cast, coldOpen}), lady = await prepareLady(decoder(), plan);
    const bytes = new Uint8Array(await wav(await render(plan, buffers, {mode, muted, bars, tune}, lady)).arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
    const offset = RENDER_OFFSET - plan.timing[(bars?.[0] || 0) * BAR_STEPS];
    return {wav:btoa(s), lyrics, casting, plan:{form:plan.form, track:plan.track, trackTitle:plan.trackTitle, bpm:plan.bpm, step:plan.step, key:plan.key, offset, duration:plan.duration, marks:plan.marks, kicks:plan.kicks,
      sections:plan.sections.map(x => ({...x, start:plan.timing[x.from * BAR_STEPS], end:plan.timing[x.to * BAR_STEPS]})),
      timing:Array.from(plan.timing), choke:plan.choke ? {start:plan.choke.time, end:plan.timing[plan.choke.until], dark:plan.choke.dark, tagEnd:plan.choke.tagEnd, gap:plan.choke.gap} : null,
      coldOpen:plan.coldOpen ?? null, transports:plan.transports ?? [], stop:plan.stop ?? null,
      lines:plan.lines.map(l => ({text:l.text, bar:l.bar, kind:l.kind, words:l.words.map(w => [w.display, w.at, w.steps, +w.rate.toFixed(2), w.notes.map(n => n.midi).join('.'), +w.gate.toFixed(3)])})),
      // Everything the Pixel Text exporter needs to time every word exactly.
      words:plan.words.filter(w => w.line === -1).map(w => ({display:w.display, word:w.word, at:w.at, steps:w.steps, rate:w.rate, gate:w.gate, kind:w.kind, line:-1})),
      stutters:plan.stutters, tape:plan.tape || [],
      lady:plan.lady.map(e => ({role:e.role, rung:e.rung, display:e.display, file:e.file, at:e.at, from:e.from, to:e.to, rate:e.rate, gate:e.gate, midi:e.midi, root:e.root,
        ...(e.voice ? {voice:e.voice, key:e.key, notes:e.notes} : {}),
        start:plan.timing[Math.floor(e.at)] + (e.at - Math.floor(e.at)) * plan.step, length:+Math.min(e.gate, (e.to - e.from) / e.rate).toFixed(3)})),
      // The band's parts (band.js) and, on the river (wander.js), its layers, loops, swells and slow spans.
      band:plan.band ?? [], bandLeft:plan.bandLeft ?? [], drop:plan.drop ?? null,
      ...(plan.form === 'wander' ? {layers:plan.layers, loops:plan.loops, swells:plan.swells, slow:plan.slow, phrases:plan.phrases} : {}),
      // Her vocabulary (a setlist river: Delve.): the echoes, her clarity, the choir's syllables, the stars, the board's cap.
      ...(plan.vocab ? {vocab:plan.vocab, echoes:plan.echoes, clarity:plan.clarity, choir:plan.choir, stars:plan.stars, clearMax:plan.clearMax, fade:plan.fade, bars:plan.bars.map(b => ({index:b.index, section:b.section, chord:b.chord.name, pentatonic:b.pentatonic, energy:+b.energy.toFixed(3)}))} : {})}};
  },
};

createRoot(document.getElementById('root')).render(<App/>);
