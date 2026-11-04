// Synergy's singing source: one eSpeak NG take per word, with his approved
// desktop-robot voice and pitch. Sung takes run at 175 wpm rather than his
// 154 speaking rate: measured with Whisper, the vocoded words are as legible
// as spoken ones at 175 and noticeably worse at 154. The browser vocoder
// supplies the notes. No paid voice service is involved.
import express from 'express';
import {execFile} from 'node:child_process';

const VOICE = ['-v', 'en-us', '-s', '175', '-p', '35', '-a', '140', '-z'];
// A sung unit is one word, or a short respelling such as "chat G P T".
const WORD = /^[\p{L}\p{N}](?:[\p{L}\p{N}'’.%&-]| (?! )){0,39}$/u;
export const MAX_WORDS = 64;

const fault = (status, message) => Object.assign(new Error(message), {status});

export function normalizeWords(value) {
  if (!Array.isArray(value) || !value.length || value.length > MAX_WORDS) throw fault(400, `Send between one and ${MAX_WORDS} words.`);
  const words = [...new Set(value.map(w => typeof w === 'string' ? w.trim() : ''))];
  if (words.some(w => !WORD.test(w))) throw fault(400, 'Words may contain letters, numbers and simple punctuation only.');
  return words;
}

export function espeakWord(word) {
  return new Promise((resolve, reject) => {
    execFile('espeak-ng', [...VOICE, '--stdout', word], {encoding:'buffer', maxBuffer:2_000_000, timeout:8000}, (error, stdout) => {
      if (error) reject(error);
      else if (stdout.length < 45 || stdout.toString('ascii', 0, 4) !== 'RIFF') reject(new Error('eSpeak returned no audio'));
      else resolve(fixStreamedWave(stdout));
    });
  });
}

// eSpeak writes placeholder RIFF sizes when streaming to stdout. Patch them
// so every browser decoder accepts the take.
export function fixStreamedWave(bytes) {
  const out = Buffer.from(bytes);
  let at = 12;
  while (at + 8 <= out.length) {
    const id = out.toString('ascii', at, at + 4);
    if (id === 'data') { out.writeUInt32LE(out.length - at - 8, at + 4); break; }
    at += 8 + out.readUInt32LE(at + 4);
  }
  out.writeUInt32LE(out.length - 8, 4);
  return out;
}

export function createAllHandsVoice({synthesize = espeakWord, cacheSize = 1500, requestLimit = 40, windowMs = 10 * 60 * 1000, concurrency = 3} = {}) {
  const router = express.Router(), cache = new Map(), inFlight = new Map(), requests = new Map();
  let active = 0;
  const queue = [];
  const run = job => new Promise((resolve, reject) => {
    const next = () => { active++; job().then(resolve, reject).finally(() => { active--; queue.shift()?.(); }); };
    active < concurrency ? next() : queue.push(next);
  });
  async function take(word) {
    if (cache.has(word)) { const hit = cache.get(word); cache.delete(word); cache.set(word, hit); return hit; }
    if (!inFlight.has(word)) inFlight.set(word, run(() => synthesize(word)).then(bytes => {
      cache.set(word, bytes);
      while (cache.size > cacheSize) cache.delete(cache.keys().next().value);
      return bytes;
    }).finally(() => inFlight.delete(word)));
    return inFlight.get(word);
  }
  router.post('/', express.json({limit:'8kb'}), async (req, res) => {
    const now = Date.now(), ip = req.ip || 'local', seen = (requests.get(ip) || []).filter(t => now - t < windowMs);
    if (seen.length >= requestLimit) { res.status(429).json({error:'Synergy needs a moment. Try again shortly.'}); return; }
    seen.push(now); requests.set(ip, seen);
    try {
      const words = normalizeWords(req.body?.words);
      const audio = await Promise.all(words.map(take));
      res.set('Cache-Control', 'no-store').json({voice:'synergy-espeak-ng-175-35', words:Object.fromEntries(words.map((w, i) => [w, audio[i].toString('base64')]))});
    } catch (error) {
      res.status(error.status || 502).json({error:error.status ? error.message : 'Synergy could not be reached.'});
    }
  });
  return {router, take};
}

// Vite development server: the same router, so local playback is the real path.
export function allHandsVoiceApi() {
  return {name:'allhands-voice', configureServer(server) {
    const app = express();
    app.use('/api/allhands/voice', createAllHandsVoice().router);
    server.middlewares.use(app);
  }};
}
