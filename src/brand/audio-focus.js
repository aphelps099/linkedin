// Coordinate the site's own players without changing browser audio settings.
const listeners = new Set();
let owner = null;
export function claimAudio(next, {media:activeMedia} = {}) {
  if(owner === next) return;
  owner = next;
  for(const listener of [...listeners]) listener(next);
  if(typeof document !== 'undefined' && next !== 'media') {
    document.querySelectorAll('audio, video').forEach(media => {
      if(media !== activeMedia && !media.muted && !media.hasAttribute('data-cb-unlock') && !media.paused) media.pause();
    });
  }
}
export function onAudioFocus(identity, pause) {
  const listener = next => {if(next !== identity) pause();};
  listeners.add(listener);
  return () => listeners.delete(listener);
}
