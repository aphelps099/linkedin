export const PARTICIPANTS = [
  {id:'drums', name:'Strategic Partnerships', role:'Drums', media:'drums', position:'50% 50%'},
  {id:'keys', name:'People & Culture', role:'Keys', media:'keys', position:'50% 50%'},
  {id:'vocals', name:'Workflow Automation', role:'Robot vocals', media:'vocals', position:'50% 50%'},
  {id:'bass', name:'Thought Leader', role:'Bass'},
];
export const SHORT_TITLES = ['Take It Offline','Circle Back','Mutual Alignment','Humbled & Honored','Synergistically','No Action Required'];
export const MEETING_TITLES = ['Weekly Alignment','Recurring Follow-up','Alignment Pre-alignment','Personal Growth Check-in','Cross-functional Sync','Action Items Review'];

export function activeParticipant(state, track) {
  if(!state.playing || !state.volume) return null;
  if(state.speaking && !state.muted.vocals && state.voice !== 'instrumental') return 'vocals';
  const rotation = ['drums','keys','bass','keys'];
  const bar = Math.floor(state.elapsed * track.bpm / 240);
  const preferred = rotation[(bar + state.index) % rotation.length];
  return !state.muted[preferred] ? preferred : rotation.find(id => !state.muted[id]) || null;
}

export function directedSpotlight(state, track) {
  const bar = Math.floor(state.elapsed * track.bpm / 240);
  if(!state.playing || bar < 8 || bar % 8 > 1) return null;
  return activeParticipant(state,track);
}
