// LinkedIn Lessons engine checks — run with: node scripts/check-lessons.mjs
// 1. The dial's promise: the Thought Leadership Index must not drop when the
//    LinkedInification level rises (small jitter tolerated).
// 2. Replay depth: across seeds, Regenerate must actually produce variety.
// 3. The humanizer: level-5 dressing must not survive Make It Human.
import { generate, humanize } from '../src/lessons/generator.js';
import { scorePost } from '../src/lessons/score.js';

const CATS = {
  announce: { kind: 'A new hire', name: 'Sarah', role: 'Marketing Coordinator',
    before: 'A local nonprofit', quality: 'relentless organization', goal: 'improve our content', company: 'Acme Inc.' },
  lesson: { source: 'A stranger at the airport', moment: 'A stranger gave me his sandwich',
    lesson: 'Generosity scales', topic: 'B2B sales' },
  sell: { offer: 'pipeline consulting', customer: 'Dana', problem: 'a leaky funnel',
    result: '312% more leads', cta: 'DM me' },
  urgency: { kind: "We're hiring", thing: 'a Senior Designer role', scarcity: '48 hours', audience: 'designers' },
  ai: { tool: 'ChatGPT', task: 'write our board deck', multiplier: '10x', doomed: 'consulting' },
};
const SEEDS = [1, 42, 777, 1234, 55555, 987654, 31337, 2026];
let failures = 0;
const fail = msg => { failures++; console.error('FAIL ' + msg); };

// 1 — monotonicity (tolerate a 4-point dip for density noise)
for(const [cat, answers] of Object.entries(CATS)){
  for(const seed of SEEDS){
    const idx = [1, 2, 3, 4, 5].map(level => scorePost(generate({ category: cat, answers, level, seed, flags: {} })).index);
    if(!idx.every((v, i) => i === 0 || v >= idx[i - 1] - 4))
      fail(`dial not monotone: ${cat} seed=${seed}: ${idx.join(' → ')}`);
  }
}

// 2 — variety: at levels 3–5, most seeds should produce distinct posts
for(const [cat, answers] of Object.entries(CATS)){
  for(const level of [3, 4, 5]){
    const texts = new Set(SEEDS.map(seed => generate({ category: cat, answers, level, seed, flags: {} })));
    if(texts.size < SEEDS.length - 2)
      fail(`low variety: ${cat} L${level}: ${texts.size}/${SEEDS.length} distinct`);
  }
}

// 3 — humanize strips level-5 dressing down to something publishable
const BANNED = /(let that sink in|read that again|inflection point|destiny|movement|singularity|stop scrolling|humbled|blessed|🙏|🚀)/i;
for(const [cat, answers] of Object.entries(CATS)){
  for(const seed of SEEDS){
    const human = humanize(generate({ category: cat, answers, level: 5, seed, flags: { synergy: 1, struggle: true } }));
    const m = human.match(BANNED);
    if(m) fail(`dressing survived humanize: ${cat} seed=${seed}: "${m[0]}"`);
    if(scorePost(human).index > 35) fail(`humanized post still scores ${scorePost(human).index}: ${cat} seed=${seed}`);
  }
}

if(failures){ console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('all checks passed: dial monotone, variety present, humanizer clean');
