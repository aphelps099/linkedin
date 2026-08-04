// The engagement engine — the comment section, played dead straight.
const PEOPLE = [
  ['Chad Growthman', 'VP of Vibes at Synergy Partners'],
  ['Brenda Sinclair', 'Chief People Officer | Culture Architect'],
  ['Blake Thoughtleader', 'Founder | Investor | Podcast Host | Girl Dad'],
  ['Karen Alignment', 'Agile Coach & Keynote Speaker'],
  ['Trip Delaney III', 'Serial Entrepreneur · 3x Exits'],
  ['Dana Metrics', 'Head of Growth at Pipeline.ai'],
  ['Hunter Pipeline', 'SDR of the Year 2024 | Always Be Closing'],
  ['Saylor Brandwidth', 'Personal Branding Strategist'],
  ['Gary Grindset', 'CEO | Author | 5AM Club | Ex-Deloitte'],
  ['Peyton Paradigm', 'Fractional Everything Officer'],
  ['Morgan Uptick', 'Ex-McKinsey, Ex-Google, Ex-cited'],
  ['Avery Circleback', 'Director of Follow-Ups'],
  ['Priya Bandwidth', 'Transformation Lead | Change Evangelist'],
  ['Doug Rightsizing', 'Operating Partner'],
  ['Simone Ideation', 'Design Thinking Facilitator'],
];
const DEGREES = ['1st', '2nd', '2nd', '2nd', '3rd', '3rd'];
const TEXTS = [
  'Congrats on the new chapter!',
  'So well deserved. 👏',
  'This resonated deeply. Thank you for sharing.',
  'Great insight — following for more.',
  'Commenting for reach.',
  'This. So much this.',
  'Absolutely inspiring. Saving this post.',
  'Adding this to my leadership playbook.',
  "We're hiring! DM me. 🚀",
  'Sound advice for any founder navigating this space.',
  'Taking notes. 📝',
  'The hustle is real.',
  'Needed to hear this today.',
  'Big if true.',
  'What a time to be building.',
  'Love to see it. 🙌',
  '10/10 thought leadership.',
  'Agreed — mindset is everything.',
  'Who else is seeing this trend?',
  'Printing this out for my team.',
  'This should be required reading.',
  'Underrated take, honestly.',
  'Bookmarked. Again.',
  'The algorithm brought me here for a reason.',
  'Powerful reminder. Reposting to my network.',
  'Couldn’t agree more. 💯',
];
const AGES = ['1m', '2m', '4m', '7m', '12m', 'now', 'now', '23m', '1h'];

const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const initialsOf = name => name.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();

export function randomComment(){
  const [name, title] = pick(PEOPLE);
  const likes = Math.floor(Math.random()*140);
  return {
    name,
    initials: initialsOf(name),
    degree: pick(DEGREES),
    title,
    text: pick(TEXTS),
    age: pick(AGES),
    likes,
    replies: Math.random() < .35 ? 1 + Math.floor(Math.random()*4) : 0,
    // which reaction badges show on the pill, in LinkedIn's order
    reactions: likes > 60 ? ['like','insight','love'] : likes > 20 ? ['like','insight'] : ['like'],
  };
}
