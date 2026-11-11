const hero = document.querySelector('#heroVideo');
const button = document.querySelector('#heroSound');
const label = document.querySelector('#heroSoundLabel');
const status = document.querySelector('#heroPlaybackStatus');
const radio = document.querySelector('#radioAudio');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stream = 'https://stream.mux.com/jjICCaXD1dLmDApUXumm9CgiESKPGJYoEAeYb2x6wf00.m3u8';
let visible = true;

function refresh() {
  const on = !hero.muted && !hero.paused;
  label.textContent = on ? 'Sound on' : 'Sound off';
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
}
function play() {
  return hero.play().catch(() => {
    hero.muted = true;
    refresh();
  });
}
function startFilm() {
  if (!reduced && visible && !document.hidden) play();
}
hero.muted = true;
hero.autoplay = !reduced;
if (window.Hls && Hls.isSupported()) {
  const hls = new Hls({ maxMaxBufferLength: 30 });
  hls.loadSource(stream);
  hls.attachMedia(hero);
  hls.on(Hls.Events.MANIFEST_PARSED, startFilm);
  hls.on(Hls.Events.ERROR, (_, error) => {
    if (!error.fatal) return;
    if (error.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
    else if (error.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
    else {
      hero.muted = true;
      status.textContent = 'The film could not load. Please refresh to try again.';
      refresh();
    }
  });
} else if (hero.canPlayType('application/vnd.apple.mpegurl')) {
  hero.src = stream;
  hero.addEventListener('loadedmetadata', startFilm, { once: true });
}

button.addEventListener('click', () => {
  if (!hero.muted && !hero.paused) {
    hero.muted = true;
  } else {
    radio.pause();
    hero.muted = false;
    status.textContent = '';
    play();
  }
  refresh();
});
['play', 'pause', 'volumechange'].forEach(event => hero.addEventListener(event, refresh));
// Other listening experiences take over the soundtrack without competing audio.
radio.addEventListener('play', () => { hero.muted = true; });
document.querySelectorAll('.film-open').forEach(link => {
  link.addEventListener('click', () => { hero.muted = true; hero.pause(); });
});
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  if (visible) startFilm();
  else { hero.muted = true; hero.pause(); }
}).observe(document.querySelector('#home'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hero.muted = true; hero.pause(); radio.pause(); }
  else startFilm();
});
refresh();
