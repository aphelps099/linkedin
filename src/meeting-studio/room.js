export const PARTICIPANTS = [
  {id:'drums', name:'Strategic Partnerships', role:'Voice 01 + drums', voice:'M', media:'drums', position:'50% 50%'},
  {id:'keys', name:'People & Culture', role:'Voice 02 + keys', voice:'F', media:'keys', position:'50% 50%'},
  {id:'vocals', name:'Workflow Automation', role:'Synths', media:'vocals', position:'50% 50%'},
  {id:'bass', name:'Thought Leader', role:'Bass'},
];
export const SHORT_TITLES = ['Take It Offline','Circle Back','Mutual Alignment','Humbled & Honored','Synergistically','No Action Required'];
export const MEETING_TITLES = ['Weekly Alignment','Recurring Follow-up','Alignment Pre-alignment','Personal Growth Check-in','Cross-functional Sync','Action Items Review'];

export function speakingParticipant(state) {
  if(!state.playing || !state.volume) return null;
  const id=state.speaker==='F'?'keys':'drums';
  return state.speaking&&state.voice!=='instrumental'&&!state.muted[id]?id:null;
}
export function activeParticipant(state) {
  return speakingParticipant(state);
}
export function directedSpotlight(state) {
  return speakingParticipant(state);
}
