import React,{useEffect,useRef,useState} from 'react';
import {performanceForTime,performanceTime,syncPerformanceVideo} from './performances.js';

export function SpeechPerformance({id,meeting,time,playing,reduced}){
  const selection=performanceForTime(id,meeting,time);
  const video=useRef(null),[ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const source=selection?.performance.video;
  const enabled=!reduced&&(playing||time>0);
  useEffect(()=>{setReady((video.current?.readyState||0)>=2);setFailed(false);},[source,meeting.id]);
  useEffect(()=>{
    const v=video.current;
    if(!v||!ready||!selection||failed)return;
    const expected=performanceTime(selection.performance,selection.cue,time);
    const shouldPlay=enabled&&playing&&selection.current;
    // The meeting audio is the master clock, including mid-sentence seeks.
    syncPerformanceVideo(v,expected,shouldPlay,()=>setFailed(true));
  },[time,playing,enabled,ready,failed,source,selection?.current]);
  if(!selection)return null;
  return <video ref={video} key={source} className={`mr-exact-performance${enabled&&selection.current&&ready&&!failed?' is-visible':''}`}
    src={enabled?source:undefined} muted playsInline disablePictureInPicture preload={enabled?'auto':'none'}
    onLoadedData={()=>setReady(true)} onError={()=>setFailed(true)} aria-hidden="true"/>;
}
