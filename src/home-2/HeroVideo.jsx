import React, {memo, useEffect, useRef, useState} from 'react';
import {ArrowDown, Play, Volume2, VolumeX} from 'lucide-react';
import './hero-video.css';

const PLAYBACK_ID = 'jjICCaXD1dLmDApUXumm9CgiESKPGJYoEAeYb2x6wf00';
// Enable alongside a future playback ID that contains the finished sound mix.
const HAS_AUDIO = false;
const STREAM = `https://stream.mux.com/${PLAYBACK_ID}.m3u8`;
const POSTER = `https://image.mux.com/${PLAYBACK_ID}/thumbnail.webp?time=0&width=1920`;

export const HeroVideo = memo(function HeroVideo({radioActive, onSoundEnable}) {
  const video = useRef(null), section = useRef(null);
  const [requested, setRequested] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [loadRequested, setLoadRequested] = useState(requested);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true), [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(true), [pageVisible, setPageVisible] = useState(!document.hidden);
  const silent = !HAS_AUDIO || muted || radioActive;

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

  // Starting any radio track silences the film, including during track loading.
  useEffect(() => { if (radioActive) setMuted(true); }, [radioActive]);

  const requestPlayback = () => {
    setLoadRequested(true);
    setRequested(true);
  };
  const toggleSound = () => {
    if (silent) {
      onSoundEnable();
      setMuted(false);
      setLoadRequested(true);
      setRequested(true);
      // Unmute in the user gesture for mobile browsers.
      video.current.muted = false;
    } else setMuted(true);
  };

  return <section className="c2-film" ref={section} aria-label="The office band">
    <img className="c2-film-poster" src={POSTER} alt="" fetchpriority="high" width="1920" height="1080"/>
    <video ref={video} className="c2-film-video" hidden={failed} poster={POSTER}
      muted={silent} loop playsInline preload="metadata" disablePictureInPicture disableRemotePlayback
      aria-label="Office workers play drums and keyboards while a small droid delivers paperwork."
      onError={() => { setFailed(true); setRequested(false); }}/>
    <div className="c2-container c2-film-bottom">
      <a className="c2-film-next" href="#c2-title">Meet the band <ArrowDown aria-hidden="true"/></a>
      {failed ? <span className="c2-film-status" role="status">Film unavailable</span> : (HAS_AUDIO || !requested) &&
        <div className="c2-film-controls" role="group" aria-label="Hero video controls">
          {HAS_AUDIO && <button type="button" className="c2-film-sound" onClick={toggleSound} aria-pressed={!silent} aria-label={silent?'Turn hero sound on':'Turn hero sound off'}>
            {silent?<VolumeX aria-hidden="true"/>:<Volume2 aria-hidden="true"/>}<span>Sound {silent?'on':'off'}</span>
          </button>}
          {!requested && <button type="button" onClick={requestPlayback} aria-label="Play hero video">
            <Play fill="currentColor" aria-hidden="true"/>
          </button>}
        </div>}
    </div>
  </section>;
});
