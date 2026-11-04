// The Drop Edition: 30 bars, 60.000 s at 120 BPM. Same band, same Synergy,
// plus the lady. The meeting starts muted, unmutes on Synergy's welcome, builds
// on her accelerating "Let's build.", chokes into half a second of black, and
// comes BACK. Pure: every event is decided here, before any audio exists.
import {BAR_STEPS, STEP, SWING, CHORDS, HOST, BPM, KEY, placeSlot, timingTable, hash} from './song.js';
import {tokens} from './lyrics.js';
import {slice, LADY_TABLE} from './lady-table.js';

export const DROP_BARS = 30;
export const DROP_SECTIONS = [
  {name:'Intro', from:0, to:4},
  {name:'Verse', from:4, to:12},
  {name:'Build', from:12, to:20},
  {name:'Drop A', from:20, to:23},
  {name:'Sink In', from:23, to:24},
  {name:'Drop B', from:24, to:28},
  {name:'Outro', from:28, to:30},
];
export const UNMUTE_BAR = 2;      // 4.000 s: the call audio opens on "Thanks for joining"
export const CHOKE = {bar:19, step:8};   // 39.000 s
export const IMPACT_BAR = 20;            // 40.000 s

const sectionOf = bar => DROP_SECTIONS.find(s => bar >= s.from && bar < s.to) || DROP_SECTIONS.at(-1);

// The groove tightens as the tension rises: swing .12 → 0 across the build's
// first four bars, straight through the ladder and the half-time drop, house
// shuffle again for the four-on-the-floor drop.
export function swingOf(bar) {
  if (bar >= 12 && bar < 16) return SWING * (15 - bar) / 4;
  if (bar >= 16 && bar < 24) return 0;
  return SWING;
}

// Players by bar. `drums` names the kit pattern; everything else is a flag the
// engine reads. Numbers are [start, end] of a one-bar automation.
export function dropLayers(bar) {
  const s = sectionOf(bar).name, groove = {drums:'four', kick:true, clap:true, hats:true, open:true, shaker:true, rim:false, bass:'offbeat', stabs:true, pad:false, guitar:false};
  if (s === 'Intro') return {...groove, clap:bar >= 1, open:bar >= 2, bass:bar >= 1 ? 'offbeat' : false, riser:bar === 3 ? 'short' : false};
  // The verse leaves room: open hats arrive at bar 6, the rim at 8.
  if (s === 'Verse') return {...groove, open:bar >= 6, rim:bar >= 8, holdBreath:bar === 11, light:true};
  if (s === 'Build') {
    const r = bar - 12;
    return {drums:'build', rung:r, kick:bar < 18, clap:false, hats:true, hatsStraight:bar >= 17, open:bar < 15, shaker:bar < 18, rim:false, bass:false, stabs:false, pad:true, guitar:false,
      roll:[[4, .22, .22], [4, .26, .26], [2, .30, .30], [2, .36, .36], [1, .40, .50], [1, .50, .60], [.5, .60, .75], [.5, .75, .85]][r],
      drumHp:[[30, 120], [120, 120], [120, 160], [160, 160], [160, 300], [300, 500], [500, 500], [500, 500]][r],
      riser:bar === 16 ? 'long' : false, voiceLp:bar < 16 ? 1800 : false};
  }
  if (s === 'Drop A') return {drums:'half', kick:true, clap:true, hats:true, ride:true, open:false, shaker:true, rim:bar === 22, bass:'wobble', wobble:[2, 2, 1][bar - 20], stabs:false, pad:true, guitar:false, crash:bar === 20, impact:bar === 20};
  if (s === 'Sink In') return {drums:'downbeat', kick:true, clap:false, hats:false, open:false, shaker:false, rim:false, bass:'sustain', stabs:false, pad:true, guitar:false, tape:'sink', reverseCrash:true};
  if (s === 'Drop B') return {...groove, rim:true, ride:true, pad:true, guitar:true, crash:bar === 24, fill:bar === 27};
  return {...groove, clap:bar === 28, open:bar === 28, shaker:bar === 28, bass:bar === 28 ? 'offbeat' : false, rim:false, kickUntil:bar === 29 ? 8 : 16};
}

export function dropCutoff(bar) {
  const s = sectionOf(bar).name, ramp = (a, b, i, n) => [a * (b / a) ** (i / n), a * (b / a) ** ((i + 1) / n)];
  if (s === 'Intro') return {keys:ramp(450, 3600, bar, 4), pad:[900, 900]};
  if (s === 'Build') return {keys:[2600, 2600], pad:[[600, 1200], [1200, 2000], [2000, 3000], [3000, 4200], [4200, 6000], [6000, 6000], [6000, 6000], [6000, 6000]][bar - 12]};
  if (s === 'Drop A') return {keys:[2400, 2400], pad:[700, 700]};
  if (s === 'Sink In') return {keys:[2400, 2400], pad:[1400, 500]};
  if (s === 'Outro') return {keys:ramp(3000, 420, bar - 28, 2), pad:[900, 900]};
  return {keys:[3000, 3000], pad:[1100, 1100]};
}

// Synergy's setlist for this form. Bars 12–15 are his answers to the lady.
export function dropSlots(lyrics) {
  const {hook, verses} = lyrics;
  return [
    {bar:2, text:HOST.open, kind:'host', shape:'chant'},
    {bar:4, text:verses[0], kind:'verse', shape:'rise'},
    {bar:6, text:verses[1], kind:'verse', shape:'arch'},
    {bar:8, text:hook, kind:'hook', shape:'call'},
    {bar:10, text:verses[2], kind:'verse', shape:'rise', harmony:true},
    {bar:12, startStep:8, window:8, text:hook, kind:'answer', shape:'chant'},
    {bar:13, startStep:8, window:8, text:hook, kind:'answer', shape:'chant'},
    {bar:20, startStep:4, window:28, text:hook, kind:'hook', shape:'call', harmony:true},
    // Verse 3 leaves the end of bar 25 for "Leverage"; the hook is sung once,
    // she says "Read that again.", and Synergy does exactly that.
    {bar:24, window:24, text:verses[3], kind:'verse', shape:'arch', harmony:true},
    {bar:26, window:14, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:27, startStep:8, window:8, text:hook, kind:'hook', shape:'call', harmony:true},
    {bar:28, text:HOST.close, kind:'host', shape:'chant'},
  ];
}

// The ladder climbs the pentatonic, so every rung is in key: semitones above
// the tuned base (G3).
const LADDER = [
  {bar:12, hits:[0], cut:'phrase', notes:[0]},
  {bar:13, hits:[0], cut:'phrase', notes:[0]},
  {bar:14, hits:[0, 8], cut:'phrase', notes:[0, 0]},
  {bar:15, hits:[0, 8], cut:'phrase', notes:[2, 2]},
  {bar:16, hits:[0, 4, 8, 12], cut:'letsbu', notes:[2, 2, 5, 5], blend:.15},
  {bar:17, hits:[0, 2, 4, 6, 8, 10, 12, 14], cut:'lets', notes:[5, 5, 7, 7, 7, 7, 9, 9], blend:.30},
  {bar:18, hits:[0, 2, 4, 6, 8, 10, 12, 14], cut:'le', glide:[9, 12], blend:.45},
  {bar:19, hits:Array.from({length:16}, (_, i) => i / 2), cut:'l', glide:[12, 12], blend:.60},
];

const TARGETS = [52, 55, 57];   // E3, G3, A3: tune her to the nearest of these
export function tunedRate(f0) {
  if (!f0) return 1;
  const midi = 69 + 12 * Math.log2(f0 / 440);
  const target = TARGETS.reduce((a, b) => Math.abs(b - midi) < Math.abs(a - midi) ? b : a);
  return {rate:2 ** ((target - midi) / 12), base:target};
}

// Synergy's words occupy their steps (± one step of guard); the lady sings in the gaps.
function freeAt(words, from, length) {
  return !words.some(w => w.at - 1 < from + length && from < w.at + w.steps + 1);
}

export function ladyEvents(words, table = LADY_TABLE) {
  const events = [], seconds = s => s / STEP;
  const build = table['50.wav'], circle = table['06.wav'];
  const {rate:baseRate, base} = tunedRate(build?.f0);
  for (const rung of LADDER) {
    rung.hits.forEach((h, i) => {
      const at = rung.bar * BAR_STEPS + h, period = (rung.hits[i + 1] ?? (rung.hits.length > 1 ? h + (rung.hits[1] - rung.hits[0]) : 16)) - h;
      const st = rung.glide ? rung.glide[0] + (rung.glide[1] - rung.glide[0]) * (i / Math.max(1, rung.hits.length - 1)) : rung.notes[i];
      const cut = {phrase:slice(build, 0, -1), letsbu:slice(build, 0, 1, .455), lets:slice(build, 0, 0), le:slice(build, 0, 0, .1), l:slice(build, 0, 0, .06)}[rung.cut];
      const rate = baseRate * 2 ** (st / 12), length = (cut[1] - cut[0]) / rate;
      events.push({role:'ladder', rung:rung.bar - 12, file:'50.wav', from:cut[0], to:cut[1], at, rate, gate:Math.min(length, period * STEP * .92),
        gain:build.gainDb, pan:0, blend:rung.blend || 0, midi:base + st, display:rung.cut === 'phrase' ? "LET'S BUILD." : rung.cut === 'letsbu' ? "LET'S BU-" : rung.cut === 'lets' ? "LET'S" : 'LE'});
    });
  }
  // r6: Synergy stammers on the odd 16ths between her even ones.
  // Tag, choke, silence, impact.
  // "Let's circle—" a touch quick, so the whole word lands before the silence.
  const tag = slice(circle, 0, 1), tagRate = 1.1;
  events.push({role:'tag', file:'06.wav', from:tag[0], to:tag[1], at:CHOKE.bar * BAR_STEPS + CHOKE.step, rate:tagRate, gate:Math.min(.64, (tag[1] - tag[0]) / tagRate), gain:circle.gainDb - 1, pan:0, display:"LET'S CIRCLE-"});
  const back = slice(circle, 2, 2);
  // "BACK." owns the impact, dry and loud with the machine under it; her deep
  // robotic "BACK." answers one beat later, so the two never blur into one word.
  events.push({role:'impact', file:'06.wav', from:back[0], to:back[1], at:IMPACT_BAR * BAR_STEPS, rate:1, gate:back[1] - back[0] + .02, gain:circle.gainDb + 5, pan:0, blend:.25, vocoded:.3, deep:.42, deepAt:4, root:CHORDS[0].root, midi:57, display:'BACK.'});
  // Punctuation in Synergy's gaps.
  const punct = (file, candidates, extra) => {
    const t = table[file]; if (!t) return;
    const cut = slice(t, 0, -1), length = (cut[1] - cut[0]);
    const at = candidates.find(c => freeAt(words, c, Math.ceil(seconds(length + .02))));
    // In the drops she has to cut through the band: +3 dB.
    if (at !== undefined) events.push({role:'punct', file, from:cut[0], to:cut[1], at, rate:1, gate:length + .02, gain:t.gainDb + (at >= IMPACT_BAR * BAR_STEPS ? 3 : 0), dip:at >= IMPACT_BAR * BAR_STEPS ? .6 : 0, pan:0, display:t.text.toUpperCase(), ...extra});
  };
  punct('08.wav', [21 * 16 + 12, 21 * 16 + 14, 22 * 16, 22 * 16 + 2, 22 * 16 + 4], {pan:-.25, bend:{cents:-300, at:.66, back:.96}});
  // "Let that" dry, then the room sinks under "sink in".
  const sink = table['15.wav'];
  if (sink) {
    const letThat = slice(sink, 0, 1), sinkIn = slice(sink, 2, 3);
    events.push({role:'punct', file:'15.wav', from:letThat[0], to:letThat[1], at:22 * 16 + 9, rate:1, gate:letThat[1] - letThat[0] + .02, gain:sink.gainDb, pan:0, display:'LET THAT'});
    events.push({role:'sink', file:'15.wav', from:sinkIn[0], to:sinkIn[1], at:23 * 16, rate:1, gate:2, gain:sink.gainDb, pan:0, deep:.5, root:CHORDS[3].root, display:'SINK IN'});
  }
  punct('07.wav', [25 * 16 + 10, 25 * 16 + 9, 25 * 16 + 11, 25 * 16 + 8], {pan:.25, lift:{cents:500, from:.72}});
  punct('18.wav', [27 * 16, 26 * 16 + 14, 26 * 16 + 15, 27 * 16 + 1], {pan:-.25});
  const stop = table['16.wav'];
  if (stop) {
    const cut = slice(stop, 0, -1);
    events.push({role:'stop', file:'16.wav', from:cut[0], to:cut[1], at:29 * 16 + 8, rate:1, gate:cut[1] - cut[0] + .02, gain:stop.gainDb, pan:0, display:'FULL STOP.'});
  }
  return events.sort((a, b) => a.at - b.at);
}

export function arrangeDrop(lyrics, durations, table = LADY_TABLE) {
  const lines = [], words = [];
  dropSlots(lyrics).forEach((slot, id) => {
    const placed = placeSlot(slot, lyrics, durations, id);
    lines.push(placed.line); words.push(...placed.words);
  });
  // Bars 14–15: one hook word on 4 and 12, answering her 0 and 8.
  const hookFirst = tokens(lyrics.hook)[0];
  if (hookFirst) for (const bar of [14, 15]) for (const s of [4, 12]) {
    const word = {display:hookFirst.display, word:hookFirst.word, line:-1, at:bar * 16 + s, steps:3, rate:1, gate:Math.min(.36, (durations[hookFirst.word] ?? .4)), notes:[{at:bar * 16 + s, steps:3, midi:s === 4 ? 57 : 60}], kind:'answer', harmony:false, repeat:false};
    words.push(word);
  }
  // r6: Synergy stammers the hook's first word on the odd 16ths of bar 18.
  const stutters = hookFirst ? Array.from({length:8}, (_, i) => ({word:hookFirst.word, at:18 * 16 + 2 * i + 1, steps:1, midi:[57, 57, 60, 60, 62, 62, 64, 64][i]})) : [];
  words.sort((a, b) => a.at - b.at);
  const lady = ladyEvents(words, table);
  const totalSteps = DROP_BARS * BAR_STEPS;
  const bars = Array.from({length:DROP_BARS}, (_, index) => ({index, section:sectionOf(index).name, chord:CHORDS[index % 4], layers:dropLayers(index), cutoff:dropCutoff(index), swing:swingOf(index)}));
  const timing = timingTable(totalSteps + BAR_STEPS, swingOf);
  return {form:'drop60', title:'Drop edition', bpm:BPM, step:STEP, swing:SWING, key:KEY, sections:DROP_SECTIONS, bars, lines, words, stutters, lady,
    call:{until:UNMUTE_BAR * BAR_STEPS, dropouts:dropouts(hash(lyrics.hook))}, choke:{at:CHOKE.bar * 16 + CHOKE.step, until:IMPACT_BAR * 16},
    tape:[{kind:'sink', from:23 * 16, to:24 * 16, rate:[1, .5]}, {kind:'stop', from:29 * 16 + 8, seconds:.4}],
    timing, finale:false, totalSteps, duration:timing[totalSteps] + .6};
}

// Seeded call-audio dropouts in the muted intro: three short holes, 40–80 ms.
function dropouts(seed) {
  let s = seed >>> 0;
  const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  return [5 + Math.floor(r() * 4), 14 + Math.floor(r() * 6), 23 + Math.floor(r() * 6)].map(at => ({at, seconds:.04 + r() * .04}));
}

export function dropVoicedWords(lyrics) {
  return [...new Set(dropSlots(lyrics).flatMap(s => tokens(s.text).map(t => t.word)))];
}
