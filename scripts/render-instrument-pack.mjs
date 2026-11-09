// The All Hands instruments as a sound pack for the Cutting Room: one hit of every voice in
// src/allhands/instruments.js (no samples, all synthesis), and the tambourine's shake at three
// velocities. Rendered offline in headless Chromium the way scripts/render-day-one-sound.mjs renders
// the score (Vite on port 0, a blank same-origin page, an OfflineAudioContext at 48 kHz stereo), each
// voice at its own level (Math.random seeded per voice, so renders repeat exactly), then peak-normalized to -1 dBFS, its tail trimmed at -60 dB, as MP3 160k.
//
//   node scripts/render-instrument-pack.mjs --out DIR [--url ORIGIN]
//
// Writes DIR/<voice>.mp3 and DIR/items.json ({groupLabel:'Family', items:[{file, text, group, name}]}),
// ready for: node scripts/publish-to-cutting-room.mjs --pack DIR/items.json --items-dir instruments ...
// A row's text names the voice and the songs that play it (found in the song code, not typed in).
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = arg('out');
if (!OUT) throw Error('Pass --out DIR.');

// A minor 7th (A3 C4 E4 G4), its root in the bass: one chord for every pitched voice.
const CHORD = [57, 60, 64, 67], ROOT_LOW = 33, ROOT_MID = 45;
// The tuned kick at its defaults is the kick itself; each song that plays it tunes it (const KICK in the song's file).
const tuning = f => Function(`return (${fs.readFileSync(path.join(ROOT, f), 'utf8').match(/^const KICK = (\{[^}]+\});/m)[1]})`)();
// [voice, family, name, seconds rendered, ...arguments after (ctx, out, t)]
const VOICES = [
  ['kick', 'Drums', 'Kick', 1, 1],
  ['tunedKick', 'Drums', 'Tuned kick, round, on B-flat', 1.2, 1, tuning('src/allhands/songbook/humbled-and-honored.js'), {where:['Humbled and Honored']}],
  ['tunedKick', 'Drums', 'Tuned kick, tight, on C', 1.2, 1, tuning('src/allhands/songbook/hustle.js'), {where:['Hustle']}],
  ['dropKick', 'Drums', 'Drop kick', 1.2, 1],
  ['snare', 'Drums', 'Snare', 1, 1], ['snareRoll', 'Drums', 'Snare roll hit', 1, .8], ['clap', 'Drums', 'Clap', 1, 1],
  ['gangClap', 'Drums', 'Gang clap', 1, 1], ['snap', 'Drums', 'Snap', .8, 1, 0], ['rim', 'Drums', 'Rim', .6, .9],
  ['hat', 'Drums', 'Hi-hat', .4, .8], ['openHat', 'Drums', 'Open hi-hat', .8, .8], ['ride', 'Drums', 'Ride', 2, .5],
  ['crash', 'Drums', 'Crash', 3, .7], ['stomp', 'Drums', 'Stomp', 1, 1], ['floorTom', 'Drums', 'Floor tom', 1.5, 45, .9],
  ['shaker', 'Percussion', 'Shaker', .6, .8], ['tambourine', 'Percussion', 'Tambourine hit', 1, 1, {kind:'hit', side:0}],
  ['tambourine', 'Percussion', 'Tambourine shake, soft', .8, .35, {kind:'shake', side:0}],
  ['tambourine', 'Percussion', 'Tambourine shake, medium', .8, .65, {kind:'shake', side:0}],
  ['tambourine', 'Percussion', 'Tambourine shake, hard', .8, 1, {kind:'shake', side:0}],
  ['handDrum', 'Percussion', 'Hand drum', 1.2, 57, .8, {stroke:'open'}], ['logDrum', 'Percussion', 'Log drum', 1.5, 64, .8],
  ['chime', 'Percussion', 'Chime', 3, 76, .7], ['tick', 'Percussion', 'Tick', .5, .8, {accent:true}],
  ['bass', 'Bass', 'Bass', 1.8, ROOT_MID, 1.4, .9], ['sustainBass', 'Bass', 'Sustained bass', 2.4, ROOT_MID, 2, .8],
  ['wobble', 'Bass', 'Wobble bass', 2.4, ROOT_MID, 2, .25, .78], ['sub808', 'Bass', '808 sub', 2.2, ROOT_LOW, 1.8, .85],
  ['fingerBass', 'Bass', 'Finger bass', 1.6, ROOT_MID, 1.2, .8], ['reese', 'Bass', 'Reese bass', 2.2, ROOT_MID, 1.8, .8],
  ['humBass', 'Bass', 'Hum bass', 2.6, ROOT_MID, 2, .6], ['warmBass', 'Bass', 'Warm bass', 2, ROOT_MID, 1.5, .8],
  ['subDrop', 'Bass', 'Sub drop', 2.4, .7],
  ['stab', 'Keys', 'Stab', 2.6, CHORD, 2.2, 1, 2600], ['chop', 'Keys', 'Chop', 1, CHORD.slice(1).map(m => m + 12), 1],
  ['rhodes', 'Keys', 'Rhodes', 3, CHORD, 2.2, 1], ['organ', 'Keys', 'Organ', 2.6, CHORD, 2, .8],
  ['harmonium', 'Keys', 'Harmonium', 3, CHORD, 2.4, .8], ['cleanGuitar', 'Keys', 'Clean guitar', 2.6, CHORD.map(m => m - 12), .8],
  ['pad', 'Pads', 'Pad', 4, CHORD, 3, .8], ['voicePad', 'Pads', 'Voice pad', 4.5, CHORD, 3, .7, {vowel:'ah'}],
  ['warmPad', 'Pads', 'Warm pad', 5, CHORD, 3, .85], ['seqArp', 'Pads', 'Sequencer arp note', 1, 69, .4, .5],
  ['riser', 'Effects', 'Riser', 4.2, 4, .32], ['impact', 'Effects', 'Impact', 3, .9], ['downlifter', 'Effects', 'Downlifter', 3.2, 3, .22],
  ['reverseCrash', 'Effects', 'Reverse crash', 2.2, 2, .4], ['sawRiser', 'Effects', 'Saw riser', 4.2, 4, 57, 81, .05],
  ['keyClick', 'Office', 'Keyboard click', .4, .3, 0], ['mug', 'Office', 'Mug', 1, 81, .3, 0], ['creak', 'Office', 'Chair creak', 1.2, .9, .12],
  ['roomTone', 'Office', 'Room tone', 3, 3, .02], ['printerFeed', 'Office', 'Printer feed', 2, .2],
];

// Where each voice plays, read from the code that plays it.
const PLAYERS = [
  ['src/allhands/songbook/circle-back.js', 'Circle Back'], ['src/allhands/songbook/humbled-and-honored.js', 'Humbled and Honored'],
  ['src/allhands/songbook/hustle.js', 'Hustle'], ['src/allhands/songbook/offsite.js', 'Offsite'], ['src/allhands/songbook/delve.js', 'DELVE.'],
  ['src/allhands/engine.js', 'the Drop Edition drops'], ['src/allhands/river.js', 'the river'], ['src/films/day-one/score.js', 'Day One.'],
].map(([f, title]) => [fs.readFileSync(path.join(ROOT, f), 'utf8'), title]);
const playedIn = voice => PLAYERS.filter(([code]) => new RegExp(`\\b${voice}\\(`).test(code)).map(([, t]) => t);
const join = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

async function server(url) {
  if (url) return {origin:url.replace(/\/$/, ''), close:async () => {}};
  const {createServer} = await import('vite');
  const s = await createServer({root:ROOT, configFile:path.join(ROOT, 'vite.config.js'), logLevel:'error', clearScreen:false, server:{port:0, host:'127.0.0.1', hmr:false}});
  await s.listen();
  return {origin:`http://127.0.0.1:${s.httpServer.address().port}`, close:() => s.close()};
}
function wav(channels, sr) {                                         // 32-bit float WAV
  const n = channels[0].length, data = Buffer.alloc(n * channels.length * 4);
  for (let i = 0; i < n; i++) for (let c = 0; c < channels.length; c++) data.writeFloatLE(channels[c][i], (i * channels.length + c) * 4);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(3, 20); h.writeUInt16LE(channels.length, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * channels.length * 4, 28);
  h.writeUInt16LE(channels.length * 4, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('Install Playwright to render.'); })();
const srv = await server(arg('url'));
const browser = await chromium.launch();
fs.mkdirSync(OUT, {recursive:true});
const items = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('[page]', e.message));
  await page.route(`${srv.origin}/__instrument-pack`, r => r.fulfill({contentType:'text/html', body:'<!doctype html><meta charset="utf-8"><title>Instruments</title>'}));
  await page.goto(`${srv.origin}/__instrument-pack`);
  const seen = new Map();
  const hashes = new Map();
  for (const [voice, family, name, seconds, ...rest] of VOICES) {
    const own = rest.length && rest[rest.length - 1]?.where ? rest.pop().where : null, args = rest;
    const r = await page.evaluate(async ({voice, seconds, args}) => {
      const I = await import('/src/allhands/instruments.js');
      // Noise and detune draw on Math.random: seed it per voice, so a render is the same every time.
      let a = 0x9e3779b9 ^ [...voice].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) ^ Math.round(seconds * 1000);
      Math.random = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const sr = 48000, ctx = new OfflineAudioContext(2, Math.ceil(seconds * sr), sr);
      I[voice](ctx, ctx.destination, .02, ...args);
      const b = await ctx.startRendering();
      const enc = a => { const u = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); };
      return {sr, l:enc(b.getChannelData(0)), r:enc(b.getChannelData(1))};
    }, {voice, seconds, args});
    const dec = s => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
    let [L, R] = [dec(r.l), dec(r.r)];
    let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    if (!(peak > 1e-5)) throw Error(`${voice} rendered silence`);
    // The tail ends where the sound falls 60 dB under its peak (plus 40 ms, faded).
    let end = L.length;
    while (end > 1 && Math.max(Math.abs(L[end - 1]), Math.abs(R[end - 1])) < peak / 1000) end--;
    end = Math.min(L.length, end + Math.round(.04 * r.sr));
    const g = 10 ** (-1 / 20) / peak, fade = Math.round(.03 * r.sr);
    [L, R] = [L, R].map(ch => { const o = new Float32Array(end); for (let i = 0; i < end; i++) o[i] = ch[i] * g * Math.min(1, (end - i) / fade); return o; });
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (seen.has(base)) throw Error(`two voices named ${base}`); seen.set(base, true);
    const tmp = path.join(OUT, `${base}.wav`), mp3 = path.join(OUT, `${base}.mp3`);
    fs.writeFileSync(tmp, wav([L, R], r.sr));
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-c:a', 'libmp3lame', '-b:a', '160k', '-map_metadata', '-1', '-id3v2_version', '0', '-fflags', '+bitexact', '-flags:a', '+bitexact', mp3]);
    fs.rmSync(tmp);
    const sum = createHash('sha256').update(fs.readFileSync(mp3)).digest('hex');
    if (hashes.has(sum)) throw Error(`${base} sounds exactly like ${hashes.get(sum)}: give it its song's settings`);
    hashes.set(sum, base);
    const where = own || playedIn(voice);
    items.push({file:mp3, name:base, group:family, text:`${name}${where.length ? `. Plays in ${join(where)}.` : '.'}`.replace(/\.\.$/, '.')});
    console.log(`${base}.mp3  ${(end / r.sr).toFixed(2)} s  peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS before  ${where.join(', ') || '-'}`);
  }
} finally {
  await browser.close();
  await srv.close();
}
fs.writeFileSync(path.join(OUT, 'items.json'), JSON.stringify({groupLabel:'Family', items}, null, 1) + '\n');
console.log(`${items.length} sounds in ${OUT}; items.json written`);
