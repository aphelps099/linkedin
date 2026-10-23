import {claimAudio, onAudioFocus} from '../brand/audio-focus.js';
import {createMobileAudio} from '../audio-session.js';
// A single Web Audio clock owns music, vocals, captions and performance cues.
// No microphone, camera permission or live generation service is required.
export function createMeetingEngine({onChange=()=>{},contextFactory=()=>new (window.AudioContext||window.webkitAudioContext)(),fetcher=fetch,random=Math.random,audioSessionFactory=createMobileAudio,loadTimeoutMs=25000}={}){
  let context,audioSession,master,voiceGain,musicGain,meeting,buffers,origin=0,offset=0,generation=0,disposed=false;
  let playing=false,loading=false,error='',muted=false,music=.42,voices=1,sources=[],controller;
  let fillChoice=0;
  const cache=new Map();
  const elapsed=()=>playing?Math.min(meeting.duration,Math.max(0,context.currentTime-origin)):offset;
  const snapshot=()=>({playing,loading,error,muted,music,voices,elapsed:elapsed(),duration:meeting?.duration||0});
  const emit=()=>{if(!disposed)onChange(snapshot());};
  function setup(){
    if(context)return;
    context=contextFactory();audioSession=audioSessionFactory(context);master=context.createGain();voiceGain=context.createGain();musicGain=context.createGain();
    const limiter=context.createDynamicsCompressor();
    limiter.threshold.value=-3;limiter.knee.value=3;limiter.ratio.value=16;limiter.attack.value=.003;limiter.release.value=.15;
    voiceGain.connect(master);musicGain.connect(master);master.connect(limiter);limiter.connect(context.destination);
    master.gain.value=muted?0:.88;voiceGain.gain.value=voices;musicGain.gain.value=music;
    context.onstatechange=()=>{if(context.state==='interrupted'||context.state==='suspended'){if(playing){pause();error='Audio was interrupted. Tap Play meeting to resume.';emit();}}};
  }
  function stop(){for(const source of sources){source.onended=null;try{source.stop();}catch{}source.disconnect();}sources=[];}
  async function decode(file,signal){
    if(cache.has(file))return cache.get(file);
    const response=await fetcher(`/studio/season/audio/${file}`,{signal});
    if(!response.ok)throw Error('The meeting audio could not load. Please try again.');
    const result=await context.decodeAudioData(await response.arrayBuffer());
    if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    cache.set(file,result);while(cache.size>4)cache.delete(cache.keys().next().value);
    return result;
  }
  function setMeeting(next){
    generation++;controller?.abort();audioSession?.pause();stop();meeting=next;buffers=null;offset=0;playing=false;loading=false;error='';emit();
    const count=next.guitarFills?.variants.length||0;
    fillChoice=count?Math.min(count-1,Math.max(0,Math.floor(random()*count))):0;
  }
  function begin(){
    stop();if(offset>=meeting.duration-.02)offset=0;
    const start=context.currentTime+.05;origin=start-offset;
    const voice=context.createBufferSource();voice.buffer=buffers.voice;voice.connect(voiceGain);
    const bed=context.createBufferSource();bed.buffer=buffers.bed;bed.loop=true;bed.loopStart=0;bed.loopEnd=meeting.loopDuration;bed.connect(musicGain);
    scheduleMusic(start);
    sources=[voice,bed];playing=true;loading=false;error='';
    voice.onended=()=>{if(playing){offset=meeting.duration;playing=false;stop();audioSession?.pause();emit();}};
    voice.start(start,offset,meeting.duration-offset);bed.start(start,offset%meeting.loopDuration);bed.stop(start+meeting.duration-offset);
    const variant=meeting.guitarFills?.variants[fillChoice];
    if(buffers.fills&&variant)for(const fill of meeting.interludes||[]){
      const inside=Math.max(0,offset-fill.start),remaining=Math.min(fill.duration,variant.duration)-inside;
      if(remaining<=0)continue;
      const riff=context.createBufferSource();riff.buffer=buffers.fills;riff.connect(musicGain);sources.push(riff);
      riff.start(start+Math.max(0,fill.start-offset),variant.offset+inside,remaining);
    }
    emit();
  }
  function scheduleMusic(start=context.currentTime){
    const now=elapsed();
    musicGain.gain.cancelScheduledValues(context.currentTime);
    musicGain.gain.setTargetAtTime(music,context.currentTime,.025);
    for(const cue of meeting.cues){
      const end=cue.start+cue.duration;if(end<=now)continue;
      musicGain.gain.setTargetAtTime(voices>0?music*.64:music,Math.max(start,origin+cue.start-.06),.045);
      musicGain.gain.setTargetAtTime(music,origin+end,.18);
    }
  }
  async function play(){
    if(disposed||!meeting||playing||loading)return;
    claimAudio('studio');
    const request=++generation;loading=true;error='';emit();
    let timer;
    try{
      setup();
      // Resume and prime native playback in the original tap, before any fetch.
      await audioSession.resume();
      if(disposed||request!==generation)return;
      const pending=new AbortController();controller=pending;
      if(!buffers){
        const files=Promise.all([decode(meeting.voice,pending.signal),decode(meeting.bed,pending.signal),meeting.guitarFills?decode(meeting.guitarFills.file,pending.signal):null]);
        const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('The meeting audio is taking too long to load. Tap Retry audio.'));pending.abort();},loadTimeoutMs);});
        const [voice,bed,fills]=await Promise.race([files,deadline]);
        if(disposed||request!==generation)return;
        buffers={voice,bed,fills};
      }
      if(request!==generation||disposed)return;
      // A phone can interrupt audio while a large recording is downloading.
      // Keep decoded buffers so the next tap can start immediately.
      if(context.state!=='running')throw Error('Audio is paused by your browser. Tap Retry audio to start the meeting.');
      begin();
    }catch(e){if(request!==generation||disposed)return;controller?.abort();audioSession?.pause();loading=false;playing=false;error=e.name==='AbortError'?'':e.message||'Audio could not start. Please try again.';emit();}
    finally{clearTimeout(timer);}
  }

  function pause(){generation++;controller?.abort();audioSession?.pause();offset=elapsed();playing=false;loading=false;stop();emit();}
  function seek(seconds){
    const resume=playing||loading;generation++;controller?.abort();playing=false;loading=false;audioSession?.pause();stop();
    offset=Math.max(0,Math.min(meeting.duration,Number(seconds)||0));emit();
    if(resume&&offset<meeting.duration)play();
  }
  function setMix(values){
    if(values.muted!==undefined)muted=!!values.muted;
    if(values.music!==undefined)music=Math.max(0,Math.min(1,values.music));
    if(values.voices!==undefined)voices=Math.max(0,Math.min(1,values.voices));
    if(context){master.gain.setTargetAtTime(muted?0:.88,context.currentTime,.02);voiceGain.gain.setTargetAtTime(voices,context.currentTime,.02);if(playing)scheduleMusic();else musicGain.gain.value=music;}
    emit();
  }
  const releaseFocus=onAudioFocus('studio',()=>{if(playing||loading)pause();});
  return {setMeeting,play,pause,seek,setMix,snapshot,elapsed,dispose(){releaseFocus();disposed=true;generation++;controller?.abort();stop();audioSession?.dispose();cache.clear();if(context){context.onstatechange=null;context.close();}}};
}
