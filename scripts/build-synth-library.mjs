// Index current approved/validated takes and isolated cues without recasting voices.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {buildLibrary,productionTake} from '../src/meeting-room/voice-bank/library.js';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,root)));
const bank=buildLibrary(),recordings=read('public/studio/voices/recordings.json'),season=read('src/meeting-room/audio-manifest.json'),guitar=read('src/meeting-room/guitar-fills.json');
const names={synergy:'Synergy',synthia:'Synthia',people:'People & Culture',strategy:'Strategy',guitar:'Kevin',keys:'Keys',operations:'Operations',accountant:'Arjun',linda:'Linda'};
const sounds=[];
for(const line of bank.lines){
 const profile=bank.characters[line.character];let entry;
 if(profile.kind==='human'){
  const take=productionTake(line,profile,recordings.takes,recordings.rendererByCharacter[line.character]);
  entry={url:'/studio/voices/'+take.file,duration:take.duration};
 }else{
  // Chorus mixes cannot be separated honestly. Only index clean solo speech.
  for(const meeting of Object.values(season.meetings)){
   const cue=meeting.cues.find(c=>c.speaker===line.character&&c.text.normalize('NFC').trim()===line.text&&c.sources?.length===1);
   if(cue){entry={url:'/studio/season/audio/'+meeting.voice,offset:cue.start,duration:cue.duration};break;}
  }
 }
 if(entry)sounds.push({id:'voice-'+line.id,name:(names[line.character]+' · '+line.text).slice(0,60),text:line.text,group:names[line.character],character:line.character,kind:'VOICE',...entry});
}
for(const [i,part] of guitar.variants.entries())sounds.push({id:'guitar-fill-'+(i+1),name:'Guitar · Fill '+(i+1),text:'Guitar fill '+(i+1),group:'Guitar',kind:'GUITAR',url:'/studio/season/audio/'+guitar.file,offset:part.offset,duration:part.duration,bpm:guitar.bpm,key:guitar.key});
sounds.push({id:'guitar-full',name:'Guitar · All three fills',text:'All three fills',group:'Guitar',kind:'GUITAR',url:'/studio/season/audio/'+guitar.file,duration:guitar.variants.reduce((n,p)=>n+p.duration,0),bpm:guitar.bpm,key:guitar.key});
for(const s of sounds){if(!existsSync(new URL('public'+s.url,root)))throw Error('Missing audio: '+s.url);if(!s.duration||s.duration>30)throw Error('Invalid duration: '+s.id);}
writeFileSync(new URL('src/synth/sound-library.json',root),JSON.stringify(sounds,null,2)+'\n');
console.log(`${sounds.length} sounds indexed:`,Object.fromEntries(Object.values(names).concat('Guitar').map(name=>[name,sounds.filter(s=>s.group===name).length])));
