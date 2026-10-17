import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Play,Pause,SkipBack,SkipForward,Volume2,VolumeX,LoaderCircle,ListMusic,Grid2X2,SlidersHorizontal,X,RotateCcw,ArrowUpRight,Check,Clapperboard,Subtitles,Mic,MicOff,Video,VideoOff,ChevronDown,UserRound} from 'lucide-react';
import {ConceptHeader} from '../home-2/ConceptHeader.jsx';
import {createRemixEngine,TRACKS,VOCABULARY,durationOf,formatTime} from '../studio-2/remix-engine.js';
import {MeetingBackdrop} from './MeetingBackdrop.jsx';
import {Participant} from './Participant.jsx';
import {PARTICIPANTS,SHORT_TITLES,MEETING_TITLES,activeParticipant,speakingParticipant} from './room.js';

function useReducedMotion(){
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
  return reduced;
}
function Choices({label,options,value,onChange}){
  return <fieldset className="meeting-choice"><legend>{label}</legend><div>{options.map(([id,label])=><button type="button" key={id} aria-pressed={value===id} onClick={()=>onChange(id)}>{label}</button>)}</div></fieldset>;
}

export function MeetingStudio(){
  const [initialIndex]=useState(()=>Math.max(0,TRACKS.findIndex(t=>t.id===new URLSearchParams(window.location.search).get('track'))));
  const engine=useRef(null),latest=useRef(null),scrubbing=useRef(false),lastVolume=useRef(.8),drawer=useRef(null),drawerTrigger=useRef(null),hasPlayed=useRef(false);
  const [state,setState]=useState(()=>({index:initialIndex,playing:false,loading:false,elapsed:0,energy:1,confidence:0,voice:'duet',volume:.8,text:TRACKS[initialIndex].pairs[0][0],speaker:'M',speaking:false,muted:{drums:false,keys:false,vocals:false,bass:false},queued:'',error:'',status:'Click any window to join. The mics control the mix.'}));
  const [focus,setFocus]=useState(null),[panel,setPanel]=useState(null),[scrub,setScrub]=useState(null),[captions,setCaptions]=useState(true),[autoDirector,setAutoDirector]=useState(false),[motionPaused,setMotionPaused]=useState(false),[videosEnabled,setVideosEnabled]=useState(true),[viewMenu,setViewMenu]=useState(false);
  const viewRoot=useRef(null),lastSpeaker=useRef(null);
  const reduced=useReducedMotion();latest.current=state;if(state.playing)hasPlayed.current=true;
  useEffect(()=>{
    const instance=createRemixEngine({onChange:setState,initialIndex,meetingVoices:true});engine.current=instance;
    const keyboard=e=>{
      if(e.key==='Escape'){setFocus(null);setAutoDirector(false);return;}
      if(e.code!=='Space'||e.repeat||e.metaKey||e.ctrlKey||e.altKey||e.target.closest('button,a,input,textarea,select,[contenteditable="true"]'))return;
      e.preventDefault();instance.toggle();
    };
    window.addEventListener('keydown',keyboard);
    return()=>{window.removeEventListener('keydown',keyboard);instance.dispose();engine.current=null;};
  },[initialIndex]);
  useEffect(()=>{setScrub(null);scrubbing.current=false;setFocus(null);lastSpeaker.current=null;},[state.index]);
  useEffect(()=>{if(panel)drawer.current?.scrollIntoView({behavior:reduced?'auto':'smooth',block:'nearest'});},[panel,reduced]);
  useEffect(()=>{if(!viewMenu)return;const outside=e=>{if(!viewRoot.current?.contains(e.target))setViewMenu(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[viewMenu]);
  const selectParticipant=useCallback(id=>{
    if(!hasPlayed.current){engine.current?.toggle();return;}
    setAutoDirector(false);setFocus(current=>current===id?null:id);
  },[]);
  const muteParticipant=useCallback(id=>engine.current?.participant(id),[]);
  const track=TRACKS[state.index],duration=durationOf(track),position=scrub??state.elapsed;
  const motion=!reduced&&!motionPaused;
  const active=activeParticipant(state),speaker=speakingParticipant(state);
  if(speaker)lastSpeaker.current=speaker;
  const spotlight=focus||(autoDirector?(speaker||lastSpeaker.current||'drums'):null);
  const hasCaption=captions&&!!speaker;
  const mutedCount=Object.values(state.muted).filter(Boolean).length;
  const togglePanel=(name,event)=>{drawerTrigger.current=event.currentTarget;setPanel(current=>current===name?null:name);};
  const closePanel=()=>{setPanel(null);drawerTrigger.current?.focus({preventScroll:true});};
  const grid=()=>{setFocus(null);setAutoDirector(false);setViewMenu(false);};
  const leaveMeeting=async()=>{if(latest.current.playing||latest.current.loading)await engine.current.toggle();engine.current.seek(0);hasPlayed.current=false;setFocus(null);setAutoDirector(false);setPanel(null);};
  const muteMaster=()=>{if(state.volume){lastVolume.current=state.volume;engine.current.volume(0);}else engine.current.volume(lastVolume.current||.8);};
  const seek=(value,commit=false)=>{
    if(commit||!scrubbing.current){engine.current.seek(value);setScrub(null);}else setScrub(Number(value));
  };
  const chooseTrack=i=>{engine.current.select(i);setFocus(null);};
  const changed=state.energy!==1||state.confidence!==0||state.voice!=='duet'||mutedCount>0;

  return <div className={`c2-home meeting-studio${!motion?' is-motion-paused':''}`} style={{'--beat-duration':`${60/track.bpm}s`}}>
    <a href="#meeting-player" className="meeting-skip">Skip to music player</a>
    <MeetingBackdrop engine={engine} playing={state.playing} index={state.index} reducedMotion={!motion}/>
    <ConceptHeader base="../" homeSectionBase="../" active="Studio"><span className="meeting-header-label">Studio</span><button type="button" className="meeting-header-mix" aria-expanded={panel==='mix'} aria-controls="meeting-tools" onClick={e=>togglePanel('mix',e)}>Mix <SlidersHorizontal aria-hidden="true"/></button></ConceptHeader>
    <div className="meeting-racing-band"><span>Get LinkedInified</span><span>Corporate performance division</span></div>
    <main className="meeting-main">
      <h1 className="meeting-sr">LinkedIn Beats — the meeting is the music video</h1>
      <div className="meeting-window">
      <div className="meeting-window-title"><Video aria-hidden="true"/><span>LinkedIn Beats Meeting</span></div>
      <div className="meeting-room-heading"><div className="meeting-title"><i className={state.playing?'is-live':''} aria-hidden="true"/><h2>{MEETING_TITLES[state.index]}</h2><span className="meeting-live-label">{state.playing?'Live mix':state.loading?'Connecting…':'Ready to join'}</span></div><div className="meeting-room-views" ref={viewRoot} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setViewMenu(false);viewRoot.current?.querySelector('button')?.focus();}}}><span>4 participants</span><button type="button" className="meeting-view-trigger" onClick={()=>setViewMenu(value=>!value)} aria-label="Choose meeting view" aria-expanded={viewMenu} aria-controls="meeting-view-options"><Grid2X2 aria-hidden="true"/><span>View</span><ChevronDown aria-hidden="true"/></button><div className="meeting-view-options" id="meeting-view-options" hidden={!viewMenu}><button type="button" aria-pressed={!spotlight} onClick={grid}><Grid2X2 aria-hidden="true"/>Gallery view{!spotlight&&<Check aria-hidden="true"/>}</button><button type="button" aria-pressed={!!spotlight} onClick={()=>{setFocus(null);setAutoDirector(true);setViewMenu(false);}}><UserRound aria-hidden="true"/>Speaker view{spotlight&&<Check aria-hidden="true"/>}</button></div></div></div>
      <section className={`meeting-grid${spotlight?' has-spotlight':''}`} aria-label="The office band, four participants">
        {PARTICIPANTS.map(person=><div className={`meeting-slot${person.id===spotlight?' is-main':''}${spotlight&&person.id!==spotlight?' is-thumbnail':''}`} key={person.id}>
          <Participant person={person} engine={engine} playing={state.playing} loading={state.loading} started={hasPlayed.current} muted={state.muted[person.id]} active={active===person.id} spotlight={person.id===spotlight} compact={!!spotlight&&person.id!==spotlight} caption={person.id===speaker&&hasCaption?state.text:''} motion={motion} videosEnabled={videosEnabled} onSelect={selectParticipant} onMute={muteParticipant}/>
        </div>)}
        {hasCaption&&spotlight&&spotlight!==speaker&&<div className="meeting-global-caption"><span>{state.text}</span></div>}
      </section>

      <section className="meeting-transport" id="meeting-player" aria-label="Six-track music player">
        <div className="meeting-song-strip">
        <div className="meeting-now-playing"><h2>{track.title}</h2><div><span>{String(state.index+1).padStart(2,'0')} / 06</span><b>·</b><span>{track.bpm} BPM</span><b>·</b><span>{state.muted.drums&&(state.muted.keys||state.voice==='robot')?'Beat only':state.voice==='robot'?'Robot 01':'Robot duet'}</span></div></div>
        <label className="meeting-seek"><span className="meeting-sr">Seek within {track.title}</span><input type="range" min="0" max={duration} step=".1" value={position} aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`} style={{'--progress':`${position/duration*100}%`}} onPointerDown={e=>{scrubbing.current=true;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerUp={e=>{scrubbing.current=false;seek(e.currentTarget.value,true);}} onPointerCancel={()=>{scrubbing.current=false;setScrub(null);}} onKeyDown={()=>{scrubbing.current=false;}} onChange={e=>seek(e.target.value)}/></label>
        <div className="meeting-time"><strong>{formatTime(position)}</strong><span>/ {formatTime(duration)}</span></div>
        <div className="meeting-volume"><button type="button" onClick={muteMaster} aria-label={state.volume?'Mute all audio':'Unmute audio'}>{state.volume?<Volume2 aria-hidden="true"/>:<VolumeX aria-hidden="true"/>}</button><input aria-label="Master volume" type="range" min="0" max="1" step=".01" value={state.volume} onChange={e=>engine.current.volume(e.target.value)}/></div>
        </div>
        <div className="meeting-call-toolbar" aria-label="Meeting and music controls">
          <div className="meeting-av-controls"><button type="button" className="meeting-call-control" onClick={muteMaster} aria-pressed={!state.volume} aria-label={state.volume?'Mute meeting audio':'Unmute meeting audio'}>{state.volume?<Mic aria-hidden="true"/>:<MicOff aria-hidden="true"/>}<span>{state.volume?'Mute':'Unmute'}</span></button><button type="button" className="meeting-call-control" onClick={()=>setVideosEnabled(value=>!value)} aria-pressed={!videosEnabled} aria-label={videosEnabled?'Stop participant videos':'Start participant videos'}>{videosEnabled?<Video aria-hidden="true"/>:<VideoOff aria-hidden="true"/>}<span>{videosEnabled?'Stop video':'Start video'}</span></button></div>
          <div className="meeting-playback-buttons"><button type="button" aria-label="Previous song or restart" title="Previous song" onClick={()=>engine.current.previous()}><SkipBack fill="currentColor" aria-hidden="true"/><span>Previous</span></button><button type="button" className="meeting-play" aria-label={state.loading?'Cancel loading':state.playing?'Pause song':'Play the meeting'} title="Play / pause (space)" onClick={()=>engine.current.toggle()}>{state.loading?<LoaderCircle className="meeting-spin" aria-hidden="true"/>:state.playing?<Pause fill="currentColor" aria-hidden="true"/>:<Play className="meeting-play-icon" aria-hidden="true"/>}<span>{state.loading?'Cancel':state.playing?'Pause':'Play'}</span></button><button type="button" aria-label="Next song" title="Next song" onClick={()=>engine.current.next()}><SkipForward fill="currentColor" aria-hidden="true"/><span>Next</span></button></div>
          <div className="meeting-center-controls"><button type="button" className="meeting-call-control" aria-expanded={panel==='tracks'} aria-controls="meeting-tools" onClick={e=>togglePanel('tracks',e)}><ListMusic aria-hidden="true"/><span>Tracks <small>6</small></span></button><button type="button" className="meeting-call-control" onClick={()=>setCaptions(value=>!value)} aria-pressed={captions}><Subtitles aria-hidden="true"/><span>Captions</span></button><button type="button" className="meeting-call-control" aria-expanded={panel==='mix'} aria-controls="meeting-tools" onClick={e=>togglePanel('mix',e)}><SlidersHorizontal aria-hidden="true"/><span>Remix</span></button></div>
          <button type="button" className="meeting-leave" onClick={leaveMeeting} disabled={!hasPlayed.current&&!state.loading}>Leave</button>
        </div>
      </section>
      </div>

      <nav className="meeting-playlist" aria-label="Choose a song">{TRACKS.map((item,i)=><button type="button" key={item.id} aria-current={state.index===i?'true':undefined} aria-label={`Play ${item.title}`} onClick={()=>chooseTrack(i)}><span>{String(i+1).padStart(2,'0')}</span><strong>{SHORT_TITLES[i]}</strong></button>)}</nav>
      <div className="meeting-notices"><span role="status">{state.error?<span className="meeting-error">{state.error}</span>:state.loading?'Getting everyone into the meeting…':!hasPlayed.current?'Click any window to play. Each mic controls a part of the mix.':mutedCount===4?'Everyone is muted. Unmute a mic to bring the meeting back.':state.queued?state.status:mutedCount?`${mutedCount} ${mutedCount===1?'participant':'participants'} muted. The meeting continues.`:'A meeting worth staying in.'}</span><div><button type="button" onClick={()=>setMotionPaused(value=>!value)} aria-pressed={motionPaused} disabled={reduced} title={reduced?'Reduced motion is enabled on your device':'Pause or resume the visuals'}><Clapperboard aria-hidden="true"/><span>{motionPaused||reduced?'Resume motion':'Pause motion'}</span></button></div></div>

      <section className="meeting-tools" id="meeting-tools" ref={drawer} hidden={!panel} aria-label={panel==='tracks'?'Choose your next track':'Mix the meeting'} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePanel();}}}>
        <div className="meeting-tools-heading"><div><span>{panel==='tracks'?'Six agenda items':'Host controls'}</span><h2>{panel==='tracks'?'The meeting could have been an album.':'Adjust your executive presence.'}</h2></div><button type="button" aria-label="Close studio controls" onClick={closePanel}><X aria-hidden="true"/></button></div>
        {panel==='tracks'?<ol className="meeting-track-list">{TRACKS.map((item,i)=><li key={item.id}><button type="button" aria-current={state.index===i?'true':undefined} onClick={()=>chooseTrack(i)}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{item.title}</strong><small>{item.genre} · {item.bpm} BPM</small></div><span className="meeting-track-duration">{formatTime(durationOf(item))}</span><Play aria-hidden="true"/></button></li>)}</ol>:<>
          <div className="meeting-choices"><Choices label="Beat energy" options={[[0,'Groove'],[1,'Build'],[2,'Drop']]} value={state.energy} onChange={v=>engine.current.setting('energy',v)}/><Choices label="Corporate confidence" options={[[0,'Humbled'],[1,'Visionary']]} value={state.confidence} onChange={v=>engine.current.setting('confidence',v)}/><Choices label="Robot delivery" options={[["robot",'Robot 01'],['duet','Duet']]} value={state.voice} onChange={v=>engine.current.setting('voice',v)}/></div>
          <div className="meeting-vocabulary-heading"><h3>Put a word in.</h3><p>Drop a phrase and its reply into the next passage.</p></div><div className="meeting-vocabulary">{VOCABULARY.map(item=><button type="button" key={item.id} disabled={!state.playing||(state.muted.drums&&state.muted.keys)} aria-pressed={state.queued===item.id} onClick={()=>engine.current.vocabulary(item.id)}>{item.label}{state.queued===item.id?<Check aria-hidden="true"/>:<ArrowUpRight aria-hidden="true"/>}</button>)}</div>
          <div className="meeting-mix-actions"><button type="button" disabled={state.loading} onClick={()=>engine.current.circleBack()}><RotateCcw aria-hidden="true"/>{state.queued==='chorus'?'Chorus queued':'Circle back to the chorus'}</button><button type="button" aria-pressed={autoDirector} disabled={!motion} onClick={()=>{setFocus(null);setAutoDirector(value=>!value);}}><Clapperboard aria-hidden="true"/>Auto spotlight {autoDirector?'on':'off'}</button><button type="button" disabled={!changed&&!state.queued} onClick={()=>engine.current.reset()}>Reset mix</button></div><p className="meeting-mix-status" role="status">{state.status}</p>
        </>}
      </section>
    </main>
    <footer className="meeting-footer"><span>LinkedIn Beats / Corporate racing division</span><a href="../studio-2/">ASCII studio <ArrowUpRight aria-hidden="true"/></a><a href="../store/">Shop wears <ArrowUpRight aria-hidden="true"/></a></footer>
  </div>;
}
