import React,{memo,useEffect,useRef,useState} from 'react';
import {Mic,MicOff,VideoOff,Pin,Music2} from 'lucide-react';
import {cast,isSpeaker,cueLevel} from './catalog.js';
import tracking from './robot-tracking.json';

const base='/studio/season/';
export function robotFrame(id,time){
  const track=tracking[id],index=Math.max(0,Math.min(track.frames.length-1,time*track.fps));
  const a=track.frames[Math.floor(index)],b=track.frames[Math.min(track.frames.length-1,Math.ceil(index))];
  return a.map((value,i)=>value+(b[i]-value)*(index-Math.floor(index)));
}
export function drawRobotMouth(ctx,id,videoTime,audioTime,level){
  ctx.clearRect(0,0,1280,720);
  const [x,y,angle,scale]=robotFrame(id,videoTime);
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
  // Cover ONLY the source mouth LEDs. Eyes, glass and metal remain untouched.
  ctx.fillStyle='#07120b';ctx.shadowColor='#07120b';ctx.shadowBlur=3;
  ctx.fillRect(-32,-6,64,12);ctx.shadowBlur=0;
  const phase=(audioTime*15)%22;
  for(let i=0;i<22;i++){
    const distance=(phase-i+22)%22;
    const strength=level>.08?Math.max(.16,(1-distance/7)*level):.11;
    ctx.fillStyle=`rgba(74,255,112,${strength})`;
    // Fixed four-pixel height. Energy changes brightness, never height.
    ctx.fillRect(-46+i*4.3,-2,3.2,4);
  }
  ctx.restore();
}

export const Participant=memo(function Participant({id,meeting,frame,playing,audible,musicOn,videoOn,reduced,pinned,onPin,reactions}){
  const c=cast[id],video=useRef(null),canvas=useRef(null),frameRef=useRef(frame);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const active=playing&&audible&&isSpeaker(id,frame.cue);
  const performing=playing&&musicOn&&!!c.instrument;
  let clip=c.robot?`${c.media}-listening`:c.silent?null:`${c.media}-${active?'speaking':performing?(Math.floor(frame.time/(240/meeting.bpm*4))%2?'listening':'playing'):'listening'}`;
  if(id==='printer')clip='printer-printing';
  const moving=playing&&videoOn&&!reduced;
  const poster=id==='droid'?`${base}posters/droid.jpeg`:`${base}posters/${clip}.jpg`;
  frameRef.current={...frame,active};
  useEffect(()=>{setReady(false);setFailed(false);},[clip,meeting.id]);
  useEffect(()=>{
    const v=video.current;if(!v)return;
    if(moving&&!failed){
      // A printer completes one real print event, then holds its final frame.
      // Its stack is never reset by a looping or reversed clip.
      if(id!=='printer'||!v.ended)v.play().catch(()=>setFailed(true));
    }else v.pause();
  },[moving,clip,failed,id]);
  useEffect(()=>{
    const v=video.current;
    if(id==='printer'&&v&&Number.isFinite(v.duration)){
      const target=Math.max(0,Math.min(v.duration-.04,frame.time));
      if(Math.abs(v.currentTime-target)>.3)v.currentTime=target;
      if(target>=v.duration-.05)v.pause();
    }
  },[id,frame.time]);
  useEffect(()=>{
    if(!c.robot||!videoOn)return;
    const ctx=canvas.current?.getContext('2d');if(!ctx)return;
    let raf;
    const paint=()=>{
      const f=frameRef.current;
      drawRobotMouth(ctx,id,ready?video.current?.currentTime||0:.25,f.time,f.active?cueLevel(f.cue,f.time):0);
      if(moving)raf=requestAnimationFrame(paint);
    };
    paint();return()=>cancelAnimationFrame(raf);
  },[c.robot,id,moving,ready,videoOn,frame.cue,active]);
  const reaction=reactions&&playing&&!active&&!c.silent&&frame.cue&&['people','strategy','linda'].includes(id)&&frame.time%13<3;
  return <button type="button" className={`mr-tile${active?' is-speaking':''}${pinned?' is-pinned':''}`} onClick={()=>onPin(id)} aria-label={`${pinned?'Unpin':'Spotlight'} ${c.name}`} aria-pressed={pinned} data-character={id}>
    {c.offline||!videoOn?<div className="mr-camera-off"><VideoOff aria-hidden="true"/><div className="mr-avatar">{c.offline?'PT':c.name.split(' ').map(s=>s[0]).slice(0,2).join('')}</div><strong>{c.name}</strong><span>{c.offline?'Connecting to audio…':'Camera off'}</span></div>:<div className="mr-media">
      <img className="mr-poster" src={poster} alt="" loading="eager"/>
      {clip&&<video key={`${meeting.id}-${clip}`} ref={video} className={ready?'is-ready':''} src={moving||ready?`${base}clips/${clip}.mp4`:undefined} muted playsInline disablePictureInPicture loop={id!=='printer'} preload="none" onPlaying={()=>setReady(true)} onError={()=>setFailed(true)} aria-hidden="true"/>}
      {c.robot&&<canvas className="mr-robot-display" ref={canvas} width="1280" height="720" aria-hidden="true"/>}
    </div>}
    <span className="mr-tile-top">
      {c.robot&&<span className="mr-role">{c.role}</span>}
      {performing&&<span className="mr-instrument"><Music2 aria-hidden="true"/>{c.instrument}</span>}
      {reaction&&<span className="mr-reaction" aria-hidden="true">{id==='people'?'♥':'💡'}</span>}
      {pinned&&<Pin className="mr-pin" aria-hidden="true"/>}
    </span>
    <span className="mr-namebar">{c.silent?<MicOff aria-hidden="true"/>:<Mic aria-hidden="true"/>}<span>{c.name}<small>{c.role!=='Host'?` · ${c.role}`:''}</small></span>{active&&<span className="mr-speaking-dots" aria-hidden="true"><i/><i/><i/></span>}</span>
  </button>;
});
