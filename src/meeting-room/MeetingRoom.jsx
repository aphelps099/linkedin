import React,{useEffect,useRef,useState} from 'react';
import {Play,Pause,Shuffle,Video,VideoOff,Volume2,VolumeX,Captions,SlidersHorizontal,Users,Grid2X2,Maximize2,Minimize2,LoaderCircle,RotateCcw,ChevronRight,Check, X} from 'lucide-react';
import {ConceptHeader} from '../home-2/ConceptHeader.jsx';
import {agendas,cast,meetings,nextVariant,timeLabel,cueAt} from './catalog.js';
import {createMeetingEngine} from './engine.js';
import {Participant} from './Participant.jsx';

const initial={playing:false,loading:false,error:'',muted:false,music:.42,voices:1,elapsed:0};
export default function MeetingRoom(){
  const [meeting,setMeeting]=useState(meetings.standup[0]),[state,setState]=useState(initial),[time,setTime]=useState(0);
  const [captions,setCaptions]=useState(true),[videoOn,setVideoOn]=useState(true),[reactions,setReactions]=useState(true),[mixOpen,setMixOpen]=useState(false);
  const [follow,setFollow]=useState(false);
  const [pin,setPin]=useState(null),[left,setLeft]=useState(false),[reduced,setReduced]=useState(false),[full,setFull]=useState(false),[number,setNumber]=useState(1);
  const engine=useRef(null),room=useRef(null),playButton=useRef(null),mixButton=useRef(null),mixPanel=useRef(null),lastVariants=useRef({standup:0});
  useEffect(()=>{
    const player=createMeetingEngine({onChange:setState});engine.current=player;player.setMeeting(meetings.standup[0]);
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(motion.matches);update();motion.addEventListener('change',update);
    const visibility=()=>{if(document.hidden)player.pause();};document.addEventListener('visibilitychange',visibility);
    const fullscreen=()=>setFull(!!document.fullscreenElement);document.addEventListener('fullscreenchange',fullscreen);
    return()=>{player.dispose();motion.removeEventListener('change',update);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('fullscreenchange',fullscreen);};
  },[]);
  useEffect(()=>{let raf,last=0;const tick=now=>{if(now-last>60){setTime(engine.current?.elapsed()||0);last=now;}raf=requestAnimationFrame(tick);};if(state.playing)raf=requestAnimationFrame(tick);else setTime(state.elapsed);return()=>cancelAnimationFrame(raf);},[state.playing,state.elapsed]);
  useEffect(()=>{
    if(!mixOpen)return;mixPanel.current?.querySelector('input')?.focus();
    const close=e=>{if(e.key==='Escape'){setMixOpen(false);mixButton.current?.focus();}};
    document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);
  },[mixOpen]);
  function selectMeeting(next){engine.current?.setMeeting(next);setMeeting(next);setTime(0);setPin(null);setFollow(false);setLeft(false);setNumber(n=>n+1);lastVariants.current[next.agenda]=next.variant;}
  function newMeeting(){selectMeeting(nextVariant(meeting.agenda,meeting.variant));}
  function chooseAgenda(agenda){selectMeeting(nextVariant(agenda,lastVariants.current[agenda]??-1));}
  function togglePlay(){if(left)setLeft(false);if(state.playing||state.loading)engine.current?.pause();else engine.current?.play();}
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await room.current?.requestFullscreen?.();}catch{/* The room remains fully usable when the browser disallows fullscreen. */}}
  const cue=cueAt(meeting,time),frame={time,cue};
  const spotlight=pin||(follow?(cue?.speaker&&cue.speaker!=='all'?cue.speaker:'synergy'):null);
  const finished=time>=meeting.duration-.02&&!state.playing&&!state.loading;
  const speaker=cue?.speaker==='all'?'The whole meeting':cast[cue?.speaker]?.name;
  const fraction=Math.min(100,time/meeting.duration*100);
  return <div className="c2-home mr-page">
    <ConceptHeader active="Studio" homeSectionBase="/"><a className="mr-nav-current" href="/studio/">Studio <span>↗</span></a></ConceptHeader>
    <div className="mr-racing"><span className="mr-slashes" aria-hidden="true"/><span>SOUND LIKE YOU MEAN BUSINESS</span><span className="mr-racing-right">MEETING STUDIO / 01</span></div>
    <main>
      <section className={`mr-room${state.playing?' is-playing':''}`} ref={room} aria-label="LinkedIn Beats meeting studio">
        <div className="mr-windowbar"><Video aria-hidden="true"/><span>LinkedIn Beats Meeting</span><span className="mr-secure"><Check aria-hidden="true"/>Absolutely aligned</span></div>
        <div className="mr-room-head">
          <div className="mr-heading"><h1>{meeting.title}</h1><p><span className={`mr-dot${state.playing?' is-live':''}`} aria-hidden="true"/>{left?'You left the meeting':state.loading?'Connecting to the meeting…':state.playing?'Meeting in progress':finished?'Exceptional alignment. Zero action items.':'Hosted by Synergy'}<span className="mr-meta-separator">·</span><span>{meeting.roster.length} participants</span></p></div>
          <div className="mr-room-options"><label className="mr-agenda">Agenda<select aria-label="Agenda" value={meeting.agenda} onChange={e=>chooseAgenda(e.target.value)}>{agendas.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><button className="mr-new" onClick={newMeeting}><Shuffle aria-hidden="true"/>New meeting</button></div>
        </div>
        <div className="mr-stage">
          <div className="mr-gallery-tools"><span><Users aria-hidden="true"/>{String(meeting.roster.length).padStart(2,'0')} in the room</span><button onClick={()=>{setPin(null);setFollow(!(follow||pin));}} aria-pressed={!!spotlight}><Grid2X2 aria-hidden="true"/>{spotlight?'Gallery view':'Speaker view'}</button></div>
          <div className={`mr-gallery${spotlight?' has-spotlight':''}`} data-size={meeting.roster.length}>
            {meeting.roster.map(id=><Participant key={`${meeting.id}-${id}`} id={id} meeting={meeting} frame={frame} playing={state.playing} audible={!state.muted&&state.voices>0} musicOn={!state.muted&&state.music>0} videoOn={videoOn} reduced={reduced} pinned={spotlight===id} onPin={id=>{setFollow(false);setPin(spotlight===id?null:id);}} reactions={reactions}/>)}
          </div>
          {left&&<div className="mr-left"><span>MEETING ADJOURNED</span><h2>Great meeting.</h2><p>Nothing has changed.<br/>We should do this again.</p><button className="mr-new" onClick={()=>{setLeft(false);playButton.current?.focus();}}>Rejoin the meeting <ChevronRight aria-hidden="true"/></button></div>}
        </div>
        <div className={`mr-caption${captions?'':' is-hidden'}`} aria-live="polite" aria-atomic="true">
          <span>{cue?speaker:finished?'Meeting minutes':time===0?'Your presence is incredibly valuable':'Please hold for further alignment'}</span>
          <p>{cue?cue.text:finished?'We’ll take the next steps offline.':time===0?'Press play. Let’s optimize the next forty seconds.':'♪ '+meeting.groove}</p>
        </div>
        <div className="mr-timeline"><div><span><b>{meeting.bpm} BPM</b> · {meeting.groove}</span><output aria-label="Meeting playback time">{timeLabel(time)} <em>/ {timeLabel(meeting.duration)}</em></output></div><input type="range" min="0" max={meeting.duration} step=".1" value={time} style={{'--progress':`${fraction}%`}} aria-label="Seek meeting" aria-valuetext={`${timeLabel(time)} of ${timeLabel(meeting.duration)}`} onChange={e=>engine.current?.seek(e.target.value)}/></div>
        {state.error&&<p className="mr-error" role="alert">{state.error} <button onClick={()=>engine.current?.play()}>Retry audio</button></p>}
        <div className="mr-toolbar">
          <div className="mr-playback"><button className="mr-play" ref={playButton} onClick={togglePlay} aria-label={state.loading?'Cancel audio loading':state.playing?'Pause meeting':finished?'Replay meeting':'Play meeting'}>{state.loading?<LoaderCircle className="mr-spin" aria-hidden="true"/>:state.playing?<Pause fill="currentColor" aria-hidden="true"/>:finished?<RotateCcw aria-hidden="true"/>:<Play fill="currentColor" aria-hidden="true"/>}<span>{state.loading?'Connecting':state.playing?'Pause':finished?'Replay':'Play meeting'}</span></button><button className="mr-tool" onClick={()=>engine.current?.setMix({muted:!state.muted})} aria-pressed={state.muted}>{state.muted?<VolumeX aria-hidden="true"/>:<Volume2 aria-hidden="true"/>}<span>{state.muted?'Unmute':'Sound'}</span></button></div>
          <div className="mr-toolbar-middle"><button className="mr-tool" onClick={()=>setVideoOn(!videoOn)} aria-pressed={videoOn}>{videoOn?<Video aria-hidden="true"/>:<VideoOff aria-hidden="true"/>}<span>{videoOn?'Stop video':'Start video'}</span></button><button className="mr-tool" onClick={()=>setCaptions(!captions)} aria-pressed={captions}><Captions aria-hidden="true"/><span>Captions</span></button><button className="mr-tool" ref={mixButton} onClick={()=>setMixOpen(!mixOpen)} aria-expanded={mixOpen} aria-controls="mr-mix"><SlidersHorizontal aria-hidden="true"/><span>Mix</span></button><button className="mr-tool mr-fullscreen" onClick={fullscreen} aria-label={full?'Exit fullscreen':'Enter fullscreen'}>{full?<Minimize2 aria-hidden="true"/>:<Maximize2 aria-hidden="true"/>}<span>Full screen</span></button></div>
          <button className="mr-leave" onClick={()=>{engine.current?.pause();setLeft(true);}}>Leave</button>
        </div>
        {mixOpen&&<div className="mr-mix" id="mr-mix" ref={mixPanel} aria-label="Meeting mix"><div><strong>Your meeting. Your mix.</strong><button aria-label="Close mix" onClick={()=>{setMixOpen(false);mixButton.current?.focus();}}><X aria-hidden="true"/></button></div><label>Robot vocals<input type="range" min="0" max="1" step=".01" value={state.voices} onChange={e=>engine.current?.setMix({voices:+e.target.value})}/></label><label>The beat<input type="range" min="0" max="1" step=".01" value={state.music} onChange={e=>engine.current?.setMix({music:+e.target.value})}/></label><label className="mr-check"><input type="checkbox" checked={reactions} onChange={e=>setReactions(e.target.checked)}/>Excessive encouragement</label></div>}
        <div className="mr-room-foot"><span>MEETING {String(number).padStart(2,'0')} <i>/</i> HOSTED BY SYNERGY</span><span>This could have been a beat.</span></div>
      </section>
      <section className="mr-next" aria-label="More meeting agendas"><div><span>THE AGENDA</span><h2>Exceptional meetings.<br/>Questionable outcomes.</h2></div><div className="mr-agenda-links">{agendas.map(([id,label],i)=><button key={id} className={meeting.agenda===id?'is-current':''} onClick={()=>{chooseAgenda(id);room.current?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});}}><span>{String(i+1).padStart(2,'0')}</span>{label}<ChevronRight aria-hidden="true"/></button>)}</div></section>
    </main>
    <footer className="mr-site-foot"><a href="/">LinkedIn Beats_</a><p>Corporate jargon. Robot vocals. Unreasonably good beats.</p><a href="/lessons/">Get LinkedInified ↗</a></footer>
  </div>;
}
