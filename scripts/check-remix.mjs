import assert from 'node:assert/strict';
import { optimize } from '../src/remix.js';

const post = `Know an exceptional Business Advisor—or are you one yourself?

The Northern California Small Business Development Center (NorCal SBDC) is seeking experienced Business Advisors through RFQ #2026-SBDC-03, now open through September 3, 2026.

We're looking for passionate professionals who want to make a meaningful impact by helping entrepreneurs and small businesses start, grow, access capital, and thrive across 36 Northern California counties.

Please share this opportunity or tag someone in the comments who should consider joining our network.`;

const phraseBank = Array.from({length:60}, (_, index)=>({say:`Phrase ${index}`}));
const result = optimize(post, phraseBank);

assert.equal(result.lines.length, 6);
assert.deepEqual(result.lines.map(line=>line.kind), [
  'post', 'corporate', 'post', 'corporate', 'post', 'corporate',
]);
assert.ok(result.lines.filter(line=>line.kind === 'post').every(line=>line.text.length <= 82));
assert.ok(result.lines.some(line=>/NorCal SBDC is seeking experienced Business Advisors/i.test(line.text)));
assert.ok(result.lines.filter(line=>line.kind === 'corporate').every(line=>/^[A-Z]+\.$/.test(line.text)));

console.log(result.lines.map((line, index)=>`${String(index + 1).padStart(2, '0')} ${line.text}`).join('\\n'));
