import React, {memo, useEffect, useRef, useState} from 'react';
import {Pause, Play} from 'lucide-react';
import {CONVERSATION, TURN_DURATION, conversationFrame} from './conversation-timeline.js';

export const ProfileConversation=memo(function ProfileConversation({base,motion}) {
  const root=useRef(null), video=useRef(null);
  const [frame,setFrame]=useState(()=>conversationFrame(0));
  const [paused,setPaused]=useState(false), [visible,setVisible]=useState(false);
  const [started,setStarted]=useState(false), [failed,setFailed]=useState(false);
  const running=motion&&!paused&&visible&&!failed;
  const staticText=!motion||paused||failed||!started;
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
      const next=conversationFrame(film.currentTime*1000);
      setFrame(previous=>previous.index===next.index&&previous.words===next.words&&previous.speaking===next.speaking&&previous.leaving===next.leaving?previous:next);
      request=requestAnimationFrame(tick);
    };
    film.play().then(()=>{
      if(cancelled){film.pause();return;}
      setStarted(true);
      request=requestAnimationFrame(tick);
    }).catch(()=>{if(!cancelled)setPaused(true);});
    return()=>{cancelled=true;cancelAnimationFrame(request);film.pause();};
  },[running]);

  const choose=index=>{
    if(video.current&&!failed)video.current.currentTime=index*TURN_DURATION/1000;
    setFrame(conversationFrame(index*TURN_DURATION));
  };
  let wordIndex=0;
  return <div className={`profile-conversation${!motion?' is-still':''}`} ref={root}>
    <div className="conversation-canvas" aria-hidden="true">
      <img className="conversation-poster" src={poster} width="1280" height="720" alt="" loading="lazy" draggable="false"/>
      {!failed&&<video ref={video} className={`conversation-film${started&&motion?' is-ready':''}`} src={`${base}home-experiments/profile-conversation.mp4`} poster={poster} width="1280" height="720" muted playsInline loop preload="metadata" disablePictureInPicture onError={()=>setFailed(true)} aria-hidden="true"/>}
    </div>
    <header className="conversation-heading">
      <h1 id="c2-title"><span>Learn to speak</span><span>like LinkedIn.</span></h1>
      <p>Professional development for aspiring thought leaders.</p>
    </header>
    <div className="conversation-dialogue">
      <p className={`conversation-phrase${!staticText&&frame.leaving?' is-leaving':''}`} aria-hidden="true" key={frame.index}>{scene.lines.map((line,lineIndex)=><span className="conversation-line" key={lineIndex}>{line.split(' ').map(word=>{
        const index=wordIndex++;
        return <React.Fragment key={index}><span className={staticText||index<frame.words?'is-revealed':''}>{word}</span>{' '}</React.Fragment>;
      })}</span>)}</p>
      <div className="conversation-controls" aria-label="Conversation controls">
        <div className="conversation-turns" aria-label="Choose a speaker">{CONVERSATION.map((turn,index)=><button type="button" key={turn.speaker} aria-label={`Replay ${turn.speaker} speaker`} aria-pressed={frame.index===index} onClick={()=>choose(index)}><span/></button>)}</div>
        <button type="button" className="conversation-pause" aria-label={!motion?'Conversation motion is off':paused?'Resume conversation':'Pause conversation'} aria-pressed={paused||!motion} disabled={!motion||failed} onClick={()=>setPaused(value=>!value)}>{paused||!motion?<Play aria-hidden="true"/>:<Pause aria-hidden="true"/>}</button>
      </div>
    </div>
    <div className="c2-sr"><h2>A fictional corporate conversation</h2><p>Left speaker: {CONVERSATION[0].lines.join(' ')}</p><p>Right speaker: {CONVERSATION[1].lines.join(' ')}</p></div>
  </div>;
});
