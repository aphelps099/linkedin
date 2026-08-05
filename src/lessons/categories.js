// LINKEDIN LESSONS — the interview.
// Six categories. Each defines a one-question-at-a-time flow; `steps(answers)`
// returns the full question list given what's answered so far, so an early
// choice (e.g. "A product launch") reshapes the questions that follow.
// Every question can `react` to its answer — the form talks back.

const q = (key, ask, opts = {}) => ({ key, ask, type: opts.options ? 'choice' : (opts.long ? 'long' : 'text'), ...opts });

export const CATEGORIES = [
  {
    id: 'announce',
    form: 'LL-01',
    name: 'Announce Something',
    subtitle: 'A hire, a promotion, a launch, a milestone — rendered historically significant.',
    steps(a){
      const kind = a.kind;
      const base = [
        q('kind', 'What are we announcing?', {
          options: ['A new hire', 'A promotion', 'A product launch', 'A partnership', 'A company milestone'],
          react: v => ({
            'A new hire': "Excellent. One person's first day, reframed as a defining chapter.",
            'A promotion': 'Wonderful. Upward mobility, but make it destiny.',
            'A product launch': 'A launch. The word "reimagine" is already warming up.',
            'A partnership': 'Two logos, one press release. Beautiful.',
            'A company milestone': 'A number is about to become a movement.',
          }[v]),
        }),
      ];
      if(kind === 'A new hire' || kind === 'A promotion') return base.concat([
        q('name', "What is the person's name?", { placeholder: 'Sarah',
          react: v => `Excellent. Let's make ${v || 'their'}'s employment feel historically significant.` }),
        q('role', kind === 'A promotion' ? 'What is their new title?' : 'What is their new role?', { placeholder: 'Marketing Coordinator',
          react: () => 'Noted. We will imply the role was created by fate.' }),
        q('before', 'Where were they before this?', { placeholder: 'A local nonprofit',
          react: () => 'A humble origin story. The arc writes itself.' }),
        q('quality', 'What suspiciously impressive quality do they bring?', { placeholder: 'Relentless organization',
          react: v => `"${v}". We will imply they invented it.` }),
        q('goal', 'What will they help your company accomplish?', { placeholder: 'Improve our content',
          react: () => 'Modest. We can fix that with the dial.' }),
        q('company', "What's your company called?", { placeholder: 'Acme Inc.',
          react: v => `${v || 'The company'} will never be the same. Allegedly.` }),
      ]);
      if(kind === 'A product launch') return base.concat([
        q('name', "What's the product called?", { placeholder: 'FlowDeck',
          react: v => `${v || 'It'} is about to change everything, whether it wants to or not.` }),
        q('goal', 'What does it actually help people do?', { placeholder: 'Plan their week in five minutes',
          react: () => 'Useful. We may have to disguise that.' }),
        q('before', 'Why did you build it, honestly?', { placeholder: 'Our customers kept asking for it',
          react: () => 'An origin story. Every hallucination needs one.' }),
        q('quality', 'What suspiciously impressive quality does it have?', { placeholder: 'It works offline',
          react: () => 'Noted. That will become "category-defining".' }),
        q('company', "What's your company called?", { placeholder: 'Acme Inc.' }),
      ]);
      if(kind === 'A partnership') return base.concat([
        q('name', "Who's the partner?", { placeholder: 'Northwind Systems',
          react: v => `${v || 'They'} have no idea how synergistic this is about to sound.` }),
        q('before', 'What will you actually do together?', { placeholder: 'Integrate our two products',
          react: () => 'Two things, near each other. The definition of synergy.' }),
        q('quality', 'What suspiciously impressive quality does the pairing have?', { placeholder: 'Shared customers already love both' }),
        q('goal', 'What will the partnership accomplish?', { placeholder: 'Save customers an hour a day' }),
        q('company', "What's your company called?", { placeholder: 'Acme Inc.' }),
      ]);
      if(kind === 'A company milestone') return base.concat([
        q('name', "What's the milestone?", { placeholder: '10,000 customers',
          react: v => `${v || 'It'}. A number is about to feel like a prophecy.` }),
        q('before', 'What actually got you here, honestly?', { placeholder: 'Years of unglamorous consistency',
          react: () => 'Honesty. We will bury it in gratitude.' }),
        q('quality', 'What quality are we crediting?', { placeholder: 'An obsessive support team' }),
        q('goal', "What's next?", { placeholder: 'Ship the new platform' }),
        q('company', "What's your company called?", { placeholder: 'Acme Inc.' }),
      ]);
      return base;
    },
  },
  {
    id: 'lesson',
    form: 'LL-02',
    name: 'Teach a Lesson',
    subtitle: 'Extract enterprise wisdom from something that was, at the time, nothing.',
    steps: () => [
      q('source', 'Where did this profound lesson come from?', {
        options: ['A failure', 'A tiny everyday moment', 'Something my kid said', 'A stranger at the airport', 'A book I have not finished'],
        react: v => ({
          'A failure': 'Brave. Failure is just success wearing a disguise, or so you are about to claim.',
          'A tiny everyday moment': 'Perfect. The smaller the moment, the larger the lesson.',
          'Something my kid said': 'A child is about to out-consult McKinsey.',
          'A stranger at the airport': 'Gate B7. Where all wisdom lives.',
          'A book I have not finished': 'Chapter one contains multitudes.',
        }[v]),
      }),
      q('moment', 'What actually happened?', { long: true, placeholder: 'A barista remembered my order',
        react: () => 'Riveting. Now we monetize it emotionally.' }),
      q('lesson', 'What lesson are we extracting from this?', { placeholder: 'Consistency builds trust',
        react: v => `"${v}". Socrates found dead in a ditch.` }),
      q('topic', 'Which business topic does this secretly prove?', {
        options: ['B2B sales', 'Leadership', 'Hiring', 'Marketing', 'Company culture'],
        react: v => `Of course it's about ${(v || 'leadership').toLowerCase()}. It was always about ${(v || 'leadership').toLowerCase()}.`,
      }),
    ],
  },
  {
    id: 'sell',
    form: 'LL-03',
    name: 'Sell Without Selling',
    subtitle: "A customer story so moving nobody notices it's an ad.",
    steps: () => [
      q('offer', 'What do you sell?', { placeholder: 'Pipeline consulting',
        react: () => 'Noted. We will never mention it directly. Except constantly.' }),
      q('customer', "Who's the customer in this story? First name is plenty.", { placeholder: 'Dana',
        react: v => `${v || 'They'} is about to become the protagonist of a redemption arc.` }),
      q('problem', 'What problem were they "struggling" with?', { placeholder: 'A leaky sales pipeline',
        react: () => 'The darkness before the dawn. Excellent.' }),
      q('result', 'What suspiciously specific result did they get?', { placeholder: '312% more qualified leads',
        react: v => `${v || 'That number'}. Precise enough to sound measured, round enough to be marketing.` }),
      q('cta', 'What should readers do, ideally without noticing they were sold to?', { placeholder: 'Send me a message',
        react: () => 'Not selling. Just saying.' }),
    ],
  },
  {
    id: 'urgency',
    form: 'LL-04',
    name: 'Manufacture Urgency',
    subtitle: 'Nothing is happening. Announce it like a countdown.',
    steps: () => [
      q('kind', 'What kind of urgency are we manufacturing?', {
        options: ["We're hiring", 'Limited spots', 'Launch countdown', 'Big things coming'],
        react: v => v === 'Big things coming'
          ? 'The vaguest of the urgency genres. Nothing needs to exist. Perfect.'
          : 'Scarcity: the only KPI that markets itself.',
      }),
      q('thing', 'What is it, concretely?', { placeholder: 'A Senior Product Designer role',
        react: () => 'Concrete. We will sand that down to a silhouette.' }),
      q('scarcity', 'How scarce are we pretending it is?', { placeholder: '48 hours / 3 spots',
        react: v => `${v || 'Limited'}. The universe said no to more. You asked. It refused.` }),
      q('audience', 'Who exactly should be panicking right now?', { placeholder: 'Designers who want real ownership',
        react: () => 'They will feel personally seen. That is the entire strategy.' }),
    ],
  },
  {
    id: 'ai',
    form: 'LL-05',
    name: 'AI Thought Leadership',
    subtitle: 'Announce that you used a chatbot as though you personally invented artificial intelligence.',
    steps: () => [
      q('tool', 'Which AI tool did you just discover?', { placeholder: 'ChatGPT',
        react: v => `${v || 'It'} has existed for years. Today, it becomes news.` }),
      q('task', 'What did you actually use it for?', { placeholder: 'Write our quarterly report',
        react: () => 'A normal task. Soon: a glimpse of the singularity.' }),
      q('multiplier', 'How much faster are we claiming you are now?', { placeholder: '10x',
        react: v => `${v || '10x'}. A number no one will check and everyone will repeat.` }),
      q('doomed', 'What do you predict is dead in five years?', { placeholder: 'Consulting',
        react: v => `${v || 'It'} attended its own funeral and doesn't know it yet.` }),
    ],
  },
  {
    id: 'roast',
    form: 'LL-06',
    name: 'Roast My Post',
    subtitle: 'Paste your draft. Receive a better version, a worse version, and consequences.',
    paste: true, // special flow: one big textarea instead of an interview
  },
];

export const byId = id => CATEGORIES.find(c => c.id === id);
