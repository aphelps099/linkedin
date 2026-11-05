// A small FLAC decoder, pure JS (no Web Audio, no Node APIs), so the voice bank
// decodes to the same samples in Node, in Chromium, in Safari and in Firefox:
// no browser codec, no resampling at decode time. It reads what FFmpeg's
// encoder writes and the format allows: STREAMINFO, Vorbis comments, any
// other block skipped; fixed-size or variable-size frames; CONSTANT,
// VERBATIM, FIXED and LPC subframes; Rice and Rice2 residuals with escapes;
// wasted bits; independent, left/side, side/right and mid/side channels.
// Every frame's CRC-16 is checked.
//
//   decodeFlac(bytes) -> {sampleRate, bitsPerSample, channels:[Float32Array], samples,
//                         md5 (STREAMINFO's, hex), tags:{KEY:value}, ints:[Int32Array]}
// Samples are int / 2^(bits-1), as wav.js decodes PCM.

const CRC16 = (() => {
  const t = new Uint16Array(256);
  for (let i = 0; i < 256; i++) { let c = i << 8; for (let k = 0; k < 8; k++) c = c & 0x8000 ? (c << 1) ^ 0x8005 : c << 1; t[i] = c & 0xffff; }
  return t;
})();

class Bits {
  constructor(b, pos = 0) { this.b = b; this.pos = pos * 8; }
  get byte() { return this.pos >> 3; }
  bit() { const v = (this.b[this.pos >> 3] >> (7 - (this.pos & 7))) & 1; this.pos++; return v; }
  read(n) {                                             // unsigned, n <= 32
    let v = 0;
    while (n > 0) {
      const off = this.pos & 7, take = Math.min(n, 8 - off), byte = this.b[this.pos >> 3];
      if (byte === undefined) throw new Error('FLAC: unexpected end of data');
      v = v * (1 << take) + ((byte >> (8 - off - take)) & ((1 << take) - 1));
      this.pos += take; n -= take;
    }
    return v;
  }
  signed(n) { if (!n) return 0; const v = this.read(n); return v >= 2 ** (n - 1) ? v - 2 ** n : v; }
  unary() {                                             // zeros before the next one
    let n = 0;
    while (true) {
      const off = this.pos & 7, byte = (this.b[this.pos >> 3] << off) & 0xff;
      if (this.b[this.pos >> 3] === undefined) throw new Error('FLAC: unexpected end of data');
      if (byte === 0) { n += 8 - off; this.pos += 8 - off; continue; }
      const z = Math.clz32(byte) - 24;
      n += z; this.pos += z + 1;
      return n;
    }
  }
  align() { this.pos = (this.pos + 7) & ~7; }
}

function utf8Number(r) {
  let first = r.read(8), n = 0, v;
  if (first < 0x80) return first;
  while (first & (0x80 >> n)) n++;
  v = first & (0x7f >> n);
  for (let i = 1; i < n; i++) v = v * 64 + (r.read(8) & 0x3f);
  return v;
}

function residual(r, out, start, blockSize, order) {
  const method = r.read(2);
  if (method > 1) throw new Error('FLAC: reserved residual coding method');
  const pbits = method ? 5 : 4, escape = method ? 31 : 15, po = r.read(4), parts = 1 << po;
  let i = start;
  for (let p = 0; p < parts; p++) {
    const n = (blockSize >> po) - (p === 0 ? order : 0), k = r.read(pbits);
    if (k === escape) {
      const bits = r.read(5);
      for (let j = 0; j < n; j++) out[i++] = r.signed(bits);
    } else {
      for (let j = 0; j < n; j++) {
        const q = r.unary(), v = k ? q * (1 << k) + r.read(k) : q;
        out[i++] = v % 2 ? -(v + 1) / 2 : v / 2;
      }
    }
  }
}

const FIXED = [[], [1], [2, -1], [3, -3, 1], [4, -6, 4, -1]];

function subframe(r, blockSize, bps) {
  if (r.bit()) throw new Error('FLAC: bad subframe padding');
  const type = r.read(6);
  let wasted = 0;
  if (r.bit()) wasted = r.unary() + 1;
  const bits = bps - wasted, x = new Float64Array(blockSize);
  if (type === 0) x.fill(r.signed(bits));
  else if (type === 1) for (let i = 0; i < blockSize; i++) x[i] = r.signed(bits);
  else if (type >= 8 && type <= 12) {
    const order = type - 8;
    for (let i = 0; i < order; i++) x[i] = r.signed(bits);
    residual(r, x, order, blockSize, order);
    const c = FIXED[order];
    for (let i = order; i < blockSize; i++) { let s = 0; for (let j = 0; j < order; j++) s += c[j] * x[i - j - 1]; x[i] += s; }
  } else if (type >= 32) {
    const order = type - 31;
    for (let i = 0; i < order; i++) x[i] = r.signed(bits);
    const precision = r.read(4) + 1;
    if (precision === 16) throw new Error('FLAC: invalid LPC precision');
    const shift = r.signed(5), coefs = new Float64Array(order), div = 2 ** shift;
    for (let j = 0; j < order; j++) coefs[j] = r.signed(precision);
    residual(r, x, order, blockSize, order);
    for (let i = order; i < blockSize; i++) {
      let s = 0;
      for (let j = 0; j < order; j++) s += coefs[j] * x[i - j - 1];        // exact in a double: |s| < 2^53 for 24-bit audio
      x[i] += Math.floor(s / div);                                        // the arithmetic shift
    }
  } else throw new Error(`FLAC: reserved subframe type ${type}`);
  if (wasted) for (let i = 0; i < blockSize; i++) x[i] *= 2 ** wasted;
  return x;
}

export function decodeFlac(bytes) {
  const b = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'fLaC') throw new Error('not a FLAC file');
  let o = 4, info = null, last = false;
  const tags = {};
  while (!last) {
    last = !!(b[o] & 0x80);
    const type = b[o] & 0x7f, len = b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3];
    const r = new Bits(b, o + 4);
    if (type === 0) {
      r.read(16); r.read(16); r.read(24); r.read(24);
      info = {sampleRate:r.read(20), channels:r.read(3) + 1, bps:r.read(5) + 1, total:r.read(36),
        md5:Array.from(b.subarray(o + 4 + 18, o + 4 + 34), v => v.toString(16).padStart(2, '0')).join('')};
    } else if (type === 4) {
      const dv = new DataView(b.buffer, b.byteOffset + o + 4, len);
      let p = 4 + dv.getUint32(0, true);
      const count = dv.getUint32(p, true); p += 4;
      const text = new TextDecoder();
      for (let k = 0; k < count; k++) {
        const n = dv.getUint32(p, true), s = text.decode(b.subarray(o + 4 + p + 4, o + 4 + p + 4 + n)), eq = s.indexOf('=');
        if (eq > 0) tags[s.slice(0, eq).toUpperCase()] = s.slice(eq + 1);
        p += 4 + n;
      }
    }
    o += 4 + len;
  }
  if (!info) throw new Error('FLAC without STREAMINFO');
  const ints = Array.from({length:info.channels}, () => new Int32Array(info.total));
  let at = 0;
  while (o + 2 < b.length && at < info.total) {
    if (b[o] !== 0xff || (b[o + 1] & 0xfe) !== 0xf8) throw new Error(`FLAC: lost frame sync at byte ${o}`);
    const r = new Bits(b, o + 2), frameStart = o;
    const bsCode = r.read(4), srCode = r.read(4), chCode = r.read(4), ssCode = r.read(3);
    r.read(1);
    utf8Number(r);
    let blockSize = bsCode === 1 ? 192 : bsCode <= 5 ? 576 << (bsCode - 2) : bsCode === 6 ? r.read(8) + 1 : bsCode === 7 ? r.read(16) + 1 : 256 << (bsCode - 8);
    if (srCode === 12) r.read(8); else if (srCode === 13 || srCode === 14) r.read(16);
    r.read(8);                                          // header CRC-8
    const bps = ssCode === 0 ? info.bps : [0, 8, 12, 0, 16, 20, 24, 32][ssCode];
    const nch = chCode < 8 ? chCode + 1 : 2;
    blockSize = Math.min(blockSize, info.total - at);
    const sub = [];
    for (let c = 0; c < nch; c++) sub.push(subframe(r, blockSize, bps + ((chCode === 8 && c === 1) || (chCode === 9 && c === 0) || (chCode === 10 && c === 1) ? 1 : 0)));
    r.align();
    const end = r.byte, crc = b[end] << 8 | b[end + 1];
    let c16 = 0;
    for (let i = frameStart; i < end; i++) c16 = ((c16 << 8) ^ CRC16[((c16 >> 8) ^ b[i]) & 0xff]) & 0xffff;
    if (c16 !== crc) throw new Error(`FLAC: frame CRC mismatch at byte ${frameStart}`);
    o = end + 2;
    for (let i = 0; i < blockSize; i++) {
      let l = sub[0][i], s = sub[1]?.[i];
      if (chCode === 8) s = l - s;                                  // left/side
      else if (chCode === 9) { l = l + s; }                         // side/right: l = side + right
      else if (chCode === 10) { const m = l * 2 + (s & 1); l = (m + s) / 2; s = (m - s) / 2; }
      ints[0][at + i] = l;
      if (nch > 1) ints[1][at + i] = chCode === 9 ? sub[1][i] : s;
      for (let c = 2; c < nch; c++) ints[c][at + i] = sub[c][i];
    }
    at += blockSize;
  }
  const scale = 2 ** (info.bps - 1);
  return {sampleRate:info.sampleRate, bitsPerSample:info.bps, samples:at, md5:info.md5, tags,
    ints, channels:ints.map(ch => Float32Array.from(ch.subarray(0, at), v => v / scale))};
}

// A take's stored pitch track (the Vorbis comment PIXEL_PITCH the renderer
// writes: "hop,offset,base64 of Uint16LE f0 in 0.1 Hz"), as pixel.js pitchTrack returns it.
export function pitchFromTag(tag) {
  if (!tag) return null;
  const [hop, offset, data] = tag.split(',');
  const raw = typeof atob === 'function' ? Uint8Array.from(atob(data), c => c.charCodeAt(0)) : Uint8Array.from(Buffer.from(data, 'base64'));
  const f0 = new Float32Array(raw.length >> 1);
  for (let i = 0; i < f0.length; i++) f0[i] = (raw[2 * i] | raw[2 * i + 1] << 8) / 10;
  return {hop:+hop, offset:+offset, f0, rms:null};
}
export function pitchToTag(track) {
  const raw = new Uint8Array(track.f0.length * 2);
  track.f0.forEach((v, i) => { const q = Math.round(v * 10); raw[2 * i] = q & 0xff; raw[2 * i + 1] = q >> 8; });
  let s = '';
  for (const v of raw) s += String.fromCharCode(v);
  return `${track.hop},${track.offset},${typeof btoa === 'function' ? btoa(s) : Buffer.from(raw).toString('base64')}`;
}
