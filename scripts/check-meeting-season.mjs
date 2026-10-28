import assert from 'node:assert/strict';
import {access,mkdir,writeFile,unlink,readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createMeetingEngine as createBrowserMeetingEngine} from '../src/meeting-room/engine.js';
const createMeetingEngine=options=>createBrowserMeetingEngine({audioSessionFactory:context=>({resume:()=>context.resume(),pause(){},dispose(){}}),...options});
import {PRINT_CYCLE,printerPhase,paperRow} from '../src/meeting-room/printer-paper.js';
import {exactPerformance,performanceForTime,performanceTime,syncPerformanceVideo} from '../src/meeting-room/performances.js';

const bundle=await build({entryPoints:['src/meeting-room/catalog.js'],bundle:true,platform:'node',format:'esm',write:false});
const {meetings,cast,meetingSequence,meetingFromSearch,nextMeeting,cueAt,isSpeaker,cueLevel}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
assert.equal(meetingFromSearch('?meeting=onboarding-0').id,'onboarding-0');
assert.equal(meetingFromSearch('?meeting=not-a-meeting').id,'standup-0');
assert.equal(Object.keys(meetings).length,7);
let total=0;
for(const [agenda,variants] of Object.entries(meetings)){
  assert.equal(variants.length,2);
  for(const m of variants){
    total++;assert([3,5,9,12].includes(m.roster.length));assert.equal(new Set(m.roster).size,m.roster.length);
    assert.equal(m.cues.length,m.id==='offline-0'?10:9);assert.equal(m.cues.length,m.lines.length);
    let end=0;
    for(const [i,cue] of m.cues.entries()){
      assert.deepEqual([cue.speaker,cue.text],m.lines[i]);assert(cue.start>end);assert(cue.duration>0);
      assert(cue.level.length>0);assert(cue.speaker==='all'||m.roster.includes(cue.speaker));
      assert(!cast[cue.speaker]?.silent);end=cue.start+cue.duration;
      assert.equal(cueAt(m,cue.start+.01),cue);assert(!isSpeaker('printer',cue));assert(!isSpeaker('droid',cue));
      assert(cue.level.every(level=>level>=0&&level<=100));
    }
    assert(end<m.duration);assert(m.duration<60);assert.equal(cueAt(m,0),null);
    await access(`public/studio/season/audio/${m.voice}`);await access(`public/studio/season/audio/${m.bed}`);
    for(const id of m.roster){
      const c=cast[id];if(c.offline)continue;
      if(id==='droid'){await access('public/studio/season/posters/droid.jpeg');continue;}
      const states=c.robot?['listening']:id==='printer'?['printing']:c.instrument?['listening','speaking','playing']:['listening','speaking'];
      for(const state of states)for(const [directory,extension] of [['clips','mp4'],['posters','jpg']])await access(`public/studio/season/${directory}/${c.media}-${state}.${extension}`);
    }
  }
}
assert.equal(total,14);
const pilotCue=meetings.standup[0].cues[2],pilot=exactPerformance('guitar',pilotCue);
assert(pilot,'Kevin has a performance for the approved new-folder take');
await access(`public${pilot.video}`);
assert.equal(exactPerformance('keys',pilotCue),null,'Never assign another person’s facial performance');
assert.equal(exactPerformance('guitar',{...pilotCue,sources:[{...pilotCue.sources[0],masterSha256:'changed'}]}),null,'A revised voice master invalidates the performance');
assert.equal(exactPerformance('guitar',{...pilotCue,sources:[{...pilotCue.sources[0],take:'different'}]}),null,'Matching text alone cannot select a clip');
assert.equal(performanceForTime('guitar',meetings.standup[0],0).current,false,'Preload the upcoming line without playing it');
assert.equal(performanceForTime('guitar',meetings.standup[0],pilotCue.start+.5).current,true);
assert.equal(performanceForTime('guitar',meetings.standup[0],pilotCue.start+pilotCue.duration+.01).current,false,'Preload the next sentence, never loop the completed one');
assert.equal(performanceTime(pilot,pilotCue,0),0);
assert(Math.abs(performanceTime(pilot,pilotCue,pilotCue.start+.5)-.5)<1e-9,'Seek follows the same voice clock');
assert.equal(performanceTime(pilot,pilotCue,999),pilot.duration);
const completeMeeting=meetings.standup[0],hook=completeMeeting.cues[7];
for(const id of ['guitar','keys','operations']){
  for(const cue of completeMeeting.cues.filter(cue=>cue.speaker===id||cue.speaker==='all')){
    const performance=exactPerformance(id,cue);
    assert(performance,`${id}: every solo and chorus in the first meeting has exact footage`);
    await access(`public${performance.video}`);
    assert(Math.abs(performance.duration-cue.duration)<.0001);
    assert.equal(performanceTime(performance,cue,cue.start),performance.offset);
    assert(Math.abs(performanceTime(performance,cue,cue.start+.4)-(performance.offset+.4))<1e-9);
    assert.equal(performanceTime(performance,cue,999),performance.offset+performance.duration,'Clamp to the selected segment, including its source offset');
  }
  const groupPerformance=performanceForTime(id,completeMeeting,hook.start+.4);
  assert(groupPerformance.current&&groupPerformance.cue===hook,'Each singer runs their own synchronized chorus');
  assert.equal(performanceForTime(id,completeMeeting,hook.start+hook.duration+.01),null);
  assert.equal(exactPerformance(id,{...hook,duration:hook.duration+.2}),null,'Different chorus spacing invalidates the footage');
  const sources=structuredClone(hook.sources);sources[0].masterSha256='new-master';
  assert.equal(exactPerformance(id,{...hook,sources}),null,'Any changed chorus voice invalidates the beat-aligned performance');
}
assert.equal(exactPerformance('synergy',hook),null,'Synergy retains his approved screen animation');
assert.equal(exactPerformance('printer',hook),null,'Printer never sings');
const onboarding=meetings.onboarding[0];
for(const id of ['people','strategy','keys','guitar','operations']){
  for(const cue of onboarding.cues.filter(c=>c.speaker===id||c.speaker==='all')){
    const performance=exactPerformance(id,cue);
    assert(performance,`${id}: exact onboarding solo and chorus coverage`);
    await access(`public${performance.video}`);
    assert(Math.abs(performance.duration-cue.duration)<.0001);
    assert(Math.abs(performanceTime(performance,cue,cue.start+.4)-performance.offset-.4)<1e-9);
  }
  const altered=structuredClone(onboarding.cues[7]);altered.sources[2].pitch=1.2;
  assert.equal(exactPerformance(id,altered),null,'A changed robot chorus voice also changes human timing');
}
const lastHuman=onboarding.cues[8];
assert.equal(performanceForTime('people',onboarding,34).cue,lastHuman,'Return from chorus to the closing People & Culture line');
assert.equal(exactPerformance('synergy',onboarding.cues[7]),null);
assert.equal(exactPerformance('synthia',onboarding.cues[7]),null);
const unlock=meetings.unlock[0];
assert.equal(meetingFromSearch('?meeting=unlock-0').id,unlock.id);
assert.equal(nextMeeting(onboarding.id).id,unlock.id);
for(const id of ['people','strategy','keys','guitar','operations','accountant','linda']){
  for(const cue of unlock.cues.filter(c=>c.speaker===id||c.speaker==='all')){
    const performance=exactPerformance(id,cue);
    assert(performance,`${id}: exact unlock solo and isolated chorus coverage`);
    await access(`public${performance.video}`);
    assert(Math.abs(performance.duration-cue.duration)<.0001);
    assert(Math.abs(performanceTime(performance,cue,cue.start+.4)-performance.offset-.4)<1e-9);
  }
  const altered=structuredClone(unlock.cues[7]);altered.sources[0].masterSha256='changed';
  assert.equal(exactPerformance(id,altered),null,'A revised cast recording invalidates the unlock chorus');
}
assert.equal(performanceForTime('linda',unlock,34).cue,unlock.cues[8],'Linda returns from the chorus to her closing question');
assert.equal(performanceForTime('people',unlock,0).current,false,'Chorus-only singers preload without silently talking');
for(const id of ['synergy','synthia','printer','droid'])assert.equal(exactPerformance(id,unlock.cues[7]),null);
const paperless=meetings.paperless[0],duet=paperless.cues[7];
assert.equal(nextMeeting(unlock.id).id,paperless.id);
assert.equal(meetingFromSearch('?meeting=paperless-0').id,paperless.id);
assert.deepEqual(paperless.roster,['synergy','synthia','printer']);
assert.deepEqual(Object.keys(duet.speakerLevels).sort(),['synergy','synthia']);
assert.notDeepEqual(duet.speakerLevels.synergy,duet.speakerLevels.synthia,'Robot duet follows each distinct recording');
for(const id of ['synergy','synthia']){
  assert.equal(duet.speakerLevels[id].length,Math.ceil(duet.duration*25));
  assert(duet.speakerLevels[id].every(level=>Number.isInteger(level)&&level>=0&&level<=100));
  duet.speakerLevels[id].forEach((level,i)=>assert.equal(cueLevel(duet,duet.start+(i+.1)/25,id),level/100));
  assert.equal(cueLevel(duet,duet.start-.01,id),0);
  assert.equal(cueLevel(duet,duet.start+duet.duration,id),0);
}
assert.equal(cueLevel(duet,duet.start+.8,'printer'),0,'Printer never gets a vocal display');
assert.equal(cueLevel(paperless.cues[0],paperless.cues[0].start+.8,'synthia'),0,'Listening robot does not borrow the host voice');
assert.equal(cueLevel(paperless.cues[0],paperless.cues[0].start+.8,'synergy'),cueLevel(paperless.cues[0],paperless.cues[0].start+.8),'Solo mouth retains its approved envelope');
const founder=meetings.founder[0],fill=founder.interludes[0];
assert.equal(founder.cues.at(-1).text,'My mother asked what we sell. I sent her the headline.');
assert.equal(fill.character,'guitar');
assert(Math.abs(fill.duration-240/founder.bpm)<.0001,'The interruption is one musical bar');
assert(founder.cues.every(c=>c.start+c.duration<=fill.start||c.start>=fill.start+fill.duration),'Guitar fill never obscures dialogue');
assert.equal(founder.guitarFills.variants.length,3);
await access(`public/studio/season/audio/${founder.guitarFills.file}`);
await access('public/studio/season/clips/keys-detail.mp4');
await access('public/studio/season/posters/keys-detail.jpg');
const offline=meetings.offline[0],offlineHook=offline.cues[7];
assert.equal(nextMeeting(founder.id).id,offline.id);
assert.equal(meetingFromSearch('?meeting=offline-0').id,offline.id);
assert.equal(offline.roster.length,9);
for(const id of ['strategy','guitar','keys','people','accountant']){
  for(const cue of offline.cues.filter(c=>c.speaker===id||c.speaker==='all')){
    const performance=exactPerformance(id,cue);
    assert(performance,`${id}: exact offline solo and isolated chorus coverage`);
    await access(`public${performance.video}`);
    assert(Math.abs(performance.duration-cue.duration)<.0001);
    assert(Math.abs(performanceTime(performance,cue,cue.start+.4)-performance.offset-.4)<1e-9);
  }
  const altered=structuredClone(offlineHook);altered.sources[0].masterSha256='changed';
  assert.equal(exactPerformance(id,altered),null,'Changing any offline chorus source invalidates its performance');
  assert.equal(exactPerformance(id,{...offlineHook,duration:offlineHook.duration+.1}),null);
}
const arjunClosing=offline.cues[8];
assert.equal(performanceForTime('accountant',offline,arjunClosing.start+.4).cue,arjunClosing);
assert(exactPerformance('accountant',arjunClosing).offset<exactPerformance('accountant',offlineHook).offset,'Arjun seeks back to his source solo after the chorus');
assert.equal(arjunClosing.text,'Same link. Same time. Same people.');
assert.equal(performanceForTime('accountant',offline,arjunClosing.start+arjunClosing.duration+.01).cue,offline.cues[9]);
const sharedClosing=offline.cues[9];
assert.deepEqual(sharedClosing.speakers,['accountant','synthia']);
assert(isSpeaker('accountant',sharedClosing)&&isSpeaker('synthia',sharedClosing));
assert(!isSpeaker('synergy',sharedClosing)&&!isSpeaker('people',sharedClosing));
assert.notDeepEqual(sharedClosing.speakerLevels.accountant,sharedClosing.speakerLevels.synthia);
assert.equal(exactPerformance('synthia',sharedClosing),null);
assert(exactPerformance('accountant',sharedClosing));
assert.equal(performanceForTime('accountant',offline,sharedClosing.start+sharedClosing.duration+.01),null);
const quarterly=meetings.quarterly[0],quarterlyHook=quarterly.cues[7];
assert.equal(nextMeeting(offline.id).id,quarterly.id);
assert.equal(quarterly.roster.length,12);
for(const id of ['people','strategy','guitar','keys','operations','accountant','linda']){
  for(const cue of quarterly.cues.filter(c=>c.speaker===id||c.speaker==='all')){
    const performance=exactPerformance(id,cue);
    assert(performance,`${id}: exact quarterly solo/chorus coverage`);
    await access(`public${performance.video}`);
    assert(Math.abs(performance.duration-cue.duration)<.0001);
    assert(Math.abs(performanceTime(performance,cue,cue.start+.4)-performance.offset-.4)<1e-9);
  }
  const altered=structuredClone(quarterlyHook);altered.sources[0].masterSha256='changed';
  assert.equal(exactPerformance(id,altered),null);
  assert.equal(exactPerformance(id,{...quarterlyHook,duration:quarterlyHook.duration+.1}),null);
}
assert.equal(performanceForTime('people',quarterly,0).current,false);
assert.equal(performanceForTime('linda',quarterly,quarterly.cues[8].start+.3).cue,quarterly.cues[8]);
assert.notDeepEqual(quarterlyHook.speakerLevels.synergy,quarterlyHook.speakerLevels.synthia);
for(const id of ['synergy','synthia','printer','pat'])assert.equal(exactPerformance(id,offlineHook),null);
assert.notDeepEqual(offlineHook.speakerLevels.synergy,offlineHook.speakerLevels.synthia);
for(const id of ['synergy','synthia']){
  assert.equal(offlineHook.speakerLevels[id].length,Math.ceil(offlineHook.duration*25));
  offlineHook.speakerLevels[id].forEach((level,i)=>assert.equal(cueLevel(offlineHook,offlineHook.start+(i+.1)/25,id),level/100));
}
let seeks=0,mediaTime=0;
const media={readyState:0,duration:NaN,paused:true,ended:false,
  get currentTime(){return mediaTime;},set currentTime(value){assert(Number.isFinite(value));seeks++;mediaTime=value;},
  play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
assert.equal(syncPerformanceVideo(media,3.8,true,()=>{}),false,'A source swap with stale ready state waits for real metadata');
assert.equal(seeks,0,'Never assign NaN to a media clock');
media.readyState=4;media.duration=10;
assert(syncPerformanceVideo(media,3.8,false,()=>{}));assert.equal(media.currentTime,3.8);
const parkedSeeks=seeks;syncPerformanceVideo(media,3.8,false,()=>{});assert.equal(seeks,parkedSeeks,'Do not repeatedly seek a parked chorus clip');
syncPerformanceVideo(media,4.2,true,()=>{});assert.equal(media.paused,false);assert.equal(media.currentTime,4.2);
syncPerformanceVideo(media,4.25,false,()=>{});assert.equal(media.paused,true);assert.equal(media.currentTime,4.25);
media.duration=NaN;assert.equal(syncPerformanceVideo(media,5,true,()=>{}),false);
media.duration=10;media.readyState=1;
assert.equal(syncPerformanceVideo(media,5.5636,false,()=>{}),false,'Seek in flight waits for a decoded frame');
media.readyState=4;
syncPerformanceVideo(media,5.5636,false,()=>{});
assert.equal(media.currentTime,5.5636,'Media-ready events retry the latest paused timestamp after a rapid seek');
const performanceComponent=await readFile('src/meeting-room/SpeechPerformance.jsx','utf8');
assert(performanceComponent.includes('onCanPlay={synchronize}')&&performanceComponent.includes('onSeeked={synchronize}'),'Paused rapid seeks re-synchronize after media readiness, without needing another audio tick');
let current=meetingSequence[0];const visited=new Set();
for(let i=0;i<14;i++){
  assert(!visited.has(current.id),'Every meeting gets a turn before repeating');visited.add(current.id);
  const next=nextMeeting(current.id);assert.notEqual(next.agenda,current.agenda);current=next;
}
assert.equal(current.id,meetingSequence[0].id,'The sequence wraps after all 14 meetings');
await access('public/studio/season/posters/printer-neutral.jpg');
for(let cycle=0;cycle<16;cycle++){
  const mid=printerPhase(cycle*PRINT_CYCLE+1.8);
  assert.equal(mid.completed,cycle);assert(mid.feed>0&&mid.feed<1,'Printer continues feeding beyond the first four seconds');
  const before=printerPhase((cycle+1)*PRINT_CYCLE-.001),after=printerPhase((cycle+1)*PRINT_CYCLE+.001);
  assert.equal(after.completed,before.completed+1,'Printed pages remain in the output stack');
  assert.equal(before.settle,1,'Every sheet lands before the next begins');
}
assert.deepEqual(printerPhase(-1),printerPhase(0));
const landed=paperRow(1,1,1,5);assert(landed.every(p=>p.every(Number.isFinite)));

class Param{constructor(value=0){this.value=value;this.events=[];}setTargetAtTime(value,time){this.value=value;this.events.push([value,time]);}cancelScheduledValues(){}}
class Node{constructor(){this.gain=new Param();this.connections=[];}connect(node){this.connections.push(node);}disconnect(){this.disconnected=true;}}
class Context{
  constructor(){this.currentTime=0;this.destination=new Node();this.state='suspended';this.sources=[];this.nodes=[];}
  createGain(){const n=new Node();this.nodes.push(n);return n;}
  createDynamicsCompressor(){const n=new Node();for(const key of ['threshold','knee','ratio','attack','release'])n[key]=new Param();return n;}
  createBufferSource(){const n=new Node();n.start=(...args)=>n.started=args;n.stop=()=>{n.stopped=true;};this.sources.push(n);return n;}
  async resume(){this.state='running';}async close(){this.state='closed';}
  async decodeAudioData(){return {duration:50};}
}
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
const ctx=new Context();let requests=0;
const e=createMeetingEngine({contextFactory:()=>ctx,fetcher:async()=>{requests++;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};}});
e.setMeeting(meetings.standup[0]);assert.equal(requests,0,'No audio download before a gesture');
await e.play();assert(e.snapshot().playing);assert.equal(requests,2);
assert.equal(ctx.sources[0].started[0],ctx.sources[1].started[0],'Voice and beat share the clock');
ctx.currentTime=8.05;assert.equal(e.elapsed(),8);
const count=ctx.sources.length;e.setMix({voices:.7,music:.5,muted:true});
assert.equal(ctx.sources.length,count,'Mix and mute must not restart sources or lose phase');
e.pause();assert.equal(e.elapsed(),8);assert(!e.snapshot().playing);
await e.play();assert.equal(ctx.sources.at(-2).started[1],8);assert.equal(requests,2,'Resume reuses decoded audio');
e.seek(20);await flush();assert.equal(ctx.sources.at(-2).started[1],20);
e.seek(999);await flush();assert(!e.snapshot().playing,'Seeking to the end does not restart');
e.setMeeting(meetings.paperless[0]);assert.equal(e.snapshot().muted,true,'Mute persists between meetings');
await e.play();ctx.sources.at(-2).onended();assert.equal(e.elapsed(),meetings.paperless[0].duration);assert(!e.snapshot().playing);
e.dispose();assert.equal(ctx.state,'closed');

// One randomized fill per meeting load; resume/seek must retain that choice.
const riffContext=new Context();let riffRequests=0,randomCalls=0;
const riffEngine=createMeetingEngine({contextFactory:()=>riffContext,random:()=>{randomCalls++;return .7;},fetcher:async()=>{riffRequests++;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};}});
riffEngine.setMeeting(founder);assert.equal(riffRequests,0);
await riffEngine.play();assert.equal(riffRequests,3);assert.equal(randomCalls,1);
const firstRiff=riffContext.sources[2],selectedFill=founder.guitarFills.variants[2];
assert.equal(firstRiff.started[0],.05+fill.start);
assert.equal(firstRiff.started[1],selectedFill.offset);
assert.equal(firstRiff.started[2],Math.min(fill.duration,selectedFill.duration));
assert.equal(firstRiff.connections[0],riffContext.sources[1].connections[0],'Riff obeys the music mix');
const beforeMix=riffContext.sources.length;riffEngine.setMix({music:.2});assert.equal(riffContext.sources.length,beforeMix);
riffEngine.seek(fill.start+.8);await flush();
const resumedRiff=riffContext.sources.at(-1);
assert(Math.abs(resumedRiff.started[1]-selectedFill.offset-.8)<1e-8,'Seek resumes inside the selected phrase');
assert(Math.abs(resumedRiff.started[2]-selectedFill.duration+.8)<1e-8);
assert(firstRiff.stopped&&firstRiff.disconnected);
riffEngine.pause();assert(resumedRiff.stopped);await riffEngine.play();
assert.equal(randomCalls,1);assert.equal(riffRequests,3,'Resuming retains cached audio and the chosen riff');
const beforeSeek=riffContext.sources.length;riffEngine.seek(fill.start+fill.duration+.1);await flush();
assert.equal(riffContext.sources.length,beforeSeek+2,'A completed riff is not replayed');
riffEngine.dispose();

// A slow previous meeting must not start after the user changes the agenda.
const resolvers=[];const delayed=createMeetingEngine({contextFactory:()=>new Context(),fetcher:()=>new Promise(resolve=>{resolvers.push(resolve);})});
delayed.setMeeting(meetings.standup[0]);const pending=delayed.play();await flush();delayed.setMeeting(meetings.founder[0]);
resolvers.forEach(resolve=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}));await pending;await flush();assert(!delayed.snapshot().playing);assert(!delayed.snapshot().loading);delayed.dispose();
const bad=createMeetingEngine({contextFactory:()=>new Context(),fetcher:async()=>({ok:false})});bad.setMeeting(meetings.standup[0]);await bad.play();assert(bad.snapshot().error);assert(!bad.snapshot().loading);bad.dispose();

await mkdir('node_modules/.cache',{recursive:true});
const temp='node_modules/.cache/check-meeting-season-render.mjs';
const ui=await build({stdin:{contents:"export {default as Room} from './src/meeting-room/MeetingRoom.jsx';export {drawRobotMouth,robotFrame} from './src/meeting-room/Participant.jsx';",resolveDir:process.cwd(),loader:'jsx'},bundle:true,format:'esm',platform:'node',packages:'external',loader:{'.css':'empty'},write:false});
await writeFile(temp,ui.outputFiles[0].text);
try{
  const {Room,drawRobotMouth,robotFrame}=await import(pathToFileURL(`${process.cwd()}/${temp}`));
  const html=renderToString(React.createElement(Room));
  assert.equal((html.match(/data-character=/g)||[]).length,5);
  assert.equal((html.match(/class="mr-meeting-card(?: is-current)?"/g)||[]).length,14);
  assert(html.includes('<details class="mr-agenda-disclosure" open="">'),'Agenda starts open with all meeting cards');
  assert(!html.includes('mr-racing')&&!html.includes('mr-room-head'),'No extra title or racing strip');
  assert(/mr-windowbar[\s\S]*?<h1>/.test(html),'Title belongs in the meeting window');
  assert(/mr-meeting-actions[\s\S]*?Next meeting[\s\S]*?Leave/.test(html),'Next meeting sits beside Leave');
  for(const text of ['The agenda','Next meeting','Play meeting','Captions','Seek meeting','Stop video','Leave','lb-header--dark','Read fine print','mr-printer-display','id="meetings"'])assert(html.includes(text),`Missing UI: ${text}`);
  assert(!/<video[^>]*\ssrc=/.test(html),'Video downloads wait for play');assert(!/autoPlay/.test(html));
  assert(!html.includes('getUserMedia'));
  const rects=[];const drawing={clearRect(){},save(){},restore(){},translate(){},rotate(){},scale(){},fillRect:(...args)=>rects.push(args)};
  for(const id of ['synergy','synthia']){
    for(const level of [0,.2,1]){rects.length=0;drawRobotMouth(drawing,id,4.1,12,level);assert.equal(rects.length,22);assert(rects.every(r=>r[3]===6),'Robot mouth height never expands and never has an opaque floating patch');}
    for(let time=0;time<(id==='synergy'?17:454/24);time+=.1){const [x,y,angle,scale]=robotFrame(id,time);assert(x>580&&x<720&&y>230&&y<300);assert(Math.abs(angle)<.2);assert(scale>.85&&scale<1.15);}
  }
}finally{await unlink(temp);}
const route=await readFile('src/studio-main.jsx','utf8');assert(route.includes('meeting-room/main.jsx'));
console.log('Meeting season passed: 14 coherent scripts, every media asset, audio-clock sync, seek/pause/end, phase-safe mix, muted persistence, stale-load cancellation, errors, lazy media, controls, and fixed-height tracked robot mouths.');
