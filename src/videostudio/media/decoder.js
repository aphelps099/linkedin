// WebCodecs decode for the export: the exact source frames each layer of the frame
// program needs, from the 540p proxies (GOP 12, no B-frames), with a frame cache
// sized by the program's own schedule.
//
//   const ledger = frameLedger();
//   const dec = createFrameDecoder({program, shots, from, to, ledger});
//   await dec.prepare(f);              // decodes every frame layer f needs (and nothing it does not)
//   const src = dec.source(layer);     // a fresh VideoFrame for the compositor, or null
//   ...draw...
//   dec.release(f);                    // closes this frame's VideoFrames, drops entries past their last use
//   dec.dispose();
//
// Every VideoFrame the decoder outputs is copied out (I420/NV12 planes) and closed in
// the output callback; source() wraps the copy in a new VideoFrame that release()
// closes after the draw. The ledger counts every open and close, so a leak shows.
// The cache holds exactly the decoded frames the program shows again soon, keyed by
// stream and proxy frame: an entry stays while its next use is within `horizon` output
// frames (two beats at 120 BPM by default), else it is dropped and decoded again when
// the program comes back to it. Stutters, holds, canon tiles and 0.5x plates decode once.
//
// demux(buffer) is a minimal ISO BMFF reader (moov, one video track, stts/ctts/stss/
// stsz/stsc/stco/co64), enough for the proxies and for any faststart H.264 master.

// ---- the ledger: every VideoFrame opened and closed --------------------------------------------
export function frameLedger() {
  const L = {opened:0, closed:0, peak:0, byKind:{}};
  L.open = (frame, kind) => { L.opened++; (L.byKind[kind] ??= {opened:0, closed:0}).opened++; frame.__ledger = kind; L.peak = Math.max(L.peak, L.opened - L.closed); return frame; };
  L.close = frame => { if (!frame || frame.__closed) return; frame.__closed = true; try { frame.close(); } catch {} L.closed++; const k = L.byKind[frame.__ledger]; if (k) k.closed++; };
  Object.defineProperty(L, 'live', {get:() => L.opened - L.closed});
  return L;
}

// ---- demux ---------------------------------------------------------------------------------------
const fourcc = (dv, at) => String.fromCharCode(dv.getUint8(at), dv.getUint8(at + 1), dv.getUint8(at + 2), dv.getUint8(at + 3));
function* children(dv, start, end) {
  let at = start;
  while (at + 8 <= end) {
    let size = dv.getUint32(at), head = 8;
    const type = fourcc(dv, at + 4);
    if (size === 1) { size = Number(dv.getBigUint64(at + 8)); head = 16; }
    else if (size === 0) size = end - at;
    if (size < head || at + size > end) break;
    yield {type, start:at, body:at + head, end:at + size};
    at += size;
  }
}
const child = (dv, box, type) => { for (const c of children(dv, box.body, box.end)) if (c.type === type) return c; return null; };
const path = (dv, box, ...types) => types.reduce((b, t) => b && child(dv, b, t), box);
const hex2 = n => n.toString(16).padStart(2, '0');

export function demux(buffer) {
  const dv = new DataView(buffer), top = {body:0, end:buffer.byteLength};
  const moov = child(dv, top, 'moov');
  if (!moov) throw Error('demux: no moov box (not an MP4, or the moov is missing)');
  for (const trak of children(dv, moov.body, moov.end)) {
    if (trak.type !== 'trak') continue;
    const mdia = child(dv, trak, 'mdia'), hdlr = mdia && child(dv, mdia, 'hdlr');
    if (!hdlr || fourcc(dv, hdlr.body + 8) !== 'vide') continue;
    const mdhd = child(dv, mdia, 'mdhd'), v = dv.getUint8(mdhd.body);
    const timescale = dv.getUint32(mdhd.body + (v === 1 ? 20 : 12));
    const stbl = path(dv, mdia, 'minf', 'stbl');
    const stsd = child(dv, stbl, 'stsd'), entry = [...children(dv, stsd.body + 8, stsd.end)][0];
    const width = dv.getUint16(entry.body + 24), height = dv.getUint16(entry.body + 26);
    let codec = null, description = null;
    for (const c of children(dv, entry.body + 78, entry.end)) {
      const body = new Uint8Array(buffer, c.body, c.end - c.body);
      if (c.type === 'avcC') { codec = `${entry.type === 'avc3' ? 'avc3' : 'avc1'}.${hex2(body[1])}${hex2(body[2])}${hex2(body[3])}`; description = body.slice(); }
      else if (c.type === 'hvcC') { codec = 'hvc1.1.6.L93.B0'; description = body.slice(); }
    }
    if (!codec) throw Error(`demux: unsupported sample entry ${entry.type}`);
    // Sample tables.
    const u32s = (box, at, n) => { const out = new Uint32Array(n); for (let i = 0; i < n; i++) out[i] = dv.getUint32(at + 4 * i); return out; };
    const stsz = child(dv, stbl, 'stsz'), fixed = dv.getUint32(stsz.body + 4), count = dv.getUint32(stsz.body + 8);
    const sizes = fixed ? new Uint32Array(count).fill(fixed) : u32s(stsz, stsz.body + 12, count);
    const stco = child(dv, stbl, 'stco'), co64 = child(dv, stbl, 'co64');
    const chunkOffsets = stco ? Array.from(u32s(stco, stco.body + 8, dv.getUint32(stco.body + 4)))
      : Array.from({length:dv.getUint32(co64.body + 4)}, (_, i) => Number(dv.getBigUint64(co64.body + 8 + 8 * i)));
    const stsc = child(dv, stbl, 'stsc'), nsc = dv.getUint32(stsc.body + 4);
    const sc = Array.from({length:nsc}, (_, i) => ({first:dv.getUint32(stsc.body + 8 + 12 * i), per:dv.getUint32(stsc.body + 12 + 12 * i)}));
    const offsets = new Float64Array(count);
    for (let e = 0, s = 0; e < sc.length; e++) {
      const lastChunk = e + 1 < sc.length ? sc[e + 1].first - 1 : chunkOffsets.length;
      for (let ch = sc[e].first; ch <= lastChunk && s < count; ch++) {
        let off = chunkOffsets[ch - 1];
        for (let k = 0; k < sc[e].per && s < count; k++) { offsets[s] = off; off += sizes[s]; s++; }
      }
    }
    const dts = new Float64Array(count), dur = new Float64Array(count);
    const stts = child(dv, stbl, 'stts');
    for (let i = 0, s = 0, t = 0, n = dv.getUint32(stts.body + 4); i < n; i++) {
      const c = dv.getUint32(stts.body + 8 + 8 * i), d = dv.getUint32(stts.body + 12 + 8 * i);
      for (let k = 0; k < c && s < count; k++, s++) { dts[s] = t; dur[s] = d; t += d; }
    }
    const cts = Float64Array.from(dts), ctts = child(dv, stbl, 'ctts');
    if (ctts) {
      const ver = dv.getUint8(ctts.body);
      for (let i = 0, s = 0, n = dv.getUint32(ctts.body + 4); i < n; i++) {
        const c = dv.getUint32(ctts.body + 8 + 8 * i), o = ver ? dv.getInt32(ctts.body + 12 + 8 * i) : dv.getUint32(ctts.body + 12 + 8 * i);
        for (let k = 0; k < c && s < count; k++, s++) cts[s] += o;
      }
    }
    const stss = child(dv, stbl, 'stss'), key = new Uint8Array(count);
    if (stss) for (const n of u32s(stss, stss.body + 8, dv.getUint32(stss.body + 4))) key[n - 1] = 1; else key.fill(1);
    // Presentation order: display index -> decode index.
    const order = Array.from({length:count}, (_, i) => i).sort((a, b) => cts[a] - cts[b] || a - b);
    const displayOf = new Int32Array(count); order.forEach((d, k) => { displayOf[d] = k; });
    const us = t => Math.round(t / timescale * 1e6);
    const samples = Array.from({length:count}, (_, i) => ({index:i, display:displayOf[i], offset:offsets[i], size:sizes[i], key:!!key[i], dts:dts[i], cts:cts[i], timestamp:us(cts[i] - cts[order[0]]), duration:us(dur[i])}));
    return {codec, description, width, height, timescale, frames:count, samples, order, buffer};
  }
  throw Error('demux: no video track');
}

// ---- one stream: a file, its decoder, GOP-at-a-time decode -----------------------------------
function createStream(url, {fetcher, ledger, keep, onBytes}) {
  let file = null, decoder = null, loading = null, pending = null, closed = false;
  const byTs = new Map();
  async function load() {
    if (file) return file;
    loading ??= (async () => {
      const res = await fetcher(url);
      if (!res.ok) throw Error(`decoder: ${url} answered ${res.status}`);
      const buf = await res.arrayBuffer();
      file = demux(buf);
      for (const s of file.samples) byTs.set(s.timestamp, s.display);
      onBytes?.(buf.byteLength);
      return file;
    })();
    return loading;
  }
  function makeDecoder() {
    decoder = new VideoDecoder({
      output:frame => {
        ledger.open(frame, 'decoded');
        const display = byTs.get(frame.timestamp);
        const want = display !== undefined && keep(display);
        if (!want) { ledger.close(frame); return; }
        // Copy the planes out, then close the decoder's frame at once.
        const format = frame.format, rect = frame.visibleRect, size = frame.allocationSize();
        const data = new Uint8Array(size), init = {format, codedWidth:rect.width, codedHeight:rect.height, timestamp:frame.timestamp,
          colorSpace:frame.colorSpace?.toJSON?.() ?? undefined};
        const p = frame.copyTo(data).then(layout => { init.layout = layout; return {data, init, bytes:size}; }).finally(() => ledger.close(frame));
        pending.outputs.push({display, p});
      },
      error:e => { if (pending) pending.error = e; },
    });
    decoder.configure({codec:file.codec, description:file.description, codedWidth:file.width, codedHeight:file.height, optimizeForLatency:true, hardwareAcceleration:'prefer-software'});
  }
  // Decode the whole GOP holding display frame k; returns [{display, data, init}] for the kept frames.
  async function decodeGop(k) {
    await load();
    if (closed) return [];
    if (!decoder || decoder.state === 'closed') makeDecoder();
    const d = file.order[Math.max(0, Math.min(file.frames - 1, k))];
    let a = d; while (a > 0 && !file.samples[a].key) a--;
    let b = d + 1; while (b < file.frames && !file.samples[b].key) b++;
    pending = {outputs:[], error:null};
    const u8 = new Uint8Array(file.buffer);
    for (let i = a; i < b; i++) {
      const s = file.samples[i];
      decoder.decode(new EncodedVideoChunk({type:s.key ? 'key' : 'delta', timestamp:s.timestamp, duration:s.duration, data:u8.subarray(s.offset, s.offset + s.size)}));
    }
    await decoder.flush();
    const {outputs, error} = pending;
    pending = null;
    if (error) throw error;
    const out = [];
    for (const o of outputs) out.push({display:o.display, ...(await o.p)});
    return out;
  }
  return {
    url, load, decodeGop,
    get frames() { return file?.frames ?? null; },
    get bytes() { return file?.buffer.byteLength ?? 0; },
    close() { closed = true; try { if (decoder && decoder.state !== 'closed') decoder.close(); } catch {} decoder = null; file = null; loading = null; },
  };
}

// ---- the program's decoder -------------------------------------------------------------------------
// Which file and which frame a video layer shows: the proxy the compile picked
// (forward, or the reversed proxy at proxyFrame), else the master at srcFrame.
export function layerStream(layer, shot, {media = 'proxy'} = {}) {
  if (!shot || layer.kind !== 'video') return null;
  if (media === 'proxy') {
    if (layer.reverse && shot.rev) return {url:shot.rev, frame:layer.proxyFrame, dir:'rev'};
    if (shot.proxy) return {url:shot.proxy, frame:layer.srcFrame, dir:'fwd'};
  }
  return {url:shot.src, frame:layer.srcFrame, dir:'master'};
}

export function createFrameDecoder({program, shots, from = 0, to = program.frames, ledger = frameLedger(), fetcher = (u, o) => fetch(u, o), media = 'proxy', horizon = 24, budget = 512 << 20} = {}) {
  const shotMap = shots instanceof Map ? shots : new Map((shots.shots ?? shots).map(s => [s.id, s]));
  // The schedule: for each output frame, the (stream, frame) keys it shows; every frame each key is used on.
  const needs = new Array(to - from), uses = new Map(), lastUse = new Map(), streamLast = new Map();
  for (let f = from; f < to; f++) {
    const keys = [];
    for (const l of program.frame(f).layers) {
      const st = layerStream(l, shotMap.get(l.shotId), {media});
      if (!st) continue;
      const key = `${st.url}#${st.frame}`;
      keys.push({layer:l.clipId, key, url:st.url, frame:st.frame, shot:shotMap.get(l.shotId)});
      if (!uses.has(key)) uses.set(key, []);
      if (uses.get(key).at(-1) !== f) uses.get(key).push(f);
      lastUse.set(key, f); streamLast.set(st.url, f);
    }
    needs[f - from] = keys;
  }
  // The first frame at or after g that shows key (or Infinity): a binary search of its uses.
  const nextUse = (key, g) => { const u = uses.get(key); if (!u) return Infinity; let lo = 0, hi = u.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (u[mid] < g) lo = mid + 1; else hi = mid; } return lo < u.length ? u[lo] : Infinity; };
  const soon = (key, f) => nextUse(key, f) <= f + horizon;
  const streams = new Map(), cache = new Map(), out = new Map();
  let now = from, bytes = 0, peakBytes = 0, peakEntries = 0, gops = 0, decoded = 0, fileBytes = 0, filesOpened = 0;
  const stats = () => ({cacheBytes:bytes, peakBytes, entries:cache.size, peakEntries, gops, decoded, streams:streams.size, filesOpened, fileBytes});
  const streamOf = url => {
    let s = streams.get(url);
    if (!s) {
      filesOpened++;
      s = createStream(url, {fetcher, ledger, keep:k => soon(`${url}#${k}`, now), onBytes:n => { fileBytes += n; }});
      streams.set(url, s);
    }
    return s;
  };
  async function prepare(f) {
    now = f;
    const missing = new Map();
    for (const n of needs[f - from] || []) if (!cache.has(n.key)) { if (!missing.has(n.url)) missing.set(n.url, new Set()); missing.get(n.url).add(n.frame); }
    await Promise.all([...missing].map(async ([url, wanted]) => {
      const s = streamOf(url);
      for (const k of [...wanted].sort((a, b) => a - b)) {
        if (cache.has(`${url}#${k}`)) continue;
        const list = await s.decodeGop(k);
        gops++; decoded += list.length;
        for (const e of list) {
          const key = `${url}#${e.display}`;
          if (cache.has(key) || !soon(key, f)) continue;
          cache.set(key, e); bytes += e.bytes;
        }
        if (!cache.has(`${url}#${k}`)) {
          // A frame past the file's end (a still on the last frame): hold the nearest one.
          const near = list.filter(e => e.display <= k).at(-1) ?? list.at(-1);
          if (!near) throw Error(`decoder: ${url} gave no frame for ${k}`);
          cache.set(`${url}#${k}`, near); bytes += near.bytes;
        }
      }
    }));
    peakBytes = Math.max(peakBytes, bytes); peakEntries = Math.max(peakEntries, cache.size);
    if (bytes > budget) throw Error(`decoder: the frame cache holds ${(bytes / 2 ** 20).toFixed(0)} MB, over its ${(budget / 2 ** 20).toFixed(0)} MB budget`);
  }
  // A VideoFrame of the layer's exact source frame, for compositor.drawFrame's sources().
  function source(layer) {
    const n = (needs[now - from] || []).find(x => x.layer === layer.clipId);
    if (!n) return null;
    let vf = out.get(n.key);
    if (!vf) {
      const e = cache.get(n.key);
      if (!e) return null;
      vf = ledger.open(new VideoFrame(e.data, e.init), 'source');
      out.set(n.key, vf);
    }
    return {image:vf, key:n.url, version:n.frame, width:n.shot?.width, height:n.shot?.height};
  }
  function release(f) {
    for (const vf of out.values()) ledger.close(vf);
    out.clear();
    for (const n of needs[f - from] || []) if (cache.has(n.key) && !soon(n.key, f + 1)) { bytes -= cache.get(n.key).bytes; cache.delete(n.key); }
    // Look-ahead frames of a GOP whose use moved out of reach (a cut came first) go too.
    if ((f - from) % 12 === 11) for (const [key, e] of cache) if (!soon(key, f + 1)) { bytes -= e.bytes; cache.delete(key); }
    for (const [url, s] of streams) if ((streamLast.get(url) ?? -1) <= f) { s.close(); streams.delete(url); }
  }
  function dispose() {
    for (const vf of out.values()) ledger.close(vf);
    out.clear(); cache.clear(); bytes = 0;
    for (const s of streams.values()) s.close();
    streams.clear();
  }
  return {prepare, source, release, dispose, stats, ledger, needs:f => needs[f - from] || [], get distinct() { return lastUse.size; }};
}
