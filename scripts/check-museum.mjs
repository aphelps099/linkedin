// Museum checks — run with: node scripts/check-museum.mjs
// 1. The Redaction Office removes everything identifying and is deterministic.
// 2. Every exhibit is complete and scoreable; the archive is well-formed.
import { redact } from '../src/museum/redactor.js';
import { EXHIBITS } from '../src/museum/exhibits.js';
import { TIMELINE } from '../src/museum/timeline.js';
import { scorePost } from '../src/lessons/score.js';

let failures = 0;
const fail = msg => { failures++; console.error('FAIL ' + msg); };

const SAMPLE = `I'm humbled to announce that Sarah Chen is joining Northwind Systems as our new VP of Growth!

Sarah previously drove $4.2M in pipeline and 312% growth at Acme Corp. Reach her at sarah.chen@acme.com or @sarahgrowth, or read more at https://northwind.example/blog.

Huge thanks to Marcus Webb for making this happen. LinkedIn will never be the same. ChatGPT agrees.`;

const { text: red, redactions } = redact(SAMPLE);
for(const leaked of ['Sarah', 'Chen', 'Northwind', 'Acme', 'Marcus', 'Webb', 'sarah.chen@', 'northwind.example', '@sarahgrowth', '$4.2M', '312%', 'LinkedIn', 'ChatGPT']){
  if(red.includes(leaked)) fail(`identifying detail survived redaction: "${leaked}"`);
}
if(redactions < 8) fail(`too few redactions counted: ${redactions}`);
if(!/\[(ANONYMOUS|NAME|A REDACTED|CERTIFIED)/.test(red)) fail('no person placeholder used');
if(!/\[(REDACTED FORTUNE|A COMPANY|REDACTED STARTUP|UNDISCLOSED)/.test(red)) fail('no company placeholder used');
if(!red.includes('[THE PLATFORM]')) fail('LinkedIn not redacted to [THE PLATFORM]');
// ordinary sentences survive
if(!/joining .* as our new/.test(red)) fail('sentence structure destroyed by redaction');
// a capitalized word starting the NEXT sentence must not be eaten by the run
if(!/Huge thanks to \[/.test(red)) fail('adjacent sentence words eaten by redaction');
// "at Acme Corp" is a company, not a person
if(!/at \[(REDACTED FORTUNE|A COMPANY|REDACTED STARTUP|UNDISCLOSED)/.test(red)) fail('company after "at" misclassified');
// deterministic: same input, same output; same name, same placeholder
if(redact(SAMPLE).text !== red) fail('redaction is not deterministic');
const twice = redact('Dana met Dana at the office. Dana was pleased.').text;
const placeholders = twice.match(/\[[A-Z ]+\]/g) || [];
if(new Set(placeholders).size !== 1) fail('same name mapped to different placeholders');

if(EXHIBITS.length < 12) fail(`only ${EXHIBITS.length} exhibits`);
const nos = new Set();
for(const e of EXHIBITS){
  for(const field of ['no', 'date', 'title', 'medium', 'body', 'plaque']){
    if(!e[field] || !String(e[field]).trim()) fail(`exhibit ${e.no || '?'} missing ${field}`);
  }
  if(!e.quote || !e.quote.by || !e.quote.text) fail(`exhibit ${e.no} missing inspector quote`);
  if(nos.has(e.no)) fail(`duplicate exhibit number ${e.no}`);
  nos.add(e.no);
  const s = scorePost(e.body);
  if(!(s.index >= 0 && s.index <= 100)) fail(`exhibit ${e.no} not scoreable`);
}

if(TIMELINE.length < 10) fail(`archive too short: ${TIMELINE.length}`);
for(const t of TIMELINE){
  if(!/^\d{4}$/.test(t.year) || !t.title || !t.note) fail(`malformed archive entry: ${t.year} ${t.title}`);
}

if(failures){ console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log(`all checks passed: redactor tight and deterministic, ${EXHIBITS.length} exhibits complete, archive of ${TIMELINE.length} placards`);
