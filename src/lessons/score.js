// LINKEDIN LESSONS — the metrics panel.
// Reuses the mixer's Thought Leadership Index (remix.js analyze) and adds
// the diagnostics the result page displays. All satire, all local.

import { analyze } from '../remix.js';

const BUZZ = /\b(synerg\w*|leverag\w*|pivot\w*|bandwidth|alignment|aligned|scal(?:e|ing|able)|ecosystem|empower\w*|optimiz\w*|disrupt\w*|transform\w*|innovat\w*|impactful|purpose-driven|mission-critical|best-in-class|cross-functional|holistic|robust|streamlin\w*|supercharg\w*|game-?chang\w*|value-add|category-defining|inflection point)\b/gi;
const GRATITUDE = /\b(grateful|gratitude|thank(?:ful|s| you)?|humbled|honou?red|blessed|shout-?out)\b/gi;
const HUMBLE = /\b(humbled|honou?red|blessed)\b/gi;
const BRAG = /\b(proud|thrilled|excited|incredible|amazing|historic|impossible|extraordinary|masterclass|redefine\w*|movement|inflection)\b/gi;
const JOURNEY = /\b(journey|chapter|adventure|movement|era)\b/gi;

const count = (t, re) => (t.match(re) || []).length;

export function scorePost(text){
  const t = String(text || '');
  const rx = analyze(t);
  const words = rx.words || 1;

  const paras = t.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const oneLiners = paras.filter(p => p.length <= 60 && !/^#/.test(p) && !p.includes('\n')).length;

  const buzz = count(t, BUZZ);
  const buzzDensity = Math.round((buzz / words) * 1000) / 10; // per 100 words, 1 decimal

  const gratitude = count(t, GRATITUDE);
  // one thank-you is legitimate; everything past it is inflation
  const gratitudeInflation = Math.max(0, gratitude - 1);
  const gratitudeLabel =
    gratitude === 0 ? 'None detected. Cold.' :
    gratitude === 1 ? 'Within normal parameters' :
    gratitude <= 3 ? `Elevated (+${gratitudeInflation} unearned)` :
    `Runaway gratitude event (+${gratitudeInflation})`;

  const humbleBrag = Math.min(100, Math.round(
    count(t, HUMBLE) * 22 + count(t, BRAG) * 7 + oneLiners * 3 + rx.score * 0.25
  ));

  const journeys = count(t, JOURNEY);

  const congrats = /\b(welcome|congrat\w*|promot\w*|joined|joining|milestone|proud to)\b/i.test(t);
  const wellDeserved = Math.min(99, Math.round(
    8 + (congrats ? 34 : 0) + rx.score * 0.45 + oneLiners * 2 + Math.min(gratitude, 4) * 3
  ));

  return {
    index: rx.score,          // Thought Leadership Index 0–100
    rank: rx.rank,            // its named rank
    markers: rx.markers,      // what the index found
    humbleBrag,               // %
    buzz, buzzDensity,        // count + per-100-words
    gratitude, gratitudeInflation, gratitudeLabel,
    oneLiners,                // dramatic one-line paragraphs
    journeys,                 // journey references
    wellDeserved,             // probability of a "Well deserved!" comment, %
    words: rx.words,
  };
}
