import React,{useEffect,useRef,useState} from 'react';
import {Play,Pause,SkipForward,Video,VideoOff,Volume2,VolumeX,Captions,SlidersHorizontal,Users,Grid2X2,Maximize2,Minimize2,LoaderCircle,RotateCcw,ChevronRight,ChevronDown, X} from 'lucide-react';
import {ConceptHeader} from '../home-2/ConceptHeader.jsx';
import {ConceptFooter} from '../home-2/ConceptFooter.jsx';
import {agendas,agendaDescriptions,cast,meetings,meetingSequence,meetingFromSearch,nextMeeting,timeLabel,cueAt} from './catalog.js';
import {createMeetingEngine} from './engine.js';
import {Participant} from './Participant.jsx';

const initial={playing:false,loading:false,error:'',muted:false,music:.42,voices:1,elapsed:0};
export default function MeetingRoom(){
  const [meeting,setMeeting]=useState(()=>meetingFromSearch(typeof window==='undefined'?'':window.location.search)),[state,setState]=useState(initial),[time,setTime]=useState(0);
  const initialMeeting=useRef(meeting);
  const [captions,setCaptions]=useState(true),[videoOn,setVideoOn]=useState(true),[reactions,setReactions]=useState(true),[mixOpen,setMixOpen]=useState(false);
  const [follow,setFollow]=useState(false);
  const [pin,setPin]=useState(null),[left,setLeft]=useState(false),[reduced,setReduced]=useState(false),[full,setFull]=useState(false);
  const engine=useRef(null),room=useRef(null),playButton=useRef(null),mixButton=useRef(null),mixPanel=useRef(null);
  useEffect(()=>{
    const player=createMeetingEngine({onChange:setState});engine.current=player;player.setMeeting(initialMeeting.current);
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
  function selectMeeting(next){engine.current?.setMeeting(next);setMeeting(next);setTime(0);setPin(null);setFollow(false);setLeft(false);
    const url=new URL(window.location.href);url.searchParams.set('meeting',next.id);window.history.replaceState(null,'',url);
  }
  function advanceMeeting(){selectMeeting(nextMeeting(meeting.id));}
  function togglePlay(){if(left)setLeft(false);if(state.playing||state.loading)engine.current?.pause();else engine.current?.play();}
  function seekKey(e){
    const now=engine.current?.elapsed()||0;
    const targets={Home:0,End:meeting.duration,ArrowLeft:now-1,ArrowDown:now-1,ArrowRight:now+1,ArrowUp:now+1,PageDown:now-5,PageUp:now+5};
    if(Object.hasOwn(targets,e.key)){e.preventDefault();engine.current?.seek(targets[e.key]);}
  }
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await room.current?.requestFullscreen?.();}catch{/* The room remains fully usable when the browser disallows fullscreen. */}}
  const cue=cueAt(meeting,time),frame={time,cue};
  const spotlight=pin||(follow?(cue?.speaker&&cue.speaker!=='all'?cue.speaker:'synergy'):null);
  const finished=time>=meeting.duration-.02&&!state.playing&&!state.loading;
  const speaker=cue?.speaker==='all'?'The whole meeting':cue?.speakers?cue.speakers.map(id=>cast[id].name).join(' + '):cast[cue?.speaker]?.name;
  const fraction=Math.min(100,time/meeting.duration*100);
  const number=meetingSequence.findIndex(item=>item.id===meeting.id)+1;
  return <div className="c2-home mr-page">
    <ConceptHeader active="Studio" homeSectionBase="/" theme="dark"/>
    <main>
      <section className={`mr-room${state.playing?' is-playing':''}`} ref={room} aria-label="LinkedIn Beats meeting studio">
        <div className="mr-windowbar"><span className="mr-window-brand"><Video aria-hidden="true"/>LinkedIn Beats Meeting</span><h1>{meeting.title}</h1><span className="mr-window-status"><span className={`mr-dot${state.playing?' is-live':''}`} aria-hidden="true"/>{left?'Meeting adjourned':state.loading?'Connecting…':state.playing?'In progress':finished?'Meeting complete':'Hosted by Synergy'}</span></div>
        <div className="mr-stage">
          <div className="mr-gallery-tools"><span><Users aria-hidden="true"/>{String(meeting.roster.length).padStart(2,'0')} in the room</span><button onClick={()=>{setPin(null);setFollow(!(follow||pin));}} aria-pressed={!!spotlight}><Grid2X2 aria-hidden="true"/>{spotlight?'Gallery view':'Speaker view'}</button></div>
          <div className={`mr-gallery${spotlight?' has-spotlight':''}`} data-size={meeting.roster.length} data-agenda={meeting.agenda}>
            {meeting.roster.map(id=><Participant key={`${meeting.id}-${id}`} id={id} meeting={meeting} frame={frame} playing={state.playing} audible={!state.muted&&state.voices>0} musicOn={!state.muted&&state.music>0} videoOn={videoOn} reduced={reduced} pinned={spotlight===id} onPin={id=>{setFollow(false);setPin(spotlight===id?null:id);}} reactions={reactions}/>)}
          </div>
          {left&&<div className="mr-left"><span>MEETING ADJOURNED</span><h2>Great meeting.</h2><p>Nothing has changed.<br/>We should do this again.</p><button className="mr-new" onClick={()=>{setLeft(false);playButton.current?.focus();}}>Rejoin the meeting <ChevronRight aria-hidden="true"/></button></div>}
        </div>
        <div className={`mr-caption${time===0?' is-intro':''}${captions?'':' is-hidden'}`} aria-live="polite" aria-atomic="true">
          <span>{cue?speaker:finished?'Meeting minutes':time===0?'Your presence is incredibly valuable':'Please hold for further alignment'}</span>
          <p>{cue?cue.text:finished?'We’ll take the next steps offline.':time===0?'Press play. Let’s optimize the next forty seconds.':'♪ '+meeting.groove}</p>
        </div>
        <div className="mr-timeline"><div><span><b>{meeting.bpm} BPM</b> · {meeting.groove}</span><output aria-label="Meeting playback time">{timeLabel(time)} <em>/ {timeLabel(meeting.duration)}</em></output></div><input type="range" min="0" max={meeting.duration} step=".1" value={time} style={{'--progress':`${fraction}%`}} aria-label="Seek meeting" onKeyDown={seekKey} aria-valuetext={`${timeLabel(time)} of ${timeLabel(meeting.duration)}`} onChange={e=>engine.current?.seek(e.target.value)}/></div>
        {state.error&&<p className="mr-error" role="alert">{state.error} <button onClick={()=>engine.current?.play()}>Retry audio</button></p>}
        <div className="mr-toolbar">
          <div className="mr-playback"><button className="mr-play" ref={playButton} onClick={togglePlay} aria-label={state.loading?'Cancel audio loading':state.playing?'Pause meeting':finished?'Replay meeting':'Play meeting'}>{state.loading?<LoaderCircle className="mr-spin" aria-hidden="true"/>:state.playing?<Pause fill="currentColor" aria-hidden="true"/>:finished?<RotateCcw aria-hidden="true"/>:<Play fill="currentColor" aria-hidden="true"/>}<span>{state.loading?'Connecting':state.playing?'Pause':finished?'Replay':'Play meeting'}</span></button><button className="mr-tool" onClick={()=>engine.current?.setMix({muted:!state.muted})} aria-pressed={state.muted}>{state.muted?<VolumeX aria-hidden="true"/>:<Volume2 aria-hidden="true"/>}<span>{state.muted?'Unmute':'Sound'}</span></button></div>
          <div className="mr-toolbar-middle"><button className="mr-tool" onClick={()=>setVideoOn(!videoOn)} aria-pressed={videoOn}>{videoOn?<Video aria-hidden="true"/>:<VideoOff aria-hidden="true"/>}<span>{videoOn?'Stop video':'Start video'}</span></button><button className="mr-tool" onClick={()=>setCaptions(!captions)} aria-pressed={captions}><Captions aria-hidden="true"/><span>Captions</span></button><button className="mr-tool" ref={mixButton} onClick={()=>setMixOpen(!mixOpen)} aria-expanded={mixOpen} aria-controls="mr-mix"><SlidersHorizontal aria-hidden="true"/><span>Mix</span></button><button className="mr-tool mr-fullscreen" onClick={fullscreen} aria-label={full?'Exit fullscreen':'Enter fullscreen'}>{full?<Minimize2 aria-hidden="true"/>:<Maximize2 aria-hidden="true"/>}<span>Full screen</span></button></div>
          <div className="mr-meeting-actions"><button className="mr-new" onClick={advanceMeeting}><SkipForward aria-hidden="true"/><span>Next meeting</span></button><button className="mr-leave" onClick={()=>{engine.current?.pause();setLeft(true);}}>Leave</button></div>
        </div>
        {mixOpen&&<div className="mr-mix" id="mr-mix" ref={mixPanel} aria-label="Meeting mix"><div><strong>Your meeting. Your mix.</strong><button aria-label="Close mix" onClick={()=>{setMixOpen(false);mixButton.current?.focus();}}><X aria-hidden="true"/></button></div><label>Voices<input type="range" min="0" max="1" step=".01" value={state.voices} onChange={e=>engine.current?.setMix({voices:+e.target.value})}/></label><label>The beat<input type="range" min="0" max="1" step=".01" value={state.music} onChange={e=>engine.current?.setMix({music:+e.target.value})}/></label><label className="mr-check"><input type="checkbox" checked={reactions} onChange={e=>setReactions(e.target.checked)}/>Excessive encouragement</label></div>}
        <div className="mr-room-foot"><span>MEETING {String(number).padStart(2,'0')} OF {meetingSequence.length} <i>/</i> HOSTED BY SYNERGY</span><span>This could have been a beat.</span></div>
      </section>
      <section className="mr-agendas" aria-label="Meeting playlists">
        <details className="mr-agenda-disclosure">
          <summary><span>The agenda</span><span className="mr-agenda-count">7 playlists · 14 meetings</span><ChevronDown aria-hidden="true"/></summary>
          <div className="mr-playlists">{agendas.map(([id,label],i)=><article key={id} className={`mr-playlist${meeting.agenda===id?' is-current':''}`}>
            <div className="mr-playlist-heading"><span>{String(i+1).padStart(2,'0')}</span><h2>{label}</h2><span>{meetings[id][0].bpm} BPM</span></div>
            <p>{agendaDescriptions[id]}</p><span className="mr-playlist-sound">{meetings[id][0].groove}</span>
            <div className="mr-playlist-takes">{meetings[id].map((take,index)=><button key={take.id} aria-current={meeting.id===take.id?'true':undefined} onClick={()=>{selectMeeting(take);room.current?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});playButton.current?.focus({preventScroll:true});}}><span><small>Meeting {index+1} · {timeLabel(take.duration)}</small>{take.title}</span><ChevronRight aria-hidden="true"/></button>)}</div>
          </article>)}</div>
        </details>
      </section>
    </main>
    <ConceptFooter variant="dark"/>
  </div>;
}
