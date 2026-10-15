import assert from 'node:assert/strict';
import {GROOVES,createGroove,grooveMidi} from '../src/studio/grooves.js';
import {bandAt} from '../src/song.js';
import {createAudioEngine} from '../src/audio.js';

// Parse the exported bytes independently: chunk boundaries, delta timing,
// track duration, channel routing, tempo and balanced note-on/off pairs.
function inspectMidi(bytes){
  const b=Buffer.from(bytes);assert.equal(b.toString('ascii',0,4),'MThd');
  assert.equal(b.readUInt32BE(4),6);assert.equal(b.readUInt16BE(8),1);
  assert.equal(b.readUInt16BE(10),5);assert.equal(b.readUInt16BE(12),480);
  let at=14;const tracks=[];
  for(let t=0;t<5;t++){
    assert.equal(b.toString('ascii',at,at+4),'MTrk');
    const end=at+8+b.readUInt32BE(at+4);let p=at+8,time=0,tempo=null,name='',notes=0,ended=false;const active=new Set(),channels=new Set();
    const vlq=()=>{let n=0,count=0,x;do{assert(p<end);x=b[p++];n=(n<<7)|(x&127);assert(++count<=4);}while(x&128);return n;};
    while(p<end){
      time+=vlq();const status=b[p++];
      if(status===255){const type=b[p++],len=vlq();assert(p+len<=end);if(type===3)name=b.toString('utf8',p,p+len);if(type===81)tempo=b.readUIntBE(p,3);if(type===47){assert.equal(len,0);ended=true;}p+=len;}
      else if((status&240)===192){assert(b[p++]<128);}
      else{assert([128,144].includes(status&240));const note=b[p++],vel=b[p++],ch=status&15,key=ch+':'+note;assert(note<128&&vel<128);channels.add(ch);if((status&240)===144&&vel){assert(!active.has(key),'overlapping identical notes');active.add(key);notes++;}else{assert(active.has(key),'orphan note-off');active.delete(key);}}
    }
    assert.equal(p,end);assert(ended);assert.equal(active.size,0);tracks.push({time,tempo,name,notes,channels});at=end;
  }
  assert.equal(at,b.length);return tracks;
}
const signatures=new Set();
for(const preset of GROOVES){
  const g=createGroove(preset.id,2);assert.equal(g.pattern.length,11);assert(g.pattern.every(r=>r.length===64));assert(g.pattern.slice(8).flat().every(n=>n===0));
  assert(g.song.setlist.every(n=>Number.isInteger(n)&&n>=0&&n<57));
  for(let energy=0;energy<3;energy++)for(let step=0;step<64;step++)for(const e of bandAt(g.song,step,energy)){assert(Number.isFinite(e.vel));if(e.freq)assert(Number.isFinite(e.freq)&&e.freq>0);if(e.freqs)assert(e.freqs.every(n=>Number.isFinite(n)&&n>0));}
  signatures.add(JSON.stringify([g.pattern.slice(0,8),g.song.bass,g.song.chords]));
  const tracks=inspectMidi(grooveMidi({song:g.song,pattern:g.pattern,tempo:g.bpm}));
  assert(tracks.every(t=>t.time===7680));assert.equal(tracks[0].tempo,Math.round(60e6/g.bpm));assert.deepEqual([...tracks[1].channels],[9]);assert(tracks.slice(1).every(t=>t.notes>0));
  g.pattern[0][0]=0;assert.equal(createGroove(preset.id).pattern[0][0],2,'preset is not mutated by an edit');
}
assert.equal(signatures.size,6);

// Use a small Web Audio graph double to verify that the new faders route the
// real synth/voice paths, leave default gains neutral, and feed the export bus.
const param=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
class Node{constructor(type){this.type=type;this.connections=[];for(const k of ['gain','frequency','Q','detune','playbackRate','delayTime','threshold','ratio','attack','release'])this[k]=param();}connect(n){this.connections.push(n);return n;}start(){}stop(){}disconnect(){}}
let context;
class Context{constructor(){context=this;this.sampleRate=1000;this.currentTime=0;this.state='running';this.destination=new Node('destination');this.gains=[];}
createGain(){const n=new Node('gain');this.gains.push(n);return n;}createBiquadFilter(){return new Node('filter');}createDynamicsCompressor(){return new Node('compressor');}createWaveShaper(){return new Node('waveshaper');}createOscillator(){return new Node('oscillator');}createDelay(){return new Node('delay');}createConvolver(){return new Node('convolver');}createBufferSource(){return new Node('source');}createBuffer(c,n,sr){const arrays=Array.from({length:c},()=>new Float32Array(n));return {duration:n/sr,sampleRate:sr,getChannelData:i=>arrays[i]};}createMediaStreamDestination(){this.stream=new Node('stream');this.stream.stream={getAudioTracks:()=>[]};return this.stream;}createAnalyser(){const n=new Node('analyser');n.frequencyBinCount=128;n.getByteFrequencyData=a=>a.fill(0);return n;}close(){return Promise.resolve();}}
globalThis.window={AudioContext:Context};const audio=createAudioEngine();audio.init();const [master,drums,bass,music,vox,samples]=context.gains;assert([drums,bass,music,vox,samples].every(n=>n.gain.value===1));
for(const [voice,bus] of [['kick',drums],['snare',drums],['bass',bass],['arp',music]]){const ix=context.gains.length;audio.trigger(voice,.5,0,{freq:110});assert.equal(context.gains[ix].connections[0],bus);}
const reaches=(from,to,seen=new Set())=>from===to||(!seen.has(from)&&Boolean(seen.add(from))&&from.connections.some(n=>reaches(n,to,seen)));
const buffer=context.createBuffer(1,1000,1000);
assert(reaches(audio.playBuffer(buffer,{bus:'vox'}).gain,vox));assert(reaches(audio.playBuffer(buffer).gain,samples));
assert(reaches(master,context.destination));assert(reaches(master,context.stream));
audio.setChannelGain('drums',0);assert.equal(drums.gain.value,0);assert.equal(bass.gain.value,1);audio.setChannelGain('drums',.65);assert.equal(drums.gain.value,.65);
audio.setChannelGain('vox',0);assert.equal(vox.gain.value,0);audio.setVolume(.5);assert.equal(master.gain.value,.425);
console.log('Studio checks passed: six distinct four-bar grooves, playable note ranges, MIDI format/tempo/channels/duration/balanced notes, isolated mixer buses, mute and shared export routing.');
