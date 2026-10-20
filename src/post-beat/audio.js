import {createAudioEngine} from '../audio.js';
import {bandAt} from '../song.js';
import {TRACKS,arrangement as homeArrangement,speechBounds,wordTimings} from '../home/tracks.js';
import {BPM,DURATION,arrangement,voiceLines} from './composition.js';
const rawCache=new Map();
export function makeTimedCues(recipe,buffers){
  const lines=voiceLines(recipe);
  return arrangement(recipe).map((event,id)=>{
    const buffer=buffers[event.clip],start=event.beat*60/BPM;
    const rate=Math.max(1,buffer.duration/(event.length*60/BPM-.08));
    const [from,to]=speechBounds(buffer);
    return {...event,...lines[event.clip],id,start,end:start+buffer.duration/rate,rate,words:wordTimings(lines[event.clip].text,start+from/rate,start+to/rate)};
  });
}
// Reuse the homepage band, voice effects, and original female recordings.
export function createPostBeat({engineFactory=createAudioEngine,interval=setInterval,clear=clearInterval,fetchImpl=fetch}={}){
  let engine=null,timer=null,origin=0,nextStep=0,nextCue=0,cues=[],buffers=[],playing=false;
  const song={...homeArrangement(TRACKS[0],0),arranged:true};
  const init=()=>{
    if(!engine){engine=engineFactory();engine.unlock();engine.setVolume(.75);engine.setVoxDelay(60/BPM*.75);engine.setVoxVerb(.08);}
    return engine;
  };
  const elapsed=()=>engine?Math.max(0,Math.min(DURATION,engine.now()-origin)):0;
  const clearTick=()=>{if(timer!==null)clear(timer);timer=null;};
  const tick=(lookahead=.12)=>{
    if(!playing||!engine)return;
    const time=elapsed(),stepSec=60/BPM/4;
    if(time>=DURATION){clearTick();return;}
    nextStep=Math.max(nextStep,Math.ceil((time-.03)/stepSec));
    while(nextStep*stepSec<Math.min(DURATION,time+lookahead)){
      const s=nextStep%16,bar=Math.floor(nextStep/16),when=origin+nextStep*stepSec;
      const fade=Math.min(1,(DURATION-nextStep*stepSec)/.6);
      if(s%4===0)engine.trigger('kick',.62*fade,when);
      if(s===4||s===12)engine.trigger('snare',.43*fade,when);
      if(s%2===0)engine.trigger('ch',(s%4===2?.22:.14)*fade,when);
      if(s===14&&bar%4===3)engine.trigger('oh',.16*fade,when);
      // A deterministic motif: retain the homepage bass, keys and arp without
      // its random blips, so opening a saved recipe preserves the arrangement.
      for(const e of bandAt(song,nextStep,0))engine.trigger(e.v,e.vel*.43*fade,when,e);
      nextStep++;
    }
    while(nextCue<cues.length&&cues[nextCue].start<time+lookahead){
      const cue=cues[nextCue++];
      if(cue.end<=time)continue;
      engine.playBuffer(buffers[cue.clip],{when:Math.max(engine.now()+.005,origin+cue.start),offset:Math.max(0,time-cue.start)*cue.rate,rate:cue.rate,bus:'vox',vel:cue.role==='robot'?.8:1});
    }
  };
  return {
    unlock(){init().unlock();},
    async prepare(recipe,signal){
      const active=init(),lines=voiceLines(recipe);
      const key=line=>line.bank===undefined?JSON.stringify({text:line.text,role:line.role}):`recording-${line.bank}`;
      const missing=lines.filter(line=>line.bank===undefined&&!rawCache.has(key(line)));
      const recorded=lines.filter(line=>line.bank!==undefined&&!rawCache.has(key(line)));
      const remember=(k,v)=>{if(rawCache.size>=80)rawCache.delete(rawCache.keys().next().value);rawCache.set(k,v);};
      await Promise.all([
        ...recorded.map(async line=>{
          const response=await fetchImpl(`/phrases/${String(line.bank+1).padStart(2,'0')}.wav`,{signal});
          if(!response.ok)throw new Error('The original vocal could not load. Please try again.');
          remember(key(line),await response.arrayBuffer());
        }),
        ...(missing.length?[ (async()=>{
          const response=await fetchImpl('/api/post-beat/voices',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clips:missing.map(({text,role})=>({text,role}))}),signal});
          const result=await response.json().catch(()=>({}));
          if(!response.ok)throw new Error(result.error||'The vocals could not be prepared. Please try again.');
          if(result.clips?.length!==missing.length)throw new Error('A vocal is missing. Please try again.');
          result.clips.forEach((clip,i)=>remember(key(missing[i]),Uint8Array.from(atob(clip.audio),c=>c.charCodeAt(0)).buffer));
        })()]:[]),
      ]);
      if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
      return Promise.all(lines.map(line=>active.decode(rawCache.get(key(line)).slice(0))));
    },
    play(recipe,decoded,{offset=0,reuseGraph=false}={}){
      // Recreate the graph for a clean restart; decoded buffers survive it.
      clearTick();if(!reuseGraph){engine?.dispose();engine=null;}init();
      buffers=decoded;cues=makeTimedCues(recipe,buffers);origin=engine.now()+.08-Math.max(0,Math.min(DURATION,offset));nextStep=0;nextCue=0;playing=true;
      timer=interval(tick,25);tick();return {cues,duration:DURATION};
    },
    // Schedule the identical arrangement in an OfflineAudioContext. A fixed
    // sample timeline prevents slow rendering from stretching the exported song.
    schedule(recipe,decoded,{offset=5,duration=10}={}){
      clearTick();init();buffers=decoded;cues=makeTimedCues(recipe,buffers);
      origin=engine.now()-offset;nextStep=0;nextCue=0;playing=true;
      tick(duration);playing=false;
    },
    pause(){playing=false;clearTick();engine?.suspend();},
    resume(){engine?.unlock();playing=true;timer=interval(tick,25);tick();},
    elapsed,
    spectrum(){return engine?.spectrum?.();},
    stream(){return init().stream();},
    audioTrack(){return init().audioTrack();},
    sampleRate(){return init().sampleRate();},
    monitor(enabled){init().setMonitor?.(enabled);},
    volume(value){init().setVolume(value);},
    stop(){playing=false;clearTick();engine?.dispose();engine=null;},
    dispose(){playing=false;clearTick();engine?.dispose();engine=null;},
  };
}
