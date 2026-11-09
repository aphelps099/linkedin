import {Singalong} from './Singalong.jsx';
import {onAudioFocus} from '../brand/audio-focus.js';
import {BeatType} from './BeatType.jsx';
import {BeatStage} from './BeatStage.jsx';
import {PegText,DotPlay} from '../program/arcade/Artwork.jsx';
import {BeatSettings} from './BeatSettings.jsx';
import {normalizeMix} from './mix.js';
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {LoaderCircle,Music2,Pause,Play,RotateCcw,Share2,Settings2,Maximize2,X} from 'lucide-react';
import {DURATION,makeRecipe,arrangement,voiceLines} from './composition.js';
import {createPostBeat} from './audio.js';
import {ShareBeat} from './ShareBeat.jsx';
import {DEFAULT_COVER,getCover,suggestedCaption} from './share.js';
import './post-beat.css';
import './studio.css';
const clock=t=>`0:${String(Math.floor(t)).padStart(2,'0')}`;
const WAVEFORM=[25,52,35,77,94,55,39,64,83,45,30,70,100,66,40,54,90,74,47,32,62,88,52,30,70,48,94,61,42,22,57,79,37,60,44,25];
export function PostBeat({post,initialRecipe,initialCover=DEFAULT_COVER,initialArtist='',children,onModeChange,ticketControls,ticketScore,ticketNotice,heading,presentation='default',playIcon,postHeader,postActions}){
  const postView=presentation==='post';
  const graduation=presentation==='graduation',listening=presentation==='listening';
  const baseRecipe=useMemo(()=>initialRecipe||makeRecipe(post),[post,initialRecipe]);
  const [mix,setMix]=useState(()=>normalizeMix(initialRecipe?.mix));
  const mixRef=useRef(mix);mixRef.current=mix;
  const [settingsOpen,setSettingsOpen]=useState(false),[stageOpen,setStageOpen]=useState(false);
  const recipe=useMemo(()=>({...baseRecipe,mix}),[baseRecipe,mix]);
  const lines=useMemo(()=>{const voices=voiceLines(recipe);return arrangement(recipe).map((event,id)=>({...event,...voices[event.clip],id}));},[recipe]);
  const [phase,setPhase]=useState('idle'),[elapsed,setElapsed]=useState(0);
  const [showSong,setShowSong]=useState(!!initialRecipe),[error,setError]=useState('');
  const [shareOpen,setShareOpen]=useState(false),[cover,setCover]=useState(initialCover);
  const [artist,setArtist]=useState(initialArtist);
  const [shareCaption,setShareCaption]=useState(()=>suggestedCaption(recipe));
  const engine=useRef(null),controller=useRef(null),frame=useRef(null),buffers=useRef(null),timeline=useRef([]),run=useRef(0),phaseRef=useRef('idle');
  const changeMix=value=>{setMix(value);engine.current?.setMix(value);};
  const busy=phase==='preparing',playing=phase==='playing';
  const changePhase=value=>{phaseRef.current=value;setPhase(value);};
  const pause=()=>{cancelAnimationFrame(frame.current);const time=engine.current?.elapsed();engine.current?.pause();if(time!==undefined)setElapsed(time);changePhase('paused');};
  const cancel=()=>{run.current++;controller.current?.abort();cancelAnimationFrame(frame.current);engine.current?.stop();changePhase('idle');setElapsed(0);setShowSong(false);};
  useEffect(()=>onAudioFocus('optimizer',()=>{if(phaseRef.current==='preparing')cancel();else if(phaseRef.current==='playing')pause();}),[]);
  useEffect(()=>{onModeChange?.(showSong);},[showSong,onModeChange]);
  useEffect(()=>{
    const visibility=()=>{if(document.hidden&&phaseRef.current==='playing')pause();};
    document.addEventListener('visibilitychange',visibility);
    return ()=>{run.current++;controller.current?.abort();cancelAnimationFrame(frame.current);engine.current?.dispose();document.removeEventListener('visibilitychange',visibility);};
  },[]);
  const follow=()=>{
    let last=-1;
    const tick=()=>{
      const time=engine.current.elapsed();
      if(time-last<.1&&time<DURATION){frame.current=requestAnimationFrame(tick);return;}
      last=time;setElapsed(time);
      if(time>=DURATION){changePhase('done');engine.current.stop();return;}
      frame.current=requestAnimationFrame(tick);
    };tick();
  };
  const play=async()=>{
    if(busy){cancel();return;}
    if(playing){pause();return;}
    setShowSong(true);setError('');
    if(phase==='paused'){engine.current.resume();changePhase('playing');follow();return;}
    changePhase('preparing');const attempt=++run.current;controller.current=new AbortController();
    let timedOut=false;const timeout=setTimeout(()=>{timedOut=true;controller.current?.abort();},90000);
    try{
      if(!engine.current)engine.current=createPostBeat();
      engine.current.unlock();
      const prepared=buffers.current||await engine.current.prepare(recipe,controller.current.signal);
      if(attempt!==run.current)return;
      buffers.current=prepared;
      timeline.current=engine.current.play({...recipe,mix:mixRef.current},prepared).cues;
      changePhase('playing');setElapsed(0);follow();
    }catch(e){if(attempt===run.current&&(e.name!=='AbortError'||timedOut)){setError(timedOut?'The vocals are taking too long. Try again in a moment.':e.message);changePhase('idle');setShowSong(false);}}finally{clearTimeout(timeout);}
  };
  const restart=()=>{
    cancel();setShowSong(true);
    if(buffers.current){engine.current.unlock();timeline.current=engine.current.play(recipe,buffers.current).cues;changePhase('playing');follow();}
    else play();
  };
  const toggleView=()=>{if(showSong&&playing)pause();setShowSong(!showSong);};
  const share=()=>{if(busy)cancel();else if(playing)pause();setShareOpen(true);};
  const player=<div className={`pb-mini${playing?' is-playing':''}`} role="group" aria-label="Your beat player">
      <button className="pb-toggle" onClick={play} aria-label={busy?'Cancel beat preparation':playing?'Pause beat':phase==='paused'?'Resume beat':phase==='done'?'Replay beat':postView?'Play the post':graduation?'Play your graduation single':listening?'Play single':'Make and play beat'}>{busy?<X size={21}/>:playing?<Pause size={21} fill="currentColor"/>:(playIcon||<DotPlay/>)}{postView&&<span>{busy?'Cancel':playing?'Pause':phase==='paused'?'Resume':'Play the post'}</span>}</button>
      <div className="pb-track"><span>{busy?'Making your beat…':playing?'Now playing':phase==='paused'?'Paused':phase==='done'?'One more time?':postView?'30-second remix · robot vocals':graduation?'Your post. Your debut.':listening?'30-second single':'Your words. On repeat.'}</span><strong><BeatType text={busy?'Finding the groove':postView?'Your words. Remixed.':phase==='idle'&&!initialRecipe?(graduation?'Play your single':'Make this a beat'):(graduation?'Your graduation single':listening?'Listen to the single':'The LinkedIn remix')}/></strong></div>
      {ticketControls?<div className="pb-waveform" role="progressbar" aria-label="Beat progress" aria-valuenow={Math.floor(elapsed)} aria-valuemin={0} aria-valuemax={DURATION}>{WAVEFORM.map((height,i)=><i key={i} className={elapsed>0&&i/WAVEFORM.length<=elapsed/DURATION?'is-past':''} style={{height:`${height}%`}}/>)}</div>:<div className="pb-meter" aria-hidden="true">{[10,18,27,14,23,32,18,26,12].map((height,i)=><i key={i} style={{height,'--delay':`${-i*.13}s`}}/>)}</div>}
      <span className="pb-time">{clock(elapsed)}<small> / 0:30</small></span>
      <button className="pb-settings-button" onClick={()=>setSettingsOpen(true)} aria-label="Beat settings" aria-haspopup="dialog"><Settings2 size={19}/></button>
      {!ticketControls&&<button className="pb-share" onClick={share} aria-label={listening?'Share this single':'Release your single'} aria-haspopup="dialog"><Share2 size={15}/><span><BeatType text={listening?'Share':'Release'}/></span></button>}
      {!ticketControls&&<div className="pb-progress" role="progressbar" aria-label="Beat progress" aria-valuenow={Math.floor(elapsed)} aria-valuemin={0} aria-valuemax={DURATION}><span style={{width:`${elapsed/DURATION*100}%`}}/></div>}
    </div>;
  const lyrics=<Singalong cues={timeline.current} fallback={lines[0].text} time={elapsed} playing={playing} idle={phase==='idle'||busy} bpm={recipe.bpm} getTime={()=>engine.current?.elapsed()||0}/>;
  const loading=<div className="pb-preparing" role="status"><PegText text="FINDING YOUR GROOVE" face="peg5"/><span className="pb-loading-pegs" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{'--peg-delay':`${i*70}ms`}}/>)}</span><p>Preparing your voice and band. First play can take a moment.</p><button type="button" onClick={cancel}>Cancel</button></div>;
  const stageEntry=!showSong&&!busy&&<div className="pb-stage-entry"><span>30 seconds of professional development.</span><button type="button" onClick={()=>{setShowSong(true);setStageOpen(true);}} aria-label="Open singalong player"><Maximize2 size={17}/><BeatType text="Open singalong"/></button></div>;
  const stageTools=<div className="pb-studio-tools"><span>{playing?'On air':phase==='paused'?'Paused':'Sing along'}<i aria-hidden="true" className={playing?'is-on':''}/></span><div><button type="button" onClick={restart} aria-label="Restart beat" disabled={busy}><RotateCcw size={17}/><BeatType text="Restart"/></button><button type="button" onClick={()=>setStageOpen(true)} aria-label="Open singalong player"><Maximize2 size={17}/><BeatType text="Pop out"/></button><button type="button" onClick={toggleView}>Hide lyrics</button></div></div>;
  return <div className={`pb-inline pb-studio${postView?' pb-post-view':ticketControls?' pb-has-ticket':''}`}>
    {postView?<>
      {heading}
      <article className="el-social-post" aria-label="LinkedIn-style post preview">
        {postHeader}
        {children}
        <div className="el-post-audio">
          {player}
          {error&&<p className="pb-error" role="alert">{error}</p>}
          {stageEntry}{busy?loading:showSong&&!stageOpen&&<>{stageTools}{lyrics}</>}
          {!showSong&&phase!=='idle'&&<div className="pb-view-tools"><span/><button onClick={toggleView}>Show lyrics</button></div>}
        </div>
        <div className="el-post-footer">{postActions}<button className="el-share-remix" type="button" onClick={share} aria-haspopup="dialog"><Share2 size={17} aria-hidden="true"/>Share the remix</button></div>
      </article>
      <section className="el-amplify el-controls" aria-label="Improve your post score">
        {ticketScore}
        <div className="el-amplify-action"><p>A little more thought leadership?</p>{ticketControls}</div>
      </section>
      <p className="el-score-note">Our very unofficial thought-leadership score. Not a LinkedIn ranking.</p>
      {ticketNotice}
    </>:<>
      {ticketControls?<section className="pb-ticket el-controls" aria-label="Supercharge and play your post"><div className="pb-ticket-main">{ticketControls}{player}</div>{ticketScore}</section>:player}
      {ticketControls&&<div className="pb-share-below"><button type="button" onClick={share} aria-haspopup="dialog"><Share2 size={24} aria-hidden="true"/><span><BeatType text={listening?'Share':'Release'}/></span></button></div>}
      {ticketNotice}
      {heading}
      {stageEntry}
      {busy?loading:showSong&&!stageOpen?<>{stageTools}{lyrics}</>:!showSong&&phase!=='idle'?<div className="pb-view-tools"><span/><button onClick={toggleView}>Show lyrics</button></div>:null}
      {error&&<p className="pb-error" role="alert">{error} <button type="button" onClick={play}>Try again</button></p>}
      {!showSong&&children}
    </>}
    {stageOpen&&<BeatStage onClose={()=>setStageOpen(false)}><div className="pb-inline pb-studio">{busy?loading:lyrics}{player}{error&&<p className="pb-error" role="alert">{error}</p>}</div></BeatStage>}
    {settingsOpen&&<BeatSettings mix={mix} onChange={changeMix} onClose={()=>setSettingsOpen(false)} playing={playing} busy={busy} onPlay={play}/>}
    {shareOpen&&<ShareBeat artist={artist} onArtistChange={setArtist} recipe={recipe} coverId={cover} onCoverChange={setCover} caption={shareCaption} onCaptionChange={setShareCaption} onClose={()=>setShareOpen(false)}/>}
  </div>;
}
