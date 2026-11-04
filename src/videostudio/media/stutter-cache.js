// The stutter cache: short spans of decoded frames kept as ImageBitmaps, so a stutter,
// a ping-pong, a held frame or a canon tile that trails its stream by a few frames shows
// the exact source frame without a second decode. Bounded by bytes (plan §4: 25 MB, one
// beat of 540p frames); least recently used frames go first and are closed.
//
//   const cache = createStutterCache({budget:25 << 20});
//   cache.put(stutterKey(shotId, reverse, proxyFrame), bitmap);
//   cache.get(key) -> ImageBitmap | null
//
// Keys name a frame of a proxy file: the forward proxy's frame n, or the reversed proxy's
// frame n (layer.proxyFrame), so the compositor's frame program addresses it directly.
export const STUTTER_BUDGET = 25 * 1024 * 1024;
export const stutterKey = (shotId, reverse, frame) => `${shotId}|${reverse ? 'rev' : 'fwd'}|${frame}`;

export function createStutterCache({budget = STUTTER_BUDGET} = {}) {
  const map = new Map();          // insertion order = recency (re-inserted on use)
  let bytes = 0, hits = 0, misses = 0;
  const sizeOf = b => (b.width || 0) * (b.height || 0) * 4;
  function evict() {
    for (const [k, e] of map) {
      if (bytes <= budget) break;
      map.delete(k); bytes -= e.bytes; e.bitmap.close?.();
    }
  }
  return {
    put(key, bitmap) {
      if (!bitmap) return;
      const old = map.get(key);
      if (old) { map.delete(key); bytes -= old.bytes; if (old.bitmap !== bitmap) old.bitmap.close?.(); }
      const e = {bitmap, bytes:sizeOf(bitmap)};
      if (e.bytes > budget) { bitmap.close?.(); return; }
      map.set(key, e); bytes += e.bytes;
      evict();
    },
    get(key) {
      const e = map.get(key);
      if (!e) { misses++; return null; }
      map.delete(key); map.set(key, e); hits++;
      return e.bitmap;
    },
    has:key => map.has(key),
    clear() { for (const e of map.values()) e.bitmap.close?.(); map.clear(); bytes = 0; },
    get bytes() { return bytes; }, get size() { return map.size; }, get budget() { return budget; },
    get stats() { return {frames:map.size, bytes, budget, hits, misses}; },
  };
}
