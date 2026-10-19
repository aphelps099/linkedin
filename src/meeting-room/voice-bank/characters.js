// Voice identity belongs to a character, never to a tile or a meeting.
// Candidate human casts must be heard and approved before season-wide rendering.
const human = (name, voice, speed, direction, poster) => ({
  name, kind:'human', status:'candidate', version:'human-casting-1',
  provider:'local-kokoro', voice, speed, direction, poster,
  performance:'Natural speech. Underplay the joke. No vocoder, pitch shifting, or singing.',
});

export const characters = {
  people:human('People & Culture','af_heart',.97,
    'Warm and professionally reassuring. Entirely sincere about the unnecessary process.', 'people-listening.jpg'),
  strategy:human('Strategy','am_fenrir',.98,
    'Measured, articulate confidence. Treat each small suggestion as a strategic contribution.', 'strategy-listening.jpg'),
  guitar:human('Kevin · Partnerships','am_puck',1,
    'Conversational and quietly enthusiastic. Questions should sound genuinely practical.', 'guitar-listening.jpg'),
  keys:human('Keys · Enablement','af_bella',.98,
    'Calm, friendly conviction. A colleague speaking over her keyboard, not a presenter.', 'keys-listening.jpg'),
  operations:human('Operations','am_michael',.97,
    'Unhurried, matter-of-fact pride. Announce renaming a folder as an ordinary achievement.', 'drums-listening.jpg'),
  accountant:human('Arjun · Finance','bm_george',1,
    'Precise and restrained. Ask the obvious question without announcing that it is a joke.', 'arjun-listening.jpg'),
  linda:human('Linda · Governance','af_sarah',.94,
    'Dry, experienced, patient. Land the final observation without a theatrical pause.', 'linda-listening.jpg'),
  synergy:{name:'Synergy',kind:'robot',status:'existing',version:'season-1',provider:'flite',voice:'kal16',pitch:.91,
    direction:'Flat digital host. Keep the established identity; do not recast with a human voice.'},
  synthia:{name:'Synthia',kind:'robot',status:'existing',version:'season-1',provider:'flite',voice:'slt',pitch:1.04,
    direction:'Distinct digital trainer. Clear and dry, not fried or melodic.'},
};

export const silentCharacters = ['printer','droid','pat'];
export const commonAudition = 'I’m humbled and honored to share a small update.';
export const auditionLines = {
  people:[commonAudition,'I’ve added a checklist for completing the checklist.','I’ll add that to both checklists.'],
  strategy:[commonAudition,'A third tab would give us room to scale.','What will they be working on?'],
  guitar:[commonAudition,'I’m still waiting for access.','It now says: building something exciting.'],
  keys:[commonAudition,'This will unlock the full potential of our shared drive.','A seamless first-touch experience.'],
  operations:[commonAudition,'I’m excited to share that I’ve renamed the folder Final.','We’ve successfully onboarded the new dashboard.'],
  accountant:[commonAudition,'Have we onboarded any customers?','Same link. Same time. Same people.'],
  linda:[commonAudition,'It went to spam.','I’ll reuse last quarter’s spreadsheet.'],
};
