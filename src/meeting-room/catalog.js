import {library} from './scripts.js';
import audio from './audio-manifest.json';

export const agendas=[
  ['standup','Weekly stand-up'],['onboarding','Onboarding'],['unlock','Unlocking potential'],
  ['paperless','Going paperless'],['founder','Founder update'],['offline','Take this offline'],['quarterly','Q3 alignment'],
];
export const cast={
  synergy:{name:'Synergy',role:'Host',media:'synergy',robot:true},
  synthia:{name:'Synthia',role:'Corporate training',media:'synthia',robot:true},
  people:{name:'People & Culture',role:'Human resources',media:'people'},
  strategy:{name:'Strategy',role:'Strategic alignment',media:'strategy'},
  guitar:{name:'Kevin',role:'Partnerships',media:'guitar',instrument:'Guitar'},
  keys:{name:'Keys',role:'Enablement',media:'keys',instrument:'Keyboard'},
  operations:{name:'Operations',role:'Operational excellence',media:'drums',instrument:'Drum pad'},
  accountant:{name:'Arjun',role:'Finance',media:'arjun'},
  linda:{name:'Linda',role:'Governance',media:'linda'},
  printer:{name:'Printer',role:'Deliverables',media:'printer',silent:true},
  droid:{name:'Internal distribution',role:'Paper logistics',media:'droid',silent:true},
  pat:{name:'Pat',role:'Thought leadership',silent:true,offline:true},
};
export const meetings=Object.fromEntries(Object.entries(library).map(([agenda,variants])=>[
  agenda,variants.map((meeting,variant)=>({...meeting,agenda,variant,id:`${agenda}-${variant}`,...audio.meetings[`${agenda}-${variant}`]})),
]));
// Visit each agenda before its alternate take. Every meeting gets one turn.
export const meetingSequence=[0,1].flatMap(variant=>agendas.map(([agenda])=>meetings[agenda][variant]));
export function nextMeeting(currentId){
  const index=meetingSequence.findIndex(meeting=>meeting.id===currentId);
  return meetingSequence[(index+1)%meetingSequence.length];
}
export const timeLabel=seconds=>`${Math.floor(Math.max(0,seconds)/60)}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`;
export function cueAt(meeting,time){return meeting?.cues.find(cue=>time>=cue.start&&time<cue.start+cue.duration)||null;}
export function isSpeaker(id,cue){return !!cue&&!cast[id].silent&&(cue.speaker===id||cue.speaker==='all');}
export function cueLevel(cue,time){return (cue?.level?.[Math.floor((time-cue.start)*25)]||0)/100;}
