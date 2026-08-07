// Corporate Phrasebook checks — run with: node scripts/check-lesson.mjs
// The homepage lesson must play the SAME arc for every phrase, even though the
// recorded clips run 0.5s to 2.7s against a 2.14s bar. These checks pin that:
// 1. the stage sequence is identical for every clip length in the real bank;
// 2. slots are contiguous and bar-aligned — nothing overlaps or leaves a hole;
// 3. an utterance always gets enough whole bars to finish before the next one;
// 4. short phrases drill three times, long ones twice, so nothing drags.
import { readFileSync, readdirSync } from 'node:fs';
import { planLesson, barsFor, estimateSpeech, CUES } from '../src/v2/lesson.js';

let failures = 0;
const fail = msg => { failures++; console.error('FAIL ' + msg); };

const TEMPO = 112;
const BAR = (60 / TEMPO / 4) * 16;   // 2.142857s — the design's 134ms step × 16
if (Math.abs(BAR - 2.142857) > 1e-5) fail(`bar length drifted from the design: ${BAR}`);

// the arc the homepage promises, in order
const EXPECTED_TAIL = ['recap-cue', 'recap', 'closing-cue', 'closing', 'decay'];

// --- real clip durations, read straight from the WAV headers ---
function wavDuration(path) {
  const d = readFileSync(path);
  const ch = d.readUInt16LE(22), sr = d.readUInt32LE(24), bits = d.readUInt16LE(34);
  return (d.length - 44) / (sr * ch * (bits / 8));
}
const clips = readdirSync('public/phrases').filter(f => f.endsWith('.wav')).sort();
if (clips.length !== 57) fail(`expected 57 recorded phrases, found ${clips.length}`);
const durations = clips.map(f => wavDuration('public/phrases/' + f));
if (durations.some(d => !(d > .1 && d < 12))) fail('a clip duration looks implausible');

// --- every real phrase produces the same arc ---
for (const [i, sec] of durations.entries()) {
  const plan = planLesson({ phraseSec: sec, barSec: BAR });
  const stages = plan.slots.map(s => s.stage);
  const drills = stages.filter(s => s === 'drill').length;

  if (drills < 2 || drills > 3) fail(`clip ${clips[i]} (${sec.toFixed(2)}s) drilled ${drills} times`);
  if (stages.slice(drills).join() !== EXPECTED_TAIL.join())
    fail(`clip ${clips[i]} tail is ${stages.slice(drills).join()}`);
  if (stages.slice(0, drills).some(s => s !== 'drill'))
    fail(`clip ${clips[i]} has a non-drill in the drill run`);

  // contiguous, bar-aligned, no overlap
  let cursor = 0;
  for (const slot of plan.slots) {
    if (slot.atBar !== cursor) fail(`clip ${clips[i]} slot ${slot.stage} starts at bar ${slot.atBar}, expected ${cursor}`);
    if (!Number.isInteger(slot.atBar) || !Number.isInteger(slot.bars)) fail(`clip ${clips[i]} slot ${slot.stage} is not bar-aligned`);
    if (slot.bars < 1) fail(`clip ${clips[i]} slot ${slot.stage} claims ${slot.bars} bars`);
    cursor += slot.bars;
  }
  if (cursor !== plan.totalBars) fail(`clip ${clips[i]} total bars disagree`);

  // an utterance must fit inside the bars it claimed, or it talks over the next cue
  for (const slot of plan.slots) {
    if (['drill', 'recap', 'closing'].includes(slot.stage) && slot.bars * BAR < sec)
      fail(`clip ${clips[i]} (${sec.toFixed(2)}s) only got ${slot.bars} bar(s) for ${slot.stage}`);
  }

  // a homepage demo that outstays its welcome is a bug
  if (plan.seconds > 45) fail(`clip ${clips[i]} lesson runs ${plan.seconds.toFixed(1)}s`);
  if (plan.seconds < 8) fail(`clip ${clips[i]} lesson runs only ${plan.seconds.toFixed(1)}s`);
}

// --- the long/short split ---
if (planLesson({ phraseSec: .52, barSec: BAR }).drills !== 3) fail('a short phrase should drill three times');
if (planLesson({ phraseSec: 2.65, barSec: BAR }).drills !== 2) fail('a long phrase should drill twice');
if (planLesson({ phraseSec: .52, barSec: BAR }).phraseBars !== 1) fail('a 0.52s phrase should claim one bar');
if (planLesson({ phraseSec: 2.65, barSec: BAR }).phraseBars !== 2) fail('a 2.65s phrase should claim two bars');

// --- barsFor rounds up, never down, and never to zero ---
if (barsFor(0, BAR) !== 1) fail('a silent phrase still needs a bar');
if (barsFor(BAR * 2 - .5, BAR) !== 2) fail('barsFor should round up to 2');
if (barsFor(BAR * 2, BAR) !== 3) fail('barsFor should leave a tail past an exact fit');
for (const sec of [.1, .5, 1, 2, 3, 5, 9]) {
  if (barsFor(sec, BAR) * BAR < sec) fail(`barsFor(${sec}) does not cover the phrase`);
}

// --- explicit overrides still hold the shape ---
const forced = planLesson({ phraseSec: 1, barSec: BAR, drills: 1, cueBars: 2, decayBars: 3 });
if (forced.slots.filter(s => s.stage === 'drill').length !== 1) fail('drills override ignored');
if (forced.slots.find(s => s.stage === 'recap-cue').bars !== 2) fail('cueBars override ignored');
if (forced.slots.find(s => s.stage === 'decay').bars !== 3) fail('decayBars override ignored');
try { planLesson({ phraseSec: 1, barSec: 0 }); fail('a zero-length bar was accepted'); } catch (e) { /* correct */ }

// --- the cues are the instructional voice, and they are the words asked for ---
if (CUES.intro !== "Let's say" || CUES.recap !== 'Just say' || CUES.closing !== 'Remember')
  fail('the instructional cues changed wording');
if (!(estimateSpeech('Remember') > .6) || !(estimateSpeech('') >= .6)) fail('speech estimate is not sane');
if (estimateSpeech("Let's say") >= estimateSpeech('Couldn\'t have done it without my amazing team.'))
  fail('speech estimate does not grow with length');

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log(`Phrasebook checks pass — ${clips.length} clips, one arc, ${planLesson({ phraseSec: 1, barSec: BAR }).totalBars} bars for a short phrase.`);
