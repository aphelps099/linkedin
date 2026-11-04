// All Hands sound check: lyrics, arrangement and the Synergy voice endpoint.
// Pure Node; the eSpeak test is skipped where espeak-ng is not installed.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {lyricsFromPost, tokens, syllables, say, SAMPLE_POST} from '../src/allhands/lyrics.js';
import {arrange, fitPhrase, melody, voicedWords, slots, stepTime, BARS, BAR_STEPS, STEP, HOST} from '../src/allhands/song.js';
import {normalizeWords, fixStreamedWave, createAllHandsVoice, espeakWord} from '../server/allhands-voice.js';
import {arrangeDrop, dropVoicedWords, DROP_BARS, DROP_SECTIONS, swingOf, tunedRate} from '../src/allhands/drop.js';
import {LADY_TABLE, slice} from '../src/allhands/lady-table.js';
import {FORMS, stepAt} from '../src/allhands/forms.js';
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
assert.deepEqual(slice(LADY_TABLE['06.wav'], 0, 1), [.015, .7]); checks++;
ok(Object.keys(FORMS).join() === 'drop60,soundcheck', 'two forms');
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
