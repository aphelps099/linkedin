export const SCENE_DURATION = 21000;
export const FEED_SCENES = [
  {
    id:'email', author:'Jordan Wells', title:'Head of Strategic Possibility',
    post:'Thrilled to announce I replied to an email.',
    after:'Every journey begins with a single Send.', lesson:'The big announcement',
    comments:[
      ['Alex Morgan','This is what leadership looks like.'],
      ['Casey Park','The courage to click Send. Incredible.'],
      ['Drew Bennett','A masterclass in showing up.'],
      ['Riley James','Your journey is inspiring us all.'],
      ['Sam Brooks','Proud to be in your network.'],
    ],
  },
  {
    id:'coffee', author:'Jordan Wells', title:'Founder · Thought Leader · Coffee Drinker',
    post:'I made coffee.', after:'Here are 7 things it taught me about leadership.', lesson:'The unsolicited insight',
    comments:[
      ['Alex Morgan','Not just coffee. A mindset.'],
      ['Casey Park','The vulnerability here is incredible.'],
      ['Drew Bennett','This is the leadership we need.'],
      ['Riley James','Turning beans into breakthroughs.'],
      ['Sam Brooks','I’m sharing this with my team.'],
    ],
  },
];
export const LOOP_DURATION = SCENE_DURATION * FEED_SCENES.length;
const REACTION_TIMES = Array.from({length:40},(_,i)=>2200+4400*Math.pow(i/39,.65));
const COMMENT_TIMES = [7100,8800,10500,12200,13900];
const reactionType = i => [0,1,0,2,0,1,0][i%7];

// One deterministic clock drives both layouts. No random counters or chained
// timeouts: pausing and leaving the viewport preserve the current scene.
export function feedFrame(elapsed) {
  const position = ((elapsed % LOOP_DURATION) + LOOP_DURATION) % LOOP_DURATION;
  const sceneIndex = Math.floor(position / SCENE_DURATION), time = position % SCENE_DURATION;
  const reactions = REACTION_TIMES.filter(at=>time>=at).length;
  const counts = [0,0,0];
  for(let i=0;i<reactions;i++)counts[reactionType(i)]++;
  return {
    sceneIndex, time, reactions, counts,
    comments:COMMENT_TIMES.filter(at=>time>=at).length,
    activeReaction:reactions ? reactionType(reactions-1) : -1,
    clicking:time>=2200&&time<6850,
    pressed:reactions>0&&time-REACTION_TIMES[reactions-1]<95,
    leaving:time>20400,
  };
}
