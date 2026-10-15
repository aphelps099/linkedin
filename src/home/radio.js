import {createAudioEngine} from '../audio.js';
import {bandAt} from '../song.js';
import {ensureClip} from '../v2/lesson.js';
import {TRACKS, arrangement, makeCues, lyricAt, LINES} from './tracks.js';

export function createRadio({phraseBase, onState, engineFactory=createAudioEngine, loadClip=ensureClip, interval=setInterval, clear=clearInterval}) {
  const voice={bank:new Map()};
  let engine=null, timer=null, generation=0, origin=0, positionFloor=0, nextStep=0, nextCue=0, cues=[], song=null, disposed=false;
  let state={index:0,playing:false,loading:false,elapsed:0,volume:.8,shuffle:false,text:LINES[1],word:-1,error:''};
  const emit=next=>{state={...state,...next}; if(!disposed) onState({...state});};
  const clearTick=()=>{if(timer!==null) clear(timer);timer=null;};
  const destroy=()=>{clearTick();engine?.dispose();engine=null;};
  const now=()=>engine?Math.max(positionFloor,Math.min(TRACKS[state.index].seconds,engine.now()-origin)):state.elapsed;
  const nextIndex=direction=>state.shuffle
    ? (state.index+1+Math.floor(Math.random()*(TRACKS.length-1)))%TRACKS.length
    : (state.index+direction+TRACKS.length)%TRACKS.length;

  function tick() {
    if(!engine || !state.playing) return;
    const track=TRACKS[state.index], elapsed=now(), stepSec=60/track.bpm/4;
    if(elapsed>=track.seconds){ start(nextIndex(1),0); return; }
    // Recover after a throttled background tab without replaying a backlog.
    nextStep=Math.max(nextStep,Math.ceil((elapsed-.03)/stepSec));
    while(nextStep*stepSec<Math.min(track.seconds,elapsed+.12)){
      const s=nextStep%16, bar=Math.floor(nextStep/16), t=origin+nextStep*stepSec;
      const energy=bar%16<4?0:bar%16<8?1:2;
      const fade=Math.min(1,(track.seconds-nextStep*stepSec)/3);
      if(s%4===0) engine.trigger('kick',.72*fade,t);
      if(s===4||s===12) engine.trigger('snare',.58*fade,t);
      if(s%2===0) engine.trigger('ch',(.25+(s%4===2?.13:0))*fade,t);
      if(s===14 && bar%4===3) engine.trigger('oh',.22*fade,t);
      for(const e of bandAt(song,nextStep,energy)) engine.trigger(e.v,e.vel*.65*fade,t,e);
      nextStep++;
    }
    while(nextCue<cues.length && cues[nextCue].at<elapsed+.12){
      const cue=cues[nextCue++], offset=Math.max(0,elapsed-cue.at);
      if(offset<cue.duration && cue.at+cue.duration<track.seconds)
        engine.playBuffer(voice.bank.get(cue.bank),{when:Math.max(engine.now()+.005,origin+Math.max(cue.at,elapsed)),offset,bus:'vox',vel:1});
    }
    emit({elapsed,...lyricAt(cues,elapsed)});
  }

  async function start(index=state.index, offset=0, play=true) {
    const mine=++generation;
    destroy();
    const track=TRACKS[index];
    offset=Math.max(0,Math.min(offset,track.seconds));
    emit({index,elapsed:offset,playing:false,loading:play,error:'',text:LINES[track.phrases[0]],word:-1});
    if(!play) return;
    try{
      const active=engineFactory(); engine=active;
      // Unlock synchronously in the click/keyboard call stack, before fetching.
      active.unlock(); active.setVolume(state.volume);
      const loaded=await Promise.all([...new Set(track.phrases)].map(bank=>loadClip(active,voice,phraseBase,bank)));
      if(mine!==generation || disposed) return;
      if(loaded.some(b=>!b)) throw new Error('A voice clip could not load. Please try play again.');
      song=arrangement(track,index); cues=makeCues(track,voice.bank);
      positionFloor=offset;
      origin=active.now()+.08-offset;
      nextStep=Math.ceil(offset/(60/track.bpm/4));
      nextCue=cues.findIndex(c=>c.at+c.duration>offset);
      if(nextCue<0) nextCue=cues.length;
      emit({playing:true,loading:false});
      timer=interval(tick,25); tick();
    }catch(error){
      if(mine!==generation || disposed) return;
      destroy();emit({loading:false,playing:false,error:error.message||'Audio is unavailable in this browser.'});
    }
  }

  return {
    getState:()=>({...state}),
    play:(index=state.index)=>start(index,index===state.index?state.elapsed:0),
    toggle(){
      if(state.loading){generation++;destroy();emit({loading:false,playing:false});return;}
      if(state.playing){
        const elapsed=now();clearTick();engine.suspend();emit({playing:false,elapsed});return;
      }
      if(engine && state.elapsed<TRACKS[state.index].seconds){
        engine.unlock();emit({playing:true,error:''});timer=interval(tick,25);tick();
      }else start(state.index,state.elapsed>=TRACKS[state.index].seconds?0:state.elapsed);
    },
    next:()=>start(nextIndex(1),0),
    previous:()=>start(state.elapsed>3?state.index:nextIndex(-1),0),
    seek:seconds=>start(state.index,Number(seconds),state.playing||state.loading),
    volume(value){const volume=Math.max(0,Math.min(1,Number(value)));engine?.setVolume(volume);emit({volume});},
    shuffle(){emit({shuffle:!state.shuffle});},
    dispose(){disposed=true;generation++;destroy();},
  };
}
