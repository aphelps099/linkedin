import React,{memo,useEffect,useRef,useState} from 'react';
import {Mic,MicOff,VideoOff,Pin,Music2} from 'lucide-react';
import {cast,isSpeaker,cueLevel} from './catalog.js';
import tracking from './robot-tracking.json';
import {PrinterFeed} from './PrinterFeed.jsx';
import {SpeechPerformance} from './SpeechPerformance.jsx';
import {KeyboardDetail} from './KeyboardDetail.jsx';
import {exactPerformance} from './performances.js';

const base='/studio/season/';
// Crop baked interface margins as one camera layer, including the tracked display.
// A 3:2 gallery preserves robot badges and instruments without portrait sidebars.
const founderCrops={people:[132,0,1014,676],synthia:[132,0,1014,676],synergy:[96,0,1056,704],guitar:[128,22,1024,1024/1.5],printer:[100,0,1080,720]};
function cameraStyle(id,meeting){
  if(meeting.agenda!=='founder')return undefined;
  const [x,y,w,h]=founderCrops[id]||[100,0,1080,720];
  return {width:`${1280/w*100}%`,height:`${720/h*100}%`,left:`${-x/w*100}%`,top:`${-y/h*100}%`,right:'auto',bottom:'auto'};
}
export function robotFrame(id,time){
  const track=tracking[id],index=Math.max(0,Math.min(track.frames.length-1,time*track.fps));
  const a=track.frames[Math.floor(index)],b=track.frames[Math.min(track.frames.length-1,Math.ceil(index))];
  return a.map((value,i)=>value+(b[i]-value)*(index-Math.floor(index)));
}
export function drawRobotMouth(ctx,id,videoTime,audioTime,level){
  ctx.clearRect(0,0,1280,720);
  const [x,y,angle,scale]=robotFrame(id,videoTime);
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(scale,scale);
  // Both approved camera plates are clean: no opaque patch can float on the glass.
  const height=6;
  ctx.shadowColor='#4aff70';ctx.shadowBlur=2;
  const phase=(audioTime*15)%22;
  for(let i=0;i<22;i++){
    const distance=(phase-i+22)%22;
    const strength=level>.08?Math.max(.16,(1-distance/7)*level):.11;
    ctx.fillStyle=`rgba(74,255,112,${strength})`;
    // Each character has a fixed-height row. Speech changes brightness, never height.
    ctx.fillRect(-46+i*4.3,-height/2,3.2,height);
  }
  ctx.restore();
}

export const Participant=memo(function Participant({id,meeting,frame,playing,audible,musicOn,videoOn,reduced,pinned,onPin,reactions}){
  const c=cast[id],video=useRef(null),canvas=useRef(null),frameRef=useRef(frame);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  const [exactVisible,setExactVisible]=useState(false);
  const active=playing&&audible&&isSpeaker(id,frame.cue);
  const performing=playing&&musicOn&&!!c.instrument;
  const featuredInstrument=performing&&meeting.interludes?.some(fill=>fill.character===id&&frame.time>=fill.start&&frame.time<fill.start+fill.duration);
  const keyboardDetail=id==='keys'&&!!exactPerformance(id,frame.cue)&&!reduced&&videoOn&&(playing||frame.time>0);
  let clip=c.robot?`${c.media}-listening`:c.silent?null:`${c.media}-${active&&!exactPerformance(id,frame.cue)?'speaking':featuredInstrument?'playing':performing?(Math.floor(frame.time/(240/meeting.bpm*4))%2?'listening':'playing'):'listening'}`;
  const moving=playing&&videoOn&&!reduced;
  // A twelve-tile chorus must not decode two cameras for every human.
  // Keep the fallback moving until the exact performance is actually visible.
  const baseMoving=moving&&!exactVisible;
  const poster=id==='droid'?`${base}posters/droid.jpeg`:`${base}posters/${clip}.jpg`;
  frameRef.current={...frame,active};
  useEffect(()=>{setReady(false);setFailed(false);},[clip,meeting.id]);
  useEffect(()=>{
    const v=video.current;if(!v)return;
    if(baseMoving&&!failed){
      v.play().catch(()=>setFailed(true));
    }else v.pause();
  },[baseMoving,clip,failed,id]);
  useEffect(()=>{
    if(!c.robot||!videoOn)return;
    const ctx=canvas.current?.getContext('2d');if(!ctx)return;
    let raf;
    const paint=()=>{
      const f=frameRef.current;
      drawRobotMouth(ctx,id,ready?video.current?.currentTime||0:.25,f.time,f.active?cueLevel(f.cue,f.time,id):0);
      if(moving)raf=requestAnimationFrame(paint);
    };
    paint();return()=>cancelAnimationFrame(raf);
  },[c.robot,id,moving,ready,videoOn,frame.cue,active]);
  const reaction=reactions&&playing&&!active&&!c.silent&&frame.cue&&['people','strategy','linda'].includes(id)&&frame.time%13<3;
  return <button type="button" className={`mr-tile${active?' is-speaking':''}${pinned?' is-pinned':''}${keyboardDetail?' has-keyboard-detail':''}`} onClick={()=>onPin(id)} aria-label={`${pinned?'Unpin':'Spotlight'} ${c.name}`} aria-pressed={pinned} data-character={id}>
    {c.offline||!videoOn?<div className="mr-camera-off"><VideoOff aria-hidden="true"/><div className="mr-avatar">{c.offline?'PT':c.name.split(' ').map(s=>s[0]).slice(0,2).join('')}</div><strong>{c.name}</strong><span>{c.offline?'Connecting to audio…':'Camera off'}</span></div>:<div className="mr-media">
      <div className="mr-base-camera" style={cameraStyle(id,meeting)}>
      {id==='printer'?<PrinterFeed time={frame.time} playing={moving} reduced={reduced}/>:<img className="mr-poster" src={poster} alt="" loading="eager"/>}
      {clip&&<video key={`${meeting.id}-${clip}`} ref={video} className={ready?'is-ready':''} src={baseMoving||ready?`${base}clips/${clip}.mp4`:undefined} muted playsInline disablePictureInPicture loop preload="none" onPlaying={()=>setReady(true)} onError={()=>setFailed(true)} aria-hidden="true"/>}
      {c.robot&&<canvas className="mr-robot-display" ref={canvas} width="1280" height="720" aria-hidden="true"/>}
      </div>
      {!c.robot&&!c.silent&&<SpeechPerformance id={id} meeting={meeting} time={frame.time} playing={playing} reduced={reduced} onVisibleChange={setExactVisible}/>}
      {id==='keys'&&<KeyboardDetail visible={keyboardDetail} time={frame.time} playing={playing&&musicOn} reduced={reduced}/>}
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
