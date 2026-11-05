// Casting: the post picks its song, the lady's lines and the band's vocabulary.
// castSong(post) reads the post's tone with a small lexicon (CONCEPTS), picks one
// of the song book's tracks, then casts the song from two banks:
//   - the lady's 57 recordings (lady-roles.json): what each recording can play in
//     her roles (ladder, tag and impact, bend, sink, lift, punct, stop), with which
//     of her measured words, and what it is about;
//   - the band's vocabulary (vocabulary/lexicon.json): the "It's not X. It's Y."
//     couplet, the refrain, the exchanges, the sign-off and the stabs, sung by
//     Strategy, Synthia or the lady (vocabulary/takes.js names Strategy's and
//     Synthia's takes).
// Synergy sings the post; the band sings the lexicon. The rotation is the
// lexicon's (lexicon.json `casting`): the post's own words first, then its
// topics, a home track per family, then the track's house rotation and the
// evergreen lines; close calls go to the post's hash, salted per slot so the
// slots do not move together; a line the last songs used (`recent`) scores less.
// Pure and deterministic (no network, no clock, no Math.random): the same post,
// seed and history give the same song, the same cast and the same reasons.
//
//   castSong(post, {seed, track, recent, available}) -> {track, cast, why, line, scores, recast, keys, flags}
//   settleCast(arrange, lyrics, durations, {track, cast}) -> {plan, cast, restored}
//
// `track` forces the song (the manual picker) and casts for it; `recent` is the
// songs before this one, oldest first (earlier results, their `keys`, or
// {slot:[key, ...]}); `available` (a Set of `${voice}/${id}` take keys, or a
// function of a part) limits Strategy and Synthia to the takes the voice bank
// has rendered and Whisper hears. `cast` holds the lady's roles for arrangeDrop
// (songbook/index.js castOf) and the band's: couplet, refrain, exchanges,
// signoff, stabs and dropTag (README.md, "Casting"). `line` is the page's one
// line of copy.
import ROLE_TABLE from './lady-roles.json' with {type:'json'};
import LEXICON from './vocabulary/lexicon.json' with {type:'json'};
import IMPACT_HEARD from './vocabulary/impact-heard.json' with {type:'json'};
import {takeOf, takeKey, clearFor, exchangeTakeId} from './vocabulary/takes.js';
import {LADY_TABLE} from './lady-table.js';
import {tagRate} from './drop.js';
import {lyricsFromPost} from './lyrics.js';
import {TRACKS, TRACK_ORDER, DEFAULT_TRACK, DEFAULT_CAST, LADY_ROLES, BAND_ROLES, trackOf} from './songbook/index.js';

// ---------------------------------------------------------------- words

// Words of a text, with the post's own spelling and place kept for quoting.
// Hashtags count as words; links and emoji do not.
const normal = text => String(text ?? '').normalize('NFKC').replace(/[’‘`´]/g, "'").replace(/https?:\/\/\S+/g, m => ' '.repeat(m.length)).replace(/#(?=\w)/g, ' ');
const WORD = /\$?[\p{L}\p{N}]+(?:['.,&-][\p{L}\p{N}]+)*%?/gu;
export function wordsOf(text) {
  const s = normal(text), out = [];
  for (const m of s.matchAll(WORD)) out.push({raw:m[0], stem:stem(m[0]), start:m.index, end:m.index + m[0].length});
  return out;
}

const KEEP = new Set(['news', 'series', 'always', 'this', 'his', 'has', 'was', 'does', 'plus', 'us', 'bus', 'yes', 'its', 'is', 'less', 'unless', 'analytics', 'sales']);
// A light stemmer, the same for the post and the table, so "promoted",
// "promotion" and "promote" meet where they should and "news" stays news.
export function stem(raw) {
  let w = String(raw).toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/'s$/, '').replace(/'/g, '').replace(/^\$/, '');
  if (KEEP.has(w)) return w;
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3).replace(/([^aeiouls])\1$/, '$1');
  else if (w.length > 4 && w.endsWith('ed') && !w.endsWith('eed')) w = w.slice(0, -2).replace(/([^aeiouls])\1$/, '$1');
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}
const stems = text => wordsOf(text).map(w => w.stem);

// Where a sequence of stems occurs in the post's stems.
function findSeq(post, seq) {
  if (!seq.length) return -1;
  outer: for (let i = 0; i + seq.length <= post.length; i++) {
    for (let k = 0; k < seq.length; k++) if (post[i + k] !== seq[k]) continue outer;
    return i;
  }
  return -1;
}

// FNV-1a over a string, then a seed: the tie-breaker.
function fnv(text, seed = 0) {
  let h = 2166136261 ^ (seed >>> 0);
  for (const c of String(text)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------- the lexicon

// Concepts: what a post can be about. Each lists the words (and phrases) that
// signal it, matched on stems; `re` adds a pattern on the text. The same
// concepts tag the lady's recordings (lady-roles.json topics) and the band's
// lines (lexicon.json concepts), so the post and the lines meet on them.
// `weight` is per track: the tone that picks the song.
export const CONCEPTS = {
  humility:{words:['humbled', 'humble', 'honored', 'honoured', 'honor', 'privileged', 'blessed'], weight:{'humbled-and-honored':2}},
  gratitude:{words:['grateful', 'gratitude', 'thank', 'thankful', 'thanks', 'appreciate', 'mentor', 'believed in me', 'shout out', 'shoutout'], weight:{'humbled-and-honored':1.8}},
  announce:{words:['announce', 'announcement', 'big news', 'news', 'thrilled', 'excited', 'delighted', 'pleased to share', 'happy to share', 'proud to share', 'excited to share', 'some personal news', 'quick update', "i'm launching", 'launching', 'just closed'], weight:{'humbled-and-honored':1.6}},
  career:{words:['promoted', 'promotion', 'new role', 'position', 'title', 'director', 'chief', 'head of', 'vp', 'officer', 'joined', 'new chapter', 'opportunity', 'opportunities', 'career', 'stepping back', 'start as', 'six-figure', 'job'], weight:{'humbled-and-honored':1.2}},
  pride:{words:['proud', 'pride', 'celebrate', 'congratulations', 'congrats'], weight:{'humbled-and-honored':1.2}},
  milestone:{words:['milestone', 'anniversary', 'years at', 'today marks', 'marathon', 'million', 'downloads', 'birthday', '1,000 days', 'summit', 'keynote', 'speaking at', 'completed'], weight:{'humbled-and-honored':1.3}},
  journey:{words:['journey', 'onwards', 'upwards', 'never give up', 'dream', 'full circle', 'chapter'], weight:{'humbled-and-honored':1}},
  farewell:{words:['after careful reflection', 'pursue new', 'moving on', 'stepping back', 'last day', 'goodbye', 'farewell', "what's next"], weight:{'humbled-and-honored':1.2}},
  team:{words:['team', 'crew', 'colleagues', 'teamwork', 'together', 'everyone', 'organization', 'engineers'], weight:{'humbled-and-honored':.5, 'circle-back':.2}},
  personal:{words:['personal', 'family', 'son', 'daughter', 'grandmother', 'kid', 'year-old', 'my health', 'cried', 'dog', 'wife', 'husband', 'mom', 'dad', 'babes', 'kindness'], weight:{'humbled-and-honored':.6}},
  ai:{words:['ai', 'chatgpt', 'gpt', 'agents', 'prompt', 'prompt engineering', 'automation', 'automate', 'llm', 'genai', 'machine learning'], weight:{hustle:1.6}},
  layoffs:{words:['fired', 'laid off', 'layoff', 'let go', 'cut our', 'entire sales team', 'replaced'], weight:{hustle:2}},
  // Layoffs said plainly, or as a restructuring: the gate for the layoff couplets
  // (they aim at the euphemism, so they play only where the post is about one).
  // "Cut our cloud bill" and "replaced my morning coffee" are not. No weight: it picks no song.
  restructuring:{words:[], re:/\b(?:laid\s+(?:\w+\s+){0,2}off|lay-?offs?|fired\s+(?:our|my|the|his|their|\d[\d,]*|half|everyone|them)\b|let\s+(?:\d[\d,]*\s+(?:\w+\s+)?|them\s+|half\s+(?:of\s+)?(?:the\s+|our\s+)?\w+\s+)go\b|restructur\w*|reorgani[sz]ation|re-?orgs?\b|downsiz\w*|redundanc\w*|severance|workforce\s+reduction|headcount\s+(?:reduction|cuts?)|right-?siz\w*|pink\s+slips?|(?:cut|cutting|eliminat\w*)\s+(?:\d[\d,%]*\s+)?(?:of\s+)?(?:our\s+|the\s+)?(?:jobs|roles|positions|staff|headcount|employees|workforce))/i, weight:{}},
  money:{words:['revenue', 'series a', 'series b', 'series c', 'funding', 'raised', 'investors', 'pipeline', 'salary', 'cloud bill', 'budget', 'profit', 'arr', 'mrr', 'cryptocurrency', 'valuation', 'biggest client'], re:/\$\s?\d[\d.,]*\s?[kmb]?\b/i, weight:{hustle:1.3}},
  growth:{words:['growth', 'grew', 'grow', 'scale', 'scaling', '10x', 'increase', 'doubled', 'conversion', 'outperform'], re:/(?:\+|\bup\s)\d+(?:\.\d+)?\s?%|\b\d+x\b/i, weight:{hustle:1.2}},
  grind:{words:['grind', 'hustle', 'cold plunge', 'morning routine', 'morning system', 'no days off', 'hunger', 'hungry', 'wake', 'every day', 'the edge', 'discipline'], re:/\b[4-7](?::\d\d)?\s?a\.?m\b|\b5am\b/i, weight:{hustle:2}},
  productivity:{words:['productivity', 'productive', 'focus', 'deep work', 'efficiency', 'output'], weight:{hustle:1}},
  momentum:{words:['momentum', 'compound', 'compounds', 'consistency', 'habit', 'daily', 'streak', 'a day'], weight:{hustle:1}},
  execution:{words:['execution', 'ship', 'shipped', 'deliver', 'delivered', 'build', 'building', 'built', 'hackathon', 'sprint', 'make it permanent', 'just do it'], weight:{hustle:1.3}},
  data:{words:['data', 'numbers', 'metric', 'metrics', 'kpi', 'okr', 'dashboard', 'stats', 'data points'], re:/\b\d+(?:\.\d+)?\s?%/, weight:{hustle:.8, 'circle-back':.3}},
  hiring:{words:['hiring', 'hire', 'candidate', 'interview', 'recruiter', 'red flag', 'green flag', 'resume', 'résumé'], weight:{hustle:.6, 'circle-back':.4}},
  speed:{words:['fast-paced', 'fast', 'faster', 'speed', 'weeks early', 'in one sprint', 'overnight'], weight:{hustle:.8}},
  meeting:{words:['meeting', 'all-hands', 'standup', 'calendar', 'schedule', 'follow-up', 'circle back', 'email', 'inbox', 'sync', 'agenda', 'kickoff', 'memo', 'status update', 'business review'], weight:{'circle-back':1.6}},
  process:{words:['process', 'approval', 'step', 'checklist', 'workflow', 'documented', 'quarterly', 'planning cycle', 'roadmap', 'onboarding', 'framework', 'pods', 'reorganize', 'rebranding', 'deck', 'slide', 'workstreams', 'performance review', 'improvement plans'], weight:{'circle-back':1.3}},
  jargon:{words:['synergy', 'synergies', 'alignment', 'align', 'leverage', 'leveraging', 'stakeholder', 'buy-in', 'unlock value', 'bandwidth', 'engagement', 'retention', 'visibility', 'transformation', 'asynchronous', 'ecosystem', 'priorities', 'ambiguity', 'accountability', 'transparency', 'intention', 'customer obsession', 'culture fit', 'culture add'], weight:{'circle-back':1.3}},
  opinion:{words:['thoughts', 'unpopular opinion', 'opinion', 'hot take', 'agree or disagree', 'what would you add', 'who do you trust', "let's discuss", 'nobody talks about', 'be honest'], weight:{'circle-back':1}},
  strategy:{words:['strategy', 'strategic', 'plan', 'vision', 'consultants', 'leadership', 'leader', 'manager', 'stop chasing', 'start chasing'], weight:{'circle-back':.8, hustle:.3}},
  feedback:{words:['feedback', 'criticism', 'rating', 'performance review', 'gave me a', 'approval rating'], weight:{'circle-back':.4}},
  culture:{words:['culture', 'values', 'mission', 'purpose', 'trust', 'morale', 'family', 'empty cup', 'emotional intelligence', 'lifestyle', 'philosophy'], weight:{'circle-back':.6, 'humbled-and-honored':.3, offsite:1.3}},
  // Offsite: the team retreat, the work family, belonging, wellness and good vibes.
  retreat:{words:['offsite', 'off-site', 'retreat', 'team building', 'team-building', 'trust fall', 'trust falls', 'hiked', 'hiking', 'journaled', 'journaling', 'campfire', 'mountains', 'workation', 'bonding', 'icebreaker', 'team trip', 'away day'], weight:{offsite:2.6, 'circle-back':.3}},
  workfamily:{words:['a family', 'work family', 'like a family', 'like family', 'one big family', 'not a company', 'morale officer', 'office dog'], weight:{offsite:3.8}},
  belonging:{words:['community', 'belonging', 'belong', 'inclusion', 'inclusive', 'connection', 'tribe', 'village', 'kindness', 'empathy', 'emotional intelligence', 'people operations', 'people first', 'grandchildren', 'every sunday', 'garden', 'neighbors', 'neighbours', 'volunteer'], weight:{offsite:1.7}},
  wellness:{words:['wellness', 'well-being', 'wellbeing', 'mental health', 'burnout', 'self-care', 'self care', 'mindfulness', 'mindful', 'meditation', 'meditate', 'yoga', 'breathe', 'work-life balance', 'balance', 'empty cup', 'slow down', 'long walk', 'sabbatical', '4-day work week', 'four-day work week', 'recharge'], weight:{offsite:2}},
  vibes:{words:['vibes', 'good vibes', 'vibe', 'positivity', 'joy', 'fun', 'laughter', 'smile', 'morale', 'pizza', 'party'], weight:{offsite:1.3}},
  notabout:{words:[], re:/\b(?:isn't|is not|not)\s+(?:about\s+|a\s+|an\s+|just\s+)?[^.?!\n]{1,48}[.?!]\s+it['’]s\s/i, weight:{'circle-back':.6}},
  lesson:{words:['lesson', 'learned', 'learn', 'taught', 'takeaway', 'advice', 'wish i knew', 'tip', 'when it hit me', 'it hit me', 'remembered', 'reminder', 'things i'], weight:{'circle-back':.5, 'humbled-and-honored':.3}},
  connect:{words:['connect', 'network', 'networking', 'booth', 'coffee chat', 'forum', 'see you there', 'explore'], weight:{'circle-back':.6}},
  engagement:{words:['comment', 'like', 'post', 'follow', 'subscribe', 'repost', 'newsletter', 'linkedin', 'profile', 'poll'], weight:{'circle-back':.5}},
  change:{words:['change', 'transform', 'rebrand', 'pivot', 'rethink', 'everything', 'replaced', 'turned off'], weight:{'circle-back':.6}},
  mindset:{words:['mindset', 'mirror', 'superpower', 'resilience', 'believe', 'growth mindset', 'know your values'], weight:{'circle-back':.4, hustle:.4}},
  failure:{words:['failure', 'fail', 'failed', 'rejected', 'lost', 'ghosted', 'mistake', 'quit', 'wrong', 'missed', 'burnout', 'incident'], weight:{'circle-back':.3, 'humbled-and-honored':.3}},
  start:{words:['start', 'started', 'begin', 'first', 'new', 'day one', 'getting started', 'launching'], weight:{}},
  future:{words:['future', 'next', 'coming', 'soon', 'stay tuned', 'more on that', 'watch this space', 'next year'], weight:{}},
  truth:{words:['honest', 'truth', 'lie', 'nobody', 'most people', 'the secret', 'secret', 'actually', 'full stop', 'let that sink in', 'read that again'], weight:{}},
  success:{words:['success', 'win', 'winning', 'nailed', 'perfect', 'best', 'great', 'beautiful', 'green', 'history'], weight:{}},
};
const CONCEPT_STEMS = Object.fromEntries(Object.entries(CONCEPTS).map(([k, c]) => [k, c.words.map(stems).filter(s => s.length)]));
const OPENING = 1.5;    // the opening line sets the tone: its cues count half again

// The one line of copy: the post's own words that chose the song, then the band's joke.
const QUIP = {
  'circle-back':['This post could have been a meeting.', 'Per my last email.', "Let's take this offline."],
  'humbled-and-honored':['Someone is very honored.', 'Humbled, once again.', 'Grateful for this journey.'],
  hustle:['This post is up at 5 a.m.', 'No days off.', 'Rise and grind.'],
  offsite:['Mandatory fun starts at nine.', 'Trust falls after lunch.', 'Bring your whole self, within reason.'],
};
const FALLBACK_LINE = 'Circle Back. Nothing in the post commits to anything, so neither do we.';

// What the post is about: concept -> {hits, spans: [[from, to] token ranges]}.
// A hit in the opening line weighs OPENING; a phrase swallows the words inside it.
export function readPost(post) {
  const text = normal(post), words = wordsOf(post), postStems = words.map(w => w.stem);
  const opening = (() => { const m = text.slice(0, 400).match(/^\s*[^\n]*?[.!?:](?=\s)|^\s*[^\n]+/); return m ? m[0].length : 0; })();
  const tokenAt = offset => { let i = 0; while (i < words.length && words[i].end <= offset) i++; return i; };
  const concepts = {};
  for (const [name, list] of Object.entries(CONCEPT_STEMS)) {
    const found = [];
    for (const seq of list) { const at = findSeq(postStems, seq); if (at >= 0) found.push([at, at + seq.length]); }
    const re = CONCEPTS[name].re, m = re && text.match(re);
    if (m) { const from = tokenAt(m.index); found.push([from, Math.max(from + 1, tokenAt(m.index + m[0].trimEnd().length))]); }
    found.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]) || a[0] - b[0]);
    const kept = found.filter((f, i) => !found.slice(0, i).some(g => g[0] <= f[0] && f[1] <= g[1]));
    if (!kept.length) continue;
    kept.sort((a, b) => a[0] - b[0]);
    const hits = kept.reduce((n, [from]) => n + (words[from] && words[from].start < opening ? OPENING : 1), 0);
    concepts[name] = {hits, spans:kept, words:kept.map(([a, b]) => words.slice(a, b).map(w => w.raw).join(' '))};
  }
  return {text, words, stems:postStems, concepts, opening};
}

// ---------------------------------------------------------------- the song

// Score every track by the post's tone. A concept counts its first hit fully
// and further hits a quarter each, up to four. Close scores (within TIE) are
// settled by the post's hash, so similar posts spread across tracks; a post
// that signals nothing much (best < MIN) is Circle Back.
const TIE = .35, MIN = 1;
export function scoreTracks(reading) {
  const scores = Object.fromEntries(TRACK_ORDER.map(id => [id, 0])), parts = Object.fromEntries(TRACK_ORDER.map(id => [id, []]));
  for (const [name, c] of Object.entries(reading.concepts)) {
    const bump = Math.min(c.hits, 1.5) + .25 * Math.max(0, Math.min(4, c.hits) - Math.min(c.hits, 1.5));
    for (const [id, w] of Object.entries(CONCEPTS[name].weight || {})) {
      if (!(id in scores) || !w) continue;
      scores[id] += w * bump;
      parts[id].push({concept:name, points:+(w * bump).toFixed(2), spans:c.spans, words:c.words});
    }
  }
  for (const id of TRACK_ORDER) parts[id].sort((a, b) => b.points - a.points);
  return {scores, parts};
}

function chooseTrack(reading, seed) {
  const {scores, parts} = scoreTracks(reading);
  const best = Math.max(...Object.values(scores));
  if (best < MIN) return {track:DEFAULT_TRACK, scores, parts, close:[], fallback:true};
  const close = TRACK_ORDER.filter(id => scores[id] >= best - TIE);
  if (close.length === 1) return {track:close[0], scores, parts, close, fallback:false};
  // Near-tie: the post's fingerprint decides, weighted by how close each is.
  const r = fnv(reading.text, seed), weights = close.map(id => TIE - (best - scores[id]) + .05), total = weights.reduce((a, b) => a + b, 0);
  let acc = 0, track = close.at(-1);
  for (let i = 0; i < close.length; i++) { acc += weights[i] / total; if (r < acc) { track = close[i]; break; } }
  return {track, scores, parts, close, fallback:false};
}

const quote = list => list.map(w => `“${w}”`);
const andList = list => list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
// The post's own words that chose the song: the strongest cues, with cues a
// word apart joined into one phrase ("fired our entire sales team").
function evidence(reading, parts, max = 3) {
  const {text, words} = reading, spans = [];
  for (const p of parts) for (const [a, b] of p.spans) spans.push({a, b, points:p.points});
  spans.sort((x, y) => x.a - y.a || y.b - x.b);
  // Join cues a word apart, never across a sentence, a quote or an emoji.
  const joins = (last, s) => s.a <= last.b + 1 && Math.max(last.b, s.b) - last.a <= 5
    && (s.a <= last.b - 1 || !/[.!?:;"“”()\p{Extended_Pictographic}]/u.test(text.slice(words[last.b - 1].end, words[s.a].start)));
  const merged = [];
  for (const s of spans) {
    const last = merged.at(-1);
    if (last && joins(last, s)) { last.b = Math.max(last.b, s.b); last.points += s.points; }
    else if (!last || s.a >= last.b) merged.push({...s});
  }
  const said = ({a, b}) => {
    let q = text.slice(words[a].start, words[b - 1].end).replace(/\s+/g, ' ');
    q = q.split(/(?<![ap]\.m)[.!?:;](?=\s)|[“”"\p{Extended_Pictographic}]/u)[0].trim();
    q = q.replace(/[,;:]+$/, '').replace(/(?<!\b[ap]\.m)\.$/, '');
    return /\b[ap]\.m$/i.test(q) ? `${q}.` : q;
  };
  // A quote never ends on a function word, never quotes someone's family or
  // health back at them, and a lone "thank" or "day" is not evidence.
  const FUNCTION = /^(?:at|to|of|for|the|a|an|and|in|on|with|my|our|from|by)$/i;
  const tidy = q => { let t = q; for (let k = 0; k < 3; k++) t = t.replace(/\s+(?:at|to|of|for|the|a|an|and|in|on|with|my|our|from|by)$/i, ''); return t; };
  // A cue that stops on a function word ("Head of") takes the post's next word or two.
  const extend = sp => {
    let b = sp.b;
    for (let k = 0; k < 2 && b < words.length && FUNCTION.test(words[b - 1].raw) && !/[.!?:;"“”()\n\p{Extended_Pictographic}]/u.test(text.slice(words[b - 1].end, words[b].start)); k++) b++;
    return {...sp, b};
  };
  const usable = q => q && !SENSITIVE.test(q) && !WEAK.has(q.toLowerCase().replace(/^(?:a|an|the)\s+/, ''));
  const ranked = merged.sort((x, y) => y.points - x.points || x.a - y.a).map(s => ({...s, q:tidy(said(extend(s)))}));
  const keep = ranked.filter(s => usable(s.q)), chosen = (keep.length ? keep : ranked.filter(s => s.q && !SENSITIVE.test(s.q))).slice(0, max);
  return chosen.sort((x, y) => x.a - y.a).map(s => s.q)
    .filter((q, i, all) => all.findIndex(o => o.toLowerCase() === q.toLowerCase()) === i);
}
const SENSITIVE = /\b(?:family|health|cried|grandmother|grandfather|grandchild\w*|son|daughter|kids?|\d+-year-old|year-old|wife|husband|mom|dad|funeral|passed away|cancer|diagnos\w*)\b/i;
const WEAK = new Set(['thank', 'thanks', 'day', 'days', 'every day', 'new', 'first', 'next', 'start', 'post']);
const VOICE_NAME = {strategy:'Strategy', synthia:'Synthia', lady:'The lady', synergy:'Synergy'};
const LINE_MAX = 170;
// The page's one line: the song and the post's words that chose it, then the
// band's joke: the couplet ("It's not an hour. It's a quick sync."). A post about
// family, health or grief (and a goodbye on Humbled and Honored) is not handed a
// joke: its line names the refrain, and a goodbye ends "Grateful for this journey.".
function trackLine(choice, reading, band) {
  const title = TRACKS[choice.track].title;
  const gentle = band.flags.sensitive || (choice.track === 'humbled-and-honored' && (reading.concepts.farewell || SENSITIVE.test(reading.text)));
  // Curly quotes are the post's own words; the band's lines are said plainly.
  const refrain = band.refrain && `${VOICE_NAME[band.refrain.voice].replace(/^The lady$/, "The lady's").replace(/^(Strategy|Synthia|Synergy)$/, "$1's")} refrain: ${band.refrain.text.replace(/[,;:]$/, '')}${/[.!?]$/.test(band.refrain.text) ? '' : '.'}`;
  const farewell = gentle && choice.track === 'humbled-and-honored';
  // A goodbye ends on the journey; a refrain that already says "journey" is not named twice.
  const named = refrain && !(farewell && /journey/i.test(band.refrain.text)) ? ` ${refrain}` : '';
  const tail = gentle ? `${named}${farewell ? ' Grateful for this journey.' : named ? '' : ` ${QUIP[choice.track][Math.floor(fnv(reading.text, 7) * 3)]}`}`
    : band.couplet ? ` ${band.couplet.line}` : refrain ? ` ${refrain}` : ` ${QUIP[choice.track][Math.floor(fnv(reading.text, 7) * 3)]}`;
  if (choice.forced) return `${title}, chosen by hand.${tail}`;
  if (choice.fallback) return `${FALLBACK_LINE}${tail}`;
  for (const max of [3, 2, 1]) {
    const line = `${title}, for ${andList(quote(evidence(reading, choice.parts[choice.track], max)))}.${tail}`;
    if (line.length <= LINE_MAX || max === 1) return line;
  }
}

// ---------------------------------------------------------------- the lady's roles

// What each role needs, per track (README.md, "The cast"). The default cast
// is today's shipped lines and is exempt: three of them sit past the
// documented limits (Circle Back's tag leaves 0.376 s of silence, the sink's
// deep half is 1.30 s, "Read that again." is 0.96 s) and are kept as they are.
export const LIMITS = {
  ladder:{phrase:.85, first:.3, words:[1, 3]},
  tag:{gate:.64, silence:.45, impactMax:.55, impactBeforeEcho:.04, syllables:[1, 2]},
  bend:{max:.5, syllables:[2, 2]},
  lift:{max:.7, syllables:[2, 4]},
  sink:{words:[2, 4], dryOver:.05, pause:.45},
  punct:{max:.9, words:[1, 4]},
  stop:{max:.8, words:[1, 3]},
};

const entryOf = file => LADY_TABLE[file];
const at = (entry, i) => entry.words[i < 0 ? entry.words.length + i : i];
const span = (entry, a, b) => at(entry, b).end - at(entry, a).start;
const r3 = x => Math.round(x * 1000) / 1000;

// Does a role-table candidate fit a track? {ok, why, ...measures}. Checks the
// same numbers drop.js will use, so a cast that passes plays whole.
export function fits(role, cand, track) {
  const tr = trackOf(track), D = tr.drop, step = tr.step, entry = entryOf(cand.file), L = LIMITS[role];
  if (!entry) return {ok:false, why:`${cand.file} is not in the lady's table`};
  const [a, b] = cand.words, n = entry.words.length;
  if (!(a >= 0 && b < n && a <= b)) return {ok:false, why:`words ${a}-${b} outside ${n} measured words`};
  const count = b - a + 1, len = span(entry, a, b);
  if (role === 'ladder') {
    const first = span(entry, a, a);
    if (count < L.words[0] || count > L.words[1]) return {ok:false, why:`${count} words`};
    if (len > L.phrase) return {ok:false, why:`phrase ${r3(len)} s > ${L.phrase}`};
    if (first > L.first) return {ok:false, why:`first word ${r3(first)} s > ${L.first}`};
    return {ok:true, len:r3(len), first:r3(first)};
  }
  if (role === 'tag') {
    const [k] = cand.impact, impact = span(entry, k, k), syl = cand.impactSyllables;
    if (k !== b + 1) return {ok:false, why:'the impact must be the word right after the tag'};
    const echo = 4 * step, impactMax = Math.min(L.impactMax, echo - L.impactBeforeEcho);
    if (impact > impactMax) return {ok:false, why:`impact ${r3(impact)} s > ${r3(impactMax)} (its echo is a beat later)`};
    if (!(syl >= L.syllables[0] && syl <= L.syllables[1])) return {ok:false, why:`impact has ${syl} syllables`};
    const chokeStep = D.choke.bar * 16 + D.choke.step, window = (D.impact * 16 - chokeStep) * step;
    const {rate, room} = tagRate(D.tag, entry, len, window, tr.pitchClasses), heard = len / rate;
    const gate = room === undefined ? Math.min(L.gate, heard) : Math.min(L.gate, heard, room), silence = window - gate;
    if (heard > gate + 1e-9) return {ok:false, why:`tag ${r3(heard)} s at ${r3(rate)}x is gated at ${r3(gate)}`};
    if (silence < L.silence) return {ok:false, why:`silence ${r3(silence)} s < ${L.silence}`};
    return {ok:true, len:r3(len), rate:r3(rate), silence:r3(silence), impact:r3(impact)};
  }
  if (role === 'bend' || role === 'lift') {
    if (count !== 1) return {ok:false, why:'one word'};
    if (len > L.max) return {ok:false, why:`${r3(len)} s > ${L.max}`};
    if (!(cand.syllables >= L.syllables[0] && cand.syllables <= L.syllables[1])) return {ok:false, why:`${cand.syllables} syllables`};
    return {ok:true, len:r3(len)};
  }
  if (role === 'sink') {
    const split = cand.split;
    if (count < L.words[0] || count > L.words[1]) return {ok:false, why:`${count} words`};
    if (!(split > a && split <= b)) return {ok:false, why:'split must leave dry words and deep words'};
    const dry = at(entry, split - 1).end - at(entry, a).start, deep = at(entry, b).end - at(entry, split - 1).end, pause = at(entry, split).start - at(entry, split - 1).end;
    const dryRoom = (D.sink * 16 - D.places.letThat) * step + L.dryOver, deepRoom = 16 * step / 2;
    if (dry > dryRoom) return {ok:false, why:`dry words ${r3(dry)} s > ${r3(dryRoom)}`};
    if (deep > deepRoom + 1e-9) return {ok:false, why:`deep words ${r3(deep)} s > ${r3(deepRoom)} (half a bar)`};
    if (pause > L.pause) return {ok:false, why:`pause ${r3(pause)} s`};
    return {ok:true, dry:r3(dry), deep:r3(deep)};
  }
  if (role === 'punct' || role === 'stop') {
    if (count < L.words[0] || count > L.words[1]) return {ok:false, why:`${count} words`};
    if (len > L.max) return {ok:false, why:`${r3(len)} s > ${L.max}`};
    if (role === 'stop' && /[?…]$|\.\.\.$/.test(at(entry, b).text)) return {ok:false, why:'a stop falls; this ends on a question or a trail'};
    return {ok:true, len:r3(len)};
  }
  return {ok:false, why:`unknown role ${role}`};
}

// The default cast, per role, in the role table's shape.
const DEFAULTS = Object.fromEntries(LADY_ROLES.filter(r => r !== 'impact').map(role => {
  const d = DEFAULT_CAST[role];
  const cand = {role, file:d.file, words:[...d.words], display:d.display, craft:1, default:true};
  if (role === 'tag') Object.assign(cand, {impact:[...DEFAULT_CAST.impact.words], impactDisplay:DEFAULT_CAST.impact.display});
  const n = entryOf(d.file).words.length, norm = i => (i < 0 ? n + i : i);
  cand.words = cand.words.map(norm);
  if (role === 'sink') cand.split = cand.words[0] + d.split;   // the cast counts dry words; the table names the first deep word
  if (cand.impact) cand.impact = cand.impact.map(norm);
  return [role, cand];
}));

// Every candidate of the role table, flat, with its recording's tags.
const PHRASES = ROLE_TABLE.phrases || [];
for (const d of Object.values(DEFAULTS)) d.phrase = PHRASES.find(p => p.file === d.file) || {file:d.file, text:entryOf(d.file).text, topics:[], keywords:[]};
const CANDIDATES = Object.fromEntries(LADY_ROLES.filter(r => r !== 'impact').map(role => [role, PHRASES.flatMap(p => (p.roles?.[role] || []).map(c => ({...c, role, file:p.file, phrase:p})))]));
const PHRASE_STEMS = new Map([...PHRASES, ...Object.values(DEFAULTS).map(d => d.phrase)].map(p => [p.file, {
  text:stems(p.text),
  keywords:(p.keywords || []).map(k => ({k, seq:stems(k)})).filter(x => x.seq.length),
}]));
const CONTENT = w => w.length > 3 && !['that', 'this', 'what', 'with', 'have', 'just', 'from', 'your', 'about', "let's", 'lets', 'here', "it's", "i'm", "we're", "that's", "here's", "what's", "don't", "won't", "you're", "they're", "i'll"].includes(w);

// How much a recording speaks to this post: its whole text quoted (4), its
// keywords (1.2 a word, 2 a phrase, at most 3.6), its topics (0.45 a hit,
// 0.7 of that past the first topic, at most 1.8). Once per recording per post.
function phraseRelevance(reading, phrase) {
  const p = PHRASE_STEMS.get(phrase.file), reasons = [];
  let points = 0;
  if (p.text.length >= 2 && findSeq(reading.stems, p.text) >= 0) { points += 4; reasons.push(`the post says it: “${phrase.text.replace(/\s*\p{Extended_Pictographic}.*$/u, '')}”`); }
  let kw = 0;
  for (const {k, seq} of p.keywords) {
    if (findSeq(reading.stems, seq) < 0) continue;
    const gain = seq.length >= 2 ? 2 : 1.2;
    if (kw + gain > 3.6) continue;
    kw += gain; reasons.push(`keyword “${k}”`);
  }
  let topic = 0;
  (phrase.topics || []).forEach((t, i) => {
    const c = reading.concepts[t]; if (!c) return;
    const gain = .45 * Math.min(3, c.hits) * (i === 0 ? 1 : .7);
    if (topic + gain > 1.8) return;
    topic += gain; reasons.push(`topic ${t}: ${quote(c.words.slice(0, 2)).join(', ')}`);
  });
  return {points:points + kw + topic, reasons, quoted:points > 0, said:points + kw > 0, topic};
}
// Plus 2.5 when the post quotes the role's own words (two or more), not the whole phrase.
function relevance(reading, cand, cache) {
  if (!cache.has(cand.file)) cache.set(cand.file, phraseRelevance(reading, cand.phrase));
  const base = cache.get(cand.file);
  if (base.quoted) return base;
  const entry = entryOf(cand.file), last = cand.impact ? cand.impact[1] : cand.words[1], own = entry.words.slice(cand.words[0], last + 1);
  if (own.length >= 2 && findSeq(reading.stems, own.map(w => stem(w.text))) >= 0)
    return {points:base.points + 2.5, said:true, reasons:[`the post says “${own.map(w => w.text).join(' ').replace(/[.,:;!?…]+$/, '')}”`, ...base.reasons]};
  return base;
}

// Her roles after the band's slots (the sink, the punctuation, the stop, the
// lift and the bend) are scored as before: a line's value in a role is its
// relevance times how well it plays the role (craft, the table's 0-1 rating,
// as 0.4 + 0.6 craft), times the role's weight. Today's line holds the role's
// BASELINE plus its own relevance: the moments named after their line (the
// sink, "Read that again.", "Full stop.") need the post's own words to replace
// them; the others may also be recast on topic alone (TOPICAL). A line under
// RELEVANT is never a recast; it is only a filler when today's line is taken
// (by the band, too: a stab can take "Pivot").
const RELEVANT = 1, TOPICAL = {tag:.7, ladder:.7, lift:.7, bend:.7};
const TIE_LINE = .3;
const BASELINE = {tag:1.5, ladder:1.6, sink:2.2, punct:2.1, stop:2.1, lift:1.4, bend:1.4};
// The tag and its impact are the payoff; the ladder is the build; the rest punctuate.
const ROLE_WEIGHT = {tag:1.6, ladder:1.3, sink:1.1, punct:1, stop:.9, lift:.8, bend:.8};
const ROLE_ORDER = ['tag', 'ladder', 'sink', 'punct', 'stop', 'lift', 'bend'];
// The tag and the ladder rotate with the band (the lexicon's slots); the rest go through the beam.
const BEAM_ROLES = ['sink', 'punct', 'stop', 'lift', 'bend'];
const craftOf = c => .4 + .6 * (c.craft ?? 1);
// Heard in the mix: the tag and the sink were each rendered in two bars of
// every song they fit (lady-roles.json `mix`) and played to Whisper. A cut it
// follows for under MIX_MIN of her words is not cast in that song; the rest
// score by how much it hears.
export const MIX_MIN = .5;
const mixOf = (c, track) => c.mix?.[track]?.recall;
const heardOf = (c, track) => { const r = mixOf(c, track); return r === undefined ? 1 : .6 + .4 * r; };

function displayWords(c) {
  const text = [c.display, c.impactDisplay].filter(Boolean).join(' ');
  return shownOf(text);
}
const shownOf = (...texts) => [...new Set(texts.filter(Boolean).join(' ').toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(CONTENT).map(stem))];

// fits() per candidate and track, once: the table does not change.
const FIT = new Map();
const fitOf = (role, c, track) => { const key = `${role}|${c.file}|${c.words}|${c.split ?? ''}|${track}`; if (!FIT.has(key)) FIT.set(key, fits(role, c, track)); return FIT.get(key); };

// Her moments (the sink, the punctuation, the stop, the lift and the bend) rotate
// by the band's rules (Aaron, Nov 5: "Let that sink in" sat on 55 of 61 posts, "Read
// that again." on 57, "Full stop." on 56): a line on topic first, else the track's
// house (the lines at home in it, and today's), else any line that plays the role;
// close calls to the post's hash, salted per role; a line of the last 3 songs x0.15,
// the last 10 x0.5. Only lines that keep the role's music play it: a craft of at
// least `floor` (lady-roles.json: how well the cut plays the role: a bend word that
// means a turn, a stop that falls and closes, a punct that makes the repeat a joke),
// inside the role's limits on the track (fits()), and a sink whose deep half Whisper
// followed at half speed in the song's mix (`sinkRecall` of her words). Today's line
// is one of them, a little likelier (`today`), never fixed.
export const LADY_ROTATION = Object.freeze({
  floor:{sink:.7, punct:.6, stop:.6, lift:.6, bend:.6}, sinkRecall:.75, today:.8, homeWeight:1.5, near:.6, caps:{max:16, distinct:8},
  salt:{sink:41, punct:42, stop:43, lift:44, bend:45},
});
export const LADY_SLOTS = BEAM_ROLES;
export const ladyKey = c => `${c.file}:${c.display}`;
function candidatesFor(role, reading, track, S, cache, blocked) {
  const def = DEFAULTS[role], W = ROLE_WEIGHT[role], R = LADY_ROTATION, list = [];
  for (const c of [def, ...CANDIDATES[role].filter(c => !c.default && !c.couplet)]) {
    if (blocked(c.file)) continue;
    const isDefault = c === def, fit = fitOf(role, c, track);
    // Today's line keeps its exemptions (README, "The role table"); every other line meets the role's music.
    if (!isDefault && (!fit.ok || (c.craft ?? 1) < R.floor[role] || (mixOf(c, track) ?? 1) < (role === 'sink' ? R.sinkRecall : MIX_MIN))) continue;
    const rel = relevance(reading, c, cache), topical = rel.points >= RELEVANT && (rel.said || rel.topic >= (TOPICAL[role] ?? Infinity));
    const key = ladyKey(c), fresh = S.fresh(role, key), home = homeOfFile(c.file) === track ? P.home : 0;
    const s = (P.base + rel.points + home) * craftOf(c) * heardOf(c, track) * fresh * W;
    list.push({...c, key, rel, topical, home:!!home, fresh, s, fit, isDefault, relevant:rel.points, filler:false});
  }
  let level = 'topic', tier = list.filter(x => x.topical);
  if (!tier.length) { level = 'house'; tier = list; }
  const best = Math.max(...tier.map(x => x.s)), near = level === 'topic' ? R.near : Infinity, close = tier.filter(x => x.s >= best - near);
  // On topic, the closer to the best the likelier; otherwise every line that plays the role, the ones at
  // home in the track (`homeWeight`) and today's a little likelier, less freshness.
  const weights = close.map(x => Math.max(.02, level === 'topic' ? x.s - (best - near) + .05 : x.fresh * craftOf(x) * (x.home ? R.homeWeight : 1) * (x.isDefault ? 1 + R.today : 1))), sum = weights.reduce((a, b) => a + b, 0);
  let r = fnv(reading.text, S.salt(R.salt[role])) * sum, k = 0;
  while (k < close.length - 1 && r >= weights[k]) r -= weights[k++];
  const chosen = close[k], top = Math.max(...list.map(x => x.s));
  const why = x => [...(level === 'topic' && x.topical ? x.rel.reasons : [x.isDefault ? "today's line" : x.home ? `at home in ${TRACKS[track].title}` : 'a line that plays the role']),
    ...(x === chosen && close.length > 1 ? [`one of ${close.length} close lines: the post's hash decided`] : []), ...(x.fresh < 1 ? [`sung in a recent song: x${x.fresh}`] : [])];
  // For the beam: the chosen line on top; the rest of its tier as they score, the others below it.
  return list.map(x => ({...x, score:x === chosen ? top + 1 : tier.includes(x) ? x.s : x.s - 1, reasons:why(x)})).sort((a, b) => b.score - a.score);
}

// Pick a coherent set: no recording twice (the band's included: `taken`), no
// content word shown twice (the band's included: `shown`), the most relevant
// lines in the roles that carry the most. A beam over the roles, then pair
// swaps (a line moving to a better role while another role takes today's).
const BEAM = 160, PER_ROLE = 12, REPEAT_PENALTY = .8;
// Files as bits (57 recordings: two 32-bit words), so a beam state is cheap.
const FILE_BIT = new Map(Object.keys(LADY_TABLE).sort().map((f, i) => [f, i]));
const hasFile = (lo, hi, f) => { const i = FILE_BIT.get(f); return i < 32 ? (lo >>> i) & 1 : (hi >>> (i - 32)) & 1; };
const withFile = (lo, hi, f) => { const i = FILE_BIT.get(f); return i < 32 ? [(lo | (1 << i)) >>> 0, hi] : [lo, (hi | (1 << (i - 32))) >>> 0]; };
function pickSet(lists, roles, taken, shown) {
  const def = {};
  for (const role of roles) for (const c of lists[role]) { c.shown ??= displayWords(c); if (c.isDefault) def[role] = c; }
  let lo0 = 0, hi0 = 0;
  for (const f of taken) [lo0, hi0] = withFile(lo0, hi0, f);
  const total = picks => {
    let score = 0; const files = new Set(taken), seen = new Set(shown);
    for (const role of roles) {
      const c = picks[role]; if (!c) continue;
      if (files.has(c.file)) return -Infinity;
      files.add(c.file); score += c.score;
      for (const w of c.shown) { if (seen.has(w)) score -= REPEAT_PENALTY; seen.add(w); }
    }
    return score;
  };
  // A filler only when today's line is taken.
  const usable = (role, c, lo, hi) => !hasFile(lo, hi, c.file) && (c.isDefault || !c.filler || hasFile(lo, hi, def[role].file));
  let beam = [{score:0, picks:{}, lo:lo0, hi:hi0, words:[...shown]}];
  for (const role of roles) {
    const next = [];
    for (const state of beam) {
      let added = 0;
      for (const c of lists[role]) {
        if (!usable(role, c, state.lo, state.hi)) continue;
        let repeats = 0; for (const w of c.shown) if (state.words.includes(w)) repeats++;
        const [lo, hi] = withFile(state.lo, state.hi, c.file);
        next.push({score:state.score + c.score - repeats * REPEAT_PENALTY, picks:{...state.picks, [role]:c}, lo, hi, words:state.words.concat(c.shown)});
        if (++added >= PER_ROLE) break;
      }
    }
    next.sort((x, y) => y.score - x.score);
    beam = next.slice(0, BEAM);
  }
  let picks = beam[0].picks, best = total(picks);
  const legal = trial => roles.every(r => trial[r].isDefault || !trial[r].filler || taken.has(def[r].file) || roles.some(o => o !== r && trial[o].file === def[r].file));
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (const r1 of roles) for (const c1 of lists[r1].slice(0, PER_ROLE)) {
      if (c1 === picks[r1] || taken.has(c1.file)) continue;
      const holder = roles.find(r => r !== r1 && picks[r].file === c1.file);
      const tries = holder ? lists[holder].slice(0, PER_ROLE).filter(c2 => c2.file !== c1.file).map(c2 => ({[r1]:c1, [holder]:c2})) : [{[r1]:c1}];
      for (const change of tries) {
        const trial = {...picks, ...change};
        if (!legal(trial)) continue;
        const score = total(trial);
        if (score > best + 1e-9) { picks = trial; best = score; improved = true; }
      }
    }
    if (!improved) break;
  }
  return {score:best, picks};
}

// The cast entry arrangeDrop takes, for one picked candidate.
function castEntry(c) {
  const out = {file:c.file, words:[...c.words], display:c.display};
  if (c.split !== undefined) out.split = c.split - c.words[0];
  return out;
}

// ---------------------------------------------------------------- the band (lexicon.json)

// The rotation (LEXICON.md, "The casting rules"). A line's score in a slot:
//   (base + relevance + home) x (0.6 + 0.4 craft) - 0.8 per content word already
//   shown (the hook's included), then x freshness.
// Relevance: the line's concepts against the post's, per topic group (a couplet's
// topics; one group otherwise): the strongest concept of a group counts 1 (plus a
// quarter for each further hit), the others a quarter; the best group, plus half
// the next, at most 3; plus 2.5 when the post says the line (its words, or the
// couplet's X or Y). Fallback when nothing clears minRel: the track's house
// rotation and the lines at home in it, then the evergreen lines, then anything
// that fits. Close calls (within `near` of the best at the topic level, steeply
// or, for the wide slots in `flat`, gently weighted; every line at the others,
// as likely, less freshness and repeats) go to FNV-1a of the post, salted per
// slot. Freshness: a line one of the last 3 songs used scores x0.15, the last 10
// x0.5. The title's salt (57) puts one in four of the corpus's Circle Back songs
// on "Let's circle- BACK." and the sample, the flagship, on the new vocabulary.
export const ROTATION = Object.freeze({
  base:.4, home:.6, quote:2.5, conceptCap:3, repeat:1.7,
  minRel:{drop:.7, couplet:.7, ladder:.7, refrain:.7, signoff:1, exchanges:.7, stabs:.7},
  conceptWeight:{drop:1, couplet:1, ladder:1, refrain:1, signoff:.4, exchanges:1, stabs:1},
  near:{drop:.35, couplet:1.2, ladder:.35, refrain:1.2, signoff:.35, exchanges:1.2, stabs:1.5},
  salt:{drop:11, ladder:12, itsNot:13, refrain:14, signoff:15, exchanges:16, stabs:18, couplet:30, coupletDrop:21, title:57, itsNotFile:17, fallbackTag:24},
  coupletShare:LEXICON.casting.coupletDrop.share, strongTopic:2, itsNotShare:1 / 3, titleShare:LEXICON.casting.caps.corpus.circleBackTitleShare,
  fresh:{near:LEXICON.casting.freshness.near, far:LEXICON.casting.freshness.far},
  exchanges:2, secondExchange:2.5, stabs:2, sameVoice:.6, flat:['couplet', 'exchanges', 'stabs'],
  sensitiveFamilies:['jargon', 'single', 'call', 'closer'],
});
export const BAND_SLOTS = ['drop', 'couplet', 'ladder', 'refrain', 'signoff', 'exchanges', 'stabs'];
const P = ROTATION;
const HOME = LEXICON.casting.home, HOUSE = LEXICON.casting.house, EVERGREEN = LEXICON.casting.evergreen;
const TOPIC_GROUPS = Object.fromEntries(Object.entries(LEXICON.topics).map(([t, d]) => [t, d.concepts]));
const FAMILY_OF = Object.fromEntries(LEXICON.inventory.map(p => [p.file, p.family]));
const BANK = Object.fromEntries(LEXICON.bank.map(b => [b.id, b]));
const homeOfFile = file => HOME.family[FAMILY_OF[file]];
// Her two retired defaults: "Let's build." (50) plays only where the post is about
// building; "Let's circle back" (06) only as Circle Back's title drop (one song in
// four, by hash) or where the post says it.
const BUILD_FILE = '50.wav', CIRCLE_FILE = '06.wav';
const BUILDING = /\b(?:build|builds|building|built|builder|builders)\b/i;
const CIRCLE_BACK = stems('circle back');
const ITS_NOT = ['22.wav', '09.wav'];

// Quoting a line: its content words, in order, as the post's stems. A single
// word must be long and specific to count ("launch", "mindset"; not "hour").
const QUOTE_STOP = new Set(['a', 'an', 'the', 'it', 'its', 'not', 'to', 'of', 'and', 'my', 'your', 'i', 'im', 'is', 'this', 'that', 'in', 'on', 'for', 'we', 'let', 'lets', 'be', 'our', 'me', 'you', 'what', 'just', 'with', 'at', 'or', 'no']);
const QUOTE_WEAK = new Set(['work', 'team', 'post', 'more', 'time', 'year', 'week', 'great', 'thing', 'people', 'every', 'first', 'next', 'today', 'there', 'about', 'think', 'thought']);
const quoteKeys = texts => texts.map(t => stems(t).filter(w => !QUOTE_STOP.has(w))).filter(k => k.length >= 2 || (k.length === 1 && k[0].length >= 5 && !QUOTE_WEAK.has(k[0])));
const words1 = (file, [a, b]) => entryOf(file).words.slice(a, b + 1).map(w => w.text);
const ladyText = (file, w) => words1(file, w).join(' ').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ');

// Parts: what a cast slot hands the engine. The lady's are her file and words;
// Strategy's and Synthia's a take id (vocabulary/takes.js); Synergy's his text.
// Strategy leads the new lines and the voice bank renders every line in his
// voice too, so a line the lexicon gives Synthia is his when it leads (a
// refrain, a call) or when it is not a few clear words (takes.js clearFor);
// she keeps her short answers. `available` (the bank's Whisper results) moves
// a line of hers that did not pass to him, at cast time.
const ladyPart = (file, words, display, text = ladyText(file, words)) => ({voice:'lady', file, words:[...words], text, display});
const voiceFor = (t, {lead = false, stab = false, max} = {}) => t.voice !== 'synthia' ? t.voice
  : lead || !clearFor(t, {stab}) || (max !== undefined && t.syllables > max) ? 'strategy' : 'synthia';
const takePart = (id, how) => { const t = takeOf(id); return {voice:voiceFor(t, how), id:t.id, text:t.text, display:t.display}; };
const bankPart = (b, how) => b.voice === 'lady' ? ladyPart(b.lady.file, b.lady.words, b.display) : takePart(b.id, how);
const takesOfParts = parts => parts.flatMap(p => [p, p.pickup].filter(Boolean)).filter(p => p.id);
const filesOfParts = parts => parts.flatMap(p => [p, p.pickup].filter(Boolean)).filter(p => p.file).map(p => p.file);

// ---- the pools, built once

// Her ladder and tag cuts (lady-roles.json), as band lines.
const ladyLine = (role, c) => {
  const p = c.phrase, own = role === 'tag' ? [...words1(c.file, c.words), ...words1(c.file, c.impact)].join(' ') : words1(c.file, c.words).join(' ');
  return {slot:role === 'tag' ? 'drop' : 'ladder', kind:'lady', role, key:role === 'tag' ? `tag:${c.file}` : `${c.file}:${c.display}`, cut:c, file:c.file,
    display:role === 'tag' ? `${c.display} ${c.impactDisplay}` : c.display, concepts:p.topics || [], keys:quoteKeys([...(p.keywords || []), own]),
    home:homeOfFile(c.file), craft:c.craft ?? 1, shown:displayWords(c), files:[c.file], takes:[], isDefault:!!c.default, circle:c.file === CIRCLE_FILE,
    ok:track => c.tracks.includes(track) && (role !== 'tag' || c.default || (mixOf(c, track) ?? 1) >= MIX_MIN)};
};
const LADY_TAGS = CANDIDATES.tag.map(c => ladyLine('tag', c));
const LADY_LADDERS = CANDIDATES.ladder.filter(c => !c.couplet).map(c => ladyLine('ladder', c));
const ITS_NOT_LADDERS = CANDIDATES.ladder.filter(c => c.couplet).map(c => ladyLine('ladder', c));

// The couplets: the 71 of the bank, and her two recorded ones (09, 33; her
// template, 22, is the refrain). Every X and Y is unique.
const COUPLETS = [
  ...LEXICON.couplets.map(c => {
    const x = takePart(`${c.id}-call`);
    const y = c.lady ? {...ladyPart(c.lady.file, c.lady.words, ladyText(c.lady.file, c.lady.words).toUpperCase()), pickup:takePart(c.yFrame === "It's a" ? 'its-a' : 'its')} : takePart(`${c.id}-response`);
    const drop = c.drop?.tracks?.length ? {tracks:c.drop.tracks, tag:takePart(`${c.id}-tag`),
      impact:c.drop.impactVoice === 'lady' ? ladyPart(c.lady.file, [c.lady.words[1], c.lady.words[1]], c.drop.impactDisplay) : takePart(`${c.id}-impact`)} : null;
    return {kind:'couplet', id:c.id, key:`couplet:${c.id}`, c, topics:c.topics, groups:c.topics.map(t => TOPIC_GROUPS[t]), concepts:c.concepts,
      keys:quoteKeys([c.x, c.y]), home:HOME.topic[c.topics[0]], craft:c.strong ? 1 : .8, line:c.line, display:c.display.join(' '),
      x, y, drop, shown:shownOf(c.x, c.y), layoffs:c.topics.includes('layoffs'), lex:[c.id], ok:() => true};
  }),
  ...LEXICON.recordedCouplets.filter(r => r.lady.file !== '22.wav').map(r => {
    const b = LEXICON.bank.find(e => e.lady?.file === r.lady.file && e.roles.includes('couplet'));
    const x = ladyPart(r.x.file, r.x.words, ladyText(r.x.file, r.x.words).toUpperCase()), y = ladyPart(r.y.file, r.y.words, ladyText(r.y.file, r.y.words).toUpperCase());
    return {kind:'couplet', id:r.id, key:`couplet:${r.id}`, recorded:true, topics:b.topics, groups:[...b.topics.map(t => TOPIC_GROUPS[t]), b.concepts], concepts:b.concepts,
      keys:quoteKeys([ladyText(r.x.file, r.x.words), ladyText(r.y.file, r.y.words)]), home:HOME.family[b.family], craft:b.sing / 3, line:r.text, display:b.display,
      x, y, drop:null, shown:shownOf(r.text), layoffs:false, lex:[r.id, b.id], ok:() => true};
  }),
];
for (const c of COUPLETS) {
  c.parts = [c.x, c.y]; c.files = filesOfParts(c.parts); c.takes = takesOfParts(c.parts);
  // Her drop words are cut from her Y take: when he sings Y, he sings them too.
  if (c.drop && c.y.voice === 'strategy') for (const k of ['tag', 'impact']) if (c.drop[k].id) c.drop[k] = {...c.drop[k], voice:'strategy'};
}
const COUPLET_BY_ID = Object.fromEntries(COUPLETS.map(c => [c.id, c]));

// The couplet's drop lands as a word (Aaron, Nov 5): its impact is cast only where Whisper heard it
// exactly in the mix (vocabulary/impact-heard.json, scripts/measure-impacts.mjs), in the voice that
// was heard: its own (the Y's), else the other one, else it is not the drop on that track. A track
// the table does not measure (Offsite plays the river, which has no drop) keeps every couplet.
export function dropVoiceOf(c, track, avail = () => true) {
  const heard = IMPACT_HEARD.tracks[track];
  if (!heard) return c.drop.impact.voice;
  const t = heard[c.id];
  if (!t) return null;
  if (c.drop.impact.voice === 'lady') return t.lady?.ok ? 'lady' : null;
  const own = c.drop.impact.voice, order = [own, own === 'synthia' ? 'strategy' : 'synthia'];
  return order.find(v => t[v]?.ok && avail({...c.drop.impact, voice:v}) && (!c.drop.tag.id || avail({...c.drop.tag, voice:v}))) ?? null;
}

// The bank's lines, per slot. Strategy leads the new lines; Synthia answers, so
// her refrains and calls are his, and she keeps only short, clear words
// (takes.js clearFor). Synergy keeps "Let's circle back", Circle Back's sign-off.
const bankLine = (slot, b, how) => {
  const part = bankPart(b, how);
  return {slot, kind:'bank', id:b.id, key:b.id, b, voice:b.voice, concepts:b.concepts, keys:quoteKeys([b.text]), home:HOME.family[b.family],
    craft:b.sing / 3, display:b.display, text:b.text, parts:[part], files:filesOfParts([part]), takes:takesOfParts([part]), shown:shownOf(b.display), lex:[b.id],
    ok:() => true, retired:b.status === 'demoted'};
};
const bankFor = (slot, role, how) => LEXICON.bank.filter(b => b.roles.includes(role) && b.status !== 'demoted').map(b => bankLine(slot, b, how));
// The refrain: the bank's refrains (Synthia's sung by Strategy: a refrain leads),
// and any other phrase of the lady's or Strategy's that sings (open vowels,
// loops, survives +12: the lexicon's own definition of a refrain, 2 to 9
// syllables), except her sink line. Her template, "It's not about X. It's about
// Y." (22), is the anthem's refrain where the post argues "not X, it's Y"
// itself: the post says it, in a way.
const sings = b => b.sing === 3 && b.syllables >= 2 && b.syllables <= 9 && b.text.trim().includes(' ') && b.id !== 'let-that-sink-in';
const REFRAINS = LEXICON.bank.filter(b => b.status !== 'demoted' && (b.roles.includes('refrain') || (b.voice !== 'synthia' && sings(b))))
  .map(b => bankLine('refrain', b, {lead:true})).map(c => c.files.includes('22.wav') ? {...c, saysIf:'notabout'} : c);
const SYNTHIA_SIGNOFF = 5;
// The sign-off: the bank's sign-offs and her closers ("Watch this space."), not
// "Full stop." (her stop, right after it). Synthia's when it is a few clear
// words ("In conclusion", "Follow for more"): the band's last answer to the post.
const SIGNOFFS = [...LEXICON.bank.filter(b => (b.roles.includes('signoff') || b.family === 'closer') && b.status !== 'demoted' && b.id !== 'full-stop')
    .map(b => bankLine('signoff', b, {max:SYNTHIA_SIGNOFF})),
  {slot:'signoff', kind:'synergy', id:'circle-back', key:'circle-back', lex:['circle-back'], voice:'synergy', concepts:['meeting'], keys:quoteKeys(["let's circle back"]), home:'circle-back', craft:1,
    display:"LET'S CIRCLE BACK", text:"Let's circle back", parts:[{voice:'synergy', text:"Let's circle back", display:"LET'S CIRCLE BACK"}], files:[], takes:[], shown:shownOf("LET'S CIRCLE BACK"), circle:true, ok:track => track === 'circle-back'}];
// The stabs: one word said like a verdict, and her two-word verdicts ("Milestone unlocked.", "Lessons learned.").
const STABS = [...bankFor('stabs', 'stab', {stab:true}),
  ...LEXICON.bank.filter(b => b.voice === 'lady' && !b.roles.includes('stab') && b.roles.includes('answer') && b.lady.words[1] - b.lady.words[0] <= 1).map(b => bankLine('stabs', b))];
// The exchanges: a call and its answer. Synthia calls nothing (her call is his).
const EXCHANGES = LEXICON.exchanges.map((e, i) => {
  const side = (s, how) => s.voice === 'lady' ? bankPart(BANK[s.id]) : takePart(exchangeTakeId(s), how);
  const call = side(e.call, {lead:true}), response = side(e.answer), concepts = [...new Set([...(BANK[e.call.id]?.concepts || []), ...(BANK[e.answer.id]?.concepts || [])])];
  return {slot:'exchanges', kind:'exchange', id:`exchange:${i}`, key:`${e.call.id ?? exchangeTakeId(e.call)}>${e.answer.id ?? exchangeTakeId(e.answer)}`, e, topics:e.topics,
    groups:[...e.topics.map(t => TOPIC_GROUPS[t]), ...(concepts.length ? [concepts] : [])], concepts, keys:quoteKeys([e.call.text, e.answer.text]),
    home:e.topics.length ? HOME.topic[e.topics[0]] : HOME.family[BANK[e.call.id]?.family], craft:.8, display:`${call.display} ${response.display}`,
    call, response, parts:[call, response], shown:shownOf(call.display, response.display), lex:[e.call.id, e.answer.id].filter(Boolean), ok:() => true};
// A call and its answer are two voices (the lady may answer herself: "Agree or disagree?" "Agree").
}).filter(x => x.call.voice === 'lady' || x.call.voice !== x.response.voice);
for (const x of EXCHANGES) { x.files = filesOfParts(x.parts); x.takes = takesOfParts(x.parts); }

// The house rotation and the evergreen lines, per slot, as pool keys.
const houseOf = (slot, track, pool) => {
  // The drop's house: the track's own rotation, and the lines at home in it (her tags of the track's
  // families, its couplets whose impact is heard there: the pool holds only those), so a rotation
  // couplet that is not heard on the track leaves room for the others.
  if (slot === 'drop') return new Set([...(HOUSE[track]?.drop || []), ...pool.filter(c => c.home === track).map(c => c.key)]);
  if (slot === 'couplet') return new Set([...(HOUSE[track]?.drop || []).filter(k => k.startsWith('couplet:')), ...pool.filter(c => c.home === track).map(c => c.key)]);
  if (HOUSE[track]?.[slot]) return new Set(HOUSE[track][slot]);
  return new Set(pool.filter(c => c.home === track).map(c => c.key));
};
const evergreenOf = (slot, pool) => {
  if (slot === 'couplet') return new Set((EVERGREEN.drop || []).filter(k => k.startsWith('couplet:')));
  if (EVERGREEN[slot]) return new Set(EVERGREEN[slot]);
  if (slot === 'exchanges') return new Set(pool.filter(x => !x.topics.length).map(x => x.key));
  return new Set(pool.map(c => c.key));
};

// ---- relevance and the pick

function relevanceLex(c, reading, slot) {
  const one = k => { const h = reading.concepts[k]; return h ? 1 + .25 * Math.min(3, Math.max(0, h.hits - 1)) : 0; };
  const group = list => { const v = list.map(one).filter(Boolean).sort((a, b) => b - a); return v.length ? v[0] + .25 * v.slice(1).reduce((a, b) => a + b, 0) : 0; };
  const g = (c.groups || [c.concepts]).map(group).sort((a, b) => b - a);
  const topic = Math.min(P.conceptCap, (g[0] || 0) + .5 * (g[1] || 0)) * P.conceptWeight[slot];
  const said = c.keys.find(k => findSeq(reading.stems, k) >= 0) ?? (c.saysIf && reading.concepts[c.saysIf] ? 'argued' : undefined);
  const hit = [...new Set((c.groups || [c.concepts]).flat())].filter(k => reading.concepts[k]);
  const reasons = [...(said === 'argued' ? ['the post argues it: “not X, it\'s Y”'] : said ? [`the post says “${reading.words.slice(findSeq(reading.stems, said), findSeq(reading.stems, said) + said.length).map(w => w.raw).join(' ')}”`] : []),
    ...(topic ? [`topic ${hit.slice(0, 3).map(k => `${k} (${quote(reading.concepts[k].words.slice(0, 1))})`).join(', ')}`] : [])];
  return {points:topic + (said ? P.quote : 0), topic, said:!!said, reasons};
}

// History: per slot, the songs before this one (oldest first), each a list of keys.
function historyOf(recent) {
  const slots = [...BAND_SLOTS, ...BEAM_ROLES], out = Object.fromEntries(slots.map(s => [s, []]));
  if (!recent) return out;
  if (Array.isArray(recent)) {
    for (const song of recent) {
      const k = song?.keys ?? song;
      if (!k) continue;
      for (const s of slots) if (k[s] !== undefined && k[s] !== null) out[s].push([].concat(k[s]));
    }
  } else for (const s of slots) out[s] = [].concat(recent[s] ?? []).map(k => [].concat(k));
  return out;
}

function makeState(reading, track, {seed, recent, available, hook, flags}) {
  const history = historyOf(recent), files = new Set(), ids = new Set(), words = new Set(hook);
  const avail = typeof available === 'function' ? available : available ? part => available.has(takeKey(part)) : () => true;
  // A take part as the bank can sing it: hers if she passed, else his, else none.
  // A line of Strategy's the bank has only in Synthia's voice (voice-table.js voicesFor: Kokoro never said it so
  // Whisper heard it) is hers, unless it leads (a refrain, a call): she answers, she does not lead.
  const voiced = (part, lead = false) => !part?.id ? part : avail(part) ? part : part.voice === 'synthia' && avail({...part, voice:'strategy'}) ? {...part, voice:'strategy'}
    : part.voice === 'strategy' && !lead && avail({...part, voice:'synthia'}) ? {...part, voice:'synthia'} : null;
  const S = {reading, track, text:reading.text, files, ids, words, hook:new Set(hook), flags, history, avail, voiced, why:{},
    salt:salt => (Math.imul((seed >>> 0) + 1, 0x9E3779B1) ^ salt) >>> 0,
    fresh(slot, key) {
      const list = history[slot]; let ago = 0;
      for (let i = list.length - 1; i >= 0; i--) if (list[i].includes(key)) { ago = list.length - i; break; }
      return !ago ? 1 : ago <= P.fresh.near.songs ? P.fresh.near.factor : ago <= P.fresh.far.songs ? P.fresh.far.factor : 1;
    },
    // A line is free when its recordings, its lexicon id and its takes are, and the voice bank has its takes.
    free(c) {
      if (c.files.some(f => files.has(f)) || ids.has(c.key) || (c.lex || []).some(x => ids.has(x))) return false;
      if ((c.files.includes(BUILD_FILE) && !flags.building) || (c.files.includes(CIRCLE_FILE) && !flags.circleBack && !c.title)) return false;
      if ((c.circle || c.files.includes(CIRCLE_FILE)) && S.circleSaid) return false;
      if (!c.takes.every(p => voiced(p, c.slot === 'refrain' || (c.kind === 'exchange' && p === c.call)))) return false;
      // An exchange is two voices: her line that moves to him must not leave him answering himself.
      return c.kind !== 'exchange' || c.call.voice === 'lady' || voiced(c.call)?.voice !== voiced(c.response)?.voice;
    },
    take(c, shownExtra = []) {
      for (const f of c.files) files.add(f);
      ids.add(c.key); for (const x of c.lex || []) ids.add(x);
      if (c.circle || c.files.includes(CIRCLE_FILE)) S.circleSaid = true;
      for (const w of [...c.shown, ...shownExtra]) words.add(w);
    },
  };
  return S;
}

const levelName = {topic:'on topic', house:'the house rotation', evergreen:'an evergreen line', any:'the best that fits'};
function pick(slot, pool, S, {salt, allow = () => true, shown = c => c.shown, also = () => 1, wide = null, any = false}) {
  let list = [];
  for (const c of pool) {
    if (!c.ok(S.track) || !allow(c) || !S.free(c)) continue;
    const rel = relevanceLex(c, S.reading, slot), home = c.home === S.track ? P.home : 0;
    // No content word twice (a word the song already shows costs a line most of what the post's
    // quoting it gave), and the hook is Synergy's: the band does not sing its words back
    // ("We're a family" stays his).
    const words = shown(c), repeats = words.filter(w => S.words.has(w)).length;
    const fresh = S.fresh(slot, c.key);
    const s = ((P.base + rel.points + home) * (.6 + .4 * c.craft) - repeats * P.repeat) * fresh * also(c);
    list.push({c, rel, s, fresh, repeats, home:!!home});
  }
  if (!list.length) return null;
  // No content word twice in the song: a line that repeats one plays only when every free line does.
  const fresh = list.filter(x => !x.repeats);
  if (fresh.length) list = fresh;
  const house = houseOf(slot, S.track, pool), ever = evergreenOf(slot, pool);
  // any: every free line as likely (less freshness and repeats), whatever its topic.
  let level = any ? 'any' : 'topic', tier = any ? list : list.filter(x => x.rel.points >= P.minRel[slot]);
  // The house: the track's own rotation and the lines at home in it.
  if (!tier.length) { level = 'house'; tier = list.filter(x => house.has(x.c.key) || x.home); }
  if (!tier.length) { level = 'evergreen'; tier = list.filter(x => ever.has(x.c.key)); }
  if (!tier.length) { level = 'any'; tier = list; }
  const best = Math.max(...tier.map(x => x.s)), near = level === 'topic' ? wide ?? P.near[slot] : Infinity;
  const close = tier.filter(x => x.s >= best - near);
  // On topic, the closer to the best the likelier (steeply for the drop, the ladder and the sign-off;
  // gently for the wide slots, so the meetings lines do not take every meeting post); in the fallbacks
  // every line is as likely, less what it repeats or a recent song sang.
  const flat = !!wide || P.flat.includes(slot);
  const weights = close.map(x => Math.max(.02, level !== 'topic' ? x.fresh * (.6 + .4 * x.c.craft) * (x.repeats ? .5 : 1)
    : flat ? (.5 + .5 * (x.s - (best - near)) / near) * x.fresh : x.s - (best - near) + .05)), sum = weights.reduce((a, b) => a + b, 0);
  let r = fnv(S.text, S.salt(salt)) * sum, k = 0;
  while (k < close.length - 1 && r >= weights[k]) r -= weights[k++];
  const chosen = close[k];
  const reasons = [...(level === 'topic' ? chosen.rel.reasons : [levelName[level] + (level === 'house' ? ` of ${TRACKS[S.track].title}` : '')]),
    ...(chosen.home && level === 'topic' ? [`at home in ${TRACKS[S.track].title}`] : []),
    ...(close.length > 1 ? [`one of ${close.length} close lines: the post's hash decided`] : []),
    ...(chosen.fresh < 1 ? [`sung in a recent song: x${chosen.fresh}`] : [])];
  return {...chosen, level, reasons, close:close.length};
}

// ---------------------------------------------------------------- castSong

export function castSong(post, {seed = 0, track, recent, available, candidates = false} = {}) {
  const reading = readPost(post);
  const choice = track ? {track:trackOf(track).id, ...scoreTracks(reading), close:[], fallback:false, forced:true} : chooseTrack(reading, seed);
  const id = choice.track;
  const hookText = (() => { try { return lyricsFromPost(post).hook; } catch { return ''; } })(), hook = shownOf(hookText);
  const flags = {
    sensitive:SENSITIVE.test(reading.text) && !reading.concepts.workfamily,
    layoffs:!!reading.concepts.restructuring,
    // "Let's build." only where the post is about building, and never as an echo of its hook
    // ("Let's keep building" sung by Synergy under 40 of her "Let's build." was the chorus Aaron heard).
    building:BUILDING.test(reading.text) && !BUILDING.test(hookText),
    circleBack:findSeq(reading.stems, CIRCLE_BACK) >= 0,
    notabout:!!reading.concepts.notabout,
    title:false, coupletDrop:false, itsNot:false,
  };
  const S = makeState(reading, id, {seed, recent, available, hook, flags}), why = {};
  // A couplet may play here: never at a person (a post about family, health or
  // grief takes only meetings and metrics couplets, and none in its drop); the
  // layoff couplets only where the post is about a layoff or a restructuring.
  const coupletAllowed = c => (!c.layoffs || flags.layoffs) && (!flags.sensitive || c.topics.every(t => t === 'meetings' || t === 'metrics'));

  // 1. The drop: her tag and its impact, or a couplet ("It's a quick- SYNC.").
  //    Circle Back keeps its title on one song in four; a couplet drops on about
  //    40% of the posts by hash, and always where the post argues "not X, it's Y"
  //    itself or a couplet is strongly on topic.
  const titleTag = LADY_TAGS.find(c => c.file === CIRCLE_FILE && c.isDefault);
  flags.title = id === 'circle-back' && fnv(reading.text, S.salt(P.salt.title)) < P.titleShare;
  const dropCouplets = COUPLETS.filter(c => c.drop && c.drop.tracks.includes(id) && coupletAllowed(c)).map(c => {
    const voice = dropVoiceOf(c, id, S.avail);
    if (!voice) return null;
    const drop = voice === 'lady' ? c.drop : {...c.drop, tag:{...c.drop.tag, voice}, impact:{...c.drop.impact, voice}};
    return {...c, drop, slot:'drop', files:filesOfParts([c.x, c.y, drop.tag, drop.impact]), takes:takesOfParts([c.x, c.y, drop.tag, drop.impact])};
  }).filter(Boolean);
  let drop;
  if (flags.title) { drop = {c:{...titleTag, title:true}, level:'title', reasons:["Circle Back's own title: one Circle Back song in four keeps it (the post's hash)"]}; }
  else {
    const strong = dropCouplets.some(c => S.free(c) && relevanceLex(c, reading, 'drop').topic >= P.strongTopic);
    // Where the post argues it, the drop is a couplet; on the hash's share and where a couplet is
    // strongly on topic, the couplets join her tags and the best on the post wins (the lexicon's prototype).
    const open = !flags.sensitive && dropCouplets.length > 0 && (fnv(reading.text, S.salt(P.salt.coupletDrop)) < P.coupletShare || flags.notabout || strong);
    // On the hash's share the drop is a couplet: among those close to the best, the post's hash decides (as
    // the couplet slot's close calls do, P.near.couplet), so a track with few couplets heard does not drop on
    // the same one every time. Strongly on topic, the couplets join her tags and the best wins.
    const byHash = fnv(reading.text, S.salt(P.salt.coupletDrop)) < P.coupletShare;
    // The hash's couplet drop is not a topic call, and a post that argues "not X, it's Y" takes any couplet:
    // any couplet heard on the track, as likely as any other. Strongly on topic, the closest wins.
    const cpl = open ? pick('drop', dropCouplets, S, {salt:P.salt.drop, ...((byHash || flags.notabout) && !strong ? {any:true} : {wide:P.near.couplet})}) : null;
    if (open) drop = flags.notabout || byHash ? cpl : pick('drop', [...(cpl ? [cpl.c] : []), ...LADY_TAGS], S, {salt:P.salt.drop});
    drop ??= pick('drop', LADY_TAGS, S, {salt:P.salt.drop});
    flags.coupletDrop = drop.c.kind === 'couplet';
    if (flags.coupletDrop) drop.reasons = [...drop.reasons, flags.notabout ? 'the post argues "not X, it\'s Y" itself' : strong ? 'a couplet strongly on topic' : 'a couplet drop: the post\'s hash'];
  }
  S.take(drop.c);
  why.drop = drop.reasons;

  // 2. The couplet: the drop's, or the anthem's (Drop B and the outro, where the hook's later repeats were).
  const couplet = drop.c.kind === 'couplet' ? drop : pick('couplet', COUPLETS.filter(coupletAllowed), S, {salt:P.salt.couplet});
  if (couplet && couplet !== drop) S.take(couplet.c);
  why.couplet = couplet ? (couplet === drop ? ['the drop\'s couplet', ...drop.reasons] : couplet.reasons) : ['no couplet fits'];

  // 3. The refrain: Strategy's or the lady's (her template, "It's not about X. It's about Y.", where the post argues it).
  // On a post about family, health or grief the band sings work language only (jargon, calls, single words,
  // closers): no wellness, humility or story line aimed back at what the post is about.
  const workOnly = c => !flags.sensitive || !c.b || P.sensitiveFamilies.includes(c.b.family);
  const refrain = pick('refrain', REFRAINS, S, {salt:P.salt.refrain, allow:c => workOnly(c) && !(c.files.includes('22.wav') && couplet?.c.recorded)});
  if (refrain) S.take(refrain.c);
  why.refrain = refrain ? refrain.reasons : ['no refrain fits'];

  // 4. Her ladder: on one couplet drop in three, the denial itself ("It's not", 22 or 09, climbing to the choke).
  let ladder = null;
  if (flags.coupletDrop && fnv(reading.text, S.salt(P.salt.itsNot)) < P.itsNotShare) {
    const free = ITS_NOT_LADDERS.filter(c => c.ok(id) && S.free(c)), first = fnv(reading.text, S.salt(P.salt.itsNotFile)) < .5 ? 0 : 1;
    const c = free.find(x => x.file === ITS_NOT[first]) ?? free[0];
    if (c) { ladder = {c, level:'couplet', reasons:[`the couplet's denial, climbing: “It's not”`]}; flags.itsNot = true; }
  }
  ladder ??= pick('ladder', LADY_LADDERS, S, {salt:P.salt.ladder});
  S.take(ladder.c);
  why.ladder = ladder.reasons;

  // 5. The sign-off, before the tape stop.
  const signoff = pick('signoff', SIGNOFFS, S, {salt:P.salt.signoff, allow:workOnly});
  if (signoff) S.take(signoff.c);
  why.signoff = signoff ? signoff.reasons : ['no sign-off fits'];

  // 6. The exchanges: a call and its answer. One, and a second where the post asks for it
  //    (the post says it, or it is strongly on topic): sixteen exchanges are few, and one
  //    heard in every other song would be the next "Let's circle back".
  const exchanges = [];
  for (let k = 0; k < P.exchanges; k++) {
    const x = pick('exchanges', EXCHANGES, S, {salt:P.salt.exchanges + k * 101, allow:c => (!c.files.includes(CIRCLE_FILE) || id === 'circle-back')});
    if (!x || (k > 0 && !(x.level === 'topic' && x.rel.points >= P.secondExchange))) break;
    S.take(x.c); exchanges.push(x);
  }
  why.exchanges = exchanges.map(x => x.reasons);

  // 7. The stabs: one word each, said like a verdict; two voices where they can.
  const stabs = [];
  for (let k = 0; k < P.stabs; k++) {
    const x = pick('stabs', STABS, S, {salt:P.salt.stabs + k * 101, allow:workOnly, also:c => stabs.some(s => s.c.voice === c.voice) ? P.sameVoice : 1});
    if (!x) break;
    S.take(x.c); stabs.push(x);
  }
  why.stabs = stabs.map(x => x.reasons);

  // 8. Her other roles: the beam, around every recording the band took.
  const cache = new Map();
  const blocked = file => (file === BUILD_FILE && !flags.building) || (file === CIRCLE_FILE && (!flags.circleBack || S.circleSaid));
  const lists = Object.fromEntries(BEAM_ROLES.map(role => [role, candidatesFor(role, reading, id, S, cache, blocked)]));
  const best = pickSet(lists, BEAM_ROLES, S.files, S.words);
  for (const role of BEAM_ROLES) { S.files.add(best.picks[role].file); for (const w of best.picks[role].shown) S.words.add(w); }

  // 9. Her tag: the drop's, or (when the couplet drops) her best free tag, which
  //    plays wherever the engine does not place the couplet's drop.
  const tag = drop.c.kind === 'lady' ? drop : pick('drop', LADY_TAGS, S, {salt:P.salt.fallbackTag}) ?? {c:LADY_TAGS.find(c => c.isDefault), reasons:['the last free tag']};
  if (tag !== drop) S.take(tag.c);

  // The cast: her roles for arrangeDrop, then the band's.
  const cast = {}, lady = {};
  const tagCut = tag.c.cut;
  cast.ladder = castEntry(ladder.c.cut); lady.ladder = ladder.reasons;
  cast.tag = castEntry(tagCut);
  cast.impact = {file:tagCut.file, words:[...tagCut.impact], display:tagCut.impactDisplay};
  lady.tag = tag === drop ? drop.reasons : [`her tag where the couplet's drop is not placed: ${tag.reasons[0]}`];
  lady.impact = [`the payoff of “${tagCut.display.replace(/-$/, '')}”`];
  for (const role of BEAM_ROLES) { cast[role] = castEntry(best.picks[role]); lady[role] = best.picks[role].reasons; }
  const ordered = Object.fromEntries(LADY_ROLES.map(r => [r, cast[r]]));
  const ladyDrop = {kind:'lady', tag:ladyPart(tagCut.file, tagCut.words, tagCut.display), impact:ladyPart(tagCut.file, tagCut.impact, tagCut.impactDisplay)};
  const cp = couplet?.c;
  // Every take part as the bank sings it (her line moves to him where she did not pass).
  const v = (part, lead) => part?.pickup ? {...S.voiced(part), pickup:S.voiced(part.pickup)} : S.voiced(part, lead);
  const band = {
    couplet:cp ? {id:cp.id, topic:topicOf(cp, reading), line:cp.line, x:v(cp.x), y:v(cp.y), recorded:!!cp.recorded} : null,
    refrain:refrain ? v(refrain.c.parts[0], true) : null,
    exchanges:exchanges.map(x => ({call:v(x.c.call, true), response:v(x.c.response), topics:x.c.topics})),
    signoff:signoff ? v(signoff.c.parts[0]) : null,
    stabs:stabs.map(x => v(x.c.parts[0])),
    dropTag:drop.c.kind === 'couplet' ? {kind:'couplet', id:cp.id, x:v(cp.x), tag:v(drop.c.drop.tag), impact:v(drop.c.drop.impact), tracks:[...cp.drop.tracks]} : ladyDrop,
  };
  // Where the confession falls to Synthia (only she passed it), he answers: one couplet, two voices.
  if (band.couplet && band.couplet.x.voice === 'synthia' && band.couplet.y.voice === 'synthia' && band.couplet.y.id && S.avail({...band.couplet.y, voice:'strategy'})) band.couplet.y = {...band.couplet.y, voice:'strategy'};
  // (The drop's tag and impact are sung in the voice its impact was heard in: dropVoiceOf.)
  const keys = {...Object.fromEntries(BEAM_ROLES.map(r => [r, ladyKey(best.picks[r])])), drop:drop.c.key, couplet:cp ? cp.key : null, ladder:ladder.c.key, refrain:refrain?.c.key ?? null, signoff:signoff?.c.key ?? null,
    exchanges:exchanges.map(x => x.c.key), stabs:stabs.map(x => x.c.key)};
  const out = {...ordered, ...band};
  const whyAll = {track:choice.forced ? [`chosen by hand: ${TRACKS[id].title}`] : choice.fallback ? ['nothing decisive in the post: Circle Back by default']
    : [...choice.parts[id].map(p => `${p.concept} +${p.points}: ${quote(p.words.slice(0, 3)).join(', ')}`), ...(choice.close.length > 1 ? [`close call with ${choice.close.filter(t => t !== id).map(t => TRACKS[t].title).join(', ')}: the post's hash decided`] : [])],
  lady, band:why};
  const line = trackLine(choice, reading, {flags, couplet:band.couplet, refrain:band.refrain});
  const isDef = role => { const d = DEFAULTS[role], c = cast[role]; return c.file === d.file && c.words.join() === d.words.join(); };
  return {track:id, cast:out, why:whyAll, line,
    scores:Object.fromEntries(TRACK_ORDER.map(t => [t, +choice.scores[t].toFixed(2)])), recast:ROLE_ORDER.filter(r => !isDef(r)), keys, flags,
    ...(candidates ? {candidates:Object.fromEntries(BEAM_ROLES.map(r => [r, lists[r].slice(0, 6).map(c => ({display:c.display, file:c.file, score:+c.score.toFixed(3), relevant:+(c.relevant ?? 0).toFixed(2), isDefault:!!c.isDefault, filler:!!c.filler}))]))} : {})};
}
// The couplet's topic: the one of its topics the post speaks to most (its first otherwise).
function topicOf(c, reading) {
  const score = t => (TOPIC_GROUPS[t] || []).reduce((n, k) => n + (reading.concepts[k]?.hits ?? 0), 0);
  return [...c.topics].sort((a, b) => score(b) - score(a))[0] ?? null;
}

// Every recording a cast uses, her roles and the band's parts.
export function castFiles(cast) {
  const out = [];
  for (const [role, c] of Object.entries(cast || {})) {
    if (!c) continue;
    if (LADY_ROLES.includes(role)) { if (role !== 'impact') out.push(c.file); continue; }
    if (role === 'dropTag') { if (c.kind === 'couplet') out.push(...filesOfParts([c.impact])); continue; }
    if (role === 'couplet') { out.push(...filesOfParts([c.x, c.y])); continue; }
    if (role === 'exchanges') { for (const x of c) out.push(...filesOfParts([x.call, x.response])); continue; }
    out.push(...filesOfParts([].concat(c)));
  }
  return out;
}

// Arrange with the post's cast; a gap role (bend, lift, punct) that today's
// line would have filled but the recast could not (its words need a longer
// gap in Synergy's line) goes back to today's line, unless the band sings that
// recording. `arrange` is a form's arrange(), so this stays pure. Returns {plan, cast, restored}.
const gapRole = (plan, sinkFile) => e => e.role !== 'punct' ? null : e.bend ? 'bend' : e.lift ? 'lift' : e.file === sinkFile && e.at === trackOf(plan.track).drop.places.letThat ? null : 'punct';
export function settleCast(arrange0, lyrics, durations, {track, cast, coldOpen} = {}) {
  const arrange = coldOpen ? (l, d, o) => arrange0(l, d, {...o, coldOpen}) : arrange0;
  let plan = arrange(lyrics, durations, {track, cast});
  if (!cast || plan.form !== 'drop60') return {plan, cast, restored:[]};
  const placed = p => new Set(p.lady.map(gapRole(p, (cast.sink || DEFAULT_CAST.sink).file)).filter(Boolean));
  const today = new Set(arrange(lyrics, durations, {track}).lady.map(gapRole(plan, DEFAULT_CAST.sink.file)).filter(Boolean));
  const have = placed(plan), used = new Set(castFiles(cast));
  const restored = [...today].filter(role => !have.has(role) && cast[role] && cast[role].file !== DEFAULT_CAST[role].file && !used.has(DEFAULT_CAST[role].file));
  if (!restored.length) return {plan, cast, restored};
  const next = {...cast};
  for (const role of restored) next[role] = DEFAULT_CAST[role];
  return {plan:arrange(lyrics, durations, {track, cast:next}), cast:next, restored};
}

// The cast as the page shows it: the lady's lines, in the order she says them.
export function castLines(cast) {
  const c = cast || DEFAULT_CAST;
  return [c.ladder?.display, c.tag && c.impact ? `${c.tag.display} ${c.impact.display}` : null, c.bend?.display, c.sink?.display, c.lift?.display, c.punct?.display, c.stop?.display].filter(Boolean);
}
// The band's lines, in the order the song reaches them.
export function bandLines(cast) {
  const c = cast || {};
  return [c.dropTag?.kind === 'couplet' ? `${c.dropTag.x.display} ${c.dropTag.tag.display} ${c.dropTag.impact.display}` : null,
    ...(c.stabs || []).map(s => s.display), c.refrain?.display, ...(c.exchanges || []).map(x => `${x.call.display} ${x.response.display}`),
    c.couplet && !(c.dropTag?.kind === 'couplet') ? `${c.couplet.x.display} ${c.couplet.y.pickup ? `${c.couplet.y.pickup.display} ` : ''}${c.couplet.y.display}` : null, c.signoff?.display].filter(Boolean);
}

export {DEFAULTS as DEFAULT_CANDIDATES, ROLE_ORDER, BAND_ROLES, COUPLET_BY_ID};
