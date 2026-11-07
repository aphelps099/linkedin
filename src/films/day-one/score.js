// Day One: the sound. The chart and its OfflineAudioContext schedule (48 kHz
// stereo), on the film's one clock (timeline.js: ticks() and cues()).
//
// The Air lane of the constitution (src/allhands/songbook/CONSTITUTION.md): a
// Rhodes, Pat's warm bass, a soft kit with a light house pulse, Kevin's clean
// chorus guitar, Synergy's whole-note pad and Synthia's soft arpeggio. 100 BPM,
// straight, B Aeolian, a four-bar loop of Bm9 twice and Gmaj9 twice. One phrase
// is the whole vocal: "Congrats on the new role!", said once by Strategy, alone
// and dry (S1, on B22), then multiplied with the comments into a choir of
// congrats (Strategy and Synthia, each copy intoned on one note of B minor
// pentatonic, "role" one step down), choked under the robot, built into a
// 16-entry canon at the wall, thinned to nothing, and said once more, alone and
// dry, under the last comment: the identical samples. The comments are seen,
// not read aloud; the counter ticks as the song's hi-hat.
//
//   CHART                       the chart (the constitution's lint reads it: constitution.js lintRoll)
//   planChoir()                 every statement and copy: beat, take, note, level, pan, space
//   renderScore(options)        -> {sampleRate, channels:[L, R], marks, loudness}
//   renderAudio(options)        the page's call (main.jsx renderAudio): the same, plus the WAV as base64
//   encodeWav24(channels, sr)   PCM 24-bit
//
// options: {read (Node or a test: the take's bytes), parts (a list of parts to play: the rest are
// muted; 'motif' alone renders the voice stem for the null test), normalize (default true: -10 LUFS
// integrated, then master.js truePeakLimit at -1.6 dBTP: 0.3 dB under the spec's -1.3, with the air above
// 16.5 kHz rolled off, so the film's AAC 320k and the MP3 keep their true peak under -1 dBTP too)}.
//
// Deterministic: every sum is exact (exact.js), noise is seeded, the takes are decoded and
// resampled in JS; two renders are the same bytes.
import * as I from '../../allhands/instruments.js';
import {exactSession} from '../../allhands/exact.js';
import {truePeakLimit} from '../../allhands/master.js';
import {rng, hash} from '../../allhands/voices/melody.js';
import MANIFEST from './voices.json' with {type:'json'};
import {loadTakes, singTake, intoned, spoken, grats as gratsIn, resample, keyNotes, stepDown, RANGES, SPOKEN_AMOUNT} from './voices.js';
import {ticks, cues, tOf, BEAT, DURATION, EVENTS, FPS} from './timeline.js';

export const SAMPLE_RATE = 48000;
export const SECONDS = DURATION;                         // 58.8 s: 98 beats, 24.5 bars
export const BEATS = Math.round(DURATION / BEAT);
const B = tOf;                                            // beat -> seconds
const dB = x => 10 ** (x / 20);

// ---- the chart --------------------------------------------------------------------------------
const PCS = [11, 1, 2, 4, 6, 7, 9];                       // B Aeolian: B C# D E F# G A
const PENTA = [11, 2, 4, 6, 9];                           // B minor pentatonic: B D E F# A (the choir, the arp)
// Two bars each. keys: the Rhodes; guitar: Kevin's strum; pad: Synergy's whole notes; arp: Synthia's 16ths.
const CHORDS = {
  Bm9:{name:'Bm9', root:35, notes:[47, 50, 54, 57, 61], keys:[47, 50, 54, 57, 61], guitar:[47, 50, 57, 61, 66], pad:[50, 54, 57, 61],
    arp:[59, 66, 69, 71, 74, 71, 69, 66, 62, 66, 69, 74, 71, 69, 66, 62]},
  Gmaj9:{name:'Gmaj9', root:31, notes:[43, 50, 54, 57, 59], keys:[43, 50, 54, 57, 59], guitar:[43, 47, 54, 57, 62], pad:[50, 54, 57, 59],
    arp:[62, 66, 69, 74, 71, 69, 66, 62, 59, 62, 66, 69, 71, 69, 66, 62]},
};
const chordAt = bar => (bar % 4 < 2 ? CHORDS.Bm9 : CHORDS.Gmaj9);
const chordAtBeat = b => chordAt(Math.floor(b / 4 + 1e-9));

// The form: the roll (spec 2). Sections in beats.
export const SECTIONS = Object.freeze([
  {name:'Thumbnail', from:0, to:8, what:'the Rhodes alone on Bm9, its low-pass opening; the reaction burst\'s 8 soft ticks'},
  {name:'Warm', from:8, to:21, what:'Pat enters, a soft kick on 1 and 3 with a ghosted rim, Kevin\'s clean chorus strum every 2 bars; no counter'},
  {name:'Breath', from:21, to:24, what:'"Load more": everything stops but the Rhodes; Voice 1, Strategy alone and dry on B22; the ticks start on 8ths'},
  {name:'Roll', from:24, to:70, what:'four on the floor and the pump; the choir multiplies with the comments (2, 3, 4, 6, 8, then 8 to 10), the space grows, the filter opens'},
  {name:'Robot', from:70, to:74, what:'the choir choked on the beat: only the Rhodes, the kick and the ticks'},
  {name:'Wall', from:74, to:82, what:'a 16-entry canon, one entry an 8th, ticks on 16ths, the wash, everything open: the peak'},
  {name:'Thin', from:82, to:88, what:'the choir loses one voice an 8th, the space thins, the filter closes, the kick stops at B86'},
  {name:'Ring', from:88, to:91, what:'Jamie: one Rhodes Gmaj9 over a low G, left to ring; the ticks stop'},
  {name:'Silence', from:91, to:92, what:'the choke: digital silence'},
  {name:'Line', from:92, to:98, what:'one tick (1,204), then S1 again, alone and dry, the identical samples; digital silence to the end'},
]);
export const sectionAt = b => SECTIONS.find(s => b >= s.from && b < s.to) ?? SECTIONS.at(-1);

// The band, beat by beat (beats from 0). Each list is [beat, ...].
const range = (a, b, step = 1) => { const out = []; for (let x = a; x < b - 1e-9; x += step) out.push(+x.toFixed(4)); return out; };
const KICKS = [...range(8, 21, 2), ...range(24, 86)];                               // 1 and 3 in the warm block; four on the floor from B24 to B85
const PUMP_FROM = 24;
const RIMS = range(8, 21, 4).flatMap(b => [b + 1.75, b + 3.25]).filter(b => b < 21);   // ghosted, the "a" of 2 and the "e" of 4; none in the breath
const CLAPS = [...range(35, 70, 2), 48, ...range(75, 82, 2), 83, 85];               // 2 and 4 from B34 (and the downbeat of B48); none under the robot
const STRUMS = [10, 18, 26, 34, 42, 50, 58, 66, 74, 78];                            // one strum every 2 bars, on beat 3
const PRINTER = [...range(64, 70, .25), ...range(74, 82, .25)];                     // the printer (the shaker) on 16ths: wave 7 to the robot, and the wall
const ARP = [...range(52, 70, .25), ...range(74, 84, .25)];                         // Synthia from bar 13
// The Rhodes: [beat, beats long, velocity]. The thumbnail holds; the comp leans on 3-and; Jamie's chord rings.
const RHODES = [[0, 3.8, .62], [4, 2, .58], [6.5, 1.3, .48],
  ...range(8, 88, 4).flatMap(b => (b === 20 ? [[20, 1, .55], [21, 3, .3]] : [[b, 1.9, .62], [b + 2.5, 1.3, .5]])),
  [48, .9, .9],                                                                      // the stab on 340
  [88, 3.2, .55]];                                                                    // Jamie's Gmaj9, to the choke
// Pat: [beat, interval above the root (+12 octave, +7 fifth), beats, velocity].
const BASS_WARM = [[0, 0, 3.4, .55], [3.5, 7, .45, .4]];
const BASS_ROLL = [[0, 0, 1.4, .68], [1.5, 12, .4, .42], [2.5, 0, .9, .58], [3.5, 7, .4, .45]];
function bassNotes() {
  const out = [];
  for (let bar = 2; bar < 22; bar++) {
    const b0 = bar * 4, root = chordAt(bar).root, pattern = b0 < 24 ? BASS_WARM : BASS_ROLL;
    for (const [at, iv, len, v] of pattern) {
      const b = b0 + at;
      if (b < 8 || (b >= 21 && b < 24) || (b >= 70 && b < 74) || b >= 86) continue;      // the breath, the robot, the end
      out.push([b, root + iv, Math.min(len, b < 21 ? 21 - b : len), b >= 82 ? v * (1 - (b - 82) / 6) : v]);
    }
  }
  out.push([88, 31, 3, .45]);                                                        // a low G under Jamie
  return out;
}

// The space (spec 5): dry for wave 1, a room for wave 2, a plate for waves 3-5, plate and tape echo
// for waves 6-8, a wash at the wall; sends per copy (so the space thins as the choir does).
const SPACE = {voice1:{}, wave2:{room:.3}, wave3:{plate:.24}, wave4:{plate:.26}, wave5:{plate:.28}, wave6:{plate:.26, echo:.2},
  wave7:{plate:.26, echo:.22}, wave8:{plate:.26, echo:.24}, wall:{wash:.42, plate:.12, echo:.14}, final:{}};
// The width: centred for waves 1 and 2, spreading to +-0.8 at the wall.
const WIDTH = {voice1:0, wave2:0, wave3:.25, wave4:.35, wave5:.45, wave6:.55, wave7:.6, wave8:.65, wall:.8, final:0};
// Stacked chords (one note each, B minor pentatonic in the voices' ranges: Strategy B2-F#3, Synthia B3-A4).
const STACK = {3:[47, 62, 66], 4:[47, 54, 62, 66], 6:[47, 50, 54, 59, 62, 66], 8:[47, 50, 52, 54, 59, 62, 66, 69],
  9:[47, 50, 52, 54, 59, 62, 64, 66, 69], 10:[47, 50, 52, 54, 59, 62, 64, 66, 69, 47]};
// Wave 6's canon falls; the wall's climbs one pentatonic step an entry, twice, handing from Strategy to Synthia.
const CANON6 = [69, 66, 64, 62, 59, 54, 52, 50];
const WALL = [47, 50, 52, 54, 59, 62, 64, 66, 50, 52, 54, 59, 62, 64, 66, 69];
const voiceFor = midi => (midi <= RANGES.strategy[1] ? 'strategy' : 'synthia');
// The takes the choir rotates through: only those Whisper passed (voices.json; a take no spelling passed is not published).
const AVAILABLE = new Set(MANIFEST.takes.map(t => t.id));
const ROTATION = {strategy:['s2', 's3', 's1'].filter(id => AVAILABLE.has(id)), synthia:['y1', 'y2', 'y3'].filter(id => AVAILABLE.has(id))};
const HUMAN_MS = 25;
const COPY_DB = {strategy:0, synthia:-1.5};               // Synthia's Flite is brighter: she sits a little under him

// Every statement on the clock, voiced: [{B, part, wave, copies:[{take, notes:'spoken'|'intoned', midi, gainDb, pan, human, space}]}].
export function planChoir() {
  const R = rng(hash('day-one-choir')), turn = {strategy:0, synthia:0}, out = [];
  const take = voice => ROTATION[voice][turn[voice]++ % ROTATION[voice].length];
  const copy = (part, midi, n, i, forced) => {
    const voice = forced ? (forced[0] === 's' ? 'strategy' : 'synthia') : voiceFor(midi), w = WIDTH[part] ?? 0;
    const pan = part === 'wall' || part === 'wave6' ? (i % 2 ? w : -w) : n === 1 ? 0 : +(w * (i % 2 ? 1 : -1) * (.4 + .6 * (Math.floor(i / 2) + 1) / Math.ceil(n / 2))).toFixed(3);
    return {take:forced && AVAILABLE.has(forced) ? forced : take(voice), voice, asked:forced ?? undefined, notes:'intoned', midi, role:stepDown(midi), gainDb:+(-10 * Math.log10(n) + COPY_DB[voice]).toFixed(3), pan, human:+(R() * HUMAN_MS / 1000).toFixed(4), space:SPACE[part] ?? {}};
  };
  for (const c of cues()) {
    const part = c.part;
    // Voice 1 lands its "grats" on B22; the last line is placed by its first sample (cue.start: 67 ms after
    // Doug's reply and its tick appear), since after the choke there is no groove to land on.
    if (part === 'voice1' || part === 'final') { out.push({B:c.B, part, wave:part === 'voice1' ? 1 : 'final', start:c.start ?? null, copies:[{take:'s1', voice:'strategy', notes:'spoken', midi:null, gainDb:0, pan:0, human:0, space:{}, motif:true}]}); continue; }
    if (part === 'robot' || part === 'release') { out.push({B:c.B, part, wave:part, copies:[], sounding:c.copies}); continue; }
    if (part === 'wave2') { out.push({B:c.B, part, wave:2, copies:[copy(part, c.take === 's2' ? 47 : 62, c.copies, 0, c.take)]}); continue; }
    if (part === 'wave6') { out.push({B:c.B, part, wave:6, copies:[copy(part, CANON6[c.canon], c.copies, c.canon)]}); continue; }
    if (part === 'wall') { out.push({B:c.B, part, wave:'wall', copies:[copy(part, WALL[c.entry], c.copies, c.entry)]}); continue; }
    const notes = STACK[c.copies];
    if (!notes) throw Error(`No voicing for ${c.copies} copies (${part} at B${c.B}).`);
    out.push({B:c.B, part, wave:+part.replace('wave', ''), copies:notes.map((m, i) => copy(part, m, c.copies, i))});
  }
  return out;
}

export const CHART = Object.freeze({
  id:'day-one',
  form:'roll',
  title:'Day One',
  genre:'Lounge house',
  note:'100 BPM · B Aeolian · one phrase, multiplied',
  blurb:'"Congrats on the new role!", said once, alone and dry; then two hundred people say it, until it is a wall; then once more.',
  bpm:100, step:15 / 100, swing:0, key:'B aeolian',
  pitchClasses:PCS, pentatonic:PENTA,
  chords:CHORDS, chordAt,
  music:{scale:keyNotes(45, 69), home:[47, 59]},
  roll:{
    beats:BEATS, seconds:SECONDS, sections:SECTIONS, kicks:KICKS, claps:CLAPS, strums:STRUMS, printer:PRINTER, arp:ARP, rhodes:RHODES, bass:bassNotes(),
    plan:planChoir(), kickHz:61.74, pumpFrom:PUMP_FROM, ranges:RANGES, stack:STACK, canon:CANON6, wall:WALL, space:SPACE, width:WIDTH, copyDb:COPY_DB, humanMs:HUMAN_MS,
    motif:{take:'s1', at:[22, 92], amount:SPOKEN_AMOUNT}, choke:{robot:70, silence:91}, wallSpan:[74, 82], refSpan:[48, 64],
    // the filter that arranges it: [beat, Hz] (exponential between), the band's low-pass on keys, guitar, pad and arp
    filter:[[0, 380], [8, 2400], [22, 2400], [24, 2600], [48, 3000], [64, 4500], [68, 18000], [82, 18000], [86, 1700], [88, 2600]],
    // the band's energy: [beat, gain]
    energy:[[0, .8], [8, .72], [24, .6], [44, .54], [62, .56], [64, .64], [70, .72], [73.5, .72], [74, 1.05], [82, 1.05], [88, .9]],
    // the kit's own level: steady (its peaks would only feed the limiter), a little back while the choir builds
    drumsLevel:[[0, 1], [24, .68], [44, .52], [62, .54], [64, .7], [70, .82], [73.5, .82], [74, .8], [82, .8], [86, .9]],
    // at the wall the sustained parts carry the peak (their loudness costs no headroom): the pad and the arpeggio up
    wallLift:{pad:3, arp:2},
    // the choir's level (x the stem's): it grows in texture more than in level, choked under the robot (B70-B74), the peak at the wall
    choirLevel:[[0, .72], [42, .72], [43, .46], [56, .42], [63, .42], [64, .56], [69.98, .62], [70, 0], [73.1, 0], [73.15, 3.3], [82, 3.3], [86, 1.5]],
  },
  mix:{stems:{keys:{duck:.78, reverb:.12, level:1.5}, pad:{duck:.78, level:.8}, guitar:{duck:.78, reverb:.18, level:.22}, arp:{duck:.78, level:.42},
    bass:{duck:.5, level:.12}, drums:{reverb:0, level:.3}, ticks:{level:.22}, choir:{duck:.82, reverb:.42, level:.9}, voice:{reverb:0, level:.7}},
    trim:.7, glue:{threshold:-14, knee:8, ratio:2, attack:.02, release:.2}, catch:{threshold:-16, knee:6, ratio:4, attack:.002, release:.08}, choirComp:{threshold:-17, knee:6, ratio:4, attack:.002, release:.12}, tape:{drive:1.25, wow:0}, integrated:-10, ceiling:-1.6, air:16500},
  references:{
    air:'The lane: a Rhodes in Bm9 and Gmaj9, Pat\'s round bass, a clean chorus guitar, room to breathe; the choir as vocoder melancholy without the vocoder.',
    'daft-punk':'The spine, worn lightly: four on the floor from B24 and the kick pumping the pad, the keys and Pat; the filter opening the build.',
    'panda-bear':'One phrase layered into a choir, reverb-washed, delay that becomes rhythm in the canon.',
    kraftwerk:'The counter as the hi-hat: a sequenced tick on 8ths, on 16ths at the wall; one minimal motif.',
  },
  palette:{
    synth:"Synergy's whole-note pad (detuned saws and a triangle, a breathing low-pass) from B41; Synthia's soft 16th arpeggio from bar 13; the choir: Strategy (Kokoro) and Synthia (Flite) each intoned on one note, pixelated.",
    keys:'A Rhodes: Bm9 and Gmaj9, held in the thumbnail, a comp leaning on 3-and, a stab on 340, Jamie\'s Gmaj9 left to ring.',
    drums:'Ops, soft: a kick on 1 and 3 with a ghosted rim, four on the floor from B24, claps on 2 and 4 from B34 (a gang of claps at the wall); the counter\'s tick as the closed hat; the printer as the shaker.',
    bass:'Pat: a sine and a soft saw under 500 Hz, the root and its fifth, pumped by the kick; a low G under Jamie.',
    guitar:"Kevin: one clean chorus strum every two bars, on beat 3. Never a solo.",
  },
  story:{synergy:'Simple and a little stiff: whole-note chords on his new synth from B41.', synthia:'Fluent: the soft 16th arpeggio from bar 13, and her answers in the choir.'},
  // The other ten percent, declared (CONSTITUTION.md, "Day One: the roll").
  breaks:{
    'form.order':'its own form, the roll: one build to the wall, then a choke and a dry line (no verses from the post, no ladder, no impact, no Sink In, no tape stop)',
    'form.vocal':'one phrase is the whole vocal: "Congrats on the new role!", sung by everyone, Strategy and Synthia answering each other, as the comments do',
    'form.ending':'a silent tail: the choke to digital silence, the dry line alone, then silence to the end',
  },
});

// ---- the voices --------------------------------------------------------------------------------
// Each take's sung buffers, at 48 kHz, cached per (take, notes, note).
async function voiceBuffers(ctx, plan, {read} = {}) {
  const takes = await loadTakes(MANIFEST, {read}), cache = new Map();
  const bufferOf = c => {
    const key = `${c.take}|${c.notes}|${c.midi}`;
    if (cache.has(key)) return cache.get(key);
    const take = takes.get(c.take), e = take.entry;
    const notes = c.notes === 'spoken' ? spoken(e, take.track) : intoned(e, c.midi);
    const sung = singTake(take, notes, c.notes === 'spoken' ? SPOKEN_AMOUNT : e.amount), y = resample(sung, take.sampleRate, ctx.sampleRate);
    const b = ctx.createBuffer(1, y.length, ctx.sampleRate);
    b.getChannelData(0).set(y);
    const v = {buffer:b, grats:gratsIn(e), samples:y.length, notes:notes.map(n => n.midi)};
    cache.set(key, v);
    return v;
  };
  for (const s of plan) for (const c of s.copies) c.sung = bufferOf(c);
  return {takes, count:cache.size};
}

// ---- the render ---------------------------------------------------------------------------------
const ALL = ['keys', 'pad', 'guitar', 'arp', 'bass', 'drums', 'printer', 'ticks', 'choir', 'motif'];
const expRamp = (param, keys) => { param.setValueAtTime(keys[0][1], B(keys[0][0])); for (const [b, v] of keys.slice(1)) param.exponentialRampToValueAtTime(v, B(b)); };
const linRamp = (param, keys) => { param.setValueAtTime(keys[0][1], B(keys[0][0])); for (const [b, v] of keys.slice(1)) param.linearRampToValueAtTime(v, B(b)); };
function tapeCurve(drive) { const c = new Float32Array(4097); for (let i = 0; i < c.length; i++) { const x = i / 2048 - 1; c[i] = Math.tanh(x * drive) / Math.tanh(drive); } return c; }

export async function renderScore({read, parts = ALL, normalize = true} = {}) {
  const on = new Set(parts), sr = SAMPLE_RATE, N = Math.round(SECONDS * sr);
  const ctx = new OfflineAudioContext(2, N, sr), X = exactSession(ctx), S = CHART.mix.stems, R = CHART.roll;
  const plan = planChoir();
  const {count} = await voiceBuffers(ctx, plan, {read});

  // ---- the structure: buses, the space, the master
  const out = I.amp(ctx, 1); out.connect(ctx.destination);
  const glue = ctx.createDynamicsCompressor(), G = CHART.mix.glue;
  glue.threshold.value = G.threshold; glue.knee.value = G.knee; glue.ratio.value = G.ratio; glue.attack.value = G.attack; glue.release.value = G.release;
  const tape = ctx.createWaveShaper(); tape.curve = tapeCurve(CHART.mix.tape.drive); tape.oversample = '2x';
  const choke = I.amp(ctx, 1), mix = I.amp(ctx, CHART.mix.trim), post = I.amp(ctx, 1);
  // The catch: a fast compressor after the glue that takes the transients (the kick, the Rhodes' bell) before the tape.
  const catcher = ctx.createDynamicsCompressor(), Q = CHART.mix.catch;
  catcher.threshold.value = Q.threshold; catcher.knee.value = Q.knee; catcher.ratio.value = Q.ratio; catcher.attack.value = Q.attack; catcher.release.value = Q.release;
  // The air above 16.5 kHz rolled off (two 12 dB/oct stages) after the tape: the AAC and MP3 encoders' own low-pass
  // then rings less, so their true peak stays near the WAV's (it overshot by 0.5 to 0.9 dB without it).
  const air1 = I.biquad(ctx, 'lowpass', CHART.mix.air, .54), air2 = I.biquad(ctx, 'lowpass', CHART.mix.air, 1.31);
  mix.connect(glue); glue.connect(catcher); catcher.connect(tape); tape.connect(air1); air1.connect(air2); air2.connect(choke); choke.connect(out); post.connect(out);
  // The choke into digital silence (B91): after every nonlinear stage, so its zeros are exact.
  choke.gain.setValueAtTime(1, B(R.choke.silence) - .012); choke.gain.linearRampToValueAtTime(0, B(R.choke.silence));
  // The band: keys, guitar, pad and arp through the filter that arranges the song, then the pump.
  const energy = I.amp(ctx, 1); linRamp(energy.gain, R.energy); energy.connect(mix);
  const bandLp = I.biquad(ctx, 'lowpass', R.filter[0][1], .6); expRamp(bandLp.frequency, R.filter);
  const bandPump = I.amp(ctx, 1); bandLp.connect(bandPump); bandPump.connect(energy);
  const keys = I.amp(ctx, S.keys.level), pad = I.amp(ctx, 0), arp = I.amp(ctx, S.arp.level), guitarIn = I.amp(ctx, 1), guitar = I.amp(ctx, S.guitar.level);
  keys.connect(bandLp); pad.connect(bandLp); arp.connect(bandLp); guitar.connect(bandLp);
  // Synergy's pad ramps in over two bars from B41, is choked with the choir under the robot, returns for the wall, fades with the thin.
  pad.gain.setValueAtTime(0, B(41)); pad.gain.linearRampToValueAtTime(S.pad.level, B(49)); pad.gain.setValueAtTime(S.pad.level, B(70) - .008); pad.gain.linearRampToValueAtTime(0, B(70));
  pad.gain.setValueAtTime(0, B(73.5)); pad.gain.linearRampToValueAtTime(S.pad.level * R.wallLift.pad, B(74)); pad.gain.setValueAtTime(S.pad.level * R.wallLift.pad, B(82)); pad.gain.linearRampToValueAtTime(0, B(88));
  arp.gain.setValueAtTime(S.arp.level, B(73.5)); arp.gain.linearRampToValueAtTime(S.arp.level * R.wallLift.arp, B(74)); arp.gain.setValueAtTime(S.arp.level * R.wallLift.arp, B(82)); arp.gain.linearRampToValueAtTime(S.arp.level, B(84));
  // Kevin's chorus: the dry string and a copy on a slowly moving 7-13 ms delay.
  const chDelay = ctx.createDelay(.05), chLfo = ctx.createOscillator(), chDepth = I.amp(ctx, .003), chWet = I.amp(ctx, .55), chDry = I.amp(ctx, .75);
  chDelay.delayTime.value = .01; chLfo.frequency.value = .7; chLfo.connect(chDepth); chDepth.connect(chDelay.delayTime); chLfo.start(0);
  guitarIn.connect(chDry); guitarIn.connect(chDelay); chDelay.connect(chWet); chDry.connect(guitar); chWet.connect(guitar);
  // A small room for the band (the keys and the guitar), its own: the choir's space is choked with it.
  const bandRoom = ctx.createConvolver(); bandRoom.buffer = I.washImpulse(ctx, 1.3, .01, 31);
  const keysSend = I.amp(ctx, S.keys.reverb), guitarSend = I.amp(ctx, S.guitar.reverb), roomRet = I.amp(ctx, .5);
  keys.connect(keysSend); guitar.connect(guitarSend); keysSend.connect(bandRoom); guitarSend.connect(bandRoom); bandRoom.connect(roomRet); roomRet.connect(energy);
  const bass = I.amp(ctx, S.bass.level), bassPump = I.amp(ctx, 1); bass.connect(bassPump); bassPump.connect(energy);
  const drums = I.amp(ctx, S.drums.level), kit = I.amp(ctx, 1); linRamp(kit.gain, R.drumsLevel); drums.connect(kit); kit.connect(mix);
  const tickBus = I.amp(ctx, S.ticks.level); tickBus.connect(mix);
  // The choir: dry and its spaces (room, plate, tape echo, wash), choked under the robot, a little up at the wall.
  const choirDry = I.amp(ctx, 1), choirOut = I.amp(ctx, S.choir.level);
  // The choir as one instrument: a compressor after its level (so the wall's peaks are the choir's own, not the limiter's),
  // then the pump: the kick breathes the choir and its space too, from B24.
  const choirComp = ctx.createDynamicsCompressor(), CC = CHART.mix.choirComp, choirPump = I.amp(ctx, 1);
  choirComp.threshold.value = CC.threshold; choirComp.knee.value = CC.knee; choirComp.ratio.value = CC.ratio; choirComp.attack.value = CC.attack; choirComp.release.value = CC.release;
  choirDry.connect(choirOut); choirOut.connect(choirComp); choirComp.connect(choirPump); choirPump.connect(mix);
  const space = {};
  for (const [name, ir, ret] of [['room', I.washImpulse(ctx, .7, .004, 21), .6], ['plate', I.washImpulse(ctx, 2.1, .015, 23), .55], ['wash', I.washImpulse(ctx, 4.8, .14, 7), .6]]) {
    const cv = ctx.createConvolver(); cv.buffer = ir; const r = I.amp(ctx, ret); cv.connect(r); r.connect(choirOut); space[name] = cv;
  }
  const echo = ctx.createDelay(1), fb = I.amp(ctx, .34), eHp = I.biquad(ctx, 'highpass', 260), eLp = I.biquad(ctx, 'lowpass', 3000), eRet = I.amp(ctx, .5);
  echo.delayTime.value = .75 * BEAT;                     // a dotted 8th
  echo.connect(eHp); eHp.connect(eLp); eLp.connect(fb); fb.connect(echo); eLp.connect(eRet); eRet.connect(choirOut); space.echo = echo;
  linRamp(choirOut.gain, R.choirLevel.map(([b, g]) => [b, g * S.choir.level]));
  // The motif: Voice 1 and the final line through one path, after the master (no glue, no tape, no choke, no sends).
  const voice = I.amp(ctx, S.voice.level); voice.connect(post);
  // The pump (from B24): every kick ducks Pat and the band, then lets go.
  for (const b of KICKS.filter(k => k >= R.pumpFrom)) {
    const t = B(b);
    for (const [g, d] of [[bassPump.gain, S.bass.duck], [bandPump.gain, S.keys.duck], [choirPump.gain, S.choir.duck]]) { g.setTargetAtTime(d, t, .004); g.setTargetAtTime(1, t + .05, .09); }
  }
  // The pilot light: a silent constant source (exact zeros) into every bus voices come and go on, so no bus is
  // ever disabled between its voices and no stateful node after it (the chorus delay, the filter, the spaces)
  // sees its input change: without it Kevin's chorus delay rendered differently run to run.
  const pilot = ctx.createConstantSource(); pilot.offset.value = 0; pilot.start(0);
  for (const bus of [guitarIn, keys, pad, arp, bass, drums, tickBus, choirDry, voice, post, ...Object.values(space)]) pilot.connect(bus);
  X.play();

  // ---- the band
  if (on.has('keys')) for (const [b, len, v] of RHODES) I.rhodes(ctx, keys, B(b), (b >= 88 ? CHORDS.Gmaj9 : chordAtBeat(b)).keys, len * BEAT, v, {bright:b === 48 ? 1.5 : 1, level:.042});
  if (on.has('pad')) for (let bar = 10; bar < 22; bar += 2) I.warmPad(ctx, pad, B(bar * 4), chordAt(bar).pad, 2 * 4 * BEAT, 1, {cutoff:1500, attack:.8, release:1.2});
  if (on.has('guitar')) for (const b of STRUMS) I.cleanGuitar(ctx, guitarIn, B(b), chordAtBeat(b).guitar, .65, {strum:.018, ring:b === 18 ? 1.75 : b === 66 ? 2.35 : 2.6});
  if (on.has('arp')) ARP.forEach((b, i) => { const c = chordAtBeat(b); I.seqArp(ctx, arp, B(b), c.arp[i % 16], .13, (i % 4 === 0 ? .32 : .22) * (b >= 82 ? 1 - (b - 82) / 2.5 : 1), {cutoff:2200, side:i % 2 ? .25 : -.25, crushMix:.3}); });
  if (on.has('bass')) { let prev = null; for (const [b, m, len, v] of R.bass) { I.warmBass(ctx, bass, B(b), m, len * BEAT, v, {from:prev !== null && Math.abs(prev - m) === 12 ? prev : null}); prev = m; } }
  if (on.has('drums')) {
    const kick = {top:190, knee:72, settle:R.kickHz, decay:.32, click:.1, drive:2.4};           // settling on B1: the kick is in key
    for (const b of KICKS) I.tunedKick(ctx, drums, B(b), b < 24 ? .38 : b >= 82 ? .5 - (b - 82) * .035 : .52, kick);
    for (const b of RIMS) I.rim(ctx, drums, B(b), .07);
    for (const b of CLAPS) (b >= 74 && b < 82 ? I.gangClap(ctx, drums, B(b), .55, {people:4, width:.8}) : I.clap(ctx, drums, B(b), b === 48 ? .55 : b >= 82 ? .32 : .42));
  }
  if (on.has('printer')) for (const b of PRINTER) I.shaker(ctx, drums, B(b), (b >= 74 ? .26 : .12) * [1, .45, .75, .5][Math.round((b % 1) * 4) % 4]);
  // ---- the counter: every number that changes on screen ticks
  const tickList = ticks();
  if (on.has('ticks')) for (const k of tickList) {
    if (k.kind === 'final') continue;
    I.tick(ctx, tickBus, k.t, k.vel, {accent:k.accent, side:k.kind === 'burst' ? .15 : (Math.round(k.B * 4) % 2 ? .12 : -.12)});
  }
  const finalTick = tickList.find(k => k.kind === 'final');
  if (finalTick && on.has('ticks')) { const g = I.amp(ctx, S.ticks.level); g.connect(post); I.tick(ctx, g, finalTick.t, finalTick.vel, {accent:true}); }
  // ---- the choir and the motif
  const copies = [];
  for (const s of plan) for (const c of s.copies) {
    if (c.motif ? !on.has('motif') : !on.has('choir')) continue;
    const at = B(s.B) + c.human, start = Math.round((s.start != null ? s.start : at - c.sung.grats) * sr) / sr;   // on a whole sample: the same samples wherever it starts
    const src = ctx.createBufferSource(); src.buffer = c.sung.buffer;
    const g = I.amp(ctx, dB(c.gainDb));
    src.connect(g);
    if (c.motif) g.connect(voice);
    else {
      const p = ctx.createStereoPanner(); p.pan.value = c.pan; g.connect(p); p.connect(choirDry);
      for (const [name, amount] of Object.entries(c.space)) { const send = I.amp(ctx, amount); g.connect(send); send.connect(space[name]); }
    }
    src.start(start);
    copies.push({B:s.B, part:s.part, take:c.take, midi:c.midi, notes:c.sung.notes, gainDb:c.gainDb, pan:c.pan, human:c.human, start, grats:start + c.sung.grats, end:start + c.sung.samples / sr, space:c.space});
  }

  const rendered = await ctx.startRendering();
  const channels = [rendered.getChannelData(0).slice(), rendered.getChannelData(1).slice()];
  const loudness = normalize ? master(channels, sr, CHART.mix.integrated, CHART.mix.ceiling) : {integrated:lufs(channels, sr)};
  const motif = copies.filter(c => c.part === 'voice1' || c.part === 'final');
  const lastVoice = Math.max(...copies.map(c => c.end), 0);
  return {sampleRate:sr, channels, loudness, marks:{seconds:SECONDS, beats:BEATS, sections:SECTIONS.map(s => ({...s, t0:B(s.from), t1:B(s.to)})), events:EVENTS,
    grats:motif.map(c => ({B:c.B, part:c.part, take:c.take, t:c.grats, frame:Math.round(c.grats * FPS), start:c.start, end:c.end})),
    ticks:on.has('ticks') ? tickList.map(k => ({B:k.B, t:k.t, frame:k.frame, comments:k.comments, kind:k.kind, vel:k.vel, accent:k.accent})) : [],
    // The silence runs from the choke to the 1,204 tick (B92, with Doug's reply), which the last line follows by 67 ms.
    copies, buffers:count, silence:[{from:B(R.choke.silence), to:Math.min(...motif.filter(c => c.part === 'final').map(c => c.start), ...(finalTick && on.has('ticks') ? [finalTick.t] : []))}, {from:lastVoice + .05, to:SECONDS}],
    wall:R.wallSpan.map(B), ref:R.refSpan.map(B)}};
}

// The page's call (main.jsx window.__dayOne.renderAudio): the render and its WAV, base64.
export async function renderAudio(options = {}) {
  const r = await renderScore(options), bytes = encodeWav24(r.channels, r.sampleRate);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return {wav:btoa(s), sampleRate:r.sampleRate, seconds:SECONDS, loudness:r.loudness, marks:r.marks};
}

// ---- the master: -10 LUFS integrated, then the true-peak limiter --------------------------------
// BS.1770-4 at 48 kHz: K-weighting (the shelf and the RLB high-pass), 400 ms blocks every 100 ms,
// the -70 LUFS absolute gate and the -10 LU relative gate.
const K48 = [[[1.53512485958697, -2.69169618940638, 1.19839281085285], [-1.69065929318241, .73248077421585]], [[1, -2, 1], [-1.99004745483398, .99007225036621]]];
export function lufs(channels, sr = SAMPLE_RATE) {
  if (sr !== 48000) throw Error('lufs() is written for 48 kHz.');
  const n = channels[0].length, hop = sr / 10, block = 4 * hop, sums = new Float64Array(Math.ceil(n / hop));
  for (const x of channels) {
    let y = Float64Array.from(x);
    for (const [[b0, b1, b2], [a1, a2]] of K48) {
      const z = new Float64Array(n); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < n; i++) { const v = b0 * y[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = y[i]; y2 = y1; y1 = v; z[i] = v; }
      y = z;
    }
    for (let i = 0; i < n; i++) sums[Math.floor(i / hop)] += y[i] * y[i];
  }
  const blocks = [];
  for (let s = 0; s + 4 <= sums.length; s++) blocks.push((sums[s] + sums[s + 1] + sums[s + 2] + sums[s + 3]) / block);
  const L = e => -.691 + 10 * Math.log10(e);
  const abs = blocks.filter(e => L(e) > -70), mean = a => a.reduce((s, e) => s + e, 0) / a.length;
  if (!abs.length) return -Infinity;
  const rel = L(mean(abs)) - 10, gated = abs.filter(e => L(e) > rel);
  return L(mean(gated));
}
export function master(channels, sr, target = -10, ceilingDb = -1.3) {
  const raw = channels.map(c => Float32Array.from(c)), before = lufs(raw, sr);
  let gainDb = target - before, after = null, limiter = null;
  for (let pass = 0; pass < 4; pass++) {
    const y = raw.map(c => { const g = dB(gainDb), o = new Float32Array(c.length); for (let i = 0; i < c.length; i++) o[i] = c[i] * g; return o; });
    limiter = truePeakLimit(y, sr, {ceilingDb});
    after = lufs(y, sr);
    y.forEach((c, k) => channels[k].set(c));
    if (Math.abs(after - target) < .02) break;
    gainDb += target - after;
  }
  return {before:+before.toFixed(3), gainDb:+gainDb.toFixed(3), integrated:+after.toFixed(3), limiterDb:+limiter.maxReductionDb.toFixed(3)};
}

// PCM 24-bit, little-endian, no dither (digital silence stays exact zeros).
export function encodeWav24(channels, sampleRate) {
  const n = channels[0].length, k = channels.length, bytes = new Uint8Array(44 + n * k * 3), v = new DataView(bytes.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * k * 3, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, k, true); v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * k * 3, true); v.setUint16(32, k * 3, true); v.setUint16(34, 24, true);
  str(36, 'data'); v.setUint32(40, n * k * 3, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) {
    const s = Math.max(-1, Math.min(1, channels[c][i])), q = Math.max(-8388608, Math.min(8388607, Math.round(s * 8388608)));
    bytes[o] = q & 255; bytes[o + 1] = (q >> 8) & 255; bytes[o + 2] = (q >> 16) & 255; o += 3;
  }
  return bytes;
}
