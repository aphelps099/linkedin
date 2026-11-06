// Homepage concept 01 · Attract mode. The live hero's film, the All Hands band
// and the Peg Board on one stage: the board boots like a cabinet, shows the
// film as pegs under the site's promise, and one tap starts the song with the
// real film under the sung words. The bottom bar is the live hero's.
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ArrowDown, ArrowUpRight, LoaderCircle, Pause, Play} from 'lucide-react';
import {Header} from '../brand/Header.jsx';
import {SAMPLE_POST} from '../allhands/lyrics.js';
import {FORMS, DEFAULT_FORM, stepAt} from '../allhands/forms.js';
import {TRACKS, TRACK_ORDER, trackOf} from '../allhands/songbook/index.js';
import {Performance} from '../allhands/engine.js';
import {BAR_STEPS} from '../allhands/song.js';
import {pitchFor} from '../pegboard/stage.js';
import {createRenderer} from '../pegboard/renderer.js';
import {createBoard} from '../pegboard/board.js';
import {claimAudio, onAudioFocus} from '../brand/audio-focus.js';
import {useSong, useStage, reduced, clock} from './song.js';
import {BOOT, createSampler, paintAttract, paintBoot} from './attract.js';
import './concept.css';

const PLAYBACK_ID = 'jjICCaXD1dLmDApUXumm9CgiESKPGJYoEAeYb2x6wf00';
const STREAM = `https://stream.mux.com/${PLAYBACK_ID}.m3u8`;
const POSTER = `https://image.mux.com/${PLAYBACK_ID}/thumbnail.webp?time=0&width=1920`;
const ADJOURNED = 4.8;                                   // seconds the board holds the sign-off

// The film under the board: the live hero's Mux stream, muted and looping, read
// with CORS so the sampler may light pegs from it.
function useFilm(video, wanted) {
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!wanted) return;
    const media = video.current;
    let disposed = false, hls;
    const fail = () => { if (!disposed) setFailed(true); };
    import('hls.js').then(({default:Hls}) => {
      if (disposed) return;
      if (Hls.isSupported()) {
        hls = new Hls({capLevelToPlayerSize:true, maxBufferLength:20, backBufferLength:10});
        hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!disposed) setReady(true); });
        hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) { fail(); hls.destroy(); } });
        hls.loadSource(STREAM);
        hls.attachMedia(media);
      } else if (media.canPlayType('application/vnd.apple.mpegurl')) { media.src = STREAM; setReady(true); }
      else fail();
    }).catch(fail);
    return () => { disposed = true; hls?.destroy(); media.pause(); media.removeAttribute('src'); media.load(); };
  }, [video, wanted]);
  useEffect(() => {
    const media = video.current;
    if (ready && wanted && !failed) media.play().catch(() => {});
    else media.pause();
  }, [video, ready, wanted, failed]);
  return {ready, failed};
}

export default function ConceptHero({base = '/'}) {
  const perf = useMemo(() => new Performance(), []);
  const still = useMemo(reduced, []);
  const [status, setStatus] = useState('boot'), [trackId, setTrackId] = useState(null);
  const [error, setError] = useState(''), [fatal, setFatal] = useState(''), [hover, setHover] = useState(false);
  const [cue, setCue] = useState({bar:0, section:'Intro', elapsed:0});
  const stageEl = useRef(null), video = useRef(null), attractCanvas = useRef(null), liveCanvas = useRef(null);
  const mode = useRef({status:'boot', at:0}), pending = useRef(false), songRef = useRef(null), barRef = useRef(-1);
  const {song, track} = useSong(SAMPLE_POST, trackId);
  const stage = useStage(liveCanvas, song?.plan);
  const film = useFilm(video, !still);
  const live = status === 'live', loading = status === 'loading';
  songRef.current = song;

  // The loop reads these without re-rendering.
  useEffect(() => { mode.current = {...mode.current, status, at:performance.now() / 1000, reduced:still}; }, [status, still]);
  useEffect(() => { mode.current.hover = hover; }, [hover]);

  // Boot once, then attract; the sign-off returns to attract on its own.
  useEffect(() => {
    if (status === 'boot') { const id = setTimeout(() => setStatus('attract'), still ? 600 : BOOT.end * 1000); return () => clearTimeout(id); }
    if (status === 'adjourned') { const id = setTimeout(() => setStatus('attract'), ADJOURNED * 1000); return () => clearTimeout(id); }
  }, [status, still]);

  const stop = useCallback((next = 'attract') => { perf.stop(); pending.current = false; setStatus(next); }, [perf]);
  useEffect(() => onAudioFocus('allhands', () => { if (perf.running) stop(); }), [perf, stop]);
  useEffect(() => {
    const hidden = () => { if (document.hidden && perf.running) stop(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); perf.close(); };
  }, [perf, stop]);

  const start = useCallback(s => {
    barRef.current = -1;
    setCue({bar:0, section:'Intro', elapsed:0});
    perf.start(s.plan, s.buffers, {mode:'sung', muted:{}}, () => setStatus('adjourned'), s.lady);
    setStatus('live');
    if (s.warning) setError(s.warning);
  }, [perf]);
  useEffect(() => { if (pending.current && song) { pending.current = false; start(song); } }, [song, start]);

  async function join() {
    if (status === 'live') { stop(); return; }
    const unlocking = perf.unlock();                      // inside the tap, before any await
    claimAudio('allhands');
    setError('');
    try { await unlocking; setFatal(''); } catch (e) { setFatal(e.message); return; }
    if (song) start(song); else { pending.current = true; setStatus('loading'); }
  }
  function choose(id) {
    if (id === track) return;
    if (perf.running) { perf.stop(); pending.current = true; setStatus('loading'); }
    setTrackId(id);
  }

  // One frame for both boards. The attract board: boot, the film as pegs, the
  // copy. The live board: the song's own choreography from the audio clock.
  useEffect(() => {
    const el = stageEl.current, canvas = attractCanvas.current;
    const renderer = createRenderer(canvas, {pixelRatio:Math.min(2, window.devicePixelRatio || 1)});
    const cache = new Map();
    let geo = null, board = null, luma = null, sampler = null, filmOK = false, n = 0, frame = 0;
    const resize = () => {
      const W = el.clientWidth, H = el.clientHeight;
      const pitch = pitchFor(W, H), cols = Math.floor(W / pitch), rows = Math.floor(H / pitch);
      geo = {W, H, pitch, cols, rows, ox:Math.floor((W - cols * pitch) / 2), oy:Math.floor((H - rows * pitch) / 2)};
      board = createBoard(cols, rows); luma = new Float32Array(cols * rows); sampler = createSampler(cols, rows);
      renderer.resize(W, H); cache.clear();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    const t0 = performance.now() / 1000;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = performance.now() / 1000, t = now - t0, m = mode.current, since = now - m.at;
      if (n++ % 2 === 0) filmOK = sampler.sample(video.current, luma, geo);
      const common = {pitch:geo.pitch, luma, film:filmOK, reduced:m.reduced, cache, since};
      if (m.status === 'boot') paintBoot(board, since, {reduced:m.reduced, cache});
      else if (m.status === 'attract') paintAttract(board, since, {...common, hover:m.hover});
      else if (m.status === 'loading') paintAttract(board, since, {...common, press:false, filmGain:.4, copy:{text:'WARMING UP', k:2, age:since, tone:0}});
      else if (m.status === 'adjourned') paintAttract(board, since, {...common, press:false, filmGain:.4, copy:since < 2.2 ? {text:'ADJOURNED.', k:2, age:since, dur:2.2} : {text:"LET'S CIRCLE BACK.", k:2, age:since - 2.2, dur:ADJOURNED - 2.2}});
      else paintAttract(board, since, {...common, press:false, copy:false, filmGain:.14, sockets:.45});
      renderer.draw(board, {pitch:geo.pitch, x:geo.ox, y:geo.oy, time:m.reduced ? 0 : t});

      if (m.status === 'live' && stage.current && songRef.current) {
        const seconds = perf.position();
        if (seconds >= 0) {
          stage.current.draw(seconds, {analysers:perf.analysers()});
          const plan = songRef.current.plan, step = stepAt(plan, seconds), bar = Math.max(0, Math.floor(step / BAR_STEPS));
          if (bar !== barRef.current || Math.floor(seconds) !== Math.floor(cue.elapsed)) {
            barRef.current = bar;
            setCue({bar, section:plan.sections.find(s => bar >= s.from && bar < s.to)?.name || 'Outro', elapsed:seconds});
          }
        }
      }
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); renderer.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const songTrack = trackOf(track), plan = song?.plan;
  const sections = plan?.sections || FORMS[DEFAULT_FORM].sectionsOf(track);
  const progress = plan && live ? Math.min(1, Math.max(0, cue.elapsed) / plan.duration) : 0;
  const metaLeft = status === 'boot' ? 'Power on' : status === 'attract' ? 'Attract mode' : status === 'loading' ? 'Warming up' : status === 'adjourned' ? 'Adjourned' : cue.section;
  const metaRight = live ? `Bar ${String(cue.bar + 1).padStart(2, '0')} / ${plan?.bars.length ?? 30}` : `${songTrack.title} · ${songTrack.bpm} BPM · ${songTrack.key}`;

  return <div className="hc">
    <Header base={base} overlay onRadio={join} playing={live} loading={loading} radioError={fatal}/>
    <section className={`hc-hero is-${status}${film.failed ? ' no-film' : ''}`} ref={stageEl} aria-labelledby="hc-title">
      <img className="hc-poster" src={POSTER} alt="" fetchpriority="high" width="1920" height="1080"/>
      <video ref={video} className="hc-film" hidden={film.failed} poster={POSTER} muted loop playsInline crossOrigin="anonymous" preload="metadata" disablePictureInPicture disableRemotePlayback
        aria-label="Office workers play drums and keyboards while a small droid delivers paperwork."/>
      <div className="hc-shade" aria-hidden="true"/>
      <canvas ref={attractCanvas} className="hc-board" aria-hidden="true"/>
      <canvas ref={liveCanvas} className="hc-board hc-board-live" aria-hidden="true"/>
      <button type="button" className="hc-tap" onClick={join} disabled={live || loading} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setHover(true)} onBlur={() => setHover(false)}
        aria-label={live ? 'The song is playing' : 'Press start: play the song'}/>
      <h1 id="hc-title" className="hc-sr">Learn to sound like LinkedIn. Professional development for aspiring thought leaders.</h1>
      <div className="hc-meta" aria-live="polite"><span>{metaLeft}</span><span>{metaRight}</span></div>
      <div className="hc-bottom">
        <a className="hc-next" href="#hc-notes">Get certified <ArrowDown aria-hidden="true"/></a>
        <div className={`hc-timeline${live ? ' is-live' : ''}`} aria-hidden="true">
          {sections.map(s => <div key={s.name} style={{flex:s.to - s.from}} className={live && cue.section === s.name ? 'now' : ''}><span>{s.name}</span><b>{Array.from({length:s.to - s.from}, (_, i) => <i key={i}/>)}</b></div>)}
          <em style={{transform:`scaleX(${progress})`}}/>
          <small>{clock(live ? cue.elapsed : 0)} / {clock(plan?.duration || 60)}</small>
        </div>
        <div className="hc-controls" role="group" aria-label="Song and playback">
          <div className="hc-songs" role="radiogroup" aria-label="Song">
            {TRACK_ORDER.map(id => { const t = TRACKS[id]; return <button key={id} type="button" role="radio" aria-checked={track === id} className={track === id ? 'on' : ''} title={t.blurb} onClick={() => choose(id)}>{t.title}</button>; })}
          </div>
          <button type="button" className="hc-start" onClick={join} aria-pressed={live} data-live={live} data-loading={loading}>
            <span className="hc-start-badge" aria-hidden="true">{loading ? <LoaderCircle className="hc-spin"/> : live ? <Pause/> : <Play fill="currentColor"/>}</span>
            <span>{loading ? 'Warming up' : live ? 'Leave meeting' : status === 'adjourned' ? 'Rejoin' : 'Join with audio'}</span>
          </button>
        </div>
      </div>
      {(fatal || error) && <p className="hc-error" role="status">{fatal || error}</p>}
    </section>

    <section id="hc-notes" className="hc-notes" aria-labelledby="hc-notes-title">
      <p className="hc-kicker">Homepage concepts · 01 · Attract mode</p>
      <h2 id="hc-notes-title">The board plays the film. The film plays the band.</h2>
      <div className="hc-notes-body">
        <p>The cabinet powers on: sockets wake, one sweep tests every peg, the wordmark types in. Then the film you already have runs underneath, sampled onto the board one peg per socket, with the promise lit over it in PEG-9 and the genre rotating a phrase at a time. PRESS START blinks once a second, never faster.</p>
        <p>One tap. The song starts in the same frame the pegs let go: the film comes up under the board, the band's sung words land on the same grid, bar by bar, and the department chart plays the stems. Four songs, one post, sixty seconds each. When it adjourns, the board says so and goes back to attracting.</p>
        <p>Nothing here is a new container. It is the live hero, the All Hands engine and the Peg Board, on one stage, with one pitch.</p>
      </div>
      <p className="hc-links">
        <a href={`${base}home-concepts/02/`}>Concept 02, The standing meeting <ArrowUpRight aria-hidden="true"/></a>
        <a href={`${base}allhands/`}>All Hands <ArrowUpRight aria-hidden="true"/></a>
        <a href={`${base}pixel-type/`}>The Peg Board specimen <ArrowUpRight aria-hidden="true"/></a>
        <a href={base}>The current homepage <ArrowUpRight aria-hidden="true"/></a>
      </p>
    </section>
  </div>;
}
