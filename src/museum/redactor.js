// THE REDACTION OFFICE — the museum's anonymizer.
// Strips everything identifying from a pasted post BEFORE it can be
// submitted: names, companies, handles, emails, links, impressive numbers.
// Runs entirely in the browser; only the redacted document ever leaves it,
// and only if the visitor clicks submit. The same input always produces the
// same redaction, so a preview is exactly what would be submitted.

const PEOPLE = ['[ANONYMOUS VISIONARY]', '[NAME WITHHELD BY CURATOR]', '[A REDACTED COLLEAGUE]', '[CERTIFIED THOUGHT LEADER]'];
const COMPANIES = ['[REDACTED FORTUNE 500 COMPANY]', '[A COMPANY YOU HAVE HEARD OF]', '[REDACTED STARTUP]', '[UNDISCLOSED EMPLOYER]'];

// words that read as capitalized but identify nothing
const SAFE = new Set([
  'I', 'A', 'The', 'My', 'Our', 'We', 'But', 'And', 'So', 'It', 'This', 'That', 'These', 'Those', 'They', 'He', 'She',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'AM', 'PM', 'CEO', 'CTO', 'CFO', 'COO', 'VP', 'AI', 'B2B', 'B2C', 'SaaS', 'HR', 'PR', 'ROI', 'KPI', 'API', 'MBA', 'DM', 'DMs',
  'BIG', 'NEWS', 'ONE', 'LIVE', 'NOW', 'NOT', 'WHY', 'HOW', 'WHEN', 'GRATEFUL', 'LOUD', 'MORE', 'YOUR',
]);
const COMPANY_TAIL = /\b(Inc|LLC|Ltd|Corp|Co|Labs|Systems|Group|Technologies|Solutions|Partners|Capital|Ventures|Media|Studio|Agency)\.?$/;
const COMPANY_CUE = /\b(at|with|from|for|joined|joining|left|leaving)\s*$/i;

export function redact(text){
  const src = String(text || '');
  const map = new Map(); // original → placeholder, stable within a document
  let people = 0, companies = 0, redactions = 0;

  const assign = (original, isCompany) => {
    if(!map.has(original)){
      const pool = isCompany ? COMPANIES : PEOPLE;
      map.set(original, pool[(isCompany ? companies++ : people++) % pool.length]);
    }
    redactions++;
    return map.get(original);
  };

  let out = src
    // the platform itself is a proper noun with one obvious referent
    .replace(/\bLinked[iI]n\b/g, () => { redactions++; return '[THE PLATFORM]'; })
    .replace(/\b(ChatGPT|GPT-?\d\w*|Claude|Gemini|Copilot|Midjourney)\b/g, () => { redactions++; return '[REDACTED AI TOOL]'; })
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, () => { redactions++; return '[EMAIL REDACTED]'; })
    .replace(/https?:\/\/\S+|www\.\S+/gi, () => { redactions++; return '[LINK REDACTED]'; })
    .replace(/(^|\s)@[\w.-]{2,}/g, (m, pre) => { redactions++; return pre + '[@REDACTED]'; })
    // impressive numbers: money, percentages, multipliers, thousands
    .replace(/\$[\d,.]+\s?(?:k|K|m|M|b|B|million|billion)?\b/g, () => { redactions++; return '[IMPRESSIVE SUM]'; })
    .replace(/\b\d+(?:\.\d+)?%/g, () => { redactions++; return '[IMPRESSIVE PERCENT]'; })
    .replace(/\b\d+(?:\.\d+)?x\b/gi, () => { redactions++; return '[IMPRESSIVE MULTIPLE]'; })
    .replace(/\b\d{1,3}(?:,\d{3})+\b/g, () => { redactions++; return '[LARGE NUMBER]'; });

  // placeholders inserted above must never be re-processed by later passes
  const SPLIT_PLACEHOLDERS = /(\[[A-Z@][A-Z0-9 @&.-]*\])/g;
  const guarded = (text, fn) => text.split(SPLIT_PLACEHOLDERS)
    .map(seg => /^\[[A-Z@]/.test(seg) ? seg : fn(seg)).join('');

  // capitalized runs, sentence-position aware: a run that isn't just a
  // sentence-opening common word gets redacted. '.' is NOT a word character
  // here — "Acme Corp. Thanks" must break at the sentence, not merge across it
  out = guarded(out, seg => seg.replace(/(^|[.!?:\n]\s*|\s)((?:[A-Z][\w''&-]*)(?:\s+[A-Z][\w''&-]*)*)/g, (m, pre, run, offset, str) => {
    const words = run.split(/\s+/);
    const atSentenceStart = pre === '' || /[.!?:\n]\s*$/.test(pre);
    // single safe/common word, or a sentence-opening single word: leave it
    if(words.length === 1 && (SAFE.has(words[0].replace(/[.,!?]+$/, '')) || atSentenceStart)) return m;
    if(words.every(w => SAFE.has(w.replace(/[.,!?]+$/, '')))) return m;
    // trailing punctuation stays outside the placeholder
    const tail = run.match(/[.,!?:]+$/) ? run.match(/[.,!?:]+$/)[0] : '';
    const core = tail ? run.slice(0, -tail.length) : run;
    // drop a safe sentence-opening word from the front of a longer run
    let lead = '';
    let body = core;
    if(atSentenceStart && words.length > 1 && SAFE.has(words[0])){
      lead = words[0] + ' ';
      body = words.slice(1).join(' ');
      if(!body) return m;
    }
    // the cue word ("at", "joined"…) lives just before the match, so look back
    const before = str.slice(Math.max(0, offset - 16), offset) + pre + lead;
    const isCompany = COMPANY_TAIL.test(body) || COMPANY_CUE.test(before);
    return pre + lead + assign(body, isCompany) + tail;
  }));

  // pass 2: a name redacted anywhere is redacted everywhere — including the
  // sentence-initial mentions pass 1 had to leave alone ("Sarah previously…")
  const wordMap = new Map();
  for(const [orig, ph] of map){
    for(const w of orig.split(/\s+/)){
      const bare = w.replace(/[^\w'-]/g, '');
      if(bare.length >= 3 && !SAFE.has(bare)) wordMap.set(bare, ph);
    }
  }
  if(wordMap.size){
    out = guarded(out, seg => seg.replace(/\b[A-Z][\w'-]{2,}\b/g, w => {
      if(!wordMap.has(w)) return w;
      redactions++;
      return wordMap.get(w);
    }));
  }

  return { text: out, redactions };
}
