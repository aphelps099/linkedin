// The engagement engine — fake LinkedIn comments and reactions, played dead straight.
const NAMES = [
  ['Chad Growthman', 'VP of Vibes'],
  ['Brenda Synergy', 'Chief People Officer'],
  ['Blake Thoughtleader', 'Founder | Investor | Podcast Host'],
  ['Karen Alignment', 'Agile Coach & Keynote Speaker'],
  ['Trip Delaney III', 'Serial Entrepreneur'],
  ['Dana Metrics', 'Head of Growth'],
  ['Hunter Pipeline', 'SDR of the Year, 2024'],
  ['Saylor Brandwidth', 'Personal Branding Strategist'],
  ['Gary Grindset', 'CEO | Author | 5AM Club'],
  ['Peyton Paradigm', 'Fractional Everything'],
  ['Morgan Uptick', 'Ex-McKinsey, Ex-Google, Ex-cited'],
  ['Avery Circleback', 'Director of Follow-Ups'],
];
const DEGREES = ['1st', '2nd', '2nd', '3rd', '3rd'];
const TEXTS = [
  'Congrats on the new chapter!',
  'So well deserved.',
  'This resonated deeply.',
  'Great insight, following for more.',
  'Commenting for reach.',
  'This. So much this.',
  'Absolutely inspiring, saving this post.',
  'Adding this to my leadership playbook.',
  "We're hiring! DM me.",
  'Sound advice for any founder.',
  'Taking notes.',
  'The hustle is real.',
  'Needed to hear this today.',
  'Big if true.',
  'What a time to be building.',
  'Love to see it.',
  '10/10 thought leadership.',
  'Agreed — mindset is everything.',
  'Who else is seeing this trend?',
  'Printing this out for my team.',
  'This should be required reading.',
  'Underrated take, honestly.',
  'Bookmarked. Again.',
  'The algorithm brought me here for a reason.',
];
const AGES = ['1m', '2m', '3m', '5m', '8m', 'now', 'now', '12m'];

const pick = arr => arr[Math.floor(Math.random()*arr.length)];

export function randomComment(){
  const [name, title] = pick(NAMES);
  return {
    name,
    degree: pick(DEGREES),
    title,
    text: pick(TEXTS),
    age: pick(AGES),
    likes: 3 + Math.floor(Math.random()*120),
  };
}
