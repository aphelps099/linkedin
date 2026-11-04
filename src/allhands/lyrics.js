// A post supplies every sung word. Nothing here invents lyrics: the hook and
// the verses are exact excerpts, cut into phrases a robot can sing in two bars.

export const SAMPLE_POST = `I used ChatGPT to optimize our onboarding checklist. We combined two steps and clarified who grants access.

A small change, but a powerful reminder of what becomes possible when we rethink how we work.

Grateful for a team that leads with alignment. Let's keep building. 🚀

#Onboarding #Leadership #AI`;

const MAX_WORDS = 9;
const BUZZ = /\b(synergy|synergies|alignment|aligned|journey|humbled|honou?red|grateful|thankful|blessed|thrilled|excited|proud|encouraged|visibility|impressions|announce|leverag(?:e|ed|ing)|impact|growth|momentum|purpose|innovation|transformation|together|building|future|leadership|leader|circle back|let'?s|keep|unlock|potential|mindset|vision|community|optimi[sz](?:e|ed|ing)|reminder|possible|chapter|agree)\b/gi;

// eSpeak reads the professional internet's favorite words badly. These
// respellings change only what Synergy is given to say, never the lyric shown.
const LEXICON = {
  chatgpt:'chat G P T', gpt:'G P T', ai:'A I', linkedin:'linked in', b2b:'B to B', b2c:'B to C',
  kpi:'K P I', kpis:'K P Is', roi:'R O I', okr:'O K R', okrs:'O K Rs', saas:'sass', ceo:'C E O',
  cto:'C T O', cmo:'C M O', vp:'V P', hr:'H R', q1:'Q 1', q2:'Q 2', q3:'Q 3', q4:'Q 4', genai:'jen A I',
};
export function say(display) {
  const word = display.replace(/[’]/g, "'").replace(/[.]+$/, '');
  return LEXICON[word.toLowerCase()] || (/^[A-Z]{2,4}$/.test(word) ? word.split('').join(' ') : word);
}

// Sung tokens keep their display spelling; the voice receives a clean word.
export function tokens(text) {
  return (text.match(/[\p{L}\p{N}](?:[\p{L}\p{N}'’.%&-]|,(?=\d{3}\b))*/gu) || [])
    .map(raw => raw.replace(/[.]+$/, ''))
    .map(display => ({display, word:say(display)}))
    .filter(t => /[\p{L}\p{N}]/u.test(t.word) && t.word.length <= 40);
}

// Vowel groups are a stylized estimate, good enough to give a long word more
// than one note. Spelled letters and numbers count one note each.
export function syllables(spoken) {
  if (spoken.includes(' ')) return Math.min(6, spoken.split(' ').reduce((n, part) => n + syllables(part), 0));
  if (/^[A-Z]$/.test(spoken)) return spoken === 'W' ? 3 : 1;
  if (/^[\d,]+%?$/.test(spoken)) return Math.min(6, spoken.replace(/\D/g, '').length + (spoken.includes(',') ? 2 : 0) + (spoken.endsWith('%') ? 2 : 0));
  const lower = spoken.toLowerCase().replace(/'s$/, '').replace(/[^a-z]/g, '');
  if (!lower) return 1;
  let groups = (lower.match(/[aeiouy]+/g) || []).length;
  if (/[^aeiouy]e$/.test(lower) && !/[^aeiouy]le$/.test(lower) && groups > 1) groups--;
  if (/[^aeiouytd]ed$/.test(lower) && groups > 1) groups--;
  return Math.max(1, Math.min(6, groups));
}

function clean(post) {
  return post
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/(^|\s)[#@][\p{L}\p{N}_]+/gu, ' ')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, ' ')
    .replace(/[ \t]+/g, ' ');
}

// Long sentences break at punctuation first, then at a conjunction, then in half.
function phrases(sentence) {
  const out = [];
  const visit = part => {
    const t = tokens(part);
    if (!t.length) return;
    if (t.length <= MAX_WORDS) { out.push(part.trim()); return; }
    const words = part.trim().split(/\s+/);
    const joints = words.map((w, i) => i > 1 && i < words.length - 2 && /^(but|and|when|because|while|so|which|that|how|of|with|for)$/i.test(w) ? i : -1).filter(i => i > 0);
    const middle = words.length / 2;
    const at = joints.sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0] ?? Math.ceil(middle);
    visit(words.slice(0, at).join(' '));
    visit(words.slice(at).join(' '));
  };
  // Commas inside numbers are not pauses. Fragments under three words (a
  // name, an aside) rejoin the phrase before them, so nobody gets dropped.
  const parts = sentence.split(/(?:,(?!\d{3}\b)|[;:–—])+/).reduce((acc, part) => {
    const prev = acc[acc.length - 1];
    if (prev && tokens(part).length < 3 && tokens(prev).length + tokens(part).length <= MAX_WORDS) acc[acc.length - 1] = `${prev},${part}`;
    else acc.push(part);
    return acc;
  }, []);
  parts.forEach(visit);
  return out;
}

const score = (p, index, total) => {
  const n = tokens(p).length;
  return (p.match(BUZZ) || []).length * 3 + (n >= 2 && n <= 4 ? 4 : n <= 6 ? 1 : -6) + (index >= total - 2 ? 2 : 0);
};

export function lyricsFromPost(post) {
  if (typeof post !== 'string' || !post.trim()) throw new Error('Paste a post to perform.');
  const sentences = clean(post).match(/[^.!?\n]+[.!?]*/g) || [];
  const all = sentences.flatMap(phrases).filter(p => tokens(p).length >= 2);
  if (!all.length) {
    const t = tokens(clean(post));
    if (!t.length) throw new Error('That post has no words to sing.');
    all.push(t.slice(0, MAX_WORDS).map(x => x.display).join(' '));
  }
  // Hook candidates: every short phrase, plus two-to-four-word runs inside
  // longer ones that carry the vocabulary. All exact.
  const candidates = all.flatMap((p, i) => {
    const t = tokens(p);
    if (t.length <= 5) return [{p, s:score(p, i, all.length) + 1, i, whole:true}];
    const own = [];
    for (let n = 2; n <= 4; n++) for (let at = 0; at + n <= t.length; at++) {
      const run = t.slice(at, at + n).map(x => x.display).join(' '), buzz = (run.match(BUZZ) || []).length;
      if (buzz && !/^(the|a|an|to|of|and|our|my)$/i.test(t[at + n - 1].display)) own.push({p:run, s:buzz * 3 + 1 + (n <= 3 ? 1 : 0), i, whole:false, from:p});
    }
    return own;
  });
  const best = candidates.sort((a, b) => b.s - a.s || b.i - a.i)[0]
    || {p:tokens(all[all.length - 1]).slice(0, 4).map(t => t.display).join(' '), whole:false};
  // A hook does not start on a conjunction: "and learned" becomes "learned".
  const hook = tokens(best.p).length > 2 ? best.p.replace(/^\s*(and|but|so|that|or)\s+/i, '') : best.p;
  const verses = all.filter(p => !(best.whole && p === best.p) && tokens(p).length >= 3);
  const written = verses.length ? verses.slice() : [hook];
  while (verses.length < 4) verses.push(written[verses.length % written.length]);
  return {hook:hook.replace(/[.!?]+$/, ''), verses:verses.slice(0, 4).map(v => v.replace(/[.!?]+$/, ''))};
}

export function uniqueWords(lyrics) {
  return [...new Set([lyrics.hook, ...lyrics.verses].flatMap(line => tokens(line).map(t => t.word)))];
}
