// LINKEDIN LESSONS — the composition engine.
// Takes interview answers + a LinkedInification level (1–5) and writes the post.
// Level 1 is genuinely publishable; level 5 is a corporate hallucination.
// Seeded, so scrubbing the dial escalates the SAME post instead of writing a new one.
// Entirely local — nothing leaves the browser.

export function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const newSeed = () => Math.floor(Math.random() * 0xffffffff);

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const pickN = (rng, arr, n) => {
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, Math.min(n, a.length));
};
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const uncap = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const noDot = s => (s || '').trim().replace(/[.!?]+$/, '');
// normalize a "where were they before" answer so it reads after "from":
// "Worked at a local nonprofit" → "a local nonprofit"; keeps proper nouns intact
const fromWhere = s => noDot(s)
  .replace(/^(i|we|they)\s+/i, '').replace(/^(worked|was|were|came from)\s+/i, '')
  .replace(/^(at|for|in|with)\s+/i, '')
  .replace(/^(A|An|The)(?=\s[a-z])/, m => m.toLowerCase());

export const LEVELS = [
  {n:1, name:'Almost Human',             blurb:'Clear, useful and relatively normal.'},
  {n:2, name:'Professionally Optimized', blurb:'Polished, with a modest amount of excitement.'},
  {n:3, name:'Thought Leader',           blurb:'More lessons, gratitude and strategic alignment.'},
  {n:4, name:'Peak LinkedIn',            blurb:'Humbled. Honored. Journey. Six unnecessary paragraphs.'},
  {n:5, name:'Corporate Hallucination',  blurb:'An ordinary Tuesday becomes a transformational moment for the global business community.'},
];

const HASHTAGS = {
  announce: ['#Leadership','#Growth','#TeamCulture','#NewBeginnings','#PeopleFirst','#Momentum','#DreamTeam','#NextChapter'],
  lesson:   ['#Leadership','#Growth','#Mindset','#LessonsLearned','#PersonalDevelopment','#Success','#Motivation','#Gratitude'],
  sell:     ['#CustomerSuccess','#Growth','#Results','#B2B','#Impact','#Partnership','#ROI','#Transformation'],
  urgency:  ['#Hiring','#Opportunity','#NowOrNever','#BigThingsComing','#DontMissOut','#StayTuned','#LastCall','#Momentum'],
  ai:       ['#AI','#ArtificialIntelligence','#FutureOfWork','#Innovation','#Productivity','#GameChanger','#AdaptOrDie','#TechTrends'],
};
const TAG_COUNT = [0, 2, 4, 5, 7]; // by level

// ---- shared dressing ----------------------------------------------------

// the "But this is about more than X. It's about Y." double pivot
const PIVOTS = [
  ['filling a role', 'investing in the future of our story'],
  ['one announcement', 'the kind of company we are choosing to become'],
  ['business', 'people. It has always been about people'],
  ['a milestone', 'the mindset that made it inevitable'],
  ['what we did', 'who we became while doing it'],
];

// both of these are markers the Thought Leadership Index detects — the dial
// must never score DOWN when it goes up, so high-level dressing stays on-index
const SINK = ['Let that sink in.', 'Read that again.'];

const L5_OPENERS = [
  "I don't post often. But today, I have to.",
  "I wasn't going to share this. My mentor convinced me the world needed it.",
  'I have started and deleted this post eleven times.',
  'Some posts are announcements. This one is a turning point.',
];

const STRUGGLES = [
  "Three years ago, I was sleeping on an air mattress in my cousin's garage.",
  'In 2019 I hit rock bottom. Then I found out rock bottom had a basement.',
  "Five years ago, a recruiter told me I'd never make it in this industry.",
  'There was a time I checked my bank balance with one eye closed.',
];

const SYNERGY_LINES = [
  "Synergy isn't a buzzword. It's a lifestyle.",
  'This is what happens when alignment meets execution.',
  "We're not just moving the needle. We are becoming the needle.",
  'Cross-functional. Best-in-class. Fully aligned.',
  'The synergies here are not incremental. They are exponential.',
];

const WELCOME_EMOJI = ['🚀','🔥','🙏','✨','💯'];

// ---- category builders --------------------------------------------------
// Each returns an ordered list of paragraphs (strings). One-sentence
// paragraphs ARE the joke at high levels, so builders control their own breaks.

function buildAnnounce(a, L, rng){
  const kind = a.kind || 'A new hire';
  const name = noDot(a.name) || 'Taylor';
  const role = noDot(a.role) || 'Marketing Coordinator';
  const before = fromWhere(a.before) || 'a local nonprofit';
  const quality = uncap(noDot(a.quality)) || 'organization';
  const goal = uncap(noDot(a.goal)) || 'improve our content';
  const company = noDot(a.company) || 'our company';

  const isPerson = kind === 'A new hire' || kind === 'A promotion';
  const subjectL1 = {
    'A new hire':          `${name} is joining ${company} as our new ${role}.`,
    'A promotion':         `${name} has been promoted to ${role} at ${company}.`,
    'A product launch':    `${name} is live. It ${goal.startsWith('help') ? goal : 'exists to ' + goal}.`,
    'A partnership':       `${company} is partnering with ${name}.`,
    'A company milestone': `${company} just reached a milestone: ${uncap(name)}.`,
  }[kind];

  if(L === 1){
    const out = [subjectL1];
    if(isPerson) out.push(`They come to us from ${before} and bring ${quality} — exactly what we need as we work to ${goal}.`);
    else if(kind === 'A product launch') out.push(`We built it because ${before ? uncap(before) : 'our customers asked for it'}. Feedback welcome.`);
    else out.push(`Together we're going to ${goal}.`);
    out.push(isPerson ? `Welcome aboard, ${name}.` : 'More soon.');
    return out;
  }

  if(L === 2){
    const open = pick(rng, ['Some news to share this week:', 'Some good news to share:', 'A quick announcement:']);
    const out = [`${open} ${uncap(subjectL1)}`];
    if(isPerson) out.push(`${name} joins us from ${before} and brings ${quality} to the team. We're looking forward to working together to ${goal}.`);
    else out.push(`This has been in the works for a while, and we're proud of it. The goal is simple: ${goal}.`);
    out.push(isPerson ? `Welcome, ${name}! 👋` : 'More to come. 👀');
    return out;
  }

  if(L === 3){
    const out = [
      `I'm thrilled to announce that ${uncap(subjectL1).replace(/\.$/, '')} — and I couldn't be prouder.`,
      isPerson
        ? `${name} joins us from ${before}, bringing ${quality} and a genuine passion for the work. As we continue to grow, they'll play a key role in helping us ${goal}.`
        : `This is the result of months of work by an incredible team. It exists for one reason: to ${goal}.`,
      pick(rng, ['Great teams are built one decision at a time.', 'Growth is a team sport.', 'The best is ahead of us.']),
      `A huge thank-you to everyone who made this possible.`,
      isPerson ? `Welcome to the team, ${name} — we're lucky to have you. ${pick(rng, WELCOME_EMOJI)}` : `Onwards. ${pick(rng, WELCOME_EMOJI)}`,
    ];
    return out;
  }

  const [small, big] = pick(rng, PIVOTS);
  if(L === 4){
    return [
      isPerson
        ? `I'm incredibly humbled and excited to welcome ${name} to our growing team as our new ${role}.`
        : `I'm incredibly humbled and excited to share this with my network: ${uncap(subjectL1)}`,
      isPerson
        ? `${name} brings a powerful combination of ${quality}, purpose-driven leadership and lived experience from their time at ${before}.`
        : `This represents a powerful combination of vision, ${quality} and relentless execution.`,
      `But this is about more than ${small}.`,
      `It's about ${big}.`,
      `As we continue scaling our impact, ${isPerson ? name + ' will help us' : 'this will help us'} ${goal} — more clearly, more meaningfully, and with real value for the communities we serve.`,
      'The next chapter starts now.',
      isPerson ? `Welcome to the journey, ${name}. 🚀` : `The journey continues. 🚀`,
    ];
  }

  // L5 — corporate hallucination
  return [
    pick(rng, L5_OPENERS),
    isPerson
      ? `It is with overwhelming humility and barely-contained excitement that I announce ${name} has officially joined ${company} as our new ${role}.`
      : `It is with overwhelming humility and barely-contained excitement that I announce: ${uncap(subjectL1)}`,
    'Let me be clear about what this means.',
    'Not just for us.',
    'For the industry.',
    isPerson
      ? `${name} arrives from ${before} carrying something you cannot teach: ${quality}.`
      : `Behind this is something you cannot teach: ${quality}.`,
    isPerson
      ? `Some people fill roles. ${name} redefines what it means to have one.`
      : 'Some companies ship. We author history in real time.',
    `Together, we will ${goal}. And the global business community will feel it.`,
    isPerson ? 'This is not a hire. It is an inflection point.' : 'This is not an announcement. It is an inflection point.',
    pick(rng, SINK),
    isPerson ? `Welcome to the movement, ${name}. 🚀🔥🙏` : 'Welcome to the movement. 🚀🔥🙏',
  ];
}

function buildLesson(a, L, rng){
  const moment = noDot(a.moment) || 'A barista remembered my order';
  const lesson = noDot(a.lesson) || 'Consistency builds trust';
  const topic = uncap(noDot(a.topic)) || 'leadership';
  const source = a.source || 'A tiny everyday moment';
  const sourceNoun = {
    'A failure': 'a failure', 'A tiny everyday moment': 'an ordinary moment',
    'Something my kid said': 'a six-year-old', 'A stranger at the airport': 'a stranger at Gate B7',
    'A book I have not finished': 'chapter one',
  }[source] || 'an ordinary moment';

  if(L === 1) return [
    `Something small happened recently that stuck with me. ${cap(moment)}.`,
    `The takeaway, for me: ${uncap(lesson)}. It applies to ${topic} more than I expected.`,
  ];
  if(L === 2) return [
    `${cap(moment)}.`,
    `It got me thinking about ${topic}. ${cap(lesson)}.`,
    'Sometimes the best lessons come from unexpected places.',
  ];
  if(L === 3) return [
    source === 'A failure' ? 'I got something wrong recently, and I want to talk about it.' : 'Yesterday, something small happened.',
    `${cap(moment)}.`,
    "Most people would have moved on. I couldn't stop thinking about it.",
    `Here's the lesson: ${uncap(lesson)}.`,
    `And it applies to ${topic} more than almost anything I've read this year. Grateful for the reminder.`,
  ];
  if(L === 4) return [
    {
      'A failure': 'I failed. Publicly.',
      'A stranger at the airport': "I'm writing this from an airport gate.",
      'Something my kid said': `My kid just taught me more about ${topic} than my entire career.`,
      'A book I have not finished': 'I only read one chapter. It was enough.',
    }[source] || "It was an ordinary Tuesday. Until it wasn't.",
    `${cap(moment)}.`,
    'I stopped.',
    'I thought about it all day.',
    `Because here's the thing: ${uncap(lesson)}.`,
    pick(rng, SINK),
    `Everything I know about ${topic}, I learned in that moment.`,
    `Not from a book. Not from a course. From ${sourceNoun}.`,
  ];
  return [
    pick(rng, L5_OPENERS),
    `${cap(moment)}.`,
    'Most people saw nothing.',
    `I saw a masterclass in ${topic}.`,
    `${cap(lesson)}.`,
    pick(rng, SINK),
    `I have spent 15 years in ${topic}. Conferences. Books. Podcasts. Keynotes.`,
    `None of it prepared me for ${sourceNoun}.`,
    'We are all one ordinary moment away from extraordinary clarity.',
    `If this resonates, repost it. Someone in your network is one ${sourceNoun.replace(/^an? /, '')} away from greatness. 🙏`,
  ];
}

function buildSell(a, L, rng){
  const offer = noDot(a.offer) || 'our consulting service';
  const customer = noDot(a.customer) || 'Dana';
  const problem = uncap(noDot(a.problem)) || 'a leaky sales pipeline';
  const result = noDot(a.result) || '312% more qualified leads';
  const cta = uncap(noDot(a.cta)) || 'send me a message';

  if(L === 1) return [
    `${customer} came to us struggling with ${problem}. We worked together using ${offer}, and the result was ${uncap(result)}.`,
    `If you're dealing with something similar, ${cta} — happy to share what worked.`,
  ];
  if(L === 2) return [
    `A quick customer story. ${customer} was dealing with ${problem} — the kind of problem that quietly drains a team.`,
    `Six weeks with ${offer} later: ${uncap(result)}.`,
    `Results like this are why we do what we do. If it sounds familiar, ${cta}.`,
  ];
  if(L === 3) return [
    `I want to tell you about ${customer}.`,
    `When we first talked, they were dealing with ${problem}. Sound familiar? It's more common than anyone admits.`,
    `We got to work with ${offer}. No silver bullets — just consistent, aligned execution.`,
    `The outcome: ${uncap(result)}.`,
    `Proud of the team, prouder of ${customer}. If any of this resonates, ${cta}.`,
  ];
  if(L === 4) return [
    `${customer} almost gave up.`,
    `${cap(problem)}. Every single day.`,
    'Then we started working together.',
    `${cap(result)}.`,
    pick(rng, SINK),
    `This isn't about ${uncap(offer)}. It's about believing transformation is possible.`,
    `If that's you — ${cta}. Not selling. Just saying.`,
  ];
  return [
    'I still get chills telling this story.',
    `When ${customer} first reached out, I heard something in their voice I recognized: ${problem}, and the quiet fear that nothing would ever change.`,
    'We had one conversation.',
    'One.',
    `What happened next will sound impossible: ${uncap(result)}.`,
    'I am beyond grateful to have witnessed it.',
    pick(rng, SINK),
    `People ask what ${offer} really is. It is not a product. It is not a service.`,
    "We don't have customers. We have destiny partners.",
    `If any part of you whispered "that's me" while reading this — ${cta}. The whisper is the strategy. 🙏`,
  ];
}

function buildUrgency(a, L, rng){
  const kind = a.kind || "We're hiring";
  const thing = noDot(a.thing) || 'a Senior Product Designer role';
  const scarcity = noDot(a.scarcity) || '48 hours';
  const audience = uncap(noDot(a.audience)) || 'designers who want real ownership';

  if(L === 1) return [
    kind === "We're hiring"
      ? `We're hiring: ${uncap(thing)}. Applications close in ${uncap(scarcity)}.`
      : `${cap(thing)} — available for ${uncap(scarcity)}.`,
    `If you're ${audience} (or know someone who is), details are in the comments.`,
  ];
  if(L === 2) return [
    `Quick heads-up: ${uncap(thing)} — and the window is ${uncap(scarcity)}.`,
    `We built this for ${audience}. If that's you, don't sit on it.`,
    'Link in the comments. 👇',
  ];
  if(L === 3) return [
    `I don't post these often, so when I do, it matters: ${uncap(thing)}.`,
    `The honest constraint: ${uncap(scarcity)}. After that, it's gone.`,
    `We're looking for ${audience}. Not everyone. You.`,
    'Tag someone who fits. You might change their year. 👇',
  ];
  if(L === 4) return [
    "I wasn't supposed to share this yet.",
    `${cap(thing)}.`,
    `${cap(scarcity)}. That's it. That's the window.`,
    `${cap(audience)}: this is your sign.`,
    "When it's gone, it's gone.",
    'Big things coming.',
    'Tag someone who needs to see this. 👀',
  ];
  return [
    'Stop scrolling.',
    'I mean it. This is the post your future self would have wanted you to read slowly.',
    `${cap(thing)}.`,
    `${cap(scarcity)}. I begged for more. The universe said no.`,
    `Somewhere out there is one of the ${audience} this was destined for.`,
    'Maybe it is you. Maybe it is someone you have not spoken to since 2019.',
    'Doors like this do not close. They vanish.',
    pick(rng, SINK),
    'The comments section is the door. 👇🔥',
  ];
}

function buildAI(a, L, rng){
  const tool = noDot(a.tool) || 'ChatGPT';
  const task = uncap(noDot(a.task)) || 'write our quarterly report';
  const mult = noDot(a.multiplier) || '10x';
  const doomed = noDot(a.doomed) || 'consulting';

  if(L === 1) return [
    `I tried ${tool} for a real task this week — using it to ${task}.`,
    `Honest verdict: genuinely useful. Maybe ${uncap(mult)} faster than my usual process, with some editing still required. Worth a look if that's part of your job.`,
  ];
  if(L === 2) return [
    `Finally gave ${tool} a proper test: I used it to ${task}.`,
    `It took minutes instead of days. Not perfect — but ${uncap(mult)} faster is not nothing.`,
    `Curious how others are using it. What's working for you?`,
  ];
  if(L === 3) return [
    `I just used ${tool} to ${task}. Minutes, not days.`,
    `I keep coming back to one number: ${uncap(mult)}. That's not an efficiency gain. That's a different job description.`,
    `My honest prediction: ${uncap(doomed)} will look completely different in five years.`,
    'The people learning these tools today are the leaders of that version of the industry.',
  ];
  if(L === 4) return [
    'I just did something that would have been impossible 12 months ago.',
    `I used ${tool} to ${task}.`,
    `${cap(mult)} faster.`,
    'I sat back in my chair and stared at the wall.',
    'We are living through the biggest shift since the printing press.',
    `${cap(doomed)}? Dead in five years.`,
    'Adapt or be left behind.',
    "The future doesn't wait. Neither should you.",
  ];
  return [
    'At 11:47 last night, I understood the future.',
    `I asked ${tool} to ${task}.`,
    'What happened next broke something in me. In a good way.',
    `${cap(mult)} is the official number. The real number cannot be measured by human instruments.`,
    'I did not discover a tool.',
    'I witnessed the end of an era.',
    `If you are still doing this manually, I need you to hear this with love: it's over.`,
    `${cap(doomed)} is already dead. It just doesn't know it yet.`,
    'The singularity will not send a calendar invite.',
    pick(rng, SINK),
    'Adapt. Or become a cautionary keynote slide. 🤖🚀',
  ];
}

const BUILDERS = { announce: buildAnnounce, lesson: buildLesson, sell: buildSell, urgency: buildUrgency, ai: buildAI };

// ---- flags (the "Make It Worse in a Specific Direction" buttons) --------

function applySynergy(paras, rng, n){
  let out = paras.map(p => p
    .replace(/\buse\b/g, 'leverage').replace(/\busing\b/g, 'leveraging')
    .replace(/\bhelp us\b/g, 'empower us to').replace(/\bimprove\b/g, 'optimize')
    .replace(/\bwork(ing)? together\b/g, (m, ing) => ing ? 'synergizing' : 'synergize')
    .replace(/\bteam\b/g, 'cross-functional team'));
  out = out.concat(pickN(rng, SYNERGY_LINES, Math.min(n, SYNERGY_LINES.length)));
  return out;
}

function applyStruggle(paras, rng){
  return [
    pick(rng, STRUGGLES),
    "Nobody believed in this. Some days, neither did I.",
    ...paras,
    "If you're struggling right now: keep going. It gets better. I'm living proof. 🙏",
  ];
}

function applyFounder(paras, rng){
  const day = 200 + Math.floor(rng() * 900);
  return [
    'As a founder, you learn to celebrate the wins out loud.',
    ...paras.map(p => p.replace(/\bour journey\b/gi, 'my journey')),
    `Building in public. Day ${day}. All gas, no brakes.`,
  ];
}

// ---- main entry ---------------------------------------------------------

export function generate({ category, answers, level, seed, flags = {} }){
  const L = Math.max(1, Math.min(5, level));
  const rng = mulberry32(seed);
  const build = BUILDERS[category] || buildLesson;
  let paras = build(answers || {}, L, rng).filter(Boolean);

  if(flags.founder) paras = applyFounder(paras, rng);
  if(flags.synergy) paras = applySynergy(paras, rng, flags.synergy);
  if(flags.struggle) paras = applyStruggle(paras, rng);

  // level 5 closes with a gratitude spiral — the index must never go DOWN
  // when the dial goes up
  if(L === 5) paras.push(pick(rng, [
    'Humbled. Honored. Grateful. Beyond blessed. 🙏',
    'I am humbled. I am honored. I am grateful. And this journey is just beginning. 🙏',
    'Grateful does not begin to cover it. Humbled does not begin to cover it. Blessed does not begin to cover it. And yet: this post. 🙏',
  ]));

  const nTags = TAG_COUNT[L - 1] + (flags.synergy ? 1 : 0);
  if(nTags){
    const pool = HASHTAGS[category] || HASHTAGS.lesson;
    const extra = flags.synergy ? ['#Synergy'] : [];
    paras = paras.concat([extra.concat(pickN(rng, pool, nTags)).join(' ')]);
  }
  return paras.join('\n\n');
}

// ---- the humanizer (Make It Human for arbitrary text; Roast's "useful version")

const DEJARGON = [
  [/\ban? (incredible|amazing|unbelievable) journey\b/gi, 'a lot of hard work'],
  [/\bleverage\b/gi, 'use'], [/\bleveraging\b/gi, 'using'],
  [/\bsynerg(?:y|ies)\b/gi, 'teamwork'], [/\bsynergize\b/gi, 'work together'],
  [/\butilize\b/gi, 'use'], [/\bbandwidth\b/gi, 'time'],
  [/\bcircle back\b/gi, 'follow up'], [/\btouch base\b/gi, 'talk'],
  [/\bmove the needle\b/gi, 'make a difference'], [/\blow-hanging fruit\b/gi, 'easy wins'],
  [/\bgame-?changer\b/gi, 'big improvement'], [/\bgame-?changing\b/gi, 'genuinely useful'],
  [/\bincredibly (humbled|honou?red|blessed)\b/gi, 'glad'], [/\b(humbled|honou?red) and (excited|thrilled|proud)\b/gi, 'glad'],
  [/\bthrilled\b/gi, 'glad'], [/\bhumbled\b/gi, 'glad'], [/\bblessed\b/gi, 'lucky'],
  [/\bjourney\b/gi, 'work'], [/\bnext chapter\b/gi, 'next step'],
  [/\brockstar|ninja|guru|wizard\b/gi, 'expert'],
  [/\bpassionate about\b/gi, 'focused on'], [/\bat the intersection of\b/gi, 'combining'],
  [/\bdelve into\b/gi, 'look at'], [/\ba rich tapestry\b/gi, 'a mix'],
  [/\ba testament to\b/gi, 'proof of'], [/\btransformational\b/gi, 'useful'],
  [/it is with overwhelming humility and barely-contained excitement that i announce/gi, "I'm glad to share that"],
  [/\binflection point\b/gi, 'step forward'], [/\boptimize\b/gi, 'improve'],
  [/\.? and the global business community will feel it\./gi, '.'],
  [/\bwelcome to the movement\b/gi, 'welcome aboard'],
  [/\bhonou?red\b/gi, 'glad'], [/\bglad and glad\b/gi, 'glad'],
];
const BAIT = /^(let that sink in|read that again|sit with that.*|thoughts\?|agree\??.*|repost if.*|tag someone.*|stop scrolling\.?|👀|.*drop a comment.*)$/i;
// pure LinkedIn dressing — paragraphs that carry no facts and can be dropped whole
const DRESSING = [
  /^i (don'?t|do not) post often/i, /^i have started and deleted this post/i,
  /^i wasn'?t going to share this/i, /^some posts are announcements/i,
  /^let me be clear about what this means/i, /^not just for (us|me)\.?$/i, /^for the industry\.?$/i,
  /^i wasn'?t supposed to share this yet/i, /^big things coming\.?$/i,
  /air mattress|rock bottom had a basement|bank balance with one eye closed|recruiter told me/i,
  /^nobody believed in this/i, /^if you'?re struggling right now/i,
  /synergy isn'?t a buzzword|alignment meets execution|becoming the needle|^cross-functional\. best-in-class/i,
  /the synergies here are not incremental/i,
  /^as a founder, you learn/i, /^building in public\. day \d+/i,
  /^(humbled|grateful)[.,] (honou?red|humbled)[.,]/i, /^i am humbled\. i am honou?red\./i,
  /^grateful does not begin to cover it/i,
  /^(i still get chills|what happened next|i sat back in my chair)/i,
  /^we (don'?t|do not) have customers\. we have destiny partners\.?$/i,
  /^the singularity will not send a calendar invite\.?$/i,
  /^(one\.|i stopped\.|i thought about it all day\.)$/i,
  /^this is not (a hire|an announcement)\. it is an inflection point\.?$/i,
];
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{2600}-\u{26FF}\u{FE0F}]/gu;

export function humanize(text){
  const src = String(text || '');
  // hashtags first — wherever they live, they come out and at most 3 go back
  const allTags = [...new Set(src.match(/#\w+/g) || [])];
  let paras = src.split(/\n{2,}/).map(p => p.replace(/#\w+/g, '').trim()).filter(Boolean);
  // drop pure engagement bait and generic LinkedIn dressing, paragraph-wise
  paras = paras.filter(p => {
    const bare = p.replace(EMOJI_RE, '').trim();
    return bare && !BAIT.test(bare) && !DRESSING.some(re => re.test(bare));
  });
  paras = paras.map(p => {
    let s = p.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
    // bait hides inside paragraphs too
    s = s.replace(/\b(let that sink in|read that again)[.!]?\s*/gi, '');
    s = s.replace(/(^|\s)agree\??\s*($|\s)/gi, ' ').trim();
    for(const [re, sub] of DEJARGON) s = s.replace(re, sub);
    // un-inflate stacked adjectives, and re-capitalize sentence starts the
    // replacements may have lowercased
    s = s.replace(/\b(incredibly|absolutely|truly|deeply) /gi, '');
    s = s.replace(/(^|[.!?]\s+)([a-z])/g, (m, pre, c) => pre + c.toUpperCase());
    return s.trim();
  }).filter(Boolean);
  // merge runs of dramatic one-liners back into sentences
  const merged = [];
  for(const p of paras){
    const last = merged[merged.length - 1];
    if(last && last.length < 90 && p.length < 90 && !/^#/.test(p)) merged[merged.length - 1] = `${last} ${p}`;
    else merged.push(p);
  }
  // at most 3 hashtags come back, unmodified
  const tags = allTags.slice(0, 3);
  if(tags.length) merged.push(tags.join(' '));
  return merged.join('\n\n');
}

// the "painfully LinkedIn" version of arbitrary pasted text
export function linkedinify(text, seed){
  const rng = mulberry32(seed);
  const clean = humanize(text).replace(/\n{2,}(#\w+[\s#\w]*)$/, '');
  const sentences = clean.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => s && !/^#/.test(s));
  const [small, big] = pick(rng, PIVOTS);
  const paras = [pick(rng, L5_OPENERS)];
  sentences.slice(0, 8).forEach((s, i) => {
    paras.push(s);
    if(i === 1) paras.push(pick(rng, SINK));
  });
  paras.push(`But this is about more than ${small}.`);
  paras.push(`It's about ${big}.`);
  paras.push('If this resonates, share it. Someone in your network needs to hear it today. 🚀');
  paras.push(pickN(rng, HASHTAGS.lesson.concat(HASHTAGS.announce), 6).join(' '));
  return paras.join('\n\n');
}

// ---- the roast ----------------------------------------------------------

export function roast(text, analysis){
  const t = String(text || '');
  const lines = [];
  const count = re => (t.match(re) || []).length;

  const journeys = count(/\bjourney\b/gi);
  if(journeys) lines.push(`You referred to employment as a "journey" ${journeys === 1 ? 'once' : journeys + ' times'}. It is a job.`);
  if(/\bhumbled\b/i.test(t)) lines.push('You are not humbled. Humbled people do not issue press releases about it.');
  if(/let that sink in/i.test(t)) lines.push('You told the reader to let it sink in. It had not yet begun to float.');
  if(/read that again/i.test(t)) lines.push('You told us to read it again. Respectfully, once was the correct number of times.');
  const tags = count(/#\w+/g);
  if(tags > 5) lines.push(`${tags} hashtags. The algorithm is not your friend. The algorithm is not anyone's friend.`);
  const rockets = count(/🚀/gu);
  if(rockets) lines.push(`The rocket emoji is doing a lot of load-bearing work here${rockets > 1 ? ` (×${rockets})` : ''}. Nothing in this post is going to space.`);
  const paras = t.split(/\n{2,}/).filter(Boolean);
  const oneLiners = paras.filter(p => p.length < 60 && !/^#/.test(p)).length;
  if(oneLiners > 3) lines.push(`${oneLiners} single-sentence paragraphs. This is not drama. It is a formatting incident.`);
  if(/it'?s not (about )?[^.!?]{2,40}it'?s (about )?/i.test(t)) lines.push('"It\'s not about X. It\'s about Y." It was about X. It was always about X.');
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  if(words > 220) lines.push(`${words} words. Nobody has ever finished a post this long. Including, evidently, its author.`);
  if(/\bagree\?/i.test(t)) lines.push('You asked "Agree?" — a question engineered so no answer can hurt you.');
  if(/\b(grateful|gratitude)\b/i.test(t) && /\b(proud|excited|thrilled)\b/i.test(t)) lines.push('Gratitude and self-congratulation in the same post. The humble brag is fully load-balanced.');
  if(/\b(delve|tapestry|testament)\b/i.test(t)) lines.push('"Delve." "Tapestry." "Testament." A machine wrote this, and it was not even trying to hide.');

  if(analysis){
    if(analysis.score >= 70) lines.push(`Thought Leadership Index: ${analysis.score}/100. At this level, disclosure to the SEC may be required.`);
    else if(analysis.score >= 40) lines.push(`Thought Leadership Index: ${analysis.score}/100. Certified. Condolences to your connections.`);
  }
  if(!lines.length) lines.push('Honestly? This is fine. Clear, human, no crimes detected. Post it. This is embarrassing for us, not you.');
  return lines.slice(0, 6);
}
