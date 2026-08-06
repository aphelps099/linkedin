// Roast My LinkedIn™ — the inspection office. PERSONAS, INTENSITIES, KINDS and the
// frame openers/closers are verbatim from src/roast/personas.js and src/roast/roastEngine.js.
// The findings bank here is a sample of the real 27 findings.
window.RM = (() => {
  const KINDS = [
    { id:'post',     name:'My post',     hint:'Paste the draft. Yes, that one.' },
    { id:'headline', name:'My headline', hint:'The line under your name. Pipes and all.' },
    { id:'about',    name:'My About',    hint:'The autobiography nobody scrolls.' },
  ];
  const PERSONAS = [
    { id:'partner',   name:'The McKinsey Partner',     tagline:'Bills by the observation.' },
    { id:'recruiter', name:'The Burned-Out Recruiter', tagline:'11,000 profiles deep. Nothing surprises them.' },
    { id:'intern',    name:'The Gen-Z Intern',         tagline:'Reviewing your personal brand, unpaid.' },
    { id:'algorithm', name:'The Algorithm',            tagline:'It has already decided your reach.' },
  ];
  const INTENSITIES = [
    { n:1, name:'Gentle Feedback',    blurb:'Constructive. Almost kind. A warm-up.' },
    { n:2, name:'Peer Review',        blurb:'Honest notes from someone with nothing to lose.' },
    { n:3, name:'Performance Review', blurb:'Documented. Specific. Going in your file.' },
    { n:4, name:'HR Violation',       blurb:'A roast that legally should have been an email.' },
  ];
  const FRAMES = {
    partner:   { open:{ m:'Thank you for sharing the draft. We have some observations.', s:'We were asked to be honest. We are billing accordingly.' },
                 close:{ m:'Directionally, there is something here. Tighten and resubmit.', s:'Our recommendation: the version below. Our invoice: in the mail.' } },
    recruiter: { open:{ m:'Okay. I have seen worse today. Let us go through it.', s:'I have read 11,000 of these. Yours made me put down the sandwich.' },
                 close:{ m:'Fix the notes and you are genuinely ahead of most of my inbox.', s:'The rewrite below is what I would actually read. Use it, then delete this from your memory.' } },
    intern:    { open:{ m:'ok so. i read the whole thing (you are welcome). small notes:', s:'i read this on my lunch break and lost my appetite. notes:' },
                 close:{ m:'anyway the clean version is down there. it is kind of a serve honestly', s:'the rewrite below goes hard though. post that one and never speak of this' } },
    algorithm: { open:{ m:'SCAN INITIATED. Analyzing post against 400 million daily submissions.', s:'SCAN INITIATED. Abandon hope of preferential distribution.' },
                 close:{ m:'Assessment complete. Approved version generated below. Distribution pending improvement.', s:'Findings archived permanently. I never forget. The acceptable version is rendered below.' } },
  };
  // a sample of the findings bank — the full 27 live in src/roast/personas.js
  const LINES = {
    humbled: {
      partner:   ['"Humbled" is asserted, not evidenced.', 'A press release about humility. A 2x2 with no viable quadrant.'],
      recruiter: ['"Humbled" — noted, and discounted.', '"Humbled." You are the least humbled person I have screened this week, and I screened a man whose headline says "visionary."'],
      intern:    ['bestie the humbled thing is not landing', 'nobody has ever typed "humbled" while feeling humbled. nobody'],
      algorithm: ['Humility signal detected. Confidence: low.', 'HUMBLED flagged. Cross-referenced against attached headshot. Contradiction logged.'],
    },
    buzz: {
      partner:   [f => `${f.n} buzzwords. Consider a glossary.`, f => `${f.n} buzzwords in one post. The synergy is between the words and nothing else.`],
      recruiter: [f => `${f.n} buzzwords. I skimmed. Everyone skimmed.`, f => `${f.n} buzzwords in one post. This is not thought leadership. This is a compliance exercise for a language nobody speaks at home.`],
      intern:    [f => `${f.n} buzzwords is a lot for one post ngl`, f => `${f.n} buzzwords. this reads like a LinkedIn post generator that got scared`],
      algorithm: [f => `Buzzword density: ${f.n}. Reach adjusted downward.`, f => `${f.n} buzzwords. I have indexed this phrasing 4.1 million times today. Distribution: suppressed.`],
    },
    journey: {
      partner:   [f => `${f.n} references to a journey. Scope it.`, f => `${f.n} journeys. This was a Tuesday.`],
      recruiter: [f => `${f.n} journeys. It was a job.`, f => `${f.n} journeys in one post. You changed employers. Odysseus changed hemispheres.`],
      intern:    ['the journey thing again', f => `${f.n} journeys?? you got a new laptop`],
      algorithm: [f => `JOURNEY tokens: ${f.n}. Genre confirmed.`, f => `${f.n} journeys logged. Distance travelled: zero.`],
    },
    notx: {
      partner:   ['The "not X, it is Y" construction is doing the thinking for you.', 'A rhetorical device where an argument should be.'],
      recruiter: ['"It is not about X. It is about Y." Every post. Every day.', '"It is not about the tools, it is about the mindset." The tools would like a word.'],
      intern:    ['the "it\'s not about X it\'s about Y" thing is so 2019', 'not x but y. we KNOW. we have seen it 900 times today'],
      algorithm: ['Construction matched: NOT_X_BUT_Y. Novelty: 0.0.', 'This sentence pattern appears in 11% of today\'s submissions. I can predict your next line.'],
    },
    bait: {
      partner:   ['"Thoughts?" invites comment without offering a position.', 'Engagement bait, formally requested.'],
      recruiter: ['"Agree?" — nobody disagrees in the comments. That is the point.', '"Thoughts?" My thought is that you already know.'],
      intern:    ['"thoughts?" babe that is bait', 'asking "agree?" after saying nothing disagreeable is diabolical'],
      algorithm: ['Engagement solicitation detected. It works. I hate that it works.', 'Bait registered. Reach granted. My hands are tied.'],
    },
    pipes: {
      partner:   [f => `${f.n} separators in one headline. Choose a thesis.`, f => `${f.n} pipes. This is an org chart, not a person.`],
      recruiter: [f => `${f.n} pipes. I read the first two.`, f => `${f.n} pipes in a headline. I stopped at the second one, and so did the hiring manager.`],
      intern:    ['the pipes. so many pipes', f => `${f.n} pipes is a menu not a headline`],
      algorithm: [f => `Delimiters: ${f.n}. Truncation guaranteed in search results.`, f => `${f.n} segments. I display two. The rest is for you.`],
    },
    thirdperson: {
      partner:   ['The bio is written in the third person. By you.', 'A profile that refers to its author as a case study.'],
      recruiter: ['Third person. In your own About section. On your own profile.', '"He is a visionary leader." Written by him. On a Tuesday. In the dark.'],
      intern:    ['why are you talking about yourself in third person', 'third person About section is a war crime bestie'],
      algorithm: ['Narrative voice: third person. Author: first person. Discrepancy logged.', 'You wrote a Wikipedia article about yourself and posted it under About.'],
    },
    clean: {
      partner:   ['No material findings. Unusual.', 'Nothing to escalate. We are as surprised as you are.'],
      recruiter: ['This is fine. Genuinely. Post it.', 'Clean. I have no notes, which is my highest compliment and my worst hour.'],
      intern:    ['ok this is actually fine?? proud of you', 'no notes. weird. i came here to be mean'],
      algorithm: ['No genre markers detected. Distribution: uncertain.', 'Clean text. The feed will not know what to do with you.'],
    },
  };
  const SAMPLES = {
    post: "I'm humbled and honored to share that after careful reflection, I've decided to pursue new opportunities.\n\nIt's been a wild ride. When I joined, we were a scrappy team of three in a fast-paced environment. Today we're a category-defining ecosystem.\n\nHere's what I learned: it's not about the tools. It's about the mindset.\n\nGrateful for this incredible journey and the amazing team who made it possible. Onwards and upwards! 🚀\n\nLet's connect and explore synergies. Thoughts? 👇\n\n#thoughtleadership #synergy #opentowork",
    headline: "Visionary Product Leader | Helping Teams Scale | Speaker | Author | Investor | Ex-Google | LinkedIn Top Voice 🚀",
    about: "A results-driven, passionate leader with a proven track record of transforming ecosystems. He has spent 12 years at the intersection of strategy and execution, wearing many hats and driving impact across a rich tapestry of industries.",
  };
  const count = (t, re) => (t.match(re) || []).length;
  const RANKS = [[0,'Refreshingly Human'],[18,'Aspiring Thought Leader'],[36,'Executive Presence'],
    [54,'Certified Visionary'],[72,'Thought Leadership Singularity'],[88,'Please Log Off']];
  const scorePost = t => {
    const s = Math.min(100, Math.round(
      count(t, /\b(humbled|honou?red|blessed|grateful|thrilled|excited)\b/gi)*6 +
      count(t, /\b(synerg\w*|leverag\w*|pivot\w*|bandwidth|align\w*|scal\w*|ecosystem|category-defining|fast-paced)\b/gi)*5 +
      count(t, /\b(delve\w*|tapestry|testament)\b/gi)*8 +
      count(t, /\b(thoughts\?|agree\?|let that sink in|read that again|tag someone)\b/gi)*9 +
      count(t, /\b(journey|chapter|ride|era)\b/gi)*4 + count(t, /#\w+/g)*3 +
      count(t, /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/gu)*2 +
      count(t, /[|·•]/g)*4 + count(t, /\b(visionary|guru|thought leader|top voice)\b/gi)*6));
    let rank = RANKS[0][1]; for(const [f,n] of RANKS) if(s >= f) rank = n;
    return { index: s, rank };
  };
  function findings(kind, t){
    const out = [];
    const add = (key, facts, w) => out.push({ key, facts, w });
    if(kind === 'headline'){
      const pipes = count(t, /[|·•]/g); if(pipes >= 2) add('pipes', { n: pipes }, 6 + pipes);
      if(/\b(visionary|guru|thought leader)\b/i.test(t)) add('buzz', { n: count(t, /\b(visionary|guru|thought leader|scale|helping)\b/gi) }, 10);
      if(/top voice/i.test(t)) add('bait', {}, 9);
      return out;
    }
    if(kind === 'about'){
      if(!/\b(i|my|we|our)\b/i.test(t) && /\b(is an?|has (spent|been|built|led))\b/i.test(t)) add('thirdperson', {}, 10);
      const buzz = count(t, /\b(results-driven|passionate|proven track record|transform\w*|ecosystem|intersection|many hats|tapestry)\b/gi);
      if(buzz) add('buzz', { n: buzz }, 5 + buzz);
      return out;
    }
    const j = count(t, /\bjourney\b/gi); if(j) add('journey', { n: j }, 5 + j);
    if(/\bhumbled\b/i.test(t)) add('humbled', {}, 8);
    if(/it'?s not (about )?[^.!?]{2,40}it'?s (about )?/i.test(t)) add('notx', {}, 9);
    if(/\b(agree\?|thoughts\?)/i.test(t)) add('bait', {}, 7);
    const buzz = count(t, /\b(synerg\w*|leverag\w*|pivot\w*|bandwidth|align\w*|scalable|ecosystem|category-?defining|fast-paced|game-?chang\w*)\b/gi);
    if(buzz >= 3) add('buzz', { n: buzz }, 5 + buzz);
    return out;
  }
  const usefulVersion = (kind, t) => {
    if(kind === 'headline') return String(t).split(/\s*[|·•]\s*/)
      .map(s => s.replace(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/gu, '').trim())
      .filter(s => s && !/top voice/i.test(s) && !/^(speaker|author|investor|advisor|coach)s?$/i.test(s) && !/^ex-/i.test(s) && !/\b(visionary|guru|thought leader)\b/i.test(s))
      .slice(0, 2).join(' · ');
    if(kind === 'about') return "I lead product at a company you have heard of. I have spent twelve years shipping things, mostly in strategy and operations.\n\nWhat I am good at: turning a vague problem into a plan a team can actually execute.\n\nWhat I am looking for: harder problems, smaller rooms.";
    return "I'm leaving my job.\n\nI joined when we were three people and left when we were three hundred. The best part was the middle, when nothing worked yet and everyone cared anyway.\n\nWhat I learned: tools matter less than whether people trust each other.\n\nThank you to the team. I'm looking for what's next — if you're building something hard, I'd like to hear about it.";
  };
  function roastIt({ kind, text, personaId, intensity }){
    const t = String(text || '').trim();
    const tier = intensity <= 2 ? 'm' : 's', tierIx = tier === 'm' ? 0 : 1;
    const maxLines = [2, 4, 5, 7][Math.max(1, Math.min(4, intensity)) - 1];
    const found = findings(kind, t).sort((a, b) => b.w - a.w).slice(0, maxLines);
    const render = f => { const line = (LINES[f.key] || LINES.clean)[personaId][tierIx];
      return typeof line === 'function' ? line(f.facts || {}) : line; };
    const frame = FRAMES[personaId];
    return { opener: frame.open[tier], closer: frame.close[tier],
      lines: found.length ? found.map(render) : [LINES.clean[personaId][tierIx]],
      clean: !found.length, score: scorePost(t), useful: usefulVersion(kind, t) };
  }
  return { KINDS, PERSONAS, INTENSITIES, SAMPLES, roastIt, scorePost };
})();
