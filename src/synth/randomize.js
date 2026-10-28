import {SOUNDS, validateProject} from './model.js';

export function seededRandom(seed){
 let state=seed>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
}

// Keep a rhythmic foundation; vary the arrangement, tuning and two short voices.
export function randomizeProject(project,seed){
 const random=seededRandom(seed),pick=items=>items[Math.floor(random()*items.length)];
 const halfTime=random()<.5,bpm=pick([124,128,132,136,140]);
 const voices=SOUNDS.filter(sound=>sound.kind==='VOICE'&&sound.duration>=.6&&sound.duration<=2.1);
 const voice=()=>random()<.45?pick(SOUNDS.filter(sound=>['synergy','circle'].includes(sound.id))):pick(voices);
 const first=voice(),secondPool=voices.filter(sound=>sound.id!==first.id);
 const sounds=SOUNDS.slice(0,6).concat(first,pick(secondPool));
 const pattern=Array.from({length:8},()=>Array(64).fill(false));
 for(let bar=0;bar<4;bar++){
  const set=(pad,steps)=>steps.forEach(step=>{pattern[pad][bar*16+step]=true;});
  set(0,halfTime?[0,6,10]:[0,4,8,12]);
  if(random()<.6)set(0,[pick([3,7,14])]);
  set(1,halfTime?[8]:[4,12]);
  set(2,[2,6,10,14]);if(random()<.6)set(2,[pick([0,3,7,11,15])]);
  set(3,halfTime?[8]:[12]);
  set(4,pick([[0,6,10],[0,7,12],[0,3,10,14]]));
  set(5,[pick([2,6,10])]);
 }
 pattern[6][0]=true;pattern[7][32]=true;
 const slots=sounds.map((sound,i)=>({...project.slots[i],sound:sound.id,name:sound.name,data:null,start:0,end:1,reverse:false,mute:false,
  pitch:i===0?pick([-3,0,2]):i===1?pick([-2,0,2]):i===4?pick([-12,-7,0]):i===5?pick([-12,0]):0,
  gain:[.82,.45,.27,.23,.6,.22,.8,.8][i]}));
 return validateProject({...project,name:pick(['After-hours alignment','Low-frequency leadership','Bass-level decision','Unscheduled synergy']),bpm,swing:pick([0,.06,.12,.18]),filter:pick([8000,11000,15000]),delay:.1,dubSeed:seed>>>0,pattern,slots});
}
