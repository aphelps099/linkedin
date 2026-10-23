import {RECORDINGS} from '../home/recordings.js';
import characterSounds from './sound-library.json' with {type:'json'};
export const KEYS = ['1','2','3','4','5','6','7','8'];
export const SOUNDS = [
  {id:'kick',name:'Kick',kind:'DRUM'}, {id:'snare',name:'Snare',kind:'DRUM'},
  {id:'hat',name:'Hi-hat',kind:'DRUM'}, {id:'clap',name:'Clap',kind:'DRUM'},
  {id:'bass',name:'Bass',kind:'SYNTH'}, {id:'chord',name:'Chord',kind:'SYNTH'},
  {id:'synergy',name:'Synergy',kind:'VOICE',url:'/phrases/05.wav'},
  {id:'circle',name:'Circle back',kind:'VOICE',url:'/phrases/06.wav'},
  ...characterSounds,
  ...RECORDINGS.filter(track=>track.seconds<30).map(track=>({id:track.id,name:track.title,kind:'LOOP',group:'Session recordings',duration:track.seconds,url:track.src})),
];
const rhythms = [
 [[0,4,8,12],[4,12],[0,2,4,6,8,10,12,14],[12],[0,6,8,14],[2,10],[0],[8]],
 [[0,3,8,10],[4,12],[0,2,3,6,8,10,11,14],[4,12],[0,7,10],[6,14],[2],[10]],
 [[0,8],[4,12],[2,6,10,14],[12],[0,6,11],[0,8],[4],[12]],
];
export const PRESETS = ['All hands','Circle back','After hours'];
export function patternFor(index){return rhythms[index].map(row=>Array.from({length:16},(_,i)=>row.includes(i)));}
export function initialProject(){return {version:1,name:'Untitled alignment',bpm:112,swing:0,volume:.75,filter:18000,delay:.12,pattern:patternFor(0),slots:SOUNDS.slice(0,8).map(s=>({sound:s.id,name:s.name,gain:s.kind==='VOICE'?.8:.7,pitch:0,start:0,end:1,reverse:false,mute:false,data:null}))};}
const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateProject(p){
 if(!p||p.version!==1||typeof p.name!=='string'||p.name.length>60||!num(p.bpm,60,180)||!num(p.swing,0,.45)||!num(p.volume,0,1)||!num(p.filter,200,20000)||!num(p.delay,0,.6))throw Error('This is not a supported sampler project.');
 if(!Array.isArray(p.pattern)||p.pattern.length!==8||p.pattern.some(r=>!Array.isArray(r)||![16,64].includes(r.length)||r.length!==p.pattern[0].length||r.some(v=>typeof v!=='boolean')))throw Error('The project pattern is invalid.');
 if(!Array.isArray(p.slots)||p.slots.length!==8)throw Error('The project needs eight pads.');
 for(const s of p.slots){if(!SOUNDS.some(x=>x.id===s.sound)||typeof s.name!=='string'||s.name.length>60||!num(s.gain,0,1)||!num(s.pitch,-24,24)||!num(s.start,0,.99)||!num(s.end,.01,1)||s.end-s.start<.009||typeof s.reverse!=='boolean'||typeof s.mute!=='boolean'||(s.data!==null&&(typeof s.data!=='string'||s.data.length>12e6||!/^data:audio\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(s.data))))throw Error('A pad contains invalid sample settings.');}
 return p;
}
export const stepTime=(step,bpm,swing)=>step*60/bpm/4+(step%2?swing*60/bpm/4:0);
export function wavBytes(buffer){
 const n=buffer.length,channels=buffer.numberOfChannels,a=new ArrayBuffer(44+n*channels*2),v=new DataView(a);
 const str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));
 str(0,'RIFF');v.setUint32(4,a.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*channels*2,true);v.setUint16(32,channels*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*channels*2,true);
 const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));for(let i=0;i<n;i++)for(let c=0;c<channels;c++){let x=Math.max(-1,Math.min(1,data[c][i]));v.setInt16(44+(i*channels+c)*2,x<0?x*32768:x*32767,true);}return a;
}
export async function persist(project,read=false){
 const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('linkedinbeats-sampler',1);req.onupgradeneeded=()=>req.result.createObjectStore('projects');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
 try{return await new Promise((resolve,reject)=>{const tx=db.transaction('projects',read?'readonly':'readwrite');const st=tx.objectStore('projects');const req=read?st.get('current'):st.put(project,'current');tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}
