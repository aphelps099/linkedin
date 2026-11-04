// The Drop Edition: the same band, the same Synergy, plus the lady. The meeting
// starts muted, unmutes on Synergy's welcome, builds on her accelerating
// "Let's build.", chokes into silence, and comes BACK. Every song book track
// performs this structure in its own tempo, key and style (songbook/*.js);
// Circle Back's is 30 bars, 60.000 s. Pure: every event is decided here,
// before any audio exists.
import {BAR_STEPS, placeSlot, timingTable, hash} from './song.js';
import {tokens} from './lyrics.js';
import {slice, LADY_TABLE} from './lady-table.js';
import {trackOf, castOf} from './songbook/index.js';
import circleBack from './songbook/circle-back.js';
import PITCH from './lady-pitch.json' with {type:'json'};

// Circle Back's form, still exported under its old names.
export {DROP_BARS, DROP_SECTIONS, UNMUTE_BAR, CHOKE, IMPACT_BAR, swingOf, dropLayers, dropCutoff, dropSlots} from './songbook/circle-back.js';

const TARGETS = circleBack.drop.ladder.targets;   // E3, G3, A3: tune her to the nearest of these
// The playback rate that puts a recording's f0 on the nearest target note.
export function tunedRate(f0, targets = TARGETS) {
  if (!f0) return 1;
  const midi = 69 + 12 * Math.log2(f0 / 440);
  const target = targets.reduce((a, b) => Math.abs(b - midi) < Math.abs(a - midi) ? b : a);
  return {rate:2 ** ((target - midi) / 12), base:target};
}

// Her pitch (MIDI) over [from, to] seconds of a recording: the median of the
// voiced 10 ms frames within 6 dB of the span's loudest (the vowels you hear,
// not the glides into them), from scripts/measure-lady-pitch.py; null when
// nothing in the span is voiced. A cut is tuned by what it plays, not by the
// phrase's median: "Let's" sits 2 to 5 semitones above "build.".
export function pitchOf(file, from, to) {
  const p = PITCH[file];
  if (!p) return null;
  const a = Math.max(0, Math.ceil((from + .008 - p.t0) / p.hop)), b = Math.min(p.m.length - 1, Math.floor((to - .008 - p.t0) / p.hop));
  let loud = -Infinity;
  for (let k = a; k <= b; k++) if (p.m[k] && p.e[k] > loud) loud = p.e[k];
  const v = [];
  for (let k = a; k <= b; k++) if (p.m[k] && p.e[k] >= loud - 6) v.push(p.m[k] / 10);
  if (!v.length) return null;
  v.sort((x, y) => x - y);
  return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
}

// The rate that puts the audio a cut actually plays on `target`, and the gate
// that plays exactly that audio. The played span (seconds of the recording)
// depends on the rate (a hit is gated at 0.92 of its period), so it is solved
// with a span that only ever shrinks: it settles, and the gate then plays
// precisely the span that was measured. Without a pitch: `fallback`.
function cutTune(file, cut, target, period, fallback) {
  const whole = cut[1] - cut[0], limit = period * .92;
  let played = whole, rate = fallback;
  for (let pass = 0; pass < 24; pass++) {
    const m = pitchOf(file, cut[0], cut[0] + played);
    if (m === null) return {rate:fallback, gate:Math.min(whole / fallback, limit)};
    rate = 2 ** ((target - m) / 12);
    const next = Math.min(played, limit * rate);
    if (next >= played - 1e-12) break;
    played = next;
  }
  return {rate, gate:Math.min(played / rate, limit)};
}

// Degree d of the pentatonic (pitch classes) counted up from the base note, in
// semitones above it: the ladder stays in key whichever note she is tuned to.
export function ladderSemitones(base, pentatonic) {
  const up = [];
  for (let m = base; up.length < 12; m++) if (pentatonic.includes(((m % 12) + 12) % 12)) up.push(m - base);
  return d => up[d];
}

// Synergy's words occupy their steps (± one step of guard); the lady sings in the gaps.
function freeAt(words, from, length) {
  return !words.some(w => w.at - 1 < from + length && from < w.at + w.steps + 1);
}

// A cast entry's words as [first, last] indexes into its recording.
function span(entry, words) {
  const n = entry.words.length, at = i => (i < 0 ? n + i : i);
  return [Math.max(0, Math.min(n - 1, at(words[0]))), Math.max(0, Math.min(n - 1, at(words[1])))];
}
const upper = (entry, a, b) => entry.words.slice(a, b + 1).map(w => w.text.toUpperCase()).join(' ');
// The display of words a..b of a cast role: from its own display when the word
// counts agree (so the default cast shows exactly what it always showed).
function shown(role, entry, [first, last], a, b) {
  const parts = role.display ? role.display.split(' ') : null;
  if (parts && parts.length === last - first + 1) return parts.slice(a - first, b - first + 1).join(' ');
  return upper(entry, a, b);
}

// The ladder's slices of her phrase, longest to shortest: the whole phrase, its
// first word and the start of the next, the first word, a syllable, a grain.
function ladderCuts(entry, [first, last], display) {
  const second = Math.min(first + 1, last), words = display.split(' '), head = words[0] || '';
  return {
    phrase:{cut:slice(entry, first, last), display},
    letsbu:{cut:slice(entry, first, second, .455), display:second > first && words[1] ? `${head} ${words[1].slice(0, 2)}-` : head},
    lets:{cut:slice(entry, first, first), display:head},
    le:{cut:slice(entry, first, first, .1), display:head.slice(0, 2)},
    l:{cut:slice(entry, first, first, .06), display:head.slice(0, 2)},
  };
}

// The tag's rate: Circle Back's fixed 1.1, or (track.drop.tag.tune) the rate
// nearest 1.1 that lands her f0 on a note of the key, then quick enough (up to
// 1.2) that at least `silence` seconds of true silence remain before the impact.
export function tagRate(spec, entry, length, window, pitchClasses) {
  if (!spec.tune) return {rate:spec.rate};
  let rate = spec.rate ?? 1.1;
  if (entry.f0) {
    const midi = 69 + 12 * Math.log2(entry.f0 / 440), [lo, hi] = spec.range ?? [.96, 1.16];
    let best = null;
    for (let m = Math.ceil(midi + 12 * Math.log2(lo)); m <= Math.floor(midi + 12 * Math.log2(hi)); m++) {
      if (!pitchClasses.includes(((m % 12) + 12) % 12)) continue;
      const r = 2 ** ((m - midi) / 12);
      if (!best || Math.abs(Math.log(r / 1.1)) < Math.abs(Math.log(best.rate / 1.1))) best = {rate:r, midi:m};
    }
    if (best) rate = best.rate;
  }
  const room = window - (spec.silence ?? .47);
  if (length / rate > room) rate = Math.min(1.2, length / room);
  return {rate, room};
}

export function ladyEvents(words, table = LADY_TABLE, {track, cast} = {}) {
  const tr = trackOf(track), D = tr.drop, roles = castOf(cast), STEP = tr.step, events = [], seconds = s => s / STEP;
  const impactStep = D.impact * BAR_STEPS, chokeStep = D.choke.bar * BAR_STEPS + D.choke.step;
  // The deep voice's metal (a comb, lady.js bakeDeep): Circle Back keeps its A2;
  // the other tracks ring on the chord's root, an octave above Pat's.
  const comb = bar => D.tuneComb ? {comb:440 * 2 ** ((tr.chordAt(bar).root + 12 - 69) / 12)} : {};
  const ladder = roles.ladder && table[roles.ladder.file], tagEntry = roles.tag && table[roles.tag.file], impactEntry = roles.impact && table[roles.impact.file];
  if (ladder) {
    const range = span(ladder, roles.ladder.words), file = roles.ladder.file;
    const {rate:baseRate, base} = tunedRate(ladder?.f0, D.ladder.targets);
    const cuts = ladderCuts(ladder, range, roles.ladder.display ?? upper(ladder, ...range)), build = D.ladder.rungs[0].bar, semis = ladderSemitones(base, D.ladder.pentatonic);
    for (const rung of D.ladder.rungs) {
      const glide = rung.glide && rung.glide.map(semis), notes = rung.deg && rung.deg.map(semis);
      rung.hits.forEach((h, i) => {
        const at = rung.bar * BAR_STEPS + h, period = (rung.hits[i + 1] ?? (rung.hits.length > 1 ? h + (rung.hits[1] - rung.hits[0]) : 16)) - h;
        const st = glide ? glide[0] + (glide[1] - glide[0]) * (i / Math.max(1, rung.hits.length - 1)) : notes[i];
        const {cut, display} = cuts[rung.cut];
        const {rate, gate} = cutTune(file, cut, base + st, period * STEP, baseRate * 2 ** (st / 12));
        events.push({role:'ladder', rung:rung.bar - build, file, from:cut[0], to:cut[1], at, rate, gate,
          gain:ladder.gainDb, pan:0, blend:rung.blend || 0, midi:base + st, display, period});
      });
    }
  }
  // Tag, choke, silence, impact.
  // "Let's circle-" a touch quick, so the whole word lands before the silence.
  if (tagEntry) {
    const range = span(tagEntry, roles.tag.words), tag = slice(tagEntry, ...range), window = (impactStep - chokeStep) * STEP;   // the build is straight: no swing in it
    const {rate, room} = tagRate(D.tag, tagEntry, tag[1] - tag[0], window, tr.pitchClasses);
    const gate = room === undefined ? Math.min(.64, (tag[1] - tag[0]) / rate) : Math.min(.64, (tag[1] - tag[0]) / rate, room);
    events.push({role:'tag', file:roles.tag.file, from:tag[0], to:tag[1], at:chokeStep, rate, gate, gain:tagEntry.gainDb - 1, pan:0, display:roles.tag.display ?? upper(tagEntry, ...range)});
  }
  // "BACK." owns the impact, dry and loud with the machine under it; her deep
  // robotic "BACK." answers one beat later, so the two never blur into one word.
  if (impactEntry) {
    const range = span(impactEntry, roles.impact.words), back = slice(impactEntry, ...range);
    events.push({role:'impact', file:roles.impact.file, from:back[0], to:back[1], at:impactStep, rate:1, gate:back[1] - back[0] + .02, gain:impactEntry.gainDb + 5, pan:0, blend:.25, vocoded:.3, deep:.42, deepAt:4,
      root:tr.chordAt(D.impact).root, midi:D.impactNote, display:roles.impact.display ?? upper(impactEntry, ...range), ...comb(D.impact)});
  }
  // Punctuation in Synergy's gaps.
  const punct = (role, candidates, extra) => {
    const r = roles[role], t = r && table[r.file]; if (!t) return;
    const range = span(t, r.words), cut = slice(t, ...range), length = (cut[1] - cut[0]);
    const at = candidates.find(c => freeAt(words, c, Math.ceil(seconds(length + .02))));
    // In the drops she has to cut through the band: +3 dB.
    if (at !== undefined) events.push({role:'punct', file:r.file, from:cut[0], to:cut[1], at, rate:1, gate:length + .02, gain:t.gainDb + (at >= impactStep ? 3 : 0), dip:at >= impactStep ? .6 : 0, pan:0, display:r.display ?? t.text.toUpperCase(), ...extra});
  };
  punct('bend', D.places.bend, {pan:-.25, bend:{cents:-300, at:.66, back:.96}});
  // "Let that" dry, then the room sinks under "sink in".
  const sinkRole = roles.sink, sink = sinkRole && table[sinkRole.file];
  if (sink) {
    // "sink in" keeps her natural pause after "that": the beat of air before the room sinks.
    const range = span(sink, sinkRole.words), split = Math.max(range[0], Math.min(range[1], range[0] + (sinkRole.split ?? Math.ceil((range[1] - range[0] + 1) / 2))));
    const bar = 16 * STEP;
    if (split > range[0]) {
      const letThat = slice(sink, range[0], split - 1), sinkIn = [letThat[1], slice(sink, split, range[1])[1]];
      events.push({role:'punct', file:sinkRole.file, from:letThat[0], to:letThat[1], at:D.places.letThat, rate:1, gate:letThat[1] - letThat[0] + .02, gain:sink.gainDb, pan:0, display:shown(sinkRole, sink, range, range[0], split - 1)});
      events.push({role:'sink', file:sinkRole.file, from:sinkIn[0], to:sinkIn[1], at:D.sink * BAR_STEPS, rate:1, gate:bar, gain:sink.gainDb, pan:0, deep:.5, root:tr.chordAt(D.sink).root, display:shown(sinkRole, sink, range, split, range[1]), ...comb(D.sink)});
    } else {
      const sinkIn = slice(sink, range[0], range[1]);
      events.push({role:'sink', file:sinkRole.file, from:sinkIn[0], to:sinkIn[1], at:D.sink * BAR_STEPS, rate:1, gate:bar, gain:sink.gainDb, pan:0, deep:.5, root:tr.chordAt(D.sink).root, display:shown(sinkRole, sink, range, range[0], range[1]), ...comb(D.sink)});
    }
  }
  punct('lift', D.places.lift, {pan:.25, lift:{cents:500, from:.72}});
  punct('punct', D.places.punct, {pan:-.25});
  const stopRole = roles.stop, stop = stopRole && table[stopRole.file];
  if (stop) {
    const range = span(stop, stopRole.words), cut = slice(stop, ...range);
    events.push({role:'stop', file:stopRole.file, from:cut[0], to:cut[1], at:D.stop.bar * BAR_STEPS + D.stop.step, rate:1, gate:cut[1] - cut[0] + .02, gain:stop.gainDb, pan:0, display:stopRole.display ?? upper(stop, ...range)});
  }
  return events.sort((a, b) => a.at - b.at);
}

// A melody note on the chord under it: the nearest note of the track's melody
// table that the chord allows (track.chordAt(bar).avail, pitch classes).
function fitter(tr) {
  if (!tr.chords || !Object.values(tr.chords).some(c => c.avail)) return undefined;
  return (midi, at) => {
    const avail = tr.chordAt(Math.floor(at / BAR_STEPS)).avail;
    if (!avail || avail.includes(midi % 12)) return midi;
    const ok = tr.music.scale.filter(m => avail.includes(m % 12));
    return ok.reduce((best, m) => Math.abs(m - midi) < Math.abs(best - midi) || (Math.abs(m - midi) === Math.abs(best - midi) && m < best) ? m : best, ok[0]);
  };
}

// arrangeDrop(lyrics, durations[, table][, {track, cast}]) or
// arrangeDrop(lyrics, durations, {track, cast, table}).
export function arrangeDrop(lyrics, durations, table = LADY_TABLE, options) {
  // A lady table is keyed by her recordings ("NN.wav"); any other object is the
  // options, even {} or {track:undefined} (the render hook's default call).
  if (table && !Object.keys(table).some(k => k.endsWith('.wav'))) { options = table; table = options.table ?? LADY_TABLE; }
  const {track, cast, coldOpen = false} = options || {};
  const tr = trackOf(track), D = tr.drop, STEP = tr.step;
  const music = {step:STEP, scale:tr.music.scale, resolve:tr.music.resolve, home:tr.music.home, fit:fitter(tr)};
  const lines = [], words = [];
  D.slots(lyrics).forEach((slot, id) => {
    const placed = placeSlot(slot, lyrics, durations, id, music);
    lines.push(placed.line); words.push(...placed.words);
  });
  // Synergy answers her in the build: the hook's first word between her hits.
  const hookFirst = tokens(lyrics.hook)[0], A = D.answers;
  if (hookFirst) for (const bar of A.bars) for (const s of A.steps) {
    const word = {display:hookFirst.display, word:hookFirst.word, line:-1, at:bar * 16 + s, steps:3, rate:1, gate:Math.min(.36, (durations[hookFirst.word] ?? .4)), notes:[{at:bar * 16 + s, steps:3, midi:A.notes[A.steps.indexOf(s)]}], kind:'answer', harmony:false, repeat:false};
    words.push(word);
  }
  // He stammers the hook's first word on the odd 16ths of one bar of the ladder.
  const stutters = hookFirst ? Array.from({length:8}, (_, i) => ({word:hookFirst.word, at:D.stutter.bar * 16 + 2 * i + 1, steps:1, midi:D.stutter.notes[i]})) : [];
  words.sort((a, b) => a.at - b.at);
  const lady = ladyEvents(words, table, {track:tr, cast});
  const totalSteps = D.bars * BAR_STEPS, sectionOf = bar => D.sections.find(s => bar >= s.from && bar < s.to) || D.sections.at(-1);
  const bars = Array.from({length:D.bars}, (_, index) => ({index, section:sectionOf(index).name, chord:tr.chordAt(index), layers:D.layers(index), cutoff:D.cutoff(index), swing:D.swing(index)}));
  const timing = timingTable(totalSteps + BAR_STEPS, D.swing, STEP);
  const chokeAt = D.choke.bar * 16 + D.choke.step, tag = lady.find(e => e.role === 'tag');
  // Kick steps, as the band plays them, plus the drop kick on the impact.
  const kicks = [];
  bars.forEach(b => { const own = tr.kicksOf(b.index, b.layers); if (b.layers.impact && !own.includes(0)) own.unshift(0); own.forEach(s => kicks.push(b.index * 16 + s)); });
  const energyTrim = roomTrim(tr, words, timing);
  const plan = {form:'drop60', title:'Drop edition', bpm:tr.bpm, step:STEP, swing:tr.swing, key:tr.key, sections:D.sections, bars, lines, words, stutters, lady,
    call:{until:D.unmute * BAR_STEPS, dropouts:dropouts(hash(lyrics.hook), D.unmute * BAR_STEPS)},
    // tagEnd: when her tag stops sounding (seconds, plan time): its envelope's end, gate and release included.
    choke:{at:chokeAt, until:D.impact * 16, dark:timing[chokeAt] + (D.dark ?? Math.ceil(((tag ? tag.gate : 0) + .01) * 1000) / 1000), tagEnd:tag ? timing[chokeAt] + ladyLength(tag) : timing[chokeAt]},
    tape:[{kind:'sink', from:D.sink * 16, to:(D.sink + 1) * 16, rate:[1, .5]}, {kind:'stop', from:D.stop.bar * 16 + D.stop.step, seconds:D.stop.seconds}],
    timing, finale:false, totalSteps, duration:timing[totalSteps] + .6,
    track:tr.id, trackTitle:tr.title, kicks, energyTrim,
    marks:{unmute:D.unmute * 16, build:D.ladder.rungs[0].bar * 16, rise:D.rise * 16, choke:chokeAt, impact:D.impact * 16, sink:D.sink * 16, sinkEnd:(D.sink + 1) * 16, stop:D.stop.bar * 16 + D.stop.step}};
  return coldOpen ? withColdOpen(plan) : plan;
}

// How much of a section Synergy sings: the share of its seconds inside his
// words (his answers in the build aside).
export function sungShare(words, timing, section) {
  const a = timing[section.from * BAR_STEPS], b = timing[section.to * BAR_STEPS];
  let sung = 0;
  for (const w of words) { if (w.line < 0) continue; const x = timing[w.at], y = x + w.gate; sung += Math.max(0, Math.min(b, y) - Math.max(a, x)); }
  return sung / (b - a);
}

// The room the verse leaves the drops (track.drop.room). On a phone the band's
// low end is gone, so what a drop has over the verse is mostly Synergy: a dense
// verse and a sparse hook in the drop flatten it. The verse steps back by the
// shortfall, measured against the post the mix was set on: for each drop,
// k * (its reference share - its share), plus kVerse * (the verse's share - its
// reference); the most any drop needs, up to `max` dB. Zero at the reference
// post; the same in the live performance and the render (the plan carries it).
function roomTrim(tr, words, timing) {
  const R = tr.drop.room;
  if (!R) return {};
  const share = name => sungShare(words, timing, tr.drop.sections.find(s => s.name === name));
  const verse = share(R.verse.section), over = (verse - R.verse.ref) * R.verse.k;
  const need = Math.max(0, ...Object.entries(R.drops).map(([name, d]) => d.k * (d.ref - share(name)) + over));
  return need > 1e-6 ? {[R.verse.section]:Math.round(Math.min(R.max, need) * 100) / 100} : {};
}

// How long one of her events sounds, as engine.js playLady() envelopes it (seconds).
export const ladyLength = e => Math.min(e.gate, (e.to - e.from) / e.rate + .01);

// The film's cold open (plan.md section 2, signature moment 1), on any track:
//   0 to 0.75 s: the impact exactly as it sounds at the drop (her impact word,
//     the drop kick, the sub, the crash), cut from the track's own render;
//   0.75 to 1 s: the last second of the ladder before the choke, played
//     backwards at 4x (a tape rewind of the track's own render);
//   from 1 s: the intro, as it plays without the cold open. The length is unchanged.
// Seconds are plan time (timing[0] = 0). transports lists the reversed span
// for the video studio, which locks its REWIND picture to it.
export const COLD_OPEN = {impact:.75, rewind:.25, rate:4};
export function withColdOpen(plan) {
  if (plan.form !== 'drop60') throw Error('The cold open belongs to the Drop Edition.');
  const T = plan.timing, impactAt = T[plan.marks.impact], choke = T[plan.marks.choke], hit = plan.lady.find(e => e.role === 'impact');
  const until = COLD_OPEN.impact, to = until + COLD_OPEN.rewind, sourceFrom = choke, sourceTo = choke - COLD_OPEN.rewind * COLD_OPEN.rate;
  const rewind = {from:until, to, rate:COLD_OPEN.rate, sourceFrom, sourceTo};
  return {...plan, coldOpen:{impact:{at:0, until, source:impactAt, word:hit ? hit.display : null, file:hit?.file ?? null}, rewind, resume:to},
    transports:[{kind:'rewind', at:until, len:to - until, audio:true, rate:COLD_OPEN.rate, sourceFrom, sourceTo}]};
}

// Seeded call-audio dropouts in the muted intro: three short holes, 40–80 ms,
// spread over however many 16ths the call lasts (Circle Back's 32 as before).
function dropouts(seed, until = 32) {
  let s = seed >>> 0;
  const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296, k = until / 32;
  return [5 + Math.floor(r() * 4), 14 + Math.floor(r() * 6), 23 + Math.floor(r() * 6)].map(at => Math.floor(at * k)).map(at => ({at, seconds:.04 + r() * .04}));
}

export function dropVoicedWords(lyrics, {track} = {}) {
  return [...new Set(trackOf(track).drop.slots(lyrics).flatMap(s => tokens(s.text).map(t => t.word)))];
}
