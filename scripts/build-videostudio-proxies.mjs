#!/usr/bin/env node
// Video Studio proxies: 540p H.264 forward and reversed, plus a poster, for
// every shot the band and the compositor use. Writes them to the gitignored
// public/videostudio/proxies/ (served same-origin by /api/videostudio/media/)
// and records keys, sizes and dimensions in src/videostudio/media/shots.json.
//
//   node scripts/build-videostudio-proxies.mjs [--cache DIR] [--jobs 2] [--only id,id] [--force]
//   node scripts/build-videostudio-proxies.mjs --upload        # Aaron: production upload
//
// Recipe (one GOP per half beat at 120 BPM, no reordering, so a seek is at
// most 11 decoded frames and reverse playback never needs B-frame lookahead):
//   libx264 High@4.0, CRF 20, -g 12 -keyint_min 12 -bf 0 -sc_threshold 0,
//   24 fps CFR, yuv420p bt709 limited range, faststart, no audio, bitexact.
// Height is min(540, source height); width keeps the source aspect, rounded to
// even. Proxies keep the full source frame, so shot rects scale by
// proxyInfo.w / width and proxyInfo.h / height.
//
// Keys end in the first 8 hex of the proxy's own sha256
// (<id>-540-<h8>.mp4, <id>-rev540-<h8>.mp4, <id>-poster540-<h8>.jpg), so the
// media route can cache every key immutable.
//
// Upload: PUT /api/cutting-room/media/<key> with "Authorization: Bearer
// $CATALOG_UPLOAD_TOKEN" (server/cutting-room.js). --upload sends every key the
// index records; --origin picks the host (default https://linkedinbeats.com).
// Nothing is uploaded without --upload.
import {spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readIndex, writeIndex, proxyKeys, wantsProxy, PROXY_RECIPE, ROUTE} from '../src/videostudio/media/index-io.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(root, 'src/videostudio/media/shots.json');
const OUT = path.join(root, 'public/videostudio/proxies');
const MANIFEST = path.join(OUT, 'manifest.json');
const VALID_KEY = /^[a-z0-9][a-z0-9-]{1,110}\.(mp4|jpg|webp)$/;

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const flag = name => args.includes(`--${name}`);
const cache = path.resolve(opt('cache', path.join(root, '.cache/videostudio')));
const jobs = Math.max(1, Number(opt('jobs', 2)));
const only = opt('only') ? new Set(opt('only').split(',')) : null;
const origin = opt('origin', 'https://linkedinbeats.com').replace(/\/$/, '');

function run(cmd, argv, {quiet = false} = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, {stdio:['ignore', 'pipe', 'pipe']});
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${(quiet ? '' : err).replace(/https?:\/\/\S+/g, '<url>').slice(0, 400)}`)));
  });
}
const sha256 = file => new Promise((resolve, reject) => {
  const h = crypto.createHash('sha256');
  fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
});
const even = x => Math.round(x / 2) * 2;

async function master(shot) {
  if (!shot.src.startsWith(ROUTE)) {
    const file = path.join(root, 'public', shot.src);
    if (!fs.existsSync(file)) throw new Error(`missing ${shot.src}`);
    return file;
  }
  const file = path.join(cache, 'src', `${shot.sha256}.mp4`);
  if (fs.existsSync(file) && await sha256(file) === shot.sha256) return file;
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const key = shot.src.slice(ROUTE.length);
  // curl follows the 302 to the signed URL; the URL is never printed.
  await run('curl', ['-sS', '-L', '--fail', '--retry', '3', '-o', `${file}.part`, `${origin}/api/cutting-room/media/${key}`]);
  if (await sha256(`${file}.part`) !== shot.sha256) { fs.rmSync(`${file}.part`, {force:true}); throw new Error('sha256 mismatch'); }
  fs.renameSync(`${file}.part`, file);
  return file;
}

function encodeArgs(input, output, w, h, reverse) {
  const vf = `scale=${w}:${h}:flags=lanczos:out_range=tv,fps=24,format=yuv420p${reverse ? ',reverse' : ''}`;
  return ['-nostdin', '-y', '-v', 'error', '-i', input, '-map', '0:v:0', '-an', '-sn', '-dn', '-map_metadata', '-1', '-map_chapters', '-1',
    '-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p',
    '-g', '12', '-keyint_min', '12', '-bf', '0', '-sc_threshold', '0', '-x264-params', 'open-gop=0',
    '-fps_mode', 'cfr', '-r', '24', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-threads', '2', output];
}

async function verify(file, shot, w, h) {
  const j = JSON.parse(await run('ffprobe', ['-v', 'error', '-count_packets', '-show_entries',
    'stream=codec_type,codec_name,profile,pix_fmt,width,height,r_frame_rate,nb_read_packets', '-of', 'json', file]));
  const v = j.streams.find(s => s.codec_type === 'video');
  const problems = [];
  if (j.streams.some(s => s.codec_type === 'audio')) problems.push('has audio');
  if (v.codec_name !== 'h264' || v.profile !== 'High') problems.push(`codec ${v.codec_name} ${v.profile}`);
  if (v.pix_fmt !== 'yuv420p') problems.push(`pix_fmt ${v.pix_fmt}`);
  if (v.width !== w || v.height !== h) problems.push(`size ${v.width}x${v.height}`);
  if (v.r_frame_rate !== '24/1') problems.push(`rate ${v.r_frame_rate}`);
  if (Number(v.nb_read_packets) !== shot.frames) problems.push(`frames ${v.nb_read_packets} != ${shot.frames}`);
  const flags = (await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=flags', '-of', 'csv=p=0', file])).trim().split('\n');
  const keys = flags.map((f, i) => f.includes('K') ? i : -1).filter(i => i >= 0);
  if (keys.some((k, i) => k !== i * 12)) problems.push(`keyframes not every 12 (${keys.slice(0, 6).join(',')})`);
  if (problems.length) throw new Error(`${path.basename(file)}: ${problems.join('; ')}`);
  return {keyframes:keys.length};
}

async function hashed(tmp, id, kind, ext) {
  const h8 = (await sha256(tmp)).slice(0, 8);
  const key = `${id}-${kind}-${h8}.${ext}`;
  if (!VALID_KEY.test(key)) throw new Error(`invalid key ${key}`);
  fs.renameSync(tmp, path.join(OUT, key));
  return key;
}

async function build(shot, manifest) {
  const prev = manifest.shots[shot.id];
  if (!flag('force') && prev && prev.sha256 === shot.sha256 && prev.recipe === PROXY_RECIPE &&
      [prev.fwd, prev.rev, prev.poster].every(k => fs.existsSync(path.join(OUT, k)))) return {shot, entry:prev, skipped:true};
  const input = await master(shot);
  const h = Math.min(540, even(shot.height));
  const w = even(shot.width * h / shot.height);
  const tmp = path.join(OUT, `.tmp-${shot.id}`);
  await run('ffmpeg', encodeArgs(input, `${tmp}-f.mp4`, w, h, false));
  await run('ffmpeg', encodeArgs(input, `${tmp}-r.mp4`, w, h, true));
  await verify(`${tmp}-f.mp4`, shot, w, h);
  await verify(`${tmp}-r.mp4`, shot, w, h);
  await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-i', `${tmp}-f.mp4`, '-frames:v', '1', '-q:v', '3', '-fflags', '+bitexact', '-flags:v', '+bitexact', `${tmp}-p.jpg`]);
  const fwd = await hashed(`${tmp}-f.mp4`, shot.id, '540', 'mp4');
  const rev = await hashed(`${tmp}-r.mp4`, shot.id, 'rev540', 'mp4');
  const poster = await hashed(`${tmp}-p.jpg`, shot.id, 'poster540', 'jpg');
  const size = k => fs.statSync(path.join(OUT, k)).size;
  // Drop superseded proxies for this shot.
  for (const f of fs.readdirSync(OUT)) {
    if (f.startsWith(`${shot.id}-`) && /-(540|rev540|poster540)-[0-9a-f]{8}\.(mp4|jpg)$/.test(f) && ![fwd, rev, poster].includes(f) &&
        f.slice(shot.id.length + 1).match(/^(540|rev540|poster540)-/)) fs.rmSync(path.join(OUT, f));
  }
  const entry = {sha256:shot.sha256, recipe:PROXY_RECIPE, fwd, rev, poster,
    info:{w, h, frames:shot.frames, fps:24, gop:12, recipe:PROXY_RECIPE, bytes:{fwd:size(fwd), rev:size(rev), poster:size(poster)}}};
  return {shot, entry, skipped:false};
}

async function pool(items, n, fn) {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({length:n}, async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = await fn(items[i]); }
      catch (error) { results[i] = {shot:items[i], error}; }
    }
  }));
  return results;
}

async function upload(index) {
  const token = process.env.CATALOG_UPLOAD_TOKEN;
  if (!token) throw new Error('CATALOG_UPLOAD_TOKEN is not set');
  const headerFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vs-upload-')), 'auth');
  fs.writeFileSync(headerFile, `Authorization: Bearer ${token}\n`, {mode:0o600});
  let sent = 0, bytes = 0;
  try {
    for (const shot of index.shots) {
      if (!shot.proxy) continue;
      for (const url of [shot.proxy, shot.rev, shot.poster]) {
        const key = url.slice(ROUTE.length);
        const file = path.join(OUT, key);
        if (!fs.existsSync(file)) { console.log(`skip ${key}: not built here`); continue; }
        const type = key.endsWith('.jpg') ? 'image/jpeg' : 'video/mp4';
        await run('curl', ['-sS', '--fail', '-X', 'PUT', '-H', `@${headerFile}`, '-H', `Content-Type: ${type}`,
          '--data-binary', `@${file}`, `${origin}/api/cutting-room/media/${key}`], {quiet:true});
        sent++; bytes += fs.statSync(file).size;
        console.log(`uploaded ${key}`);
      }
    }
  } finally { fs.rmSync(path.dirname(headerFile), {recursive:true, force:true}); }
  console.log(`uploaded ${sent} files, ${(bytes / 1e6).toFixed(1)} MB to ${origin}`);
}

async function main() {
  const text = fs.readFileSync(INDEX, 'utf8');
  const index = readIndex(text);
  if (flag('upload')) return upload(index);
  fs.mkdirSync(OUT, {recursive:true});
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {recipe:PROXY_RECIPE, shots:{}};
  const todo = index.shots.filter(s => wantsProxy(s) && (!only || only.has(s.id) || s.aliases.some(a => only.has(a))));
  console.log(`proxies for ${todo.length} of ${index.shots.length} shots, ${jobs} at a time`);
  const t0 = performance.now();
  const results = await pool(todo, jobs, s => build(s, manifest));
  const failures = [];
  for (const r of results) {
    if (r.error) { failures.push(`${r.shot.id}: ${r.error.message}`); continue; }
    manifest.shots[r.shot.id] = r.entry;
    if (!r.skipped) console.log(`built ${r.shot.id} ${r.entry.info.w}x${r.entry.info.h} ${(r.entry.info.bytes.fwd / 1e6).toFixed(2)}+${(r.entry.info.bytes.rev / 1e6).toFixed(2)} MB`);
  }
  manifest.recipe = PROXY_RECIPE;
  manifest.shots = Object.fromEntries(Object.entries(manifest.shots).sort(([a], [b]) => a < b ? -1 : 1));
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
  // Record what exists in the committed index.
  let total = 0, files = 0;
  for (const shot of index.shots) {
    const e = manifest.shots[shot.id];
    if (e && e.sha256 === shot.sha256) {
      const keys = proxyKeys(e);
      Object.assign(shot, {proxy:ROUTE + keys.fwd, rev:ROUTE + keys.rev, poster:ROUTE + keys.poster, proxyInfo:e.info});
      total += e.info.bytes.fwd + e.info.bytes.rev + e.info.bytes.poster; files += 3;
    }
  }
  index.meta.counts.withProxy = index.shots.filter(s => s.proxy).length;
  fs.writeFileSync(INDEX, writeIndex(index));
  console.log(`index: ${index.meta.counts.withProxy} shots with proxies, ${files} files, ${(total / 1e6).toFixed(1)} MB; ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  if (failures.length) { console.error(`FAILED ${failures.length}:\n  ${failures.join('\n  ')}`); process.exitCode = 1; }
}

main().catch(error => { console.error(error.message); process.exit(1); });
