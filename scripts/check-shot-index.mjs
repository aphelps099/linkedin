#!/usr/bin/env node
// Checks src/videostudio/media/shots.json, the Video Studio shot index.
//
//   node scripts/check-shot-index.mjs            # schema, files, rules, tracks, determinism sample
//   node scripts/check-shot-index.mjs --deep     # also ffprobe every local proxy
//
// The determinism sample re-runs scripts/build-shot-index.py on two repo
// plates from scratch, twice, and compares the bytes with each other and with
// the committed records. VIDEOSTUDIO_PYTHON picks the interpreter (needs numpy
// and scipy; with OpenCV the face fields are compared too).
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readIndex, writeIndex, wantsProxy, ROUTE, PROXY_RECIPE} from '../src/videostudio/media/index-io.js';
import {createShotIndex, srcFor, lumaTrack, energyTrack, canReverse, maxZoom} from '../src/videostudio/media/shots.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(root, 'src/videostudio/media/shots.json');
const PROXIES = path.join(root, 'public/videostudio/proxies');
const deep = process.argv.includes('--deep');
const failures = [];
const fail = (id, msg) => failures.push(`${id}: ${msg}`);
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

const text = fs.readFileSync(INDEX, 'utf8');
const index = readIndex(text);
if (writeIndex(index) !== text) fail('shots.json', 'parse and rewrite does not round-trip byte for byte');
const shots = index.shots;
const lib = createShotIndex(JSON.parse(text));

const ENUM = {
  status:['C', 'A', 'S', 'R', 'E'], kind:['plate', 'brand', 'exact', 'take'],
  shotType:['wide', 'medium', 'close', 'detail', 'insert', 'plate'],
  action:['play', 'listen', 'speak', 'idle', 'print', 'walk', 'applaud', 'install', 'type', 'screen', 'celebrate', 'drink'],
  stem:['drums', 'keys', 'guitar', 'voice', null], sharpTier:['A', 'B', 'C'], reverseClass:['R0', 'R1'],
  lipSync:['exact', 'loose', 'envelope', 'none'], loop:['cut', 'xfade2', 'pingpong'],
  face:['haar', 'led-eyes+glass', 'led-eyes-model'],
};
const STEM_OF = {drums:'Operations', keys:'Keys', guitar:'Kevin', voice:'Synergy'};
const U = {A:1.8, B:1.5, C:1.2};
const ROBOTS = ['Synergy', 'Synthia'];
const NEVER = /^(pat|the lady|lady)$/i;
const VALID_KEY = /^[a-z0-9][a-z0-9-]{1,110}\.(mp4|jpg|webp)$/;
const isInt = v => Number.isInteger(v);
const isRect = r => Array.isArray(r) && r.length === 4 && r.every(isInt) && r[2] > 0 && r[3] > 0;
const inside = (r, [x, y, w, h]) => r[0] >= x && r[1] >= y && r[0] + r[2] <= x + w && r[1] + r[3] <= y + h;
const b64len = s => Buffer.from(s, 'base64').length;

// ---------------------------------------------------------------- coverage
const manifest = read('src/meeting-room/media-manifest.json');
const catalog = read('src/cutting-room/catalog.json');
const shas = new Map(shots.map(s => [s.sha256, s]));
for (const a of manifest.assets) if (!shas.has(a.sha256)) fail(a.id, 'season plate missing from the index');
const takes = catalog.assets.filter(a => a.status === 'Source take');
for (const t of takes) if (!shas.has(t.sha256)) fail(t.id, 'source take missing from the index');
if (index.meta.failures?.length) fail('shots.json', `builder recorded ${index.meta.failures.length} failures`);
const catalogByKey = new Map(catalog.assets.map(a => [a.src.split('/').pop(), a]));

// ---------------------------------------------------------------- per shot
const seen = new Map();
let localProxies = 0, proxyBytes = 0;
for (const s of shots) {
  const id = s.id;
  for (const k of [s.id, ...s.aliases]) {
    if (seen.has(k)) fail(id, `id or alias "${k}" also used by ${seen.get(k)}`);
    seen.set(k, id);
  }
  if (!/^[a-z0-9][a-z0-9-]*-[0-9a-f]{8}$/.test(id)) fail(id, 'id must be lowercase slug ending in -<sha8>');
  if (!/^[0-9a-f]{64}$/.test(s.sha256) || !id.endsWith(s.sha256.slice(0, 8))) fail(id, 'id must end with the first 8 hex of sha256');
  for (const f of ['status', 'kind', 'shotType', 'stem', 'sharpTier', 'reverseClass', 'lipSync'])
    if (!ENUM[f].includes(s[f])) fail(id, `${f} ${JSON.stringify(s[f])} not in ${ENUM[f].join('/')}`);
  if (!Array.isArray(s.action) || !s.action.length || s.action.some(a => !ENUM.action.includes(a))) fail(id, `action ${JSON.stringify(s.action)}`);
  if (!Array.isArray(s.characters) || s.characters.some(c => NEVER.test(c))) fail(id, 'Pat and the lady are never on screen');
  if (s.stem && !(s.characters.length === 1 && s.characters[0] === STEM_OF[s.stem])) fail(id, `stem ${s.stem} must be ${STEM_OF[s.stem]} alone`);
  if (s.roles.some(r => /^(bass|lady)\b/.test(r))) fail(id, 'no bass or lady roles: they never appear on video');
  // geometry and time
  if (!isInt(s.width) || !isInt(s.height) || s.width < 64 || s.height < 64) fail(id, 'width/height');
  if (s.fps !== 24) fail(id, `fps ${s.fps}: the studio is 24 fps`);
  if (!isInt(s.frames) || s.frames < 24) fail(id, 'frames');
  if (Math.abs(s.duration - s.frames / 24) > .001) fail(id, `duration ${s.duration} != frames/24`);
  if (!isRect(s.contentBox) || !inside(s.contentBox, [0, 0, s.width, s.height])) fail(id, 'contentBox outside the frame');
  for (const [fmt, r] of [['9:16', 9 / 16], ['1:1', 1], ['16:9', 16 / 9]]) {
    const c = s.safeCrops?.[fmt];
    if (!isRect(c)) { fail(id, `safeCrops[${fmt}] missing`); continue; }
    if (!inside(c, s.contentBox)) fail(id, `safeCrops[${fmt}] leaves the content box`);
    if (Math.abs(c[2] / c[3] - r) / r > .012) fail(id, `safeCrops[${fmt}] aspect ${(c[2] / c[3]).toFixed(3)}`);
  }
  if (s.faceBox) {
    const f = s.faceBox;
    if (!ENUM.face.includes(f.method)) fail(id, `faceBox.method ${f.method}`);
    if (!inside([f.x, f.y, f.w, f.h], [0, 0, s.width, s.height])) fail(id, 'faceBox outside the frame');
  }
  if (s.subjectBox && !(s.subjectBox[0] < s.subjectBox[2] && s.subjectBox[1] < s.subjectBox[3])) fail(id, 'subjectBox is [x0,y0,x1,y1]');
  if (s.maxUpscale !== U[s.sharpTier]) fail(id, `maxUpscale ${s.maxUpscale} for tier ${s.sharpTier}`);
  if (!(maxZoom(s, 480) > 0)) fail(id, 'maxZoom');
  // tracks
  if (b64len(s.lumaTrack) !== s.frames || lumaTrack(s).length !== s.frames) fail(id, `lumaTrack ${b64len(s.lumaTrack)} values for ${s.frames} frames`);
  if (b64len(s.energy) !== s.frames || energyTrack(s).length !== s.frames) fail(id, `energy ${b64len(s.energy)} values for ${s.frames} frames`);
  if (s.hits.some((h, i) => !isInt(h) || h < 0 || h >= s.frames || (i && h <= s.hits[i - 1]))) fail(id, 'hits must be increasing frames inside the clip');
  if (s.hits.length && !s.action.includes('play')) fail(id, 'hits are measured for instrument plates only');
  if (s.cuts.some(c => !isInt(c) || c <= 0 || c >= s.frames)) fail(id, 'cuts');
  for (const l of s.loops) {
    if (!(isInt(l.in) && isInt(l.out) && l.in >= 0 && l.out < s.frames && l.out - l.in === l.len && l.seam >= 0 && ENUM.loop.includes(l.method)))
      fail(id, `loop ${JSON.stringify(l)}`);
    if (s.cuts.some(c => c > l.in && c <= l.out)) fail(id, `loop ${l.in}-${l.out} crosses a hard cut`);
  }
  // sources
  if (s.src.startsWith(ROUTE)) {
    const key = s.src.slice(ROUTE.length);
    const c = catalogByKey.get(key);
    if (!VALID_KEY.test(key) || !c || c.sha256 !== s.sha256) fail(id, `remote key ${key} does not match a catalog master`);
  } else if (!fs.existsSync(path.join(root, 'public', s.src))) fail(id, `missing ${s.src}`);
  if (wantsProxy(s) && !s.proxy) fail(id, 'proxy policy wants a proxy but none is recorded');
  if (s.proxy) {
    const keys = [s.proxy, s.rev, s.poster].map(u => u?.startsWith(ROUTE) ? u.slice(ROUTE.length) : null);
    if (keys.some(k => !k || !VALID_KEY.test(k) || !/-[0-9a-f]{8}\.(mp4|jpg)$/.test(k))) fail(id, 'proxy keys must be content-hashed route keys');
    const info = s.proxyInfo;
    if (!info || info.recipe !== PROXY_RECIPE || info.h !== Math.min(540, s.height) || info.frames !== s.frames) fail(id, 'proxyInfo');
    for (const [k, b] of [[keys[0], info?.bytes?.fwd], [keys[1], info?.bytes?.rev], [keys[2], info?.bytes?.poster]]) {
      const f = path.join(PROXIES, k || '');
      if (k && fs.existsSync(f)) {
        localProxies++; proxyBytes += fs.statSync(f).size;
        if (fs.statSync(f).size !== b) fail(id, `${k} is ${fs.statSync(f).size} bytes, index says ${b}`);
      }
    }
  }
  if (s.rev && !s.proxy) fail(id, 'rev without proxy');

  // ---------------------------------------------------- reverse and mirror
  const playing = s.action.includes('play');
  if (playing && s.reverseClass !== 'R0') fail(id, 'instrument footage must be R0');
  if (s.category === 'Instruments' && s.reverseClass !== 'R0') fail(id, 'instrument plate must be R0');
  if (s.action.includes('print') && s.reverseClass !== 'R0') fail(id, 'printer pages must be R0');
  if (s.lipSync === 'exact' && s.reverseClass !== 'R0') fail(id, 'exact lip-sync must be R0');
  if (s.action.includes('drink') && s.reverseClass !== 'R0') fail(id, 'drinking must be R0');
  if (s.reverseClass === 'R1' && !s.action.some(a => ['listen', 'idle', 'walk', 'applaud', 'install', 'type', 'screen', 'celebrate', 'speak'].includes(a)))
    fail(id, 'R1 needs a reversible action');
  if (s.reverseClass === 'R0') {
    let threw = false;
    try { srcFor(s, {reverse:true}); } catch { threw = true; }
    if (!threw) fail(id, 'srcFor must refuse to reverse an R0 shot');
    if (canReverse(s) || !canReverse(s, {transport:true})) fail(id, 'canReverse');
  }
  if (s.mirrorable && s.mirrorBlockers.length) fail(id, `mirrorable with blockers ${s.mirrorBlockers}`);
  if (s.characters.some(c => ROBOTS.includes(c)) && s.shotType !== 'insert' && !s.mirrorBlockers.includes('badge')) fail(id, 'robots wear name badges');
  if (s.characters.some(c => ROBOTS.includes(c)) && s.mirrorable) fail(id, 'robot shots are never mirrored (badge)');
  if (s.characters.includes('Strategy') && s.mirrorable) fail(id, 'Strategy: the skyline would read wrong');
  if (s.characters.includes('Kevin') && playing && s.mirrorable) fail(id, 'never mirror the guitar');
  if (s.characters.includes('Keys') && (s.kind === 'plate' || s.kind === 'brand') && s.mirrorable) fail(id, 'never mirror the keyboard');
  if ((s.shotType === 'insert' || s.category === 'Screen inserts') && s.mirrorable) fail(id, 'screens carry text');
  if (s.characters.includes('Banner crew') && s.mirrorable) fail(id, 'banners and shirts carry text');
  if (s.characters.includes('Printer') && s.mirrorable) fail(id, 'pages carry the logo');
}

// status rules
for (const a of manifest.assets) {
  const s = shas.get(a.sha256);
  const c = catalog.assets.find(x => x.sha256 === a.sha256);
  if (!s) continue;
  const expected = c?.status === 'Earlier version' ? 'E' : c?.status === 'Needs review' ? 'R' : 'C';
  if (s.status !== expected) fail(s.id, `status ${s.status}, expected ${expected} for a season plate`);
}
for (const s of shots) if (s.status === 'E' && lib.filter({}).includes(s)) fail(s.id, 'E shots must never be selected');

// query API smoke
const q = (name, got, want) => { if (!want(got)) fail('shots.js', `${name} -> ${JSON.stringify(got?.map?.(s => s.id) ?? got)}`); };
q('byId(alias)', [lib.byId('drums-playing')], r => r[0]?.manifestId === 'drums-playing');
q('byRole(drums.hero)', lib.byRole('drums.hero'), r => r.length >= 1 && r.every(s => s.stem === 'drums'));
q('byStem(voice)', lib.byStem('voice'), r => r.length >= 1 && r.every(s => s.characters[0] === 'Synergy'));
q('reversible()', lib.reversible(), r => r.length > 0 && r.every(s => s.reverseClass === 'R1'));
q('mirrorable()', lib.mirrorable(), r => r.every(s => !s.mirrorBlockers.length));
q('srcFor(proxy)', [srcFor(lib.byId('drum-pad-detail'), {preferProxy:true})], r => r[0].startsWith(ROUTE));

// ---------------------------------------------------------------- deep proxy probe
if (deep) {
  for (const s of shots.filter(x => x.proxy)) for (const u of [s.proxy, s.rev]) {
    const f = path.join(PROXIES, u.slice(ROUTE.length));
    if (!fs.existsSync(f)) continue;
    const r = spawnSync('ffprobe', ['-v', 'error', '-count_packets', '-show_entries', 'stream=codec_name,profile,pix_fmt,height,r_frame_rate,nb_read_packets', '-of', 'json', f], {encoding:'utf8'});
    const v = JSON.parse(r.stdout).streams[0];
    if (v.codec_name !== 'h264' || v.profile !== 'High' || v.pix_fmt !== 'yuv420p' || v.r_frame_rate !== '24/1' || Number(v.nb_read_packets) !== s.frames)
      fail(s.id, `proxy ${path.basename(f)}: ${JSON.stringify(v)}`);
  }
}

// ---------------------------------------------------------------- determinism sample
const SAMPLE = ['drums-playing', 'people-listening'];
const py = process.env.VIDEOSTUDIO_PYTHON || 'python3';
const probe = spawnSync(py, ['-c', 'import numpy, scipy\ntry:\n import cv2; print("cv2")\nexcept Exception: print("nocv2")'], {encoding:'utf8'});
let determinism = 'skipped';
if (probe.status !== 0) {
  fail('determinism', `${py} cannot import numpy and scipy (set VIDEOSTUDIO_PYTHON)`);
} else {
  const cv2 = probe.stdout.trim() === 'cv2';
  const runs = [1, 2].map(jobs => {
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'shot-index-'));
    const r = spawnSync(py, [path.join(root, 'scripts/build-shot-index.py'), '--only', SAMPLE.join(','), '--no-cache', '--no-download',
      '--cache', cache, '--out', '-', '--jobs', String(jobs)], {encoding:'utf8', maxBuffer:64 << 20});
    fs.rmSync(cache, {recursive:true, force:true});
    if (r.status !== 0) fail('determinism', `builder exited ${r.status}: ${r.stderr.slice(-300)}`);
    return r.stdout;
  });
  if (runs[0] !== runs[1]) fail('determinism', 'two fresh builds of the sample differ');
  else if (runs[0]) {
    const fresh = readIndex(runs[0]).shots;
    const faceFields = new Set(['faceBox', 'subjectBox', 'safeCrops', 'cropBasis', 'cropNotes', 'notes']);
    for (const r of fresh) {
      const committed = shots.find(s => s.id === r.id);
      if (!committed) { fail('determinism', `${r.id} not in the committed index`); continue; }
      for (const k of Object.keys(committed)) {
        if (!cv2 && faceFields.has(k)) continue;
        if (JSON.stringify(committed[k]) !== JSON.stringify(r[k])) fail('determinism', `${r.id}.${k} differs from the committed index`);
      }
    }
    determinism = `${fresh.length} shots rebuilt twice, byte-identical, match committed${cv2 ? '' : ' (face fields not compared: no OpenCV)'}`;
  }
}

// ---------------------------------------------------------------- report
const by = key => Object.entries(shots.reduce((m, s) => ((m[s[key]] = (m[s[key]] || 0) + 1), m), {})).map(([k, v]) => `${k} ${v}`).join(', ');
console.log(`shots ${shots.length}: ${by('kind')}`);
console.log(`status: ${by('status')}; reverse: ${by('reverseClass')}; tiers: ${by('sharpTier')}; mirrorable ${shots.filter(s => s.mirrorable).length}`);
console.log(`faces ${shots.filter(s => s.faceBox).length}/${shots.length}; proxies recorded ${shots.filter(s => s.proxy).length}, local files ${localProxies} (${(proxyBytes / 1e6).toFixed(1)} MB)`);
console.log(`determinism: ${determinism}`);
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n  ${failures.slice(0, 80).join('\n  ')}`);
  process.exit(1);
}
console.log('check-shot-index: ok');
