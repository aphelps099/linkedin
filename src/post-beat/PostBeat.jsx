import React,{useEffect,useMemo,useRef,useState} from 'react';
import {LoaderCircle,Music2,Pause,Play,RotateCcw,Share2,X} from 'lucide-react';
import {DURATION,makeRecipe,arrangement,voiceLines} from './composition.js';
import {createPostBeat} from './audio.js';
import {ShareBeat} from './ShareBeat.jsx';
import {DEFAULT_COVER,suggestedCaption} from './share.js';
import './post-beat.css';
const clock=t=>`0:${String(Math.floor(t)).padStart(2,'0')}`;
const WAVEFORM=[25,52,35,77,94,55,39,64,83,45,30,70,100,66,40,54,90,74,47,32,62,88,52,30,70,48,94,61,42,22,57,79,37,60,44,25];
export function PostBeat({post,initialRecipe,initialCover=DEFAULT_COVER,children,onModeChange,ticketControls,ticketScore,ticketNotice,heading}){
  const recipe=useMemo(()=>initialRecipe||makeRecipe(post),[post,initialRecipe]);
  const lines=useMemo(()=>{const voices=voiceLines(recipe);return arrangement(recipe).map((event,id)=>({...event,...voices[event.clip],id}));},[recipe]);
  const [phase,setPhase]=useState('idle'),[elapsed,setElapsed]=useState(0),[active,setActive]=useState({line:-1,word:-1});
  const [showSong,setShowSong]=useState(!!initialRecipe),[error,setError]=useState('');
  const [shareOpen,setShareOpen]=useState(false),[cover,setCover]=useState(initialCover);
  const [shareCaption,setShareCaption]=useState(()=>suggestedCaption(recipe));
  const engine=useRef(null),controller=useRef(null),frame=useRef(null),buffers=useRef(null),timeline=useRef([]),run=useRef(0),phaseRef=useRef('idle'),lyrics=useRef(null);
  const busy=phase==='preparing',playing=phase==='playing';
  const changePhase=value=>{phaseRef.current=value;setPhase(value);};
  const pause=()=>{cancelAnimationFrame(frame.current);engine.current?.pause();changePhase('paused');};
  const cancel=()=>{run.current++;controller.current?.abort();cancelAnimationFrame(frame.current);engine.current?.stop();changePhase('idle');setElapsed(0);setActive({line:-1,word:-1});};
  useEffect(()=>{onModeChange?.(showSong);},[showSong,onModeChange]);
  useEffect(()=>{
    const visibility=()=>{if(document.hidden&&phaseRef.current==='playing')pause();};
    document.addEventListener('visibilitychange',visibility);
    return ()=>{run.current++;controller.current?.abort();cancelAnimationFrame(frame.current);engine.current?.dispose();document.removeEventListener('visibilitychange',visibility);};
  },[]);
  useEffect(()=>{
    const container=lyrics.current,line=container?.querySelector(`[data-line="${active.line}"]`);
    if(line){const top=Math.max(0,line.offsetTop-container.clientHeight*.28);container.scrollTo({top,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  },[active.line,showSong]);
  const follow=()=>{
    let last=-1;
    const tick=()=>{
      const time=engine.current.elapsed();
      if(time-last<.05&&time<DURATION){frame.current=requestAnimationFrame(tick);return;}
      last=time;setElapsed(time);
      const cue=timeline.current.find(c=>time>=c.start&&time<c.end);
      const row=cue?.id??timeline.current.findLast(c=>time>=c.start)?.id??-1;
      const word=cue?.words.findIndex(w=>time>=w.start&&time<w.end)??-1;
      setActive(prev=>prev.line===row&&prev.word===word?prev:{line:row,word});
      if(time>=DURATION){changePhase('done');setActive({line:-1,word:-1});engine.current.stop();return;}
      frame.current=requestAnimationFrame(tick);
    };tick();
  };
  const play=async()=>{
    if(busy){cancel();return;}
    if(playing){pause();return;}
    setShowSong(true);setError('');
    if(phase==='paused'){engine.current.resume();changePhase('playing');follow();return;}
    changePhase('preparing');const attempt=++run.current;controller.current=new AbortController();
    try{
      if(!engine.current)engine.current=createPostBeat();
      engine.current.unlock();
      const prepared=buffers.current||await engine.current.prepare(recipe,controller.current.signal);
      if(attempt!==run.current)return;
      buffers.current=prepared;
      timeline.current=engine.current.play(recipe,prepared).cues;
      changePhase('playing');setElapsed(0);follow();
    }catch(e){if(attempt===run.current&&e.name!=='AbortError'){setError(e.message);changePhase('idle');}}
  };
  const restart=()=>{
    cancel();setShowSong(true);
    if(buffers.current){engine.current.unlock();timeline.current=engine.current.play(recipe,buffers.current).cues;changePhase('playing');follow();}
    else play();
  };
  const toggleView=()=>{if(showSong&&playing)pause();setShowSong(!showSong);};
  const share=()=>{if(busy)cancel();else if(playing)pause();setShareOpen(true);};
  const player=<div className={`pb-mini${playing?' is-playing':''}`} role="group" aria-label="Your beat player">
      <button className="pb-toggle" onClick={play} aria-label={busy?'Cancel beat preparation':playing?'Pause beat':phase==='paused'?'Resume beat':phase==='done'?'Replay beat':'Make and play beat'}>{busy?<X size={21}/>:playing?<Pause size={21} fill="currentColor"/>:<Play size={21} fill="currentColor"/>}</button>
      <div className="pb-track"><span>{busy?'Making your beat…':playing?'Now playing':phase==='paused'?'Paused':phase==='done'?'One more time?':'Your words. On repeat.'}</span><strong>{busy?<><LoaderCircle size={13}/>Finding the groove</>:phase==='idle'&&!initialRecipe?'Make this a beat':'The LinkedIn remix'}</strong></div>
      {ticketControls?<div className="pb-waveform" role="progressbar" aria-label="Beat progress" aria-valuenow={Math.floor(elapsed)} aria-valuemin={0} aria-valuemax={DURATION}>{WAVEFORM.map((height,i)=><i key={i} className={elapsed>0&&i/WAVEFORM.length<=elapsed/DURATION?'is-past':''} style={{height:`${height}%`}}/>)}</div>:<div className="pb-meter" aria-hidden="true">{[10,18,27,14,23,32,18,26,12].map((height,i)=><i key={i} style={{height,'--delay':`${-i*.13}s`}}/>)}</div>}
      <span className="pb-time">{clock(elapsed)}<small> / 0:30</small></span>
      {!ticketControls&&<button className="pb-share" onClick={share} aria-label="Share this beat" aria-haspopup="dialog"><Share2 size={15}/><span>Share this beat</span></button>}
      {!ticketControls&&<div className="pb-progress" role="progressbar" aria-label="Beat progress" aria-valuenow={Math.floor(elapsed)} aria-valuemin={0} aria-valuemax={DURATION}><span style={{width:`${elapsed/DURATION*100}%`}}/></div>}
    </div>;
  return <div className={`pb-inline${ticketControls?' pb-has-ticket':''}`}>
    {ticketControls?<section className="pb-ticket el-controls" aria-label="Supercharge and play your post"><div className="pb-ticket-main">{ticketControls}{player}</div>{ticketScore}</section>:player}
    {ticketControls&&<div className="pb-share-below"><button type="button" onClick={share} aria-haspopup="dialog"><Share2 size={24} aria-hidden="true"/><span>Share this beat</span></button><p>For the colleague who says “let’s take this offline.”</p></div>}
    {ticketNotice}
    {heading}
    {showSong&&<div className="pb-view-tools"><span><Music2 size={13}/>Sing along</span><div><button onClick={restart} aria-label="Restart beat" disabled={busy}><RotateCcw size={13}/></button>{!initialRecipe&&<button onClick={toggleView}>Read post</button>}</div></div>}
    {!showSong&&phase!=='idle'&&<div className="pb-view-tools"><span/><button onClick={toggleView}>Sing along</button></div>}
    {error&&<p className="pb-error" role="alert">{error}</p>}
    {shareOpen&&<ShareBeat recipe={recipe} coverId={cover} onCoverChange={setCover} caption={shareCaption} onCaptionChange={setShareCaption} onClose={()=>setShareOpen(false)}/>}
    {showSong?<div className={`pb-lyrics${phase==='idle'||busy?' is-ready':''}`} ref={lyrics} role="region" aria-label="Singalong lyrics" tabIndex={0}>
      {lines.map((line,i)=><p key={i} data-line={i} className={active.line===i?'is-current':''}>{line.text.split(/\s+/).map((word,j)=><span key={j} className={`pb-word${active.line===i&&active.word===j?' is-sung':''}${active.line===i&&active.word>j?' was-sung':''}`} aria-current={active.line===i&&active.word===j?'true':undefined}>{word}{' '}</span>)}</p>)}
      <span className="pb-endnote">Please circle back for an encore.</span>
    </div>:children}
  </div>;
}
