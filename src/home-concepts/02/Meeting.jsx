// Homepage concept 02 · The standing meeting. The hero is a LinkedIn Beats
// meeting, and the carousel is its agenda. Four items: the waiting room with
// the board sharing its screen; the post performed by the band, every tile on
// its own stem; the performance review, typed into the chat by HR; and the
// certificate, printed by the printer. Real plates, the All Hands engine, the
// Peg Board, the roast engine and the certificate art, in one window.
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, ArrowUpRight, LoaderCircle, MessageSquare, Mic, MicOff, MonitorUp, Pause, Play, Video, Volume2} from 'lucide-react';
import {Header} from '../../brand/Header.jsx';
import {FORMS, DEFAULT_FORM, stepAt} from '../../allhands/forms.js';
import {TRACKS, TRACK_ORDER, trackOf} from '../../allhands/songbook/index.js';
import {Performance} from '../../allhands/engine.js';
import {BAR_STEPS} from '../../allhands/song.js';
import {pitchFor} from '../../pegboard/stage.js';
import {createRenderer} from '../../pegboard/renderer.js';
import {createBoard} from '../../pegboard/board.js';
import {claimAudio, onAudioFocus} from '../../brand/audio-focus.js';
import {roastIt} from '../../roast/roastEngine.js';
import {certificateMarkup, certificateName} from '../../program/components/certificate-art.js';
import wordmark from '../../../public/home-2/brand/wordmark-horizontal.svg?raw';
import monogram from '../../../public/home-2/brand/monogram.svg?raw';
import tracking from '../../meeting-room/robot-tracking.json';
import {useSong, useStage, reduced, clock} from '../song.js';
import {PHRASES, paintAttract} from '../attract.js';
import './meeting.css';

const MEDIA = '/studio/season/';
export const DEFAULT_POST = `Thrilled to announce that after 14 months of relentless hustle I have been promoted to Senior Associate.

Humbled. Honored. Grateful for this incredible journey. Couldn't have done it without my amazing team.

Big lesson: leaders eat last, but they also eat. Let that sink in. Agree?

#Blessed #Leadership #Hustle`;

// Who is in the room. `clip` is the approved season plate; `hit` the plate's
// measured stroke period in seconds, so an instrument can be conformed to the
// song's tempo; `stem` the All Hands stem that lights the tile.
const CAST = [
  {id:'synergy', name:'Synergy', role:'Host', clip:'synergy-camera-v2-listening', crop:[97, 0, 1056, 684], robot:true, stem:'voice', gain:5},
  {id:'guitar', name:'Kevin', role:'Partnerships', clip:'guitar-playing', crop:[0, 22, 1280, 664], hit:.25, stem:'guitar', gain:7, instrument:'Guitar'},
  {id:'keys', name:'Keys', role:'Enablement', clip:'keys-full-playing', crop:[160, 60, 960, 540], hit:.4375, stem:'keys', gain:5, instrument:'Keyboard'},
  {id:'operations', name:'Operations', role:'Operational excellence', clip:'drums-playing', crop:[132, 0, 1014, 685], hit:.25, stem:'drums', gain:4, instrument:'Drum pad'},
  {id:'people', name:'People & Culture', role:'Human resources', clip:'people-listening', speaking:'people-speaking', crop:[132, 0, 1014, 686]},
  {id:'printer', name:'Printer', role:'Deliverables', clip:'printer-printing', crop:[0, 0, 1280, 686], silent:true},
  {id:'lady', name:'The lady', role:'Phrases', audioOnly:true, stem:'lady', gain:5},
  {id:'pat', name:'Pat', role:'Thought leadership', offline:true, stem:'bass', gain:4},
];
const byId = Object.fromEntries(CAST.map(c => [c.id, c]));
// The plates carry baked black bars and a name strip; the camera shows only the picture.
const camera = crop => { if (!crop) return undefined; const [x, y, w, h] = crop; return {width:`${1280 / w * 100}%`, height:`${720 / h * 100}%`, left:`${-x / w * 100}%`, top:`${-y / h * 100}%`}; };

// The agenda. Each item is a scene of the same call.
const SCENES = [
  {id:'welcome', title:'Welcome', line:'Learn to sound like LinkedIn.', sub:'Professional development for aspiring thought leaders.', cta:'join'},
  {id:'perform', title:'Your post, performed', line:'Your post. Performed.', sub:'Every sung word comes from the post. Four songs, sixty seconds each.', cta:'join'},
  {id:'review', title:'Performance review', line:'Your personal brand, reviewed.', sub:'Documented. Specific. Going in your file.', cta:'roast'},
  {id:'certify', title:'Certification', line:'Get certified.', sub:'Five short courses. One very official-looking certificate.', cta:'learn'},
];
const ATTRACT_ORDER = [0, 2, 3], ATTRACT_HOLD = 9.5, ADJOURN_HOLD = 1.6;
const BOARD_CYCLE = [{text:'ALL HANDS', dur:4.5, tone:1}, {dur:3.2}, {dur:3.2}];

// Synergy's mouth: one fixed-height green row on the tracked display, as in the
// meeting room. Vocal level changes brightness only.
function robotFrame(id, time) {
  const track = tracking[id], index = Math.max(0, Math.min(track.frames.length - 1, time * track.fps));
  const a = track.frames[Math.floor(index)], b = track.frames[Math.min(track.frames.length - 1, Math.ceil(index))];
  return a.map((value, i) => value + (b[i] - value) * (index - Math.floor(index)));
}
function drawRobotMouth(ctx, id, videoTime, audioTime, level) {
  ctx.clearRect(0, 0, 1280, 720);
  const [x, y, angle, scale] = robotFrame(id, videoTime);
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
  const height = 6, phase = (audioTime * 15) % 22;
  ctx.shadowColor = '#4aff70'; ctx.shadowBlur = 2;
  for (let i = 0; i < 22; i++) {
    const distance = (phase - i + 22) % 22, strength = level > .08 ? Math.max(.16, (1 - distance / 7) * level) : .11;
    ctx.fillStyle = `rgba(74,255,112,${strength})`;
    ctx.fillRect(-46 + i * 4.3, -height / 2, 3.2, height);
  }
  ctx.restore();
}

// A plate's playback rate so its strokes land on the song's grid: the closest
// subdivision of the beat, within 15 percent, else untouched.
function conform(hit, bpm) {
  if (!hit) return 1;
  const beat = 60 / bpm;
  let best = 1, err = Infinity;
  for (const sub of [1, 2, 4]) { const r = hit / (beat / sub); if (Math.abs(r - 1) < err) { err = Math.abs(r - 1); best = r; } }
  return err <= .15 ? best : 1;
}
const hash = text => { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };

const Tile = memo(function Tile({c, moving, speaking, spotlight, register, children}) {
  const video = useRef(null);
  const clip = c.speaking && speaking ? c.speaking : c.clip;
  useEffect(() => {
    const v = video.current; if (!v) return;
    if (moving) v.play().catch(() => {}); else v.pause();
  }, [moving, clip]);
  return <div className={`mt-tile${c.audioOnly ? ' is-audio' : ''}${c.offline ? ' is-off' : ''}${spotlight ? ' is-spot' : ''}`} data-id={c.id} ref={el => register(c.id, 'el', el)} style={{'--lvl':0}}>
    {clip && <div className="mt-cam">
      <img className="mt-poster" src={`${MEDIA}posters/${clip}.jpg`} alt="" loading="eager" style={camera(c.crop)}/>
      <video key={clip} ref={el => { video.current = el; register(c.id, 'video', el); }} src={moving ? `${MEDIA}clips/${clip}.mp4` : undefined} muted loop playsInline disablePictureInPicture preload="none" aria-hidden="true" style={camera(c.crop)}/>
      {c.robot && <canvas className="mt-robot" ref={el => register(c.id, 'canvas', el)} width="1280" height="720" aria-hidden="true" style={camera(c.crop)}/>}
    </div>}
    {c.audioOnly && <div className="mt-blank"><span className="mt-wave" aria-hidden="true">{Array.from({length:14}, (_, i) => <i key={i} style={{'--i':i}}/>)}</span><strong>{c.name}</strong><span>Audio only</span></div>}
    {c.offline && <div className="mt-blank"><span className="mt-avatar">PT</span><strong>{c.name}</strong><span>Camera off</span></div>}
    {children}
    <span className="mt-top">{c.role === 'Host' && <span className="mt-role">Host</span>}{c.instrument && <span className="mt-instrument">{c.instrument}</span>}</span>
    <span className="mt-name">{c.silent || c.offline ? <MicOff aria-hidden="true"/> : <Mic aria-hidden="true"/>}<span>{c.name}<small>{c.role === 'Host' ? '' : ` · ${c.role}`}</small></span><span className="mt-dots" aria-hidden="true"><i/><i/><i/></span></span>
  </div>;
});

export default function Meeting({base = '/'}) {
  const perf = useMemo(() => new Performance(), []);
  const still = useMemo(reduced, []);
  const [scene, setScene] = useState(0), [status, setStatus] = useState('idle'), [trackId, setTrackId] = useState(null);
  const [post, setPost] = useState(DEFAULT_POST), [draft, setDraft] = useState(DEFAULT_POST), [name, setName] = useState('');
  const [cue, setCue] = useState({bar:0, section:'Intro', elapsed:0}), [error, setError] = useState(''), [fatal, setFatal] = useState('');
  const [typed, setTyped] = useState(0), [connected, setConnected] = useState(0);
  const stageEl = useRef(null), attractCanvas = useRef(null), liveCanvas = useRef(null), registry = useRef({});
  const mode = useRef({scene:0, status:'idle', at:0}), pending = useRef(false), songRef = useRef(null), barRef = useRef(-1), rates = useRef({});
  const {song, track, casting} = useSong(post, trackId);
  const stage = useStage(liveCanvas, song?.plan);
  const live = status === 'live', loading = status === 'loading', current = SCENES[scene];
  const roast = useMemo(() => roastIt({kind:'post', text:post, personaId:'recruiter', intensity:3, seed:hash(post)}), [post]);
  const certificate = useMemo(() => certificateMarkup(name || 'Aspiring Thought Leader', {wordmark, monogram}, 'mt-certificate'), [name]);
  songRef.current = song;
  const register = useCallback((id, key, el) => { (registry.current[id] ||= {})[key] = el; }, []);

  useEffect(() => { mode.current = {...mode.current, scene, status, at:performance.now() / 1000, reduced:still}; }, [scene, status, still]);

  // The room fills: one tile connects after another, then the plates move.
  useEffect(() => {
    if (still) { setConnected(CAST.length); return; }
    let n = 0;
    const id = setInterval(() => { n++; setConnected(n); if (n >= CAST.length) clearInterval(id); }, 420);
    return () => clearInterval(id);
  }, [still]);

  // The agenda advances on its own while nobody has joined; the song pins its
  // item; adjourning moves to the review.
  useEffect(() => {
    if (live || loading) { if (scene !== 1) setScene(1); return; }
    if (status === 'adjourned') { const id = setTimeout(() => { setStatus('idle'); setScene(2); }, ADJOURN_HOLD * 1000); return () => clearTimeout(id); }
    const id = setTimeout(() => setScene(s => { const i = ATTRACT_ORDER.indexOf(s); return ATTRACT_ORDER[(i < 0 ? 0 : i + 1) % ATTRACT_ORDER.length]; }), ATTRACT_HOLD * 1000);
    return () => clearTimeout(id);
  }, [scene, live, loading, status]);

  // The review types itself into the chat, one line at a time.
  useEffect(() => {
    if (scene !== 2) { setTyped(0); return; }
    const lines = 2 + roast.lines.length + 1;
    let n = 0;
    const id = setInterval(() => { n++; setTyped(n); if (n >= lines) clearInterval(id); }, still ? 200 : 1500);
    return () => clearInterval(id);
  }, [scene, roast, still]);

  const stop = useCallback((next = 'idle') => { perf.stop(); pending.current = false; setStatus(next); }, [perf]);
  useEffect(() => onAudioFocus('allhands', () => { if (perf.running) stop(); }), [perf, stop]);
  useEffect(() => {
    const hidden = () => { if (document.hidden && perf.running) stop(); };
    const key = e => {
      if (e.target.closest('input,textarea')) return;
      if (e.key === 'ArrowRight') setScene(s => (s + 1) % SCENES.length);
      if (e.key === 'ArrowLeft') setScene(s => (s + SCENES.length - 1) % SCENES.length);
    };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('keydown', key);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('keydown', key); perf.close(); };
  }, [perf, stop]);

  const start = useCallback(s => {
    barRef.current = -1; setCue({bar:0, section:'Intro', elapsed:0});
    const bpm = trackOf(s.track).bpm;
    rates.current = Object.fromEntries(CAST.filter(c => c.hit).map(c => [c.id, conform(c.hit, bpm)]));
    perf.start(s.plan, s.buffers, {mode:'sung', muted:{}}, () => setStatus('adjourned'), s.lady);
    setStatus('live'); setScene(1);
    if (s.warning) setError(s.warning);
  }, [perf]);
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
  function share(e) {
    e.preventDefault();
    const text = draft.trim(); if (!text) return;
    if (text !== post) { if (perf.running) perf.stop(); setTrackId(null); setPost(text); pending.current = true; setStatus('loading'); }
    else join();
  }

  // One frame: the shared screen (the board attracting, or the song's own
  // choreography), every tile on its stem, Synergy's mouth on his voice.
  useEffect(() => {
    const canvas = attractCanvas.current, screen = canvas.parentElement;
    const renderer = createRenderer(canvas, {pixelRatio:Math.min(2, window.devicePixelRatio || 1)});
    const cache = new Map();
    let geo = null, board = null, frame = 0;
    const resize = () => {
      const W = screen.clientWidth, H = screen.clientHeight; if (!W || !H) return;
      const pitch = pitchFor(W, H), cols = Math.floor(W / pitch), rows = Math.floor(H / pitch);
      geo = {W, H, pitch, cols, rows, ox:Math.floor((W - cols * pitch) / 2), oy:Math.floor((H - rows * pitch) / 2)};
      board = createBoard(cols, rows); renderer.resize(W, H); cache.clear();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(screen);
    const t0 = performance.now() / 1000, cycleLength = BOARD_CYCLE.reduce((a, s) => a + s.dur, 0);
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = performance.now() / 1000, t = now - t0, m = mode.current, since = now - m.at, r = registry.current;
      const isLive = m.status === 'live', seconds = isLive ? perf.position() : -1;
      if (board && !isLive) {
        const cycle = Math.floor(t / cycleLength); let u = t - cycle * cycleLength, seg = 0;
        while (u > BOARD_CYCLE[seg].dur && seg < BOARD_CYCLE.length - 1) { u -= BOARD_CYCLE[seg].dur; seg++; }
        const s = BOARD_CYCLE[seg], text = s.text ?? PHRASES[(cycle * 2 + seg - 1) % PHRASES.length];
        const copy = m.status === 'loading' ? {text:'WARMING UP', k:2, age:since, tone:0} : m.status === 'adjourned' ? {text:'ADJOURNED.', k:2, age:since} : {text, k:2, age:u, dur:s.dur, tone:s.tone ?? 0, lines:3};
        paintAttract(board, t, {pitch:geo.pitch, film:false, reduced:m.reduced, cache, press:m.status === 'idle', copy, since, marginRows:{top:3, bottom:1}});
        renderer.draw(board, {pitch:geo.pitch, x:geo.ox, y:geo.oy, time:m.reduced ? 0 : t});
      }
      if (isLive && seconds >= 0 && stage.current && songRef.current) {
        stage.current.draw(seconds, {analysers:perf.analysers()});
        const plan = songRef.current.plan, step = stepAt(plan, seconds), bar = Math.max(0, Math.floor(step / BAR_STEPS));
        if (bar !== barRef.current) { barRef.current = bar; setCue({bar, section:plan.sections.find(x => bar >= x.from && bar < x.to)?.name || 'Outro', elapsed:seconds}); }
        else if (Math.floor(seconds) !== Math.floor(cue.elapsed)) setCue(c => ({...c, elapsed:seconds}));
      }
      const levels = isLive ? perf.levels() : null;
      for (const c of CAST) {
        const reg = r[c.id]; if (!reg?.el) continue;
        const lvl = levels && c.stem ? Math.min(1, (levels[c.stem] || 0) * c.gain) : 0;
        reg.el.style.setProperty('--lvl', lvl.toFixed(2));
        if (reg.video) { const rate = isLive ? rates.current[c.id] || 1 : 1; if (Math.abs(reg.video.playbackRate - rate) > .001) reg.video.playbackRate = rate; }
        if (c.robot && reg.canvas) { const ctx = reg.canvas.getContext('2d'); if (ctx) drawRobotMouth(ctx, 'synergy', reg.video?.currentTime || .25, Math.max(0, seconds), lvl); }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); renderer.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const songTrack = trackOf(track), plan = song?.plan;
  const sections = plan?.sections || FORMS[DEFAULT_FORM].sectionsOf(track);
  const progress = plan && live ? Math.min(1, Math.max(0, cue.elapsed) / plan.duration) : 0;
  const moving = !still && connected >= CAST.length;
  const spotlight = scene === 2 ? 'people' : scene === 3 ? 'printer' : null;
  const visible = spotlight ? [byId[spotlight], byId.synergy, byId.guitar, byId.keys, byId.operations] : CAST;
  const firstWords = post.replace(/\s+/g, ' ').split(' ').slice(0, 7).join(' ');
  const chat = [
    {who:'Synergy', text:'Thanks for joining. Mics off, hearts open.'},
    {who:'Synergy', text:'Agenda: 1. Welcome. 2. Your post, performed. 3. Performance review. 4. Certification.'},
    ...(scene === 1 ? [{who:'Synergy', text:live ? `Performing “${firstWords}…” as ${songTrack.title}. ${casting?.line || ''}` : 'Paste a post below. The band will perform it.'}] : []),
    ...(scene === 2 ? [{who:'People & Culture', text:roast.opener}, ...roast.lines.map(t => ({who:'People & Culture', text:t})), {who:'People & Culture', text:roast.closer}, {who:'People & Culture', text:`Thought Leadership Index: ${roast.score.index} / 100. Rank: ${roast.score.rank}.`, verdict:true}].slice(0, typed) : []),
    ...(scene === 3 ? [{who:'Printer', text:`Printing: Certificate of Professional Effort, ${certificateName(name || '')}. 1 of 1.`}, {who:'Synergy', text:'Please retain for your records.'}] : []),
  ];

  return <div className="mt">
    <Header base={base} theme="dark" onRadio={join} playing={live} loading={loading} radioError={fatal}/>
    <section className={`mt-window is-${current.id}${live ? ' is-live' : ''}`} aria-labelledby="mt-title">
      <div className="mt-bar">
        <span><Video aria-hidden="true"/>LinkedIn Beats Meeting</span>
        <span className="mt-bar-title"><b>All Hands</b> · Learn to sound like LinkedIn</span>
        <span><i className={`mt-rec${live ? ' on' : ''}`}/>{live ? `Rec ${clock(cue.elapsed)}` : 'Hosted by Synergy'}</span>
      </div>
      <div className="mt-body">
        <div className="mt-stage" ref={stageEl}>
          <div className="mt-tools"><span>{CAST.length} in the room</span><span>{scene === 1 && live ? `${cue.section} · bar ${String(cue.bar + 1).padStart(2, '0')} / ${plan?.bars.length ?? 30}` : spotlight ? 'Speaker view' : 'Gallery view'}</span></div>
          <div className={`mt-gallery${spotlight ? ' is-spot' : ''}`}>
            <div className="mt-screen" hidden={!!spotlight}>
              <canvas ref={attractCanvas} className="mt-board" aria-hidden="true"/>
              <canvas ref={liveCanvas} className="mt-board mt-board-live" aria-hidden="true"/>
              <button type="button" className="mt-screen-tap" onClick={join} disabled={live || loading} aria-label={live ? 'The song is playing' : 'Press start: join with audio'}/>
              <span className="mt-sharing"><MonitorUp aria-hidden="true"/>Synergy is sharing a screen · All Hands board</span>
            </div>
            {visible.map((c, i) => <Tile key={c.id} c={c} moving={moving && (spotlight ? i === 0 || c.robot || c.instrument : connected > CAST.indexOf(c))} speaking={scene === 2} spotlight={spotlight === c.id} register={register}>
              {c.id === 'printer' && scene === 3 && <div className="mt-sheet" aria-hidden="true"><svg viewBox="0 0 1200 850" dangerouslySetInnerHTML={{__html:certificate}}/></div>}
              {c.id === 'people' && scene === 2 && typed > 1 && <div className="mt-stamp" aria-hidden="true">Reviewed</div>}
              {connected <= CAST.indexOf(c) && !still && <div className="mt-connecting"><LoaderCircle className="mt-spin" aria-hidden="true"/>Connecting…</div>}
            </Tile>)}
          </div>
          <div className="mt-band">
            <div className="mt-lower">
              <span className="mt-eyebrow">Agenda {String(scene + 1).padStart(2, '0')} / {String(SCENES.length).padStart(2, '0')} · {current.title}</span>
              <h1 id="mt-title">{current.line}</h1>
              <p>{current.sub}</p>
              <div className="mt-ctas">
                {current.cta === 'join' && <button type="button" className="mt-primary" onClick={join} aria-pressed={live} data-live={live}>{loading ? <LoaderCircle className="mt-spin" aria-hidden="true"/> : live ? <Pause aria-hidden="true"/> : <Play fill="currentColor" aria-hidden="true"/>}{loading ? 'Warming up' : live ? 'Leave meeting' : 'Join with audio'}</button>}
                {current.cta === 'roast' && <a className="mt-primary" href={`${base}roast/`}>Roast my post <ArrowUpRight aria-hidden="true"/></a>}
                {current.cta === 'learn' && <a className="mt-primary" href={`${base}learn/`}>Get certified <ArrowUpRight aria-hidden="true"/></a>}
                <span className="mt-dots-nav" role="group" aria-label="Agenda">{SCENES.map((s, i) => <button key={s.id} type="button" aria-label={`${i + 1}. ${s.title}`} aria-current={i === scene} onClick={() => setScene(i)}/>)}</span>
              </div>
            </div>
            <div className={`mt-transport${scene === 1 ? ' is-on' : ''}`} aria-hidden={scene !== 1}>
              <div className="mt-songs" role="radiogroup" aria-label="Song">{TRACK_ORDER.map(id => { const t = TRACKS[id]; return <button key={id} type="button" role="radio" aria-checked={track === id} className={track === id ? 'on' : ''} title={t.blurb} onClick={() => choose(id)}>{t.title}<small>{t.bpm} BPM</small></button>; })}</div>
              <div className="mt-timeline" aria-hidden="true">
                {sections.map(s => <div key={s.name} style={{flex:s.to - s.from}} className={live && cue.section === s.name ? 'now' : ''}><span>{s.name}</span><b>{Array.from({length:s.to - s.from}, (_, i) => <i key={i}/>)}</b></div>)}
                <em style={{transform:`scaleX(${progress})`}}/>
              </div>
              <span className="mt-clock">{clock(live ? cue.elapsed : 0)} / {clock(plan?.duration || 60)}</span>
            </div>
          </div>
        </div>
        <aside className="mt-panel" aria-label="Agenda and chat">
          <div className="mt-agenda">
            <h2>Agenda</h2>
            <ol>{SCENES.map((s, i) => <li key={s.id}><button type="button" aria-current={i === scene} onClick={() => setScene(i)}><span>{String(i + 1).padStart(2, '0')}</span>{s.title}<ArrowRight aria-hidden="true"/></button></li>)}</ol>
          </div>
          <div className="mt-chat">
            <h2><MessageSquare aria-hidden="true"/>Chat<span>To: Everyone</span></h2>
            <ol className="mt-messages" aria-live="polite">{chat.map((m, i) => <li key={i} className={m.verdict ? 'is-verdict' : ''}><b>{m.who}</b><span>{m.text}</span></li>)}</ol>
            <form className="mt-compose" onSubmit={share}>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name, for the certificate" aria-label="Your name" maxLength={60}/>
              <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4} maxLength={3000} aria-label="Your LinkedIn post" placeholder="Paste your post. The band will sing it."/>
              <div><button type="submit" className="mt-send">{draft.trim() !== post ? 'Share with the band' : live ? 'Leave meeting' : 'Join with audio'}</button><span>Generated in your browser. Nothing is sent anywhere.</span></div>
            </form>
          </div>
        </aside>
      </div>
      <div className="mt-toolbar">
        <div className="mt-left">
          <button type="button" className={`mt-join${live ? ' is-live' : ''}`} onClick={join}>{loading ? <LoaderCircle className="mt-spin" aria-hidden="true"/> : live ? <Pause aria-hidden="true"/> : <Play fill="currentColor" aria-hidden="true"/>}{loading ? 'Warming up' : live ? 'Leave meeting' : 'Join with audio'}</button>
          <span className="mt-tool"><Volume2 aria-hidden="true"/>Sound</span><span className="mt-tool"><MonitorUp aria-hidden="true"/>Share screen</span><span className="mt-tool"><MessageSquare aria-hidden="true"/>Chat</span>
        </div>
        <div className="mt-right">
          <button type="button" className="mt-nav" onClick={() => setScene(s => (s + SCENES.length - 1) % SCENES.length)}><ArrowLeft aria-hidden="true"/>Previous</button>
          <button type="button" className="mt-nav" onClick={() => setScene(s => (s + 1) % SCENES.length)}>Next: {SCENES[(scene + 1) % SCENES.length].title}<ArrowRight aria-hidden="true"/></button>
          <a className="mt-leave" href={`${base}studio/#meetings`}>Leave</a>
        </div>
      </div>
      {(fatal || error) && <p className="mt-error" role="status">{fatal || error}</p>}
    </section>

    <section className="mt-notes" aria-labelledby="mt-notes-title">
      <p className="mt-kicker">Homepage concepts · 02 · The standing meeting</p>
      <h2 id="mt-notes-title">One call. Four agenda items. Everything the site does.</h2>
      <div className="mt-notes-body">
        <p>The hero is a LinkedIn Beats meeting and the carousel is its agenda. Item one is the waiting room: the room fills tile by tile with the real plates, the board shares its screen and asks you to press start. Item two performs the post: the band's tiles light on their own stems, the drum pad and the guitar are conformed to the song's tempo, Synergy's mouth follows his voice, and the sung words land on the shared screen.</p>
        <p>Item three is the performance review: HR takes speaker view and types the roast of the post into the chat, line by line, with a verdict. Item four is certification: the printer takes speaker view and prints the Certificate of Professional Effort with the name from the chat. Paste your own post and the song, the review and the certificate are yours.</p>
        <p>Left and right arrows, the agenda, the dots and the toolbar all move between items. While nobody has joined, the agenda advances on its own.</p>
      </div>
      <p className="mt-links">
        <a href={`${base}home-concepts/`}>Concept 01, Attract mode <ArrowUpRight aria-hidden="true"/></a>
        <a href={`${base}studio/#meetings`}>The meetings <ArrowUpRight aria-hidden="true"/></a>
        <a href={`${base}allhands/`}>All Hands <ArrowUpRight aria-hidden="true"/></a>
      </p>
    </section>
  </div>;
}
