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
//
// No reversed proxy (none uploaded yet, a fresh checkout, a 404, or reversed:false): the
// reversed stream's element loads the forward file and never plays. It seeks, frame by frame
// and soonest first, to the forward frames the next few output frames show, and captures each
// into the stutter cache as an ImageBitmap under the reversed proxy's own key (frame
// N − 1 − forward frame), so the span plays backwards from cached forward frames. The window
// is bounded by the cache (at most half of it, 2 to 8 frames); captures are capped at 540
// lines, so a master standing in for a missing proxy costs no more than a proxy.
import {stutterKey} from './stutter-cache.js';

export const isMobile = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && globalThis.matchMedia?.('(pointer: coarse)').matches));
const FPS = 24, CORRECT = .03, SEEK_FRAMES = 2, LOOKAHEAD = 48, CAPTURE_LINES = 540;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const streamKey = (shotId, reverse) => `${shotId}|${reverse ? 'rev' : 'fwd'}`;

export function createElementPool({shots, cache = null, slots = isMobile() ? 4 : 8, container = null, preferProxy = true, reversed = true} = {}) {
  const get = id => shots?.get ? shots.get(id) : shots?.byId?.(id) ?? null;
  let host = container;
  if (!host && typeof document !== 'undefined') {
    host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    Object.assign(host.style, {position:'fixed', left:'0', bottom:'0', width:'2px', height:'2px', overflow:'hidden', opacity:'0.01', pointerEvents:'none', zIndex:'-1'});
    document.body.append(host);
  }
  let nextId = 0, program = null, needs = new Map(), dirty = false;
  const stats = {seeks:0, plays:0, captures:0, overflow:0, drift:[], live:0, reversedFromForward:0};
  // Shots whose reversed proxy is missing (or switched off): their reversed spans are captured.
  const noReverse = new Set();
  const revUsable = shot => reversed && !!shot?.rev && !noReverse.has(shot.id);
  const S = Array.from({length:slots}, (_, i) => ({i, front:null, back:null}));

  function element() {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.disableRemotePlayback = true; v.crossOrigin = null;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    host?.append(v);
    const el = {id:`vs-el-${nextId++}`, video:v, key:null, shot:null, reverse:false, presented:0, frame:-1, ready:false, capture:false, loads:0, flip:false, want:[], busy:-1};
    const watch = () => v.requestVideoFrameCallback((now, meta) => {
      if (meta.mediaTime === undefined || v.dataset.loads !== String(el.loads)) { watch(); return; }   // a frame of the previous source
      el.presented = meta.presentedFrames; el.frame = Math.round(meta.mediaTime * FPS - .25); el.ready = true; dirty = true;
      if (el.flip) { if (el.busy === el.frame) grab(el, el.frame); }
      else if (el.capture && cache && el.shot && typeof createImageBitmap === 'function') {
        const key = stutterKey(el.shot.id, el.reverse, el.frame);
        if (!cache.has(key)) createImageBitmap(v).then(b => { cache.put(key, b); stats.captures++; }, () => {});
      }
      watch();
    });
    // A reversed proxy that will not load (a 404 before the upload): capture from the forward file.
    v.addEventListener('error', () => {
      if (!el.reverse || el.flip || !el.shot) return;
      noReverse.add(el.shot.id);
      const key = el.key; el.key = null; load(el, key, 0);
    });
    if (v.requestVideoFrameCallback) watch();
    else v.addEventListener('timeupdate', () => { el.presented++; el.frame = Math.floor(v.currentTime * FPS); el.ready = true; dirty = true; });
    v.addEventListener('seeked', () => { dirty = true; });
    return el;
  }
  function load(el, key, time) {
    const [shotId, dir] = key.split('|'), shot = get(shotId), reverse = dir === 'rev';
    const forward = preferProxy ? shot?.proxy ?? shot?.src : shot?.src;
    const flip = reverse && !revUsable(shot) && !!cache;
    const url = reverse && !flip ? shot?.rev : forward;
    if (!shot || !url) { el.key = null; return false; }
    if (el.key !== key || el.flip !== flip) {
      el.key = key; el.shot = shot; el.reverse = reverse; el.flip = flip; el.ready = false; el.frame = -1; el.loads++; el.want = []; el.busy = -1;
      el.video.dataset.loads = String(el.loads);
      el.video.pause(); el.video.src = url; el.video.load();
      if (flip) stats.reversedFromForward++;
    }
    if (!flip) seek(el, time);
    return true;
  }
  // ---- reversed spans from forward frames ----
  // The forward frames this stream shows over the next `window` output frames, soonest first.
  const windowOf = el => {
    const vh = el.video.videoHeight || CAPTURE_LINES, vw = el.video.videoWidth || CAPTURE_LINES * 16 / 9, h = Math.min(CAPTURE_LINES, vh), bytes = vw * h / vh * h * 4;
    return Math.max(2, Math.min(8, Math.floor((cache?.budget ?? 0) * .5 / bytes)));
  };
  function plan(el, from) {
    if (el.busy >= 0 && performance.now() - el.busyAt > 400) el.busy = -1;     // a seek that presented no frame: try again
    const want = [], seen = new Set(), N = el.shot.frames, until = Math.min(program.frames, from + windowOf(el));
    for (let g = from; g < until; g++) for (const l of program.frame(g).layers) {
      if (l.kind !== 'video' || l.shotId !== el.shot.id || !l.reverse) continue;
      const k = N - 1 - l.proxyFrame;
      if (!seen.has(k) && !cache.has(stutterKey(el.shot.id, true, l.proxyFrame))) { seen.add(k); want.push(k); }
    }
    el.want = want;
    pump(el);
  }
  function pump(el) {
    if (el.busy >= 0 || !el.want.length || el.video.readyState < 1) return;
    const k = el.want.shift();
    el.busy = k; el.busyAt = performance.now();
    if (el.ready && el.frame === k && !el.video.seeking) { grab(el, k); return; }
    seek(el, (k + .5) / FPS);
  }
  function grab(el, k) {
    const v = el.video, N = el.shot.frames, key = stutterKey(el.shot.id, true, N - 1 - k), loads = el.loads;
    const h = Math.min(CAPTURE_LINES, v.videoHeight), w = Math.round(v.videoWidth * h / v.videoHeight);
    const opts = h < v.videoHeight ? {resizeWidth:w, resizeHeight:h, resizeQuality:'high'} : undefined;
    (typeof createImageBitmap === 'function' ? createImageBitmap(v, opts) : Promise.reject()).then(b => {
      if (loads !== el.loads) { b.close?.(); return; }
      cache.put(key, b); stats.captures++; dirty = true;
    }, () => {}).finally(() => { if (loads === el.loads) { el.busy = -1; pump(el); } });
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
  function preroll(key, live, time, frame) {
    for (const s of S) if (s.front?.key === key || s.back?.key === key) { const el = s.front?.key === key ? s.front : s.back; if (el.flip && frame !== undefined) plan(el, frame); return; }
    const s = S.find(x => !x.back || (!live.has(x.back.key))) ;
    if (!s) return;
    s.back ??= element();
    load(s.back, key, time);
    s.back.video.pause();
    if (s.back.flip && frame !== undefined) { const el = s.back; el.video.addEventListener('loadedmetadata', () => plan(el, frame), {once:true}); plan(el, frame); }
  }

  // Drive the elements for output frame f at song time t.
  function update(f, t, playing) {
    if (!program) return;
    f = clamp(f, 0, program.frames - 1);
    const frame = program.frame(f), live = new Map();
    for (const l of frame.layers) if (l.kind === 'video') { const k = streamKey(l.shotId, l.reverse); if (!live.has(k)) live.set(k, []); live.get(k).push(l); }
    for (const [key, layers] of live) {
      const el = procure(key, live, proxyTimeOf(layers[0]));
      if (el?.flip) { if (!el.video.paused) el.video.pause(); plan(el, f); }
      else if (el) steer(el, layers[0], f, t, playing);
    }
    // Preroll: streams that start within a beat.
    for (const p of program.decode.prefetch) {
      if (p.preroll > f) break;
      if (p.frame <= f || p.frame > f + 2 * LOOKAHEAD) continue;
      const key = streamKey(p.shotId, p.proxy === 'rev'), shot = get(p.shotId);
      if (live.has(key) || !shot) continue;
      preroll(key, live, p.proxy === 'rev' ? shot.duration - p.srcTime : p.srcTime, p.frame);
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
    if (el?.flip || (layer.reverse && !revUsable(shot) && cache)) {
      // Captured forward frames only (the element shows forward frames): the exact one, else the
      // nearest already captured a frame or two either side, so a late capture holds, never blanks.
      for (const d of [0, -1, 1, -2, 2]) {
        const ck = stutterKey(layer.shotId, true, layer.proxyFrame + d), b = cache.get(ck);
        if (b) return {image:b, key:`cache:${layer.clipId}`, version:ck, width:shot?.width, height:shot?.height};
      }
      return null;
    }
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
      const exact = (!el?.flip && el?.ready && el.frame === l.proxyFrame && !el.video.seeking) || cache?.has(stutterKey(l.shotId, l.reverse, l.proxyFrame));
      if (!seen.has(key) && !exact) return false;
      seen.add(key);
    }
    return true;
  }

  return {
    setProgram, update, source, settled,
    get dirty() { return dirty; }, clean() { dirty = false; },
    get slots() { return S; }, get noReverse() { return new Set(noReverse); }, get stats() { const d = [...stats.drift].sort((a, b) => a - b); return {...stats, drift:undefined, driftP95:d.length ? d[Math.floor(d.length * .95)] : 0, elements:S.reduce((n, s) => n + !!s.front + !!s.back, 0)}; },
    pause() { for (const s of S) { s.front?.video.pause(); s.back?.video.pause(); } },
    dispose() { for (const s of S) for (const el of [s.front, s.back]) if (el) { el.video.pause(); el.video.removeAttribute('src'); el.video.load(); el.video.remove(); } if (!container) host?.remove(); },
  };
}
