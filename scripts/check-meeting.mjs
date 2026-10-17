import assert from 'node:assert/strict';
import {readFile,access,mkdir,writeFile,unlink} from 'node:fs/promises';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {renderToString} from 'react-dom/server';
import React from 'react';
import {activeParticipant,directedSpotlight,PARTICIPANTS} from '../src/meeting-studio/room.js';

const bundle=await build({entryPoints:['src/studio-2/remix-engine.js'],bundle:true,format:'esm',platform:'node',write:false});
const {createRemixEngine,TRACKS}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
class Param{constructor(value=0){this.value=value;}cancelScheduledValues(){}setTargetAtTime(v){this.value=v;}}
class Node{constructor(){this.gain=new Param();this.connections=[];}connect(n){this.connections.push(n);}disconnect(){}}
class Context{
  constructor(){this.currentTime=0;this.destination=new Node();this.sources=[];this.state='suspended';}
  createGain(){return new Node();}
  createDynamicsCompressor(){const n=new Node();for(const k of ['threshold','knee','ratio','attack','release'])n[k]=new Param();return n;}
  createAnalyser(){const n=new Node();n.frequencyBinCount=64;n.getByteFrequencyData=a=>a.fill(64);return n;}
  createBufferSource(){const n=new Node();n.start=()=>{};n.stop=()=>{};this.sources.push(n);return n;}
  async decodeAudioData(){return{};}async resume(){this.state='running';}async suspend(){this.state='suspended';}async close(){this.state='closed';}
}
const context=new Context();let requests=0;
const engine=createRemixEngine({contextFactory:()=>context,fetchImpl:async()=>{requests++;return{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};},setTimer:()=>1,clearTimer:()=>{}});
engine.participant('keys');engine.participant('vocals');assert.equal(requests,0,'editing a mix must not start audio or fetch media');
await engine.toggle();
const music=context.sources.filter(n=>n.loop);
assert.equal(music.length,4);
const [drums,bass,keys,lift]=music.map(source=>source.connections[0]);
const voices=context.sources.filter(n=>!n.loop),voiceBus=voices[0].connections[0].connections[0];
assert.equal(keys.gain.value,0);assert.equal(lift.gain.value,0);assert.equal(voiceBus.gain.value,0);assert(drums.gain.value>0&&bass.gain.value>0);
const sourceCount=context.sources.length;
engine.participant('keys');assert(keys.gain.value>0&&lift.gain.value>0);assert.equal(context.sources.length,sourceCount,'unmuting must retain phase and sources');
engine.participant('drums');engine.participant('bass');engine.participant('keys');
assert([drums,bass,keys,lift,voiceBus].every(n=>n.gain.value===0),'all four participants can be silenced independently');
engine.setting('energy',2);assert([drums,bass,keys,lift,voiceBus].every(n=>n.gain.value===0),'energy changes must preserve mutes');
await engine.select(3);assert(Object.values(engine.getState().muted).every(Boolean),'mutes persist into another song');
await engine.toggle();engine.seek(20);await engine.toggle();assert(Object.values(engine.getState().muted).every(Boolean),'mutes persist through pause and seek');
engine.reset();assert(Object.values(engine.getState().muted).every(m=>!m));assert([drums,bass,keys,lift,voiceBus].every(n=>n.gain.value>0),'reset restores all instruments and vocals');
engine.participant('not-a-part');assert.equal(Object.keys(engine.getState().muted).length,4);
let state={...engine.getState(),playing:true,volume:.8,speaking:true};
assert.equal(activeParticipant(state,TRACKS[3]),'vocals');
state={...state,muted:{drums:true,keys:true,vocals:true,bass:true}};assert.equal(activeParticipant(state,TRACKS[3]),null);
state={...state,muted:{...state.muted,bass:false}};assert.equal(activeParticipant(state,TRACKS[3]),'bass');
assert.equal(directedSpotlight({...state,elapsed:0},TRACKS[3]),null);
assert.equal(directedSpotlight({...state,elapsed:8*240/TRACKS[3].bpm+.1},TRACKS[3]),'bass');
engine.dispose();assert.equal(context.state,'closed');

// Exercise the first-render component tree, real assets and link/control contracts.
globalThis.window={location:{search:''},matchMedia:()=>({matches:false})};
const temp='node_modules/.cache/check-meeting-render.mjs';await mkdir('node_modules/.cache',{recursive:true});
const ui=await build({entryPoints:['src/meeting-studio/MeetingStudio.jsx'],bundle:true,format:'esm',platform:'node',packages:'external',write:false});
await writeFile(temp,ui.outputFiles[0].text);
try{
  const {MeetingStudio}=await import(pathToFileURL(process.cwd()+'/'+temp));
  const html=renderToString(React.createElement(MeetingStudio));
  assert.equal((html.match(/class="meeting-tile(?: |")/g)||[]).length,4);
  assert.equal((html.match(/aria-label="Play the meeting"/g)||[]).length,5);
  assert.equal((html.match(/aria-label="Mute [^"]+: /g)||[]).length,4);
  const escaped=text=>text.replaceAll('&','&amp;').replaceAll("'",'&#x27;');
  for(const person of PARTICIPANTS){assert(html.includes(escaped(person.name)));if(person.media)for(const ext of ['webp','mp4'])await access(`public/studio/meeting/${person.media}.${ext}`);}
  assert(!/<video[^>]* src=/.test(html),'video downloads wait for play');
  assert(!/<video[^>]*autoPlay/i.test(html));
  for(const track of TRACKS)assert(html.includes(escaped(track.title)));
  assert(html.includes('Connecting to audio…'));assert(html.includes('role="status"'));assert(html.includes('aria-label="Master volume"'));
  const route=await readFile('src/studio-main.jsx','utf8');assert(route.includes('meeting-studio/main.jsx'));
}finally{await unlink(temp);delete globalThis.window;}
console.log('Meeting studio passed: real per-part mute routing, phase-safe unmute, persistent mix, reset, speaker direction, four participants, six songs, media assets, no autoplay, and canonical route.');
