// The Cutting Room's shared Node library: the catalog file, content hashes, pack lists.
// Used by scripts/check-cutting-room.mjs and, by design, by the publish command and the
// pack builder, so every writer of src/cutting-room/catalog.json agrees on these rules.
// The vocabulary (categories, "made in", kinds...) lives in src/cutting-room/taxonomy.js,
// which the page imports too; it is re-exported here.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

export * from '../../src/cutting-room/taxonomy.js';
import {CATEGORIES, MADE_IN, STATUSES, GROUP_LABELS, AUDIO_CATEGORIES, relatedOf, aliasesOf, madeInOf, kindOf} from '../../src/cutting-room/taxonomy.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PUBLIC = path.join(ROOT, 'public');
export const CATALOG = path.join(ROOT, 'src/cutting-room/catalog.json');
export const LIBRARY = path.join(PUBLIC, 'cutting-room');            // films/ songs/ sounds/ packs/ posters/ covers/
export const REMOTE = '/api/cutting-room/media/';                     // R2, through server/cutting-room.js

// Sizes: films and art are web deliveries. The catalog is bundled into the page, so its budget is what a
// visitor downloads: the file gzipped (it reads about six times smaller than it is). A replaced record drops
// its transcript (insert), so a new cut costs little more than its own record.
export const BUDGET = {film:25 * 1024 * 1024, poster:60_000, posterLarge:160_000, still:120_000, cover:70_000, catalogGzip:64_000};
export const POSTER = {width:640, height:360};                          // new records' card art, 16:9
export const POSTER_LARGE = {width:1280, height:720};                   // video only: the hero's (srcset 2x)
export const STILL = {width:720, height:1280};                          // portrait video only: the player's poster
export const COVER = {width:600, height:600};                           // audio and packs only
export function catalogWeight(text = fs.readFileSync(CATALOG, 'utf8')) {
  const raw = Buffer.byteLength(text), gzip = gzipSync(text, {level:9}).length;
  return {raw, gzip, headroom:BUDGET.catalogGzip - gzip};
}

// ------------------------------------------------------------------ names and hashes
export const sha256 = data => createHash('sha256').update(data).digest('hex');
export function sha256File(file) {
  const hash = createHash('sha256'), fd = fs.openSync(file, 'r'), buf = Buffer.allocUnsafe(1 << 20);
  try { for (let n; (n = fs.readSync(fd, buf, 0, buf.length, null)) > 0;) hash.update(buf.subarray(0, n)); } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
// "Circle Back (Drop Edition)" -> "circle-back-drop-edition"; "Let's Circle Back" -> "let-s-circle-back" (as the existing ids do).
export const slug = title => String(title).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
export const idFor = (title, sha) => `${slug(title)}-${sha.slice(0, 8)}`;
export const ID = /^[a-z0-9][a-z0-9-]*-[0-9a-f]{8}$/;

// A catalog URL to a file in the repository, or null when it is served from R2.
export const isRemote = url => String(url).startsWith(REMOTE);
export function localPath(url) {
  if (!url || isRemote(url) || /^[a-z]+:/i.test(url)) return null;
  const clean = decodeURI(String(url).split(/[?#]/)[0]);
  const file = path.join(PUBLIC, clean);
  return file.startsWith(PUBLIC + path.sep) ? file : null;
}
export const urlOf = file => '/' + path.relative(PUBLIC, file).split(path.sep).join('/');

// ------------------------------------------------------------------ the catalog file
// catalog.json was first written by Python (json.dumps(indent=2), ASCII escapes, durations as
// floats). formatCatalog writes the same bytes, so a Node edit diffs only where it changed.
export function formatCatalog(catalog) {
  return JSON.stringify(catalog, null, 2)
    .replace(/[\u007f-\uffff]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'))
    .replace(/^(\s*"duration": )(-?\d+)(,?)$/gm, '$1$2.0$3') + '\n';
}
export const readCatalog = (file = CATALOG) => JSON.parse(fs.readFileSync(file, 'utf8'));
export function writeCatalog(catalog, file = CATALOG) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, formatCatalog(catalog)); fs.renameSync(tmp, file);
}

// ------------------------------------------------------------------ packs
// A pack's list lives at /cutting-room/packs/<id>.json and is fetched only when the pack opens.
//   {v:1, id, title, groupLabel, items:[{n, text, src, duration, group, bytes, sha256}]}
// Written deterministically (fixed key order, one item per line, durations to the millisecond),
// so the same items always give the same bytes. The id's eight hex digits come from the list
// with its id blank (packDigest), since the list names its own id; the record's sha256 and
// bytes are the list file's, like any other file.
const ITEM_KEYS = ['n', 'text', 'src', 'duration', 'group', 'bytes', 'sha256'];
const ms = d => Math.round(Number(d) * 1000) / 1000;
export function packJson(list) {
  const head = {v:1, id:list.id ?? '', title:list.title, groupLabel:list.groupLabel};
  const items = list.items.map((it, i) => {
    const o = {};
    for (const k of ITEM_KEYS) {
      const v = k === 'n' ? (it.n ?? i + 1) : k === 'duration' ? ms(it.duration) : it[k];
      if (v !== undefined && v !== null && v !== '') o[k] = v;
    }
    return JSON.stringify(o);
  });
  return `${JSON.stringify(head).slice(0, -1)},"items":[\n${items.join(',\n')}\n]}\n`;
}
export const packDigest = list => sha256(packJson({...list, id:''}));
export const packIdFor = list => `${slug(list.title)}-${packDigest(list).slice(0, 8)}`;
export const packPath = id => path.join(LIBRARY, 'packs', `${id}.json`);
export const packUrl = id => `/cutting-room/packs/${id}.json`;
// What the record says about its list: count, total duration, groups in order of first appearance,
// and every item's text as the transcript (so search finds a line without loading the list).
export function packSummary(list) {
  const items = list.items;
  return {
    count:items.length,
    duration:ms(items.reduce((s, it) => s + Number(it.duration || 0), 0)),
    groups:[...new Set(items.map(it => it.group).filter(Boolean))],
    transcript:items.map(it => it.text).filter(Boolean).join('\n'),
  };
}
export function readPack(record) {
  const file = localPath(record.src);
  return file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

// ================================================================== publishing
// The logic behind scripts/publish-to-cutting-room.mjs: one file (or a pack's item list) in, a web
// delivery under its content-hashed name, a poster (and for audio and packs a cover), and a record at
// the top of the catalog. See that script for the options and src/cutting-room/README.md, Publishing.
import {execFileSync, spawnSync} from 'node:child_process';
import os from 'node:os';

export const R2_MAX = 300 * 1024 * 1024;                                // the media router's upload limit
const MIB = 1024 * 1024;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const longDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const round = (n, p = 3) => Math.round(Number(n) * 10 ** p) / 10 ** p;
const ext = f => path.extname(f).slice(1).toLowerCase();
const inPublic = f => path.resolve(f).startsWith(PUBLIC + path.sep);

// ------------------------------------------------------------------ probe
// What a file is: duration, the picture (codec, size, pixel format, frame rate), the sound (codec),
// and whether an MP4 is fast-start (its moov atom before mdat, so playback starts before the download ends).
export function probe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], {encoding:'utf8', maxBuffer:1 << 26}));
  const rate = r => { const [a, b] = String(r || '0/1').split('/').map(Number); return b ? a / b : 0; };
  const v = (j.streams || []).find(s => s.codec_type === 'video' && !s.disposition?.attached_pic && rate(s.avg_frame_rate || s.r_frame_rate) > 0);
  const a = (j.streams || []).find(s => s.codec_type === 'audio');
  const duration = Number(j.format?.duration) || Number(v?.duration) || Number(a?.duration) || 0;
  return {
    file, duration, format:j.format?.format_name || '', bytes:fs.statSync(file).size,
    video:v ? {codec:v.codec_name, profile:v.profile, pixFmt:v.pix_fmt, width:v.width, height:v.height, fps:round(rate(v.avg_frame_rate) || rate(v.r_frame_rate))} : null,
    audio:a ? {codec:a.codec_name, sampleRate:Number(a.sample_rate), channels:a.channels, bitRate:Number(a.bit_rate) || null} : null,
    faststart:/mp4|mov/.test(j.format?.format_name || '') ? faststart(file) : false,
  };
}
export function faststart(file) {
  const fd = fs.openSync(file, 'r'), head = Buffer.alloc(16), size = fs.fstatSync(fd).size;
  try {
    for (let at = 0; at + 8 <= size;) {
      fs.readSync(fd, head, 0, 16, at);
      let n = head.readUInt32BE(0); const type = head.toString('latin1', 4, 8);
      if (type === 'moov') return true;
      if (type === 'mdat') return false;
      if (n === 1) n = Number(head.readBigUInt64BE(8)); else if (n === 0) return false;
      at += n;
    }
  } finally { fs.closeSync(fd); }
  return false;
}
const isLossless = codec => /^pcm_|^flac$|^alac$|^wavpack$|^tta$/.test(codec || '');
// A video plays everywhere as it is: H.264, AAC (or no sound), 4:2:0, fast-start.
const webReady = info => info.video?.codec === 'h264' && info.video.pixFmt === 'yuv420p' && (!info.audio || info.audio.codec === 'aac') && info.faststart && /mp4|mov/.test(info.format);

// ------------------------------------------------------------------ sound
// A film's sound has a ceiling. The house's is -1 dBTP (the All Hands, DELVE. and Day One. briefs). A film
// scored with one of Aaron's own tracks keeps his master's peaks (his Printer Song WAV is -0.1 dBTP), so it
// is held to its brief's "no clipping": -0.1 dBTP at most, the meter's last step under 0.
export const PEAK = {house:-1.0, aarons:-0.1};
export function peakCeiling(rec, assets = []) {
  const byId = new Map(assets.map(a => [a.id, a]));
  const aarons = a => madeInOf(a).includes("Aaron's tracks");
  return aarons(rec) || relatedOf(rec).some(id => aarons(byId.get(id))) ? PEAK.aarons : PEAK.house;
}
// Integrated loudness and true peak (ITU-R BS.1770, ffmpeg's ebur128, 0.1 dB steps) of a file's first sound.
export function truePeak(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], {encoding:'utf8', maxBuffer:1 << 26});
  const peak = r.stderr.match(/True peak:\s*\n\s*Peak:\s*(-?(?:[\d.]+|inf))/), lufs = r.stderr.match(/Integrated loudness:\s*\n\s*I:\s*(-?(?:[\d.]+|inf))/);
  if (r.status !== 0 || !peak) throw new Error(`could not measure the sound of ${path.basename(file)}`);
  return {peak:peak[1] === '-inf' ? -Infinity : Number(peak[1]), lufs:lufs ? Number(lufs[1]) : null};
}
// The film's sound for an encode. AAC (what every film made here carries) is copied as it is: its master was
// measured as it ships, and a second AAC generation overshoots (DELVE. went from -1.3 to +1.3 dBTP that way).
// Anything else becomes AAC 192k through a 4x-oversampled limiter half a dB under the ceiling, measured after
// the encode and limited again, lower, until it is under. --limit-sound sends AAC that way too (for a film
// whose AAC overshoots and that has no master step of its own).
function soundFor(info, ceiling, tmp, log, {limit = false} = {}) {
  if (!info.audio) return {inputs:[], map:['-an'], bps:0, how:'no sound'};
  if (info.audio.codec === 'aac' && !limit) {
    const bps = info.audio.bitRate || 320_000;
    return {inputs:[], map:['-map', '0:a:0', '-c:a', 'copy'], bps, how:`its AAC copied (${Math.round(bps / 1000)} kb/s)`};
  }
  const out = path.join(tmp, 'sound.m4a');
  // AAC's own overshoot depends on the material (a dense, hot master can add 2 dB), so the limit steps down.
  for (const under of [.5, 1, 1.5, 2, 2.5, 3, 4]) {
    const limit = 10 ** ((ceiling - under) / 20);
    ff(['-i', info.file, '-map', '0:a:0', '-vn', '-af', `aresample=192000,alimiter=limit=${limit.toFixed(4)}:attack=5:release=50:level=0:latency=1,aresample=48000`,
      '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-map_metadata', '-1', out], 'sound');
    const {peak} = truePeak(out);
    log(`  sound: ${info.audio.codec} to AAC 192k, limited at ${(ceiling - under).toFixed(1)} dBTP: ${peak} dBTP`);
    if (peak <= ceiling) return {inputs:['-i', out], map:['-map', '1:a:0', '-c:a', 'copy'], bps:192_000, how:`AAC 192k, limited to ${peak} dBTP`};
  }
  throw new Error(`the sound of ${path.basename(info.file)} stays over ${ceiling} dBTP after the limiter`);
}

// ------------------------------------------------------------------ encode
const ff = (args, what) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], {encoding:'utf8', maxBuffer:1 << 26});
  if (r.status !== 0) throw new Error(`ffmpeg failed (${what}): ${(r.stderr || '').trim().split('\n').slice(-3).join(' ')}`);
};
// The short side for a web encode: 1080, else 720, else 540 (never up), the first at which the picture
// gets at least 0.05 bits per pixel per frame.
export function webSide(info, videoBps) {
  const short = Math.min(info.video.width, info.video.height), long = Math.max(info.video.width, info.video.height);
  const steps = [...new Set([Math.min(short, 1080), ...[720, 540].filter(s => s < Math.min(short, 1080))])];
  const bpp = s => videoBps / (s * Math.round(long * s / short) * (info.video.fps || 30));
  return steps.find(s => bpp(s) >= .05) ?? steps[steps.length - 1];
}
const scaleFilter = (info, side) => {
  const short = Math.min(info.video.width, info.video.height);
  if (side >= short) return [];
  return ['-vf', (info.video.width <= info.video.height ? `scale=${side}:-2` : `scale=-2:${side}`) + ':flags=lanczos'];
};
// Repository delivery: a two-pass x264 encode to the size cap (default 25 MiB), fast-start. The sound is
// soundFor's (AAC copied; anything else AAC 192k under the ceiling), and its real bitrate comes out of the budget.
export function encodeVideo(info, out, {maxBytes = 25 * MIB, ceiling = PEAK.house, limit = false, log = () => {}} = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cutting-room-x264-'));
  try {
    const sound = soundFor(info, ceiling, tmp, log, {limit});
    for (const share of [.97, .92, .86]) {
      const vbps = Math.floor(maxBytes * share * 8 / info.duration * .995 - sound.bps);
      if (vbps < 200_000) throw new Error(`${info.duration.toFixed(1)} s will not fit ${(maxBytes / MIB).toFixed(1)} MiB at any useful quality: publish with --r2`);
      const side = webSide(info, vbps), scale = scaleFilter(info, side);
      log(`  encoding ${path.basename(info.file)}: H.264 two-pass ${Math.round(vbps / 1000)} kb/s, short side ${Math.min(side, info.video.width, info.video.height)}, ${sound.how}`);
      const video = ['-map', '0:v:0', ...scale, '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', String(vbps), '-passlogfile', path.join(tmp, 'pass')];
      ff(['-i', info.file, ...video, '-pass', '1', '-an', '-f', 'null', os.devNull], 'first pass');
      ff(['-i', info.file, ...sound.inputs, ...video, ...sound.map, '-pass', '2', '-movflags', '+faststart', '-map_metadata', '-1', out], 'second pass');
      if (fs.statSync(out).size <= maxBytes) return {out, sound:sound.how};
      log(`  ${fs.statSync(out).size} bytes is over the cap; again, a little lower`);
    }
    throw new Error(`could not bring ${path.basename(info.file)} under ${maxBytes} bytes`);
  } finally { fs.rmSync(tmp, {recursive:true, force:true}); }
}
// R2 delivery: no 25 MiB cap. CRF 18 at the source size (short side at most 1080), the sound as above.
export function encodeVideoR2(info, out, {ceiling = PEAK.house, limit = false, log = () => {}} = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cutting-room-crf-'));
  try {
    const side = Math.min(1080, info.video.width, info.video.height), sound = soundFor(info, ceiling, tmp, log, {limit});
    log(`  encoding ${path.basename(info.file)}: H.264 CRF 18, short side ${side}, ${sound.how}`);
    ff(['-i', info.file, ...sound.inputs, '-map', '0:v:0', ...scaleFilter(info, side), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      ...sound.map, '-movflags', '+faststart', '-map_metadata', '-1', out], 'CRF 18');
    if (fs.statSync(out).size > R2_MAX) throw new Error(`${fs.statSync(out).size} bytes is over the 300 MiB upload limit`);
    return {out, sound:sound.how};
  } finally { fs.rmSync(tmp, {recursive:true, force:true}); }
}
// A web-ready film whose sound must be limited (--limit-sound): the picture copied, the sound replaced.
export function remuxSound(info, out, {ceiling = PEAK.house, log = () => {}} = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cutting-room-remux-'));
  try {
    const sound = soundFor(info, ceiling, tmp, log, {limit:true});
    ff(['-i', info.file, ...sound.inputs, '-map', '0:v:0', '-c:v', 'copy', ...sound.map, '-movflags', '+faststart', '-map_metadata', '-1', out], 'remux');
    return {out, sound:sound.how};
  } finally { fs.rmSync(tmp, {recursive:true, force:true}); }
}
// Audio: lossless becomes MP3 320k CBR; other lossy audio MP3 192k. LAME is deterministic, so the same
// source always gives the same bytes. MP3 itself is never re-encoded (that would void a measured true peak).
export function encodeAudio(info, out, bitrate) {
  ff(['-i', info.file, '-map', '0:a:0', '-vn', '-c:a', 'libmp3lame', '-b:a', bitrate, '-map_metadata', '-1', '-id3v2_version', '0', '-fflags', '+bitexact', '-flags:a', '+bitexact', out], `MP3 ${bitrate}`);
  return out;
}

// ------------------------------------------------------------------ art
async function frameAt(file, seconds, out) {
  ff(['-ss', String(Math.max(0, seconds)), '-i', file, '-map', '0:v:0', '-frames:v', '1', out], `frame at ${seconds} s`);
  if (!fs.existsSync(out)) throw new Error(`no frame at ${seconds} s in ${path.basename(file)}`);
  return out;
}
// "230" is frame 230; "87.5s" is 87.5 seconds.
const frameTime = (v, fps) => /s$/.test(String(v)) ? Number(String(v).slice(0, -1)) : Number(v) / (fps || 30);
// A video's art: the card poster (640x360), the hero's (1280x720, for the srcset), and for a portrait film the
// player's poster before play, a 9:16 still (the triptych's middle frame, at most 720x1280).
async function videoPoster(info, o, tmp) {
  const A = await import('./cutting-room-art.mjs');
  let images;
  if (o.posters?.length) images = o.posters.map(p => path.resolve(p));
  else {
    const fps = info.video.fps, times = o.posterFrames?.length ? o.posterFrames.map(v => frameTime(v, fps))
      : o.posterAt !== undefined ? [Number(o.posterAt)]
      : info.video.height > info.video.width ? [.2, .5, .8].map(f => f * info.duration) : [info.duration / 3];
    images = [];
    for (const [i, t] of times.entries()) images.push(await frameAt(info.file, Math.min(t, info.duration - 1 / (fps || 30)), path.join(tmp, `frame-${i}.png`)));
  }
  if (images.length !== 1 && images.length !== 3) throw new Error('a poster is one image or three (a triptych)');
  const art = {
    poster:await A.framePoster(images, {...POSTER, maxBytes:BUDGET.poster}),
    posterLarge:await A.framePoster(images, {...POSTER_LARGE, maxBytes:BUDGET.posterLarge}),
    art:images.length === 3 ? 'triptych' : 'frame',
  };
  if (info.video.height > info.video.width) {
    const w = Math.min(STILL.width, info.video.width - info.video.width % 2), h = Math.round(w * 16 / 9 / 2) * 2;
    art.still = await A.framePoster([images[images.length === 3 ? 1 : 0]], {width:w, height:h, maxBytes:BUDGET.still});
  }
  return art;
}
// "Circle Back (Drop Edition)" sets as CIRCLE BACK over DROP EDITION; otherwise the second line says where it was made.
export function coverWords(title, madeIn, o = {}) {
  const m = String(title).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return {text:o.coverText || (m ? m[1] : title), sub:o.coverSub ?? (m ? m[2] : madeIn?.[0] || '')};
}
async function typeArtFor(rec, o, data) {
  const A = await import('./cutting-room-art.mjs');
  const {text, sub} = coverWords(rec.title, rec.madeIn, o);
  const extra = data.items ? {items:data.items} : {levels:data.levels};
  return {
    poster:await A.typeArt({...POSTER, title:text, sub, ...extra, maxBytes:BUDGET.poster, card:true}),
    cover:await A.typeArt({...COVER, title:text, sub, ...extra, maxBytes:BUDGET.cover, card:false}),
  };
}

// ------------------------------------------------------------------ the record
const ORDER = ['id', 'title', 'kind', 'duration', 'width', 'height', 'fps', 'count', 'groups', 'groupLabel', 'cast', 'description', 'notes', 'tags',
  'transcript', 'category', 'madeIn', 'status', 'featured', 'related', 'aliases', 'replaces', 'replacedBy', 'art', 'added', 'sha256', 'src', 'download',
  'downloadSha256', 'downloadBytes', 'audio', 'bytes', 'poster', 'posterLarge', 'still', 'cover', 'sourceReference'];
const ordered = rec => Object.fromEntries(ORDER.filter(k => rec[k] !== undefined && rec[k] !== null).map(k => [k, rec[k]]));
const INHERIT = ['title', 'category', 'madeIn', 'description', 'cast', 'tags', 'transcript', 'notes', 'status', 'groupLabel'];

// Everything a publish needs from the options, the record it replaces filling in what is not given.
function metaOf(o, old) {
  const pick = (k, v) => v !== undefined ? v : old?.[k];
  const list = (k, v) => v?.length ? v : old?.[k];
  const meta = {
    title:pick('title', o.title), category:pick('category', o.category), madeIn:list('madeIn', o.madeIn), description:pick('description', o.description),
    cast:list('cast', o.cast) ?? [], tags:list('tags', o.tags) ?? [], transcript:pick('transcript', o.transcript) ?? '', notes:pick('notes', o.notes) ?? '',
    status:o.status ?? (old && old.status !== 'Earlier version' ? old.status : 'Current edit'), groupLabel:pick('groupLabel', o.groupLabel),
  };
  const missing = ['title', 'category', 'madeIn', 'description'].filter(k => !meta[k] || (Array.isArray(meta[k]) && !meta[k].length));
  if (missing.length) throw new Error(`a new record needs ${missing.map(k => `--${k === 'madeIn' ? 'made-in' : k}`).join(', ')}`);
  if (!CATEGORIES.includes(meta.category)) throw new Error(`--category must be one of: ${CATEGORIES.join(', ')}`);
  const bad = meta.madeIn.filter(x => !MADE_IN.includes(x));
  if (bad.length) throw new Error(`--made-in ${bad.join(', ')}: use ${MADE_IN.join(', ')}`);
  if (!STATUSES.includes(meta.status)) throw new Error(`--status must be one of: ${STATUSES.join(', ')}`);
  if (/—/.test([meta.title, meta.description, meta.notes, meta.transcript, ...meta.tags].join(' '))) throw new Error('no em dashes in a record (use a comma, a colon or a full stop)');
  return meta;
}

// Already in the catalog: the same file, or the same source (sourceReference names the source's hash).
const findSame = (assets, sha) => assets.find(a => a.sha256 === sha || a.downloadSha256 === sha || String(a.sourceReference || '').includes(`sha256:${sha}`));

// Put the new record on top and wire it in: replaces/replacedBy (featured and related move to the new
// cut), featured (one at most), related (both ways), the cast list and the date.
function insert(catalog, rec, old) {
  const assets = catalog.assets, byId = new Map(assets.map(a => [a.id, a]));
  if (old) {
    old.status = 'Earlier version'; old.replacedBy = rec.id; rec.replaces = old.id;
    old.transcript = '';                                               // hidden by default; the new cut carries it
    if (old.featured) { delete old.featured; rec.featured = true; }
    if (rec.related === undefined && old.related !== undefined) rec.related = relatedOf(old);
    delete old.related;
    for (const a of assets) if (relatedOf(a).includes(old.id)) a.related = relatedOf(a).map(x => x === old.id ? rec.id : x);
  }
  if (rec.featured) for (const a of assets) delete a.featured;
  for (const id of relatedOf(rec)) {
    const b = byId.get(id);
    if (!b) throw new Error(`--related ${id} is not in the catalog`);
    if (!relatedOf(b).includes(rec.id)) b.related = [...relatedOf(b), rec.id];
  }
  for (const x of rec.aliases || []) if (byId.has(x) || assets.some(a => aliasesOf(a).includes(x))) throw new Error(`alias ${x} is already taken`);
  assets.unshift(ordered(rec));
  catalog.cast = [...new Set([...catalog.cast, ...(rec.cast || [])])].sort((a, b) => a.localeCompare(b));
  catalog.updated = longDate(today());
  return catalog;
}

// ------------------------------------------------------------------ R2
export async function uploadR2(file, key, {base, token, log = () => {}}) {
  const url = `${String(base).replace(/\/$/, '')}/api/cutting-room/media/${key}`;
  log(`  uploading ${key} (${fs.statSync(file).size} bytes) to ${new URL(url).host}`);
  const body = fs.readFileSync(file);
  const res = await fetch(url, {method:'PUT', headers:{authorization:`Bearer ${token}`, 'content-type':'application/octet-stream', 'content-length':String(body.length)}, body});
  if (res.status === 400 && /\.(mp3|m4a)$/.test(key)) throw new Error('the server refused an audio key: deploy the server/cutting-room.js that accepts mp3 and m4a first');
  if (res.status === 401) throw new Error('the server refused the upload token (401)');
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return url;
}

// ------------------------------------------------------------------ publish
// publish(file, options) -> {status:'published'|'unchanged'|'dry-run', id, record, files}
export async function publish(file, o = {}) {
  const log = o.log || (() => {});
  const text = fs.readFileSync(CATALOG, 'utf8'), catalog = JSON.parse(text), assets = catalog.assets;
  const old = o.replaces ? assets.find(a => a.id === o.replaces) : null;
  if (o.replaces && !old) throw new Error(`--replaces ${o.replaces} is not in the catalog`);
  const meta = metaOf(o, old);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cutting-room-publish-'));
  try {
    return o.pack ? await publishPack(o, meta, {catalog, text, old, tmp, log}) : await publishFile(path.resolve(file), o, meta, {catalog, text, old, tmp, log});
  } finally { fs.rmSync(tmp, {recursive:true, force:true}); }
}

async function publishFile(input, o, meta, {catalog, text, old, tmp, log}) {
  if (!fs.existsSync(input)) throw new Error(`no such file: ${input}`);
  const assets = catalog.assets, inputSha = sha256File(input);
  const same = findSame(assets, inputSha);
  if (same) return {status:'unchanged', id:same.id, record:same, files:[]};
  const info = probe(input), kind = info.video ? 'video' : info.audio ? 'audio' : null;
  if (!kind) throw new Error(`${path.basename(input)} has neither picture nor sound`);
  if (kind === 'audio' && !AUDIO_CATEGORIES.includes(meta.category)) throw new Error(`a song or sound goes in ${AUDIO_CATEGORIES.join(' or ')}, not ${meta.category}`);
  if (kind === 'video' && AUDIO_CATEGORIES.includes(meta.category)) throw new Error(`a video does not go in ${meta.category}`);
  if (meta.status === 'Source take' && kind !== 'video') throw new Error('Source take is for video only');
  if (o.featured && kind !== 'video') throw new Error('only a video can be featured');
  const r2 = Boolean(o.r2), maxBytes = Math.min(25 * MIB, o.maxMb ? Math.round(o.maxMb * 1e6) : 25 * MIB);

  // 1-2. The web file: as it is when it already plays everywhere, else an encode.
  let web = input, download = o.download ? path.resolve(o.download) : null, how = 'as is';
  // A film's sound ceiling depends on what it is scored with (its own --related, or the replaced cut's).
  const ceiling = peakCeiling({madeIn:meta.madeIn, related:o.related?.length ? o.related : relatedOf(old)}, assets);
  if (kind === 'video') {
    const ready = r2 ? webReady(info) && info.bytes <= R2_MAX : webReady(info) && info.bytes <= maxBytes, limit = Boolean(o.limitSound && info.audio);
    if (inPublic(input) && !limit) how = 'in place';
    else if (ready && !limit) how = 'as is';
    else if (ready) { web = path.join(tmp, 'web.mp4'); how = `picture as is, ${remuxSound(info, web, {ceiling, log}).sound}`; }
    else { web = path.join(tmp, 'web.mp4'); const e = (r2 ? encodeVideoR2 : encodeVideo)(info, web, {maxBytes, ceiling, limit, log}); how = `${r2 ? 'CRF 18' : 'two-pass'}, ${e.sound}`; }
    // The film's sound is measured as it will ship; over its ceiling, nothing is written (and nothing uploaded).
    if (info.audio) {
      const {peak, lufs} = truePeak(web);
      log(`  sound: ${lufs} LUFS, true peak ${peak} dBTP (ceiling ${ceiling})`);
      if (peak > ceiling) throw new Error(`the film's sound peaks at ${peak} dBTP, over its ${ceiling} dBTP ceiling: fix the master (its brief says how) and publish again, or add --limit-sound to put it through the limiter`);
    }
  } else if (info.audio.codec === 'mp3') how = inPublic(input) ? 'in place' : 'as is';
  else {
    const lossless = isLossless(info.audio.codec), rate = lossless ? '320k' : '192k';
    log(`  encoding ${path.basename(input)} (${info.audio.codec}) to MP3 ${rate}`);
    web = encodeAudio(info, path.join(tmp, 'web.mp3'), rate); how = `MP3 ${rate}`;
    if (!lossless && !download) download = input;                     // lossy to lossy: keep the original beside it
    if (lossless && !download && inPublic(input)) download = input;   // already served: free to offer
  }
  // 3. Hash and measure.
  const sha = sha256File(web), bytes = fs.statSync(web).size, w = web === input ? info : probe(web);
  const dupe = assets.find(a => a.sha256 === sha);
  if (dupe) return {status:'unchanged', id:dupe.id, record:dupe, files:[]};
  const id = idFor(meta.title, sha), webExt = ext(web);
  if (assets.some(a => a.id === id)) throw new Error(`id ${id} is already taken`);
  const folder = kind === 'video' ? 'films' : meta.category === 'Songs' ? 'songs' : 'sounds';
  // 4. Where it lives.
  const files = [];                                                    // [from, to]: copies to make
  let src;
  if (r2) {
    const {validKey} = await import('../../server/cutting-room.js');           // the server's own rule for storage keys
    if (!validKey(`${id}.${webExt}`)) throw new Error(`${id}.${webExt} is not a key the media router takes`);
    src = `${REMOTE}${id}.${webExt}`;
  }
  else if (inPublic(web)) src = urlOf(web);
  else { const to = path.join(LIBRARY, folder, `${id}.${webExt}`); files.push([web, to]); src = urlOf(to); }
  let dl = {};
  if (download && path.resolve(download) !== path.resolve(web)) {
    const dsha = sha256File(download), dbytes = fs.statSync(download).size;
    let url;
    if (inPublic(download)) url = urlOf(download);
    else if (r2) throw new Error('--download with --r2: the storage takes mp4, mp3, m4a, jpg and webp only; publish the original separately');
    else { const to = path.join(LIBRARY, folder, `${slug(meta.title)}-${dsha.slice(0, 8)}.${ext(download)}`); files.push([download, to]); url = urlOf(to); }
    dl = {download:url, downloadSha256:dsha, downloadBytes:dbytes};
  }
  // 5. Poster and cover.
  const rec = {
    id, title:meta.title, kind, duration:round(w.duration),
    ...(kind === 'video' ? {width:w.video.width, height:w.video.height, fps:w.video.fps} : {}),
    cast:meta.cast, description:meta.description, notes:meta.notes, tags:meta.tags, transcript:meta.transcript,
    category:meta.category, madeIn:meta.madeIn, status:meta.status,
    featured:o.featured ? true : undefined, related:o.related?.length ? o.related : undefined, aliases:o.aliases?.length ? o.aliases : undefined,
    added:o.added || today(), sha256:sha, src, download:dl.download ?? (r2 ? `${src}?download=1` : src), downloadSha256:dl.downloadSha256, downloadBytes:dl.downloadBytes,
    audio:kind === 'video' ? Boolean(w.audio) : true, bytes, poster:`/cutting-room/posters/${id}.jpg`,
    // Provenance: an encode names its source's hash, so publishing the same source again changes nothing.
    sourceReference:[o.ref, web !== input ? `source ${path.basename(input)} sha256:${inputSha}` : null].filter(Boolean).join('; ') || undefined,
  };
  if (rec.added && !/^\d{4}-\d{2}-\d{2}$/.test(rec.added)) throw new Error('--added is an ISO date, 2026-11-09');
  const art = {};
  if (kind === 'video') {
    const p = await videoPoster(info, o, tmp);
    Object.assign(art, {poster:p.poster, posterLarge:p.posterLarge, still:p.still}); rec.art = p.art;
    rec.posterLarge = `/cutting-room/posters/${id}-1280.jpg`;
    if (p.still) rec.still = `/cutting-room/posters/${id}-still.jpg`;
  }
  else {
    const A = await import('./cutting-room-art.mjs');
    Object.assign(art, await typeArtFor(rec, o, {levels:A.loudness(web)}));
    rec.art = 'type'; rec.cover = `/cutting-room/covers/${id}.jpg`;
  }
  return commit({catalog, text, old, rec, files, art, how, r2, web, o, log});
}

// A pack: items [{file, text, group, name?}] (a list, or {groupLabel, items}). Items already in public/
// are referenced where they are; others are copied (MP3) or encoded (--item-bitrate, default 128k)
// into public/cutting-room/sounds/<--items-dir>/. The list goes to public/cutting-room/packs/<id>.json.
async function publishPack(o, meta, {catalog, text, old, tmp, log}) {
  const listFile = path.resolve(o.pack), raw = JSON.parse(fs.readFileSync(listFile, 'utf8'));
  const given = Array.isArray(raw) ? raw : raw.items, groupLabel = meta.groupLabel || raw.groupLabel;
  if (!Array.isArray(given) || !given.length) throw new Error(`${o.pack}: no items`);
  if (!GROUP_LABELS.includes(groupLabel)) throw new Error(`a pack needs --group-label (${GROUP_LABELS.join(', ')})`);
  if (meta.category !== 'Sounds' && meta.category !== 'Songs') throw new Error('a pack goes in Sounds (or Songs)');
  if (o.featured) throw new Error('only a video can be featured');
  const dir = o.itemsDir ? slug(o.itemsDir) : slug(meta.title), files = [], seen = new Set();
  const items = given.map((it, i) => {
    const f = path.resolve(path.dirname(listFile), it.file);
    if (!fs.existsSync(f)) throw new Error(`item ${i + 1}: no such file ${it.file}`);
    if (!it.text || /—/.test(it.text)) throw new Error(`item ${i + 1}: needs text, and no em dash`);
    let web = f;
    if (!inPublic(f)) {
      const info = probe(f);
      if (!info.audio || info.video) throw new Error(`item ${i + 1}: ${it.file} is not a sound`);
      if (info.audio.codec !== 'mp3') web = encodeAudio(info, path.join(tmp, `item-${i}.mp3`), o.itemBitrate || '128k');
    }
    const sha = sha256File(web), bytes = fs.statSync(web).size;
    let src = urlOf(web);
    if (!inPublic(web)) {
      const to = path.join(LIBRARY, 'sounds', dir, `${slug(it.name || path.basename(f, path.extname(f)))}-${sha.slice(0, 8)}.mp3`);
      if (seen.has(to)) throw new Error(`item ${i + 1}: two items would be ${urlOf(to)}`);
      seen.add(to); files.push([web, to]); src = urlOf(to);
    }
    return {n:i + 1, text:String(it.text).trim(), src, duration:round(probe(web).duration), group:it.group || undefined, bytes, sha256:sha};
  });
  const list = {v:1, id:'', title:meta.title, groupLabel, items};
  const id = packIdFor(list); list.id = id;
  const same = catalog.assets.find(a => a.id === id);
  if (same) return {status:'unchanged', id, record:same, files:[]};
  const json = packJson(list), jsonFile = path.join(tmp, 'pack.json');
  fs.writeFileSync(jsonFile, json);
  files.push([jsonFile, packPath(id)]);
  const s = packSummary(list);
  const rec = {
    id, title:meta.title, kind:'pack', duration:s.duration, count:s.count, groups:s.groups, groupLabel,
    cast:meta.cast, description:meta.description, notes:meta.notes, tags:meta.tags, transcript:s.transcript,
    category:meta.category, madeIn:meta.madeIn, status:meta.status, related:o.related?.length ? o.related : undefined,
    aliases:o.aliases?.length ? o.aliases : undefined, art:'type', added:o.added || today(),
    sha256:sha256(json), src:packUrl(id), audio:true, bytes:Buffer.byteLength(json),
    poster:`/cutting-room/posters/${id}.jpg`, cover:`/cutting-room/covers/${id}.jpg`, sourceReference:o.ref || undefined,
  };
  const groupSizes = s.groups.length ? s.groups.map(g => items.filter(it => it.group === g).length) : [s.count];
  const art = await typeArtFor(rec, o, {items:{count:s.count, groups:groupSizes}});
  return commit({catalog, text, old, rec, files, art, how:`pack of ${s.count}`, r2:false, o, log});
}

// --refresh-art ID: draw a published record's art again with today's code (a record the command wrote, so
// its art lives at posters/<id>.jpg; the 160 records it inherited keep theirs). Video takes the poster
// options again (--poster-frames...); audio and packs take --cover-text and --cover-sub. The art files are
// the record's own, so they are rewritten in place; the media file and the id never change.
export async function refreshArt(id, o = {}) {
  const log = o.log || (() => {});
  const text = fs.readFileSync(CATALOG, 'utf8'), catalog = JSON.parse(text), i = catalog.assets.findIndex(a => a.id === id);
  if (i < 0) throw new Error(`--refresh-art ${id} is not in the catalog`);
  const rec = {...catalog.assets[i]}, kind = kindOf(rec);
  if (!rec.added) throw new Error(`${id} came before the publish command; its art is not the command's to redraw`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cutting-room-art-'));
  try {
    let art;
    if (kind === 'video') {
      const file = localPath(rec.src);
      if (!o.posters?.length && !(file && fs.existsSync(file))) throw new Error(`${id} is not in the repository: pass --poster images`);
      const info = o.posters?.length && !(file && fs.existsSync(file)) ? {video:{width:rec.width, height:rec.height, fps:rec.fps}, duration:rec.duration} : probe(file);
      const p = await videoPoster(info, o, tmp);
      art = {poster:p.poster, posterLarge:p.posterLarge, still:p.still};
      rec.art = p.art; rec.posterLarge = `/cutting-room/posters/${id}-1280.jpg`;
      if (p.still) rec.still = `/cutting-room/posters/${id}-still.jpg`; else delete rec.still;
    } else {
      const A = await import('./cutting-room-art.mjs');
      if (kind === 'pack') {
        const list = readPack(rec), s = packSummary(list);
        art = await typeArtFor(rec, o, {items:{count:s.count, groups:s.groups.length ? s.groups.map(g => list.items.filter(it => it.group === g).length) : [s.count]}});
      } else art = await typeArtFor(rec, o, {levels:A.loudness(localPath(rec.src))});
      rec.art = 'type';
    }
    rec.poster = `/cutting-room/posters/${id}.jpg`;
    const files = artFilesOf(id, art);
    if (o.dryRun) return {status:'dry-run', id, record:ordered(rec), files:files.map(([, to]) => path.relative(ROOT, to))};
    const before = files.map(([, to]) => [to, fs.existsSync(to) ? fs.readFileSync(to) : null]);
    catalog.assets[i] = ordered(rec);
    try {
      for (const [buf, to] of files) { fs.mkdirSync(path.dirname(to), {recursive:true}); fs.writeFileSync(to, buf); }
      writeCatalog(catalog);
      if (o.check !== false) checkOrThrow(log);
    } catch (e) {
      fs.writeFileSync(CATALOG, text);
      for (const [to, buf] of before) if (buf) fs.writeFileSync(to, buf); else fs.rmSync(to, {force:true});
      throw e;
    }
    return {status:'refreshed', id, record:catalog.assets[i], files:files.map(([, to]) => path.relative(ROOT, to))};
  } finally { fs.rmSync(tmp, {recursive:true, force:true}); }
}
function checkOrThrow(log) {
  log('  checking (scripts/check-cutting-room.mjs --static)');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/check-cutting-room.mjs'), '--static'], {cwd:ROOT, encoding:'utf8', maxBuffer:1 << 26});
  if (r.status !== 0) {
    const fails = (r.stdout + r.stderr).split('\n').filter(l => /^FAIL/.test(l)).join('\n');
    throw new Error(`the check failed, so nothing was kept:\n${fails || r.stderr}`);
  }
  const w = catalogWeight();
  log(`  catalog.json: ${(w.raw / 1000).toFixed(1)} KB, ${(w.gzip / 1000).toFixed(1)} KB gzipped; ${(w.headroom / 1000).toFixed(1)} KB left of its ${BUDGET.catalogGzip / 1000} KB budget`);
}

// Where a record's art goes: posters/<id>.jpg (every record), posters/<id>-1280.jpg and posters/<id>-still.jpg
// (video), covers/<id>.jpg (audio and packs).
const artFilesOf = (id, art) => [[art.poster, path.join(LIBRARY, 'posters', `${id}.jpg`)],
  ...(art.posterLarge ? [[art.posterLarge, path.join(LIBRARY, 'posters', `${id}-1280.jpg`)]] : []),
  ...(art.still ? [[art.still, path.join(LIBRARY, 'posters', `${id}-still.jpg`)]] : []),
  ...(art.cover ? [[art.cover, path.join(LIBRARY, 'covers', `${id}.jpg`)]] : [])];

// 6-7. Write the files and the record (or, with --dry-run, say what would be written), then run the
// static check; if it fails, put everything back as it was.
async function commit({catalog, text, old, rec, files, art, how, r2, web, o, log}) {
  const artFiles = artFilesOf(rec.id, art);
  insert(catalog, rec, old);
  const record = catalog.assets[0];
  const plan = [...files.map(([, to]) => to), ...artFiles.map(([, to]) => to)];
  if (o.dryRun) return {status:'dry-run', id:rec.id, record, how, files:plan.map(f => path.relative(ROOT, f)), r2:r2 ? record.src : null};
  // Existing names are never overwritten: the same bytes are fine, different bytes stop the run.
  for (const [from, to] of [...files, ...artFiles]) {
    if (!fs.existsSync(to)) continue;
    const same = Buffer.isBuffer(from) ? sha256(fs.readFileSync(to)) === sha256(from) : sha256File(to) === sha256File(from);
    if (!same) throw new Error(`${path.relative(ROOT, to)} exists with other content; nothing was written`);
  }
  if (r2) {
    const token = process.env.CATALOG_UPLOAD_TOKEN;
    if (!token) throw new Error('--r2 needs CATALOG_UPLOAD_TOKEN in the environment');
    await uploadR2(web, record.src.slice(REMOTE.length), {base:o.base || 'https://linkedinbeats.com', token, log});
  }
  const written = [];
  try {
    for (const [from, to] of [...files, ...artFiles]) {
      if (fs.existsSync(to)) continue;
      fs.mkdirSync(path.dirname(to), {recursive:true});
      if (Buffer.isBuffer(from)) fs.writeFileSync(to, from, {flag:'wx'}); else fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
      written.push(to);
    }
    writeCatalog(catalog);
    if (o.check !== false) checkOrThrow(log);
  } catch (e) {
    fs.writeFileSync(CATALOG, text);
    for (const f of written) fs.rmSync(f, {force:true});
    throw e;
  }
  return {status:'published', id:rec.id, record, how, files:written.map(f => path.relative(ROOT, f)), r2:r2 ? record.src : null};
}
