import React, {memo, useEffect, useRef, useState} from 'react';
import {ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, Copy, LoaderCircle, Menu, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X} from 'lucide-react';
import {TRACKS, LINES, formatTime} from '../home/tracks.js';
import {PRODUCTS} from '../store/products.js';
import {linkedinify} from '../lessons/generator.js';
import {createPortraitRadio} from './portraitRadio.js';
import './concept.css';

const INITIAL = {index:0, playing:false, loading:false, elapsed:0, volume:.8, text:LINES[1], word:-1, mouth:'rest', levels:null, error:''};
const PORTRAITS = [{index:2,tone:'ice'}, {index:0,tone:'paper'}, {index:1,tone:'pink'}, {index:3,tone:'navy'}];
const FEATURED = ['CS-104','CS-203','CS-501'].map(sku => PRODUCTS.find(p => p.sku === sku));
const TITLES = ['Out of Office', 'Circle Back', 'Could’ve Been an Email'];
const CAPTIONS = ['The crewneck · dusty pink', 'The cap · corporate blue', 'The mug · cream & cobalt'];
// Every frame uses one base head. Only a feathered lip area is replaced from
// the approved six-state study; head, glasses and texture never change.
const CROPS = {rest:[142,80], ah:[618,81], ee:[1094,80], oh:[144,540], oo:[621,540], closed:[1096,538]};
const cropStyle = name => ({left:`${-CROPS[name][0] / 300 * 100}%`, top:`${-CROPS[name][1] / 394 * 100}%`});
const calmWave = Array.from({length:48}, (_, i) => .1 + Math.abs(Math.sin(i * 1.89) * Math.cos(i * .28)) * .56);

const Portrait = memo(function Portrait({base, index, tone, active, playing, loading, mouth, choose}) {
  const visibleMouth = active && playing ? mouth : 'rest';
  return <button type="button" className={`c2-portrait c2-${tone} ${active?'is-selected':''}`} onClick={() => choose(index)} aria-pressed={active} aria-label={`${active&&playing?'Pause':'Play'} ${TRACKS[index].title}`}>
    <span className="c2-portrait-art" aria-hidden="true">
      <span className="c2-portrait-ink">
        <img className="c2-sheet" style={cropStyle('rest')} src={`${base}home-2/singing-states.webp`} alt="" width="1536" height="1024" draggable="false"/>
        <span className="c2-mouth-crop" data-mouth={visibleMouth} hidden={visibleMouth==='rest'}><img className="c2-sheet" style={cropStyle(visibleMouth)} src={`${base}home-2/singing-states.webp`} alt="" width="1536" height="1024" draggable="false"/></span>
      </span>
      <span className="c2-portrait-action">{active&&loading?<LoaderCircle className="c2-spin"/>:active&&playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</span>
    </span>
    <span className="c2-portrait-title">{TRACKS[index].title.replace(' (Remix)','')}</span>
  </button>;
});

export default function ConceptHome({playerFactory=createPortraitRadio}) {
  const base = window.location.pathname.replace(/home-2(?:\/(?:index\.html)?)?$/, '').replace(/\/?$/, '/');
  const radio = useRef(null), previousVolume = useRef(.8), menuRef = useRef(null), menuTrigger = useRef(null), chooseRef = useRef(null);
  const [state, setState] = useState(INITIAL), [menuOpen, setMenuOpen] = useState(false), [allTracks, setAllTracks] = useState(false);
  const [motion, setMotion] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [scrub, setScrub] = useState(null), [roastPost,setRoastPost] = useState(''), [ordinary,setOrdinary] = useState('');
  const [output,setOutput] = useState(''), [copyStatus,setCopyStatus] = useState('');
  const track = TRACKS[state.index], seconds = scrub ?? state.elapsed;
  const visiblePortraits = PORTRAITS.map((portrait,i)=>i===3&&state.index===4?{...portrait,index:4}:portrait);
  useEffect(() => {
    const player = playerFactory({phraseBase:`${base}phrases/`, onState:setState});
    radio.current = player;
    const key = e => {
      if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input,textarea,button,a,select,[contenteditable="true"]')) return;
      e.preventDefault(); player.toggle();
    };
    window.addEventListener('keydown',key);
    return () => {window.removeEventListener('keydown',key); player.dispose(); radio.current=null;};
  }, [base, playerFactory]);
  useEffect(() => {
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setMotion(!query.matches);
    query.addEventListener('change',update);
    return ()=>query.removeEventListener('change',update);
  },[]);
  useEffect(() => {
    if (!menuOpen) return;
    const key=e=>{if(e.key==='Escape'){setMenuOpen(false);menuTrigger.current?.focus();}};
    const outside=e=>{if(!menuRef.current?.contains(e.target))setMenuOpen(false);};
    document.addEventListener('keydown',key);document.addEventListener('pointerdown',outside);
    return ()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);};
  },[menuOpen]);
  const choose = index => {
    setScrub(null);
    if(index===state.index)radio.current?.toggle();
    else radio.current?.play(index);
  };
  chooseRef.current=choose;
  const stableChoose=useRef(index=>chooseRef.current(index)).current;
  const seek = value => {setScrub(null);radio.current?.seek(Number(value));};
  const mute=()=>{if(state.volume){previousVolume.current=state.volume;radio.current?.volume(0);}else radio.current?.volume(previousVolume.current||.8);};
  const roast=e=>{e.preventDefault();if(roastPost.trim())window.location.assign(`${base}roast/#roast=${encodeURIComponent(roastPost.trim())}`);};
  const generate=e=>{e.preventDefault();if(!ordinary.trim())return;setOutput(linkedinify(ordinary.trim(),Math.floor(Math.random()*4294967296)));setCopyStatus('');};
  const copy=async()=>{try{await navigator.clipboard.writeText(output);setCopyStatus('Copied');}catch{setCopyStatus('Select the text above to copy it.');}};
  return <div className={`c2-home ${motion?'':'c2-still'}`}>
    <a className="c2-skip" href="#c2-player">Skip to music player</a>
    <header className="c2-header" ref={menuRef}>
      <div className="c2-container c2-header-inner">
        <a href={base} className="c2-wordmark" aria-label="LinkedIn Beats current homepage">LinkedIn Beats<span>.</span></a>
        <nav className="c2-navigation" aria-label="Main navigation">
          <a href="#c2-player">Listen</a><a href="#c2-store">Store</a><a className="c2-tools-nav" href="#c2-tools">Tools</a>
          <button ref={menuTrigger} className="c2-menu-button" aria-expanded={menuOpen} aria-controls="c2-menu" onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?'Close':'Menu'}{menuOpen?<X/>:<Menu/>}</button>
        </nav>
        <nav id="c2-menu" className="c2-menu" aria-label="More pages" hidden={!menuOpen}>
          <a href={`${base}lessons/`}>LinkedIn Lessons <ArrowUpRight/></a><a href={`${base}studio/`}>The studio <ArrowUpRight/></a><a href={`${base}roast/`}>Roast my post <ArrowUpRight/></a><a href={`${base}store/`}>Company store <ArrowUpRight/></a>
          <button className="c2-motion-toggle" aria-pressed={motion} onClick={()=>setMotion(!motion)}>Animate portraits <span>{motion?'On':'Off'}</span></button>
          <a className="c2-original" href={base}>Current homepage <ArrowUpRight/></a>
        </nav>
      </div>
    </header>
    <main>
      <section className="c2-hero" aria-labelledby="c2-title">
        <div className="c2-container c2-hero-inner">
          <div className="c2-hero-copy">
            <h1 id="c2-title"><span>Humbled.</span><span>Honored.</span><em>On repeat.</em></h1>
            <p>The soundtrack of<br className="c2-copy-break"/> professional nonsense.</p>
            <a className="c2-text-link c2-hero-link" href="#c2-player">Meet your new office playlist <ArrowDownRight/></a>
          </div>
          <div className="c2-choir">
            <div className={`c2-lyrics ${state.playing?'is-singing':''}`} aria-label={`Lyrics: ${state.text}`}><div aria-hidden="true">{state.text.split(/\s+/).map((word,i)=><React.Fragment key={`${state.text}-${i}`}><span className={state.playing&&i===state.word?'is-current':''}>{word}</span>{' '}</React.Fragment>)}</div></div>
            <div className="c2-portraits">{visiblePortraits.map(({index,tone})=><Portrait key={tone} base={base} index={index} tone={tone} active={state.index===index} playing={state.index===index&&state.playing} loading={state.index===index&&state.loading} mouth={motion&&state.index===index?state.mouth:'rest'} choose={stableChoose}/>)}</div>
          </div>
        </div>
      </section>
      <section className="c2-player" id="c2-player" aria-label="Circle Back Radio music player">
        <div className="c2-container c2-player-inner">
          <button className="c2-play" onClick={()=>radio.current?.toggle()} aria-label={state.loading?'Cancel loading':state.playing?'Pause':'Play'}>{state.loading?<LoaderCircle className="c2-spin"/>:state.playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button>
          <div className="c2-now"><strong aria-live="polite">{track.title}</strong><span>{state.loading?'Tuning in…':'Circle Back Radio'}</span></div>
          <div className="c2-scrubber">
            <div className="c2-wave" aria-hidden="true">{(motion&&state.levels?state.levels:calmWave).map((level,i)=><i key={i} style={{height:`${3+level*25}px`}} className={i/48<seconds/track.seconds?'is-past':''}/>)}</div>
            <input type="range" aria-label="Track position" aria-valuetext={`${formatTime(seconds)} of ${formatTime(track.seconds)}`} min="0" max={track.seconds} step=".1" value={seconds} style={{'--c2-progress':`${seconds/track.seconds*100}%`}} onChange={e=>setScrub(Number(e.target.value))} onPointerUp={e=>seek(e.currentTarget.value)} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))seek(e.currentTarget.value);}} onBlur={e=>{if(scrub!==null)seek(e.currentTarget.value);}} onPointerCancel={()=>setScrub(null)}/>
          </div>
          <div className="c2-time"><time>{formatTime(seconds)}</time><span>/</span><time>{formatTime(track.seconds)}</time></div>
          <div className="c2-next-controls"><button className="c2-previous" aria-label="Previous track or restart" onClick={()=>{setScrub(null);radio.current?.previous();}}><SkipBack fill="currentColor"/></button><button aria-label="Next track" onClick={()=>{setScrub(null);radio.current?.next();}}><SkipForward fill="currentColor"/></button></div>
          <div className="c2-volume"><button onClick={mute} aria-label={state.volume?'Mute':'Unmute'}>{state.volume?<Volume2/>:<VolumeX/>}</button><input type="range" min="0" max="1" step=".01" value={state.volume} aria-label="Volume" onChange={e=>radio.current?.volume(Number(e.target.value))}/></div>
          <button className="c2-all-tracks" aria-expanded={allTracks} aria-controls="c2-track-list" onClick={()=>setAllTracks(!allTracks)}>All tracks <ChevronDown className={allTracks?'is-open':''}/></button>
        </div>
        {state.error&&<p className="c2-audio-error c2-container" role="alert">{state.error}</p>}
        <div className="c2-container" id="c2-track-list" hidden={!allTracks}><ol className="c2-track-list">{TRACKS.map((item,index)=><li key={item.title}><button aria-label={`${index===state.index&&state.playing?'Pause':'Play'} ${item.title}`} aria-current={index===state.index?'true':undefined} onClick={()=>choose(index)}><span>{index===state.index&&state.playing?<Pause size={17}/>:<Play size={17}/>}</span><strong>{item.title}</strong><span className="c2-track-genre">{item.genre}</span><time>{formatTime(item.seconds)}</time></button></li>)}</ol></div>
      </section>
      <section id="c2-store" className="c2-store c2-container" aria-labelledby="c2-store-title">
        <div className="c2-section-head"><h2 id="c2-store-title">Wear your boundaries.</h2><a className="c2-text-link" href={`${base}store/`}>Explore the collection <ArrowUpRight/></a></div>
        <div className="c2-products">{FEATURED.map((product,i)=><a className="c2-product" key={product.sku} href={`${base}store/?product=${product.sku}`} aria-label={`Explore ${product.name} — design preview`}><div className="c2-product-image"><img src={`${base}store/${product.img}`} width="1254" height="1254" loading="lazy" alt={product.name}/></div><div className="c2-product-info"><h3>{TITLES[i]}</h3><ArrowUpRight aria-hidden="true"/></div><p>{CAPTIONS[i]}</p></a>)}</div>
        <p className="c2-collection-note">The next collection. Designs in development.</p>
      </section>
      <section id="c2-tools" className="c2-tools c2-container" aria-label="Tools for professional nonsense">
        <article className="c2-roast">
          <div className="c2-tool-title"><h2>Roast my post.</h2><a href={`${base}roast/`} aria-label="Open Roast my post"><ArrowUpRight/></a></div>
          <p>A second opinion. In red pen.</p>
          <form onSubmit={roast}><label className="c2-sr" htmlFor="c2-roast-input">Your LinkedIn post</label><textarea className="c2-roast-paper" id="c2-roast-input" required maxLength={10000} rows={4} value={roastPost} onChange={e=>setRoastPost(e.target.value)} placeholder="Humbled to announce another inspiring week of circling back…"/><button className="c2-text-link c2-roast-submit" type="submit">Submit for review <ArrowUpRight/></button></form>
        </article>
        <article className="c2-linkedinifier">
          <div className="c2-tool-title"><h2>The LinkedInifier.</h2><a href={`${base}lessons/`} aria-label="Open LinkedIn Lessons"><ArrowUpRight/></a></div>
          <p>Small achievement. Big announcement.</p>
          <form onSubmit={generate}><label className="c2-sr" htmlFor="c2-ordinary">What happened?</label><textarea id="c2-ordinary" required maxLength={2000} rows={4} value={ordinary} onChange={e=>{setOrdinary(e.target.value);setOutput('');setCopyStatus('');}} placeholder="I made a cup of coffee. It was pretty good."/><button className="c2-generate" type="submit">Make it LinkedIn <ArrowRight/></button></form>
          {output&&<div className="c2-generated" aria-live="polite"><div>{output.split(/\n\n/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div><div className="c2-output-actions"><button className="c2-text-link" onClick={copy}>{copyStatus==='Copied'?<Check/>:<Copy/>}{copyStatus==='Copied'?'Copied':'Copy post'}</button><a className="c2-text-link" href={`${base}studio/#beat=${encodeURIComponent(output)}`}>Turn it into a beat <ArrowUpRight/></a></div>{copyStatus&&copyStatus!=='Copied'&&<p role="status">{copyStatus}</p>}</div>}
        </article>
      </section>
      <aside className="c2-studio-strip c2-container"><p>Something to get off your chest?</p><a className="c2-text-link" href={`${base}studio/`}>Put it to a beat <ArrowUpRight/></a></aside>
    </main>
    <footer className="c2-footer c2-container"><p>Independent music for dependent employees.</p><nav aria-label="Creator links"><a href="https://look-serious.com/">Look Serious <ArrowUpRight/></a><a href="https://aaroncphelps.com/">Aaron Phelps <ArrowUpRight/></a><a href="https://www.linkedin.com/in/aaroncphelps/">LinkedIn <ArrowUpRight/></a></nav><small>© {new Date().getFullYear()} LinkedIn Beats. Independent parody. Not affiliated with LinkedIn.</small></footer>
  </div>;
}
