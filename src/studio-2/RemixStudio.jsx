import React, {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, ArrowRight, Play, Pause, SkipBack, SkipForward, RotateCcw, Volume2, VolumeX, LoaderCircle, Check} from 'lucide-react';
import {ConceptHeader} from '../home-2/ConceptHeader.jsx';
import {createRemixEngine, TRACKS, VOCABULARY, durationOf, formatTime} from './remix-engine.js';

function Droid({speaking=false}) {
  return <svg className={`s2-droid ${speaking?'is-speaking':''}`} viewBox="0 0 38 30" aria-hidden="true">
    <path d="M9 13V11a10 10 0 0 1 20 0v2M7 14h24v10H7zM5 21H2v7h6v-4m23-3h5v7h-6v-4M12 25h14v3H12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
    <rect x="19" y="6" width="7" height="4" rx="1" fill="currentColor"/><path d="M12 18h6m-6 3h6" stroke="currentColor" strokeWidth="1.4"/><circle className="s2-droid-light" cx="26" cy="19" r="1.5" fill="currentColor"/>
  </svg>;
}
function Meter({engine,playing}) {
  const root=useRef(null);
  useEffect(()=>{
    let frame;
    const draw=()=>{
      const data=engine.current?.spectrum();
      root.current?.childNodes.forEach((bar,i)=>{bar.style.transform=`scaleY(${data?Math.max(.08,(data[i*3+2]||0)/255):.08})`;});
      if(playing)frame=requestAnimationFrame(draw);
    };
    draw();return()=>cancelAnimationFrame(frame);
  },[playing,engine]);
  return <span className="s2-meter" ref={root} aria-hidden="true">{Array.from({length:16},(_,i)=><i key={i}/>)}</span>;
}
function Choices({label,help,options,value,onChange}) {
  return <div className="s2-control"><div className="s2-control-heading"><h3>{label}</h3><span>{help}</span></div><div className="s2-choices" role="group" aria-label={label}>{options.map(([id,title])=><button type="button" key={id} aria-pressed={value===id} onClick={()=>onChange(id)}>{title}</button>)}</div></div>;
}

export function RemixStudio() {
  const initialIndex=Math.max(0,TRACKS.findIndex(track=>track.id===new URLSearchParams(window.location.search).get('track')));
  const engine=useRef(null),pointer=useRef(false),lastVolume=useRef(.8);
  const [state,setState]=useState(()=>({index:initialIndex,playing:false,loading:false,elapsed:0,energy:1,confidence:0,
    voice:'duet',volume:.8,text:TRACKS[initialIndex].pairs[0][0],response:TRACKS[initialIndex].pairs[0][1],speaker:'M',speaking:false,
    queued:'',status:'Choose a track. Make a small scene.',error:''}));
  const [scrub,setScrub]=useState(null);
  useEffect(()=>{
    const instance=createRemixEngine({onChange:setState,initialIndex});engine.current=instance;
    const keyboard=e=>{
      if(e.code!=='Space'||e.repeat||e.metaKey||e.ctrlKey||e.altKey||e.target.closest('button,a,input,textarea,select,[contenteditable="true"]'))return;
      e.preventDefault();instance.toggle();
    };
    window.addEventListener('keydown',keyboard);
    return()=>{window.removeEventListener('keydown',keyboard);instance.dispose();engine.current=null;};
  },[]);
  const track=TRACKS[state.index],duration=durationOf(track),position=scrub??state.elapsed;
  const beat=Math.floor(state.elapsed*track.bpm/60)%4;
  const changed=state.energy!==1||state.confidence!==0||state.voice!=='duet';
  const instrumental=state.voice==='instrumental';
  const mute=()=>{if(state.volume){lastVolume.current=state.volume;engine.current.volume(0);}else engine.current.volume(lastVolume.current||.8);};
  return <div className="c2-home studio-next">
    <a className="s2-skip" href="#remix-player">Skip to player</a>
    <ConceptHeader base="../" homeSectionBase="../" active="Studio"><a className="s2-version" href="../studio/">Original studio <ArrowUpRight aria-hidden="true"/></a></ConceptHeader>
    <main className="s2-shell">
      <div className="s2-intro"><div><p className="s2-kicker">LinkedIn Beats <span>/</span> Studio 02</p><h1>Sound important.</h1></div><p>Pick a beat. Adjust your confidence.<br/>Circle back indefinitely.</p></div>
      <div className="s2-workstation" id="remix-player">
        <section className={`s2-player ${state.playing?'is-playing':''}`} aria-label="Remix player">
          <div className="s2-stage">
            <div className="s2-orbits" aria-hidden="true"><i/><i/><i/></div>
            <div className="s2-stage-top"><span><i className={state.playing?'is-on':''}/>{state.playing?'In circulation':state.loading?'Preparing the floor':'Ready for circulation'}</span><span>{track.bpm} BPM <b>·</b> {track.key}</span></div>
            <div className="s2-lyric-area"><div className="s2-speaker"><Droid speaking={state.playing&&state.speaking&&!instrumental}/><span>{instrumental?'The robots are on mute':`Office terminal ${state.speaker==='F'?'02':'01'}`}</span><span className="s2-speaker-rule"/></div><p className={`s2-lyric ${state.text.length>48?'is-long':''} ${instrumental?'is-instrumental':''}`} key={`${state.text}-${instrumental}`}>{instrumental?'Let the beat do the talking.':state.text}</p><p className="s2-response">{instrumental?'No commentary. Unprecedented.':state.response||'Please remain professionally engaged.'}</p></div>
            <div className="s2-stage-bottom"><span className="s2-beat-dots" aria-label={`Bar ${Math.min(32,Math.floor(state.elapsed*track.bpm/240)+1)} of 32`}>{[0,1,2,3].map(n=><i key={n} className={state.playing&&beat===n?'is-on':''}/>)}</span><span>Very serious music.</span><Meter engine={engine} playing={state.playing}/></div>
          </div>
          <div className="s2-transport">
            <div className="s2-now"><div><span>Now in rotation</span><h2>{track.title}</h2></div><div className="s2-time"><strong>{formatTime(position)}</strong><span>/ {formatTime(duration)}</span></div></div>
            <label className="s2-seek"><span className="s2-sr">Seek within {track.title}</span><input type="range" min="0" max={duration} step=".1" value={position} aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`} style={{'--progress':`${position/duration*100}%`}} onPointerDown={()=>{pointer.current=true;}} onPointerUp={e=>{pointer.current=false;engine.current.seek(e.currentTarget.value);setScrub(null);}} onPointerCancel={()=>{pointer.current=false;setScrub(null);}} onChange={e=>{if(pointer.current)setScrub(Number(e.target.value));else engine.current.seek(e.target.value);}}/></label>
            <div className="s2-playback-row"><div className="s2-playback"><button type="button" aria-label="Previous track or restart" onClick={()=>engine.current.previous()}><SkipBack aria-hidden="true"/></button><button type="button" className="s2-play" aria-label={state.loading?'Cancel loading':state.playing?'Pause track':'Play track'} onClick={()=>engine.current.toggle()}>{state.loading?<LoaderCircle className="s2-spin" aria-hidden="true"/>:state.playing?<Pause aria-hidden="true"/>:<Play aria-hidden="true"/>}</button><button type="button" aria-label="Next track" onClick={()=>engine.current.next()}><SkipForward aria-hidden="true"/></button></div><button type="button" className={`s2-circle ${state.queued==='chorus'?'is-queued':''}`} onClick={()=>engine.current.circleBack()} disabled={state.loading}><RotateCcw aria-hidden="true"/><span>{state.queued==='chorus'?'Queued':'Circle back'}</span></button><div className="s2-volume"><button type="button" aria-label={state.volume?'Mute audio':'Unmute audio'} onClick={mute}>{state.volume?<Volume2 aria-hidden="true"/>:<VolumeX aria-hidden="true"/>}</button><input aria-label="Volume" type="range" min="0" max="1" step=".01" value={state.volume} onChange={e=>engine.current.volume(e.target.value)}/></div></div>
          </div>
        </section>
        <aside className="s2-playlist" aria-label="Beat tracks"><div className="s2-playlist-heading"><h2>The rotation.</h2><span>06 tracks</span></div><p className="s2-playlist-intro">Original beats.<br/>Questionable announcements.</p><ol>{TRACKS.map((item,i)=><li key={item.id}><button type="button" className={state.index===i?'is-selected':''} aria-current={state.index===i?'true':undefined} aria-label={`Play ${item.title}, ${item.genre}, ${item.bpm} BPM`} onClick={()=>engine.current.select(i)}><span className="s2-track-number">{state.index===i&&state.playing?<span className="s2-mini-meter" aria-hidden="true"><i/><i/><i/></span>:String(i+1).padStart(2,'0')}</span><span className="s2-track-copy"><strong>{item.title}</strong><span>{item.genre}</span></span><span className="s2-track-bpm">{item.bpm}<small>BPM</small></span></button></li>)}</ol><div className="s2-playlist-note"><ArrowRight aria-hidden="true"/><p>{track.description}</p></div></aside>
      </div>
      <section className="s2-remix" aria-labelledby="remix-heading"><div className="s2-remix-heading"><h2 id="remix-heading">Make it your business.</h2><button type="button" onClick={()=>engine.current.reset()} disabled={!changed&&!state.queued}><RotateCcw aria-hidden="true"/>Reset mix</button></div><div className="s2-controls">
        <Choices label="Beat energy" help="How big is this meeting?" value={state.energy} onChange={v=>engine.current.setting('energy',v)} options={[[0,'Desk'],[1,'Team'],[2,'All hands']]}/>
        <Choices label="Corporate confidence" help="Every word. Entirely sincere." value={state.confidence} onChange={v=>engine.current.setting('confidence',v)} options={[[0,'Humbled'],[1,'Visionary']]}/>
        <Choices label="Office voices" help="Emotionally unavailable." value={state.voice} onChange={v=>engine.current.setting('voice',v)} options={['robot','duet','instrumental'].map((id,i)=>[id,['Robot 01','Duet','Beat only'][i]])}/>
      </div><div className="s2-vocabulary"><div><h3>Deploy some vocabulary.</h3><p>A statement. A response. Back to business.</p></div><div className="s2-vocabulary-pads" role="group" aria-label="Corporate phrase pairs">{VOCABULARY.map(item=><button type="button" key={item.id} disabled={!state.playing||instrumental} aria-pressed={state.queued===item.id} onClick={()=>engine.current.vocabulary(item.id)}>{item.label}{state.queued===item.id?<Check aria-hidden="true"/>:<ArrowUpRight aria-hidden="true"/>}</button>)}</div></div><div className="s2-status" role="status"><span className={state.error?'is-error':''}>{state.error||state.status}</span><span>Changes land on the beat.</span></div></section>
    </main>
    <footer className="s2-footer"><a href="../">LinkedIn Beats <ArrowUpRight aria-hidden="true"/></a><p>Professional development. Technically.</p><a href="../store/">Take it offline. Shop wears. <ArrowUpRight aria-hidden="true"/></a></footer>
  </div>;
}
