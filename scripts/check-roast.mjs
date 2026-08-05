// Roast engine checks — run with: node scripts/check-roast.mjs
// 1. Coverage: every finding has a mild and a savage line in every persona.
// 2. Intensity: more heat never means fewer lines.
// 3. Clean input gets the clean verdict; determinism holds per seed.
import { roastIt } from '../src/roast/roastEngine.js';
import { PERSONAS, LINES } from '../src/roast/personas.js';

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

if(failures){ console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log(`all checks passed: ${Object.keys(LINES).length} findings × ${PERSONAS.length} personas covered, intensity sane, deterministic`);
