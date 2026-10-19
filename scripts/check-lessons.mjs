// LinkedIn Lessons engine checks — run with: node scripts/check-lessons.mjs
// 1. The dial's promise: the Thought Leadership Index must not drop when the
//    LinkedInification level rises (small jitter tolerated).
// 2. Replay depth: across seeds, Regenerate must actually produce variety.
// 3. The humanizer: level-5 dressing must not survive Make It Human.
import { generate, humanize } from '../src/lessons/generator.js';
import { scorePost } from '../src/lessons/score.js';
import { generateStage } from '../src/lessons/stages.js';

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

// 4 — the two-stage UI earns its scores from the generated text, keeps the
// supplied facts, and produces repeatable but varied drafts in both stages.
const stageFixtures = Object.entries(CATS).map(([category, answers]) => ({category, answers}));
for(const kind of ['A promotion', 'A product launch', 'A partnership', 'A company milestone']){
  stageFixtures.push({category:'announce', answers:{...CATS.announce, kind}});
}
for(const {category, answers} of stageFixtures){
  const drafts = {standard:new Set(), supercharged:new Set()};
  for(const seed of SEEDS){
    const first = generateStage({category, answers, seed});
    const turbo = generateStage({category, answers, seed, stage:'supercharged', minimumScore:first.score.index});
    if(first.score.index < 60 || first.score.index > 69) fail(`first stage outside 60s: ${category}, ${answers.kind}, ${seed}: ${first.score.index}`);
    if(turbo.score.index < 90 || turbo.score.index > 99) fail(`turbo outside 90s: ${category}, ${answers.kind}, ${seed}: ${turbo.score.index}`);
    for(const [stage, result] of [['standard',first], ['supercharged',turbo]]){
      if(result.score.index !== scorePost(result.text).index) fail(`score does not match text: ${category} ${stage}`);
      if(result.text !== generateStage({category, answers, seed, stage}).text) fail(`unstable draft: ${category} ${stage}`);
      const facts = category==='announce' ? ['name','company'] : category==='lesson' ? ['moment','lesson'] : category==='sell' ? ['customer','offer','result'] : category==='urgency' ? ['thing','scarcity'] : ['tool','task','multiplier'];
      for(const key of facts) if(!result.text.toLowerCase().includes(answers[key].trim().replace(/[.!?]+$/, '').toLowerCase())) fail(`lost ${key}: ${category} ${answers.kind||''} ${stage}`);
      drafts[stage].add(result.text);
    }
    if(answers.kind==='A promotion' && (!turbo.text.includes('promoted to') || /new hire|not a hire|most hires|officially joined/i.test(turbo.text))) fail('supercharge turned a promotion into a hire');
  }
  for(const [stage,texts] of Object.entries(drafts)) if(texts.size<SEEDS.length-2) fail(`low staged variety: ${category} ${stage}`);
}
// The targets are not hard-coded display values, even for atypically long facts.
const longAnswers = {...CATS.announce, quality:'careful work and good attention to people '.repeat(30)};
for(const stage of ['standard','supercharged']){
  const result = generateStage({category:'announce',answers:longAnswers,seed:42,stage});
  if(result.score.index !== scorePost(result.text).index || !result.text.includes(longAnswers.quality.trim())) fail('long facts were truncated or their score was fabricated');
}

// Blank fields must describe the facts visible in the editor, across categories.
const defaults = [
  ['announce', {kind:'A new hire'}, ['Taylor','Marketing Coordinator','Acme Inc']],
  ['announce', {kind:'A promotion'}, ['Taylor','Marketing Coordinator','Acme Inc']],
  ['announce', {kind:'A product launch'}, ['FlowDeck','plan their week in five minutes','Acme Inc']],
  ['announce', {kind:'A partnership'}, ['Northwind Systems','save customers an hour a day','Acme Inc']],
  ['announce', {kind:'A company milestone'}, ['10,000 customers','ship the new platform','Acme Inc']],
  ['sell', {}, ['Dana','Pipeline consulting','312% more qualified leads']],
  ['ai', {}, ['ChatGPT','write our quarterly report']],
];
for(const [category,answers,facts] of defaults){
  const text=generateStage({category,answers,seed:42}).text.toLowerCase();
  for(const fact of facts) if(!text.includes(fact.toLowerCase())) fail(`default mismatch: ${category} ${answers.kind||''}: ${fact}`);
}
const edited=generateStage({category:'announce',answers:{kind:'A new hire',name:'Morgan'},seed:42}).text;
if(!edited.includes('Morgan')||edited.includes('Taylor')) fail('default overrode an edited name');
const cleared=generateStage({category:'announce',answers:{kind:'A new hire',name:'  '},seed:42}).text;
if(!cleared.includes('Taylor')) fail('cleared name did not return to Taylor');

if(failures){ console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('all checks passed: levels, variety, humanizer, two-stage scores, fact preservation, matching defaults');
