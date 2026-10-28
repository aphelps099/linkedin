import {SOUNDS, stepTime, wavBytes} from './model.js';
import {vocalEchoes,playedDuration} from './dub.js';
import {createMobileAudio} from './mobile-audio.js';
function synthesized(ctx,id){
 const rate=ctx.sampleRate,duration={kick:.6,snare:.25,hat:.09,clap:.24,bass:.65,chord:1.3}[id];
 const b=ctx.createBuffer(1,Math.ceil(rate*duration),rate),d=b.getChannelData(0);let phase=0,seed=17;
 for(let i=0;i<d.length;i++){const t=i/rate;seed=(seed*1664525+1013904223)>>>0;const noise=seed/2147483648-1;
 if(id==='kick'){phase+=2*Math.PI*(45+125*Math.exp(-t*32))/rate;d[i]=Math.sin(phase)*Math.exp(-t*9);}
 if(id==='snare')d[i]=(noise*.7+Math.sin(2*Math.PI*180*t)*.3)*Math.exp(-t*20);
 if(id==='hat')d[i]=(noise*.65+Math.sin(2*Math.PI*8700*t)*.15)*Math.exp(-t*55);
 if(id==='clap')d[i]=noise*.65*Math.exp(-Math.max(0,t-.04)*27)*(t<.045?(Math.floor(t/.009)%2):1);
 if(id==='bass')d[i]=(Math.sin(2*Math.PI*65.406*t)*.7+Math.sin(2*Math.PI*130.812*t)*.2)*Math.min(1,t*200)*Math.exp(-t*5);
 if(id==='chord')d[i]=[261.63,311.13,392].reduce((a,f)=>a+Math.sin(2*Math.PI*f*t)+.2*Math.sin(2*Math.PI*f*2*t),0)/4*Math.min(1,t*35)*Math.exp(-t*3);
 d[i]*=Math.min(1,(d.length-i)/100);
 }return b;
}
export function graph(ctx,p){
 const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=p.filter;
 const master=ctx.createGain();master.gain.value=p.volume*.7;
 const dubFilter=ctx.createBiquadFilter();dubFilter.type='lowpass';dubFilter.frequency.value=2800;dubFilter.connect(master);
 const compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-8;compressor.ratio.value=8;
 const delay=ctx.createDelay(2),wet=ctx.createGain(),feedback=ctx.createGain();delay.delayTime.value=60/p.bpm*.75;wet.gain.value=p.delay;feedback.gain.value=.27;
 filter.connect(master);filter.connect(delay);delay.connect(wet);wet.connect(master);delay.connect(feedback);feedback.connect(delay);master.connect(compressor);compressor.connect(ctx.destination);
 return {input:filter,dubInput:dubFilter,update(q){filter.frequency.setTargetAtTime(q.filter,ctx.currentTime,.02);master.gain.setTargetAtTime(q.volume*.7,ctx.currentTime,.02);wet.gain.setTargetAtTime(q.delay,ctx.currentTime,.02);delay.delayTime.setTargetAtTime(60/q.bpm*.75,ctx.currentTime,.03);},disconnect(){[filter,dubFilter,master,compressor,delay,wet,feedback].forEach(n=>n.disconnect());}};
}
export function voice(ctx,bus,buffer,slot,when){
 const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.playbackRate.value=2**(slot.pitch/12);
 const offset=slot.start*buffer.duration,length=(slot.end-slot.start)*buffer.duration,duration=length/source.playbackRate.value;
 gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(slot.gain,when+Math.min(.004,duration/4));gain.gain.setValueAtTime(slot.gain,when+Math.max(duration-.008,duration/2));gain.gain.linearRampToValueAtTime(0,when+duration);
 source.connect(gain);gain.connect(bus.input);source.start(when,offset,length);source.onended=()=>{source.disconnect();gain.disconnect();};return source;
}
export class Sampler {
 constructor(){this.buffers=new Map();this.recordings=new Map();this.reversed=new WeakMap();this.sources=new Set();this.dubSources=new Set();this.timers=new Set();this.running=false;this.hitCounter=0;}
 async init(){if(!this.ctx){const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw Error('This browser cannot play the sampler. Open it in Safari or Chrome.');this.ctx=new AudioContext();this.mobileAudio=createMobileAudio(this.ctx);}await this.mobileAudio.resume();}
 async load(slot){const sound=SOUNDS.find(s=>s.id===slot.sound);if(slot.data!=null||!sound)throw Error('Choose a sound from the LinkedIn Beats library.');const key=slot.sound;if(this.buffers.has(key))return this.buffers.get(key);let b;
 if(sound.url){const url=sound.url;let raw=this.recordings.get(url);
 if(!raw){const response=await fetch(url);if(!response.ok)throw Error(`Could not load ${slot.name}. Try again.`);raw=await this.ctx.decodeAudioData(await response.arrayBuffer());
 this.recordings.set(url,raw);while(this.recordings.size>3)this.recordings.delete(this.recordings.keys().next().value);}
 if(sound.offset!==undefined){const from=Math.round(sound.offset*raw.sampleRate),length=Math.min(Math.round(sound.duration*raw.sampleRate),raw.length-from);if(length<=0)throw Error('This sample is unavailable.');b=this.ctx.createBuffer(raw.numberOfChannels,length,raw.sampleRate);for(let c=0;c<raw.numberOfChannels;c++)b.getChannelData(c).set(raw.getChannelData(c).subarray(from,from+length));}
 else b=raw;if(b.duration>30)throw Error('Use a sample shorter than 30 seconds.');}
 else b=synthesized(this.ctx,slot.sound);this.buffers.set(key,b);return b;}

 buffer(slot){let b=this.buffers.get(slot.sound);if(!b||!slot.reverse)return b;if(!this.reversed.has(b)){const reverse=this.ctx.createBuffer(b.numberOfChannels,b.length,b.sampleRate);for(let c=0;c<b.numberOfChannels;c++)reverse.getChannelData(c).set(b.getChannelData(c).slice().reverse());this.reversed.set(b,reverse);}return this.reversed.get(b);}
 async prepare(p,slots=p.slots){this.project=p;await this.init();await Promise.all(slots.map(s=>this.load(s)));if(!this.bus)this.bus=graph(this.ctx,p);this.bus.update(p);}
 hit(slot,when=this.ctx.currentTime,project=this.project,event=this.hitCounter++){
  const buffer=this.buffer(slot);if(!buffer)return;
  const track=(source,dub=false)=>{this.sources.add(source);if(dub)this.dubSources.add(source);source.addEventListener('ended',()=>{this.sources.delete(source);this.dubSources.delete(source);});return source;};
  const dry=track(voice(this.ctx,this.bus,buffer,slot,when));
  for(const echo of vocalEchoes(buffer.duration,slot,project,event))track(voice(this.ctx,{input:this.bus.dubInput},buffer,echo.slot,when+echo.after),true);
  return dry;
 }
 start(getProject,onStep){this.stop({keepSession:true});this.bus=graph(this.ctx,getProject());this.running=true;let step=0,time=this.ctx.currentTime+.06;
 const tick=()=>{if(!this.running)return;const p=getProject();this.bus.update(p);if(time<this.ctx.currentTime-.1)time=this.ctx.currentTime+.03;
 while(time<this.ctx.currentTime+.1){const at=step%p.pattern[0].length;p.slots.forEach((s,i)=>{if(p.pattern[i][at]&&!s.mute)this.hit(s,time,p,step*8+i);});const timer=setTimeout(()=>{this.timers.delete(timer);if(this.running)onStep(at);},Math.max(0,(time-this.ctx.currentTime)*1000));this.timers.add(timer);time+=60/p.bpm/4*(at%2?1-p.swing:1+p.swing);step++;}}
 tick();this.interval=setInterval(tick,25);}
 stopDub(){for(const source of this.dubSources){try{source.stop();}catch{}this.sources.delete(source);}this.dubSources.clear();}
 stop({keepSession=false}={}){this.running=false;if(!keepSession)this.mobileAudio?.pause();clearInterval(this.interval);for(const t of this.timers)clearTimeout(t);this.timers.clear();for(const s of this.sources){try{s.stop();}catch{}}this.sources.clear();this.dubSources.clear();if(this.bus){this.bus.disconnect();this.bus=null;}}
 async export(p){
  await this.prepare(p);const notes=[];
  for(let step=0;step<64;step++)p.slots.forEach((slot,i)=>{
   if(!p.pattern[i][step%p.pattern[0].length]||slot.mute)return;
   const buffer=this.buffer(slot),when=stepTime(step,p.bpm,p.swing);
   notes.push({buffer,slot,when,dub:false});
   for(const echo of vocalEchoes(buffer.duration,slot,p,step*8+i))notes.push({buffer,slot:echo.slot,when:when+echo.after,dub:true});
  });
  const end=Math.max(16*60/p.bpm,...notes.map(note=>note.when+playedDuration(note.buffer.duration,note.slot)))+4;
  const ctx=new OfflineAudioContext(2,Math.ceil(end*44100),44100),bus=graph(ctx,p);
  for(const note of notes)voice(ctx,note.dub?{input:bus.dubInput}:bus,note.buffer,note.slot,note.when);
  return new Blob([wavBytes(await ctx.startRendering())],{type:'audio/wav'});
 }
 close(){this.stop();this.mobileAudio?.dispose();this.ctx?.close();}
}
