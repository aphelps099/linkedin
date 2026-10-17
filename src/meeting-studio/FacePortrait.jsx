import React,{memo,useEffect,useRef} from 'react';
import {FACE_POSES,mouthPose,blinkAmount,createPortraitRenderer} from './portrait-renderer.js';

export const FacePortrait=memo(function FacePortrait({media,engine,playing,motion,position}) {
  const canvas=useRef(null),latest=useRef({playing,motion});latest.current={playing,motion};
  useEffect(()=>{
    const node=canvas.current,atlas=new Image();
    let disposed=false,visible=true,raf=0,last=0,draw;
    const stop=()=>{cancelAnimationFrame(raf);raf=0;draw?.(0,0);};
    const frame=now=>{
      if(disposed||document.hidden||!visible||!latest.current.playing||!latest.current.motion){stop();return;}
      if(now-last>=1000/24){
        last=now;
        const vocal=engine.current?.performanceFrame();
        const own=vocal?.speaker===(media==='keys'?'F':'M');
        draw?.(own?mouthPose(vocal.level):0,blinkAmount(now/1000,FACE_POSES[media].blinkOffset));
      }
      raf=requestAnimationFrame(frame);
    };
    const sync=()=>{
      if(!draw)return;
      if(!document.hidden&&visible&&latest.current.playing&&latest.current.motion){if(!raf)raf=requestAnimationFrame(frame);}
      else stop();
    };
    atlas.onload=()=>{
      if(disposed)return;
      draw=createPortraitRenderer(node,atlas,media,(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});
      draw?.(0,0);sync();
    };
    atlas.src=`/studio/meeting/${media}-faces.webp`;
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});observer.observe(node);
    document.addEventListener('visibilitychange',sync);
    // Playback/motion transitions reach the existing loop without reloading the atlas.
    node.syncPortrait=sync;
    return()=>{disposed=true;stop();observer.disconnect();document.removeEventListener('visibilitychange',sync);atlas.onload=null;delete node.syncPortrait;};
  },[media,engine]);
  useEffect(()=>{canvas.current?.syncPortrait?.();},[playing,motion]);
  return <><img className="meeting-poster" src={`/studio/meeting/${media}-still.webp`} alt="" style={{objectPosition:position}}/><canvas ref={canvas} className="meeting-face" width="960" height="540" style={{objectPosition:position}} aria-hidden="true"/></>;
});
