// Casting: the post picks its song, and the lady's lines. castSong(post)
// reads the post's tone with a small lexicon, picks one of the song book's
// tracks, then casts each of her roles from the 57 recordings in
// lady-roles.json: what each recording can play, with which words, and what it
// is about. Pure and deterministic (no network, no clock, no Math.random): the
// same post and seed give the same song, the same cast and the same reasons.
//
//   castSong(post, {seed, track}) -> {track, cast, why:{track:[...], lady:{role:[...]}}, line, scores, recast}
//   settleCast(arrange, lyrics, durations, {track, cast}) -> {plan, cast, restored}
//
// `track` forces the song (the manual picker) and casts the lady for it;
// `cast` is a full cast for arrangeDrop (songbook/index.js castOf); `line` is
// the page's one line of copy. README.md, "Casting", documents the rules.
import ROLE_TABLE from './lady-roles.json' with {type:'json'};
import {LADY_TABLE} from './lady-table.js';
import {tagRate} from './drop.js';
import {TRACKS, TRACK_ORDER, DEFAULT_TRACK, DEFAULT_CAST, LADY_ROLES, trackOf} from './songbook/index.js';

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
// concepts tag the lady's recordings (lady-roles.json topics), so the post and
// her lines meet on them. `weight` is per track: the tone that picks the song.
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
  money:{words:['revenue', 'series a', 'series b', 'series c', 'funding', 'raised', 'investors', 'pipeline', 'salary', 'cloud bill', 'budget', 'profit', 'arr', 'mrr', 'cryptocurrency', 'valuation', 'biggest client'], re:/\$\s?\d[\d.,]*\s?[kmb]?\b/i, weight:{hustle:1.3}},
  growth:{words:['growth', 'grew', 'grow', 'scale', 'scaling', '10x', 'increase', 'doubled', 'conversion', 'outperform'], re:/(?:\+|\bup\s)\d+(?:\.\d+)?\s?%|\b\d+x\b/i, weight:{hustle:1.2}},
  grind:{words:['grind', 'hustle', 'cold plunge', 'morning routine', 'morning system', 'no days off', 'hunger', 'hungry', 'wake', 'every day', 'the edge', 'discipline'], re:/\b[4-7](?::\d\d)?\s?a\.?m\b|\b5am\b/i, weight:{hustle:2}},
  productivity:{words:['productivity', 'productive', 'focus', 'deep work', 'efficiency', 'output'], weight:{hustle:1}},
  momentum:{words:['momentum', 'compound', 'compounds', 'consistency', 'habit', 'daily', 'streak', 'a day'], weight:{hustle:1}},
  execution:{words:['execution', 'ship', 'shipped', 'deliver', 'delivered', 'build', 'building', 'built', 'hackathon', 'sprint', 'make it permanent', 'just do it'], weight:{hustle:1.3}},
  data:{words:['data', 'numbers', 'metric', 'metrics', 'kpi', 'okr', 'dashboard', 'stats', 'data points'], re:/\b\d+(?:\.\d+)?\s?%/, weight:{hustle:.8, 'circle-back':.3}},
  hiring:{words:['hiring', 'hire', 'candidate', 'interview', 'recruiter', 'red flag', 'green flag', 'resume', 'résumé'], weight:{hustle:.6, 'circle-back':.4}},
  speed:{words:['fast-paced', 'fast', 'faster', 'speed', 'weeks early', 'in one sprint', 'overnight'], weight:{hustle:.8}},
  meeting:{words:['meeting', 'all-hands', 'standup', 'calendar', 'schedule', 'follow-up', 'circle back', 'email', 'inbox', 'offsite', 'sync', 'agenda', 'kickoff', 'memo', 'status update', 'business review'], weight:{'circle-back':1.6}},
  process:{words:['process', 'approval', 'step', 'checklist', 'workflow', 'documented', 'quarterly', 'planning cycle', 'roadmap', 'onboarding', 'framework', 'pods', 'reorganize', 'rebranding', 'deck', 'slide', 'workstreams', 'performance review', 'improvement plans'], weight:{'circle-back':1.3}},
  jargon:{words:['synergy', 'synergies', 'alignment', 'align', 'leverage', 'leveraging', 'stakeholder', 'buy-in', 'unlock value', 'bandwidth', 'engagement', 'retention', 'visibility', 'transformation', 'asynchronous', 'ecosystem', 'priorities', 'ambiguity', 'accountability', 'transparency', 'intention', 'customer obsession', 'culture fit', 'culture add'], weight:{'circle-back':1.3}},
  opinion:{words:['thoughts', 'unpopular opinion', 'opinion', 'hot take', 'agree or disagree', 'what would you add', 'who do you trust', "let's discuss", 'nobody talks about', 'be honest'], weight:{'circle-back':1}},
  strategy:{words:['strategy', 'strategic', 'plan', 'vision', 'consultants', 'leadership', 'leader', 'manager', 'stop chasing', 'start chasing'], weight:{'circle-back':.8, hustle:.3}},
  feedback:{words:['feedback', 'criticism', 'rating', 'performance review', 'gave me a', 'approval rating'], weight:{'circle-back':.4}},
  culture:{words:['culture', 'values', 'mission', 'purpose', 'trust', 'morale', 'family', 'empty cup', 'emotional intelligence', 'lifestyle', 'philosophy'], weight:{'circle-back':1, 'humbled-and-honored':.3}},
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

// The one line of copy: a track's quip after the post's own words, picked by the post's hash.
const QUIP = {
  'circle-back':['This post could have been a meeting.', 'Per my last email.', "Let's take this offline."],
  'humbled-and-honored':['Someone is very honored.', 'Humbled, once again.', 'Grateful for this journey.'],
  hustle:['This post is up at 5 a.m.', 'No days off.', 'Rise and grind.'],
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
const SENSITIVE = /\b(?:family|health|cried|grandmother|grandfather|son|daughter|kids?|\d+-year-old|year-old|wife|husband|mom|dad|funeral|passed away|cancer|diagnos\w*)\b/i;
const WEAK = new Set(['thank', 'thanks', 'day', 'days', 'every day', 'new', 'first', 'next', 'start', 'post']);
function trackLine(choice, reading) {
  if (choice.fallback) return FALLBACK_LINE;
  // A goodbye or personal news is not "very honored": it is a journey.
  const gentle = choice.track === 'humbled-and-honored' && (reading.concepts.farewell || SENSITIVE.test(reading.text));
  const quips = QUIP[choice.track], quip = gentle ? 'Grateful for this journey.' : quips[Math.floor(fnv(reading.text, 7) * quips.length)];
  return `${TRACKS[choice.track].title}, for ${andList(quote(evidence(reading, choice.parts[choice.track])))}. ${quip}`;
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
const CONTENT = w => w.length > 3 && !['that', 'this', 'what', 'with', 'have', 'just', 'from', 'your', 'about', "let's", 'lets', 'here'].includes(w);

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

// Scoring. A line's value in a role is its relevance times how well it plays
// the role (craft, the table's 0-1 rating, as 0.4 + 0.6 craft), times the
// role's weight. Today's line holds the role's BASELINE plus its own
// relevance: the moments named after their line (the sink, "Read that again.",
// "Full stop.") need the post's own words to replace them; the others may
// also be recast on topic alone (TOPICAL). A line under RELEVANT is never a
// recast; it is only a filler when today's line is taken.
const RELEVANT = 1, TOPICAL = {tag:.7, ladder:.7, lift:.7, bend:.7};
const TIE_LINE = .3;
const BASELINE = {tag:1.5, ladder:1.6, sink:2.2, punct:2.1, stop:2.1, lift:1.4, bend:1.4};
// The tag and its impact are the payoff; the ladder is the build; the rest punctuate.
const ROLE_WEIGHT = {tag:1.6, ladder:1.3, sink:1.1, punct:1, stop:.9, lift:.8, bend:.8};
const ROLE_ORDER = ['tag', 'ladder', 'sink', 'punct', 'stop', 'lift', 'bend'];
// The song's own line: in Circle Back the lady says its title, so its tag
// holds harder; in the other songs "Let's circle back" is only today's tag.
const SIGNATURE = {'circle-back':{role:'tag', file:'06.wav', points:2}};
const OPEN_TAG = {'humbled-and-honored':1, hustle:1};
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
  return [...new Set(text.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter(CONTENT).map(stem))];
}

// fits() per candidate and track, once: the table does not change.
const FIT = new Map();
const fitOf = (role, c, track) => { const key = `${role}|${c.file}|${c.words}|${c.split ?? ''}|${track}`; if (!FIT.has(key)) FIT.set(key, fits(role, c, track)); return FIT.get(key); };

function candidatesFor(role, reading, track, salt, cache) {
  const def = DEFAULTS[role], out = [], sig = SIGNATURE[track], W = ROLE_WEIGHT[role];
  const bonusOf = c => sig && sig.role === role && sig.file === c.file ? sig.points : 0;
  const defRel = relevance(reading, def, cache), defBonus = bonusOf(def);
  const baseline = role === 'tag' ? OPEN_TAG[track] ?? BASELINE.tag : BASELINE[role];
  out.push({...def, score:(baseline + defRel.points + defBonus) * W, fit:fitOf(role, def, track), relevant:defRel.points, isDefault:true,
    reasons:defRel.said ? [...defRel.reasons, "today's line, and the post agrees"] : defBonus ? ["the song's own line"] : ["nothing in the post beats today's line"]});
  for (const c of CANDIDATES[role]) {
    if (c.default) continue;
    const fit = fitOf(role, c, track);
    if (!fit.ok || mixOf(c, track) < MIX_MIN) continue;
    const rel = relevance(reading, c, cache), relevant = rel.points >= RELEVANT && (rel.said || rel.topic >= (TOPICAL[role] ?? Infinity)), jitter = fnv(`${role}|${c.file}|${c.words}`, salt) * .01;
    const score = relevant ? (rel.points + bonusOf(c)) * craftOf(c) * heardOf(c, track) * W + jitter : craftOf(c) * heardOf(c, track) * .3 - 1 + jitter;
    out.push({...c, score, fit, relevant:rel.points, filler:!relevant, reasons:relevant ? rel.reasons : ["today's line is taken: the best free line"]});
  }
  out.sort((x, y) => y.score - x.score);
  // Near-ties (within TIE_LINE of the best, today's line included) are settled
  // by the post's hash, weighted by how close each is, so similar posts vary:
  // the chosen line takes the best score and the best takes its, nothing else moves.
  const close = out.filter(c => !c.filler && out[0].score - c.score < TIE_LINE);
  if (close.length > 1) {
    const weights = close.map(c => TIE_LINE - (out[0].score - c.score) + .05), sum = weights.reduce((a, b) => a + b, 0);
    let r = fnv(`tie|${role}`, salt) * sum, k = 0;
    while (k < close.length - 1 && r >= weights[k]) r -= weights[k++];
    const pick = close[k];
    if (pick !== out[0]) {
      [pick.score, out[0].score] = [out[0].score, pick.score];
      pick.reasons = [...pick.reasons, `a close call with “${out[0].display.replace(/-$/, '')}”: the post's hash decided`];
      out.sort((x, y) => y.score - x.score);
    }
  }
  return out;
}

// Pick a coherent set: no recording twice (the tag and its impact are one
// recording, by design), no content word shown twice, the most relevant
// lines in the roles that carry the most. A beam over the roles, then pair
// swaps (a line moving to a better role while another role takes today's).
const BEAM = 160, PER_ROLE = 12, REPEAT_PENALTY = .8;
function total(picks) {
  let score = 0; const files = new Set(), seen = new Map();
  for (const role of ROLE_ORDER) {
    const c = picks[role]; if (!c) continue;
    if (files.has(c.file)) return -Infinity;
    files.add(c.file); score += c.score;
    for (const w of c.shown) { if (seen.has(w)) score -= REPEAT_PENALTY; seen.set(w, 1); }
  }
  return score;
}
// Files as bits (57 recordings: two 32-bit words), so a beam state is cheap.
const FILE_BIT = new Map(Object.keys(LADY_TABLE).sort().map((f, i) => [f, i]));
const hasFile = (lo, hi, f) => { const i = FILE_BIT.get(f); return i < 32 ? (lo >>> i) & 1 : (hi >>> (i - 32)) & 1; };
const withFile = (lo, hi, f) => { const i = FILE_BIT.get(f); return i < 32 ? [(lo | (1 << i)) >>> 0, hi] : [lo, (hi | (1 << (i - 32))) >>> 0]; };
function pickSet(lists) {
  const def = {};
  for (const role of ROLE_ORDER) for (const c of lists[role]) { c.shown ??= displayWords(c); if (c.isDefault) def[role] = c; }
  // A filler only when today's line is taken.
  const usable = (role, c, lo, hi) => !hasFile(lo, hi, c.file) && (c.isDefault || !c.filler || hasFile(lo, hi, def[role].file));
  let beam = [{score:0, picks:{}, lo:0, hi:0, words:[]}];
  for (const role of ROLE_ORDER) {
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
  const legal = trial => ROLE_ORDER.every(r => trial[r].isDefault || !trial[r].filler || ROLE_ORDER.some(o => o !== r && trial[o].file === def[r].file));
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (const r1 of ROLE_ORDER) for (const c1 of lists[r1].slice(0, PER_ROLE)) {
      if (c1 === picks[r1]) continue;
      const holder = ROLE_ORDER.find(r => r !== r1 && picks[r].file === c1.file);
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

export function castSong(post, {seed = 0, track, candidates = false} = {}) {
  const reading = readPost(post);
  const choice = track ? {track:trackOf(track).id, ...scoreTracks(reading), close:[], fallback:false, forced:true} : chooseTrack(reading, seed);
  const id = choice.track;
  const cache = new Map(), salt = (fnv(reading.text, seed) * 4294967296) >>> 0;
  const lists = Object.fromEntries(ROLE_ORDER.map(role => [role, candidatesFor(role, reading, id, salt, cache)]));
  const best = pickSet(lists);
  const cast = {}, lady = {};
  for (const role of ROLE_ORDER) {
    const c = best.picks[role];
    cast[role] = castEntry(c);
    lady[role] = c.reasons;
    if (role === 'tag') {
      cast.impact = {file:c.file, words:[...c.impact], display:c.impactDisplay};
      lady.impact = [`the payoff of “${c.display.replace(/-$/, '')}”`];
    }
  }
  const ordered = Object.fromEntries(LADY_ROLES.map(r => [r, cast[r]]));
  const why = {track:choice.forced ? [`chosen by hand: ${TRACKS[id].title}`] : choice.fallback ? ['nothing decisive in the post: Circle Back by default']
    : [...choice.parts[id].map(p => `${p.concept} +${p.points}: ${quote(p.words.slice(0, 3)).join(', ')}`), ...(choice.close.length > 1 ? [`close call with ${choice.close.filter(t => t !== id).map(t => TRACKS[t].title).join(', ')}: the post's hash decided`] : [])],
  lady};
  return {track:id, cast:ordered, why, line:choice.forced ? `${TRACKS[id].title}, chosen by hand.` : trackLine(choice, reading),
    scores:Object.fromEntries(TRACK_ORDER.map(t => [t, +choice.scores[t].toFixed(2)])), recast:ROLE_ORDER.filter(r => !best.picks[r].isDefault),
    ...(candidates ? {candidates:Object.fromEntries(ROLE_ORDER.map(r => [r, lists[r].slice(0, 6).map(c => ({display:c.display, file:c.file, score:+c.score.toFixed(3), relevant:+(c.relevant ?? 0).toFixed(2), isDefault:!!c.isDefault, filler:!!c.filler}))]))} : {})};
}

// Arrange with the post's cast; a gap role (bend, lift, punct) that today's
// line would have filled but the recast could not (its words need a longer
// gap in Synergy's line) goes back to today's line. `arrange` is a form's
// arrange(), so this stays pure. Returns {plan, cast, restored}.
const gapRole = (plan, sinkFile) => e => e.role !== 'punct' ? null : e.bend ? 'bend' : e.lift ? 'lift' : e.file === sinkFile && e.at === trackOf(plan.track).drop.places.letThat ? null : 'punct';
export function settleCast(arrange0, lyrics, durations, {track, cast, coldOpen} = {}) {
  const arrange = coldOpen ? (l, d, o) => arrange0(l, d, {...o, coldOpen}) : arrange0;
  let plan = arrange(lyrics, durations, {track, cast});
  if (!cast || plan.form !== 'drop60') return {plan, cast, restored:[]};
  const placed = p => new Set(p.lady.map(gapRole(p, (cast.sink || DEFAULT_CAST.sink).file)).filter(Boolean));
  const today = new Set(arrange(lyrics, durations, {track}).lady.map(gapRole(plan, DEFAULT_CAST.sink.file)).filter(Boolean));
  const have = placed(plan), used = new Set(Object.entries(cast).filter(([, c]) => c).map(([, c]) => c.file));
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

export {DEFAULTS as DEFAULT_CANDIDATES, ROLE_ORDER};
