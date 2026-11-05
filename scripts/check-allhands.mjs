// All Hands sound check: lyrics, arrangement and the Synergy voice endpoint.
// Pure Node; the eSpeak test is skipped where espeak-ng is not installed.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {lyricsFromPost, tokens, syllables, say, SAMPLE_POST} from '../src/allhands/lyrics.js';
import {arrange, fitPhrase, melody, voicedWords, slots, stepTime, BARS, BAR_STEPS, STEP, HOST} from '../src/allhands/song.js';
import {normalizeWords, fixStreamedWave, createAllHandsVoice, espeakWord} from '../server/allhands-voice.js';
import {arrangeDrop, dropVoicedWords, DROP_BARS, DROP_SECTIONS, swingOf, tunedRate, pitchOf, ladyLength, IMPACT_GAP} from '../src/allhands/drop.js';
import {LADY_TABLE, slice} from '../src/allhands/lady-table.js';
import {FORMS, stepAt, formPlays} from '../src/allhands/forms.js';
import {TRACKS, TRACK_ORDER, DEFAULT_TRACK, DEFAULT_CAST, LADY_ROLES, trackOf, castOf} from '../src/allhands/songbook/index.js';
import {truePeakLimit, truePeaks} from '../src/allhands/master.js';

const PENTATONIC = new Set([45, 48, 50, 52, 55, 57, 60, 62, 64]);
const POSTS = [
  SAMPLE_POST,
  `Humbled and honored to share that I've been promoted to Senior Director of Synergy. This journey taught me that leadership is a mindset, not a title. Agree? #Leadership`,
  `Our latest campaign post reached 4,200 impressions this week! Encouraged by the visibility. Thank you to our intern, Priya, for the captions. 🚀🚀`,
  `Excited to announce we leveraged AI to unlock potential across our B2B KPIs in Q3. https://example.com/post`,
  `Short post.`,
];
const fakeDurations = lyrics => Object.fromEntries(voicedWords(lyrics).map(w => [w, .18 + .11 * syllables(w)]));

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };

// Lyrics: exact excerpts, never invented, never hashtags, links or emoji.
for (const post of POSTS) {
  const l = lyricsFromPost(post);
  const words = new Set(tokens(post).map(t => t.display.toLowerCase()));
  for (const line of [l.hook, ...l.verses]) {
    ok(tokens(line).length >= 1 && tokens(line).length <= 9, `phrase length: ${line}`);
    ok(tokens(line).every(t => words.has(t.display.toLowerCase())), `exact excerpt: ${line}`);
    ok(!/#|https?:|🚀/u.test(line), `clean phrase: ${line}`);
  }
  ok(tokens(l.hook).length <= 5, `short hook: ${l.hook}`);
  ok(l.verses.length === 4, 'four verses');
}
assert.equal(lyricsFromPost(SAMPLE_POST).hook, "Let's keep building"); checks++;
assert.throws(() => lyricsFromPost('   ')); checks++;
assert.throws(() => lyricsFromPost('🚀 #growth')); checks++;

// Pronunciation: respell for eSpeak, display untouched.
assert.equal(say('ChatGPT'), 'chat G P T'); assert.equal(say('KPIs'), 'K P Is'); assert.equal(say('CRM'), 'C R M'); assert.equal(say('Synergy.'), 'Synergy'); checks += 4;
assert.equal(syllables('chat G P T'), 4); assert.equal(syllables('optimize'), 3); assert.equal(syllables('combined'), 2); checks += 3;

// Fitting: words never overlap, stay in their window and start on the grid.
for (const post of POSTS) {
  const lyrics = lyricsFromPost(post), durations = fakeDurations(lyrics);
  for (const slot of slots(lyrics)) {
    const fitted = fitPhrase(slot.text, durations, 30);
    let end = 0;
    for (const w of fitted) {
      ok(Number.isInteger(w.at) && w.at >= end, `no overlap: ${slot.text}`);
      ok(w.steps >= 2 && w.at + w.steps <= 32, `inside the slot: ${slot.text}`);
      ok(w.rate >= 1 && w.rate <= 1.35 + 1e-9, 'bounded speed-up');
      end = w.at + w.steps;
    }
  }
  const plan = arrange(lyrics, durations);
  ok(plan.words.every(w => w.notes.length >= 1 && w.notes.every(n => PENTATONIC.has(n.midi))), 'every note in A minor pentatonic');
  ok(plan.words.every(w => w.notes.every(n => n.at >= w.at && n.at + n.steps <= w.at + w.steps)), 'notes inside their word');
  ok(plan.words.every(w => w.at < BARS * BAR_STEPS), 'no word after the last bar');
  const sorted = [...plan.words].sort((a, b) => a.at - b.at);
  ok(sorted.every((w, i) => !i || w.at >= sorted[i - 1].at + sorted[i - 1].steps), 'one word at a time');
  ok(plan.lines[0].text === HOST.open && plan.lines.at(-1).text === HOST.close, 'Synergy opens and closes');
  ok(plan.stutters.length && plan.stutters.every(s => Math.floor(s.at / BAR_STEPS) === 15), 'the stammer lives in bar 16');
  ok(Math.abs(plan.duration - (stepTime(BARS * BAR_STEPS) + 3.5)) < 1e-9, 'duration includes the tail');
}

// Five words in half a bar: every word sung, none past the window, or past the 16ths the next slot gives.
{
  const d = {Who:.3, do:.2, you:.22, trust:.4, more:.35};
  const tight = fitPhrase('Who do you trust more', d, 8), given = fitPhrase('Who do you trust more', d, 8, STEP, 2);
  ok(tight.length === 5 && tight.at(-1).at + tight.at(-1).steps <= 8 && tight.every((w, i) => !i || w.at >= tight[i - 1].at + tight[i - 1].steps), 'fit: five words in eight 16ths, the shortest as single 16ths');
  ok(given.length === 5 && given.every(w => w.steps === 2) && given.at(-1).at + given.at(-1).steps === 10, 'fit: with two 16ths given, two 16ths a word, landing on the next downbeat');
  const plan = arrange({hook:'Who do you trust more', verses:['We should talk about this', 'Who do you trust more', 'We should talk about this', 'Who do you trust more']}, d);
  const sung = [...plan.words, ...plan.stutters.map(x => ({...x, gate:STEP * .8}))].sort((a, b) => a.at - b.at);
  ok(sung.every((w, i) => !i || plan.timing[sung[i - 1].at] + sung[i - 1].gate <= plan.timing[w.at] + 1e-9), 'fit: on the swung grid no word sounds into the next');
}
// A hook that fits in a bar is sung twice; the answer resolves home.
{
  const lyrics = lyricsFromPost(SAMPLE_POST), plan = arrange(lyrics, fakeDurations(lyrics));
  const hook = plan.lines.find(l => l.kind === 'hook'), first = hook.words.filter(w => !w.repeat), second = hook.words.filter(w => w.repeat);
  ok(first.length === tokens(lyrics.hook).length && second.length === first.length, 'hook repeats once');
  ok(second.every((w, i) => w.at === first[i].at + BAR_STEPS), 'repeat lands one bar later');
  ok([57, 52].includes(second.at(-1).notes.at(-1).midi), 'the answer resolves to A or E');
  ok(plan.lines.filter(l => l.kind === 'host').every(l => l.words.every(w => !w.repeat)), 'hosts speak once');
}
// Melodies are deterministic, bounded and resolve.
assert.deepEqual(melody(8, 'call', 42), melody(8, 'call', 42)); checks++;
for (const shape of ['chant', 'call', 'rise', 'arch']) {
  const tune = melody(9, shape, 7);
  ok(tune.every((n, i) => !i || Math.abs(SCALE_INDEX(n) - SCALE_INDEX(tune[i - 1])) <= 3), `${shape}: no leaps beyond a fourth of the scale`);
  ok([52, 57, 60].includes(tune.at(-1)), `${shape}: resolves`);
}
function SCALE_INDEX(m) { return [45, 48, 50, 52, 55, 57, 60, 62, 64].indexOf(m); }
ok(Math.abs(stepTime(1) - STEP * 1.12) < 1e-9 && stepTime(2) === STEP * 2, 'swing delays odd 16ths only');

// ---- Drop Edition ---------------------------------------------------------
const PENTA_OK = new Set([0, 2, 5, 7, 9, 12]);   // semitones above the tuned base: G A C D E G
for (const post of POSTS) {
  const lyrics = lyricsFromPost(post), durations = Object.fromEntries(dropVoicedWords(lyrics).map(w => [w, .18 + .11 * syllables(w)]));
  const plan = arrangeDrop(lyrics, durations), T = plan.timing;
  ok(plan.bars.length === DROP_BARS && Math.abs(T[DROP_BARS * BAR_STEPS] - 60) < 1e-9, 'drop: 30 bars, 60.000 s');
  ok(Math.abs(T[20 * BAR_STEPS] - 40) < 1e-9 && Math.abs(T[plan.choke.at] - 39) < 1e-9, 'drop: choke at 39.000 s, BACK at 40.000 s');
  ok(T.every((t, i) => !i || t > T[i - 1]), 'drop: timing strictly increases');
  ok(DROP_SECTIONS.every((x, i) => !i || x.from === DROP_SECTIONS[i - 1].to) && DROP_SECTIONS.at(-1).to === DROP_BARS, 'drop: sections tile the song');
  ok(plan.bars.every(b => b.swing === swingOf(b.index)) && swingOf(16) === 0 && swingOf(4) > 0, 'drop: straight build, swung verse');
  // Nothing sounds between the choke and the impact except the tag, which ends 0.5 s early.
  const choke = T[plan.choke.at], impact = T[plan.choke.until];
  const sounding = [...plan.words.map(w => [T[w.at], T[w.at] + w.gate]), ...plan.lady.filter(e => e.role !== 'tag').map(e => [T[Math.floor(e.at)] + (e.at % 1) * STEP, T[Math.floor(e.at)] + (e.at % 1) * STEP + e.gate])];
  ok(sounding.every(([a, b]) => b <= choke + 1e-6 || a >= impact - 1e-6), 'drop: the silence is empty');
  const tag = plan.lady.find(e => e.role === 'tag');
  ok(tag && Math.abs(T[tag.at] - 39) < 1e-9 && T[tag.at] + tag.gate <= 39.65, 'drop: the tag ends, leaving at least 350 ms of silence');
  const back = plan.lady.find(e => e.role === 'impact');
  ok(back && back.at === 20 * BAR_STEPS && back.deep > 0 && back.vocoded > 0, 'drop: BACK. on the impact, three layers');
  // The ladder: on the grid, accelerating, in key, gated inside its period.
  const ladder = plan.lady.filter(e => e.role === 'ladder');
  const {base} = tunedRate(LADY_TABLE['50.wav'].f0);
  ok(ladder.length === 42, 'drop: 42 ladder hits (bar 18 shares its 16ths with Synergy)');
  ok(ladder.every(e => (e.at * 2) % 1 === 0 && e.at >= 12 * BAR_STEPS && e.at < 19 * BAR_STEPS + 8), 'drop: ladder on the 32nd grid, before the choke');
  ok(ladder.filter(e => e.rung < 6).every(e => PENTA_OK.has(Math.round((e.midi - base) * 1e6) / 1e6)), 'drop: rungs 0–5 step through the pentatonic');
  ok(ladder.every((e, i) => !i || e.midi >= ladder[i - 1].midi - 1e-9), 'drop: the ladder only climbs');
  const perBar = [12, 13, 14, 15, 16, 17, 18, 19].map(b => ladder.filter(e => Math.floor(e.at / 16) === b).length);
  ok(perBar.join() === '1,1,2,2,4,8,8,16', 'drop: 1 bar → ½ → ¼ → ⅛ → 1/16 → 1/32');
  ok(ladder.every((e, i) => { const next = ladder[i + 1]; return !next || T[e.at | 0] + (e.at % 1) * STEP + e.gate <= T[next.at | 0] + (next.at % 1) * STEP + 1e-6; }), 'drop: each hit ends before the next');
  // The lady's punctuation waits for Synergy's gaps.
  for (const e of plan.lady.filter(x => x.role === 'punct')) {
    const span = Math.ceil(e.gate / STEP);
    ok(!plan.words.some(w => w.at - 1 < e.at + span && e.at < w.at + w.steps + 1), `drop: ${e.display} sits in a gap`);
  }
  ok(plan.lady.filter(e => e.role === 'punct').length >= 3, 'drop: at least three phrases find gaps');
  ok(plan.tape.some(x => x.kind === 'sink' && x.from === 23 * 16) && plan.tape.some(x => x.kind === 'stop' && x.from === 29 * 16 + 8), 'drop: Sink In and the tape-stop');
  ok(plan.call.until === 2 * BAR_STEPS && plan.call.dropouts.every(d => d.at < plan.call.until && d.seconds >= .04 && d.seconds <= .08), 'drop: the muted intro unmutes at 4.0 s');
  ok(plan.words.every(w => w.notes.every(n => n.midi >= 45 && n.midi <= 64)), 'drop: Synergy stays in range');
  ok(stepAt(plan, 40) === 320 && stepAt(plan, 39.999) === 319 && stepAt(plan, -1) === -1, 'drop: stepAt inverts the timing table');
}
// The measured table covers every recording, with ordered, tight word spans.
{
  const files = Array.from({length:57}, (_, i) => `${String(i + 1).padStart(2, '0')}.wav`);
  ok(files.every(f => LADY_TABLE[f] && LADY_TABLE[f].words.length), 'lady: all 57 recordings measured');
  ok(files.every(f => LADY_TABLE[f].words.every((w, i, a) => w.end > w.start && (!i || w.start >= a[i - 1].end - 1e-9))), 'lady: word spans ordered and non-overlapping');
  const [a, b] = slice(LADY_TABLE['06.wav'], 0, 1), back = slice(LADY_TABLE['06.wav'], 2, 2);
  ok(a < .05 && b > .6 && b <= back[0] + 1e-9 && back[1] - back[0] > .2, 'lady: "Let\'s circle" then "back", whole words');
}
ok(Object.keys(FORMS).join() === 'drop60,soundcheck', 'two forms');

// ---- The song book: every track performs the Drop Edition in its own key and time.
const ORDER = ['Intro', 'Verse', 'Build', 'Drop A', 'Sink In', 'Drop B', 'Outro'];
const pc = m => ((Math.round(m) % 12) + 12) % 12, midiOf = hz => 69 + 12 * Math.log2(hz / 440);
const inKey = (track, m) => track.pitchClasses.includes(pc(m)) && Math.abs(m - Math.round(m)) < 1e-6;
const nearKey = (track, hz) => { const m = midiOf(hz); return Math.abs(m - Math.round(m)) < .02 && track.pitchClasses.includes(pc(m)); };
ok(TRACK_ORDER.join() === 'circle-back,humbled-and-honored,hustle,offsite' && DEFAULT_TRACK === 'circle-back' && trackOf().id === 'circle-back' && trackOf('hustle').id === 'hustle' && trackOf('offsite').id === 'offsite', 'song book: four tracks, Circle Back by default');
assert.throws(() => trackOf('nope'), /no track called/); checks++;
for (const id of TRACK_ORDER) {
  const track = TRACKS[id], D = track.drop, STEP_T = track.step;
  ok(Math.abs(STEP_T - 15 / track.bpm) < 1e-12 && D.sections.map(x => x.name).join() === ORDER.join(), `${id}: ${track.bpm} BPM, the seven sections in order`);
  ok(D.sections[0].from === 0 && D.sections.every((x, i) => !i || x.from === D.sections[i - 1].to) && D.sections.at(-1).to === D.bars, `${id}: sections tile the form`);
  // Every chord, voicing and bass root is in the key; the melody table is too.
  for (const c of Object.values(track.chords)) ok([c.root, ...c.notes, ...(c.keys || [])].every(m => inKey(track, m)) && c.notes.length === 4, `${id}: ${c.name} in key, four choir voices`);
  ok(track.music.scale.length === 9 && track.music.scale.every(m => inKey(track, m)) && track.music.home.every(m => inKey(track, m)), `${id}: Synergy's nine-note table in key`);
  for (const [name, hz] of [['drop kick', track.sound.dropKick?.settle ?? 55], ['sub drop from', track.sound.subDrop?.from ?? 110], ['sub drop to', track.sound.subDrop?.to ?? 27.5]]) ok(nearKey(track, hz), `${id}: the ${name} (${hz} Hz) is tuned to the key`);
  for (const post of POSTS) {
    const lyrics = lyricsFromPost(post), durations = Object.fromEntries(FORMS.drop60.voiced(lyrics, {track:id}).map(w => [w, .18 + .11 * syllables(w)]));
    const plan = arrangeDrop(lyrics, durations, {track:id}), T = plan.timing, label = `${id}/${lyrics.hook}`, sp = plan.step;
    // Form length and the fields downstream reads.
    ok(plan.track === id && plan.form === 'drop60' && plan.bpm === track.bpm && plan.key === track.key && plan.step === STEP_T, `${label}: plan names its track, tempo and key`);
    ok(T instanceof Float64Array && T.length === plan.totalSteps + 17 && T.every((t, i) => !i || t > T[i - 1]) && plan.bars.length === D.bars && plan.bars.every(b => b.layers && b.chord && b.cutoff), `${label}: timing and bars`);
    ok(T[plan.totalSteps] >= 55 && T[plan.totalSteps] <= 65 && Math.abs(plan.duration - T[plan.totalSteps] - .6) < 1e-9, `${label}: ${T[plan.totalSteps].toFixed(2)} s, inside 55-65 s`);
    ok(Array.isArray(plan.lines) && Array.isArray(plan.words) && Array.isArray(plan.lady) && plan.choke && plan.tape.length === 2 && Array.isArray(plan.kicks) && plan.marks, `${label}: lines, words, lady, choke, tape, kicks, marks`);
    // The signature moments, in order.
    const m = plan.marks, host = plan.lines[0];
    ok(plan.call.until === m.unmute && host.text === HOST.open && host.words[0].at === plan.call.until, `${label}: the call unmutes on Synergy's welcome`);
    ok(plan.call.dropouts.every(d => d.at < plan.call.until), `${label}: dropouts inside the muted intro`);
    ok(plan.lines.filter(l => l.kind === 'verse' && lyrics.verses.includes(l.text)).length >= 3, `${label}: the post's verses are sung`);
    ok(m.unmute < m.build && m.build < m.choke && m.choke < m.impact && m.impact < m.sink && m.sink < m.stop && m.stop < plan.totalSteps, `${label}: unmute, ladder, choke, BACK., sink, stop, in order`);
    // The ladder: on the grid, 1 bar down to 1/32, climbing through the pentatonic, gated inside its period.
    const ladder = plan.lady.filter(e => e.role === 'ladder'), base = ladder[0].midi, penta = D.ladder.pentatonic;
    ok(ladder.every(e => (e.at * 2) % 1 === 0 && e.at >= m.build && e.at < m.choke), `${label}: ladder on the 32nd grid, between the build and the choke`);
    // (Circle Back's 1/16 is her 8ths with Synergy's stammer on the odd 16ths between them.)
    const shared16 = ladder.some(e => e.period === 2 && Math.floor(e.at / 16) === D.stutter.bar) && plan.stutters.every(x => x.at % 2 === 1);
    ok([16, 8, 4, 2, .5].every(p => ladder.some(e => e.period === p)) && (ladder.some(e => e.period === 1) || shared16), `${label}: retriggers at 1, 1/2, 1/4, 1/8, 1/16 and 1/32 bar`);
    ok(ladder.every((e, i) => !i || e.midi >= ladder[i - 1].midi - 1e-9) && Math.abs(ladder.at(-1).midi - base - 12) < 1e-9, `${label}: the ladder climbs an octave`);
    ok(ladder.filter(e => !D.ladder.rungs[e.rung].glide).every(e => penta.includes(pc(e.midi))), `${label}: every rung on the pentatonic`);
    ok(ladder.every((e, i) => { const n = ladder[i + 1]; return !n || T[e.at | 0] + (e.at % 1) * sp + e.gate <= T[n.at | 0] + (n.at % 1) * sp + 1e-6; }), `${label}: each hit ends before the next`);
    const built = LADY_TABLE[ladder[0].file], tuned = tunedRate(built.f0, D.ladder.targets);
    ok(tuned.base === base && inKey(track, base), `${label}: her ladder tuned to ${base}, in key`);
    // Each cut is tuned by the pitch of what it plays (lady-pitch.json), not the phrase's median.
    const sung = e => pitchOf(e.file, e.from, e.from + e.gate * e.rate);
    ok(ladder.every(e => sung(e) === null || Math.abs(sung(e) + 12 * Math.log2(e.rate) - e.midi) < .02), `${label}: every rung's played audio lands on its declared note`);
    // choke.tagEnd: when her tag stops sounding, from its gate and release.
    const tagEv = plan.lady.find(e => e.role === 'tag');
    // The choke is where her tag starts: a 128th of a straight bar, on the lady's clock (choke.time).
    const ct = T[Math.floor(plan.choke.at)] + (plan.choke.at % 1) * sp;
    ok((plan.choke.at * 8) % 1 === 0 && plan.choke.time === ct && plan.bars[Math.floor(plan.choke.at / 16)].swing === 0, `${label}: the choke at ${Math.floor(plan.choke.at / 16)}:${plan.choke.at % 16} (${ct.toFixed(3)} s), a 128th of a straight bar`);
    ok(Math.abs(plan.choke.tagEnd - (ct + ladyLength(tagEv))) < 1e-9 && plan.choke.tagEnd > ct && plan.choke.tagEnd < T[plan.choke.until] - .35, `${label}: choke.tagEnd ${plan.choke.tagEnd.toFixed(3)} s, when her tag stops`);
    // The cold open: off unless asked for; asked for, the impact, then the ladder's last second rewound at 4x.
    const cold = arrangeDrop(lyrics, durations, {track, coldOpen:true}), co = cold.coldOpen, rw = co && co.rewind;
    ok(!plan.coldOpen && !plan.transports && co && co.impact.at === 0 && co.impact.until === .75 && Math.abs(co.impact.source - T[plan.marks.impact]) < 1e-12 && co.resume === 1
      && rw.from === .75 && rw.to === 1 && rw.rate === 4 && Math.abs(rw.sourceFrom - rw.sourceTo - (rw.to - rw.from) * rw.rate) < 1e-12 && rw.sourceTo >= T[plan.marks.build] && rw.sourceFrom <= plan.choke.time + 1e-12
      && cold.transports.length === 1 && cold.transports[0].kind === 'rewind' && cold.transports[0].audio === true && cold.transports[0].at === .75 && cold.transports[0].len === .25
      && cold.duration === plan.duration && JSON.stringify(cold.lady) === JSON.stringify(plan.lady), `${label}: the cold open (impact 0-0.75 s, rewind of ${rw?.sourceFrom.toFixed(2)}-${rw?.sourceTo.toFixed(2)} s at 4x, the song from 1 s)`);
    // The choke: silence after the tag, nothing sounding, then BACK. on the impact.
    const choke = plan.choke.time, impact = T[plan.choke.until], tag = plan.lady.find(e => e.role === 'tag');
    const sounding = [...plan.words.map(w => [T[w.at], T[w.at] + w.gate]), ...plan.lady.filter(e => e.role !== 'tag').map(e => [T[Math.floor(e.at)] + (e.at % 1) * sp, T[Math.floor(e.at)] + (e.at % 1) * sp + e.gate])];
    ok(sounding.every(([a, b]) => b <= choke + 1e-6 || a >= impact - 1e-6), `${label}: the silence is empty`);
    // Aaron's note: every track waits Circle Back's 0.39 s from the end of her tag to BACK. (drop.js IMPACT_GAP).
    const gap = impact - plan.choke.tagEnd;
    ok(tag.at === plan.choke.at && Math.abs(gap - plan.choke.gap) < 1e-9 && gap >= IMPACT_GAP.min && gap <= IMPACT_GAP.max, `${label}: ${(gap * 1000).toFixed(0)} ms from the end of her tag to BACK.`);
    // Circle Back's board keeps today's 0.49 s; the other tracks go dark once the tag has ended.
    ok(id === 'circle-back' ? plan.choke.dark === choke + .49 : plan.choke.dark >= choke + tag.gate - 1e-9 && plan.choke.dark < impact, `${label}: the board goes dark on time`);
    if (D.tag.tune) ok(nearKey(track, LADY_TABLE[tag.file].f0 * tag.rate) || tag.rate > 1.16, `${label}: her tag tuned into the key (rate ${tag.rate.toFixed(3)})`);
    const back = plan.lady.find(e => e.role === 'impact');
    ok(back.at === m.impact && back.deep > 0 && back.vocoded > 0 && inKey(track, back.root) && inKey(track, back.midi) && back.root === plan.bars[D.impact].chord.root, `${label}: BACK. on the impact, its deep voice on the chord's root`);
    ok(plan.bars[D.impact].layers.impact && plan.kicks.includes(m.impact), `${label}: the drop kick on BACK.`);
    const sink = plan.lady.find(e => e.role === 'sink');
    ok(sink.at === m.sink && sink.deep > 0 && inKey(track, sink.root) && Math.abs(sink.gate - 16 * sp) < 1e-9, `${label}: Sink In, deep, on its bar`);
    ok(D.tuneComb ? [back, sink].every(e => nearKey(track, e.comb)) : [back, sink].every(e => e.comb === undefined), `${label}: the deep voice's comb rings in key`);
    ok(plan.tape[0].kind === 'sink' && plan.tape[0].from === m.sink && plan.tape[1].kind === 'stop' && plan.tape[1].from === m.stop && plan.lady.some(e => e.role === 'stop' && Math.abs(T[m.stop] - (D.stop.lead ?? 0) - (T[Math.floor(e.at)] + (e.at % 1) * sp)) < sp / 16), `${label}: Sink In varispeed, then the tape stops on her stop phrase${D.stop.lead ? ` (she leads it by ${(D.stop.lead * 1000).toFixed(0)} ms)` : ''}`);
    ok(plan.bars.some(b => b.section === 'Drop A' && b.layers.bass) && plan.bars.some(b => b.section === 'Drop B' && b.layers.bass), `${label}: two drops`);
    // Every sung note in the scale, on the chord under it.
    for (const w of plan.words) for (const n of w.notes) { const c = plan.bars[Math.floor(n.at / 16)].chord; ok(inKey(track, n.midi) && (!c.avail || c.avail.includes(pc(n.midi))), `${label}: "${w.display}" ${n.midi} sits on ${c.name}`); }
    for (const x of plan.stutters) { const c = plan.bars[Math.floor(x.at / 16)].chord; ok(inKey(track, x.midi) && (!c.avail || c.avail.includes(pc(x.midi))), `${label}: stammer ${x.midi} on ${c.name}`); }
    ok(plan.bars.every(b => [b.chord.root, ...b.chord.notes].every(x => inKey(track, x))), `${label}: every bar's chord in key`);
    // The lady's punctuation waits for Synergy's gaps.
    for (const e of plan.lady.filter(x => x.role === 'punct')) ok(!plan.words.some(w => w.at - 1 < e.at + Math.ceil(e.gate / sp) && e.at < w.at + w.steps + 1), `${label}: ${e.display} sits in a gap`);
    ok(plan.kicks.every((k, i) => k >= 0 && k <= plan.totalSteps && (!i || k > plan.kicks[i - 1])), `${label}: kicks sorted, inside the song`);
    // Deterministic: the same post arranges the same song.
    const again = arrangeDrop(lyrics, durations, {track:id}), json = x => JSON.stringify(x, (k, v) => v instanceof Float64Array ? Array.from(v) : v);
    ok(json(again) === json(plan), `${label}: deterministic`);
  }
}
// Offsite: voices are the instrument. The band adds her voices to the plan's (offsite.js voicesOf): a
// round around her ladder that tightens toward the choke, and a chant of her impact word in the drops.
// Every one is on the pentatonic, the round is gone before the choke (nothing in the silence), the
// chant sings only in the drops and never over her own lines, and BACK. is the track's own (a stomp
// and a bloom of voices: no drop kick, no sub drop).
{
  const tr = TRACKS.offsite, penta = tr.drop.ladder.pentatonic, json = x => JSON.stringify(x, (k, v) => k === 'cut' ? `${v.role}@${v.at}` : v);
  ok(typeof tr.band.impact === 'function' && typeof tr.band.graph === 'function' && !tr.sound.subDrop && !tr.sound.sawRiser, 'Offsite: BACK. on its own stomp and bloom, no sub drop, no saw riser');
  for (const post of POSTS) {
    const lyrics = lyricsFromPost(post), durations = Object.fromEntries(FORMS.drop60.voiced(lyrics, {track:'offsite'}).map(w => [w, .18 + .11 * syllables(w)]));
    const plan = arrangeDrop(lyrics, durations, {track:'offsite'}), T = plan.timing, sp = plan.step, at = x => T[Math.floor(x)] + (x % 1) * sp, label = `offsite/${lyrics.hook}`;
    const voices = [...tr.voicesOf(plan).values()].flat(), round = voices.filter(v => v.role === 'round'), chant = voices.filter(v => v.role === 'chant');
    ok(round.length >= 20 && round.every(v => penta.includes(pc(v.midi)) && v.cut.role === 'ladder' && v.at >= plan.marks.build && at(v.at) + v.gate <= plan.choke.time + 1e-6),
      `${label}: ${round.length} voices of her round, on the pentatonic, gone before the choke`);
    // The round tightens: each bar's latest entry after its hit comes sooner (a beat, then an 8th, then with her).
    const lag = [9, 10, 11, 12, 13, 14].map(bar => Math.max(0, ...round.filter(v => Math.floor(v.cut.at / 16) === bar).map(v => v.at - v.cut.at)));
    ok(lag.every((x, i) => !i || x <= lag[i - 1]) && lag[0] >= 8 && lag.at(-1) === 0, `${label}: the round tightens toward the choke (latest entry ${lag.join(', ')} 16ths after her hit)`);
    const hers = plan.lady.filter(e => !['ladder', 'tag', 'impact'].includes(e.role));
    ok(chant.length >= 8 && chant.every(v => /^Drop/.test(plan.bars[Math.floor(v.at / 16)].section) && penta.includes(pc(v.midi)) && v.cut.role === 'impact')
      && chant.every(v => !hers.some(e => at(v.at) < at(e.at) + ladyLength(e) && at(e.at) < at(v.at) + v.gate)), `${label}: ${chant.length} chant voices, in the drops only, on the pentatonic, never over her own lines`);
    ok(json([...tr.voicesOf(arrangeDrop(lyrics, durations, {track:'offsite'})).values()].flat()) === json(voices), `${label}: her extra voices are deterministic`);
  }
}
// Sound check 00 is Circle Back's alone.
assert.throws(() => FORMS.soundcheck.arrange(lyricsFromPost(SAMPLE_POST), {}, {track:'hustle'}), /Sound check 00/); checks++;
ok(formPlays('soundcheck', 'circle-back') && !formPlays('soundcheck', 'hustle') && formPlays('drop60', 'hustle'), 'forms know which tracks play them');
// The cast seam: roles can be recast; the default cast is today's.
{
  const lyrics = lyricsFromPost(SAMPLE_POST), durations = Object.fromEntries(dropVoicedWords(lyrics).map(w => [w, .18 + .11 * syllables(w)]));
  const plain = arrangeDrop(lyrics, durations), cast = arrangeDrop(lyrics, durations, {cast:DEFAULT_CAST}), json = x => JSON.stringify(x, (k, v) => v instanceof Float64Array ? Array.from(v) : v);
  ok(json(plain) === json(cast) && json(plain) === json(arrangeDrop(lyrics, durations, LADY_TABLE, {track:'circle-back'})), 'cast: the default cast is today\'s choices');
  ok(LADY_ROLES.join() === 'ladder,tag,impact,bend,sink,lift,punct,stop' && LADY_ROLES.every(r => DEFAULT_CAST[r] && LADY_TABLE[DEFAULT_CAST[r].file]), 'cast: eight roles, all recorded');
  const recast = arrangeDrop(lyrics, durations, {track:'hustle', cast:{ladder:{file:'05.wav', words:[0, 0], display:'SYNERGY'}, punct:{file:'48.wav', words:[0, -1]}, lift:null}});
  const lad = recast.lady.filter(e => e.role === 'ladder');
  // 49 hits: the last rung retriggers on to the choke, where her tag now starts (19:7.375; it was 46 to 19:6).
  ok(lad.length === 49 && lad.every(e => e.file === '05.wav') && lad[0].display === 'SYNERGY' && !recast.lady.some(e => e.file === '07.wav'), 'cast: a recast ladder, a role left out');
  ok(lad.every(e => TRACKS.hustle.drop.ladder.pentatonic.includes(pc(e.midi))), 'cast: a recast ladder is still in key');
  assert.throws(() => castOf({chorus:{file:'01.wav'}}), /Unknown lady role/); assert.throws(() => castOf({tag:{file:'x'}}), /NN.wav/); checks += 2;
}
// The true-peak limiter keeps an over-full-scale signal under its ceiling.
{
  const sr = 44100, a = new Float32Array(sr), b = new Float32Array(sr);
  for (let i = 0; i < sr; i++) { a[i] = 1.2 * Math.sin(2 * Math.PI * 11025 * i / sr + Math.PI / 4); b[i] = .3 * Math.sin(2 * Math.PI * 440 * i / sr); }
  truePeakLimit([a, b], sr, {ceilingDb:-1.3});
  const peak = Math.max(...truePeaks(a).slice(200, -200), ...truePeaks(b).slice(200, -200));
  ok(20 * Math.log10(peak) <= -1.29, 'limiter: true peak under -1.3 dBTP');
}

// The endpoint: validation, streamed-WAV repair, caching, limits.
assert.deepEqual(normalizeWords(['Synergy', 'chat G P T', 'Synergy']), ['Synergy', 'chat G P T']); checks++;
for (const bad of [[], ['-v'], ['a  b'], ['x'.repeat(41)], ['<script>'], Array(65).fill('a'), 'word']) assert.throws(() => normalizeWords(bad)); checks += 7;
{
  const header = Buffer.alloc(44); header.write('RIFF', 0); header.writeUInt32LE(0x7ffff000, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16); header.write('data', 36); header.writeUInt32LE(0x7ffff000, 40);
  const fixed = fixStreamedWave(Buffer.concat([header, Buffer.alloc(100)]));
  assert.equal(fixed.readUInt32LE(4), 136); assert.equal(fixed.readUInt32LE(40), 100); checks += 2;
}
{
  let calls = 0;
  const wavBytes = Buffer.from('RIFF0000WAVE');
  const service = createAllHandsVoice({synthesize:async w => { calls++; return Buffer.concat([wavBytes, Buffer.from(w)]); }, requestLimit:2});
  const call = async body => {
    let status = 200, json;
    const req = {body, ip:'1.2.3.4', headers:{'content-type':'application/json'}};
    const res = {status(s) { status = s; return this; }, set() { return this; }, json(j) { json = j; }};
    const layer = service.router.stack.find(l => l.route?.path === '/').route.stack.at(-1).handle;
    await layer(req, res);
    return {status, json};
  };
  const first = await call({words:['alignment', 'synergy']});
  assert.equal(first.status, 200); assert.deepEqual(Object.keys(first.json.words), ['alignment', 'synergy']);
  await call({words:['alignment']});
  assert.equal(calls, 2, 'cached takes are reused');
  assert.equal((await call({words:['x']})).status, 429, 'rate limited');
  checks += 4;
}
try {
  execFileSync('espeak-ng', ['--version'], {stdio:'ignore'});
  const take = await espeakWord('synergy');
  ok(take.toString('ascii', 0, 4) === 'RIFF' && take.readUInt32LE(4) === take.length - 8, 'eSpeak take is a valid WAV');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  console.log('espeak-ng not installed: skipped the live voice check');
}

console.log(`All Hands: ${checks} checks passed.`);
