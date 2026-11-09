// The song and the sung-words board, shared by the homepage concepts. The song
// is prepared the All Hands way for a post and a track (null: the post chooses)
// and kept for the visit; without Synergy's voice the band plays on.
import {useEffect, useMemo, useRef, useState} from 'react';
import {lyricsFromPost} from '../allhands/lyrics.js';
import {FORMS, DEFAULT_FORM} from '../allhands/forms.js';
import {castSong, settleCast} from '../allhands/casting.js';
import {loadWords} from '../allhands/voice.js';
import {prepareLady} from '../allhands/lady.js';
import {LADY_TABLE} from '../allhands/lady-table.js';
import {createStage} from '../pegboard/stage.js';

export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const decoder = () => new OfflineAudioContext(1, 1, 44100);
export const clock = s => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

export function useSong(post, trackId) {
  const [song, setSong] = useState(null), cache = useRef(new Map());
  const lyrics = useMemo(() => { try { return lyricsFromPost(post); } catch { return null; } }, [post]);
  const casting = useMemo(() => lyrics ? castSong(post) : null, [post, lyrics]);
  const track = trackId || casting?.track || 'circle-back', cast = trackId ? undefined : casting?.cast;
  useEffect(() => {
    if (!lyrics) { setSong(null); return; }
    const key = `${track}|${post}`;
    if (cache.current.has(key)) { setSong(cache.current.get(key)); return; }
    setSong(null);
    const control = new AbortController(), form = FORMS[DEFAULT_FORM];
    (async () => {
      let plan, buffers = new Map(), warning = '';
      try {
        const loaded = await loadWords(decoder(), form.voiced(lyrics, {track}), {signal:control.signal});
        buffers = loaded.buffers;
        plan = settleCast(form.arrange, lyrics, loaded.durations, {track, cast}).plan;
      } catch (e) {
        if (control.signal.aborted) return;
        warning = `${e.message} The band will play; Synergy will not.`;
        plan = form.arrange(lyrics, {}, {track, cast});
      }
      const lady = await prepareLady(decoder(), plan).catch(() => undefined);
      if (control.signal.aborted) return;
      const ready = {plan, buffers, lady, warning, track};
      cache.current.set(key, ready);
      setSong(ready);
    })();
    return () => control.abort();
  }, [lyrics, cast, track, post]);
  return {song, track, lyrics, casting};
}

// The sung words' board, the one /allhands/ draws: same pitch rule as the
// attract board, so its pegs sit on the same sockets.
export function useStage(canvas, plan, {chart = true} = {}) {
  const stage = useRef(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el || !plan) return;
    const s = createStage(el, {plan, table:LADY_TABLE, reduced:reduced(), chart});
    stage.current = s;
    const resize = () => { if (el.clientWidth && el.clientHeight) s.resize(el.clientWidth, el.clientHeight); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    return () => { ro.disconnect(); s.dispose(); if (stage.current === s) stage.current = null; };
  }, [canvas, plan, chart]);
  return stage;
}
