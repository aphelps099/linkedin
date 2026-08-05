// ROAST MY LINKEDIN — the engine.
// Detects findings in a post, a headline, or an About section, then renders
// them in a persona's voice at a chosen intensity. Ends with redemption:
// the version you should actually use. Entirely local.

import { LINES, FRAMES } from './personas.js';
import { humanize, mulberry32 } from '../lessons/generator.js';
import { scorePost } from '../lessons/score.js';

export const KINDS = [
  { id: 'post',     name: 'My post',     hint: 'Paste the draft. Yes, that one.' },
  { id: 'headline', name: 'My headline', hint: 'The line under your name. Pipes and all.' },
  { id: 'about',    name: 'My About',    hint: 'The autobiography nobody scrolls.' },
];

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/gu;
const count = (t, re) => (t.match(re) || []).length;
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ---- finding detection ----------------------------------------------------
// Each finding: {key, facts, w} — w orders by severity; the worst lead.

function findPost(t){
  const out = [];
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  const paras = t.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const add = (key, facts, w) => out.push({ key, facts, w });

  const journeys = count(t, /\bjourney\b/gi);
  if(journeys) add('journey', { n: journeys }, 5 + journeys);
  if(/\bhumbled\b/i.test(t)) add('humbled', {}, 8);
  if(/let that sink in|read that again/i.test(t)) add('sink', {}, 8);
  const tags = count(t, /#\w+/g);
  if(tags > 4) add('hashtags', { n: tags }, 4 + Math.min(tags, 10));
  const rockets = count(t, /🚀/gu);
  if(rockets) add('rockets', { n: rockets }, 6);
  const oneliners = paras.filter(p => p.length < 60 && !/^#/.test(p)).length;
  if(oneliners > 3) add('oneliners', { n: oneliners }, 3 + oneliners);
  if(/it'?s not (about )?[^.!?]{2,40}it'?s (about )?/i.test(t)) add('notx', {}, 9);
  if(words > 220) add('longpost', { n: words }, 7);
  if(/\b(agree\?|thoughts\?)/i.test(t)) add('bait', {}, 7);
  if(/\b(grateful|gratitude|thankful)\b/i.test(t) && /\b(proud|excited|thrilled)\b/i.test(t)) add('gratbrag', {}, 8);
  if(/\b(delve|tapestry|testament)\b/i.test(t)) add('aitells', {}, 10);
  if(/\b(5 ?a\.?m\.?|rise and grind|hustle|no days off)\b/i.test(t)) add('grindset', {}, 7);
  const buzz = count(t, /\b(synerg\w*|leverag\w*|pivot\w*|bandwidth|alignment|scalable|ecosystem|empower\w*|disrupt\w*|game-?chang\w*|cross-functional|best-in-class)\b/gi);
  if(buzz >= 3) add('buzz', { n: buzz }, 5 + buzz);
  return out;
}

function findHeadline(t){
  const out = [];
  const add = (key, facts, w) => out.push({ key, facts, w });
  const pipes = count(t, /[|·•]/g);
  if(pipes >= 2) add('pipes', { n: pipes }, 6 + pipes);
  if(/\bhelping\b.{3,60}\b(grow|scale|win|thrive|succeed|transform|tell)/i.test(t)) add('helping', {}, 8);
  const infl = t.match(/\b(visionary|guru|ninja|rockstar|wizard|evangelist|thought leader|dreamer|disruptor|growth hacker)\b/i);
  if(infl) add('inflation', { word: infl[0].toLowerCase() }, 10);
  if(/\bex-[A-Z]/.test(t)) add('exflex', {}, 7);
  if(/top voice/i.test(t)) add('topvoice', {}, 9);
  const emoji = count(t, EMOJI_RE);
  if(emoji) add('hemoji', { n: emoji }, 5 + emoji);
  if(t.length > 120) add('hlong', { n: t.length }, 7);
  const roles = ['speaker', 'author', 'investor', 'advisor', 'coach', 'podcast'].filter(r => new RegExp(`\\b${r}`, 'i').test(t)).length;
  if(roles >= 2) add('speakerauthor', { n: roles }, 8);
  return out;
}

function findAbout(t){
  const out = [];
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  const add = (key, facts, w) => out.push({ key, facts, w });
  // third person: no first-person pronouns but "is a/has been" constructions
  if(!/\b(i|my|we|our)\b/i.test(t) && /\b(is an?|has (spent|been|built|led))\b/i.test(t)) add('thirdperson', {}, 10);
  if(/passionate about/i.test(t)) add('passionate', {}, 8);
  if(/results-driven|proven track record/i.test(t)) add('resultsdriven', {}, 8);
  if(words > 180) add('along', { n: words }, 7);
  if(/wear(ing)? many hats/i.test(t)) add('manyhats', {}, 9);
  // posts' findings that also apply to bios
  for(const f of findPost(t)) if(['humbled', 'journey', 'buzz', 'aitells', 'gratbrag'].includes(f.key)) out.push(f);
  return out;
}

const FINDERS = { post: findPost, headline: findHeadline, about: findAbout };

// ---- redemption -----------------------------------------------------------

// non-global on purpose: .test() on a /g/ regex is stateful
const INFLATION = /\b(visionary|guru|ninja|rockstar|wizard|evangelist|thought leader|dreamer|disruptor|growth hacker)\b/i;

export function usefulHeadline(t){
  const segs = String(t || '').split(/\s*[|·•]\s*/)
    .map(s => s.replace(EMOJI_RE, '').replace(/️/g, '').trim())
    .filter(Boolean);
  // keep what says a job; drop badges, role collections, and title inflation
  const kept = segs.filter(s =>
    !/top voice/i.test(s)
    && !/^(speaker|author|investor|advisor|coach|podcast host)s?$/i.test(s)
    && !/^ex-/i.test(s)
    && !INFLATION.test(s)
  ).slice(0, 2);
  return (kept.length ? kept : segs.slice(0, 1)).join(' · ');
}

export function usefulVersion(kind, t){
  if(kind === 'headline') return usefulHeadline(t);
  return humanize(t); // posts and About sections both come clean the same way
}

// ---- assembly -------------------------------------------------------------

export function roastIt({ kind, text, personaId, intensity, seed }){
  const t = String(text || '').trim();
  const rng = mulberry32(seed >>> 0);
  const tier = intensity <= 2 ? 'm' : 's';
  const tierIx = tier === 'm' ? 0 : 1;
  const maxLines = [2, 4, 5, 7][Math.max(1, Math.min(4, intensity)) - 1];

  const found = (FINDERS[kind] || findPost)(t)
    .sort((a, b) => b.w - a.w)
    .slice(0, maxLines);

  const render = f => {
    const entry = (LINES[f.key] || LINES.clean)[personaId];
    const line = entry[tierIx];
    return typeof line === 'function' ? line(f.facts || {}) : line;
  };

  const lines = found.length
    ? found.map(render)
    : [LINES.clean[personaId][tierIx]];

  const frame = FRAMES[personaId];
  const score = scorePost(t);

  return {
    opener: pick(rng, frame.open[tier]),
    lines,
    closer: pick(rng, frame.close[tier]),
    findings: found,
    clean: !found.length,
    score,
    useful: usefulVersion(kind, t),
  };
}
