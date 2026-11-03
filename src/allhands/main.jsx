import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SAMPLE_POST, lyricsFromPost} from './lyrics.js';
import {arrange, voicedWords, SECTIONS, BARS, BAR_STEPS, STEP, stepTime, BPM, KEY} from './song.js';
import {loadWords} from './voice.js';
import {Performance, render, wav, STEMS} from './engine.js';
import {claimAudio, onAudioFocus} from '../brand/audio-focus.js';
import './allhands.css';

const BAND = {
  drums:{name:'Operations', part:'Drums'},
  bass:{name:'Pat', part:'Bass', note:'Camera off'},
  keys:{name:'Keys', part:'Keys'},
  guitar:{name:'Kevin', part:'Guitar'},
  voice:{name:'Synergy', part:'Vocals'},
};
const MODES = [['sung', 'Sung'], ['spoken', 'Spoken'], ['both', 'Both']];
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const decoder = () => new OfflineAudioContext(1, 1, 44100);
const clock = s => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

function stepAt(seconds) {
  let step = Math.floor(seconds / STEP);
  if (step % 2 && seconds < stepTime(step)) step--;
  return step;
}

// What the stage shows at a given step: the word being sung, its line, and
// the stammer before the drop.
function cueAt(plan, step) {
  let word = null, line = null;
  for (const w of plan.words) { if (w.at > step) break; word = w; }
  for (const l of plan.lines) { if (l.from > step) break; if (step < l.to) line = l; }
  const stutter = plan.stutters.find(s => s.at <= step && step < s.at + 1) || (step >= 15 * BAR_STEPS && step < 16 * BAR_STEPS ? plan.stutters[0] : null);
  const bar = Math.min(BARS - 1, Math.floor(step / BAR_STEPS));
  return {word, line, stutter, bar, section:SECTIONS.find(s => bar >= s.from && bar < s.to)?.name || 'Outro'};
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
      const drop = section.current === 'Drop';
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
  const [rendering, setRendering] = useState(false);
  const canvas = useRef(null), section = useRef('Intro'), meters = useRef({}), cueKey = useRef('');
  const lyrics = useMemo(() => { try { return lyricsFromPost(post); } catch { return null; } }, [post]);

  // Prepare the voice before anyone presses Play: a decode-only context needs no gesture.
  useEffect(() => {
    if (!lyrics) { setStatus('idle'); setError('Paste a post with a few words in it.'); return; }
    const control = new AbortController();
    setStatus(s => s === 'playing' ? s : 'loading'); setError('');
    loadWords(decoder(), voicedWords(lyrics), {signal:control.signal})
      .then(({buffers, durations}) => { setSong({plan:arrange(lyrics, durations), buffers}); setStatus(s => s === 'playing' ? s : 'idle'); })
      .catch(e => {
        if (control.signal.aborted) return;
        setSong({plan:arrange(lyrics, {}), buffers:new Map()});
        setError(`${e.message} The band will play; Synergy will not.`); setStatus('idle');
      });
    return () => control.abort();
  }, [lyrics]);

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
      perf.start(song.plan, song.buffers, {mode, muted}, () => setStatus('ended'));
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
      const next = cueAt(song.plan, stepAt(seconds)), key = `${next.word?.at}:${next.line?.id}:${next.bar}:${next.stutter?.at}`;
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
  async function download() {
    if (!song || rendering) return;
    setRendering(true);
    try {
      const file = wav(await render(song.plan, song.buffers, {mode, muted}));
      const url = URL.createObjectURL(file), a = document.createElement('a');
      a.href = url; a.download = 'all-hands-sound-check.wav'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) { setError(e.message || 'The render failed. Try again.'); } finally { setRendering(false); }
  }

  const playing = status === 'playing', plan = song?.plan;
  const current = playing ? cue : null;
  const stammer = current?.stutter && current.bar === 15 ? current.stutter.word.split(' ')[0].slice(0, 3).toUpperCase() + '–' : null;
  const display = !playing ? (status === 'ended' ? 'Adjourned.' : 'All hands')
    : stammer || (current?.word ? current.word.display.replace(/[.,!?]+$/, '') : '·');
  const kind = !playing ? 'rest' : stammer ? 'stammer' : current?.word?.kind || 'rest';
  const sectionName = playing ? current?.section || 'Intro' : status === 'ended' ? 'Adjourned' : 'Waiting room';
  const progress = plan ? Math.min(1, Math.max(0, elapsed) / plan.duration) : 0;

  return <div className="ah" data-section={playing ? (current?.section || 'Intro') : status}>
    <header className="ah-top">
      <a href="/" className="ah-mark">linkedinbeats<span>_</span></a>
      <span className="ah-title">All Hands</span>
      <span className="ah-form">Sound check 00 · Not for circulation</span>
    </header>

    <section className="ah-stage" aria-label="Performance">
      <canvas ref={canvas} className="ah-weather" aria-hidden="true"/>
      <div className="ah-stage-meta"><span>{sectionName}</span><span>{playing && current ? `Bar ${String(current.bar + 1).padStart(2, '0')} / ${BARS}` : `${BPM} BPM · ${KEY}`}</span></div>
      <Headline text={display} kind={kind} pulse={reduced() ? 0 : `${current?.word?.at}-${current?.stutter?.at}`}/>
      <p className="ah-line" aria-live="polite"><span className="ah-caption">
        {playing && current?.line ? current.line.words.filter(w => !!w.repeat === (current.word?.line === current.line.id && !!current.word.repeat)).map((w, i) => <span key={i} className={current.word && w.at <= current.word.at ? 'sung' : ''}>{w.display} </span>)
          : status === 'ended' ? 'Synergy has ended the meeting.' : 'This meeting could have been a song.'}
      </span></p>
    </section>

    <div className="ah-transport">
      <button className={`ah-join ${playing ? 'is-live' : ''}`} onClick={join} disabled={!song && status !== 'playing'}>
        <i aria-hidden="true"/>{playing ? 'Leave meeting' : status === 'loading' ? 'Synergy is warming up…' : status === 'ended' ? 'Rejoin' : 'Join with audio'}
      </button>
      <div className="ah-timeline" aria-hidden="true">
        {SECTIONS.map(s => <div key={s.name} style={{flex:s.to - s.from}} className={current?.section === s.name && playing ? 'now' : ''}><span>{s.name}</span><b>{Array.from({length:s.to - s.from}, (_, i) => <i key={i}/>)}</b></div>)}
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
        <h2 id="voice-title">Synergy’s delivery</h2>
        <div className="ah-modes" role="radiogroup" aria-label="Synergy’s delivery">
          {MODES.map(([id, label]) => <button key={id} role="radio" aria-checked={mode === id} className={mode === id ? 'on' : ''} onClick={() => chooseMode(id)}>{label}</button>)}
        </div>
        <p className="ah-hint">Sung runs his voice through a vocoder: the band picks the notes. Spoken is the raw take. Switch mid-song to compare.</p>
        <button className="ah-download" onClick={download} disabled={!song || rendering}>{rendering ? 'Rendering…' : 'Download WAV'}</button>
        <p className="ah-hint">The file is the performance, note for note, with your mutes.</p>
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
  async render({post = SAMPLE_POST, mode = 'sung', muted = {}, bars, tune} = {}) {
    const lyrics = lyricsFromPost(post), {buffers, durations} = await loadWords(decoder(), voicedWords(lyrics));
    const plan = arrange(lyrics, durations), bytes = new Uint8Array(await wav(await render(plan, buffers, {mode, muted, bars, tune})).arrayBuffer());
    let s = ''; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return {wav:btoa(s), lyrics, plan:{lines:plan.lines.map(l => ({text:l.text, bar:l.bar, words:l.words.map(w => [w.display, w.at, w.steps, +w.rate.toFixed(2), w.notes.map(n => n.midi).join('.')])}))}};
  },
};

createRoot(document.getElementById('root')).render(<App/>);
