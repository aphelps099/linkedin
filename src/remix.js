// The remix engine. Takes a pasted LinkedIn post and works out how to perform it:
// which lines go on screen, which recorded phrases the machine says over them, and
// how much thought leadership was detected. Entirely local — the text never leaves
// the browser.
export const MAX_WORDS = 400;

// jargon → the phrase index we have a recording of, so the machine can say
// a line the author actually wrote
const MATCHES = [
  [/thrilled to (announce|share)/i, 0],
  [/humbled|honou?red/i, 1],
  [/(new position|new role|new chapter|starting a new)/i, 2],
  [/careful reflection|pursue new opportunities|next chapter/i, 3],
  [/synerg/i, 4],
  [/circle back/i, 5],
  [/leverage|leveraging/i, 6],
  [/pivot/i, 7],
  [/not about .*it'?s about/i, 8],
  [/delve|delving/i, 9],
  [/tapestry/i, 10],
  [/game[- ]?chang/i, 11],
  [/thoughts\?/i, 12],
  [/agree\?|agree or disagree/i, 13],
  [/let that sink in/i, 14],
  [/full stop/i, 15],
  [/excited to (share|announce)/i, 16],
  [/read that again/i, 17],
  [/here'?s what i learned|what it taught me/i, 18],
  [/changed everything/i, 19],
  [/most people (won'?t|will never)/i, 20],
  [/it'?s not x/i, 21],
  [/nobody else will|no one else will/i, 22],
  [/small moment|big lesson/i, 23],
  [/never forget/i, 24],
  [/rest is history/i, 25],
  [/grateful/i, 26],
  [/amazing team|incredible team|couldn'?t have done it/i, 27],
  [/onwards|upwards/i, 28],
  [/delighted to (have )?join/i, 29],
  [/fast[- ]paced/i, 30],
  [/passionate about|intersection of/i, 31],
  [/not just a job|a calling/i, 32],
  [/hot take/i, 33],
  [/unpopular opinion/i, 34],
  [/let'?s connect|explore synergies/i, 35],
  [/drop a comment|what do you think/i, 36],
];

// what the post is actually saying
export const TRANSLATIONS = [
  [/(excited|thrilled|happy) to (share|announce).*(new chapter|next chapter|new journey)/i, 'I was laid off.'],
  [/(open to work|new opportunities|pursue new opportunities)/i, 'I was laid off.'],
  [/after careful reflection/i, 'It was not my decision.'],
  [/restructur|rightsiz|realign|streamlin/i, 'Layoffs.'],
  [/grateful for (the|this) journey/i, 'I was laid off.'],
  [/we'?re hiring|join our team/i, 'We just had layoffs.'],
  [/circle back/i, 'Never speak of this again.'],
  [/let'?s take this offline/i, 'Stop talking.'],
  [/per my last email/i, 'Read the email.'],
  [/synerg/i, 'Two things, near each other.'],
  [/leverag/i, 'Use.'],
  [/bandwidth/i, 'Time.'],
  [/low[- ]hanging fruit/i, 'The easy one.'],
  [/move the needle/i, 'Do something. Anything.'],
  [/double[- ]click/i, 'Explain it again.'],
  [/thought leader/i, 'Person with opinions.'],
  [/hustle|grind|5 ?a\.?m\.?/i, 'I have no hobbies.'],
  [/humbled/i, 'Not humbled.'],
  [/blessed/i, 'Bragging.'],
  [/rockstar|ninja|guru|wizard/i, 'Underpaid.'],
  [/wearing many hats/i, 'Three jobs, one salary.'],
  [/fast[- ]paced environment/i, 'Chronically understaffed.'],
  [/self[- ]starter/i, 'Nobody will train you.'],
  [/like a family/i, 'Boundaries are discouraged.'],
  [/passionate about/i, 'Contractually obligated to care about.'],
  [/at the intersection of/i, 'Two nouns.'],
  [/game[- ]?chang/i, 'A minor update.'],
  [/delve|tapestry|testament to/i, 'Written by a machine.'],
  [/let that sink in|read that again/i, 'Please clap.'],
  [/thoughts\?|agree\?/i, 'Engagement bait.'],
  [/tag someone|repost if/i, 'Engagement bait.'],
];

// the Thought Leadership Index — weighted markers of the genre
const MARKERS = [
  {re:/\b(thrilled|excited|delighted|humbled|honou?red|grateful|blessed)\b/gi, w:6, label:'Performative gratitude'},
  {re:/\b(synergy|leverage|bandwidth|pivot|alignment|holistic|scalable|robust|ecosystem)\b/gi, w:5, label:'Buzzwords'},
  {re:/\b(delve|tapestry|testament|realm|underscore|multifaceted|pivotal|meticulous)\b/gi, w:8, label:'AI tells'},
  {re:/\b(circle back|touch base|low[- ]hanging fruit|move the needle|double[- ]click|deep dive)\b/gi, w:6, label:'Meeting speak'},
  {re:/\b(thoughts\?|agree\?|let that sink in|read that again|tag someone|repost if|drop a comment)\b/gi, w:9, label:'Engagement bait'},
  {re:/\b(hustle|grind|rise and grind|5 ?a\.?m\.?|no days off|outwork)\b/gi, w:7, label:'Grindset'},
  {re:/\b(journey|chapter|adventure|ride)\b/gi, w:4, label:'Journey language'},
  {re:/\b(rockstar|ninja|guru|wizard|unicorn|thought leader|visionary)\b/gi, w:6, label:'Job title inflation'},
  {re:/\bit'?s not [^.!?]{2,40}\bit'?s\b/gi, w:9, label:'Not X, but Y'},
  {re:/#\w+/g, w:3, label:'Hashtags'},
  {re:/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/gu, w:2, label:'Emoji'},
];

const RANKS = [
  [0,   'Refreshingly Human'],
  [18,  'Aspiring Thought Leader'],
  [36,  'Executive Presence'],
  [54,  'Certified Visionary'],
  [72,  'Thought Leadership Singularity'],
  [88,  'Please Log Off'],
];

const clean = s => s.replace(/\s+/g, ' ').trim();

export function wordCount(text){
  const t = clean(text);
  return t ? t.split(' ').length : 0;
}

export function truncateWords(text, max = MAX_WORDS){
  const words = clean(text).split(' ');
  return words.length <= max ? clean(text) : words.slice(0, max).join(' ');
}

// split into performable lines: sentences, then over-long ones on clause breaks
function toLines(text){
  const out = [];
  for(const raw of text.split(/(?<=[.!?])\s+|\n+/)){
    const s = clean(raw);
    if(!s) continue;
    if(s.length <= 90){ out.push(s); continue; }
    let buf = '';
    for(const part of s.split(/,\s+|\s+—\s+|\s+-\s+|;\s+/)){
      if((buf + ' ' + part).trim().length > 90 && buf){ out.push(clean(buf)); buf = part; }
      else buf = buf ? `${buf}, ${part}` : part;
    }
    if(clean(buf)) out.push(clean(buf));
  }
  return out;
}

// short, declarative, jargon-bearing lines make the best hooks
function hookScore(line){
  let s = 0;
  if(line.length < 60) s += 3;
  if(line.length < 34) s += 3;
  if(/[.!?]$/.test(line)) s += 2;
  MARKERS.forEach(m=>{ m.re.lastIndex = 0; if(m.re.test(line)) s += 4; });
  if(/^(and|but|so|because|which)\b/i.test(line)) s -= 3;
  // a wall of hashtags is not a hook
  const tags = (line.match(/#\w+/g) || []).length;
  const plain = line.replace(/#\w+/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\s]/gu, '');
  if(tags && plain.length < 12) s -= 14;
  if(!plain.length) s -= 20;
  return s;
}

export function translate(line){
  for(const [re, meaning] of TRANSLATIONS) if(re.test(line)) return meaning;
  return null;
}

export function analyze(text){
  const src = truncateWords(text);
  const words = wordCount(src);
  const lines = toLines(src);

  // score
  let raw = 0;
  const found = [];
  for(const m of MARKERS){
    m.re.lastIndex = 0;
    const hits = src.match(m.re);
    if(hits && hits.length){
      raw += m.w * Math.min(hits.length, 6);
      found.push({label:m.label, count:hits.length});
    }
  }
  // density, not just volume — a short post full of jargon should score high
  const per100 = words ? (raw / words) * 100 : 0;
  const score = Math.max(0, Math.min(100, Math.round(raw*.55 + per100*1.6)));
  let rank = RANKS[0][1];
  for(const [floor, name] of RANKS) if(score >= floor) rank = name;

  // which recorded phrases the machine can say over this post
  const phrases = [];
  for(const [re, idx] of MATCHES){
    if(re.test(src) && !phrases.includes(idx)) phrases.push(idx);
  }

  const ranked = lines.map((text, i)=> ({text, i, hook: hookScore(text), meaning: translate(text)}))
    .sort((a,b)=> b.hook - a.hook);
  const hook = ranked[0] || null;

  return {
    text: src,
    words,
    lines,
    score,
    rank,
    markers: found.sort((a,b)=> b.count - a.count),
    phrases,          // indices into PHRASES with recordings
    hook,             // the single most quotable line
    translations: lines.map(l=> translate(l)).filter(Boolean).slice(0, 6),
  };
}
