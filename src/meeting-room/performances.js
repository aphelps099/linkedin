// A clip belongs to one exact recorded take, never merely to a character name.
export const performances={
  '74c0e5221bfb4c2f1d0ebe9aaa6a4d1dad0625acf48c9f48796d9a14e818b993':{
    character:'guitar',masterSha256:'690199403834b19ba18edd1d5975962060a6542af52ecb420a095b471cc1c53a',
    video:'/studio/performances/kevin-new-folder-v1.mp4',offset:0,duration:2.8734583333333332,
  },
};
export function exactPerformance(id,cue){
  if(!cue||cue.speaker!==id)return null;
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
  return Math.max(0,Math.min(performance.duration, time-cue.start+performance.offset));
}
