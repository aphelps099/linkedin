import React,{useEffect,useRef} from 'react';
import {syncPerformanceVideo} from './performances.js';

// An explicitly separate instrument camera, never a face pasted onto a body.
// The approved hand performance stays visible underneath the exact vocal shot.
export function KeyboardDetail({visible,time,playing,reduced}){
  const video=useRef(null);
  const synchronize=()=>{
    const v=video.current;
    if(!v||!Number.isFinite(v.duration)||v.duration<=0)return;
    syncPerformanceVideo(v,time%v.duration,visible&&playing&&!reduced,()=>{});
  };
  useEffect(synchronize,[visible,time,playing,reduced]);
  return <div className={`mr-keyboard-detail${visible?' is-visible':''}`} aria-hidden="true">
    <img src="/studio/season/posters/keys-detail.jpg" alt=""/>
    <video ref={video} src={visible?'/studio/season/clips/keys-detail.mp4':undefined}
      poster="/studio/season/posters/keys-detail.jpg" muted playsInline loop disablePictureInPicture preload="none"
      onLoadedData={synchronize} onCanPlay={synchronize} onSeeked={synchronize}/>
  </div>;
}
