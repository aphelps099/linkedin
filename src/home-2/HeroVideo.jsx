import React, {memo, useEffect, useRef, useState} from 'react';
import {ArrowDown, ArrowUpRight, AudioLines, Play, Volume2, VolumeX} from 'lucide-react';
import './hero-video.css';

const PLAYBACK_ID = 'jjICCaXD1dLmDApUXumm9CgiESKPGJYoEAeYb2x6wf00';
const STREAM = `https://stream.mux.com/${PLAYBACK_ID}.m3u8`;
const POSTER = `https://image.mux.com/${PLAYBACK_ID}/thumbnail.webp?time=0&width=1920`;

export const HeroVideo = memo(function HeroVideo({base='/', musicPlaying=false, musicLoading=false, musicError='', onMusicToggle, headline=false}) {
  const video = useRef(null), section = useRef(null);
  const [requested, setRequested] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [loadRequested, setLoadRequested] = useState(requested);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(true), [pageVisible, setPageVisible] = useState(!document.hidden);
  const musicActive = musicPlaying || musicLoading;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (query.matches) setRequested(false); };
    const visibility = () => setPageVisible(!document.hidden);
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(section.current);
    query.addEventListener('change', reduce);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer.disconnect();
      query.removeEventListener('change', reduce);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);

  useEffect(() => {
    if (!loadRequested) return;
    const media = video.current;
    let disposed = false, hls;
    const fail = error => {
      if (!disposed) {
        console.warn('Hero video could not load:', error?.details || error?.message || 'Unsupported playback');
        setFailed(true); setRequested(false);
      }
    };
    // Prefer MSE when available: some Chromium browsers advertise native HLS
    // support but cannot actually play it. iOS falls back to native HLS.
    import('hls.js').then(({default: Hls}) => {
      if (disposed) return;
      if (Hls.isSupported()) {
        hls = new Hls({capLevelToPlayerSize: true, maxBufferLength: 20, backBufferLength: 10});
        hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!disposed) setReady(true); });
        hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) { fail(data); hls.destroy(); } });
        hls.loadSource(STREAM);
        hls.attachMedia(media);
      } else if (media.canPlayType('application/vnd.apple.mpegurl')) {
        media.src = STREAM;
        setReady(true);
      } else fail();
    }).catch(fail);
    return () => {
      disposed = true;
      hls?.destroy();
      media.pause();
      media.removeAttribute('src');
      media.load();
    };
  }, [loadRequested]);

  useEffect(() => {
    const media = video.current;
    let cancelled = false;
    if (ready && requested && inView && pageVisible && !failed) {
      media.play().catch(() => { if (!cancelled) setRequested(false); });
    } else media.pause();
    return () => { cancelled = true; };
  }, [ready, requested, inView, pageVisible, failed]);

  const requestPlayback = () => {
    setLoadRequested(true);
    setRequested(true);
  };

  return <section className={`c2-film${headline?' c2-film--headline':''}`} ref={section} aria-label={headline?undefined:"The office band"} aria-labelledby={headline?"c2-film-title":undefined}>
    <img className="c2-film-poster" src={POSTER} alt="" fetchpriority="high" width="1920" height="1080"/>
    <video ref={video} className="c2-film-video" hidden={failed} poster={POSTER}
      muted loop playsInline preload="metadata" disablePictureInPicture disableRemotePlayback
      aria-label="Office workers play drums and keyboards while a small droid delivers paperwork."
      onError={() => { setFailed(true); setRequested(false); }}/>
    {headline&&<div className="c2-container c2-film-copy">
      <h1 id="c2-film-title"><span>Learn to sound</span><span>like LinkedIn.</span></h1>
      <p>Professional development for aspiring thought leaders.</p>
      <a className="c2-film-make" href={`${base}synth/`}><AudioLines aria-hidden="true"/><span>MAKE BEATS</span><ArrowUpRight aria-hidden="true"/></a>
    </div>}
    <div className="c2-container c2-film-bottom">
      <a className="c2-film-next" href="#c2-title">{headline?'Get certified':'Meet the band'} <ArrowDown aria-hidden="true"/></a>
      <div className="c2-film-controls" role="group" aria-label="Hero music and video controls">
        {failed&&<span className="c2-film-status" role="status">Film unavailable</span>}
        {onMusicToggle&&<button type="button" className="c2-film-sound" onClick={onMusicToggle}
          aria-pressed={musicActive} data-playing={musicPlaying} data-loading={musicLoading} aria-label={musicLoading?'Cancel music loading':musicPlaying?'Turn music off':'Turn music on'}>
          <span className="c2-sound-badge" aria-hidden="true">{musicActive?<Volume2/>:<VolumeX/>}</span>
          <span aria-hidden="true">{musicLoading?'TUNING IN':musicPlaying?'SOUND ON!':musicError?'TRY AGAIN':'SOUND ON?'}</span>
          <span className="c2-sound-meter" aria-hidden="true"><i/><i/><i/><i/></span>
        </button>}
        {!requested&&!failed&&<button type="button" onClick={requestPlayback} aria-label="Play hero video">
          <Play fill="currentColor" aria-hidden="true"/>
        </button>}
        {musicError&&<span className="c2-film-audio-error" role="status">Music unavailable. Try again.</span>}
      </div>
    </div>
  </section>;
});
