// The annotation and the advice share the same evidence. These are writing
// prompts, not claims about the author's intentions or AI authorship.
export const FINDING_PATTERNS = {
  journey: /\bjourney\b/gi,
  humbled: /\bhumbled\b/gi,
  sink: /let that sink in|read that again/gi,
  hashtags: /#\w+/g,
  rockets: /🚀/gu,
  notx: /it['’]?s not[^.!?\n]{2,70}it['’]?s (?:about )?/gi,
  bait: /\b(?:agree|thoughts)\?/gi,
  gratbrag: /\b(?:grateful|gratitude|thankful|proud|excited|thrilled)\b/gi,
  aitells: /\b(?:delve|tapestry|testament)\b/gi,
  grindset: /\b(?:5 ?a\.?m\.?|rise and grind|hustle|no days off)\b/gi,
  buzz: /\b(?:synerg\w*|leverag\w*|pivot\w*|bandwidth|alignment|scalable|ecosystem|empower\w*|disrupt\w*|game-?chang\w*|cross-functional|best-in-class)\b/gi,
  pipes: /[|·•]/g,
  helping: /\bhelping\b.{3,60}\b(?:grow|scale|win|thrive|succeed|transform|tell)\w*/gi,
  inflation: /\b(?:visionary|guru|ninja|rockstar|wizard|evangelist|thought leader|dreamer|disruptor|growth hacker)\b/gi,
  exflex: /\bex-[A-Z][\w-]*/g,
  topvoice: /top voice/gi,
  hemoji: /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}]/gu,
  speakerauthor: /\b(?:speaker|author|investor|advisor|coach|podcast host)\b/gi,
  passionate: /passionate about/gi,
  resultsdriven: /results-driven|proven track record/gi,
  manyhats: /wear(?:ing)? many hats/gi,
};

export const EDITORIAL_NOTES = {
  journey: ['Quite the commute.', 'Name the work, the change, or what you learned. Keep “journey” if you actually went somewhere.'],
  humbled: ['Humility. Now broadcasting.', 'Lead with what happened. You can share good news without announcing how humble you feel.'],
  sink: ['The insight can swim.', 'Cut the instruction. Give the reader a concrete example that makes the point for you.'],
  hashtags: ['A lot of filing cabinets.', 'Keep the one or two tags that actually describe the subject. Let the post do the rest.'],
  rockets: ['It’s an update. Not NASA.', 'Try the sentence without the rocket. What changed is more interesting than the launch emoji.'],
  oneliners: ['This could be a paragraph.', 'Group related sentences. Save a short standalone line for the point that deserves it.'],
  notx: ['A very familiar revelation.', 'State the actual lesson, then show what led you to it. The contrast is optional.'],
  longpost: ['The scroll has a pension.', 'Move the useful result to the opening. Cut repetition before cutting facts or examples.'],
  bait: ['The like button has a job.', 'Delete the generic question, or ask something specific that you genuinely want answered.'],
  gratbrag: ['So many feelings. One update.', 'Say what happened first. If you want to thank someone, name their actual contribution.'],
  aitells: ['A tapestry of office words.', 'Use the ordinary word you would say aloud. These phrases are style cues, not proof of AI authorship.'],
  grindset: ['Sleep is not a weakness.', 'Describe the result and what worked. Hours awake are not evidence of impact.'],
  buzz: ['Can we say this out loud?', 'Name the action and who it helps. “Use” can replace “leverage”; explain what “alignment” changed.'],
  pipes: ['Your title needs fewer lanes.', 'Keep your main role and one useful specialty. Put the rest in your About section.'],
  helping: ['Helping who do what?', 'Name the audience and a specific task or outcome. Only add a number if you can support it.'],
  inflation: ['Who issued the cape?', 'Use the actual role. An example of your work says more than “visionary” or “guru.”'],
  exflex: ['That was the last season.', 'Lead with what you do now. Keep the former employer in Experience if it is not relevant here.'],
  topvoice: ['The badge is not the job.', 'Use the headline to explain your work. The platform already has a place for badges.'],
  hemoji: ['A little less confetti.', 'Keep symbols that help someone read the headline. Remove decoration that competes with the role.'],
  hlong: ['That’s a very long name tag.', 'Put the role and specialty first. Move supporting detail into your About section.'],
  speakerauthor: ['How many lanyards?', 'Choose the role you want people to remember. Move supporting roles into the bio.'],
  thirdperson: ['Did you hire a narrator?', 'Try first person. Keep your work, experience, and achievements; change who is telling the story.'],
  passionate: ['Show us the interesting part.', 'Follow the interest with an example of what you made, solved, or learned.'],
  resultsdriven: ['A result would be lovely.', 'Replace the claim with an actual outcome. Keep the scale and timeframe if you know them.'],
  along: ['The biography has chapters.', 'Open with what you do and who it helps. Keep the strongest examples and remove repeated claims.'],
  manyhats: ['One head. Several departments.', 'Name the responsibilities that matter to your reader. Specific work beats a collection of hats.'],
};

export function annotationRanges(text, findings) {
  const ranges = [];
  findings.forEach((finding, findingIndex) => {
    const source = FINDING_PATTERNS[finding.key];
    if (!source) return;
    const pattern = new RegExp(source.source, source.flags);
    for (const match of text.matchAll(pattern)) {
      ranges.push({ start: match.index, end: match.index + match[0].length, findingIndex });
    }
  });
  // Earlier, more severe findings own an overlapping phrase. Check accepted
  // ranges only, so one discarded overlap cannot hide a later valid mark.
  ranges.sort((a, b) => a.findingIndex - b.findingIndex || a.start - b.start);
  const accepted = [];
  for (const range of ranges) {
    if (!accepted.some(other => range.start < other.end && range.end > other.start)) accepted.push(range);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

export function evidenceFor(text, finding) {
  const source = FINDING_PATTERNS[finding.key];
  if (!source) return null;
  return new RegExp(source.source, source.flags.replace('g', '')).exec(text)?.[0] || null;
}

// A deliberately bounded cleanup for arbitrary pasted writing. Unlike the
// Lessons humanizer, never remove whole paragraphs based on their opening.
// That would erase real names, dates, numbers, and context from a user's draft.
const PLAIN_WORDS = [
  [/\bleveraging\b/gi, 'using'], [/\bleverage\b/gi, 'use'],
  [/\butilizing\b/gi, 'using'], [/\butilize\b/gi, 'use'],
  [/\bsynergies\b/gi, 'ways to work together'], [/\bsynergy\b/gi, 'teamwork'],
  [/\bcircle back\b/gi, 'follow up'], [/\btouch base\b/gi, 'talk'],
  [/\bdelve into\b/gi, 'look at'],
];

export function cleanDraft(text) {
  const original = String(text || '').trim();
  let clean = original;
  const announcement = /^(?:(?:i['’]m|i am|we['’]re|we are)\s+)?(?:(?:so|very|incredibly|deeply)\s+)?(?:humbled|honou?red|excited|thrilled|proud)(?:\s+and\s+(?:humbled|honou?red|excited|thrilled|proud))*\s+to\s+(?:announce|share)(?:\s+that)?\s+/i;
  clean = clean.replace(announcement, '');
  clean = clean.replace(/(^|[.!?]\s+|\n+)(?:let that sink in|read that again)[.!?]?(?=\s|$)/gi, '$1');
  clean = clean.replace(/(^|[.!?]\s+|\n+)(?:agree|thoughts)\?(?=\s|$)/gi, '$1');
  for (const [pattern, replacement] of PLAIN_WORDS) clean = clean.replace(pattern, replacement);
  clean = clean.replace(/🚀\uFE0F?/gu, '');
  const tags = clean.match(/#[A-Za-z]\w*/g) || [];
  if (tags.length > 4) {
    let tag = 0;
    clean = clean.replace(/#[A-Za-z]\w*/g, match => ++tag <= 2 ? match : '');
  }
  clean = clean.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (clean !== original) {
    clean = clean.replace(/(^|[.!?]\s+)([a-z][\p{L}\p{N}]*)/gu, (_, prefix, word) =>
      prefix + (/^[a-z]+$/.test(word) ? word[0].toUpperCase() + word.slice(1) : word));
  }
  return clean || original;
}

export function verdictFor(result) {
  const count = (result.allFindings || result.findings).length;
  if (!count) return ['SUSPICIOUSLY HUMAN.', 'Clear enough to let the work speak.'];
  if (count < 3) return ['A LITTLE LOUD.', 'A few edits. Considerably less ceremony.'];
  if (count < 6) return ['MOSTLY PERFORMANCE.', 'There is a real update in here. Let it out.'];
  return ['PLEASE LOG OFF.', 'The personal brand has taken the wheel.'];
}
