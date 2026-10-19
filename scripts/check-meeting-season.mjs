import assert from 'node:assert/strict';
import {access,mkdir,writeFile,unlink,readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {createMeetingEngine} from '../src/meeting-room/engine.js';
import {PRINT_CYCLE,printerPhase,paperRow} from '../src/meeting-room/printer-paper.js';

const bundle=await build({entryPoints:['src/meeting-room/catalog.js'],bundle:true,platform:'node',format:'esm',write:false});
const {meetings,cast,meetingSequence,nextMeeting,cueAt,isSpeaker}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
assert.equal(Object.keys(meetings).length,7);
let total=0;
for(const [agenda,variants] of Object.entries(meetings)){
  assert.equal(variants.length,2);
  for(const m of variants){
    total++;assert([3,5,9,12].includes(m.roster.length));assert.equal(new Set(m.roster).size,m.roster.length);
    assert.equal(m.cues.length,9);assert.equal(m.cues.length,m.lines.length);
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

// A slow previous meeting must not start after the user changes the agenda.
const resolvers=[];const delayed=createMeetingEngine({contextFactory:()=>new Context(),fetcher:()=>new Promise(resolve=>{resolvers.push(resolve);})});
delayed.setMeeting(meetings.standup[0]);const pending=delayed.play();await flush();delayed.setMeeting(meetings.founder[0]);
resolvers.forEach(resolve=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}));await pending;await flush();assert(!delayed.snapshot().playing);assert(!delayed.snapshot().loading);delayed.dispose();
const bad=createMeetingEngine({contextFactory:()=>new Context(),fetcher:async()=>({ok:false})});bad.setMeeting(meetings.standup[0]);await bad.play();assert(bad.snapshot().error);assert(!bad.snapshot().loading);bad.dispose();

await mkdir('node_modules/.cache',{recursive:true});
const temp='node_modules/.cache/check-meeting-season-render.mjs';
const ui=await build({stdin:{contents:"export {default as Room} from './src/meeting-room/MeetingRoom.jsx';export {drawRobotMouth,robotFrame} from './src/meeting-room/Participant.jsx';",resolveDir:process.cwd(),loader:'jsx'},bundle:true,format:'esm',platform:'node',packages:'external',write:false});
await writeFile(temp,ui.outputFiles[0].text);
try{
  const {Room,drawRobotMouth,robotFrame}=await import(pathToFileURL(`${process.cwd()}/${temp}`));
  const html=renderToString(React.createElement(Room));
  assert.equal((html.match(/data-character=/g)||[]).length,5);
  assert.equal((html.match(/<option /g)||[]).length,7);
  for(const text of ['Agenda','Next meeting','Play meeting','Captions','Seek meeting','Stop video','Leave','c2-header--dark','c2-footer--dark','The necessary small print','mr-printer-display'])assert(html.includes(text));
  assert(!/<video[^>]*\ssrc=/.test(html),'Video downloads wait for play');assert(!/autoPlay/.test(html));
  assert(!html.includes('getUserMedia'));
  const rects=[];const drawing={clearRect(){},save(){},restore(){},translate(){},rotate(){},scale(){},fillRect:(...args)=>rects.push(args)};
  for(const id of ['synergy','synthia']){
    for(const level of [0,.2,1]){rects.length=0;drawRobotMouth(drawing,id,4.1,12,level);assert.equal(rects.length,23);assert(rects.slice(1).every(r=>r[3]===4),'Robot mouth height never expands');}
    for(let time=0;time<9.5;time+=.1){const [x,y,angle,scale]=robotFrame(id,time);assert(x>580&&x<720&&y>230&&y<300);assert(Math.abs(angle)<.2);assert(scale>.85&&scale<1.15);}
  }
}finally{await unlink(temp);}
const route=await readFile('src/studio-main.jsx','utf8');assert(route.includes('meeting-room/main.jsx'));
console.log('Meeting season passed: 14 coherent scripts, every media asset, audio-clock sync, seek/pause/end, phase-safe mix, muted persistence, stale-load cancellation, errors, lazy media, controls, and fixed-height tracked robot mouths.');
