#!/usr/bin/env node
// The Cutting Room: one library of films, songs, sounds and packs (src/cutting-room/catalog.json).
//
//   node scripts/check-cutting-room.mjs [--static] [--out DIR]
//
// Static (always):
//   format     catalog.json is written the house way (formatCatalog round-trips it byte for byte)
//   ids        unique, slug-sha8, the eight hex digits from the file's hash (a pack's from its list,
//              id blank); aliases unique and never an id; every Video Studio shot (shots.json)
//              resolves by catalogId, its own id is an alias when it differs, and the record says
//              Video Studio; related, replaces and replacedBy resolve
//   kinds      every field of every record by kind (video has dimensions; audio and packs are Songs
//              or Sounds with a cover and type art; a pack's count, total, groups and transcript
//              match its list, which is written deterministically); Source take only on video; at
//              most one featured record, a video
//   taxonomy   the page's categories and "made in" values are the spec's, in order; records use them
//   files      every local src, download, poster, cover and pack item exists with its recorded bytes
//              and sha256; new posters 640x360 (video: also 1280x720, and a 9:16 still when portrait),
//              covers 600x600; nothing in public/cutting-room/
//              duplicates another file in public/; nothing in it is unreferenced
//   budgets    films 25 MiB, posters 60 KB (the hero's 1280x720 160 KB, a portrait still 120 KB), covers
//              70 KB, catalog.json 64 KB gzipped (what the page downloads; the headroom is printed)
//   sound      every new film's sound under its ceiling: -1 dBTP, or -0.1 for one scored with Aaron's
//              own track (lib peakCeiling); a second AAC generation is what pushed DELVE. over
//   page       Just made skips the hero and earlier versions
//   bans       signed URLs anywhere; em dashes in new records; Pat in any cast; the lady in a video's
//              cast; frame art on audio or packs
//   green      no pixel of generated type art is green (hue 80-160, saturation > .25, value > .2)
//   noindex    the page's robots meta, both server middlewares, validKey and content types (with a
//              live request through the router: noindex header, audio keys accepted, .wav refused)
// Browser (skipped by --static): the page in Vite and headless Chromium at 1440 and 390 px: no
//   horizontal scroll, the hero, the pills, Just made, the filter layout, Songs and Sounds counts,
//   chips, search by "made in" and alias, an audio dialog that plays (Media Session set, no
//   "undefined"), a pack that loads only when opened (loading and error states), plays, lights its
//   row, filters, plays all and stops on close, a group filter, #id/12 and alias links, export,
//   console errors (only the R2 403s, stubbed here so no request leaves the machine); screenshots
//   to --out (default <tmp>/cutting-room-check).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import * as L from './lib/cutting-room.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const STATIC = argv.includes('--static');
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), 'cutting-room-check')));
const {ROOT, PUBLIC, LIBRARY} = L;
const failures = [];
let passed = 0;
const check = (group, name, ok, detail = '') => {
  if (ok) passed++; else failures.push(`[${group}] ${name}${detail ? `: ${detail}` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${group}] ${name}${detail ? `: ${detail}` : ''}`);
};
const note = (group, text) => console.log(`NOTE  [${group}] ${text}`);
const list = (xs, n = 6) => xs.length ? xs.slice(0, n).join('; ') + (xs.length > n ? ` (+${xs.length - n} more)` : '') : '';
const rel = f => path.relative(ROOT, f);

// The spec's vocabulary (docs: the build spec, section 2). The page and the library import theirs
// from src/cutting-room/taxonomy.js; this is the contract they are held to.
const SPEC_CATEGORIES = ['Finished films', 'Songs', 'Character performances', 'Office scenes', 'Screen inserts', 'Instruments', 'Sounds', 'Experiments'];
const SPEC_MADE_IN = ['Cutting Room originals', 'Studio and meeting rooms', 'Video Studio', 'All Hands', 'Claude Code films', "Aaron's tracks"];

const text = fs.readFileSync(L.CATALOG, 'utf8');
const catalog = JSON.parse(text);
const assets = catalog.assets;
const byId = new Map(assets.map(a => [a.id, a]));
const kind = L.kindOf;
const packs = new Map();                                     // id -> list (or null when missing)
for (const a of assets) if (kind(a) === 'pack') { try { packs.set(a.id, L.readPack(a)); } catch (e) { packs.set(a.id, null); } }

// ============================================================================ static
check('format', 'catalog.json round-trips through formatCatalog (Node writes it the way Python did)', L.formatCatalog(catalog) === text);
check('format', 'catalog has updated, coverage, cast and assets', typeof catalog.updated === 'string' && typeof catalog.coverage === 'string' && Array.isArray(catalog.cast) && Array.isArray(assets));

// ---- ids
{
  const seen = new Map(), dupes = [], bad = [], hash = [];
  for (const a of assets) {
    if (seen.has(a.id)) dupes.push(a.id); seen.set(a.id, a);
    if (!L.ID.test(a.id)) bad.push(a.id);
    if (kind(a) === 'pack') {
      const pl = packs.get(a.id);
      if (!pl) hash.push(`${a.id}: no list`); else if (!a.id.endsWith(L.packDigest(pl).slice(0, 8)) || pl.id !== a.id) hash.push(`${a.id}: list digest ${L.packDigest(pl).slice(0, 8)}, list id ${pl.id}`);
    } else if (!a.id.endsWith(String(a.sha256).slice(0, 8))) hash.push(`${a.id}: sha256 ${String(a.sha256).slice(0, 8)}`);
  }
  check('ids', `${assets.length} ids are unique`, !dupes.length, list(dupes));
  check('ids', 'every id is a lowercase slug ending in -<sha8>', !bad.length, list(bad));
  check('ids', "every id's eight hex digits are its file's hash (a pack's: its list, id blank)", !hash.length, list(hash));
  const aliasSeen = new Map(), aliasBad = [];
  for (const a of assets) for (const x of L.aliasesOf(a)) {
    if (typeof x !== 'string' || !L.ID.test(x)) aliasBad.push(`${a.id}: alias ${JSON.stringify(x)} is not an id`);
    else if (byId.has(x)) aliasBad.push(`${a.id}: alias ${x} is also a record id`);
    else if (aliasSeen.has(x)) aliasBad.push(`${a.id}: alias ${x} also on ${aliasSeen.get(x)}`);
    aliasSeen.set(x, a.id);
  }
  check('ids', `${aliasSeen.size} aliases are unique and never collide with an id`, !aliasBad.length && assets.every(a => a.aliases === undefined || Array.isArray(a.aliases)), list(aliasBad));
  const shots = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/videostudio/media/shots.json'), 'utf8')).shots;
  const shotBad = [];
  for (const s of shots) {
    const a = byId.get(s.catalogId);
    if (!a) { shotBad.push(`${s.id}: catalogId ${s.catalogId} not in the catalog`); continue; }
    if (kind(a) !== 'video') shotBad.push(`${s.id}: ${a.id} is not a video`);
    if (s.id !== a.id && !L.aliasesOf(a).includes(s.id)) shotBad.push(`${s.id}: not an alias of ${a.id}`);
    if (!L.madeInOf(a).includes('Video Studio')) shotBad.push(`${a.id}: shot ${s.id} points here but the record does not say Video Studio`);
  }
  check('ids', `all ${shots.length} Video Studio shots resolve, their ids are aliases where they differ, and their records say Video Studio`, !shotBad.length, list(shotBad));
  const links = [];
  for (const a of assets) {
    for (const r of L.relatedOf(a)) if (!byId.has(r) || r === a.id) links.push(`${a.id}: related ${r}`);
    if (a.related !== undefined && !Array.isArray(a.related) && typeof a.related !== 'string') links.push(`${a.id}: related must be an id or a list of ids`);
    if (a.replaces !== undefined && !byId.has(a.replaces)) links.push(`${a.id}: replaces ${a.replaces}`);
    if (a.replacedBy !== undefined) { const b = byId.get(a.replacedBy); if (!b) links.push(`${a.id}: replacedBy ${a.replacedBy}`); else if (a.status !== 'Earlier version') links.push(`${a.id}: replacedBy but status ${a.status}`); }
  }
  check('ids', 'related, replaces and replacedBy resolve (a replaced record is an Earlier version)', !links.length, list(links));
}

// ---- kinds and fields
{
  const probs = [];
  const p = (a, m) => probs.push(`${a.id}: ${m}`);
  const isStr = v => typeof v === 'string', isStrs = v => Array.isArray(v) && v.every(isStr);
  const isInt = v => Number.isInteger(v) && v > 0;
  const castAll = new Set(catalog.cast);
  for (const a of assets) {
    const k = kind(a);
    if (a.kind !== undefined && !L.KINDS.includes(a.kind)) p(a, `kind ${a.kind}`);
    if (!isStr(a.title) || !a.title.trim()) p(a, 'title');
    if (!isStr(a.description) || !a.description.trim()) p(a, 'description');
    if (!isStr(a.notes)) p(a, 'notes must be a string');
    if (!isStr(a.transcript)) p(a, 'transcript must be a string');
    if (!isStrs(a.tags)) p(a, 'tags'); if (!isStrs(a.cast)) p(a, 'cast');
    else for (const c of a.cast) if (!castAll.has(c)) p(a, `cast "${c}" is not in the catalog's cast list`);
    if (!L.CATEGORIES.includes(a.category)) p(a, `category ${a.category}`);
    if (!L.STATUSES.includes(a.status)) p(a, `status ${a.status}`);
    if (!/^[0-9a-f]{64}$/.test(a.sha256)) p(a, 'sha256');
    if (!isStr(a.src) || !a.src) p(a, 'src');
    if (!isInt(a.bytes)) p(a, 'bytes');
    if (!isStr(a.poster) || !a.poster.startsWith('/')) p(a, 'poster');
    if (typeof a.audio !== 'boolean') p(a, 'audio must be true or false');
    if (!(Number(a.duration) > 0)) p(a, 'duration');
    const m = a.madeIn;
    if (!Array.isArray(m) || !m.length || m.some(x => !L.MADE_IN.includes(x)) || new Set(m).size !== m.length) p(a, `madeIn ${JSON.stringify(m)}`);
    if (a.added !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(a.added)) p(a, `added ${a.added} is not an ISO date`);
    if (a.art !== undefined && !L.ART.includes(a.art)) p(a, `art ${a.art}`);
    if (a.featured !== undefined && a.featured !== true) p(a, 'featured is true or absent');
    for (const f of ['download', 'downloadSha256', 'sourceReference', 'replaces', 'replacedBy']) if (a[f] !== undefined && !isStr(a[f])) p(a, `${f} must be a string`);
    if (a.downloadBytes !== undefined && !isInt(a.downloadBytes)) p(a, 'downloadBytes');
    if (a.status === 'Source take' && k !== 'video') p(a, 'Source take is for video only');
    if (k === 'video') {
      if (!isInt(a.width) || !isInt(a.height)) p(a, 'a video needs width and height');
      if (a.fps !== undefined && !(a.fps > 0)) p(a, 'fps');
      for (const f of ['cover', 'count', 'groups', 'groupLabel']) if (a[f] !== undefined) p(a, `${f} is for audio and packs`);
      if (a.still !== undefined && !L.isPortrait(a)) p(a, 'a still is for a portrait film');
    } else {
      if (!L.AUDIO_CATEGORIES.includes(a.category)) p(a, `${k} belongs in Songs or Sounds, not ${a.category}`);
      for (const f of ['width', 'height', 'fps', 'posterLarge', 'still']) if (a[f] !== undefined) p(a, `${f} is for video only`);
      if (!isStr(a.cover)) p(a, 'audio and packs need a cover');
      if (a.art !== 'type') p(a, `audio and packs get type art, not ${a.art ?? 'none'}`);
    }
    if (k === 'audio') for (const f of ['count', 'groups', 'groupLabel']) if (a[f] !== undefined) p(a, `${f} is for packs`);
    if (a.added !== undefined) {                              // records the publish command wrote
      if (a.poster !== `/cutting-room/posters/${a.id}.jpg`) p(a, `poster should be /cutting-room/posters/${a.id}.jpg`);
      if (k !== 'video' && a.cover !== `/cutting-room/covers/${a.id}.jpg`) p(a, `cover should be /cutting-room/covers/${a.id}.jpg`);
      if (k === 'video' && a.posterLarge !== `/cutting-room/posters/${a.id}-1280.jpg`) p(a, `posterLarge should be /cutting-room/posters/${a.id}-1280.jpg`);
      if (k === 'video' && L.isPortrait(a) && a.still !== `/cutting-room/posters/${a.id}-still.jpg`) p(a, `a portrait film's still should be /cutting-room/posters/${a.id}-still.jpg`);
      if (a.art === undefined) p(a, 'new records say which art they got');
    }
  }
  check('kinds', 'every record has its fields, by kind (video, audio, pack)', !probs.length, list(probs, 10));
  const featured = assets.filter(a => a.featured);
  check('kinds', 'at most one featured record, and it is a video', featured.length <= 1 && featured.every(a => kind(a) === 'video'), featured.map(a => a.id).join(', '));
  const packProbs = [];
  for (const a of assets.filter(x => kind(x) === 'pack')) {
    const pl = packs.get(a.id), q = m => packProbs.push(`${a.id}: ${m}`);
    if (!a.src.startsWith('/cutting-room/packs/') || a.src !== L.packUrl(a.id)) q(`src should be ${L.packUrl(a.id)}`);
    if (!pl) { q('list missing or unreadable'); continue; }
    if (pl.v !== 1) q(`list v ${pl.v}`);
    if (pl.title !== a.title) q(`list title "${pl.title}"`);
    if (pl.groupLabel !== a.groupLabel || !L.GROUP_LABELS.includes(a.groupLabel)) q(`groupLabel ${a.groupLabel} (list ${pl.groupLabel})`);
    if (!Array.isArray(pl.items) || !pl.items.length) { q('no items'); continue; }
    const s = L.packSummary(pl);
    if (a.count !== s.count) q(`count ${a.count}, list has ${s.count}`);
    if (Math.abs(a.duration - s.duration) > .0015) q(`duration ${a.duration}, items total ${s.duration}`);
    if (JSON.stringify(a.groups) !== JSON.stringify(s.groups)) q(`groups ${JSON.stringify(a.groups)}, list ${JSON.stringify(s.groups)}`);
    const missing = a.status === 'Earlier version' ? [] : pl.items.filter(it => !a.transcript.includes(it.text)).map(it => it.n);   // a replaced pack drops its words
    if (missing.length) q(`transcript lacks the text of items ${list(missing.map(String))}`);
    pl.items.forEach((it, i) => {
      if (it.n !== i + 1) q(`item ${i + 1} numbered ${it.n}`);
      if (typeof it.text !== 'string' || !it.text.trim() || !(it.duration > 0) || typeof it.src !== 'string') q(`item ${it.n}: text, src and duration`);
    });
    if (L.packJson(pl) !== fs.readFileSync(L.localPath(a.src), 'utf8')) q('list is not written deterministically (packJson)');
  }
  check('kinds', `${packs.size} packs: count, total, groups and transcript match their lists, written deterministically`, !packProbs.length, list(packProbs, 8));
}

// ---- taxonomy
{
  const page = fs.readFileSync(path.join(ROOT, 'src/cutting-room/main.jsx'), 'utf8');
  check('taxonomy', 'categories are the spec\'s, in pill order, after "Everything"', JSON.stringify(L.CATEGORIES) === JSON.stringify(SPEC_CATEGORIES) && JSON.stringify(L.PILLS) === JSON.stringify(['Everything', ...SPEC_CATEGORIES]));
  check('taxonomy', '"made in" values are the spec\'s', JSON.stringify(L.MADE_IN) === JSON.stringify(SPEC_MADE_IN));
  check('taxonomy', 'the page draws its pills and "made in" options from taxonomy.js', /from '\.\/taxonomy\.js'/.test(page) && /PILLS\.map/.test(page) && /MADE_IN\.map/.test(page) && !/const categories\s*=/.test(page));
  const tally = (key, values) => values.map(v => `${v} ${assets.filter(a => key(a).includes(v)).length}`).join(', ');
  note('taxonomy', `categories: ${tally(a => [a.category], L.CATEGORIES)}`);
  note('taxonomy', `made in: ${tally(L.madeInOf, L.MADE_IN)}`);
  note('taxonomy', `kinds: ${L.KINDS.map(k => `${k} ${assets.filter(a => kind(a) === k).length}`).join(', ')}`);
}

// ---- files
const sharpLib = (() => { try { return createRequire(import.meta.url)('sharp'); } catch { return null; } })();
{
  const probs = [], referenced = new Set();
  const want = (a, url, sha, bytes, what) => {
    const f = L.localPath(url);
    if (!f) return;
    referenced.add(f);
    if (!fs.existsSync(f)) { probs.push(`${a.id}: ${what} ${url} missing`); return; }
    if (bytes !== undefined && fs.statSync(f).size !== bytes) probs.push(`${a.id}: ${what} ${url} is ${fs.statSync(f).size} bytes, recorded ${bytes}`);
    if (sha !== undefined && L.sha256File(f) !== sha) probs.push(`${a.id}: ${what} ${url} sha256 differs`);
  };
  let items = 0;
  for (const a of assets) {
    want(a, a.src, a.sha256, a.bytes, 'src');
    const dl = a.download && a.download.split('?')[0];
    if (dl && dl !== a.src.split('?')[0] && L.localPath(dl)) {
      if (a.downloadSha256 === undefined || a.downloadBytes === undefined) probs.push(`${a.id}: a download beside the web file needs downloadSha256 and downloadBytes`);
      want(a, dl, a.downloadSha256, a.downloadBytes, 'download');
    }
    want(a, a.poster, undefined, undefined, 'poster');
    if (a.posterLarge) want(a, a.posterLarge, undefined, undefined, 'posterLarge');
    if (a.still) want(a, a.still, undefined, undefined, 'still');
    if (a.cover) want(a, a.cover, undefined, undefined, 'cover');
    for (const it of packs.get(a.id)?.items ?? []) { items++; if (!L.localPath(it.src)) probs.push(`${a.id}: item ${it.n} must be a repository file`); want({id:`${a.id}/${it.n}`}, it.src, it.sha256, it.bytes, 'item'); }
  }
  check('files', `every local src, download, poster, cover and ${items} pack items exist with their recorded bytes and sha256`, !probs.length, list(probs, 8));
  if (sharpLib) {
    const dims = [];
    for (const a of assets.filter(x => x.added)) {
      for (const [url, w, h] of [[a.poster, L.POSTER.width, L.POSTER.height], ...(a.cover ? [[a.cover, L.COVER.width, L.COVER.height]] : []),
        ...(a.posterLarge ? [[a.posterLarge, L.POSTER_LARGE.width, L.POSTER_LARGE.height]] : [])]) {
        const f = L.localPath(url); if (!f || !fs.existsSync(f)) continue;
        const m = await sharpLib(f).metadata();
        if (m.width !== w || m.height !== h || m.format !== 'jpeg') dims.push(`${a.id}: ${url} is ${m.width}x${m.height} ${m.format}, wants ${w}x${h} jpeg`);
      }
      const sf = a.still && L.localPath(a.still);
      if (sf && fs.existsSync(sf)) {                         // 9:16, at most 720 x 1280, no bigger than the film
        const m = await sharpLib(sf).metadata();
        if (m.format !== 'jpeg' || m.width > L.STILL.width || m.width > a.width || Math.abs(m.height / m.width - 16 / 9) > .01) dims.push(`${a.id}: ${a.still} is ${m.width}x${m.height} ${m.format}, wants a 9:16 jpeg at most ${Math.min(L.STILL.width, a.width)} wide`);
      }
    }
    check('files', 'new posters are 640x360 (and 1280x720 for the hero), portrait stills 9:16, covers 600x600, all JPEG', !dims.length, list(dims));
  } else note('files', 'sharp is not installed: poster and cover sizes not measured');
  // Every file in the library is referenced, and none duplicates another file in public/.
  const walk = d => !fs.existsSync(d) ? [] : fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isSymbolicLink() ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const mine = walk(LIBRARY).filter(f => !path.basename(f).startsWith('.'));
  const orphans = mine.filter(f => !referenced.has(f));
  check('files', `all ${mine.length} files in public/cutting-room/ are referenced by the catalog`, !orphans.length, list(orphans.map(rel)));
  const bySize = new Map();
  for (const f of walk(PUBLIC)) { const n = fs.statSync(f).size; if (n) (bySize.get(n) ?? bySize.set(n, []).get(n)).push(f); }
  // Art is named per record (posters/<id>.jpg), so two records may share identical art (a dialogue-only
  // and a full-mix cut of one shot do); any other match is a copy of something already served.
  const art = f => /^(posters|covers)$/.test(path.basename(path.dirname(f))) && path.dirname(path.dirname(f)) === LIBRARY;
  const dupes = [], twins = [], hashOf = new Map(), h = f => hashOf.get(f) ?? hashOf.set(f, L.sha256File(f)).get(f);
  for (const f of mine) for (const g of bySize.get(fs.statSync(f).size) ?? []) {
    if (g === f || (g.startsWith(LIBRARY + path.sep) && g < f) || h(f) !== h(g)) continue;
    (art(f) && art(g) ? twins : dupes).push(`${rel(f)} = ${rel(g)}`);
  }
  check('files', 'nothing in public/cutting-room/ duplicates another file in public/ (reference it in place)', !dupes.length, list(dupes));
  if (twins.length) note('files', `${twins.length} pairs of records share identical poster art: ${list(twins.map(t => t.replace(/public\/cutting-room\/posters\//g, '')), 3)}`);
  const sizes = Object.fromEntries(['films', 'songs', 'sounds', 'packs', 'posters', 'covers'].map(d => [d, walk(path.join(LIBRARY, d)).reduce((s, f) => s + fs.statSync(f).size, 0)]));
  note('files', `public/cutting-room/: ${Object.entries(sizes).map(([d, n]) => `${d} ${(n / 1e6).toFixed(1)} MB`).join(', ')}; total ${(Object.values(sizes).reduce((s, n) => s + n, 0) / 1e6).toFixed(1)} MB in ${mine.length} files`);
}

// ---- budgets
{
  const over = (dir, max) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []).map(f => path.join(dir, f)).filter(f => fs.statSync(f).size > max).map(f => `${rel(f)} ${fs.statSync(f).size}`);
  const films = over(path.join(LIBRARY, 'films'), L.BUDGET.film);
  check('budgets', 'films are 25 MiB or less', !films.length, list(films));
  const posterBudget = f => /-1280\.jpg$/.test(f) ? L.BUDGET.posterLarge : /-still\.jpg$/.test(f) ? L.BUDGET.still : L.BUDGET.poster;
  const posterDir = path.join(LIBRARY, 'posters');
  const posters = (fs.existsSync(posterDir) ? fs.readdirSync(posterDir) : []).filter(f => fs.statSync(path.join(posterDir, f)).size > posterBudget(f)).map(f => `posters/${f} ${fs.statSync(path.join(posterDir, f)).size}`);
  const covers = over(path.join(LIBRARY, 'covers'), L.BUDGET.cover);
  check('budgets', 'posters are 60 KB or less (the hero\'s 160 KB, a still 120 KB), covers 70 KB or less', !posters.length && !covers.length, list([...posters, ...covers]));
  const w = L.catalogWeight(text);
  check('budgets', `catalog.json is ${L.BUDGET.catalogGzip / 1000} KB or less gzipped: ${(w.gzip / 1000).toFixed(1)} KB (${(w.raw / 1000).toFixed(1)} KB raw), ${(w.headroom / 1000).toFixed(1)} KB headroom`, w.gzip <= L.BUDGET.catalogGzip);
}

// ---- sound: a film's true peak, as it ships (the publish command gates it too, before writing or uploading)
{
  const films = assets.filter(a => a.added && kind(a) === 'video' && a.audio && L.localPath(a.src) && fs.existsSync(L.localPath(a.src)));
  const over = [], seen = [];
  for (const a of films) {
    const {peak, lufs} = L.truePeak(L.localPath(a.src)), ceiling = L.peakCeiling(a, assets);
    seen.push(`${a.title} ${lufs} LUFS ${peak} dBTP (ceiling ${ceiling})`);
    if (!(peak <= ceiling)) over.push(`${a.id}: true peak ${peak} dBTP, over ${ceiling}`);
  }
  check('sound', `${films.length} new films stay under their true-peak ceiling`, !over.length, list(over));
  if (seen.length) note('sound', seen.join('; '));
}

// ---- page (static): what the top of the page shows
{
  const hero = L.heroOf(assets), fresh = L.justMade(assets);
  const bad = fresh.filter(a => a === hero || a.status === 'Earlier version' || a.replacedBy).map(a => a.id);
  check('page', `Just made (${fresh.map(a => a.id).join(', ') || 'empty'}) skips the hero (${hero.id}) and earlier versions`, !bad.length, list(bad));
  check('page', 'a malformed # link opens nothing instead of throwing', L.parseHash('#%E0%A4%A').key === null && L.parseHash('#100%').key === null && L.parseHash('#a-1/2').row === 2);
}

// ---- bans
{
  const signed = new RegExp(['X-' + 'Amz-', 'Signa' + 'ture=', 'r2\\.' + 'cloudflarestorage'].join('|'), 'i');
  const files = [L.CATALOG, ...fs.readdirSync(path.join(ROOT, 'src/cutting-room')).map(f => path.join(ROOT, 'src/cutting-room', f)),
    ...(fs.existsSync(path.join(LIBRARY, 'packs')) ? fs.readdirSync(path.join(LIBRARY, 'packs')).map(f => path.join(LIBRARY, 'packs', f)) : []),
    path.join(ROOT, 'scripts/lib/cutting-room.mjs'), path.join(ROOT, 'scripts/publish-to-cutting-room.mjs'), path.join(ROOT, 'docs/allhands-mac-handoff.md'), path.join(ROOT, 'server/cutting-room.js')]
    .filter(f => fs.existsSync(f) && fs.statSync(f).isFile());
  const leaks = files.filter(f => signed.test(fs.readFileSync(f, 'utf8'))).map(rel);
  check('bans', `no signed URL or storage host in ${files.length} catalog, page, pack, library and doc files`, !leaks.length, list(leaks));
  const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out); return out; };
  const dashes = assets.filter(a => a.added && [...strings(a), ...(packs.get(a.id)?.items || []).map(it => it.text)].some(s => s.includes('\u2014'))).map(a => a.id);
  check('bans', `no em dash in the ${assets.filter(a => a.added).length} new records (and their pack lists)`, !dashes.length, list(dashes));
  const pat = [...assets.filter(a => (a.cast || []).some(c => /\bpat\b/i.test(c))).map(a => a.id), ...catalog.cast.filter(c => /\bpat\b/i.test(c)).map(c => `catalog cast "${c}"`)];
  check('bans', 'Pat is never in a cast', !pat.length, list(pat));
  const lady = assets.filter(a => kind(a) === 'video' && (a.cast || []).some(c => /\blady\b/i.test(c))).map(a => a.id);
  check('bans', 'the lady is heard, never seen: never in a video\'s cast', !lady.length, list(lady));
  const frame = assets.filter(a => kind(a) !== 'video' && (a.art === 'frame' || a.art === 'triptych')).map(a => a.id);
  check('bans', 'no frame art on audio or packs', !frame.length, list(frame));
}

// ---- never green
if (sharpLib) {
  const art = new Set();
  for (const a of assets.filter(x => x.art === 'type')) for (const u of [a.poster, a.cover]) { const f = L.localPath(u); if (f && fs.existsSync(f)) art.add(f); }
  const coversDir = path.join(LIBRARY, 'covers');
  if (fs.existsSync(coversDir)) for (const f of fs.readdirSync(coversDir)) art.add(path.join(coversDir, f));
  const green = [];
  for (const f of art) {
    const {data, info} = await sharpLib(f).removeAlpha().raw().toBuffer({resolveWithObject:true});
    let n = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      if (max <= .2 || d / max <= .25) continue;
      const hue = (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
      const h360 = (hue + 360) % 360;
      if (h360 >= 80 && h360 <= 160) n++;
    }
    if (n) green.push(`${rel(f)} ${n} px`);
  }
  check('green', `no green pixel in ${art.size} type-art posters and covers`, !green.length, list(green));
}

// ---- noindex and server
{
  const html = fs.readFileSync(path.join(ROOT, 'cutting-room/index.html'), 'utf8');
  check('noindex', 'the page carries <meta name="robots" content="noindex...">', /<meta name="robots" content="[^"]*noindex/.test(html));
  const index = fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf8'), router = fs.readFileSync(path.join(ROOT, 'server/cutting-room.js'), 'utf8');
  check('noindex', 'server/index.js sends X-Robots-Tag noindex for /cutting-room', /app\.use\('\/cutting-room',[^\n]*X-Robots-Tag','noindex/.test(index));
  check('noindex', 'the media router sends X-Robots-Tag noindex', /router\.use\([^\n]*X-Robots-Tag','noindex/.test(router));
  const S = await import('../server/cutting-room.js');
  const yes = ['a-1.mp3', 'a-1.m4a', 'a-1.mp4', 'a-1.jpg', 'a-1.webp'], no = ['a-1.wav', 'a-1.flac', '../a-1.mp3', 'a/b-1.mp3', 'A-1.mp3', 'a-1.MP3', '', 'a.mp3.wav'];
  check('server', 'validKey takes mp3 and m4a (and mp4, jpg, webp), refuses wav, flac, paths and capitals', yes.every(S.validKey) && !no.some(S.validKey), `${yes.filter(k => !S.validKey(k))} ${no.filter(S.validKey)}`);
  check('server', 'content types: audio/mpeg, audio/mp4 beside video/mp4, image/jpeg, image/webp', S.contentType('a-1.mp3') === 'audio/mpeg' && S.contentType('a-1.m4a') === 'audio/mp4' && S.contentType('a-1.mp4') === 'video/mp4' && S.contentType('a-1.jpg') === 'image/jpeg' && S.contentType('a-1.webp') === 'image/webp');
  // A live request through the router, storage unset (nothing can be uploaded) and a throwaway token.
  const keep = Object.fromEntries(Object.keys(process.env).filter(k => k.startsWith('CATALOG_')).map(k => [k, process.env[k]]));
  for (const k of Object.keys(keep)) delete process.env[k];
  process.env.CATALOG_UPLOAD_TOKEN = 'check-cutting-room-local-token';
  const express = (await import('express')).default, app = express();
  app.use('/api/cutting-room', S.createCuttingRoomRouter());
  const srv = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${srv.address().port}/api/cutting-room/media/`, auth = {authorization:`Bearer ${process.env.CATALOG_UPLOAD_TOKEN}`};
  const get = await fetch(base + 'a-1.wav', {redirect:'manual'});
  const putWav = await fetch(base + 'a-1.wav', {method:'PUT', headers:{...auth, 'content-length':'3'}, body:'abc'});
  const say = console.error; console.error = () => {};      // the router logs the storage failure it is meant to hit
  const putMp3 = await fetch(base + 'a-1.mp3', {method:'PUT', headers:{...auth, 'content-length':'3'}, body:'abc'});
  console.error = say;
  const putAnon = await fetch(base + 'a-1.mp3', {method:'PUT', headers:{'content-length':'3'}, body:'abc'});
  srv.close();
  delete process.env.CATALOG_UPLOAD_TOKEN; Object.assign(process.env, keep);
  check('server', 'live: GET of a .wav key is 404 with X-Robots-Tag noindex', get.status === 404 && /noindex/.test(get.headers.get('x-robots-tag') || ''), `${get.status} ${get.headers.get('x-robots-tag')}`);
  check('server', 'live: PUT .wav is refused as an invalid name (400); PUT .mp3 passes the name check and reaches storage (unset here: 502); no token is 401', putWav.status === 400 && putMp3.status === 502 && putAnon.status === 401, `${putWav.status} ${putMp3.status} ${putAnon.status}`);
}

// ============================================================================ browser
if (!STATIC) await browserChecks();

console.log(`\n${passed} passed, ${failures.length} failed.`);
if (failures.length) { console.error(`\n${failures.length} problem(s):\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log('check-cutting-room: all checks passed');

async function browserChecks() {
  const require = createRequire(import.meta.url);
  const {chromium} = (() => { for (const id of ['playwright', 'playwright-core']) { try { return require(id); } catch {} } throw Error('Install Playwright (or use --static).'); })();
  const exe = (() => { const pool = process.env.PLAYWRIGHT_BROWSERS_PATH; if (pool && fs.existsSync(pool)) for (const d of fs.readdirSync(pool).sort().reverse()) { const p = `${pool}/${d}/chrome-linux64/chrome`; if (d.startsWith('chromium-') && fs.existsSync(p)) return p; } return undefined; })();
  const {createServer} = await import('vite');
  const srv = await createServer({root:ROOT, configFile:path.join(ROOT, 'vite.config.js'), cacheDir:path.join(os.tmpdir(), 'cutting-room-check-vite'), logLevel:'error', server:{port:0, host:'127.0.0.1', hmr:false}});
  await srv.listen();
  const origin = `http://127.0.0.1:${srv.httpServer.address().port}`;
  const browser = await chromium.launch({executablePath:exe, args:['--autoplay-policy=no-user-gesture-required']});
  fs.mkdirSync(OUT, {recursive:true});
  const shots = [];
  const hero = L.heroOf(assets), fresh = L.justMade(assets);
  const current = a => L.inVersion(a, 'current');
  const ladyPack = assets.find(a => kind(a) === 'pack' && (packs.get(a.id)?.items || []).every(it => it.src.startsWith('/phrases/'))) || assets.find(a => kind(a) === 'pack');
  const groupPack = assets.find(a => kind(a) === 'pack' && (a.groups || []).includes('Synthia')) || assets.find(a => kind(a) === 'pack' && (a.groups || []).length > 1);
  const song = assets.find(a => kind(a) === 'audio' && a.category === 'Songs' && current(a)) || assets.find(a => kind(a) === 'audio' && current(a));
  const aliased = assets.find(a => L.aliasesOf(a).includes('drums-listening-44bcfc4f')) || assets.find(a => L.aliasesOf(a).length);
  const aliasKey = aliased ? (L.aliasesOf(aliased).includes('drums-listening-44bcfc4f') ? 'drums-listening-44bcfc4f' : L.aliasesOf(aliased)[0]) : null;

  try {
    for (const [W, H] of [[1440, 900], [390, 844]]) {
      const tag = `${W}`;
      const ctx = await browser.newContext({viewport:{width:W, height:H}, deviceScaleFactor:W < 500 ? 2 : 1, acceptDownloads:true});
      const page = await ctx.newPage();
      const errors = [], r2 = [], packLoads = [], induced = new Set();
      let loads = 0;
      const fresh_ = hash => `${origin}/cutting-room/?load=${++loads}${hash ? `#${hash}` : ''}`;   // a new query: a real load, not a hashchange
      let packOpened = false, packMode = 'pass';
      page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') { const u = m.location()?.url || ''; if (u.includes('/api/cutting-room/media/') && /status of 403/.test(m.text())) r2.push(u); else if (!induced.has(u)) errors.push(`${m.text()} ${u}`); } });
      // R2 is not reachable from a check: every media request gets the 403 the sandbox would give.
      await page.route('**/api/cutting-room/media/**', route => route.fulfill({status:403, body:'Forbidden'}));
      await page.route('**/cutting-room/packs/*.json', async route => {
        packLoads.push({url:route.request().url(), opened:packOpened});
        if (packMode === 'fail') { induced.add(route.request().url()); return route.fulfill({status:500, body:'no'}); }
        await new Promise(r => setTimeout(r, 350));               // long enough to see the loading state
        return route.continue();
      });
      await page.goto(`${origin}/cutting-room/`);
      await page.waitForSelector('.cr-grid .cr-card');
      const noScroll = async where => { const d = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]); check(tag, `no horizontal scroll (${where})`, d[0] <= d[1], `scroll width ${d[0]}, viewport ${d[1]}`); };
      await noScroll('library');
      // hero, copy, pills
      await page.waitForFunction(() => document.querySelector('.cr-feature img')?.complete);
      // naturalWidth of a srcset image is in CSS pixels; the file the browser chose is measured on its own.
      const h = await page.evaluate(async () => { const s = document.querySelector('.cr-feature'), i = s?.querySelector('img'), f = new Image(); f.src = i.currentSrc; await f.decode(); return {id:s?.dataset.id, title:s?.querySelector('h2')?.textContent, alt:i?.alt, natural:f.naturalWidth, shown:Math.round(i?.getBoundingClientRect().width * devicePixelRatio), src:i?.currentSrc.replace(location.origin, '')}; });
      check(tag, `hero is ${hero.title} (featured, or else the first Current edit video), alt "${L.stillAlt(hero.title)}"`, h.id === hero.id && h.title === hero.title && h.alt === L.stillAlt(hero.title), JSON.stringify(h));
      if (hero.posterLarge) check(tag, `the hero's image is sharp: ${h.natural} px wide for ${h.shown} device px`, h.natural >= Math.min(h.shown, L.POSTER_LARGE.width) * .95, JSON.stringify(h));
      const copy = await page.evaluate(() => ({intro:document.querySelector('.cr-intro p:not(.cr-kicker)')?.textContent, total:document.querySelector('.cr-total span')?.textContent, hint:document.querySelector('.cr-results span:last-child')?.textContent}));
      check(tag, 'copy: intro, counter and hint', copy.intro === 'Extraordinary footage and music about extremely ordinary business.' && copy.total === 'films, songs' + 'and questionable decisions' && copy.hint === 'Click to play. Packs open as a playlist.', JSON.stringify(copy));
      const pills = await page.$$eval('.cr-categories button', bs => bs.map(b => { const r = b.getBoundingClientRect(); return {t:b.textContent, right:r.right}; }));
      check(tag, 'category pills are Everything plus the categories, in order, and wrap inside the page', JSON.stringify(pills.map(p => p.t)) === JSON.stringify(L.PILLS) && pills.every(p => p.right <= W), pills.map(p => p.t).join(', '));
      // Just made
      if (fresh.length) {
        const jm = await page.$$eval('.cr-fresh .cr-card', cs => cs.map(c => ({id:c.dataset.id, top:Math.round(c.getBoundingClientRect().top), left:Math.round(c.getBoundingClientRect().left)})));
        const tops = [...new Set(jm.map(c => c.top))];
        const layout = W >= 1000 ? tops.length === 1 : tops.length === Math.ceil(jm.length / 2) && jm.length <= 4;
        check(tag, `Just made: the ${fresh.length} newest by added, ${W >= 1000 ? 'four across' : '2 x 2'}`, JSON.stringify(jm.map(c => c.id)) === JSON.stringify(fresh.map(a => a.id)) && layout, jm.map(c => `${c.id}@${c.top}`).join(' '));
      } else note(tag, 'Just made: no record has `added` yet, so the row is hidden');
      // filter layout
      const box = await page.evaluate(() => Object.fromEntries(['.cr-tools', '.cr-search', '.cr-cast', '.cr-made', '.cr-version'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [s, {x:Math.round(r.left), y:Math.round(r.top), w:Math.round(r.width), h:Math.round(r.height)}]; })));
      const b = k => box[k];
      const ok = W >= 1000 ? new Set(['.cr-search', '.cr-cast', '.cr-made', '.cr-version'].map(k => b(k).y)).size === 1
        : b('.cr-search').w >= b('.cr-tools').w - 2 && b('.cr-cast').y === b('.cr-made').y && b('.cr-cast').y > b('.cr-search').y && b('.cr-version').y > b('.cr-cast').y && b('.cr-version').w >= b('.cr-tools').w - 2;
      check(tag, W >= 1000 ? 'search, Cast, Made in and Version share a row' : 'search on its own row, then Cast and Made in side by side, then Version', ok, JSON.stringify(box));
      // counts per category, chips
      const count = async () => Number((await page.textContent('.cr-results span')).match(/^(\d+) on record/)?.[1]);
      for (const c of ['Songs', 'Sounds', 'Finished films']) {
        await page.click(`.cr-categories button:text-is("${c}")`);
        const want = assets.filter(a => a.category === c && current(a));
        const n = await count(), cards = await page.$$eval('.cr-grid .cr-card', cs => cs.map(x => ({id:x.dataset.id, chip:x.querySelector('.cr-audio')?.textContent.trim(), meta:x.querySelector('.cr-card-origin')?.textContent})));
        const chipsOk = cards.every(x => { const a = byId.get(x.id); return a && x.chip === L.chipOf(a) && x.meta === `${a.category}${L.madeInOf(a)[0] ? L.pretty(L.madeInOf(a)[0]) : ''}`; });
        check(tag, `${c} shows ${want.length} on record and ${Math.min(want.length, 18)} cards, each chip and meta line right`, n === want.length && cards.length === Math.min(want.length, 18) && chipsOk, `${n} on record, ${cards.length} cards${chipsOk ? '' : ': ' + JSON.stringify(cards.slice(0, 3))}`);
      }
      await page.click('.cr-categories button:text-is("Everything")');
      // Made in filter and search (made in, alias)
      await page.selectOption('.cr-made select', 'Video Studio');
      const vs = assets.filter(a => L.madeInOf(a).includes('Video Studio') && current(a)).length;
      check(tag, `Made in: Video Studio keeps ${vs}`, await count() === vs);
      await page.selectOption('.cr-made select', '');
      for (const q of ['Claude Code films', aliasKey].filter(Boolean)) {
        await page.fill('.cr-search input', q);
        const want = assets.filter(a => current(a) && L.matches(a, q));
        const ids = await page.$$eval('.cr-grid .cr-card', cs => cs.map(c => c.dataset.id));
        check(tag, `search "${q}" finds ${want.length}`, await count() === want.length && want.slice(0, 18).every(a => ids.includes(a.id)), ids.slice(0, 4).join(', '));
      }
      await page.fill('.cr-search input', '');
      check(tag, 'no pack list loaded before a pack was opened', !packLoads.length, packLoads.map(p => p.url).join(', '));
      await page.screenshot({path:path.join(OUT, `library-${tag}.png`)}); shots.push(`library-${tag}.png`);
      if (W >= 1000) { await page.screenshot({path:path.join(OUT, `library-full-${tag}.png`), fullPage:true}); shots.push(`library-full-${tag}.png`); }

      // ---- audio dialog
      if (song) {
        await page.click(`.cr-categories button:text-is("${song.category}")`);
        await page.click(`.cr-grid .cr-card[data-id="${song.id}"] .cr-open`);
        await page.waitForSelector('.cr-dialog[open] .cr-listen audio');
        const k = await page.textContent('.cr-dialog .cr-modal-content .cr-kicker');
        check(tag, `audio dialog kicker "${k}" (duration, format, made in; nothing undefined)`, /^\d+:\d\d \u00b7 [A-Z0-9]+ \u00b7 Made in \S/.test(k) && !/undefined|NaN|null/.test(k));
        if (song.transcript) check(tag, 'the transcript heading reads Lyrics for a song', (await page.textContent('.cr-dialog details summary')) === (song.category === 'Songs' ? 'Lyrics' : 'Words'));
        const cover = await page.$eval('.cr-dialog .cr-cover', i => ({w:i.naturalWidth, box:Math.round(i.getBoundingClientRect().width), bg:getComputedStyle(i.closest('.cr-listen')).backgroundColor}));
        check(tag, 'the square cover loads, 320 px at most, on board black', cover.w > 0 && cover.box <= 320 && cover.bg === 'rgb(0, 0, 0)', JSON.stringify(cover));
        const playing = await page.evaluate(async () => { const a = document.querySelector('.cr-dialog .cr-listen audio'); await a.play(); const t0 = performance.now(); while (a.currentTime < .25 && performance.now() - t0 < 6000) await new Promise(r => setTimeout(r, 100)); return {t:a.currentTime, meta:navigator.mediaSession?.metadata?.title}; });
        check(tag, `the song plays and sets Media Session (${playing.t.toFixed(2)} s)`, playing.t >= .25 && playing.meta === song.title, JSON.stringify(playing));
        const rel = L.relatedOf(song).map(id => byId.get(id)).filter(Boolean);
        if (rel.length) check(tag, 'related links read Watch the film / Hear the song / Open the pack', (await page.$$eval('.cr-related a', as => as.map(a => a.textContent.trim()))).every((t, i) => t.startsWith(kind(rel[i]) === 'video' ? 'Watch the film' : kind(rel[i]) === 'pack' ? 'Open the pack' : 'Hear the song')));
        await page.evaluate(() => document.querySelector('.cr-dialog .cr-listen audio').pause());
        await page.screenshot({path:path.join(OUT, `audio-${tag}.png`)}); shots.push(`audio-${tag}.png`);
        const handle = await page.$('.cr-dialog .cr-listen audio');
        await page.evaluate(() => document.querySelector('.cr-dialog .cr-listen audio').play());
        await page.click('.cr-modal-top button');
        const stopped = await handle.evaluate(async a => { for (let i = 0; i < 20 && !a.paused; i++) await new Promise(r => setTimeout(r, 25)); return a.paused; });
        check(tag, 'closing the dialog stops the song', !(await page.$('.cr-dialog[open]')) && stopped);
        check(tag, 'no pack list loaded before a pack was opened (after a song)', !packLoads.length);
      } else note(tag, 'no audio record yet: audio dialog not exercised');

      // ---- pack dialog
      if (ladyPack) {
        const pl = packs.get(ladyPack.id);
        await page.click('.cr-categories button:text-is("Sounds")');
        packOpened = true;
        if (W < 1000) packMode = 'fail';                           // at 390: the error state first, then Try again
        await page.click(`.cr-grid .cr-card[data-id="${ladyPack.id}"] .cr-open`);
        if (W < 1000) {
          await page.waitForSelector('.cr-pack-error');
          check(tag, 'a pack list that fails shows the error state with Try again', /couldn.t load/.test(await page.textContent('.cr-pack-error')));
          packMode = 'pass';
          await page.click('.cr-pack-error button');
        }
        const loading = await page.waitForSelector('.cr-pack-state[role=status]', {timeout:2000}).then(() => true).catch(() => false);
        check(tag, 'the pack shows its loading state while the list loads', loading);
        await page.waitForSelector('.cr-pack-list li');
        const rows = () => page.$$eval('.cr-pack-list li', ls => ls.length);
        check(tag, `${ladyPack.title} lists ${pl.items.length} rows`, await rows() === pl.items.length);
        const scrollBox = await page.$eval('.cr-pack-list', el => ({max:parseFloat(getComputedStyle(el).maxHeight), vh:innerHeight, overflow:getComputedStyle(el).overflowY}));
        check(tag, 'the list scrolls inside about half the viewport', scrollBox.overflow === 'auto' && Math.abs(scrollBox.max - scrollBox.vh / 2) < 2, JSON.stringify(scrollBox));
        await page.click('.cr-pack-list li[data-n="3"] .cr-row');
        const p3 = await page.evaluate(async () => { const a = document.querySelector('.cr-now audio'); const t0 = performance.now(); while ((a.paused || a.currentTime < .15) && performance.now() - t0 < 5000) await new Promise(r => setTimeout(r, 50)); const li = document.querySelector('.cr-pack-list li[data-n="3"]'); return {t:a.currentTime, src:a.getAttribute('src'), lit:li.classList.contains('lit') && li.getAttribute('aria-current') === 'true', others:document.querySelectorAll('.cr-pack-list li.lit').length, meta:navigator.mediaSession?.metadata?.title}; });
        check(tag, 'a row plays through the one shared <audio>, lit (and only it)', p3.t > 0 && p3.src === pl.items[2].src && p3.lit && p3.others === 1 && p3.meta === pl.items[2].text, JSON.stringify(p3));
        check(tag, 'the dialog has exactly one <audio> for the whole pack', await page.$$eval('.cr-dialog audio', as => as.length) === 1);
        // in-pack search
        const word = pl.items.map(it => it.text.split(/\s+/).find(w => w.length > 5)).find(Boolean)?.replace(/[^\p{L}'-]/gu, '') || pl.items[0].text;
        const wantRows = pl.items.filter(it => L.matches({title:it.text, description:`${it.n} ${it.group || ''}`}, word)).length;
        await page.fill('.cr-pack-search input', word);
        check(tag, `in-pack search "${word}" keeps ${wantRows} rows`, await rows() === wantRows);
        await page.fill('.cr-pack-search input', '');
        // play all: starts at the lit row and moves on by itself
        await page.click('.cr-play-all');
        const moved = await page.waitForFunction(() => Number(document.querySelector('.cr-pack-list li.lit')?.dataset.n) === 4, null, {timeout:12000}).then(() => true).catch(() => false);
        check(tag, 'Play all continues from the lit row to the next', moved);
        await page.screenshot({path:path.join(OUT, `pack-${tag}.png`)}); shots.push(`pack-${tag}.png`);
        const shared = await page.$('.cr-now audio');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.cr-dialog[open]'));
        check(tag, 'closing the pack stops playback', await shared.evaluate(async a => { for (let i = 0; i < 20 && !a.paused; i++) await new Promise(r => setTimeout(r, 25)); return a.paused; }));
        check(tag, 'pack lists load only once a pack is open', packLoads.length > 0 && packLoads.every(p => p.opened));
      } else note(tag, 'no pack yet: pack dialog not exercised');
      if (groupPack) {
        const pl = packs.get(groupPack.id), g = (groupPack.groups || []).includes('Synthia') ? 'Synthia' : groupPack.groups[0];
        await page.click(`.cr-grid .cr-card[data-id="${groupPack.id}"] .cr-open`);
        await page.waitForSelector('.cr-pack-list li');
        await page.selectOption('.cr-pack-group select', g);
        const n = await page.$$eval('.cr-pack-list li', ls => ls.length), want = pl.items.filter(it => it.group === g).length;
        check(tag, `${groupPack.title}: the ${g} filter shows ${want} rows`, n === want, `${n}`);
        await page.click('.cr-modal-top button');
      }

      // ---- links
      if (ladyPack) {
        const pl = packs.get(ladyPack.id), n = Math.min(12, pl.items.length);
        await page.goto(fresh_(`${ladyPack.id}/${n}`));
        await page.waitForSelector(`.cr-pack-list li[data-n="${n}"].lit`);
        await page.waitForTimeout(250);
        const s = await page.evaluate(n => { const a = document.querySelector('.cr-now audio'), li = document.querySelector(`.cr-pack-list li[data-n="${n}"]`), box = document.querySelector('.cr-pack-list').getBoundingClientRect(), r = li.getBoundingClientRect(), top = document.querySelector('.cr-modal-top').getBoundingClientRect(); return {paused:a.paused, t:a.currentTime, cued:a.getAttribute('src'), inView:r.top >= box.top - 1 && r.bottom <= box.bottom + 1, header:top.top >= 0}; }, n);
        check(tag, `#${ladyPack.id}/${n} opens the pack on row ${n}, cued, in view, not playing, header still visible`, s.paused && s.t === 0 && s.cued === pl.items[n - 1].src && s.inView && s.header, JSON.stringify(s));
        await page.screenshot({path:path.join(OUT, `pack-row-${tag}.png`)}); shots.push(`pack-row-${tag}.png`);
      }
      if (aliasKey) {
        await page.evaluate(k => { location.hash = k; }, aliasKey);            // hashchange, not a reload
        await page.waitForFunction(t => document.querySelector('.cr-dialog[open] .cr-modal-content h2')?.textContent === t, aliased.title, {timeout:5000}).catch(() => {});
        const v = await page.evaluate(() => { const v = document.querySelector('.cr-dialog[open] video'); return v && {bg:getComputedStyle(v).backgroundColor, fit:getComputedStyle(v).objectFit, title:document.querySelector('.cr-dialog .cr-modal-content h2')?.textContent}; });
        check(tag, `#${aliasKey} (an alias, by hashchange) opens ${aliased.id}, on black`, v && v.title === aliased.title && v.bg === 'rgb(0, 0, 0)' && v.fit === 'contain', JSON.stringify(v));
        await page.goto(fresh_(aliasKey));
        const direct = await page.waitForFunction(t => document.querySelector('.cr-dialog[open] .cr-modal-content h2')?.textContent === t, aliased.title, {timeout:5000}).then(() => true).catch(() => false);
        check(tag, `#${aliasKey} resolves on load`, direct);
        await page.keyboard.press('Escape');
      }
      // A malformed link (a stray %) opens nothing and leaves the page standing.
      const before = errors.length;
      await page.goto(fresh_('%E0%A4%A'));
      const standing = await page.waitForSelector('.cr-grid .cr-card', {timeout:5000}).then(() => true).catch(() => false);
      check(tag, 'a malformed # link (#%E0%A4%A) leaves the page standing, no dialog, no error', standing && !(await page.$('.cr-dialog[open]')) && errors.length === before, list(errors.slice(before)));
      const portrait = assets.find(a => L.isPortrait(a) && a.still && L.localPath(a.src)) || assets.find(a => L.isPortrait(a) && L.localPath(a.src));
      if (portrait) {
        await page.goto(fresh_(portrait.id));
        await page.waitForSelector('.cr-dialog[open] video.portrait');
        const pv = await page.$eval('.cr-dialog video', v => { const r = v.getBoundingClientRect(); return {w:r.width, h:r.height, bg:getComputedStyle(v).backgroundColor, poster:v.getAttribute('poster')}; });
        check(tag, `a portrait film (${portrait.title}) is pillarboxed on black, its 9:16 still as the poster`, pv.w > pv.h * 9 / 16 + 1 && pv.bg === 'rgb(0, 0, 0)' && pv.poster === (portrait.still || portrait.posterLarge || portrait.poster), JSON.stringify(pv));
        await page.screenshot({path:path.join(OUT, `video-${tag}.png`)}); shots.push(`video-${tag}.png`);
        await page.keyboard.press('Escape');
      }
      await noScroll('after the dialogs');

      // ---- export: same file, same key, entries gain kind and madeIn
      await page.goto(fresh_(''));
      await page.waitForSelector('.cr-grid .cr-card');
      const pick = [song, ladyPack, hero].filter(Boolean);
      for (const a of pick) {
        await page.click(`.cr-categories button:text-is("${a.category}")`);
        await page.click(`.cr-grid .cr-card[data-id="${a.id}"] .cr-bookmark`);
      }
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('.cr-export')]);
      const out = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
      check(tag, 'export: linkedin-beats-edit-shortlist.json, clips with kind and madeIn', download.suggestedFilename() === 'linkedin-beats-edit-shortlist.json' && Array.isArray(out.clips) && out.clips.length === pick.length && out.clips.every(c => L.KINDS.includes(c.kind) && Array.isArray(c.madeIn) && c.madeIn.length), JSON.stringify(out.clips.map(c => [c.kind, c.madeIn])));
      const stored = await page.evaluate(() => Object.keys(localStorage));
      check(tag, 'the shortlist still lives under lib-cutting-room-v1', stored.includes('lib-cutting-room-v1'), stored.join(', '));

      check(tag, `console: no errors but the stubbed R2 403s (${r2.length})`, !errors.length, list(errors, 4));
      await ctx.close();
    }
  } finally {
    await browser.close();
    await srv.close();
  }
  note('browser', `screenshots in ${OUT}: ${shots.join(', ')}`);
}
