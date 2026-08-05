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
// never lowercase an acronym: "DM me" and "B2B sales" survive mid-sentence
const uncap = s => (s && !/^[A-Z][A-Z0-9]/.test(s)) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
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
  ['a job title', 'a promise we are making out loud'],
  ['the numbers', 'the humans behind the numbers'],
  ['today', 'every tomorrow this unlocks'],
];

// both of these are markers the Thought Leadership Index detects — the dial
// must never score DOWN when it goes up, so high-level dressing stays on-index
const SINK = ['Let that sink in.', 'Read that again.'];

const L5_OPENERS = [
  "I don't post often. But today, I have to.",
  "I wasn't going to share this. My mentor convinced me the world needed it.",
  'I have started and deleted this post eleven times.',
  'Some posts are announcements. This one is a turning point.',
  'I promised myself I would stay quiet about this one. I cannot.',
  'My hands are still shaking as I type this.',
  'This is not a post. This is a confession.',
];

const STRUGGLES = [
  "Three years ago, I was sleeping on an air mattress in my cousin's garage.",
  'In 2019 I hit rock bottom. Then I found out rock bottom had a basement.',
  "Five years ago, a recruiter told me I'd never make it in this industry.",
  'There was a time I checked my bank balance with one eye closed.',
  'I once pitched forty-two investors in one week. Forty-two nos.',
  'In my twenties I was fired from a job I had not even started yet.',
];

const SYNERGY_LINES = [
  "Synergy isn't a buzzword. It's a lifestyle.",
  'This is what happens when alignment meets execution.',
  "We're not just moving the needle. We are becoming the needle.",
  'Cross-functional. Best-in-class. Fully aligned.',
  'The synergies here are not incremental. They are exponential.',
  'Alignment is not a meeting. Alignment is a feeling.',
  'We operationalized joy this quarter.',
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

  const v = a => pick(rng, a);

  if(L === 1){
    const out = [subjectL1];
    if(isPerson) out.push(v([
      `They come to us from ${before} and bring ${quality} — exactly what we need as we work to ${goal}.`,
      `They join us from ${before}. What sold us: ${quality}. What's next: ${goal}.`,
    ]));
    else if(kind === 'A product launch') out.push(`We built it because ${before ? uncap(before) : 'our customers asked for it'}. Feedback welcome.`);
    else out.push(`Together we're going to ${goal}.`);
    out.push(isPerson ? v([`Welcome aboard, ${name}.`, `Glad to have you, ${name}.`, `Welcome, ${name}.`]) : 'More soon.');
    return out;
  }

  if(L === 2){
    const open = v(['Some news to share this week:', 'Some good news to share:', 'A quick announcement:']);
    const out = [`${open} ${uncap(subjectL1)}`];
    if(isPerson) out.push(v([
      `${name} joins us from ${before} and brings ${quality} to the team. We're looking forward to working together to ${goal}.`,
      `${name} arrives from ${before} with ${quality} in tow — a big help as we work to ${goal}.`,
    ]));
    else out.push(`This has been in the works for a while, and we're proud of it. The goal is simple: ${goal}.`);
    out.push(isPerson ? v([`Welcome, ${name}! 👋`, `Great to have you, ${name}. 👋`]) : v(['More to come. 👀', 'More soon. 👀']));
    return out;
  }

  if(L === 3){
    const out = [
      `I'm thrilled to announce that ${uncap(subjectL1).replace(/\.$/, '')} ${v(["— and I couldn't be prouder.", '— and the timing could not be better.', '— and honestly, it made my week.'])}`,
      isPerson
        ? v([
            `${name} joins us from ${before}, bringing ${quality} and a genuine passion for the work. As we continue to grow, they'll play a key role in helping us ${goal}.`,
            `${name} comes to us from ${before} with ${quality} and real care for the craft. Their first mission: helping us ${goal}.`,
          ])
        : `This is the result of months of work by an incredible team. It exists for one reason: to ${goal}.`,
      v(['Great teams are built one decision at a time.', 'Growth is a team sport.', 'The best is ahead of us.', 'Momentum is a choice.']),
      v(['A huge thank-you to everyone who made this possible.', 'Thank you to everyone who pushed for this behind the scenes.']),
      isPerson ? `Welcome to the team, ${name} — we're lucky to have you. ${v(WELCOME_EMOJI)}` : `Onwards. ${v(WELCOME_EMOJI)}`,
    ];
    return out;
  }

  const [small, big] = v(PIVOTS);
  if(L === 4){
    return [
      isPerson
        ? v([
            `I'm incredibly humbled and excited to welcome ${name} to our growing team as our new ${role}.`,
            `Humbled doesn't begin to cover it: today we officially welcome ${name} as our new ${role}.`,
            `With a full heart (and a fuller onboarding calendar), I'm honored to welcome ${name} as our new ${role}.`,
          ])
        : v([
            `I'm incredibly humbled and excited to share this with my network: ${uncap(subjectL1)}`,
            `Humbled and honored to put this into the world: ${uncap(subjectL1)}`,
          ]),
      isPerson
        ? v([
            `${name} brings a powerful combination of ${quality}, purpose-driven leadership and lived experience from their time at ${before}.`,
            `What ${name} carries from ${before} cannot be taught: ${quality}, empathy, and purpose-driven execution.`,
          ])
        : `This represents a powerful combination of vision, ${quality} and relentless execution.`,
      `But this is about more than ${small}.`,
      `It's about ${big}.`,
      v([
        `As we continue scaling our impact, ${isPerson ? name + ' will help us' : 'this will help us'} ${goal} — more clearly, more meaningfully, and with real value for the communities we serve.`,
        `As we write our next chapter, ${isPerson ? name + ' will help us' : 'this will help us'} ${goal} — with clarity, with intention, and with the communities we serve at the center.`,
      ]),
      v(['The next chapter starts now.', 'A new chapter begins today.', 'The story continues — louder.']),
      isPerson ? v([`Welcome to the journey, ${name}. 🚀`, `${name} — welcome to the journey. We're just getting started. 🚀`]) : `The journey continues. 🚀`,
    ];
  }

  // L5 — corporate hallucination
  return [
    v(L5_OPENERS),
    isPerson
      ? `It is with overwhelming humility and barely-contained excitement that I announce ${name} has officially joined ${company} as our new ${role}.`
      : `It is with overwhelming humility and barely-contained excitement that I announce: ${uncap(subjectL1)}`,
    ...v([
      ['Let me be clear about what this means.', 'Not just for us.', 'For the industry.'],
      ['I need everyone to understand what is happening here.', 'This is bigger than one company.', 'This is a signal.'],
      ['Take a breath before you read the next sentence.', 'Ready?', 'Good.'],
    ]),
    isPerson
      ? `${name} arrives from ${before} carrying something you cannot teach: ${quality}.`
      : `Behind this is something you cannot teach: ${quality}.`,
    isPerson
      ? v([
          `Some people fill roles. ${name} redefines what it means to have one.`,
          `Most hires join a company. ${name} joins a destiny.`,
        ])
      : 'Some companies ship. We author history in real time.',
    `Together, we will ${goal}. And the global business community will feel it.`,
    v([
      isPerson ? 'This is not a hire. It is an inflection point.' : 'This is not an announcement. It is an inflection point.',
      isPerson ? 'This is not a hire. It is a before-and-after moment for our entire category.' : 'This is not an announcement. It is a before-and-after moment for our entire category.',
    ]),
    pick(rng, SINK),
    isPerson ? v([`Welcome to the movement, ${name}. 🚀🔥🙏`, `${name}, the movement has been waiting for you. 🚀🔥🙏`]) : 'Welcome to the movement. 🚀🔥🙏',
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

  const v = a => pick(rng, a);

  if(L === 1) return [
    `${v(['Something small happened recently that stuck with me.', 'A small moment from this week that I keep replaying.'])} ${cap(moment)}.`,
    `The takeaway, for me: ${uncap(lesson)}. It applies to ${topic} more than I expected.`,
  ];
  if(L === 2) return [
    `${cap(moment)}.`,
    `It got me thinking about ${topic}. ${cap(lesson)}.`,
    v(['Sometimes the best lessons come from unexpected places.', 'Funny where the good lessons hide.']),
  ];
  if(L === 3) return [
    source === 'A failure'
      ? 'I got something wrong recently, and I want to talk about it.'
      : v(['Yesterday, something small happened.', 'A small thing happened this week that I keep coming back to.']),
    `${cap(moment)}.`,
    v(["Most people would have moved on. I couldn't stop thinking about it.", "It would have been easy to ignore. I didn't."]),
    `Here's the lesson: ${uncap(lesson)}.`,
    `And it applies to ${topic} more than almost anything I've read this year. Grateful for the reminder.`,
  ];
  if(L === 4) return [
    {
      'A failure': v(['I failed. Publicly.', 'I failed last quarter. I need to talk about it.']),
      'A stranger at the airport': v(["I'm writing this from an airport gate.", 'Gate B7. Delayed flight. Life-changing conversation.']),
      'Something my kid said': `My kid just taught me more about ${topic} than my entire career.`,
      'A book I have not finished': 'I only read one chapter. It was enough.',
    }[source] || v(["It was an ordinary Tuesday. Until it wasn't.", 'Nothing about the moment looked important. That was the disguise.']),
    `${cap(moment)}.`,
    v(['I stopped.', 'I went quiet.']),
    v(['I thought about it all day.', 'It followed me into every meeting.']),
    `Because here's the thing: ${uncap(lesson)}.`,
    pick(rng, SINK),
    `Everything I know about ${topic}, I learned in that moment.`,
    v([`Not from a book. Not from a course. From ${sourceNoun}.`, `No podcast taught me this. ${cap(sourceNoun)} did.`]),
  ];
  return [
    v(L5_OPENERS),
    `${cap(moment)}.`,
    v(['Most people saw nothing.', 'Everyone else scrolled past their own lives that day.']),
    `I saw a masterclass in ${topic}.`,
    `${cap(lesson)}.`,
    pick(rng, SINK),
    v([
      `I have spent 15 years in ${topic}. Conferences. Books. Podcasts. Keynotes.`,
      `Fifteen years in ${topic}. Two certifications. Hundreds of keynotes.`,
    ]),
    `None of it prepared me for ${sourceNoun}.`,
    v(['We are all one ordinary moment away from extraordinary clarity.', 'The universe does not send memos. It sends moments.']),
    v([
      `If this resonates, repost it. Someone in your network is one ${sourceNoun.replace(/^an? /, '')} away from greatness. 🙏`,
      `Repost this. Somewhere in your network, someone needs ${sourceNoun} today. 🙏`,
    ]),
  ];
}

function buildSell(a, L, rng){
  const offer = noDot(a.offer) || 'our consulting service';
  const customer = noDot(a.customer) || 'Dana';
  const problem = uncap(noDot(a.problem)) || 'a leaky sales pipeline';
  const result = noDot(a.result) || '312% more qualified leads';
  const cta = uncap(noDot(a.cta)) || 'send me a message';

  const v = a => pick(rng, a);

  if(L === 1) return [
    `${customer} came to us struggling with ${problem}. We worked together using ${offer}, and the result was ${uncap(result)}.`,
    v([
      `If you're dealing with something similar, ${cta} — happy to share what worked.`,
      `Dealing with the same thing? ${cap(cta)} and I'll share what worked.`,
    ]),
  ];
  if(L === 2) return [
    `A quick customer story. ${customer} was dealing with ${problem} — the kind of problem that quietly drains a team.`,
    `${v(['Six weeks', 'Ninety days', 'One quarter'])} with ${offer} later: ${uncap(result)}.`,
    `Results like this are why we do what we do. If it sounds familiar, ${cta}.`,
  ];
  if(L === 3) return [
    `I want to tell you about ${customer}.`,
    `When we first talked, they were dealing with ${problem}. Sound familiar? It's more common than anyone admits.`,
    v([
      `We got to work with ${offer}. No silver bullets — just consistent, aligned execution.`,
      `We brought in ${offer}. Nothing flashy — just the unglamorous work, done in order.`,
    ]),
    `The outcome: ${uncap(result)}.`,
    `Proud of the team, prouder of ${customer}. If any of this resonates, ${cta}.`,
  ];
  if(L === 4) return [
    v([`${customer} almost gave up.`, `${customer} was ready to walk away from all of it.`]),
    `${cap(problem)}. Every single day.`,
    v(['Then we started working together.', 'Then one conversation changed the math.']),
    `${cap(result)}.`,
    pick(rng, SINK),
    `This isn't about ${uncap(offer)}. It's about believing transformation is possible.`,
    `If that's you — ${cta}. Not selling. Just saying.`,
  ];
  return [
    v(['I still get chills telling this story.', 'I have told this story a hundred times. My voice still breaks.']),
    `When ${customer} first reached out, I heard something in their voice I recognized: ${problem}, and the quiet fear that nothing would ever change.`,
    ...v([['We had one conversation.', 'One.'], ['One call. That was all it took.', 'One.']]),
    `What happened next will sound impossible: ${uncap(result)}.`,
    'I am beyond grateful to have witnessed it.',
    pick(rng, SINK),
    `People ask what ${offer} really is. It is not a product. It is not a service.`,
    v(["We don't have customers. We have destiny partners.", "We don't close deals. We open destinies."]),
    `If any part of you whispered "that's me" while reading this — ${cta}. The whisper is the strategy. 🙏`,
  ];
}

function buildUrgency(a, L, rng){
  const kind = a.kind || "We're hiring";
  const thing = noDot(a.thing) || 'a Senior Product Designer role';
  const scarcity = noDot(a.scarcity) || '48 hours';
  const audience = uncap(noDot(a.audience)) || 'designers who want real ownership';

  const v = a => pick(rng, a);

  if(L === 1) return [
    kind === "We're hiring"
      ? `We're hiring: ${uncap(thing)}. Applications close in ${uncap(scarcity)}.`
      : `${cap(thing)} — available for ${uncap(scarcity)}.`,
    `If you're ${audience} (or know someone who is), details are in the comments.`,
  ];
  if(L === 2) return [
    `Quick heads-up: ${uncap(thing)} — and the window is ${uncap(scarcity)}.`,
    `We built this for ${audience}. If that's you, don't sit on it.`,
    v(['Link in the comments. 👇', 'Details below. 👇']),
  ];
  if(L === 3) return [
    v([
      `I don't post these often, so when I do, it matters: ${uncap(thing)}.`,
      `I sat on this for a week before posting it: ${uncap(thing)}.`,
    ]),
    `The honest constraint: ${uncap(scarcity)}. After that, it's gone.`,
    `We're looking for ${audience}. Not everyone. You.`,
    'Tag someone who fits. You might change their year. 👇',
  ];
  if(L === 4) return [
    v(["I wasn't supposed to share this yet.", 'They told me to wait until Monday. I am not waiting.']),
    `${cap(thing)}.`,
    v([`${cap(scarcity)}. That's it. That's the window.`, `${cap(scarcity)}. Read that number twice.`]),
    v([`${cap(audience)}: this is your sign.`, `${cap(audience)}: you already know this is for you.`]),
    "When it's gone, it's gone.",
    'Big things coming.',
    'Tag someone who needs to see this. 👀',
  ];
  return [
    v(['Stop scrolling.', 'Do not scroll past this.']),
    v([
      'I mean it. This is the post your future self would have wanted you to read slowly.',
      'I mean it. Your future self is watching you read this right now.',
    ]),
    `${cap(thing)}.`,
    `${cap(scarcity)}. I begged for more. The universe said no.`,
    `Somewhere out there is one of the ${audience} this was destined for.`,
    v([
      'Maybe it is you. Maybe it is someone you have not spoken to since 2019.',
      'Maybe it is you. Statistically, it is probably not. But maybe.',
    ]),
    v(['Doors like this do not close. They vanish.', 'This is not a door closing. It is a door evaporating.']),
    pick(rng, SINK),
    'The comments section is the door. 👇🔥',
  ];
}

function buildAI(a, L, rng){
  const tool = noDot(a.tool) || 'ChatGPT';
  const task = uncap(noDot(a.task)) || 'write our quarterly report';
  const mult = noDot(a.multiplier) || '10x';
  const doomed = noDot(a.doomed) || 'consulting';

  const v = a => pick(rng, a);

  if(L === 1) return [
    `I tried ${tool} for a real task this week — using it to ${task}.`,
    `Honest verdict: genuinely useful. Maybe ${uncap(mult)} faster than my usual process, with some editing still required. Worth a look if that's part of your job.`,
  ];
  if(L === 2) return [
    `Finally gave ${tool} a proper test: I used it to ${task}.`,
    `It took minutes instead of days. Not perfect — but ${uncap(mult)} faster is not nothing.`,
    v([`Curious how others are using it. What's working for you?`, 'What are you using it for? Genuinely curious.']),
  ];
  if(L === 3) return [
    `I just used ${tool} to ${task}. Minutes, not days.`,
    `I keep coming back to one number: ${uncap(mult)}. That's not an efficiency gain. That's a different job description.`,
    `My honest prediction: ${uncap(doomed)} will look completely different in five years.`,
    v([
      'The people learning these tools today are the leaders of that version of the industry.',
      'The gap will not be between AI and humans. It will be between humans who learned and humans who laughed.',
    ]),
  ];
  if(L === 4) return [
    v([
      'I just did something that would have been impossible 12 months ago.',
      'What I did this morning was science fiction a year ago.',
    ]),
    `I used ${tool} to ${task}.`,
    `${cap(mult)} faster.`,
    v(['I sat back in my chair and stared at the wall.', 'I closed the laptop and went for a walk. I had to.']),
    v([
      'We are living through the biggest shift since the printing press.',
      'We are living through the biggest shift since electricity. Possibly fire.',
    ]),
    `${cap(doomed)}? Dead in five years.`,
    'Adapt or be left behind.',
    "The future doesn't wait. Neither should you.",
  ];
  return [
    `At ${v(['11:47', '2:13', '4:44'])} last night, I understood the future.`,
    `I asked ${tool} to ${task}.`,
    v(['What happened next broke something in me. In a good way.', 'What happened next rearranged my understanding of work itself.']),
    `${cap(mult)} is the official number. The real number cannot be measured by human instruments.`,
    'I did not discover a tool.',
    v(['I witnessed the end of an era.', 'I attended the funeral of an entire profession. I was the only guest.']),
    `If you are still doing this manually, I need you to hear this with love: it's over.`,
    `${cap(doomed)} is already dead. It just doesn't know it yet.`,
    v(['The singularity will not send a calendar invite.', 'The singularity does not do onboarding.']),
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
    'Humbled by the team. Honored by the moment. Grateful for this journey. 🙏',
    'To everyone who believed: I am humbled, I am honored, and I am only getting started. Grateful. 🙏',
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
  [/,? the movement has been waiting for you\.?/gi, ' — welcome aboard.'],
  [/^what happened next will sound impossible: /gi, 'The result: '],
  [/^if any part of you whispered [^—]*— ?/gi, 'If that sounds familiar, '],
  [/\s*the whisper is the strategy\.?/gi, ''],
  [/, and the quiet fear that nothing would ever change/gi, ''],
  [/\bhonou?red\b/gi, 'glad'], [/\bglad and glad\b/gi, 'glad'],
];
const BAIT = /^(let that sink in|read that again|sit with that.*|thoughts\?|agree\??.*|repost if.*|tag someone.*|stop scrolling\.?|👀|.*drop a comment.*)$/i;
// pure LinkedIn dressing — paragraphs that carry no facts and can be dropped whole
const DRESSING = [
  /^i (don'?t|do not) post often/i, /^i have started and deleted this post/i,
  /^i wasn'?t going to share this/i, /^some posts are announcements/i,
  /^i promised myself i would stay quiet/i, /^my hands are still shaking/i, /^this is not a post\. this is a confession\.?$/i,
  /^let me be clear about what this means/i, /^not just for (us|me)\.?$/i, /^for the industry\.?$/i,
  /^i need everyone to understand what is happening/i, /^this is bigger than one company\.?$/i, /^this is a signal\.?$/i,
  /^take a breath before you read/i,
  /^i wasn'?t supposed to share this yet/i, /^they told me to wait until monday/i, /^big things coming\.?$/i,
  /air mattress|rock bottom had a basement|bank balance with one eye closed|recruiter told me|forty-two nos|fired from a job i had not even started/i,
  /^nobody believed in this/i, /^if you'?re struggling right now/i,
  /synergy isn'?t a buzzword|alignment meets execution|becoming the needle|^cross-functional\. best-in-class/i,
  /the synergies here are not incremental/i, /^alignment is not a meeting/i, /^we operationalized joy/i,
  /^as a founder, you learn/i, /^building in public\. day \d+/i,
  /^(humbled|grateful)[.,] (honou?red|humbled)[.,]/i, /^i am humbled\. i am honou?red\./i,
  /^grateful does not begin to cover it/i, /^humbled by the team\./i, /^to everyone who believed/i,
  /^(i still get chills|i have told this story|i sat back in my chair|i closed the laptop|i attended the funeral)/i,
  /^what happened next (broke something in me|rearranged my understanding)/i,
  /^we had one conversation\.?$/i, /^i am beyond grateful to have witnessed/i,
  /^people ask what .{0,60} really is\. it is not a product/i,
  /^i saw a masterclass in/i, /^(i have spent 15 years|fifteen years in)/i,
  /^none of it prepared me for/i, /^if this resonates, repost/i, /^repost this\./i,
  /^we (don'?t|do not) (have customers\. we have destiny partners|close deals\. we open destinies)\.?$/i,
  /^the singularity (will not send a calendar invite|does not do onboarding)\.?$/i,
  /^(one\.|i stopped\.|i went quiet\.|i thought about it all day\.|it followed me into every meeting\.|ready\?|good\.|one call\. that was all it took\.)$/i,
  /^this is not (a hire|an announcement)\. it is (an inflection point|a before-and-after moment)/i,
  /joins a destiny\.?$/i, /^(stop scrolling|do not scroll past this)\.?$/i,
  /^everyone else scrolled past/i, /^the universe does not send memos/i,
  /^most people saw nothing\.?$/i,
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
    s = s.replace(/\b(incredibly|absolutely|truly|deeply|officially) /gi, '');
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
  // a couple of hashtags may come back, unmodified — the jargon ones stay
  // out, and a post short enough to speak for itself gets none at all
  const bodyWords = merged.join(' ').split(/\s+/).filter(Boolean).length;
  const tags = bodyWords >= 30
    ? allTags.filter(t => !/^#(synergy|blessed|hustle|grindset|journey|gamechanger\w*|thoughtleader\w*|adaptordie)$/i.test(t)).slice(0, 2)
    : [];
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
