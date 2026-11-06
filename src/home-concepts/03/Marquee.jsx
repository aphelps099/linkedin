// Homepage concept 03 · The marquee. One sign in the dark: bulbs chasing round
// its edge, the name in neon, the Peg Board as its message centre, three
// reels that spin the genre's phrases, and a bulb arrow pointing at one big
// PRESS START. The song runs the whole sign: the bulbs on the sixteenths, the
// reels on the beat, the words on the board.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowDown, ArrowUpRight, LoaderCircle, Pause, Play} from 'lucide-react';
import {Header} from '../../brand/Header.jsx';
import {SAMPLE_POST} from '../../allhands/lyrics.js';
import {FORMS, DEFAULT_FORM, stepAt} from '../../allhands/forms.js';
import {TRACKS, TRACK_ORDER, trackOf} from '../../allhands/songbook/index.js';
import {Performance} from '../../allhands/engine.js';
import {BAR_STEPS} from '../../allhands/song.js';
import {createRenderer} from '../../pegboard/renderer.js';
import {createBoard} from '../../pegboard/board.js';
import {claimAudio, onAudioFocus} from '../../brand/audio-focus.js';
import {useSong, useStage, reduced, clock} from '../song.js';
import {PHRASES, paintAttract} from '../attract.js';
import {createSign} from './sign.js';
import './marquee.css';

// The reels. Three windows that read as a post when they land.
const REELS = [
  ['HUMBLED', 'THRILLED', 'GRATEFUL', 'HONORED', 'DELIGHTED', 'BLESSED', 'EXCITED', 'PROUD'],
  ['TO ANNOUNCE', 'TO SHARE', 'AND HONORED', 'ON REPEAT', 'TO CIRCLE BACK', 'TO UNPACK', 'TO ALIGN', 'TO PIVOT'],
  ['A NEW ROLE', 'A NEW FOLDER', 'THIS JOURNEY', 'THOUGHTS?', 'FULL STOP.', 'SYNERGY', 'THE Q3 OFFSITE', 'MY TEAM'],
];
const JACKPOT_LINE = [0, 2, 3];   // HUMBLED · AND HONORED · THOUGHTS?
const BOARD_CYCLE = [
  {text:'LEARN TO SOUND LIKE LINKEDIN.', alt:'LEARN TO SOUND LIKE LINKEDIN', dur:7, faces:['peg9', 'peg5'], k:1, lines:3},
  {text:'TONIGHT: ALL HANDS', dur:3.2, k:2}, {text:'ONE POST. SIXTY SECONDS.', dur:3.4, k:2},
  {dur:3}, {text:'TWO SHOWS NIGHTLY', dur:3, k:2}, {dur:3},
];
const ADJOURNED = 5;

export default function Marquee({base = '/'}) {
  const perf = useMemo(() => new Performance(), []);
  const still = useMemo(reduced, []);
  const [status, setStatus] = useState('boot'), [trackId, setTrackId] = useState(null);
  const [cue, setCue] = useState({bar:0, section:'Intro', elapsed:0}), [error, setError] = useState(''), [fatal, setFatal] = useState('');
  const [reels, setReels] = useState([{at:0, spin:false}, {at:1, spin:false}, {at:2, spin:false}]);
  const hero = useRef(null), signEl = useRef(null), buttonEl = useRef(null), lights = useRef(null), attractCanvas = useRef(null), liveCanvas = useRef(null);
  const mode = useRef({status:'boot', at:0}), pending = useRef(false), songRef = useRef(null), barRef = useRef(-1), sectionRef = useRef('');
  const {song, track} = useSong(SAMPLE_POST, trackId);
  const stage = useStage(liveCanvas, song?.plan, {chart:false});
  const live = status === 'live', loading = status === 'loading';
  songRef.current = song;

  useEffect(() => { mode.current = {...mode.current, status, at:performance.now() / 1000, reduced:still}; }, [status, still]);
  useEffect(() => {
    if (status === 'boot') { const id = setTimeout(() => setStatus('idle'), still ? 300 : 1800); return () => clearTimeout(id); }
    if (status === 'adjourned') { const id = setTimeout(() => setStatus('idle'), ADJOURNED * 1000); return () => clearTimeout(id); }
  }, [status, still]);

  // Spin a reel and land it: the strip runs for a moment, then settles on `at`.
  const spin = useCallback((index, at, delay = 0, run = 900) => {
    setTimeout(() => setReels(r => r.map((x, i) => i === index ? {...x, spin:true} : x)), delay);
    setTimeout(() => setReels(r => r.map((x, i) => i === index ? {at, spin:false} : x)), delay + run);
  }, []);
  const spinAll = useCallback((target, stagger = 260) => target.forEach((at, i) => spin(i, at, i * stagger)), [spin]);

  // Idle: a new line lands every few seconds. Live: the reels follow the song.
  useEffect(() => {
    if (status !== 'idle' || still) return;
    const id = setInterval(() => spinAll(REELS.map(r => Math.floor(Math.random() * r.length))), 6500);
    const first = setTimeout(() => spinAll(REELS.map(r => Math.floor(Math.random() * r.length))), 1200);
    return () => { clearInterval(id); clearTimeout(first); };
  }, [status, still, spinAll]);

  const stop = useCallback((next = 'idle') => { perf.stop(); pending.current = false; setStatus(next); }, [perf]);
  useEffect(() => onAudioFocus('allhands', () => { if (perf.running) stop(); }), [perf, stop]);
  useEffect(() => {
    const hidden = () => { if (document.hidden && perf.running) stop(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); perf.close(); };
  }, [perf, stop]);

  const start = useCallback(s => {
    barRef.current = -1; sectionRef.current = '';
    setCue({bar:0, section:'Intro', elapsed:0});
    perf.start(s.plan, s.buffers, {mode:'sung', muted:{}}, () => { setStatus('adjourned'); spinAll(JACKPOT_LINE, 200); }, s.lady);
    setStatus('live');
    spinAll(REELS.map(r => Math.floor(Math.random() * r.length)), 300);
    if (s.warning) setError(s.warning);
  }, [perf, spinAll]);
  useEffect(() => { if (pending.current && song) { pending.current = false; start(song); } }, [song, start]);

  async function join() {
    if (live) { stop(); return; }
    const unlocking = perf.unlock();
    claimAudio('allhands'); setError('');
    try { await unlocking; setFatal(''); } catch (e) { setFatal(e.message); return; }
    if (song) start(song); else { pending.current = true; setStatus('loading'); }
  }
  function choose(id) {
    if (id === track) return;
    if (perf.running) { perf.stop(); pending.current = true; setStatus('loading'); }
    setTrackId(id);
  }

  // One frame for the lights and the message centre.
  useEffect(() => {
    const el = hero.current, lightsCanvas = lights.current, canvas = attractCanvas.current, screen = canvas.parentElement;
    const sign = createSign(lightsCanvas), renderer = createRenderer(canvas, {pixelRatio:Math.min(2, window.devicePixelRatio || 1)});
    const cache = new Map();
    let geo = null, board = null, frame = 0;
    const resize = () => {
      const r = el.getBoundingClientRect(), p = signEl.current.getBoundingClientRect(), b = buttonEl.current?.getBoundingClientRect();
      sign.resize(el.clientWidth, el.clientHeight);
      sign.layout({panel:{x:p.left - r.left, y:p.top - r.top, w:p.width, h:p.height}, button:b ? {x:b.left - r.left, y:b.top - r.top, w:b.width, h:b.height} : null});
      const W = screen.clientWidth, H = screen.clientHeight; if (!W || !H) return;
      // The message centre is wide and short: a finer pitch than the stage's, so the promise fits on a phone.
      const pitch = Math.max(5, Math.min(14, Math.floor(Math.min(H / 30, W / 100)))), cols = Math.floor(W / pitch), rows = Math.floor(H / pitch);
      geo = {W, H, pitch, cols, rows, ox:Math.floor((W - cols * pitch) / 2), oy:Math.floor((H - rows * pitch) / 2)};
      board = createBoard(cols, rows); renderer.resize(W, H); cache.clear();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el); ro.observe(signEl.current);
    const t0 = performance.now() / 1000, cycleLength = BOARD_CYCLE.reduce((a, s) => a + s.dur, 0);
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = performance.now() / 1000, t = now - t0, m = mode.current, since = now - m.at;
      const isLive = m.status === 'live', seconds = isLive ? perf.position() : -1;
      const plan = songRef.current?.plan;
      // The lights' mood.
      let mood = {kind:'chase', speed:7, gain:1};
      if (m.status === 'boot') mood = since < .5 ? {kind:'off'} : since < 1.2 ? {kind:'sparkle', gain:.8} : {kind:'hold', gain:1.1};
      else if (m.status === 'loading') mood = {kind:'breathe', gain:.9};
      else if (m.status === 'adjourned') mood = since < 1.2 ? {kind:'hold', gain:1.2} : {kind:'chase', speed:3, gain:Math.max(.25, 1 - (since - 1.2) / 3)};
      else if (isLive && plan && seconds >= 0) {
        const step = stepAt(plan, seconds), bar = Math.floor(step / BAR_STEPS), beat = Math.floor(step / 4);
        const section = plan.sections.find(x => bar >= x.from && bar < x.to)?.name || 'Outro';
        const levels = perf.levels(), kick = levels ? Math.min(1, levels.drums * 4) : 0;
        if (/^Drop/.test(section)) mood = {kind:'alternate', beat, gain:.9 + kick * .45};
        else if (section === 'Build') mood = {kind:'chase', speed:8 + Math.min(16, (bar - (plan.sections.find(x => x.name === 'Build')?.from || 0)) * 3), gain:1 + kick * .3};
        else if (section === 'Sink In') mood = {kind:'breathe', gain:.8};
        else if (section === 'Outro') mood = {kind:'chase', speed:4, gain:.9};
        else mood = {kind:'chase', speed:8, gain:.95 + kick * .3};
        if (plan.choke && seconds >= plan.choke.time && seconds < plan.timing[plan.choke.until]) mood = {kind:'off'};
      }
      if (m.reduced) mood = {kind:'hold', gain:.9};
      sign.draw(t, mood);

      if (board && !isLive) {
        const cycle = Math.floor(t / cycleLength); let u = t - cycle * cycleLength, seg = 0;
        while (u > BOARD_CYCLE[seg].dur && seg < BOARD_CYCLE.length - 1) { u -= BOARD_CYCLE[seg].dur; seg++; }
        const s = BOARD_CYCLE[seg], text = s.text ?? PHRASES[(cycle * 2 + seg) % PHRASES.length];
        const copy = m.status === 'boot' ? {text:'LINKEDIN BEATS', k:2, age:Math.max(0, since - .9), tone:1} : m.status === 'loading' ? {text:'WARMING UP', k:2, age:since, tone:0}
          : m.status === 'adjourned' ? (since < 2.4 ? {text:'ADJOURNED.', k:2, age:since, dur:2.4} : {text:'THANKS FOR JOINING', k:2, age:since - 2.4, dur:ADJOURNED - 2.4})
          : {text, k:s.k ?? 2, age:u, dur:s.dur, tone:s.text ? 1 : 0, lines:s.lines ?? 2, faces:s.faces};
        if (s.alt && !copy.alt && copy.text === s.text) copy.alt = s.alt;
        paintAttract(board, t, {pitch:geo.pitch, film:false, reduced:m.reduced, cache, press:false, copy, since, marginRows:{top:1, bottom:1}});
        renderer.draw(board, {pitch:geo.pitch, x:geo.ox, y:geo.oy, time:m.reduced ? 0 : t});
      }
      if (isLive && seconds >= 0 && stage.current && plan) {
        stage.current.draw(seconds, {analysers:perf.analysers()});
        const step = stepAt(plan, seconds), bar = Math.max(0, Math.floor(step / BAR_STEPS));
        const section = plan.sections.find(x => bar >= x.from && bar < x.to)?.name || 'Outro';
        if (section !== sectionRef.current) {
          // a new section: the reels turn; the drop lands the house line
          sectionRef.current = section;
          if (/^Drop/.test(section)) spinAll(JACKPOT_LINE, 160); else if (section !== 'Intro') spinAll(REELS.map(r => Math.floor(Math.random() * r.length)), 220);
        }
        if (bar !== barRef.current) { barRef.current = bar; setCue({bar, section, elapsed:seconds}); }
        else if (Math.floor(seconds) !== Math.floor(cue.elapsed)) setCue(c => ({...c, elapsed:seconds}));
      }
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); renderer.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const songTrack = trackOf(track), plan = song?.plan;
  const sections = plan?.sections || FORMS[DEFAULT_FORM].sectionsOf(track);
  const progress = plan && live ? Math.min(1, Math.max(0, cue.elapsed) / plan.duration) : 0;
  const marquee = live ? `${cue.section} · bar ${String(cue.bar + 1).padStart(2, '0')} / ${plan?.bars.length ?? 30} · Rec ${clock(cue.elapsed)}` : status === 'adjourned' ? 'Adjourned · Thanks for joining' : status === 'loading' ? 'Warming up' : `Tonight · ${songTrack.title} · ${songTrack.bpm} BPM · ${songTrack.key}`;

  return <div className="mq">
    <Header base={base} overlay onRadio={join} playing={live} loading={loading} radioError={fatal}/>
    <section className={`mq-hero is-${status}`} ref={hero} aria-labelledby="mq-title">
      <canvas ref={lights} className="mq-lights" aria-hidden="true"/>
      <div className="mq-sign" ref={signEl}>
        <div className="mq-neon" aria-hidden="true">linkedinbeats<span>_</span></div>
        <h1 id="mq-title" className="mq-sr">Learn to sound like LinkedIn. Professional development for aspiring thought leaders.</h1>
        <p className="mq-ticker" aria-live="polite"><span>{marquee}</span></p>
        <div className="mq-screen">
          <canvas ref={attractCanvas} className="mq-board" aria-hidden="true"/>
          <canvas ref={liveCanvas} className="mq-board mq-board-live" aria-hidden="true"/>
        </div>
        <div className="mq-reels" aria-hidden="true">
          {REELS.map((words, i) => <div key={i} className={`mq-reel${reels[i].spin ? ' is-spinning' : ''}`}>
            <div className="mq-strip" style={{'--at':reels[i].at, '--n':words.length}}>{[...words, ...words].map((w, j) => <span key={j}>{w}</span>)}</div>
          </div>)}
        </div>
        <div className="mq-foot">
          <div className="mq-songs" role="radiogroup" aria-label="Song">{TRACK_ORDER.map(id => { const t = TRACKS[id]; return <button key={id} type="button" role="radio" aria-checked={track === id} className={track === id ? 'on' : ''} title={t.blurb} onClick={() => choose(id)}>{t.title}</button>; })}</div>
          <button ref={buttonEl} type="button" className="mq-start" onClick={join} aria-pressed={live} data-live={live} data-loading={loading}>
            <span className="mq-start-face">{loading ? <LoaderCircle className="mq-spin" aria-hidden="true"/> : live ? <Pause aria-hidden="true"/> : <Play fill="currentColor" aria-hidden="true"/>}<b>{loading ? 'Warming up' : live ? 'Leave meeting' : status === 'adjourned' ? 'Play again' : 'Press start'}</b></span>
          </button>
          <div className={`mq-timeline${live ? ' is-live' : ''}`} aria-hidden="true">
            {sections.map(s => <div key={s.name} style={{flex:s.to - s.from}} className={live && cue.section === s.name ? 'now' : ''}><span>{s.name}</span><b>{Array.from({length:s.to - s.from}, (_, i) => <i key={i}/>)}</b></div>)}
            <em style={{transform:`scaleX(${progress})`}}/>
          </div>
        </div>
      </div>
      <div className="mq-bottom">
        <a className="mq-next" href="#mq-notes">Get certified <ArrowDown aria-hidden="true"/></a>
        <span className="mq-fine">Independent music for dependent employees · Two shows nightly · No action items</span>
      </div>
      {(fatal || error) && <p className="mq-error" role="status">{fatal || error}</p>}
    </section>

    <section id="mq-notes" className="mq-notes" aria-labelledby="mq-notes-title">
      <p className="mq-kicker">Homepage concepts · 03 · The marquee</p>
      <h2 id="mq-notes-title">One sign. Fun to watch. Press start.</h2>
      <div className="mq-notes-body">
        <p>A casino marquee in the dark. Bulbs chase round the sign, the name is neon, the Peg Board is the message centre, three reels spin the genre's phrases and land on a post, and a bulb arrow points at one big button. Idle, it is a show on its own: the board rotates the promise and tonight's bill, the reels turn every few seconds, the arrow runs.</p>
        <p>Press start and the song runs the sign. The bulbs chase on the sixteenths and alternate on the beat in the drops, the reels turn on every section and land on HUMBLED · AND HONORED · THOUGHTS? when the room drops, the lights cut on the choke and come back on BACK., and the sung words land on the board. Four songs on the bill.</p>
        <p>Nothing full-field flashes faster than twice a second. Reduced motion holds the lights steady.</p>
      </div>
      <p className="mq-links">
        <a href={`${base}home-concepts/`}>Concept 01, Attract mode <ArrowUpRight aria-hidden="true"/></a>
        <a href={`${base}home-concepts/02/`}>Concept 02, The standing meeting <ArrowUpRight aria-hidden="true"/></a>
        <a href={`${base}allhands/`}>All Hands <ArrowUpRight aria-hidden="true"/></a>
      </p>
    </section>
  </div>;
}
