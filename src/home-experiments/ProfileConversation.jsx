import React, {memo, useEffect, useRef, useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {CONVERSATION, VIDEO_DURATION, conversationFrame} from './conversation-timeline.js';

export const ProfileConversation=memo(function ProfileConversation({base,motion,certificateFan}) {
  const root=useRef(null), video=useRef(null);
  const clock=useRef({loops:0,previous:0});
  const [frame,setFrame]=useState(()=>conversationFrame(0));
  const [blocked,setBlocked]=useState(false), [visible,setVisible]=useState(false);
  const [started,setStarted]=useState(false), [failed,setFailed]=useState(false);
  const running=motion&&!blocked&&visible&&!failed;
  const staticText=!motion||blocked||failed||!started;
  const scene=CONVERSATION[frame.index];
  const poster=`${base}home-experiments/profile-conversation.webp`;

  useEffect(()=>{
    let inView=false;
    const sync=()=>setVisible(inView&&!document.hidden);
    const observer=new IntersectionObserver(([entry])=>{inView=entry.isIntersecting&&entry.intersectionRatio>=.3;sync();},{threshold:[0,.3]});
    observer.observe(root.current);
    document.addEventListener('visibilitychange',sync);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',sync);};
  },[]);

  useEffect(()=>{
    const film=video.current;
    if(!film)return;
    if(!running){film.pause();return;}
    let cancelled=false, request;
    const tick=()=>{
      const time=film.currentTime*1000;
      if(time<clock.current.previous-1000) clock.current.loops=(clock.current.loops+1)%(CONVERSATION.length/2);
      clock.current.previous=time;
      const next=conversationFrame(clock.current.loops*VIDEO_DURATION+time);
      setFrame(previous=>previous.index===next.index&&previous.words===next.words&&previous.speaking===next.speaking&&previous.leaving===next.leaving?previous:next);
      request=requestAnimationFrame(tick);
    };
    film.play().then(()=>{
      if(cancelled){film.pause();return;}
      setStarted(true);
      request=requestAnimationFrame(tick);
    }).catch(()=>{if(!cancelled)setBlocked(true);});
    return()=>{cancelled=true;cancelAnimationFrame(request);film.pause();};
  },[running]);

  let wordIndex=0;
  return <div className={`profile-conversation${!motion?' is-still':''}`} ref={root}>
    <div className="conversation-canvas" aria-hidden="true">
      <img className="conversation-poster" src={poster} width="1280" height="720" alt="" loading="lazy" draggable="false"/>
      {!failed&&<video ref={video} className={`conversation-film${started&&motion?' is-ready':''}`} src={`${base}home-experiments/profile-conversation.mp4`} poster={poster} width="1280" height="720" muted playsInline loop preload="metadata" disablePictureInPicture onError={()=>setFailed(true)} aria-hidden="true"/>}
    </div>
    <header className="conversation-heading">
      <h2 id="c2-title"><span>Make it</span><span className="conversation-stamp">official</span></h2>
      <p>Five short courses.<br/>One very official-looking certificate.</p>
    </header>
    <div className="conversation-dialogue">
      <p className={`conversation-phrase${!staticText&&frame.leaving?' is-leaving':''}`} aria-hidden="true" key={frame.index}>{scene.lines.map((line,lineIndex)=><span className="conversation-line" key={lineIndex}>{line.split(' ').map(word=>{
        const index=wordIndex++;
        return <React.Fragment key={index}><span className={staticText||index<frame.words?'is-revealed':''}>{word}</span>{' '}</React.Fragment>;
      })}</span>)}</p>
    </div>
    <div className="conversation-enroll">
      {certificateFan}
      <a className="conversation-certify" href={`${base}learn/`}>Get certified <ArrowUpRight aria-hidden="true"/></a>
      <p>Professional development for aspiring thought leaders.</p>
    </div>
    <div className="c2-sr"><h3>Vocabulary you’ll master</h3><ul>{CONVERSATION.map(turn=><li key={turn.lines.join(' ')}>{turn.lines.join(' ')}</li>)}</ul></div>
  </div>;
});
