// Trim leading dead air / low-level lead-in from a 16-bit PCM WAV.
import { readFileSync, writeFileSync } from 'fs';
const file = process.argv[2];
const buf = readFileSync(file);
if (buf.toString('latin1', 0, 4) !== 'RIFF') { console.log('not a RIFF'); process.exit(0); }
// walk chunks to find fmt + data
let off = 12, fmt = null, dataOff = 0, dataLen = 0;
while (off + 8 <= buf.length) {
  const id = buf.toString('latin1', off, off + 4);
  const size = buf.readUInt32LE(off + 4);
  if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
  if (id === 'data') { dataOff = off + 8; dataLen = size; break; }
  off += 8 + size + (size % 2);
}
if (!fmt || fmt.bits !== 16 || !dataLen) { console.log('unsupported', JSON.stringify(fmt)); process.exit(0); }
const frames = Math.floor(dataLen / (2 * fmt.channels));
const peak = (() => { let m = 0; for (let i = 0; i < frames; i++) m = Math.max(m, Math.abs(buf.readInt16LE(dataOff + i * 2 * fmt.channels))); return m; })();
const gate = Math.max(300, peak * 0.035);
let start = 0;
for (let i = 0; i < frames; i++) { if (Math.abs(buf.readInt16LE(dataOff + i * 2 * fmt.channels)) > gate) { start = i; break; } }
const pad = Math.floor(fmt.rate * 0.02);              // keep 20ms of air before the first word
start = Math.max(0, start - pad);
const trimmedSec = start / fmt.rate;
if (start <= 0) { console.log(JSON.stringify({ file, trimmedSec: 0, note: 'nothing to trim' })); process.exit(0); }
const body = buf.subarray(dataOff + start * 2 * fmt.channels, dataOff + dataLen);
const head = Buffer.alloc(44);
head.write('RIFF', 0); head.writeUInt32LE(36 + body.length, 4); head.write('WAVE', 8);
head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20);
head.writeUInt16LE(fmt.channels, 22); head.writeUInt32LE(fmt.rate, 24);
head.writeUInt32LE(fmt.rate * fmt.channels * 2, 28); head.writeUInt16LE(fmt.channels * 2, 32); head.writeUInt16LE(16, 34);
head.write('data', 36); head.writeUInt32LE(body.length, 40);
writeFileSync(file, Buffer.concat([head, body]));
console.log(JSON.stringify({ file, trimmedSec: +trimmedSec.toFixed(3), newSec: +(body.length / (2 * fmt.channels * fmt.rate)).toFixed(2) }));
