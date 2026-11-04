import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SAMPLE_POST, lyricsFromPost} from './lyrics.js';
import {BAR_STEPS, STEP, BPM, KEY} from './song.js';
import {FORMS, DEFAULT_FORM, stepAt} from './forms.js';
import {loadWords} from './voice.js';
import {prepareLady} from './lady.js';
import {Performance, render, wav, STEMS, RENDER_OFFSET} from './engine.js';
import {planToCues, toPixelProject} from './pixel-export.js';
import {claimAudio, onAudioFocus} from '../brand/audio-focus.js';
import './allhands.css';

const BAND = {
  drums:{name:'Operations', part:'Drums'},
  bass:{name:'Pat', part:'Bass', note:'Camera off'},
  keys:{name:'Keys', part:'Keys'},
  guitar:{name:'Kevin', part:'Guitar'},
  voice:{name:'Synergy', part:'Vocals'},
  lady:{name:'The lady', part:'Phrases', note:'Audio only'},
};
const MODES = [['sung', 'Sung'], ['spoken', 'Spoken'], ['both', 'Both']];
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const decoder = () => new OfflineAudioContext(1, 1, 44100);
const clock = s => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

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
  if (lady && step > lady.at + lady.gate / STEP + 4 && word && word.at <= step) lady = null;
  const bar = Math.min(plan.bars.length - 1, Math.max(0, Math.floor(step / BAR_STEPS)));
  return {word, line, stutter, lady, bar, section:plan.sections.find(s => bar >= s.from && bar < s.to)?.name || 'Outro'};
}

// The post, as weather. Its own letters fill the room; the band decides how many.
function useAscii(canvas, text, perf, section) {
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const g = el.getContext('2d'), chars = (text.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ALLHANDS');
    let frame = 0, last = 0, w = 0, h = 0, dpr = 1, cell = 14;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1); w = el.clientWidth; h = el.clientHeight;
      el.width = w * dpr; el.height = h * dpr; cell = w < 640 ? 10 : 14;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    const draw = now => {
      frame = requestAnimationFrame(draw);
      if (document.hidden || now - last < 33) return;
      last = now;
      const spectrum = perf.spectrum(), still = reduced();
      const cols = Math.ceil(w / (cell * .62)), rows = Math.ceil(h / (cell * 1.25)), mid = (rows - 1) / 2;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      g.font = `500 ${cell}px "AH Mono", ui-monospace, monospace`; g.textBaseline = 'top';
      const t = still ? 0 : now / 1000, energy = new Float32Array(cols);
      for (let c = 0; c < cols; c++) {
        const x = Math.abs(c - cols / 2) / (cols / 2), bin = Math.floor(2 * (180 / 2) ** (1 - x));
        energy[c] = spectrum ? (spectrum[bin] || 0) / 255 : .5 + .12 * Math.sin(c * .31 + t * .4) - x * .2;
      }
      const drop = /^Drop/.test(section.current);
      for (let r = 0; r < rows; r++) {
        const horizon = 1 - Math.abs(r - mid) / (mid + 1);
        let line = '', sum = 0;
        for (let c = 0; c < cols; c++) {
          const v = energy[c] ** 1.4 * (.35 + horizon * 1.1) + .05 * Math.sin(r * .7 + c * .23 + t * 1.3);
          if (v > .42) { line += chars[(r * 7 + c + Math.floor(t * 6)) % chars.length]; sum += v; } else line += ' ';
        }
        const alpha = Math.min(drop ? .34 : .2, .03 + sum / cols * (drop ? .7 : .45));
        g.fillStyle = drop ? `rgba(255,255,255,${alpha})` : `rgba(242,238,230,${alpha})`;
        g.fillText(line, 0, r * cell * 1.25);
      }
    };
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); };
  }, [canvas, text, perf, section]);
}

// Set the word as large as the stage allows, measured in the real face.
function Headline({text, kind, pulse}) {
  const box = useRef(null), [size, setSize] = useState(120);
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const fit = () => {
      const g = document.createElement('canvas').getContext('2d');
      g.font = '800 100px "AH Display", Impact, sans-serif';
      const width = g.measureText(text.toUpperCase()).width || 100, room = el.clientWidth * .9, tall = el.clientHeight * .9;
      setSize(Math.max(28, Math.min(tall / .82, room / width * 100)));
    };
    fit(); document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [text]);
  return <div className="ah-headline" ref={box} aria-hidden="true"><span key={pulse} className={`ah-word ah-word-${kind}`} style={{fontSize:size}}>{text}</span></div>;
}

function App() {
  const perf = useMemo(() => new Performance(), []);
  const [draft, setDraft] = useState(SAMPLE_POST), [post, setPost] = useState(SAMPLE_POST);
  const [song, setSong] = useState(null), [error, setError] = useState(''), [status, setStatus] = useState('loading');
  const [mode, setMode] = useState('sung'), [muted, setMuted] = useState({}), [cue, setCue] = useState(null), [elapsed, setElapsed] = useState(0);
  const [rendering, setRendering] = useState(false), [form, setForm] = useState(DEFAULT_FORM);
  const canvas = useRef(null), section = useRef('Intro'), meters = useRef({}), cueKey = useRef('');
  const lyrics = useMemo(() => { try { return lyricsFromPost(post); } catch { return null; } }, [post]);

  // Prepare the voice before anyone presses Play: a decode-only context needs no gesture.
  useEffect(() => {
    if (!lyrics) { setStatus('idle'); setError('Paste a post with a few words in it.'); return; }
    const control = new AbortController();
    setStatus(s => s === 'playing' ? s : 'loading'); setError('');
    const songForm = FORMS[form];
    loadWords(decoder(), songForm.voiced(lyrics), {signal:control.signal})
      .then(async ({buffers, durations}) => {
        const plan = songForm.arrange(lyrics, durations);
        const lady = await prepareLady(decoder(), plan).catch(e => { setError(`${e.message} The band will play without her.`); return undefined; });
        if (control.signal.aborted) return;
        setSong({plan, buffers, lady}); setStatus(s => s === 'playing' ? s : 'idle');
      })
      .catch(e => {
        if (control.signal.aborted) return;
        setSong({plan:songForm.arrange(lyrics, {}), buffers:new Map()});
        setError(`${e.message} The band will play; Synergy will not.`); setStatus('idle');
      });
    return () => control.abort();
  }, [lyrics, form]);

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
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); for (const m of Object.values(meters.current)) if (m) m.style.transform = 'scaleY(0)'; };
  }, [status, song, perf]);

  useAscii(canvas, post, perf, section);

  function toggle(name) { const next = {...muted, [name]:!muted[name]}; setMuted(next); perf.mute(next); }
  function chooseMode(next) { setMode(next); perf.voice(next); }
  function perform(e) {
    e.preventDefault();
    try { lyricsFromPost(draft); } catch (x) { setError(x.message); return; }
    stop(); setPost(draft); setCue(null); setElapsed(0);
  }
  function save(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function download(kind = 'wav') {
    if (!song || rendering) return;
    setRendering(kind);
    try {
      const audio = await render(song.plan, song.buffers, {mode, muted}, song.lady), file = wav(audio), name = `all-hands-${song.plan.form}`;
      if (kind === 'wav') { save(file, `${name}.wav`); return; }
      // Pixel Text: every word at the moment it is sung, the downbeat at 0 s,
      // the render's 50 ms lead-in carried as the editor's audio in-point.
      const audioDataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
      const duration = Math.min(120, audio.duration - RENDER_OFFSET);
      const cues = planToCues(song.plan, undefined, {lyrics, renderOffset:0, duration, hold:.5});
      const project = toPixelProject({title:`All Hands · ${FORMS[form].title}`, duration, bpm:song.plan.bpm, cues, format:'portrait', audioDataUrl, audioName:`${name}.wav`, options:{hold:.5, audioOffset:RENDER_OFFSET}});
      save(new Blob([JSON.stringify(project)], {type:'application/json'}), `${name}.pixel.json`);
    } catch (e) { setError(e.message || 'The render failed. Try again.'); } finally { setRendering(false); }
  }

  const playing = status === 'playing', plan = song?.plan;
  const current = playing ? cue : null;
  const stammer = current?.stutter ? current.stutter.word.split(' ')[0].slice(0, 3).toUpperCase() + '–' : null;
  const ladyLine = current?.lady ? current.lady.display : null;
  const display = !playing ? (status === 'ended' ? 'Adjourned.' : 'All hands')
    : stammer || ladyLine || (current?.word ? current.word.display.replace(/[.,!?]+$/, '') : '·');
  const kind = !playing ? 'rest' : stammer ? 'stammer' : ladyLine ? 'lady' : current?.word?.kind || 'rest';
  const sections = plan?.sections || FORMS[form].sections;
  const sectionName = playing ? current?.section || 'Intro' : status === 'ended' ? 'Adjourned' : 'Waiting room';
  const progress = plan ? Math.min(1, Math.max(0, elapsed) / plan.duration) : 0;

  return <div className="ah" data-section={playing ? (current?.section || 'Intro') : status}>
    <header className="ah-top">
      <a href="/" className="ah-mark">linkedinbeats<span>_</span></a>
      <span className="ah-title">All Hands</span>
      <span className="ah-form">{FORMS[form].title} · Not for circulation</span>
    </header>

    <section className="ah-stage" aria-label="Performance">
      <canvas ref={canvas} className="ah-weather" aria-hidden="true"/>
      <div className="ah-stage-meta"><span>{sectionName}</span><span>{playing && current ? `Bar ${String(current.bar + 1).padStart(2, '0')} / ${plan.bars.length}` : `${BPM} BPM · ${KEY}`}</span></div>
      <Headline text={display} kind={kind} pulse={reduced() ? 0 : `${current?.word?.at}-${current?.stutter?.at}-${current?.lady?.at}`}/>
      <p className="ah-line" aria-live="polite"><span className={`ah-caption ${playing && !current?.line && !ladyLine ? 'empty' : ''}`}>
        {playing && ladyLine && !stammer ? <span className="sung">{current.lady.display}</span>
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
        <h2 id="form-title">The song</h2>
        <div className="ah-modes ah-forms" role="radiogroup" aria-labelledby="form-title">
          {Object.values(FORMS).map(f => <button key={f.id} role="radio" aria-checked={form === f.id} className={form === f.id ? 'on' : ''} onClick={() => { if (form !== f.id) { stop(); setCue(null); setElapsed(0); setSong(null); setForm(f.id); } }}>{f.title}</button>)}
        </div>
        <p className="ah-hint">{FORMS[form].note}</p>
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
        {lyrics && <dl className="ah-setlist"><dt>Hook</dt><dd>{lyrics.hook}</dd><dt>Verses</dt>{lyrics.verses.map((v, i) => <dd key={i}>{v}</dd>)}</dl>}
        <p className="ah-hint">Every sung word comes from the post. Synergy adds only his welcome and his sign-off.</p>
      </form>
    </main>

    <footer className="ah-foot">
      <p><b>Phase 0 asks one question.</b> Would you play this at a party? Listen on good speakers, then on a phone.</p>
      <p>Synergy: eSpeak NG through a 28-band vocoder. The band: synthesized live in your browser. No samples. No generated music.</p>
    </footer>
  </div>;
}

// Headless render hook for scripts/render-allhands.mjs.
window.__allhands = {
  async render({post = SAMPLE_POST, form = DEFAULT_FORM, mode = 'sung', muted = {}, bars, tune} = {}) {
    const songForm = FORMS[form] || FORMS[DEFAULT_FORM], lyrics = lyricsFromPost(post), {buffers, durations} = await loadWords(decoder(), songForm.voiced(lyrics));
    const plan = songForm.arrange(lyrics, durations), lady = await prepareLady(decoder(), plan);
    const bytes = new Uint8Array(await wav(await render(plan, buffers, {mode, muted, bars, tune}, lady)).arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
    const offset = RENDER_OFFSET - plan.timing[(bars?.[0] || 0) * BAR_STEPS];
    return {wav:btoa(s), lyrics, plan:{form:plan.form, bpm:plan.bpm, offset, duration:plan.duration,
      sections:plan.sections.map(x => ({...x, start:plan.timing[x.from * BAR_STEPS], end:plan.timing[x.to * BAR_STEPS]})),
      timing:Array.from(plan.timing), choke:plan.choke ? {start:plan.timing[plan.choke.at], end:plan.timing[plan.choke.until]} : null,
      lines:plan.lines.map(l => ({text:l.text, bar:l.bar, kind:l.kind, words:l.words.map(w => [w.display, w.at, w.steps, +w.rate.toFixed(2), w.notes.map(n => n.midi).join('.'), +w.gate.toFixed(3)])})),
      // Everything the Pixel Text exporter needs to time every word exactly.
      words:plan.words.filter(w => w.line === -1).map(w => ({display:w.display, word:w.word, at:w.at, steps:w.steps, rate:w.rate, gate:w.gate, kind:w.kind, line:-1})),
      stutters:plan.stutters, tape:plan.tape || [],
      lady:plan.lady.map(e => ({role:e.role, rung:e.rung, display:e.display, file:e.file, at:e.at, from:e.from, to:e.to, rate:e.rate, gate:e.gate,
        start:plan.timing[Math.floor(e.at)] + (e.at - Math.floor(e.at)) * STEP, length:+Math.min(e.gate, (e.to - e.from) / e.rate).toFixed(3)}))}};
  },
};

createRoot(document.getElementById('root')).render(<App/>);
