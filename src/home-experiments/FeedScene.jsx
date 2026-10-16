import React, {memo, useEffect, useRef, useState} from 'react';
import {Bell, BriefcaseBusiness, Heart, Home, Lightbulb, MessageSquare, Pause, Play, Search, ThumbsUp, Users} from 'lucide-react';
import {FEED_SCENES, SCENE_DURATION, feedFrame} from './feed-timeline.js';

const REACTIONS = [{name:'Like',Icon:ThumbsUp},{name:'Love',Icon:Heart},{name:'Insightful',Icon:Lightbulb}];
const Face = ({kind='author'}) => <span className={`feed-face feed-face--${kind}`} aria-hidden="true"/>;

function useFeedClock(root, motion, paused) {
  const elapsed = useRef(motion?0:15000), [frame,setFrame] = useState(()=>feedFrame(elapsed.current));
  const run = motion&&!paused;
  useEffect(()=>{
    if(!run)return;
    let visible=false, previous=null, publish=0, request;
    const observer = new IntersectionObserver(([entry])=>{visible=entry.isIntersecting&&entry.intersectionRatio>=.35;previous=null;},{threshold:[0,.35]});
    observer.observe(root.current);
    const onVisibility=()=>{previous=null;};
    document.addEventListener('visibilitychange',onVisibility);
    const tick=now=>{
      if(previous!==null&&visible&&!document.hidden){
        elapsed.current+=now-previous;
        if(now-publish>=40){setFrame(feedFrame(elapsed.current));publish=now;}
      }
      previous=now;request=requestAnimationFrame(tick);
    };
    request=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(request);observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);};
  },[run,root]);
  useEffect(()=>{
    if(!motion){elapsed.current=feedFrame(elapsed.current).sceneIndex*SCENE_DURATION+15000;setFrame(feedFrame(elapsed.current));}
  },[motion]);
  const select=index=>{elapsed.current=index*SCENE_DURATION+(motion?0:15000);setFrame(feedFrame(elapsed.current));};
  return [frame,select];
}

export const FeedScene = memo(function FeedScene({variant, motion, base}) {
  const root=useRef(null), scrollRegion=useRef(null), [paused,setPaused]=useState(false), [extra,setExtra]=useState([0,0,0]);
  const [frame,select]=useFeedClock(root,motion,paused), scene=FEED_SCENES[frame.sceneIndex];
  const laptop=variant==='laptop', running=motion&&!paused;
  useEffect(()=>setExtra([0,0,0]),[frame.sceneIndex]);
  useEffect(()=>{
    const viewport=scrollRegion.current;
    if(!laptop||!viewport)return;
    if(!motion||frame.comments===0){viewport.scrollTo({top:0,behavior:'instant'});return;}
    const latest=viewport.querySelectorAll('.feed-comment')[frame.comments-1];
    const overflow=latest.getBoundingClientRect().bottom-viewport.getBoundingClientRect().bottom+12;
    if(overflow>0)viewport.scrollTo({top:viewport.scrollTop+overflow,behavior:'smooth'});
  },[laptop,motion,frame.sceneIndex,frame.comments]);
  const counts=frame.counts.map((n,i)=>n+extra[i]);
  const post=<>
    <article className="feed-post">
      <header className="feed-author"><Face/><div><strong>{scene.author} <span>· 1st</span></strong><small>{scene.title}</small><small className="feed-post-time">Just now · ◉</small></div><span className="feed-more" aria-hidden="true">···</span></header>
      <p className="feed-post-copy">{scene.post}</p>
      <p className="feed-post-after">{scene.after}</p>
      <div className="feed-stats"><span><span className="feed-mini-reactions" aria-hidden="true"><ThumbsUp/><Heart/><Lightbulb/></span>{counts.reduce((a,b)=>a+b,0)} reactions</span><span>{frame.comments} {frame.comments===1?'comment':'comments'}</span></div>
      <div className="feed-reactions">
        {REACTIONS.map(({name,Icon},i)=><button key={name} type="button" aria-label={`${name} this fictional post`} className={`feed-reaction feed-reaction--${i}${counts[i]?' has-reacted':''}${running&&frame.clicking&&frame.activeReaction===i&&frame.pressed?' is-hit':''}`} onClick={()=>setExtra(previous=>previous.map((value,j)=>value+(j===i?1:0)))}><span key={counts[i]} className={`feed-reaction-orb${running&&counts[i]?' is-pulsing':''}`} aria-hidden="true"><Icon/></span><span>{name}</span><b>{counts[i]}</b></button>)}
      </div>
    </article>
    <div className={`feed-comments${!laptop?' feed-comments--stack':''}`} aria-label="Fictional comments">
      {scene.comments.map(([name,text],i)=>{
        const depth=Math.max(0,frame.comments-1-i), retired=!laptop&&motion&&depth>2;
        return <div key={`${scene.id}-${i}`} className={`feed-comment${frame.comments>i?' is-visible':''}${retired?' is-retired':''}`} style={!laptop?{'--stack-y':`${154-depth*72}px`,'--stack-x':`${depth===0?0:depth%2?12:-9}px`,'--stack-scale':1-depth*.035,'--stack-opacity':Math.max(0,1-depth*.14),'--stack-tilt':`${depth===0?0:depth%2?-.7:.7}deg`,zIndex:5+i}:undefined} aria-hidden={frame.comments<=i||retired}><Face kind={['a','b','c','d','e'][i]}/><div className="feed-comment-body"><strong>{name}<span> · 1st</span></strong><p>{text}</p></div></div>;
      })}
    </div>
  </>;
  return <div className={`c2-feed-layout c2-feed-layout--${variant} c2-container`}>
    <div className="c2-feed-copy">
      <h1 id="c2-title"><span>Learn to</span><span>sound like</span><span className="c2-repeat">LinkedIn.</span></h1>
      <p>Required listening for<br/> aspiring thought leaders.</p>
      <div className="feed-controls">
        <span className="feed-lesson" aria-live="polite">{scene.lesson}</span>
        <div className="feed-controls-actions"><div className="feed-scene-dots" aria-label="Choose a post">{FEED_SCENES.map((item,i)=><button type="button" key={item.id} aria-label={`Show ${item.id} post`} aria-pressed={frame.sceneIndex===i} onClick={()=>select(i)}><span/></button>)}</div><button type="button" className="feed-pause" aria-label={!motion?'Feed animation is off':paused?'Resume feed animation':'Pause feed animation'} aria-pressed={paused||!motion} disabled={!motion} onClick={()=>setPaused(value=>!value)}>{paused||!motion?<Play aria-hidden="true"/>:<Pause aria-hidden="true"/>}</button></div>
      </div>
    </div>
    <div className={`feed-visual feed-visual--${variant}`} ref={root} data-motion={motion?'on':'off'} style={{'--feed-sheet':`url("${base}home-experiments/profile-sheet.jpg")`}}>
      {laptop?<div className="feed-laptop">
        <div className="feed-laptop-lid"><span className="feed-webcam" aria-hidden="true"/><div className="feed-display">
          <div className="feed-social-nav" aria-hidden="true"><span className="feed-in">in</span><span className="feed-search"><Search/>Search</span><span className="feed-nav-item is-current"><Home/>Home</span><span className="feed-nav-item"><Users/>Network</span><span className="feed-nav-item"><BriefcaseBusiness/>Jobs</span><span className="feed-nav-item"><MessageSquare/>Messages</span><span className="feed-nav-item"><Bell/>Alerts</span></div>
          <div className="feed-social-body"><aside className="feed-profile" aria-hidden="true"><div className="feed-profile-cover"/><Face/><strong>Jordan Wells</strong><p>Turning ordinary moments into extraordinary announcements.</p><div><span>Profile viewers</span><b>147</b></div><div><span>Post impressions</span><b>8,042</b></div><small>My network<br/>Saved posts<br/>Groups</small></aside><div className="feed-scroll-viewport" ref={scrollRegion}><div className={`feed-thread${frame.leaving&&running?' is-leaving':''}`} data-scene={scene.id}>{post}</div></div></div>
        </div></div><div className="feed-laptop-base" aria-hidden="true"><span/></div><div className="feed-laptop-shadow" aria-hidden="true"/>
      </div>:<div className={`feed-thread${frame.leaving&&running?' is-leaving':''}`} data-scene={scene.id}>{post}</div>}
    </div>
  </div>;
});

export function ExperimentLinks({variant,base}) {
  return <nav className="feed-compare c2-container" aria-label="Compare homepage layouts"><span>Compare</span><a href={`${base}home-3/#c2-title`} aria-current={variant==='laptop'?'page':undefined}>Laptop</a><a href={`${base}home-4/#c2-title`} aria-current={variant==='screenless'?'page':undefined}>Screenless</a><a href={`${base}#c2-title`}>Original</a></nav>;
}
