// Synergy says "Loading." for the printer's music video (docs/printer-song-video.md, The intro): the
// project's own robot voice, end to end. eSpeak NG renders the word in his approved voice (the voice
// route's: en-us, pitch 35, amplitude 140; server/allhands-voice.js), at his speaking rate, 154 wpm,
// and the browser runs it through his own vocoder and voice chain (src/allhands/vocoder.js
// createVocoder; engine.js buildGraph: the saw choir as the carrier, his high-pass, compressor and
// the dotted-eighth echo), offline, in headless Chromium on the project's own dev server. No paid
// service, nothing downloaded.
//
//   node scripts/render-printer-intro.mjs [--out assets/printer-song/printer-intro-voice.flac]
//       [--wpm 154] [--notes 57,50] [--mode both] [--dry 1] [--vocoder .3] [--echo .12]
//
// The carrier sings two notes in the track's own key (D: its low drone is D3, 147.8 Hz): LOAD on A3,
// -ing on D3, a falling fourth onto the tonic, the way a machine says it is busy. The blend is measured,
// not guessed: Whisper small.en hears "Loading" in his dry voice with the vocoder at .3 under it, alone
// and over the intro's bed; with the engine's sung mode (vocoder 1, dry .06) or 'both' (.85, .42) it
// hears "You did" and "Yo dick". 154 wpm reads better than his sung 175.
// Writes a 44.1 kHz 16-bit stereo FLAC, 2.5 s, the word's onset at 0.050 s (its first sample above
// -38 dBFS), peak -6 dBFS. scripts/edit-printer-song.py mixes it into the film's sound.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync, execFile} from 'node:child_process';
import os from 'node:os';
import {studioServer, launch} from './export-videostudio.mjs';
import {espeakWord, fixStreamedWave} from '../server/allhands-voice.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback; };
export const WORD = 'Loading.', ONSET = .05, SECONDS = 2.5, RATE = 44100;
const NOTES = arg('notes', '57,50').split(',').map(Number), wpm = +arg('wpm', '154'), dryArg = arg('dry', '1'), vocArg = arg('vocoder', '.3'), echo = +arg('echo', '.12');
const mode = arg('mode', 'both'), out = path.resolve(arg('out', path.join(ROOT, 'assets/printer-song/printer-intro-voice.flac')));

// His sung takes run at 175 wpm (the route's espeakWord); any other rate is his same voice at that rate.
const take = wpm === 175 ? await espeakWord(WORD) : await new Promise((resolve, reject) => execFile('espeak-ng', ['-v', 'en-us', '-s', String(wpm), '-p', '35', '-a', '140', '-z', '--stdout', WORD], {encoding:'buffer', maxBuffer:2_000_000}, (e, b) => e ? reject(e) : resolve(fixStreamedWave(b))));
const srv = await studioServer({});
const browser = await launch({});
try {
  const page = await browser.newPage();
  await page.route(`${srv.origin}/__printer-intro`, r => r.fulfill({contentType:'text/html', body:'<!doctype html><meta charset="utf-8"><title>intro voice</title>'}));
  await page.goto(`${srv.origin}/__printer-intro`);
  const pcm = await page.evaluate(async ({b64, mode, notes, onset, seconds, rate, dryLevel, vocLevel, echo}) => {
    const {createVocoder} = await import('/src/allhands/vocoder.js'), I = await import('/src/allhands/instruments.js'), {VOICE_MODES} = await import('/src/allhands/engine.js');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const ctx = new OfflineAudioContext(2, Math.round(seconds * rate), rate);
    const word = await ctx.decodeAudioData(bytes.buffer);
    // The take's lead (voice.js measure): its first sample above .012, less 4 ms.
    const d = word.getChannelData(0); let first = 0, last = d.length - 1;
    while (first < d.length && Math.abs(d[first]) < .012) first++;
    while (last > first && Math.abs(d[last]) < .012) last--;
    const lead = Math.max(0, first / word.sampleRate - .004), length = (last - first) / word.sampleRate + .02;
    // His chain (engine.js buildGraph): words into the vocoder and a dry path, the saw choir as the carrier.
    const m = {...VOICE_MODES[mode], ...(dryLevel !== null ? {dry:dryLevel} : {}), ...(vocLevel !== null ? {vocoder:vocLevel} : {})}, vocoder = createVocoder(ctx), words = I.amp(ctx, 1), dry = I.amp(ctx, m.dry), sung = I.amp(ctx, m.vocoder);
    const hp = I.biquad(ctx, 'highpass', 130), lp = I.biquad(ctx, 'lowpass', 20000, .7), comp = ctx.createDynamicsCompressor(), gain = I.amp(ctx, 2.1);
    comp.threshold.value = -28; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .12;
    words.connect(vocoder.input); words.connect(dry); dry.connect(hp); vocoder.output.connect(sung); sung.connect(hp);
    hp.connect(lp); lp.connect(comp); comp.connect(gain); gain.connect(ctx.destination);
    // The engine's dotted-eighth echo (0.375 s at this track's 0.125 s step), a little of it.
    const dIn = I.biquad(ctx, 'highpass', 350), delay = ctx.createDelay(2), fb = I.amp(ctx, .34), damp = I.biquad(ctx, 'lowpass', 3200), dOut = I.amp(ctx, .5), send = I.amp(ctx, echo);
    delay.delayTime.value = .375; gain.connect(send); send.connect(dIn); dIn.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay); damp.connect(dOut); dOut.connect(ctx.destination);
    const carrier = I.amp(ctx, 1); carrier.connect(vocoder.carrier);
    const lead3 = [[0, .5], [7, .32], [-1200, .26]].map(([detune, level]) => { const o = ctx.createOscillator(), g = I.amp(ctx, level); o.type = 'sawtooth'; o.frequency.value = I.mtof(notes[0]); o.detune.value = detune; o.connect(g); g.connect(carrier); return o; });
    const hiss = ctx.createBufferSource(), hissHp = I.biquad(ctx, 'highpass', 3800), hissGain = I.amp(ctx, .16);
    hiss.buffer = I.noiseBuffer(ctx); hiss.loop = true; hiss.connect(hissHp); hissHp.connect(hissGain); hissGain.connect(carrier);
    // The second syllable: at the envelope's deepest dip between 30 % and 75 % of the word.
    const env = [], hop = Math.round(word.sampleRate * .01);
    for (let i = first; i < last; i += hop) { let s = 0; for (let j = i; j < Math.min(last, i + hop); j++) s += d[j] * d[j]; env.push(Math.sqrt(s / hop)); }
    let dip = Math.round(env.length * .5), lo = Infinity;
    for (let i = Math.round(env.length * .3); i < Math.round(env.length * .75); i++) if (env[i] < lo) { lo = env[i]; dip = i; }
    const t0 = onset, t1 = onset + dip * hop / word.sampleRate;
    for (const o of lead3) { o.frequency.setValueAtTime(I.mtof(notes[0]), 0); o.frequency.setTargetAtTime(I.mtof(notes[1]), t1, .007); o.start(0); }
    hiss.start(0);
    // The word as the engine plays it (playWord): 4 ms in, out over its last 22 ms.
    const s = ctx.createBufferSource(), g = I.amp(ctx, 0);
    s.buffer = word; s.connect(g); g.connect(words);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + .004); g.gain.setValueAtTime(1, t0 + Math.max(.005, length - .022)); g.gain.linearRampToValueAtTime(0, t0 + length);
    s.start(t0, lead, length + .01);
    const buf = await ctx.startRendering();
    const L = buf.getChannelData(0), R = buf.getChannelData(1), outI = new Int16Array(L.length * 2);
    let peak = 0; for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const k = peak > .5 ? .5 / peak : 1;              // to -6 dBFS: edit-printer-song.py sets the level in the mix
    for (let i = 0; i < L.length; i++) { outI[2 * i] = Math.round(Math.max(-1, Math.min(1, L[i] * k)) * 32767); outI[2 * i + 1] = Math.round(Math.max(-1, Math.min(1, R[i] * k)) * 32767); }
    let bin = ''; const u8 = new Uint8Array(outI.buffer); for (let i = 0; i < u8.length; i += 32768) bin += String.fromCharCode(...u8.subarray(i, i + 32768));
    return {b64:btoa(bin), length, dip:t1 - t0, peak};
  }, {b64:take.toString('base64'), mode, notes:NOTES, onset:ONSET, seconds:SECONDS, rate:RATE, dryLevel:dryArg === undefined ? null : +dryArg, vocLevel:vocArg === undefined ? null : +vocArg, echo});
  const raw = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'intro-')), 'voice.raw');
  fs.writeFileSync(raw, Buffer.from(pcm.b64, 'base64'));
  fs.mkdirSync(path.dirname(out), {recursive:true});
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 's16le', '-ar', String(RATE), '-ac', '2', '-i', raw, '-c:a', 'flac', '-compression_level', '8', '-map_metadata', '-1', '-fflags', '+bitexact', out]);
  console.log(JSON.stringify({out:path.relative(ROOT, out), word:WORD, mode, wpm, dry:dryArg ?? null, notes:NOTES, onset:ONSET, word_seconds:+pcm.length.toFixed(3), second_syllable:+pcm.dip.toFixed(3), peak:+pcm.peak.toFixed(3)}));
} finally {
  await browser.close();
  await srv.close();
}
