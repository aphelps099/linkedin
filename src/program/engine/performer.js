// The Program's "AI". Entirely local — it is the Lessons generator, the
// humanizer and the Thought Leadership Index, revealed with a typewriter so
// each performance still feels live. Nothing leaves the browser.
import {generate, linkedinify, humanize, mulberry32, LEVELS} from '../../lessons/generator.js';
import {withDefaultAnswers} from '../../lessons/categories.js';
import {scorePost} from '../../lessons/score.js';

export {LEVELS};

export function perform(kind, input, {seed = 1, level = 3} = {}){
  switch(kind){
    case 'linkedinify': return linkedinify(String(input || ''), seed);
    case 'humanize': return humanize(String(input || ''));
    case 'generate': {
      const {category, answers} = input || {};
      return generate({category, answers: withDefaultAnswers(category, answers), level, seed});
    }
    case 'score': {
      const s = scorePost(String(input || ''));
      return `**${s.index} / 100 — ${s.rank}.** ${s.markers.slice(0, 3).map(m => `${m.label} ×${m.count}`).join(', ') || 'No markers detected. Cold.'}`;
    }
    default: throw new Error(`Unknown performance: ${kind}`);
  }
}

export function score(text){ return scorePost(String(text || '')); }

export const levelName = n => (LEVELS.find(l => l.n === n) || LEVELS[2]).name;

// Reveal `text` through onChunk at roughly `cps` characters per second,
// chunked by word so markdown tokens never split mid-asterisk. Returns a
// cancel function. Honors reduced motion by revealing instantly.
export function typewrite(text, onChunk, onDone, {cps = 220} = {}){
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced || !text){ onChunk(text); onDone(); return () => {}; }
  const words = text.split(/(\s+)/);
  let i = 0, out = '', timer = null, cancelled = false;
  const tick = () => {
    if(cancelled) return;
    const w = words[i++] ?? '';
    out += w;
    onChunk(out);
    if(i >= words.length){ onDone(); return; }
    const pause = /\n\n$/.test(w) ? 420 : /\n$/.test(w) ? 180 : Math.max(18, (w.length * 1000) / cps);
    timer = setTimeout(tick, pause);
  };
  timer = setTimeout(tick, 120);
  return () => { cancelled = true; clearTimeout(timer); };
}

export const seedFrom = s => { const r = mulberry32([...String(s)].reduce((a, c) => a + c.charCodeAt(0), 7)); return Math.floor(r() * 0xffffffff); };
