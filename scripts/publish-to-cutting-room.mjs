#!/usr/bin/env node
// Publish a film, song or sound (or a pack of them) to the Cutting Room, /cutting-room/.
// Every finished piece goes through here, from this repository or from the Mac.
//
//   node scripts/publish-to-cutting-room.mjs <file> --title T --category C --made-in M --description D [options]
//   node scripts/publish-to-cutting-room.mjs --pack items.json --title T --category Sounds --made-in M --description D --group-label Voice
//
// What it does: probes the file; makes a web encode only when it needs one (a video that is H.264, AAC,
// 4:2:0, fast-start and 25 MiB or less is kept as it is; anything else gets a two-pass x264 encode to
// 25 MiB, the short side 1080, 720 or 540, whichever gives at least 0.05 bits per pixel; MP3 is never
// re-encoded; WAV, FLAC and AIFF become MP3 320k; other lossy audio MP3 192k, the original kept as the
// download); hashes it; copies it to public/cutting-room/{films,songs,sounds}/<slug>-<sha8>.<ext>
// (a file already in public/ stays where it is); makes the poster (a frame or a triptych for video,
// Peg Board type art and a cover for audio and packs); puts the record at the top of
// src/cutting-room/catalog.json; and runs scripts/check-cutting-room.mjs --static, undoing everything
// if it fails. Publishing the same file twice changes nothing. Needs ffmpeg and `npm install`.
//
// Required for a new record (a --replaces record inherits them):
//   --title T              "DELVE." "Circle Back (Drop Edition)": a parenthesis becomes the cover's second line
//   --category C           Finished films, Songs, Character performances, Office scenes, Screen inserts,
//                          Instruments, Sounds, Experiments (audio and packs: Songs or Sounds)
//   --made-in M            repeatable, the first is primary: Cutting Room originals, Studio and meeting
//                          rooms, Video Studio, All Hands, Claude Code films, Aaron's tracks (--source too)
//   --description D        one or two sentences, no em dashes
// Optional:
//   --cast A,B  --tags a,b  --transcript FILE|-  --notes N  --status S (Current edit; Source take is video only)
//   --ref R                provenance, kept in sourceReference (an encode adds its source's sha256 there)
//   --related ID           repeatable; linked both ways (a film and its song)
//   --alias ID             repeatable; another id that opens this record
//   --featured             the page's hero (a video; at most one record)
//   --download FILE        an original kept beside the web file (Aaron's WAV beside its MP3)
//   --poster IMG           repeatable: one image (a frame) or three (a triptych)
//   --poster-at S          a frame at S seconds
//   --poster-frames a,b,c  three frames (frame numbers, or seconds as 87.5s): a triptych
//   --cover-text T --cover-sub S   the type art's two lines (default: the title, and its parenthesis or "made in");
//                          a | in the text is a line break ("Studio 2|Song Kits")
//   --added YYYY-MM-DD     the day it was finished (default today); the newest four show as Just made
//   --max-mb N             a lower size cap for the encode, in MB (never above 25 MiB)
//   --replaces ID          a new cut: inherits every field not given; the old record becomes an Earlier
//                          version (replacedBy) and keeps its file; featured and related move to the new one
//   --pack ITEMS.json      a pack from [{file, text, group, name?}] (or {groupLabel, items}); with
//                          --group-label (Voice, Character, Agenda, Room, Song, Family, Film), --items-dir
//                          DIR (where items outside public/ go, under sounds/) and --item-bitrate (128k)
//   --r2                   store the media in R2 instead of the repository (needs CATALOG_UPLOAD_TOKEN in
//                          the environment; no 25 MiB cap: CRF 18 up to 300 MiB); --base URL (default
//                          https://linkedinbeats.com). The poster stays in the repository.
//   --dry-run              do the work in a scratch folder and print the record; write nothing
//   --no-check             skip the static check (not recommended)
//
//   node scripts/publish-to-cutting-room.mjs --refresh-art ID [--poster-frames a,b,c | --cover-text T --cover-sub S]
// draws a published record's art again (after the art code changes): its poster, the hero's 1280x720 and a
// portrait film's still, or an audio record's or pack's cover. The media file and the id stay as they are.
//
// A film's sound is measured as it ships: AAC is copied untouched (a second AAC generation overshoots),
// anything else becomes AAC 192k through a true-peak limiter. Its ceiling is -1 dBTP, or -0.1 dBTP for a
// film scored with one of Aaron's own tracks (--related to one); over it, nothing is written or uploaded.
// --limit-sound puts AAC through the limiter too (the picture of a web-ready file is kept as it is), for a
// film whose AAC overshoots and that has no master step of its own.
import process from 'node:process';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {publish, refreshArt} from './lib/cutting-room.mjs';

const VALUE = new Set(['title', 'category', 'made-in', 'source', 'description', 'cast', 'tags', 'transcript', 'notes', 'status', 'ref', 'related', 'alias',
  'download', 'poster', 'poster-at', 'poster-frames', 'cover-text', 'cover-sub', 'added', 'max-mb', 'replaces', 'pack', 'group-label', 'items-dir', 'item-bitrate', 'base', 'refresh-art']);
const FLAG = new Set(['featured', 'r2', 'dry-run', 'no-check', 'help', 'limit-sound']);
const REPEAT = new Set(['made-in', 'source', 'cast', 'tags', 'related', 'alias', 'poster']);

function parse(argv) {
  const opts = {}, files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { files.push(a); continue; }
    let [name, inline] = a.slice(2).split(/=(.*)/s);
    if (FLAG.has(name)) { opts[name] = true; continue; }
    if (!VALUE.has(name)) throw new Error(`unknown option --${name} (see the top of ${import.meta.url.split('/').pop()})`);
    const v = inline ?? argv[++i];
    if (v === undefined) throw new Error(`--${name} needs a value`);
    if (REPEAT.has(name)) (opts[name] ||= []).push(v); else opts[name] = v;
  }
  return {opts, files};
}
const csv = xs => xs?.flatMap(x => x.split(',')).map(s => s.trim()).filter(Boolean);

let parsed;
try { parsed = parse(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
const {opts:a, files} = parsed;
if (a.help || (!files.length && !a.pack && !a['refresh-art'])) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  process.exit(a.help ? 0 : 2);
}
if (files.length > 1 || (a.pack && files.length)) { console.error('one file at a time (or --pack with no file)'); process.exit(2); }
const readTranscript = t => t === undefined ? undefined : t === '-' ? fs.readFileSync(0, 'utf8').trim() : fs.readFileSync(t, 'utf8').trim();

const options = {
  title:a.title, category:a.category, madeIn:[...(a['made-in'] || []), ...(a.source || [])], description:a.description,
  cast:csv(a.cast), tags:csv(a.tags), transcript:readTranscript(a.transcript), notes:a.notes, status:a.status, ref:a.ref,
  related:csv(a.related), aliases:csv(a.alias), featured:a.featured, download:a.download, posters:a.poster,
  posterAt:a['poster-at'], posterFrames:csv(a['poster-frames'] ? [a['poster-frames']] : undefined), coverText:a['cover-text'], coverSub:a['cover-sub'],
  added:a.added, maxMb:a['max-mb'] ? Number(a['max-mb']) : undefined, replaces:a.replaces, pack:a.pack, groupLabel:a['group-label'],
  itemsDir:a['items-dir'], itemBitrate:a['item-bitrate'], r2:a.r2, base:a.base, dryRun:a['dry-run'], check:!a['no-check'], limitSound:a['limit-sound'],
  log:m => console.log(m),
};
if (a['refresh-art']) {
  if (files.length || a.pack) { console.error('--refresh-art takes a record id, not a file'); process.exit(2); }
  try {
    const r = await refreshArt(a['refresh-art'], options);
    console.log(`${r.status === 'dry-run' ? 'would redraw' : 'redrew'}: ${r.id} (${r.record.art} art)`);
    for (const f of r.files) console.log(`  ${r.status === 'dry-run' ? 'would write' : 'wrote'} ${f}`);
  } catch (e) { console.error(`publish-to-cutting-room: ${e.message}`); process.exit(1); }
  process.exit(0);
}
try {
  const r = await publish(files[0], options);
  if (r.status === 'unchanged') { console.log(`unchanged: ${r.id} already has this ${a.pack ? 'pack' : 'file'}`); process.exit(0); }
  const rec = r.record;
  console.log(`${r.status === 'dry-run' ? 'would publish' : 'published'}: ${rec.id}`);
  console.log(`  ${rec.title} | ${rec.kind} | ${rec.category} | ${rec.madeIn.join(', ')} | ${rec.status} | ${rec.bytes} bytes | ${r.how}`);
  console.log(`  src ${rec.src}${rec.download && rec.download !== rec.src ? `\n  download ${rec.download}` : ''}`);
  if (rec.replaces) console.log(`  replaces ${rec.replaces} (now an Earlier version)`);
  for (const f of r.files) console.log(`  ${r.status === 'dry-run' ? 'would write' : 'wrote'} ${f}`);
  if (r.status === 'dry-run') console.log(JSON.stringify(rec, null, 1));
  // The homepage gallery leads with the newest finished films, so a new one goes straight onto it.
  else if (spawnSync(process.execPath, [new URL('./sync-home-gallery.mjs', import.meta.url).pathname], {stdio:'inherit'}).status !== 0) {
    console.error('publish-to-cutting-room: published, but the homepage gallery was not updated; run node scripts/sync-home-gallery.mjs');
  }
} catch (e) {
  console.error(`publish-to-cutting-room: ${e.message}`);
  process.exit(1);
}
