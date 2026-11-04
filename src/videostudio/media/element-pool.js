// The preview's decoders: <video> elements in A/B pairs per decode slot (8 slots on a
// desktop, 4 on a phone: the plan's live-decode budget). The front element plays the stream
// its slot serves; the back element prerolls the stream that slot plays next, one beat early
// (program.decode.prefetch), so a cut lands on a picture that is already there.
//
//   const pool = createElementPool({shots, cache});
//   pool.setProgram(program);
//   pool.update(f, t, playing);         // each animation frame, before drawing
//   compositor.drawFrame(frame, pool.source, ...)
//
// Steering: a playing element runs at the clip's rate, nudged within ±3% toward the frame
// program's source time; it seeks only when it is more than 2 frames out. Freezes, stills,
// stepped (tape-coupled) and out-of-range rates pause the element and seek frame-exactly to
// proxyTime. Reverse playback plays the pre-reversed proxy forwards. Textures upload only
// when requestVideoFrameCallback reports a new frame (Source.version = presentedFrames).
// Frames that stutters, holds and canon tiles need are kept in the stutter cache.
import {stutterKey} from './stutter-cache.js';

export const isMobile = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && globalThis.matchMedia?.('(pointer: coarse)').matches));
const FPS = 24, CORRECT = .03, SEEK_FRAMES = 2, LOOKAHEAD = 48;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const streamKey = (shotId, reverse) => `${shotId}|${reverse ? 'rev' : 'fwd'}`;

export function createElementPool({shots, cache = null, slots = isMobile() ? 4 : 8, container = null, preferProxy = true} = {}) {
  const get = id => shots?.get ? shots.get(id) : shots?.byId?.(id) ?? null;
  let host = container;
  if (!host && typeof document !== 'undefined') {
    host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, {position:'fixed', left:'0', bottom:'0', width:'2px', height:'2px', overflow:'hidden', opacity:'0.01', pointerEvents:'none', zIndex:'-1'});
    document.body.append(host);
  }
  let nextId = 0, program = null, needs = new Map(), dirty = false;
  const stats = {seeks:0, plays:0, captures:0, overflow:0, drift:[], live:0};
  const S = Array.from({length:slots}, (_, i) => ({i, front:null, back:null}));

  function element() {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.disableRemotePlayback = true; v.crossOrigin = null;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    host?.append(v);
    const el = {id:`vs-el-${nextId++}`, video:v, key:null, shot:null, reverse:false, presented:0, frame:-1, ready:false, capture:false, loads:0};
    const watch = () => v.requestVideoFrameCallback((now, meta) => {
      if (meta.mediaTime === undefined || v.dataset.loads !== String(el.loads)) { watch(); return; }   // a frame of the previous source
      el.presented = meta.presentedFrames; el.frame = Math.round(meta.mediaTime * FPS - .25); el.ready = true; dirty = true;
      if (el.capture && cache && el.shot && typeof createImageBitmap === 'function') {
        const key = stutterKey(el.shot.id, el.reverse, el.frame);
        if (!cache.has(key)) createImageBitmap(v).then(b => { cache.put(key, b); stats.captures++; }, () => {});
      }
      watch();
    });
    if (v.requestVideoFrameCallback) watch();
    else v.addEventListener('timeupdate', () => { el.presented++; el.frame = Math.floor(v.currentTime * FPS); el.ready = true; dirty = true; });
    v.addEventListener('seeked', () => { dirty = true; });
    return el;
  }
  function load(el, key, time) {
    const [shotId, dir] = key.split('|'), shot = get(shotId), reverse = dir === 'rev';
    const url = reverse ? shot?.rev : preferProxy ? shot?.proxy ?? shot?.src : shot?.src;
    if (!shot || !url) { el.key = null; return false; }
    if (el.key !== key) {
      el.key = key; el.shot = shot; el.reverse = reverse; el.ready = false; el.frame = -1; el.loads++;
      el.video.dataset.loads = String(el.loads);
      el.video.pause(); el.video.src = url; el.video.load();
    }
    seek(el, time);
    return true;
  }
  function seek(el, time) {
    const v = el.video, d = el.shot?.duration ?? Infinity;
    v.currentTime = clamp(time, 0, d - .5 / FPS); stats.seeks++;
  }

  // Streams live per frame and frames that need the cache (stutter, still, or a stream shown twice).
  function setProgram(p) {
    program = p; needs = new Map();
    for (let f = 0; f < p.frames; f++) {
      const seen = new Map();
      for (const l of p.frame(f).layers) if (l.kind === 'video') { const k = streamKey(l.shotId, l.reverse); seen.set(k, (seen.get(k) || 0) + 1); if (l.source !== 'stream') mark(k, f); }
      for (const [k, n] of seen) if (n > 1) mark(k, f);
    }
    function mark(k, f) { if (!needs.has(k)) needs.set(k, new Uint8Array(p.frames)); needs.get(k)[f] = 1; }
  }
  const wantsCache = (key, f) => { const a = needs.get(key); if (!a) return false; for (let g = f; g < Math.min(a.length, f + LOOKAHEAD); g++) if (a[g]) return true; return false; };

  function procure(key, live, time) {
    for (const s of S) if (s.front?.key === key) return s.front;
    const free = S.find(s => !s.front || !live.has(s.front.key));
    for (const s of S) if (s.back?.key === key) {
      // The prerolled element takes the front: of its own slot when that slot's stream has
      // ended, else of a free slot (whose idle element goes back to prerolling).
      if (!s.front || !live.has(s.front.key)) [s.front, s.back] = [s.back, s.front];
      else if (free) { const el = s.back; s.back = free.front; free.front = el; return el; }
      else { stats.overflow++; return null; }
      return s.front;
    }
    if (!free) { stats.overflow++; return null; }
    free.front ??= element();
    return load(free.front, key, time) ? free.front : null;
  }
  function preroll(key, live, time) {
    for (const s of S) if (s.front?.key === key || s.back?.key === key) return;
    const s = S.find(x => !x.back || (!live.has(x.back.key))) ;
    if (!s) return;
    s.back ??= element();
    load(s.back, key, time);
    s.back.video.pause();
  }

  // Drive the elements for output frame f at song time t.
  function update(f, t, playing) {
    if (!program) return;
    f = clamp(f, 0, program.frames - 1);
    const frame = program.frame(f), live = new Map();
    for (const l of frame.layers) if (l.kind === 'video') { const k = streamKey(l.shotId, l.reverse); if (!live.has(k)) live.set(k, []); live.get(k).push(l); }
    for (const [key, layers] of live) {
      const el = procure(key, live, proxyTimeOf(layers[0]));
      if (el) steer(el, layers[0], f, t, playing);
    }
    // Preroll: streams that start within a beat.
    for (const p of program.decode.prefetch) {
      if (p.preroll > f) break;
      if (p.frame <= f || p.frame > f + 2 * LOOKAHEAD) continue;
      const key = streamKey(p.shotId, p.proxy === 'rev'), shot = get(p.shotId);
      if (live.has(key) || !shot) continue;
      preroll(key, live, p.proxy === 'rev' ? shot.duration - p.srcTime : p.srcTime);
    }
    let n = 0;
    for (const s of S) {
      if (s.front && !live.has(s.front.key) && !s.front.video.paused) s.front.video.pause();
      if (s.back && !s.back.video.paused) s.back.video.pause();
      if (s.front && live.has(s.front.key)) { s.front.capture = wantsCache(s.front.key, f); if (!s.front.video.paused) n++; }
    }
    stats.live = n;
  }
  const proxyTimeOf = l => { const s = get(l.shotId); return l.reverse ? (s?.duration ?? 0) - l.srcTime : l.srcTime; };

  function steer(el, l, f, t, playing) {
    const v = el.video, shot = el.shot;
    const next = f + 1 < program.frames ? program.frame(f + 1).layers.find(x => x.clipId === l.clipId) : null;
    const pt = proxyTimeOf(l);
    const rate = next && next.reverse === l.reverse && next.source === 'stream' && l.source === 'stream' ? (proxyTimeOf(next) - pt) * FPS : 0;
    const stepped = !playing || l.source !== 'stream' || rate < .25 || rate > 4;
    if (stepped) {
      if (!v.paused) v.pause();
      if (el.frame !== l.proxyFrame && !v.seeking && Math.abs(v.currentTime - l.proxyTime) > .25 / FPS) seek(el, l.proxyTime);
      return;
    }
    const target = pt + rate * clamp(t * FPS - f, 0, 1) / FPS, err = v.currentTime - target;
    if (Math.abs(err) > SEEK_FRAMES / FPS) { if (!v.seeking) seek(el, target + rate * .06); }
    else stats.drift.push(Math.abs(err) * FPS);
    if (stats.drift.length > 600) stats.drift.splice(0, 300);
    v.playbackRate = clamp(rate * (1 + clamp(-err / (SEEK_FRAMES / FPS), -1, 1) * CORRECT), .0625, 16);
    if (v.paused) { v.play().catch(() => {}); stats.plays++; }
  }

  // The compositor's source resolver: the exact frame from the cache when the layer needs one,
  // else the stream's element.
  function source(layer) {
    const key = streamKey(layer.shotId, layer.reverse), shot = get(layer.shotId);
    let el = null;
    for (const s of S) if (s.front?.key === key) { el = s.front; break; }
    const exact = el?.ready && el.frame === layer.proxyFrame;
    if (cache && !exact) {
      const ck = stutterKey(layer.shotId, layer.reverse, layer.proxyFrame), b = cache.get(ck);
      if (b) return {image:b, key:`cache:${layer.clipId}`, version:ck, width:shot?.width, height:shot?.height};
    }
    if (el?.ready) return {image:el.video, key:el.id, version:`${el.loads}:${el.presented}:${el.frame}`, width:shot?.width, height:shot?.height};
    return null;
  }

  // True when every stream of frame f shows its exact frame (the first layer of each stream;
  // other layers of a stream are exact when the cache holds their frame).
  function settled(f) {
    if (!program) return false;
    const seen = new Set();
    for (const l of program.frame(clamp(f, 0, program.frames - 1)).layers) {
      if (l.kind !== 'video') continue;
      const key = streamKey(l.shotId, l.reverse), el = S.find(s => s.front?.key === key)?.front;
      const exact = (el?.ready && el.frame === l.proxyFrame && !el.video.seeking) || cache?.has(stutterKey(l.shotId, l.reverse, l.proxyFrame));
      if (!seen.has(key) && !exact) return false;
      seen.add(key);
    }
    return true;
  }

  return {
    setProgram, update, source, settled,
    get dirty() { return dirty; }, clean() { dirty = false; },
    get slots() { return S; }, get stats() { const d = [...stats.drift].sort((a, b) => a - b); return {...stats, drift:undefined, driftP95:d.length ? d[Math.floor(d.length * .95)] : 0, elements:S.reduce((n, s) => n + !!s.front + !!s.back, 0)}; },
    pause() { for (const s of S) { s.front?.video.pause(); s.back?.video.pause(); } },
    dispose() { for (const s of S) for (const el of [s.front, s.back]) if (el) { el.video.pause(); el.video.removeAttribute('src'); el.video.load(); el.video.remove(); } if (!container) host?.remove(); },
  };
}
