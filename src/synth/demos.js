import {initialProject, SOUNDS, validateProject} from './model.js';

export const DEMOS = [
  {id:'working-group',name:'Working group',bpm:120,description:'Four-on-the-floor. Sub bass. Synergy on the agenda.',voice:'voice-synergy-38fb1c669b74c092',reply:'voice-synergy-16dac392c12f64b4',delay:.16,swing:0},
  {id:'onboarding',name:'Onboarding',bpm:116,description:'Broken drums. Soft chords. Synthia takes the floor.',voice:'voice-synthia-d0824ab5a32cb5aa',reply:'voice-synergy-420b5b23a6f89b84',delay:.23,swing:.08},
  {id:'offline',name:'Offline',bpm:112,description:'Half-time space. Low bass. One final action item.',voice:'voice-synergy-397edd059e40747a',reply:'voice-synthia-1501482035b85eea',delay:.3,swing:.12},
];
export function demoProject(id){
  const index=DEMOS.findIndex(d=>d.id===id),demo=DEMOS[index];
  if(!demo)throw Error('Unknown demo.');
  const p=initialProject();
  Object.assign(p,{name:demo.name,bpm:demo.bpm,swing:demo.swing,delay:demo.delay,filter:index===2?6800:13000,volume:.72});
  p.pattern=Array.from({length:8},()=>Array(64).fill(false));
  const rhythms=[
    [[0,4,8,12],[4,12],[2,6,10,14],[12],[0,7,10,14],[6]],
    [[0,6,10],[4,12],[2,6,10,14],[12],[0,6,11],[2,10]],
    [[0,10],[8],[2,6,10,14],[8],[0,10],[0]],
  ][index];
  for(let bar=0;bar<4;bar++)rhythms.forEach((row,pad)=>row.forEach(step=>{p.pattern[pad][bar*16+step]=true;}));
  p.pattern[2][63]=true;p.pattern[1][62]=index!==2;
  // A voice enters every two bars; original pitch and full phrases stay intact.
  p.pattern[6][0]=true;p.pattern[7][32]=true;
  [.85,.32,.28,.22,.65,.2,.72,.72].forEach((gain,i)=>p.slots[i].gain=gain);
  p.slots[4].pitch=-12;
  [demo.voice,demo.reply].forEach((sound,i)=>{const sample=SOUNDS.find(s=>s.id===sound);p.slots[6+i]={...p.slots[6+i],sound,name:sample.group,pitch:0};});
  return validateProject(p);
}
