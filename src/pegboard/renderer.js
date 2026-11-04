// Picks the Peg Board renderer: WebGL2 first, Canvas2D when WebGL2 fails, and a
// swap to Canvas2D if the WebGL context is lost. A canvas that has held a WebGL
// context can never give a 2D one, so the swap puts a fresh <canvas> in its
// place (same id, classes, style and attributes) and reports it via onSwap.
//
//   const r = createRenderer(canvas, {pixelRatio, quality, onSwap, force2d})
//   r.kind                               'webgl2' | '2d'
//   r.canvas                             the canvas currently drawn to
//   r.resize(cssWidth, cssHeight)        sets the backing store (css × pixelRatio × renderScale); never touches CSS
//   r.draw(board, {pitch, x, y, time, kick, add})
//                                        pitch, x, y in CSS px; time in seconds (shimmer); kick 0..1
//                                        widens the atmosphere (drop kicks); add: extra boards of the
//                                        same grid whose lit pegs are added on top (detune copies)
//   r.read()                             {width, height, data} RGBA, top row first (tests, export)
//   r.quality, r.stats                   current quality; last draw's quads, uploaded rows, bloom plan
//   r.setQuality({bloom, renderScale, socketShading})   phone step-downs, see QUALITY_STEPS
//   r.setPixelRatio(ratio)               e.g. on a devicePixelRatio change
//   r.dispose()
// Same inputs, same pixels: nothing depends on wall-clock time or frame history.
import {createRendererGL} from './renderer-gl.js';
import {createRenderer2D} from './renderer-2d.js';
export {pegRandom, pegVariation, isLatePeg} from './renderer-2d.js';
export {BLOOM} from './renderer-gl.js';

// What to give up, in order, when frames run over budget (spec: > 20 ms):
// fewer bloom levels, then 0.75 render scale, then flat sockets.
export const QUALITY_STEPS = [
  {bloom:2, renderScale:1, socketShading:true},
  {bloom:1, renderScale:1, socketShading:true},
  {bloom:1, renderScale:.75, socketShading:true},
  {bloom:1, renderScale:.75, socketShading:false},
];

export function createRenderer(canvas, opts = {}) {
  let impl = null, cur = canvas, size = null, last = null, lost = false;
  if (!opts.force2d) {
    try { impl = createRendererGL(canvas, opts); }
    catch (e) { (opts.onFallback || console.warn)('Peg Board: WebGL2 renderer unavailable, using Canvas2D.', e); }
  }
  if (!impl) impl = create2D(canvas);

  function create2D(c) {
    try { return createRenderer2D(c, opts); }
    catch (e) {                                  // c already holds a WebGL context: swap in a fresh canvas
      const r = createRenderer2D(cur = replacement(c), opts);
      opts.onSwap?.(cur, r.kind);                // whoever holds the old canvas (export capture) must hear of it
      return r;
    }
  }
  // A fresh canvas standing in for one whose context is gone.
  function replacement(old) {
    const doc = old.ownerDocument;
    const c = doc ? doc.createElement('canvas') : new OffscreenCanvas(old.width, old.height);
    if (doc) {
      for (const {name, value} of old.attributes) if (name !== 'width' && name !== 'height') c.setAttribute(name, value);
      old.replaceWith?.(c);
    }
    c.width = old.width; c.height = old.height;
    return c;
  }
  function onLost(e) {
    if (lost || impl.kind !== 'webgl2') return;
    lost = true; e?.preventDefault?.();
    cur.removeEventListener?.('webglcontextlost', onLost);
    const old = cur;
    impl = createRenderer2D(cur = replacement(old), {...opts, quality:impl.quality});
    if (size) impl.resize(...size);
    if (last) impl.draw(...last);              // repaint at once: a paused preview may never draw again
    opts.onSwap?.(cur, impl.kind);
  }
  if (impl.kind === 'webgl2') cur.addEventListener?.('webglcontextlost', onLost);

  return {
    get kind() { return impl.kind; },
    get canvas() { return cur; },
    get quality() { return impl.quality; },
    get stats() { return impl.stats; },
    resize(w, h) { size = [w, h]; impl.resize(w, h); },
    draw(board, o) {
      last = [board, o];
      if (impl.kind === 'webgl2' && impl.gl.isContextLost()) onLost();
      impl.draw(board, o);
    },
    read() { return impl.read(); },
    setQuality(q) { impl.setQuality(q); },
    setPixelRatio(r) { opts = {...opts, pixelRatio:r}; impl.setPixelRatio(r); },
    dispose() { cur.removeEventListener?.('webglcontextlost', onLost); impl.dispose(); last = null; },
  };
}
