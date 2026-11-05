// Minimal WAV codec for the pixel-voice tools: PCM 16-bit or 32-bit float in,
// PCM 16-bit out, no dither. Works on
// Uint8Array / ArrayBuffer, so it runs in Node and in the page.

export function decodeWav(bytes) {
  const b = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const tag = o => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let o = 12, fmt = null, data = null;
  while (o + 8 <= b.length) {
    const id = tag(o), size = v.getUint32(o + 4, true);
    if (id === 'fmt ') {
      let format = v.getUint16(o + 8, true);
      if (format === 0xFFFE && size >= 26) format = v.getUint16(o + 32, true);     // WAVE_FORMAT_EXTENSIBLE: the sub-format
      fmt = {format, channels:v.getUint16(o + 10, true), sampleRate:v.getUint32(o + 12, true), bits:v.getUint16(o + 22, true)};
    }
    if (id === 'data') { data = [o + 8, Math.min(size, b.length - o - 8)]; break; }
    o += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('WAV without fmt or data');
  const {channels, sampleRate, bits} = fmt, float = fmt.format === 3;
  const frame = channels * bits / 8, n = Math.floor(data[1] / frame), out = Array.from({length:channels}, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) {
    const p = data[0] + i * frame + c * bits / 8;
    out[c][i] = bits === 16 ? v.getInt16(p, true) / 32768 : bits === 32 && float ? v.getFloat32(p, true)
      : bits === 32 ? v.getInt32(p, true) / 2147483648 : bits === 24 ? ((b[p] | b[p + 1] << 8 | b[p + 2] << 16) << 8 >> 8) / 8388608 : 0;
  }
  return {sampleRate, channels:out};
}

export function encodeWav(channels, sampleRate) {
  const ch = Array.isArray(channels) ? channels : [channels], n = ch[0].length, k = ch.length;
  const buf = new ArrayBuffer(44 + n * k * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * k * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, k, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * k * 2, true); v.setUint16(32, k * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * k * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) {
    const s = Math.max(-1, Math.min(1, ch[c][i]));
    v.setInt16(o, Math.round(s < 0 ? s * 32768 : s * 32767), true); o += 2;
  }
  return new Uint8Array(buf);
}
