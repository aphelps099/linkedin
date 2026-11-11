// SYNERGY.EXE level check. Proves, with the game's own physics, that every
// floor can be finished: each phrase, mug, desk and lift is reachable from the
// spawn, and there is no ledge a player can drop onto and never leave.
//
//   node scripts/check-game.mjs            check
//   node scripts/check-game.mjs --maps     also print each floor with its reachable tiles

import { FLOORS, WORDS, MEETING, INTRO, parseFloor, T } from '../src/game/level.js';
import { explore, traps, goalsOf } from '../src/game/plan.js';

const show = process.argv.includes('--maps');
const problems = [];
const fail = m => problems.push(m);
const seen = new Set();

for (const def of FLOORS) {
  if (def.scene) continue;
  let f;
  try { f = parseFloor(def); } catch (e) { fail(e.message); continue; }
  for (const w of def.words) {
    if (!WORDS[w]) fail(`${def.id}: phrase "${w}" has no line in WORDS`);
    if (seen.has(w)) fail(`${def.id}: phrase "${w}" appears on two floors`);
    seen.add(w);
  }
  if (!f.lift) fail(`${def.id}: no lift`);
  if (def.lift === 'post' && !f.desk) fail(`${def.id}: the lift waits for a post, but there is no desk`);
  for (const z of def.zones || []) if (z.x < 0 || z.y < 0 || z.x + z.w > f.w || z.y + z.h > f.h) fail(`${def.id}: meeting room "${z.name}" leaves the map`);

  const goals = goalsOf(f), r = explore(f, f.spawn, goals);
  for (const g of goals) if (!r.reached.has(g.id)) fail(`${def.id}: cannot reach ${g.id}`);
  if (f.lift && r.reached.has('lift')) {
    const stuck = traps(f, r, 'lift', goals);
    if (stuck.length) fail(`${def.id}: ${stuck.length} tiles with no way back to the lift, e.g. ${stuck.slice(0, 4).map(n => `${n.cx},${n.cy}`).join(' ')}`);
  }
  const frames = id => (r.route(id) || []).reduce((n, e) => n + e.frames, 0);
  console.log(`${def.no} ${def.name.padEnd(16)} ${f.w}x${f.h}  ${r.nodes.length} standing tiles  ` +
    goals.map(g => `${g.id.replace('word:', '')} ${r.reached.has(g.id) ? (frames(g.id) / 120).toFixed(1) + 's' : 'NO'}`).join('  '));
  if (show) {
    const mark = new Set(r.nodes.map(n => n.cy * f.w + n.cx));
    def.map.forEach((row, cy) => console.log('   ' + [...row].map((ch, cx) => mark.has((cy) * f.w + cx) && (ch === '#' || ch === '=') ? (ch === '#' ? '▓' : '▔') : ch === '.' ? ' ' : ch).join('')));
  }
}

for (const w of Object.keys(WORDS)) if (!seen.has(w)) fail(`phrase "${w}" is in WORDS but on no floor`);
if (seen.size !== 10) fail(`expected 10 phrases in the tower, found ${seen.size}`);
if (INTRO.length !== 4) fail('the break room needs four lines');
if (MEETING.prompts.length !== 3) fail('the meeting needs three prompts');

if (problems.length) { console.error('\n' + problems.map(p => 'FAIL  ' + p).join('\n')); process.exit(1); }
console.log('\nSYNERGY.EXE: every floor can be finished.');
