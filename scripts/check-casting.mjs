// Casting: the post picks its song, the lady's lines and the band's vocabulary
// (src/allhands/casting.js, src/allhands/vocabulary/lexicon.json, takes.js).
//   1. The role table (lady-roles.json): all 57 recordings, every cut inside
//      her measured words, displays the Peg Board and Pixel Text can draw,
//      `tracks` exactly where casting.js fits() says the cut plays whole.
//   2. The band's takes (vocabulary/takes.js): every id resolves to lexicon.json,
//      every lady line of the bank sits on her measured words, every display draws.
//   3. The sample post and the 60 fixture posts, hash only and with a recent
//      history, and with every track forced: every part valid (the take exists
//      in lexicon.json and the voice bank's naming; Synthia only short, clear
//      words; the lady's files and words exist), no recording or lexicon id
//      twice, "Let's circle back" at most once, deterministic, fast.
//   4. The lexicon's rotation limits over the corpus (lexicon.json casting.caps):
//      distinct ladders, drops and refrains, the top line's share per slot,
//      "Let's build." and "Let's circle- BACK." counts, couplet spread; and the
//      distribution reported. With a history: the same limits, wider spread.
//   5. The rules: sensitive posts (no couplet in the drop; only meetings and
//      metrics couplets), layoff couplets only on layoff posts, the sample on the
//      new vocabulary, the why line names the couplet or the refrain, the voice
//      bank's `available` set moves a line of Synthia's to Strategy.
//   6. Arranged (two duration models): the plan plays every cast cut whole,
//      the silence before the impact holds, the Peg Board and the Pixel Text
//      export time her words from the measured boundaries.
// With a dev server: --page --url http://localhost:6021 checks that /allhands/
// casts all 61 posts exactly as Node does and shows the why line; --render
// --out <dir> renders nine fixture posts end to end (scripts/render-allhands.mjs,
// measure-allhands.py, Whisper on every lady moment) and saves MP3s.
import assert from 'node:assert/strict';
import {readFileSync, existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {castSong, castFiles, fits, settleCast, LIMITS, CONCEPTS, ROLE_ORDER, MIX_MIN, ROTATION, BAND_SLOTS, LADY_ROTATION, LADY_SLOTS, ladyKey} from '../src/allhands/casting.js';
import {AVAILABLE, voicesFor} from '../src/allhands/voices/voice-table.js';
import {TAKES, takeOf, takeKey, clearFor, SYNTHIA} from '../src/allhands/vocabulary/takes.js';
import {TRACKS, TRACK_ORDER, DEFAULT_TRACK, DEFAULT_CAST, LADY_ROLES, BAND_ROLES, castOf} from '../src/allhands/songbook/index.js';
import {arrangeDrop, dropVoicedWords} from '../src/allhands/drop.js';
import {LADY_TABLE, slice} from '../src/allhands/lady-table.js';
// Her recordings and the voice bank's takes (a couplet drop's tag and impact are Synthia's or Strategy's).
import {SONG_TABLE, RELEASE} from '../src/allhands/band.js';
import {lyricsFromPost, SAMPLE_POST, syllables} from '../src/allhands/lyrics.js';
import {buildScreens} from '../src/pegboard/choreo.js';
import {compileFont, layoutText, CHARSET} from '../src/pegboard/font.js';
import {PEG9} from '../src/pegboard/fonts/peg9.js';
import {PEG5} from '../src/pegboard/fonts/peg5.js';
import {PIXEL_GLYPHS, ladyCueSources, planTimeOf, pixelText} from '../src/allhands/pixel-export.js';

const ROOT = new URL('..', import.meta.url).pathname;
let checks = 0;
const ok = (v, m) => { assert.ok(v, m); checks++; };
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const ROLES = JSON.parse(readFileSync(join(ROOT, 'src/allhands/lady-roles.json'), 'utf8'));
const MEASURED = JSON.parse(readFileSync(join(ROOT, 'src/allhands/lady-phrases.json'), 'utf8'));
const LEXICON = JSON.parse(readFileSync(join(ROOT, 'src/allhands/vocabulary/lexicon.json'), 'utf8'));
const IMPACT_HEARD = JSON.parse(readFileSync(join(ROOT, 'src/allhands/vocabulary/impact-heard.json'), 'utf8'));
const FIXTURES = JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/pixel-posts.json'), 'utf8')).map(x => x.post);
const POSTS = [SAMPLE_POST, ...FIXTURES];
const label = i => (i === 0 ? 'sample' : `fixture ${i - 1}`);
const json = x => JSON.stringify(x, (k, v) => v instanceof Float64Array ? Array.from(v) : v);
const norm = (entry, i) => (i < 0 ? entry.words.length + i : i);
const faces = [compileFont(PEG9), compileFont(PEG5)];
const drawable = text => [...text].every(c => c === ' ' || (PIXEL_GLYPHS.has(c) && CHARSET.has(c)));
const fitsBoard = text => faces.some(font => { const l = layoutText(text, {font, k:1, maxCols:116, maxLines:3}); return l.width <= 116 && l.height <= 41; });
const CAPS = LEXICON.casting.caps.corpus;
const tally = (rs, f) => { const m = new Map(); for (const r of rs) for (const k of [].concat(f(r)).filter(x => x !== null && x !== undefined)) m.set(k, (m.get(k) || 0) + 1); return [...m].sort((a, b) => b[1] - a[1]); };

// ---- 1. The role table
ok(ROLES.phrases.length === 57 && MEASURED.length === 57, 'role table: all 57 recordings');
const roleCount = {}, trackCount = Object.fromEntries(TRACK_ORDER.map(t => [t, {}]));
let cuts = 0;
for (const p of ROLES.phrases) {
  const m = MEASURED.find(e => e.file === p.file), entry = LADY_TABLE[p.file];
  ok(m && entry && m.text === p.text, `role table: ${p.file} is "${m?.text}"`);
  ok(existsSync(join(ROOT, 'public/phrases', p.file)), `role table: public/phrases/${p.file} exists`);
  ok(p.topics.length && p.topics.every(t => CONCEPTS[t]), `role table: ${p.file} topics are concepts (${p.topics})`);
  ok(p.keywords.length >= 1, `role table: ${p.file} has keywords`);
  for (const [role, list] of Object.entries(p.roles)) {
    ok(ROLE_ORDER.includes(role), `role table: ${p.file} role ${role}`);
    for (const c of list) {
      cuts++;
      const [a, b] = c.words, n = entry.words.length, tag = `${p.file} ${role} ${c.display}`;
      ok(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b < n && a <= b, `${tag}: words ${a}-${b} inside ${n} measured words`);
      ok(c.display.split(' ').length === b - a + 1, `${tag}: one display word per measured word`);
      ok(drawable(c.display) && fitsBoard(c.display) && pixelText(c.display) === c.display, `${tag}: the Peg Board and Pixel Text draw it as is`);
      if (role === 'tag') {
        ok(c.impact[0] === b + 1 && c.impact[1] === b + 1 && c.impactDisplay.split(' ').length === 1 && drawable(c.impactDisplay), `${tag}: the impact is the next word`);
        ok(c.display.endsWith('-'), `${tag}: the tag is cut off`);
      }
      if (role === 'sink') ok(c.split > a && c.split <= b, `${tag}: sink split ${c.split}`);
      if (c.couplet) ok(role === 'ladder' && ['22.wav', '09.wav'].includes(p.file) && c.display === "IT'S NOT" && c.heard === "It's not", `${tag}: the couplet's ladder, "It's not", heard as said`);
      const want = c.default ? TRACK_ORDER : TRACK_ORDER.filter(t => fits(role, {file:p.file, ...c}, t).ok);
      ok(json(c.tracks) === json(want) && c.tracks.length, `${tag}: tracks ${c.tracks} match fits() ${want}`);
      if (c.default) ok(DEFAULT_CAST[role].file === p.file && json(DEFAULT_CAST[role].words.map(i => norm(entry, i))) === json(c.words), `${tag}: today's line`);
      roleCount[role] = (roleCount[role] || 0) + 1;
      for (const t of c.tracks) trackCount[t][role] = (trackCount[t][role] || 0) + 1;
    }
  }
}
for (const role of ROLE_ORDER) ok(ROLES.phrases.some(p => p.roles[role]?.some(c => c.default)), `role table: today's ${role} is in the table`);
const playable = ROLES.phrases.filter(p => Object.keys(p.roles).length).length;
console.log(`role table: ${cuts} cuts over ${playable}/57 recordings; per role ${JSON.stringify(roleCount)}`);
for (const t of TRACK_ORDER) console.log(`  fits ${t}: ${JSON.stringify(trackCount[t])}`);

// What Whisper heard in each cut alone (lady-roles.json `heard`), as a summary.
{
  const words = s => s.toLowerCase().replace(/[-‐-—]/g, ' ').replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean).map(w => w.replace(/^'|'$/g, ''));
  let heard = 0, exact = 0, contains = 0;
  for (const p of ROLES.phrases) for (const list of Object.values(p.roles)) for (const c of list) for (const [h, text] of [[c.heard, c.display], [c.impactHeard, c.impactDisplay]]) {
    if (h === undefined || text === undefined) continue;
    heard++;
    const want = words(text), got = words(h);
    if (json(want) === json(got)) exact++;
    else if (want.every(w => got.includes(w))) contains++;
  }
  console.log(`Whisper on the cuts alone: ${heard} heard, ${exact} exact, ${contains} more with every word present`);
  const mix = {};
  for (const p of ROLES.phrases) for (const role of ['tag', 'sink']) for (const c of p.roles[role] || []) {
    for (const t of c.tracks) { const k = `${role} ${t}`; mix[k] ||= {measured:0, castable:0, whole:0}; const m = c.mix?.[t]; if (!m) continue; mix[k].measured++; if (m.recall >= MIX_MIN) mix[k].castable++; if (m.recall === 1) mix[k].whole++; }
    ok(c.tracks.every(t => c.mix?.[t]), `${p.file} ${role} ${c.display}: heard in the mix on every track it fits`);
  }
  console.log(`Whisper in the mix (two bars, every track a cut fits): ${Object.entries(mix).map(([k, v]) => `${k} ${v.whole}/${v.castable}/${v.measured}`).join(', ')} (every word / at least ${MIX_MIN * 100}% / measured)`);
}

// ---- 2. The band's takes and the lady's lines of the lexicon
const BANK = Object.fromEntries(LEXICON.bank.map(b => [b.id, b])), COUPLETS = Object.fromEntries(LEXICON.couplets.map(c => [c.id, c]));
const RECORDED = Object.fromEntries(LEXICON.recordedCouplets.map(c => [c.id, c]));
const inLexicon = t => {
  const f = t.from;
  if (f.bank) return BANK[f.bank]?.voice === t.voice && BANK[f.bank].text === t.text && BANK[f.bank].display === t.display;
  if (f.couplet) { const c = COUPLETS[f.couplet]; if (!c) return false;
    return f.part === 'x' ? t.text === `It's not ${c.x}.` && t.display === c.display[0] : f.part === 'y' ? t.text === `It's ${c.y}.` && t.display === c.display[1]
      : f.part === 'tag' ? t.text === c.drop.tag && t.display === c.drop.tagDisplay : f.part === 'impact' ? t.text === c.drop.impact && t.display === c.drop.impactDisplay : false; }
  if (f.exchange !== undefined) { const s = LEXICON.exchanges[f.exchange]?.[f.side]; return !!s && !s.id && s.voice === t.voice && s.text === t.text; }
  if (f.frame) return LEXICON.renderQueue.lines.synthia.includes(f.frame) && t.text === f.frame;
  return false;
};
for (const t of TAKES.values()) {
  ok(['strategy', 'synthia'].includes(t.voice) && inLexicon(t), `take ${t.id}: from lexicon.json (${JSON.stringify(t.from)})`);
  ok(drawable(t.display) && fitsBoard(t.display), `take ${t.id}: "${t.display}" draws on the Peg Board`);
}
const ladyLines = LEXICON.bank.filter(b => b.voice === 'lady');
for (const b of ladyLines) {
  const entry = LADY_TABLE[b.lady.file], [a, z] = b.lady.words;
  ok(entry && existsSync(join(ROOT, 'public/phrases', b.lady.file)) && a >= 0 && z < entry.words.length && a <= z, `lexicon ${b.id}: ${b.lady.file} words ${a}-${z} are hers`);
  ok(b.display.split(' ').length === z - a + 1 && drawable(b.display), `lexicon ${b.id}: one display word per measured word ("${b.display}")`);
}
for (const c of LEXICON.couplets.filter(c => c.lady)) ok(LADY_TABLE[c.lady.file] && c.lady.words[1] < LADY_TABLE[c.lady.file].words.length, `couplet ${c.id}: her Y ${c.lady.file} ${c.lady.words}`);
const byKind = [...TAKES.values()].reduce((m, t) => (m[`${t.voice} ${t.kind}`] = (m[`${t.voice} ${t.kind}`] || 0) + 1, m), {});
const unclear = [...TAKES.values()].filter(t => t.voice === 'synthia' && !clearFor(t));
console.log(`takes: ${TAKES.size} (${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(', ')}); ${unclear.length} of Synthia's are not short, clear words (over ${SYNTHIA.max} syllables or ${SYNTHIA.unclear.join('/')}): Strategy sings them`);
console.log(`lexicon: ${LEXICON.bank.length} expressions (${ladyLines.length} hers, on her measured words), ${LEXICON.couplets.length} couplets + ${LEXICON.recordedCouplets.length} recorded, ${LEXICON.exchanges.length} exchanges`);

// ---- 3. Every post: valid, deterministic, fast
const roleEntry = (role, file, w) => ROLES.phrases.find(p => p.file === file)?.roles[role]?.find(c => c.words[0] === w[0] && c.words[1] === w[1]);
function validCast(r, where) {
  ok(TRACK_ORDER.includes(r.track), `${where}: track ${r.track}`);
  const cast = castOf(r.cast);
  ok(LADY_ROLES.every(role => cast[role]), `${where}: every role is cast`);
  const files = new Map();
  for (const role of LADY_ROLES) {
    const c = cast[role], entry = LADY_TABLE[c.file];
    ok(entry && existsSync(join(ROOT, 'public/phrases', c.file)), `${where} ${role}: ${c.file} exists`);
    const [a, b] = c.words.map(i => norm(entry, i));
    ok(a >= 0 && b < entry.words.length && a <= b, `${where} ${role}: words ${a}-${b} inside the measured words`);
    ok(typeof c.display === 'string' && c.display.split(' ').length === b - a + 1 && drawable(c.display), `${where} ${role}: display "${c.display}"`);
    const isDefault = DEFAULT_CAST[role].file === c.file && json(DEFAULT_CAST[role].words.map(i => norm(entry, i))) === json([a, b]);
    if (role !== 'impact' && !isDefault) {
      const cand = {file:c.file, words:[a, b], display:c.display};
      if (role === 'tag') Object.assign(cand, {impact:[norm(LADY_TABLE[cast.impact.file], cast.impact.words[0]), norm(LADY_TABLE[cast.impact.file], cast.impact.words[1])], impactSyllables:roleEntry('tag', c.file, [a, b])?.impactSyllables});
      if (role === 'bend' || role === 'lift') cand.syllables = roleEntry(role, c.file, [a, b])?.syllables;
      if (role === 'sink') cand.split = a + c.split;
      const f = fits(role, cand, r.track);
      ok(f.ok, `${where} ${role} "${c.display}" on ${r.track}: ${f.why || 'fits'}`);
      ok(roleEntry(role, c.file, [a, b]), `${where} ${role}: a role-table cut`);
      // Heard in the mix: a recast tag or sink Whisper follows in two bars of this song.
      const heard = roleEntry(role, c.file, [a, b])?.mix?.[r.track]?.recall;
      if (role === 'tag' || role === 'sink') ok(heard === undefined || heard >= MIX_MIN, `${where} ${role} "${c.display}": heard in the ${r.track} mix (${heard})`);
      if (role === 'ladder' && roleEntry('ladder', c.file, [a, b])?.couplet) ok(r.cast.dropTag.kind === 'couplet', `${where}: "It's not" climbs only to a couplet's drop`);
      // Her moments rotate, and only lines that keep the role's music play them (casting.js LADY_ROTATION).
      if (LADY_SLOTS.includes(role)) {
        const e = roleEntry(role, c.file, [a, b]);
        ok(e.craft >= LADY_ROTATION.floor[role], `${where} ${role} "${c.display}": craft ${e.craft} plays the role (at least ${LADY_ROTATION.floor[role]})`);
        if (role === 'sink') ok((e.mix?.[r.track]?.recall ?? 1) >= LADY_ROTATION.sinkRecall, `${where} sink "${c.display}": read at half speed in the ${r.track} mix (${e.mix?.[r.track]?.recall})`);
      }
    }
    if (role !== 'impact') { ok(!files.has(c.file), `${where}: ${c.file} cast twice (${files.get(c.file)}, ${role})`); files.set(c.file, role); }
  }
  ok(cast.impact.file === cast.tag.file && norm(LADY_TABLE[cast.tag.file], cast.impact.words[0]) === norm(LADY_TABLE[cast.tag.file], cast.tag.words[1]) + 1 && cast.impact.words[0] === cast.impact.words[1], `${where}: the impact is the tag's next word`);
  ok(typeof r.line === 'string' && r.line.length > 10 && r.line.length < 180 && !/[—\n]/.test(r.line), `${where}: one line of copy, no em dash: ${r.line}`);
  ok(Array.isArray(r.why.track) && r.why.track.length && LADY_ROLES.every(role => r.why.lady[role]?.length), `${where}: reasons for the track and every role`);
  return cast;
}

// A band part: Strategy's or Synthia's take (its id in takes.js, so in lexicon.json), the lady's file and words, or Synergy's text.
function validPart(p, where, {stab = false, lead = false} = {}) {
  ok(p && typeof p.text === 'string' && p.text && typeof p.display === 'string' && drawable(p.display) && fitsBoard(p.display), `${where}: text and a display the board draws (${p?.display})`);
  if (p.voice === 'lady') {
    const entry = LADY_TABLE[p.file];
    ok(entry && existsSync(join(ROOT, 'public/phrases', p.file)) && !p.id, `${where}: her recording ${p.file}`);
    const [a, b] = p.words;
    ok(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && a <= b && b < entry.words.length, `${where}: her words ${a}-${b} of ${p.file}`);
    ok(p.display.split(' ').length === b - a + 1, `${where}: one display word per measured word ("${p.display}", ${p.file} ${a}-${b})`);
    return;
  }
  if (p.voice === 'synergy') { ok(p.text === "Let's circle back" && !p.id && !p.file, `${where}: Synergy sings only Circle Back's sign-off`); return; }
  const t = takeOf(p.id);
  ok(['strategy', 'synthia'].includes(p.voice) && t && !p.file, `${where}: take ${p.id} in takes.js`);
  ok(t.text === p.text && t.display === p.display, `${where}: ${p.id} says what the lexicon says ("${t.text}")`);
  // Strategy may sing any line (the voice bank renders every line in his voice); Synthia only her own, short and clear.
  // (or a line of his the bank has only in her voice, voicesFor: she answers with it, short and clear)
  const hers = t.voice === 'synthia' || (json(voicesFor(p.id)) === json(['synthia']) && !lead);
  ok(p.voice === 'strategy' || (hers && clearFor({...t, voice:'synthia'}, {stab})), `${where}: ${p.voice} sings "${p.text}" (the lexicon's ${t.voice}${p.voice === 'synthia' ? ', short and clear' : ''})`);
}

function validBand(r, where, {available} = {}) {
  const c = r.cast, f = r.flags;
  ok(BAND_ROLES.every(k => k in c) && json(castOf(c).couplet) === json(c.couplet), `${where}: the band's parts ride in the cast (castOf passes them through)`);
  const parts = [];
  const add = (slot, p, how) => { validPart(p, `${where} ${slot}`, how); parts.push([slot, p]); if (p.pickup) { ok(p.voice === 'lady' && ['its', 'its-a'].includes(p.pickup.id), `${where} ${slot}: Synthia's pickup before her word`); validPart(p.pickup, `${where} ${slot} pickup`); parts.push([`${slot} pickup`, p.pickup]); } };
  // The couplet: "It's not X." and "It's Y.", from lexicon.json.
  if (c.couplet) {
    const lex = COUPLETS[c.couplet.id], rec = RECORDED[c.couplet.id];
    ok(lex || rec, `${where}: couplet ${c.couplet.id} in lexicon.json`);
    const topics = lex ? lex.topics : LEXICON.bank.find(b => b.lady?.file === rec.lady.file && b.roles.includes('couplet')).topics;
    ok(topics.includes(c.couplet.topic) && c.couplet.line === (lex ? lex.line : rec.text), `${where}: couplet topic ${c.couplet.topic}, "${c.couplet.line}"`);
    if (lex) ok(c.couplet.x.id === `${lex.id}-call` && (lex.lady ? c.couplet.y.file === lex.lady.file && json(c.couplet.y.words) === json(lex.lady.words) : c.couplet.y.id === `${lex.id}-response`), `${where}: the couplet's X and Y are its takes`);
    else ok(c.couplet.x.file === rec.x.file && json(c.couplet.x.words) === json(rec.x.words) && json(c.couplet.y.words) === json(rec.y.words), `${where}: her recorded couplet, X and Y on her words`);
    ok(!topics.includes('layoffs') || f.layoffs, `${where}: a layoff couplet only on a layoff or restructuring post (${c.couplet.id})`);
    ok(!f.sensitive || topics.every(t => t === 'meetings' || t === 'metrics'), `${where}: a post about family, health or grief gets only meetings and metrics couplets (${c.couplet.id})`);
    add('couplet x', c.couplet.x); add('couplet y', c.couplet.y);
  }
  // The drop: her tag (as cast.tag and cast.impact), or the couplet's.
  const d = c.dropTag;
  ok(d && (d.kind === 'lady' || d.kind === 'couplet'), `${where}: dropTag kind ${d?.kind}`);
  if (d.kind === 'lady') ok(d.tag.file === c.tag.file && json(d.tag.words) === json(c.tag.words) && d.impact.file === c.impact.file && json(d.impact.words) === json(c.impact.words) && d.tag.display === c.tag.display && d.impact.display === c.impact.display, `${where}: her drop is her tag and its impact`);
  else {
    const lex = COUPLETS[d.id];
    ok(lex && d.id === c.couplet?.id && lex.drop.tracks.includes(r.track) && json(d.x) === json(c.couplet.x), `${where}: the drop is the couplet's (${d.id}), on a track it fits`);
    ok(!f.sensitive, `${where}: no couplet in a sensitive post's drop`);
    ok(d.tag.id === `${d.id}-tag` && d.tag.display === lex.drop.tagDisplay && /-$/.test(d.tag.display), `${where}: the drop's lead-in "${d.tag.display}"`);
    ok(lex.drop.impactVoice === 'lady' ? d.impact.file === lex.lady.file && d.impact.words[0] === lex.lady.words[1] && d.impact.words[0] === d.impact.words[1] : d.impact.id === `${d.id}-impact`, `${where}: the impact is the couplet's Y word ("${d.impact.display}")`);
    ok(d.impact.display.split(' ').length === 1 && lex.drop.impactSyllables <= 2, `${where}: one impact word of one or two syllables`);
    // The drop lands as a word: Whisper heard this impact, in this voice, in this track's mix (scripts/measure-impacts.mjs).
    const heard = IMPACT_HEARD.tracks[r.track];
    if (heard) ok(heard[d.id]?.[d.impact.voice]?.ok && (d.tag.voice === d.impact.voice || d.impact.voice === 'lady'), `${where}: the impact "${d.impact.display}" in ${d.impact.voice}'s voice was heard in the ${r.track} mix (${JSON.stringify(heard[d.id]?.[d.impact.voice]?.heard)})`);
    add('drop tag', d.tag); add('drop impact', d.impact);
  }
  ok(c.refrain && c.signoff, `${where}: a refrain and a sign-off`);
  add('refrain', c.refrain, {lead:true}); add('signoff', c.signoff);
  ok(c.refrain.voice !== 'synthia', `${where}: Synthia leads no refrain`);
  if (c.signoff.voice === 'synergy') ok(r.track === 'circle-back', `${where}: Synergy's "Let's circle back" only in Circle Back`);
  ok(c.exchanges.length >= 1 && c.exchanges.length <= ROTATION.exchanges, `${where}: ${c.exchanges.length} exchanges`);
  for (const [k, x] of c.exchanges.entries()) {
    ok(x.call.voice !== 'synthia' && (x.call.voice === 'lady' || x.call.voice !== x.response.voice), `${where}: exchange ${k}, ${x.call.voice} calls and ${x.response.voice} answers`);
    add(`call ${k}`, x.call, {lead:true}); add(`response ${k}`, x.response);
  }
  ok(c.stabs.length === ROTATION.stabs, `${where}: ${c.stabs.length} stabs`);
  for (const [k, s] of c.stabs.entries()) add(`stab ${k}`, s, {stab:true});
  // No recording twice (the drop's impact is the couplet's own Y; her answer to herself is one recording).
  const owner = new Map();
  for (const role of LADY_ROLES) if (role !== 'impact') owner.set(c[role].file, role);
  for (const [slot, p] of parts) {
    if (!p.file) continue;
    const group = slot.split(' ')[0] === 'drop' ? 'couplet' : slot.replace(/^(call|response) /, 'exchange ').replace(/ pickup$/, '').replace(/^couplet [xy]$/, 'couplet');
    const had = owner.get(p.file);
    ok(!had || had === group || (slot === 'drop impact' && had === 'couplet'), `${where}: ${p.file} twice (${had}, ${slot})`);
    owner.set(p.file, had ?? group);
  }
  ok(json([...new Set(castFiles(c))].sort()) === json([...owner.keys()].sort()), `${where}: castFiles names every recording the cast uses`);
  // No lexicon line twice.
  const ids = parts.filter(([s]) => !/^drop|pickup$/.test(s)).map(([, p]) => p.id).filter(Boolean);
  ok(new Set(ids).size === ids.length, `${where}: no take twice (${ids.join(', ')})`);
  const keys = [r.keys.refrain, r.keys.signoff, ...r.keys.stabs];
  ok(new Set(keys).size === keys.length, `${where}: no lexicon id twice (${keys.join(', ')})`);
  // The retired lines: "Let's build." only on a post about building (not its hook's echo); "Let's circle back" at most once, in Circle Back's title or where the post says it.
  const all = [...LADY_ROLES.map(role => c[role]), ...parts.map(([, p]) => p)];
  ok(!all.some(p => p.file === '50.wav') || f.building, `${where}: "Let's build." only on a post about building`);
  const circles = (all.some(p => p.file === '06.wav') ? 1 : 0) + (c.signoff.voice === 'synergy' ? 1 : 0);
  ok(circles <= 1, `${where}: "Let's circle back" at most once`);
  ok(!all.some(p => p.file === '06.wav') || f.title || f.circleBack, `${where}: her "Let's circle back" only as Circle Back's title or where the post says it`);
  if (f.title) ok(r.track === 'circle-back' && d.kind === 'lady' && c.tag.file === '06.wav', `${where}: the title drop is "Let's circle- BACK."`);
  // The keys: what the next song's freshness reads.
  ok(BAND_SLOTS.every(s => s in r.keys) && r.keys.drop === (d.kind === 'couplet' ? `couplet:${d.id}` : `tag:${c.tag.file}`), `${where}: keys for every slot`);
  ok(BAND_SLOTS.every(s => r.why.band[s]?.length), `${where}: reasons for every band slot`);
  // The why line names the couplet, or (a sensitive post, a goodbye) the refrain.
  const gentle = f.sensitive || (r.track === 'humbled-and-honored' && /Grateful for this journey\.$/.test(r.line)) || !c.couplet;
  ok(gentle ? (r.line.includes(`refrain: ${c.refrain.text.replace(/[,;:]$/, '')}`) || /journey/i.test(c.refrain.text)) : r.line.endsWith(` ${c.couplet.line}`), `${where}: the line names the ${gentle ? 'refrain' : 'couplet'}: ${r.line}`);
  ok(!/[“”]/.test(r.line.replace(/“[^”]*”/g, '')), `${where}: the band's words are not quoted as the post's`);
  if (available) for (const [slot, p] of parts) if (p.id) ok(available.has(takeKey(p)), `${where} ${slot}: ${takeKey(p)} is in the voice bank`);
  return parts;
}

const results = [], forced = [], dist = Object.fromEntries(TRACK_ORDER.map(t => [t, 0])), recasts = {}, times = [], raw = [];
castSong(POSTS[1]);                                             // warm the JIT once
POSTS.forEach((post, i) => {
  // Best of three: a shared machine's scheduler and GC pauses are not castSong's.
  let r, ms = Infinity;
  for (let k = 0; k < 3; k++) { const t0 = performance.now(); r = castSong(post); const d = performance.now() - t0; ms = Math.min(ms, d); raw.push(d); }
  times.push(ms);
  validCast(r, label(i)); validBand(r, label(i));
  ok(json(castSong(post)) === json(r) && json(castSong(post, {seed:0})) === json(r) && json(castSong(post, {recent:[]})) === json(r), `${label(i)}: deterministic`);
  dist[r.track]++;
  for (const role of r.recast) recasts[role] = (recasts[role] || 0) + 1;
  results.push(r);
  // The manual picker: every track casts validly for every post.
  for (const t of TRACK_ORDER) { const f = castSong(post, {track:t}); ok(f.track === t, `${label(i)} forced ${t}`); validCast(f, `${label(i)} forced ${t}`); validBand(f, `${label(i)} forced ${t}`); forced.push(f); }
});
// With a history: the corpus cast in order, each song seeing the ones before it.
const history = [], withHistory = [];
POSTS.forEach((post, i) => {
  const r = castSong(post, {recent:history});
  validCast(r, `${label(i)} (history)`); validBand(r, `${label(i)} (history)`);
  ok(json(castSong(post, {recent:history.slice()})) === json(r) && json(castSong(post, {recent:history.map(k => ({keys:k}))})) === json(r), `${label(i)} (history): deterministic, from keys or results`);
  withHistory.push(r); history.push(r.keys);
});
times.sort((a, b) => a - b);
const seeds = POSTS.filter(p => json(castSong(p, {seed:1})) !== json(castSong(p))).length;
console.log(`casts: ${POSTS.length} posts valid, hash only and with history, plus ${POSTS.length * TRACK_ORDER.length} with the track forced; ${seeds} change with seed 1`);
raw.sort((a, b) => a - b);
console.log(`speed (best of three per post, warm): median ${times[times.length >> 1].toFixed(2)} ms, max ${times.at(-1).toFixed(2)} ms; every run: p95 ${raw[Math.floor(raw.length * .95)].toFixed(2)} ms, worst ${raw.at(-1).toFixed(2)} ms`);
ok(times.at(-1) < 20, `castSong under 20 ms (max ${times.at(-1).toFixed(2)})`);
const fixtureDist = Object.fromEntries(TRACK_ORDER.map(t => [t, results.slice(1).filter(r => r.track === t).length]));
console.log(`tracks over the 60 fixtures: ${JSON.stringify(fixtureDist)}; with the sample ${JSON.stringify(dist)}`);
ok(TRACK_ORDER.every(t => fixtureDist[t] >= 6 && fixtureDist[t] <= 42), 'track distribution is not degenerate (each 10-70%)');
// Offsite takes the team retreat, the work family, belonging, wellness and good vibes, for the post's own words.
for (const [i, cue] of [[15, /“offsite”/], [47, /“not a company”/], [24, /“Morale Officer”/], [50, /“4-day work week”/], [46, /“Emotional Intelligence”/]]) {
  const r = results[i + 1];
  ok(r.track === 'offsite' && cue.test(r.line) && r.line.startsWith('Offsite, for '), `fixture ${i}: Offsite, ${r.line}`);
}
const recastTotal = Object.values(recasts).reduce((a, b) => a + b, 0), untouched = results.filter(r => !r.recast.length).length;
console.log(`her roles recast from today's: ${recastTotal} over ${POSTS.length} posts (${(recastTotal / POSTS.length).toFixed(2)} a post; ${untouched} keep today's cast): ${JSON.stringify(recasts)}`);
ok(ROLE_ORDER.every(role => recasts[role] >= 1), 'every role is recast for some post');
const fallback = results.filter(r => r.why.track[0].startsWith('nothing decisive')).length;
console.log(`fallback to Circle Back (nothing decisive): ${fallback}`);

// ---- 4. The lexicon's rotation limits (lexicon.json casting.caps.corpus), hash only and with history
function corpus(rs, name) {
  const t = slot => tally(rs, r => r.keys[slot]);
  const cb = rs.filter(r => r.track === 'circle-back'), title = rs.filter(r => r.cast.dropTag.kind === 'lady' && r.cast.tag.file === '06.wav');
  const build = rs.filter(r => castFiles(r.cast).includes('50.wav'));
  const couplets = t('couplet'), files = tally(rs, r => [...new Set(castFiles(r.cast))]);
  const backToBack = slot => rs.filter((r, k) => k && [].concat(r.keys[slot]).some(x => [].concat(rs[k - 1].keys[slot]).includes(x))).length;
  const s = {ladderMax:t('ladder')[0][1], dropMax:t('drop')[0][1], refrainMax:t('refrain')[0][1], coupletMax:couplets[0][1], signoffMax:t('signoff')[0][1],
    ladderDistinct:t('ladder').length, dropDistinct:t('drop').length, refrainDistinct:t('refrain').length, letsBuild:build.length,
    circleBackTitle:title.length, circleBackSongs:cb.length, coupletDrops:rs.filter(r => r.cast.dropTag.kind === 'couplet').length, itsNot:rs.filter(r => r.flags.itsNot).length,
    couplets:couplets.length, signoffDistinct:t('signoff').length, exchangeDistinct:t('exchanges').length, stabDistinct:t('stabs').length,
    recordings:files.length, sameDropRunning:backToBack('drop'), sameRefrainRunning:backToBack('refrain'), synergySignoff:rs.filter(r => r.cast.signoff.voice === 'synergy').length};
  console.log(`\n${name}:`);
  for (const slot of BAND_SLOTS) { const x = t(slot); console.log(`  ${slot.padEnd(9)} ${String(x.length).padStart(2)} distinct; top ${x.slice(0, 4).map(([k, n]) => `${k} ${n}`).join(', ')}`); }
  const never = MEASURED.map(m => m.file).filter(f => !files.some(([k]) => k === f));
  console.log(`  couplet drops ${s.coupletDrops} of ${rs.length} ("It's not" ladders ${s.itsNot}); couplets used ${s.couplets}, the most-used ${couplets[0][0]} on ${s.coupletMax}`);
  console.log(`  "Let's build." ${s.letsBuild}; "Let's circle- BACK." ${s.circleBackTitle} of ${s.circleBackSongs} Circle Back songs (Synergy's "Let's circle back" sign-off ${s.synergySignoff}); same drop two songs running ${s.sameDropRunning}, same refrain ${s.sameRefrainRunning}`);
  console.log(`  her recordings cast: ${s.recordings} of 57${never.length ? ` (not on these posts: ${never.join(', ')})` : ''}; the most-cast ${files.slice(0, 6).map(([f, n]) => `${f} ${n}`).join(', ')}`);
  const voices = tally(rs, r => [r.cast.couplet?.x, r.cast.couplet?.y, r.cast.couplet?.y?.pickup, r.cast.refrain, r.cast.signoff, ...r.cast.stabs, ...r.cast.exchanges.flatMap(x => [x.call, x.response]), ...(r.cast.dropTag.kind === 'couplet' ? [r.cast.dropTag.tag, r.cast.dropTag.impact] : [])].filter(Boolean).map(p => p.voice));
  console.log(`  the band's parts by voice: ${voices.map(([v, n]) => `${v} ${n}`).join(', ')}`);
  return s;
}
// As the page casts: with the voice bank's takes (voice-table.js AVAILABLE), hash only and with history.
const paged = POSTS.map((post, i) => { const r = castSong(post, {available:AVAILABLE}); validCast(r, `${label(i)} (bank)`); validBand(r, `${label(i)} (bank)`, {available:AVAILABLE}); return r; });
const pagedHistory = [];
POSTS.forEach((post, i) => { const r = castSong(post, {available:AVAILABLE, recent:pagedHistory.map(x => x.keys)}); validCast(r, `${label(i)} (bank, history)`); validBand(r, `${label(i)} (bank, history)`, {available:AVAILABLE}); pagedHistory.push(r); });
const H = corpus(results, 'hash only (the sample and the 60 fixtures)'), W = corpus(withHistory, 'with history (the corpus in order)');
const PH = corpus(paged, 'with the voice bank, hash only (as the page casts)'), PW = corpus(pagedHistory, 'with the voice bank and history');
// Her moments: no line on more than LADY_ROTATION.caps.max songs, at least caps.distinct lines a role.
for (const [rs, name] of [[results, 'hash only'], [withHistory, 'with history'], [paged, 'the bank, hash only'], [pagedHistory, 'the bank, with history']]) {
  const parts = [];
  for (const role of LADY_SLOTS) {
    const t = tally(rs, r => r.keys[role]);
    ok(t.length >= LADY_ROTATION.caps.distinct && t[0][1] <= LADY_ROTATION.caps.max, `${name}: her ${role} rotates (${t.length} lines, the most-cast ${t[0][0]} on ${t[0][1]})`);
    ok(rs.every(r => r.keys[role] === ladyKey(r.cast[role])), `${name}: keys name her ${role}`);
    parts.push(`${role} ${t.length} (top ${t[0][0]} ${t[0][1]}${t.length > 1 ? `, ${t[1][0]} ${t[1][1]}` : ''})`);
  }
  console.log(`her moments, ${name}: ${parts.join('; ')}`);
}
for (const [s, name] of [[H, 'hash only'], [W, 'with history'], [PH, 'the bank, hash only'], [PW, 'the bank, with history']]) {
  ok(s.ladderMax <= CAPS.ladderMax, `${name}: no ladder on more than ${CAPS.ladderMax} posts (${s.ladderMax})`);
  ok(s.dropMax <= CAPS.dropMax, `${name}: no drop on more than ${CAPS.dropMax} posts (${s.dropMax})`);
  ok(s.refrainMax <= CAPS.refrainMax, `${name}: no refrain on more than ${CAPS.refrainMax} posts (${s.refrainMax})`);
  ok(s.coupletMax <= CAPS.coupletMax, `${name}: no couplet on more than ${CAPS.coupletMax} posts (${s.coupletMax})`);
  ok(s.signoffMax <= CAPS.signoffMax, `${name}: no sign-off on more than ${CAPS.signoffMax} posts (${s.signoffMax})`);
  ok(s.ladderDistinct >= CAPS.ladderDistinct && s.dropDistinct >= CAPS.dropDistinct && s.refrainDistinct >= CAPS.refrainDistinct, `${name}: at least ${CAPS.ladderDistinct} ladders, ${CAPS.dropDistinct} drops and ${CAPS.refrainDistinct} refrains (${s.ladderDistinct}, ${s.dropDistinct}, ${s.refrainDistinct})`);
  ok(s.letsBuild <= CAPS.letsBuildMax, `${name}: "Let's build." on ${CAPS.letsBuildMax} posts at most (${s.letsBuild})`);
  ok(s.circleBackTitle <= Math.round(CAPS.circleBackTitleShare * s.circleBackSongs) && s.circleBackTitle >= 1, `${name}: "Let's circle- BACK." on about one Circle Back song in four (${s.circleBackTitle} of ${s.circleBackSongs})`);
  ok(s.coupletDrops >= .25 * POSTS.length && s.coupletDrops <= .5 * POSTS.length, `${name}: a couplet drops on about 40% of the posts (${s.coupletDrops})`);
  ok(s.couplets >= 25, `${name}: the couplets spread (${s.couplets} used)`);
  ok(s.sameDropRunning <= 3, `${name}: the same drop two songs running at most 3 times (${s.sameDropRunning})`);
}
ok(W.dropDistinct >= H.dropDistinct && W.refrainDistinct >= H.refrainDistinct && W.ladderDistinct >= H.ladderDistinct && W.coupletMax <= H.coupletMax && W.sameDropRunning <= H.sameDropRunning, `with history the songs spread wider (drops ${H.dropDistinct} -> ${W.dropDistinct}, refrains ${H.refrainDistinct} -> ${W.refrainDistinct}, ladders ${H.ladderDistinct} -> ${W.ladderDistinct}, the most-used couplet ${H.coupletMax} -> ${W.coupletMax})`);
ok(W.recordings >= 52 && H.recordings >= 48, `her recordings in the rotation: ${H.recordings} hash only, ${W.recordings} with history (46 were cast before the lexicon)`);
// Freshness: a line one of the last three songs used scores x0.15; a song alone after its own repeat.
{
  const r = results[1], again = castSong(POSTS[1], {recent:[r.keys, r.keys, r.keys]});
  ok(again.keys.refrain !== r.keys.refrain && again.keys.couplet !== r.keys.couplet, `freshness: fixture 0 after three songs of its own lines moves its refrain (${r.keys.refrain} -> ${again.keys.refrain}) and couplet (${r.keys.couplet} -> ${again.keys.couplet})`);
  const slotsMoved = BAND_SLOTS.filter(s => json(again.keys[s]) !== json(r.keys[s]));
  ok(slotsMoved.length >= 4, `freshness moves most slots (${slotsMoved.join(', ')})`);
  ok(json(castSong(POSTS[1], {recent:{refrain:[r.keys.refrain]}}).keys.refrain) !== json(r.keys.refrain), 'recent also reads as {slot:[key, ...]}');
}

// ---- 5. The rules
// A post about family, health or grief: no couplet in its drop, only meetings and metrics couplets, its line names the refrain.
const sensitive = results.filter(r => r.flags.sensitive);
ok(sensitive.length >= 4 && sensitive.every(r => r.cast.dropTag.kind === 'lady' && !r.line.includes("It's not")), `sensitive posts (${sensitive.length}): no couplet drop, no joke in the line`);
ok(forced.filter(r => r.flags.sensitive).every(r => r.cast.dropTag.kind === 'lady'), 'sensitive posts, every track forced: no couplet drop');
ok(!results[48].flags.sensitive, 'fixture 47 ("We\'re a family"): the work family is the joke, not a family');
// The layoff couplets: only on a layoff or restructuring post (fixtures 1 and 33), never on "cut our cloud bill" (12).
const layoffPosts = results.map((r, i) => r.flags.layoffs ? label(i) : null).filter(Boolean);
ok(json(layoffPosts) === json(['fixture 1', 'fixture 33']) && !results[13].flags.layoffs && !results[26].flags.layoffs && !results[40].flags.layoffs, `layoff posts: ${layoffPosts.join(', ')} (not fixtures 12, 25, 39: a cloud bill, a coffee, an approval process)`);
ok([...results, ...withHistory, ...forced].every(r => !r.cast.couplet || !LEXICON.couplets.find(c => c.id === r.cast.couplet.id)?.topics.includes('layoffs') || r.flags.layoffs), 'every layoff couplet sits on a layoff post');
ok(results.filter(r => r.flags.layoffs).some(r => COUPLETS[r.cast.couplet.id]?.topics.includes('layoffs')), `the layoff couplets play where they belong: ${results.filter(r => r.flags.layoffs).map(r => r.cast.couplet.line).join(' / ')}`);
// "Not X, it's Y" in the post itself: the drop is a couplet, and her template is the refrain where it is free.
const argued = results.filter(r => r.flags.notabout);
ok(argued.length >= 4 && argued.every(r => r.cast.dropTag.kind === 'couplet' || r.flags.sensitive || r.flags.title), `posts that argue "not X, it's Y" (${argued.length}) drop on a couplet`);
ok(argued.filter(r => r.cast.refrain.file === '22.wav').length >= argued.length - 2, `her template (22) is the refrain where the post argues it (${argued.filter(r => r.cast.refrain.file === '22.wav').length} of ${argued.length})`);
// "Let's build." and "Let's circle- BACK.": the two lines Aaron heard as the chorus.
for (const r of [...results, ...withHistory, ...forced]) if (r.cast.ladder.file === '50.wav') ok(r.flags.building, `"Let's build." climbs only on a post about building`);
ok(!results[0].flags.building && results[0].cast.ladder.file !== '50.wav', `the sample's hook is "Let's keep building": her ladder does not echo it (${results[0].cast.ladder.display})`);
ok(results[24].flags.circleBack && !results[0].flags.circleBack, 'fixture 23 says "circle back" (the band may say it back, once); the sample does not');
// Delve and her other recordings that were never cast enter the rotation.
const everCast = new Set([...results, ...withHistory].flatMap(r => castFiles(r.cast)));
for (const f of ['10.wav', '09.wav', '22.wav', '33.wav', '54.wav', '11.wav', '12.wav', '19.wav']) ok(everCast.has(f), `${f} ("${MEASURED.find(m => m.file === f).text}") is cast now`);
// The sample: the flagship film, on the new vocabulary (Aaron, Nov 5).
{
  const r = results[0];
  ok(r.track === DEFAULT_TRACK && r.cast.ladder.file !== '50.wav' && !(r.cast.dropTag.kind === 'lady' && r.cast.tag.file === '06.wav'), `sample: Circle Back, without "Let's build." or "Let's circle- BACK." (${r.cast.ladder.display}; ${r.cast.dropTag.kind === 'couplet' ? `${r.cast.dropTag.tag.display} ${r.cast.dropTag.impact.display}` : `${r.cast.tag.display} ${r.cast.impact.display}`})`);
  ok(r.cast.couplet && r.cast.refrain && r.cast.signoff.voice !== 'synergy' && r.line.endsWith(r.cast.couplet.line), `sample: a couplet, a refrain, a sign-off of the band's: ${r.line}`);
}
// A post with nothing in it is Circle Back, and the band still plays.
{
  const r = castSong('Hello there. Nice weather today.');
  ok(r.track === DEFAULT_TRACK && r.why.track[0].startsWith('nothing decisive') && r.line.startsWith('Circle Back. Nothing in the post'), 'an empty post: Circle Back by default');
  validCast(r, 'an empty post'); validBand(r, 'an empty post');
}
// The voice bank's results: `available` limits Strategy and Synthia to the takes it has, and a line of hers that did not pass is his.
{
  const every = new Set([...TAKES.values()].flatMap(t => [`strategy/${t.id}`, `synthia/${t.id}`]));
  const noSynthia = new Set([...every].filter(k => k.startsWith('strategy/')));
  const none = new Set();
  let moved = 0;
  POSTS.forEach((post, i) => {
    ok(json(castSong(post, {available:every})) === json(results[i]), `${label(i)}: a bank with every take casts as the static rule does`);
    const s = castSong(post, {available:noSynthia});
    validCast(s, `${label(i)} (no Synthia takes)`); const parts = validBand(s, `${label(i)} (no Synthia takes)`, {available:noSynthia});
    ok(parts.every(([, p]) => p.voice !== 'synthia'), `${label(i)}: without her takes, Strategy sings her lines`);
    moved += parts.filter(([, p]) => p.id && takeOf(p.id).voice === 'synthia').length;
    const n = castSong(post, {available:none});
    validCast(n, `${label(i)} (no takes)`);
    ok([n.cast.refrain, n.cast.signoff, ...n.cast.stabs, ...n.cast.exchanges.flatMap(x => [x.call, x.response])].every(p => p && (p.voice === 'lady' || p.voice === 'synergy')) && (!n.cast.couplet || n.cast.couplet.x.voice === 'lady') && n.cast.dropTag.kind === 'lady', `${label(i)}: with no takes rendered, the band's slots are the lady's recordings (and Synergy's sign-off)`);
  });
  console.log(`available: a full bank casts as the static rule; without Synthia's takes ${moved} of her parts move to Strategy; with none, the lady carries the band's slots`);
}
// Pure: no network, no clock, no randomness in the engine.
for (const file of ['src/allhands/casting.js', 'src/allhands/vocabulary/takes.js']) {
  const src = readFileSync(join(ROOT, file), 'utf8').replace(/\/\/.*$/gm, '');
  ok(!/\b(fetch|XMLHttpRequest|WebSocket|Math\.random|Date\b|performance\.now)/.test(src), `${file}: no network, clock or randomness`);
}

// ---- 6. Arranged: the cast plays whole, and the board and the export read her measured words
const models = {fake:w => .18 + .11 * syllables(w), long:w => .3 + .19 * syllables(w)};
let placed = 0, dropped = [], boardWords = 0, cueWords = 0;
const PICKUP_GAP = .3, pickupGaps = [];
POSTS.forEach((post, i) => {
  const r = results[i], lyrics = lyricsFromPost(post), tr = TRACKS[r.track];
  for (const [m, f] of Object.entries(models)) {
    const durations = Object.fromEntries(dropVoicedWords(lyrics, {track:r.track}).map(w => [w, f(w)]));
    const plan = arrangeDrop(lyrics, durations, {track:r.track, cast:r.cast}), base = arrangeDrop(lyrics, durations, {track:r.track});
    const where = `${label(i)} ${m}`, cast = castOf(r.cast);
    ok(json(plan) === json(arrangeDrop(lyrics, durations, {track:r.track, cast:r.cast})), `${where}: plan deterministic`);
    // Every role that today's cast places, the post's cast places too.
    const roleOf = sinkFile => e => e.role === 'punct' ? (e.bend ? 'bend' : e.lift ? 'lift' : e.file === sinkFile && e.at === tr.drop.places.letThat ? 'sink-dry' : 'punct') : e.role;
    const have = new Set(plan.lady.map(roleOf(cast.sink.file))), had = new Set(base.lady.map(roleOf(DEFAULT_CAST.sink.file)));
    for (const role of had) if (!have.has(role)) dropped.push(`${where} ${role}`);
    placed += have.size;
    for (const e of plan.lady) {
      const entry = SONG_TABLE[e.file], inside = entry.words.filter(w => w.end > e.from + 1e-6 && w.start < e.to - 1e-6);
      ok(inside.length === e.display.split(' ').length, `${where} ${e.role} "${e.display}": one display word per measured word heard`);
      ok(inside.length === pixelText(e.display).split(' ').length, `${where} ${e.role} "${e.display}": Pixel Text keeps the word count`);
      // The sink starts where its dry words end: her pause before the deep words is kept.
      const k = entry.words.indexOf(inside[0]), from = e.role === 'sink' && k > 0 ? [inside[0].start, entry.words[k - 1].end] : [inside[0].start];
      // (A voice-bank take plays on through its last word's release, band.js RELEASE, where it ends the take.)
      const past = e.to - inside.at(-1).end, release = e.key && past > 1e-9 && past <= RELEASE + 1e-9 && inside.at(-1) === entry.words.at(-1);
      if (e.role !== 'ladder') ok(from.some(x => Math.abs(e.from - x) < 1e-9) && (Math.abs(past) < 1e-9 || release), `${where} ${e.role}: cut on the measured boundaries`);
    }
    const tag = plan.lady.find(e => e.role === 'tag'), impact = plan.lady.find(e => e.role === 'impact');
    ok(tag && impact, `${where}: tag and impact`);
    const window = (tr.drop.impact * 16 - (tr.drop.choke.bar * 16 + tr.drop.choke.step)) * tr.step, heard = (tag.to - tag.from) / tag.rate;
    const isDefaultTag = cast.tag.file === DEFAULT_CAST.tag.file && json(cast.tag.words) === json(DEFAULT_CAST.tag.words);
    if (!isDefaultTag) {
      ok(tag.gate >= heard - 1e-9, `${where} tag "${tag.display}": heard whole (${heard.toFixed(3)} s, gate ${tag.gate.toFixed(3)})`);
      ok(window - tag.gate >= LIMITS.tag.silence - 1e-9, `${where} tag: ${(window - tag.gate).toFixed(3)} s of silence before the impact`);
    }
    // On a couplet drop the couplet's Y word pays off its tag (both cut from one take, or her word after Synthia's pickup).
    const paid = tag.couplet ? cast.dropTag.impact : cast.impact;
    ok(impact.display === paid.display && (impact.file === tag.file || !!tag.couplet), `${where}: the impact pays off the tag`);
    // Synthia's "It's" / "It's a" and the lady's word are one answer: sung together, never a bar apart (band.js fit bind).
    for (const p of plan.band.filter(e => e.role === 'pickup')) {
      const y = plan.band.find(e => e.role === 'couplet-y' && e.couplet === p.couplet && e.start >= p.end - 1e-6);
      ok(y && y.start - p.end <= PICKUP_GAP, `${where}: "${p.display}" and "${y?.display}" ${y ? (y.start - p.end).toFixed(3) : '?'} s apart`);
      pickupGaps.push(y.start - p.end);
    }
    // The Peg Board: each lady screen's words start where the measured words start.
    const screens = buildScreens(plan, {table:SONG_TABLE}).filter(s => s.voice === 'lady');
    for (const e of plan.lady) {
      const t0 = plan.timing[Math.floor(e.at)] + (e.at - Math.floor(e.at)) * plan.step;
      const s = screens.find(x => Math.abs(x.from - t0) < 1e-6 && x.text === e.display);
      if (!s) continue;                               // a screen the next one covers
      const inside = SONG_TABLE[e.file].words.filter(w => w.end > e.from + 1e-6 && w.start < e.to - 1e-6);
      s.words.forEach((w, k) => { ok(Math.abs(w.start - (t0 + Math.max(0, inside[k].start - e.from) / e.rate)) < 1e-6, `${where} board ${e.role} word ${k}`); boardWords++; });
    }
    // Pixel Text: the lady's cues are timed from her words, not spread.
    const timeOf = planTimeOf(plan, 0), sources = ladyCueSources(plan.lady.filter(e => e.role !== 'ladder'), {timeOf, table:SONG_TABLE});
    plan.lady.filter(e => e.role !== 'ladder').forEach((e, k) => {
      const src = sources[k], inside = SONG_TABLE[e.file].words.filter(w => w.end > e.from + 1e-6 && w.start < e.to - 1e-6), t0 = timeOf(e.at);
      ok(src && src.words.length === inside.length, `${where} Pixel Text ${e.role}: one cue word per measured word`);
      src.words.forEach((w, j) => { ok(Math.abs(w.start - (t0 + (Math.max(inside[j].start, e.from) - e.from) / e.rate)) < 1e-6, `${where} Pixel Text ${e.role} word ${j}`); cueWords++; });
    });
  }
});
console.log(`arranged: ${POSTS.length * 2} plans, ${placed} lady roles placed, ${boardWords} Peg Board words and ${cueWords} Pixel Text words on her measured boundaries`);
console.log(`roles today's cast places but the post's cast does not: ${dropped.length}${dropped.length ? ` (${dropped.slice(0, 6).join('; ')})` : ''}`);
// The same with the page's casts and the real eSpeak durations (fixtures 36 and 39 split "It's a" from "Pivot" by 2.9 and 1.0 s).
{
  const REAL = JSON.parse(readFileSync(join(ROOT, 'scripts/fixtures/allhands-durations.json'), 'utf8'));
  POSTS.forEach((post, i) => {
    const r = paged[i], lyrics = lyricsFromPost(post);
    if (r.track === 'offsite') return;
    const plan = settleCast(arrangeDrop, lyrics, REAL, {track:r.track, cast:r.cast}).plan;
    for (const p of plan.band.filter(e => e.role === 'pickup')) {
      const y = plan.band.find(e => e.role === 'couplet-y' && e.couplet === p.couplet && e.start >= p.end - 1e-6);
      ok(y && y.start - p.end <= PICKUP_GAP, `${label(i)} (bank, real durations): "${p.display}" and "${y?.display}" ${y ? (y.start - p.end).toFixed(3) : '?'} s apart`);
      pickupGaps.push(y.start - p.end);
    }
  });
}
console.log(`Synthia's pickup to her lady's word: ${pickupGaps.length} pairs, ${pickupGaps.length ? `${Math.min(...pickupGaps).toFixed(3)}-${Math.max(...pickupGaps).toFixed(3)} s` : 'none'} apart`);
// settleCast (the page's arrangement): no change when every role is placed,
// and today's line back when a longer recast finds no gap.
{
  let same = 0, found = null;
  POSTS.forEach((post, i) => {
    const r = results[i], lyrics = lyricsFromPost(post), durations = Object.fromEntries(dropVoicedWords(lyrics, {track:r.track}).map(w => [w, models.fake(w)]));
    const s = settleCast(arrangeDrop, lyrics, durations, {track:r.track, cast:r.cast});
    ok(!s.restored.length && json(s.plan) === json(arrangeDrop(lyrics, durations, {track:r.track, cast:r.cast})), `${label(i)}: settleCast keeps a cast that is placed`);
    same++;
  });
  const wide = w => .45 + .3 * syllables(w);
  outer: for (const post of POSTS.slice(0, 30)) for (const t of TRACK_ORDER) {
    const lyrics = lyricsFromPost(post), durations = Object.fromEntries(dropVoicedWords(lyrics, {track:t}).map(w => [w, wide(w)]));
    const base = arrangeDrop(lyrics, durations, {track:t});
    if (!base.lady.some(e => e.lift)) continue;
    for (const p of ROLES.phrases) for (const c of p.roles.lift || []) {
      if (c.default || !c.tracks.includes(t)) continue;
      const cast = {...DEFAULT_CAST, lift:{file:p.file, words:c.words, display:c.display}};
      if (arrangeDrop(lyrics, durations, {track:t, cast}).lady.some(e => e.lift)) continue;
      found = {t, display:c.display, s:settleCast(arrangeDrop, lyrics, durations, {track:t, cast})};
      break outer;
    }
  }
  ok(found && json(found.s.restored) === json(['lift']) && found.s.plan.lady.some(e => e.lift && e.display === DEFAULT_CAST.lift.display), `settleCast restores today's lift when "${found?.display}" finds no gap`);
  console.log(`settleCast: ${same} casts placed as cast; a lift with no gap ("${found.display}" on ${found.t}, wide words) goes back to "${DEFAULT_CAST.lift.display}"`);
}
ok(dropped.length === 0, "a recast never loses a role that today's cast places");

console.log(`check-casting: ${checks} checks passed`);

// ---- 7. The page (--page, or with --render): /allhands/ casts as Node does and shows the why line.
// Renders (optional): --render --url http://localhost:5331 --out <dir>. Nine fixture posts, chosen to
// cover all four songs (15: Offsite).
const RENDER_FIXTURES = [1, 25, 0, 5, 13, 44, 38, 56, 15];
if (process.argv.includes('--page') && !process.argv.includes('--render')) await onPage();
if (process.argv.includes('--render')) await renders();

async function onPage() {
  const url = arg('url', 'http://localhost:5331'), shot = arg('shot');
  const require = createRequire(import.meta.url), {chromium} = require('playwright');
  const browser = await chromium.launch(), page = await browser.newPage({viewport:{width:1280, height:900}});
  await page.goto(`${url}/allhands/`, {waitUntil:'networkidle'});
  await page.waitForFunction(() => window.__allhands);
  const inPage = await page.evaluate(async posts => { const m = await import('/src/allhands/casting.js'); return posts.map(p => JSON.stringify(m.castSong(p))); }, POSTS);
  ok(inPage.every((s, k) => s === json(results[k])), `the page casts all ${POSTS.length} posts exactly as Node does`);
  const hist = await page.evaluate(async posts => { const m = await import('/src/allhands/casting.js'); const recent = [], out = []; for (const p of posts) { const r = m.castSong(p, {recent}); out.push(JSON.stringify(r)); recent.push(r.keys); } return out; }, POSTS);
  ok(hist.every((s, k) => s === json(withHistory[k])), 'and with a history, exactly as Node does');
  // The why line under the Song picker: the sample post, cast by itself.
  await page.waitForSelector('.ah-casting');
  const shown = (await page.textContent('.ah-casting')).trim();
  ok(shown === results[0].line, `/allhands/ says why: "${shown}"`);
  if (shot) { await page.locator('.ah-songs').scrollIntoViewIfNeeded(); await page.screenshot({path:shot, clip:await page.locator('.ah-voice').boundingBox()}); console.log(`screenshot: ${shot}`); }
  console.log(`the page: ${POSTS.length} posts cast as in Node, hash only and with history; the line on /allhands/: ${shown}`);
  await browser.close();
  console.log(`check-casting --page: ${checks} checks passed`);
}

async function renders() {
  const url = arg('url', 'http://localhost:5331'), out = arg('out', join(process.env.TMPDIR || '/tmp', 'casting-takes')), model = arg('whisper-model', 'small.en');
  mkdirSync(out, {recursive:true});
  const picks = RENDER_FIXTURES.map(i => ({i, post:FIXTURES[i], r:castSong(FIXTURES[i])}));
  ok(TRACK_ORDER.every(t => picks.some(p => p.r.track === t)), 'renders: every song');
  ok(picks.filter(p => p.r.recast.length).length >= 6, 'renders: her lines recast on most of them');
  // The page casts exactly what Node casts, and its render hook plays it.
  {
    const require = createRequire(import.meta.url), {chromium} = require('playwright');
    const browser = await chromium.launch(), page = await browser.newPage();
    await page.goto(`${url}/allhands/`, {waitUntil:'networkidle'});
    await page.waitForFunction(() => window.__allhands);
    const inPage = await page.evaluate(async posts => { const m = await import('/src/allhands/casting.js'); return posts.map(p => JSON.stringify(m.castSong(p))); }, POSTS);
    ok(inPage.every((s, k) => s === json(results[k])), 'the page casts all 61 posts exactly as Node does');
    const excerpt = await page.evaluate(post => window.__allhands.render({post, auto:true, bars:[19, 21]}).then(x => ({track:x.plan.track, casting:x.casting.track, files:x.plan.lady.map(e => `${e.role}:${e.file}:${e.display}`)})), FIXTURES[1]);
    const want = arrangeDrop(lyricsFromPost(FIXTURES[1]), {}, {track:results[2].track, cast:results[2].cast}).lady.map(e => `${e.role}:${e.file}:${e.display}`);
    ok(excerpt.track === results[2].track && excerpt.casting === results[2].track && want.every(x => excerpt.files.includes(x) || /^(bend|lift|punct):/.test(x)), `the page's render hook (auto) plays the post's cast: ${excerpt.files.filter(f => !f.startsWith('ladder')).join(', ')}`);
    await browser.close();
  }
  const index = [], summary = [];
  for (const {i, post, r} of picks) {
    const name = `fixture${String(i).padStart(2, '0')}-${r.track}`, base = join(out, name);
    writeFileSync(`${base}.post.txt`, post); writeFileSync(`${base}.cast.json`, JSON.stringify(r.cast, null, 1)); writeFileSync(`${base}.casting.json`, JSON.stringify(r, null, 1));
    if (!existsSync(`${base}.wav`) || process.argv.includes('--fresh')) {
      const t0 = Date.now();
      const run = spawnSync('node', [join(ROOT, 'scripts/render-allhands.mjs'), '--url', url, '--out', out, '--post', `${base}.post.txt`, '--track', r.track, '--cast', `${base}.cast.json`, '--name', name], {encoding:'utf8', maxBuffer:1 << 26});
      ok(run.status === 0, `render ${name}: ${run.stderr.slice(-400)}`);
      console.log(`rendered ${name} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    const take = JSON.parse(readFileSync(`${base}.json`, 'utf8')), p = take.plan, off = p.offset;
    // The plan the page played is the post's cast.
    const cast = castOf(r.cast);
    for (const role of ['tag', 'impact', 'ladder', 'sink', 'stop']) ok(p.lady.some(e => e.role === role && e.file === cast[role].file), `render ${name}: ${role} is ${cast[role].file}`);
    // Whisper windows on every lady moment, in file seconds.
    const ev = role => p.lady.filter(e => e.role === role), at = e => e.start + off;
    const spans = [];
    const add = (what, a, b, text) => spans.push({what, a, b, text:text.replace(/-/g, ' ').replace(/\s+/g, ' ').trim()});
    const ladder = ev('ladder').find(e => e.rung === 0); if (ladder) add('ladder', at(ladder) - .04, at(ladder) + ladder.length + .22, ladder.display);
    const tag = ev('tag')[0], impact = ev('impact')[0];
    add('tag', at(tag) - .04, at(tag) + tag.length + .2, tag.display);
    add('impact', at(impact) - .04, at(impact) + .55, impact.display);
    add('tag + impact', at(tag) - .04, at(impact) + .55, `${tag.display} ${impact.display}`);
    const sink = ev('sink')[0], lead = sink && p.lady.find(e => e.role === 'punct' && e.file === sink.file && e.start < sink.start);
    if (sink) {
      const end = p.sections.find(s => s.name === 'Sink In').end + off + .05;
      add('sink', (lead ? at(lead) : at(sink)) - .04, Math.min(at(sink) + 2 * sink.length + .3, end), `${lead ? lead.display + ' ' : ''}${sink.display}`);
    }
    for (const e of p.lady.filter(e => e.role === 'punct' && e !== lead)) add(e.display === cast.bend.display ? 'bend' : e.display === cast.lift.display ? 'lift' : 'punct', at(e) - .04, at(e) + e.length + .22, e.display);
    const stop = ev('stop')[0]; if (stop) add('stop', at(stop) - .04, at(stop) + stop.length + .25, stop.display);
    // The silence: from her tag's end to the impact (the bus look-ahead delays the mix ~15 ms).
    const quiet = at(tag) + tag.length + .022, hit = p.choke.end + off + .012;
    const args = [join(ROOT, 'scripts/measure-allhands.py'), `${base}.wav`, '--plan', `${base}.json`, '--silence', `${quiet.toFixed(3)}-${hit.toFixed(3)}`, '--whisper-model', model, '--json', `${base}.gates.json`,
      ...spans.flatMap(s => ['--whisper', `${s.a.toFixed(3)}-${s.b.toFixed(3)}:${s.text}`])];
    if (!existsSync(`${base}.gates.json`) || process.argv.includes('--fresh')) {
      const gates = spawnSync('python3', args, {encoding:'utf8', maxBuffer:1 << 26});
      writeFileSync(`${base}.gates.txt`, gates.stdout + gates.stderr);
      ok(existsSync(`${base}.gates.json`), `gates ${name}: ${gates.stderr.slice(-300)}`);
    }
    const g = JSON.parse(readFileSync(`${base}.gates.json`, 'utf8'));
    const failed = g.gates.filter(x => x.status === 'FAIL'), warned = g.gates.filter(x => x.status === 'WARN');
    // A failed gate is the cast's only if today's cast passes it: render the
    // same post on the same song with today's cast and compare.
    let control = null;
    if (failed.length) {
      const cname = `${name}-todays-cast`, cbase = join(out, cname);
      if (!existsSync(`${cbase}.wav`)) {
        const run = spawnSync('node', [join(ROOT, 'scripts/render-allhands.mjs'), '--url', url, '--out', out, '--post', `${base}.post.txt`, '--track', r.track, '--name', cname], {encoding:'utf8', maxBuffer:1 << 26});
        ok(run.status === 0, `render ${cname}: ${run.stderr.slice(-400)}`);
      }
      if (!existsSync(`${cbase}.gates.json`)) {
        const cp = JSON.parse(readFileSync(`${cbase}.json`, 'utf8')).plan, ct = cp.lady.find(e => e.role === 'tag');
        const cq = ct.start + ct.length + .022 + cp.offset, ch = cp.choke.end + cp.offset + .012;
        const run = spawnSync('python3', [join(ROOT, 'scripts/measure-allhands.py'), `${cbase}.wav`, '--plan', `${cbase}.json`, '--silence', `${cq.toFixed(3)}-${ch.toFixed(3)}`, '--json', `${cbase}.gates.json`], {encoding:'utf8', maxBuffer:1 << 26});
        writeFileSync(`${cbase}.gates.txt`, run.stdout + run.stderr);
      }
      const cg = JSON.parse(readFileSync(`${cbase}.gates.json`, 'utf8'));
      control = failed.map(f => { const c = cg.gates.find(x => x.gate === f.gate); return {gate:f.gate, cast:f.value, today:c?.value, todayStatus:c?.status}; });
      const mine = control.filter(c => c.todayStatus !== 'FAIL' && !(Math.abs(parseFloat(c.cast) - parseFloat(c.today)) <= .3));
      ok(!mine.length, `gates ${name}: the cast fails ${mine.map(c => `${c.gate} ${c.cast} (today's cast ${c.today})`).join(', ')}`);
      console.log(`gates ${name}: ${control.map(c => `${c.gate} ${c.cast}, today's cast ${c.today} ${c.todayStatus}`).join('; ')}: the song book's, not the cast's`);
    }
    const mp3 = spawnSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', `${base}.wav`, '-codec:a', 'libmp3lame', '-b:a', '320k', `${base}.mp3`]);
    ok(mp3.status === 0, `mp3 ${name}`);
    const val = k => g.gates.find(x => x.gate.startsWith(k))?.value;
    summary.push({name, track:r.track, gates:{I:val('Integrated'), TP:val('True peak'), LRA:val('Loudness range'), dropA:`${val('Drop A vs Verse (mix)')} / ${val('Drop A vs Verse (phone)')}`, dropB:`${val('Drop B vs Verse (mix)')} / ${val('Drop B vs Verse (phone)')}`,
      silence:`${(hit - quiet).toFixed(3)} s ${val('Silence')}`, clipped:val('Clipped'), warn:warned.map(x => `${x.gate} ${x.value}`), fail:failed.map(x => `${x.gate} ${x.value}`), control}, whisper:g.whisper.map((w, k) => ({what:spans[k].what, said:w.expected, heard:w.heard, wer:w.wer}))});
    const excerpt = post.replace(/\s+/g, ' ').slice(0, 110) + (post.length > 110 ? '…' : '');
    const verdict = failed.length ? `${failed.map(x => `${x.gate} ${x.value} FAIL`).join(', ')}; today's cast on this post fails it too (${control.map(c => c.today).join(', ')})` : `pass${warned.length ? `, ${warned.length} warning${warned.length > 1 ? 's' : ''}` : ''}`;
    index.push(`${name}.mp3 (${TRACKS[r.track].title}, ${p.duration.toFixed(1)} s; gates: ${verdict})\n  Post: ${excerpt}\n  Why: ${r.line}\n  The lady: ${['ladder', 'tag', 'bend', 'sink', 'lift', 'punct', 'stop'].map(role => role === 'tag' ? `${cast.tag.display} ${cast.impact.display}` : cast[role].display).join(' · ')}\n  Recast from today's cast: ${r.recast.join(', ') || 'none'}\n`);
  }
  writeFileSync(join(out, 'index.txt'), `All Hands, cast by the post. Nine fixture posts, rendered through /allhands/ (Drop Edition).\nEach MP3 is 320 kbps from the 44.1 kHz render; gates in <name>.gates.txt.\n\n${index.join('\n')}`);
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1));
  for (const s of summary) {
    console.log(`\n${s.name}: I ${s.gates.I}, TP ${s.gates.TP}, LRA ${s.gates.LRA}, Drop A ${s.gates.dropA}, Drop B ${s.gates.dropB}, silence ${s.gates.silence}, clipped ${s.gates.clipped}${s.gates.warn.length ? `; warn: ${s.gates.warn.join(', ')}` : ''}${s.gates.fail.length ? `; FAIL: ${s.gates.fail.join(', ')} (today's cast: ${s.gates.control.map(c => `${c.today} ${c.todayStatus}`).join(', ')})` : ''}`);
    for (const w of s.whisper) console.log(`  ${w.what.padEnd(13)} ${w.said.slice(0, 34).padEnd(34)} | ${String(w.heard).slice(0, 44).padEnd(44)} WER ${w.wer}`);
  }
  console.log(`\ncheck-casting --render: ${checks} checks passed; takes in ${out}`);
}
