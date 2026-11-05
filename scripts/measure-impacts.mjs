// Which couplet drops land as a word: every couplet of the lexicon that can be the
// Drop Edition's drop, on every Drop Edition track it fits, in every voice the bank
// has its tag and impact in, rendered through /allhands/ (the drop alone recast into
// each host post's cast, the bars around the impact) and heard by Whisper small.en:
// the impact word alone, from 50 ms before it to 150 ms after it ends, cut from the
// full mix. Writes src/allhands/vocabulary/impact-heard.json, which casting.js reads:
// a couplet is the drop on a track only in a voice Whisper heard there exactly, in
// every host's render (README, "The couplet's impact").
//
//   node scripts/measure-impacts.mjs --url http://localhost:5173 --work DIR [--hosts sample,16] [--only id,id]
//
// Needs a dev server, Playwright, ffmpeg and faster-whisper (small.en). About 6 s a render
// and 1 s a Whisper window on one core: 160 renders for two hosts.
import {createRequire} from 'node:module';
import {mkdirSync, writeFileSync, readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {castSong, COUPLET_BY_ID} from '../src/allhands/casting.js';
import {AVAILABLE} from '../src/allhands/voices/voice-table.js';
import {SAMPLE_POST} from '../src/allhands/lyrics.js';
import {TRACKS} from '../src/allhands/songbook/index.js';
import {IMPACT_WORD} from '../src/allhands/drop.js';

const ROOT = new URL('..', import.meta.url).pathname;
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const url = arg('url', 'http://localhost:5173'), work = arg('work'), only = arg('only')?.split(',');
if (!work) throw Error('Pass --work DIR (renders and the Whisper results go there).');
mkdirSync(work, {recursive:true});
const FIXTURES = JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/pixel-posts.json'), 'utf8')).map(x => x.post);
const HOSTS = arg('hosts', 'sample,16').split(',').map(h => [h === 'sample' ? 'sample' : `f${h}`, h === 'sample' ? SAMPLE_POST : FIXTURES[+h]]);
const DROP_TRACKS = ['circle-back', 'humbled-and-honored', 'hustle'];
const barsOf = t => [TRACKS[t].drop.impact - 2, TRACKS[t].drop.impact + 2];

// The jobs: the host's own cast on the track, its drop recast to the couplet, in each voice.
const jobs = [];
for (const [host, post] of HOSTS) for (const c of Object.values(COUPLET_BY_ID)) {
  if (!c.drop || (only && !only.includes(c.id))) continue;
  for (const track of DROP_TRACKS.filter(t => c.drop.tracks.includes(t))) {
    const base = castSong(post, {track, available:AVAILABLE}).cast;
    for (const voice of ['synthia', 'strategy']) {
      const part = p => p.voice === 'lady' ? p : {...p, voice};
      const tag = part(c.drop.tag), impact = part(c.drop.impact), who = impact.voice === 'lady' ? 'lady' : voice;
      if ([tag, impact].some(p => p.id && !AVAILABLE.has(`${p.voice}/${p.id}`)) || (who === 'lady' && voice === 'strategy')) continue;
      jobs.push({name:`${host}-${track}-${c.id}-${who}`, host, track, couplet:c.id, voice:who, post,
        cast:{...base, dropTag:{kind:'couplet', id:c.id, x:c.x, tag, impact, tracks:[...c.drop.tracks]}}});
    }
  }
}
console.log(`${jobs.length} renders`);

const require = createRequire(import.meta.url);
const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('Install Playwright to render.'); })();
const browser = await chromium.launch();
const done = [];
try {
  const page = await browser.newPage();
  await page.goto(`${url}/allhands/`, {waitUntil:'networkidle'});
  await page.waitForFunction(() => window.__allhands);
  for (const job of jobs) {
    const wav = join(work, `${job.name}.wav`);
    if (!existsSync(wav)) {
      const r = await page.evaluate(o => window.__allhands.render(o), {post:job.post, track:job.track, cast:job.cast, bars:barsOf(job.track)});
      writeFileSync(wav, Buffer.from(r.wav, 'base64'));
      const imp = r.plan.lady.find(e => e.role === 'impact');
      writeFileSync(join(work, `${job.name}.json`), JSON.stringify({drop:r.plan.drop, offset:r.plan.offset, impact:imp && {start:imp.start, length:imp.length, display:imp.display}}));
    }
    done.push(job);
  }
} finally { await browser.close(); }

// Whisper, once for every render.
const HEAR = `
import json, os, re, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel
work, names = sys.argv[1], sys.argv[2:]
model = WhisperModel('small.en', device='cpu', compute_type='int8')
norm = lambda t: re.findall(r"[a-z0-9']+", t.lower().replace('-', ' '))
out = {}
for n in names:
    J = json.load(open(os.path.join(work, n + '.json')))
    if J['drop']['kind'] != 'couplet' or not J['impact']: out[n] = None; continue
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-i', os.path.join(work, n + '.wav'), '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(pcm, '<f4'); i = J['impact']; t0 = i['start'] + J['offset'] + .016
    seg = x[int((t0 - .05) * 16000): int((t0 + i['length'] + .15) * 16000)]
    seg = np.concatenate([np.zeros(4800, np.float32), seg, np.zeros(4800, np.float32)])
    segs, _ = model.transcribe(seg, language='en', beam_size=5, temperature=0, condition_on_previous_text=False, vad_filter=False)
    h = ' '.join(s.text.strip() for s in segs).strip()
    out[n] = {'heard': h, 'exact': norm(h) == norm(re.sub(r'-$', '', i['display']))}
print(json.dumps(out))
`;
const run = spawnSync('python3', ['-I', '-c', HEAR, work, ...done.map(j => j.name)], {encoding:'utf8', maxBuffer:64 * 1024 * 1024});
if (run.status) throw Error(run.stderr);
const heard = JSON.parse(run.stdout.trim().split('\n').at(-1));
writeFileSync(join(work, 'heard.json'), JSON.stringify(heard, null, 1));

// The table: per track, per couplet, per voice, what each host's render was heard as; ok when every host's was exact.
const tracks = Object.fromEntries(DROP_TRACKS.map(t => [t, {}]));
for (const j of done) {
  const h = heard[j.name];
  if (!h) continue;                                   // the tag did not fit the choke window: her tag played
  const e = ((tracks[j.track][j.couplet] ??= {})[j.voice] ??= {heard:{}, ok:true});
  e.heard[j.host] = h.heard; e.ok &&= h.exact;
}
const sorted = o => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const doc = {version:1,
  about:"Whisper small.en (int8, beam 5) on each couplet drop's impact word alone (50 ms before it to 150 ms after it ends), cut from the full mix of the drop rendered through /allhands/ (each host post's cast with only the drop recast, the bars around the impact). ok: heard exactly in every host's render. casting.js casts a couplet as the drop on a track only in a voice that is ok there.",
  engine:{...IMPACT_WORD}, hosts:HOSTS.map(([h]) => h),
  tracks:Object.fromEntries(DROP_TRACKS.map(t => [t, sorted(Object.fromEntries(Object.entries(tracks[t]).map(([c, v]) => [c, sorted(v)])))]))};
writeFileSync(join(ROOT, 'src/allhands/vocabulary/impact-heard.json'), JSON.stringify(doc, null, 1) + '\n');
for (const t of DROP_TRACKS) {
  const ok = Object.entries(doc.tracks[t]).flatMap(([c, v]) => Object.entries(v).filter(([, e]) => e.ok).map(([voice]) => `${c}/${voice}`));
  console.log(`${t}: ${ok.length} of ${Object.values(doc.tracks[t]).reduce((n, v) => n + Object.keys(v).length, 0)} heard: ${ok.join(', ')}`);
}
