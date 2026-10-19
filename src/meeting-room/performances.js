import {standupSolos,standupChorus} from './standup-performances.js';

// A clip belongs to one exact recorded take, never merely to a character name.
export const performances={
  '74c0e5221bfb4c2f1d0ebe9aaa6a4d1dad0625acf48c9f48796d9a14e818b993':{
    character:'guitar',masterSha256:'690199403834b19ba18edd1d5975962060a6542af52ecb420a095b471cc1c53a',
    video:'/studio/performances/kevin-new-folder-v1.mp4',offset:0,duration:2.8734583333333332,
  },
  ...standupSolos,
};
const sourceSignature=sources=>JSON.stringify(sources?.map(source=>[
  source.character,source.text,source.take,source.masterSha256,source.version,
  source.provider,source.voice,source.rate,source.pitch,source.pitchRange,source.engineVersion,
]));
export function exactPerformance(id,cue){
  if(!cue)return null;
  if(cue.speaker==='all'){
    // Every singer has their own isolated driver, but the full cast determines
    // the beat-aligned gaps. Invalidate if any source or cue duration changes.
    if(Math.abs(cue.duration-standupChorus.cueDuration)>.0001||
      sourceSignature(cue.sources)!==sourceSignature(standupChorus.sources))return null;
    return standupChorus.performances[id]||null;
  }
  if(cue.speaker!==id)return null;
  const source=cue.sources?.find(source=>source.character===id);
  const performance=performances[source?.take];
  return performance?.character===id&&performance.masterSha256===source.masterSha256?performance:null;
}
export function performanceForTime(id,meeting,time){
  for(const cue of meeting.cues){
    if(time>=cue.start+cue.duration)continue;
    const performance=exactPerformance(id,cue);
    if(performance)return{cue,performance,current:time>=cue.start};
  }
  return null;
}
export function performanceTime(performance,cue,time){
  return performance.offset+Math.max(0,Math.min(performance.duration,time-cue.start));
}
export function syncPerformanceVideo(video,expected,shouldPlay,onError){
  // A newly swapped source can briefly inherit React's previous ready flag.
  // Check the actual media element before touching its clock (duration is NaN
  // until metadata arrives). Never let a cold-cache seek unmount the room.
  if(!video||video.readyState<2||!Number.isFinite(video.duration)||video.duration<=0||!Number.isFinite(expected))return false;
  const target=Math.min(Math.max(0,expected),Math.max(0,video.duration-.001));
  if(Math.abs(video.currentTime-target)>(shouldPlay?.1:.001))video.currentTime=target;
  if(shouldPlay&&video.paused&&!video.ended)video.play().catch(onError);
  else if(!shouldPlay&&!video.paused)video.pause();
  return true;
}
