import React,{memo,useEffect,useRef,useState} from 'react';
import {Mic,MicOff,Maximize2,Minimize2,Play,UserRound,VideoOff} from 'lucide-react';
import {FacePortrait} from './FacePortrait.jsx';

const PerformanceVideo=memo(function PerformanceVideo({media,playing,motion,position}) {
  const video=useRef(null),[failed,setFailed]=useState(false);
  const [requested,setRequested]=useState(false);
  useEffect(()=>{if(playing&&motion)setRequested(true);},[playing,motion]);
  useEffect(()=>{
    const node=video.current;
    if(!node)return;
    let visible=true,disposed=false;
    const sync=()=>{
      if(playing&&motion&&visible&&!document.hidden&&!failed){
        node.play()?.then(()=>{if(disposed)node.pause();}).catch(()=>{});
      }else node.pause();
    };
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();});
    observer.observe(node);document.addEventListener('visibilitychange',sync);node.addEventListener('loadeddata',sync);sync();
    return()=>{disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',sync);node.removeEventListener('loadeddata',sync);node.pause();};
  },[playing,motion,requested,failed]);
  return <><img className="meeting-poster" src={`/studio/meeting/${media}.webp?v=webcam-20261017`} alt="" style={{objectPosition:position}}/><video ref={video} className={`meeting-video${failed?' has-failed':''}`} src={requested?`/studio/meeting/${media}.mp4?v=webcam-20261017`:undefined} poster={`/studio/meeting/${media}.webp?v=webcam-20261017`} style={{objectPosition:position}} muted loop playsInline preload="none" disablePictureInPicture aria-hidden="true" tabIndex={-1} onError={()=>setFailed(true)}/></>;
});

export const Participant=memo(function Participant({person,engine,playing,loading,started,muted,active,spotlight,compact,caption,motion,videosEnabled=true,onSelect,onMute}) {
  const cameraOff=!person.media||!videosEnabled;
  const label=!started?'Play the meeting':spotlight?`Return ${person.name} to grid`:`Spotlight ${person.name}`;
  return <article className={`meeting-tile${active?' is-active':''}${muted?' is-muted':''}${spotlight?' is-spotlight':''}${compact?' is-small':''}${cameraOff?' camera-off':''}`} aria-label={`${person.name}, ${person.role}`}>
    {person.media&&<div className="meeting-camera-feed" hidden={cameraOff}>{person.voice?<FacePortrait media={person.media} engine={engine} playing={playing&&videosEnabled} motion={motion} position={person.position}/>:<PerformanceVideo media={person.media} playing={playing&&videosEnabled} motion={motion} position={person.position}/>}</div>}
    {cameraOff&&<div className="meeting-avatar-content"><div className="meeting-avatar" aria-hidden="true"><UserRound strokeWidth="0" fill="currentColor"/></div><strong>{person.name}</strong><span>{person.media?'Camera off':'Connecting to audio…'}</span></div>}
    <button type="button" className="meeting-tile-select" aria-label={label} aria-pressed={spotlight} disabled={loading} onClick={()=>onSelect(person.id)}>
      <span className="meeting-tile-action">{!started?<Play aria-hidden="true"/>:spotlight?<Minimize2 aria-hidden="true"/>:<Maximize2 aria-hidden="true"/>}<span>{!started?'Join & play':spotlight?'Back to grid':'Spotlight'}</span></span>
    </button>
    {cameraOff&&<VideoOff className="meeting-camera-off" aria-label="Camera off"/>}
    {caption&&!compact&&<div className="meeting-caption" aria-live="off"><span>{caption}</span></div>}
    <div className="meeting-nameplate"><button type="button" className="meeting-mic" aria-label={`${muted?'Unmute':'Mute'} ${person.name}: ${person.role}`} aria-pressed={muted} title={`${muted?'Unmute':'Mute'} ${person.role.toLowerCase()}`} onClick={()=>onMute(person.id)}>{muted?<MicOff aria-hidden="true"/>:<Mic aria-hidden="true"/>}</button><div><strong>{person.name}</strong></div><div className={`meeting-meter${active?' is-on':''}`} aria-hidden="true"><i/><i/><i/><i/></div></div><span className="meeting-tile-role">{person.role}{muted?' · muted':''}</span>
  </article>;
});
