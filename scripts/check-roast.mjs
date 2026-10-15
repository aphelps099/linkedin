// Roast engine checks — run with: node scripts/check-roast.mjs
// 1. Coverage: every finding has a mild and a savage line in every persona.
// 2. Intensity: more heat never means fewer lines.
// 3. Clean input gets the clean verdict; determinism holds per seed.
import { roastIt } from '../src/roast/roastEngine.js';
import { PERSONAS, LINES } from '../src/roast/personas.js';
import { annotationRanges, cleanDraft, EDITORIAL_NOTES, verdictFor } from '../src/roast/editorial.js';

let failures = 0;
const fail = msg => { failures++; console.error('FAIL ' + msg); };

for(const [key, byPersona] of Object.entries(LINES)){
  for(const p of PERSONAS){
    const e = byPersona[p.id];
    if(!e || e.length !== 2 || e.some(x => !x)) fail(`missing line: ${key}/${p.id}`);
  }
}

const SAMPLES = {
  post: `I'm humbled to announce our journey continues! Let that sink in. 🚀 It's not about the money, it's about the mission. So grateful and so proud. Agree? #blessed #synergy #growth #hustle #ai #journey`,
  headline: `Visionary 🚀 | Top Voice | ex-Google | Speaker | Author | Helping brands grow through storytelling and synergy`,
  about: `A results-driven thought leader with a proven track record who has spent 15 years wearing many hats and is passionate about delivering value at scale.`,
};
for(const [kind, text] of Object.entries(SAMPLES)){
  for(const p of PERSONAS){
    let prev = 0;
    for(const intensity of [1, 2, 3, 4]){
      const r = roastIt({ kind, text, personaId: p.id, intensity, seed: 7 });
      if(!r.lines.length) fail(`no lines: ${kind}/${p.id}@${intensity}`);
      if(r.lines.length < prev) fail(`line count dropped with heat: ${kind}/${p.id}@${intensity}`);
      prev = r.lines.length;
      if(!r.useful || !r.useful.trim()) fail(`no useful version: ${kind}/${p.id}@${intensity}`);
    }
    const a = roastIt({ kind, text, personaId: p.id, intensity: 3, seed: 99 });
    const b = roastIt({ kind, text, personaId: p.id, intensity: 3, seed: 99 });
    if(JSON.stringify(a.lines) !== JSON.stringify(b.lines) || a.opener !== b.opener)
      fail(`not deterministic per seed: ${kind}/${p.id}`);
  }
}

const clean = roastIt({ kind: 'post', text: 'We shipped the new dashboard today. It loads twice as fast. Tell us what breaks.', personaId: 'partner', intensity: 4, seed: 1 });
if(!clean.clean) fail('clean post did not receive the clean verdict');

// Arbitrary real writing must survive cleanup, including openings that the
// Lessons generator's broader humanizer intentionally discards.
const facts = [
  'I have spent 15 years at Acme. In 2025, we served 1,200 customers.',
  'My hands are still shaking. We raised $42,500 for the clinic on March 12.',
  'As a founder, you learn to listen. Priya cut costs by 18% in June.',
  'I attended the funeral of our founder, Sam, in Boston on May 3.',
  'eBay shipped its new dashboard today.',
];
for (const text of facts) if (cleanDraft(text) !== text) fail('cleanup lost factual context: ' + text);
const announcement = 'Humbled and honored to announce that I have shipped version 2.4 with Maya on October 15. Agree?';
if (cleanDraft(announcement) !== 'I have shipped version 2.4 with Maya on October 15.') fail('announcement cleanup must retain the actual update');
if (cleanDraft('Do you agree? I have thoughts?') !== 'Do you agree? I have thoughts?') fail('cleanup removed a phrase inside a sentence');
if (!cleanDraft('Agree?').trim()) fail('cleanup silently emptied a draft');
if (cleanDraft('Thrilled to announce eBay shipped version 2.4.') !== 'eBay shipped version 2.4.') fail('cleanup changed a brand name');

for (const key of Object.keys(LINES)) {
  if (key !== 'clean' && !EDITORIAL_NOTES[key]) fail('missing useful editing advice: ' + key);
}
const curly = roastIt({ kind: 'post', text: 'It’s not about a title, it’s about the work. Humbled by this journey. Agree?', personaId: 'intern', intensity: 4, seed: 9 });
if (!curly.findings.some(f => f.key === 'notx')) fail('curly apostrophes prevented detection');
const marked = annotationRanges('🚀 Humbled by this journey. Agree?', [
  { key: 'humbled' }, { key: 'journey' }, { key: 'bait' }, { key: 'rockets' },
]);
const excerpts = marked.map(r => '🚀 Humbled by this journey. Agree?'.slice(r.start, r.end));
if (excerpts.join('|') !== '🚀|Humbled|journey|Agree?') fail('annotation offsets drifted around emoji');
for (let i = 1; i < marked.length; i++) if (marked[i].start < marked[i - 1].end) fail('annotations overlap');
const overlap = annotationRanges('Speaker | Helping synergy teams grow', [
  { key: 'helping' }, { key: 'buzz' }, { key: 'speakerauthor' },
]);
if (overlap.length !== 2) fail('overlapping phrases should produce one clickable mark');
const cool = roastIt({ kind: 'post', text: SAMPLES.post, personaId: 'partner', intensity: 1, seed: 1 });
const hot = roastIt({ kind: 'post', text: SAMPLES.post, personaId: 'partner', intensity: 4, seed: 1 });
if (verdictFor(cool)[0] !== verdictFor(hot)[0]) fail('heat changed the evidence-based verdict');

if(failures){ console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log(`all checks passed: ${Object.keys(LINES).length} findings × ${PERSONAS.length} personas; factual cleanup, Unicode annotation offsets, editorial coverage, stable verdicts`);
