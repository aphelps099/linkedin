import React, {memo, useEffect, useRef, useState} from 'react';
import {ArrowUpRight, ChevronDown, LoaderCircle, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX} from 'lucide-react';
import {TRACKS, LINES, formatTime} from '../home/tracks.js';
import {PRODUCTS} from '../store/products.js';
import {ConceptHeader} from './ConceptHeader.jsx';
import {Campaigns} from './Campaigns.jsx';
import {ConceptFooter} from './ConceptFooter.jsx';
import {createPortraitRadio} from './portraitRadio.js';
import '../brand/fonts.css';
import './concept.css';
import './header.css';
import './campaigns.css';
import './footer.css';

const INITIAL = {index:0, playing:false, loading:false, elapsed:0, volume:.8, text:LINES[1], word:-1, mouth:'rest', levels:null, error:''};
const PORTRAITS = [{index:2,tone:'ice'}, {index:0,tone:'paper'}, {index:1,tone:'pink'}, {index:3,tone:'navy'}];
const FEATURED = ['CS-104','CS-203','CS-501'].map(sku => PRODUCTS.find(p => p.sku === sku));
const CAPTIONS = ['Dusty pink', 'Cobalt blue', 'Cream + cobalt'];
// Singing frames replace only the feathered lip area. A separate, brief
// illustrated head turn introduces the selected singer when playback starts.
const CROPS = {rest:[142,80], ah:[618,81], ee:[1094,80], oh:[144,540], oo:[621,540], closed:[1096,538]};
const cropStyle = name => ({left:`${-CROPS[name][0] / 300 * 100}%`, top:`${-CROPS[name][1] / 394 * 100}%`});
const calmWave = Array.from({length:48}, (_, i) => .1 + Math.abs(Math.sin(i * 1.89) * Math.cos(i * .28)) * .56);

const Portrait = memo(function Portrait({base, index, tone, active, playing, loading, mouth, motion, choose}) {
  const visibleMouth = active && playing ? mouth : 'rest';
  return <button type="button" className={`c2-portrait c2-${tone} ${active?'is-selected':''}`} onClick={() => choose(index)} aria-pressed={active} aria-label={`${active&&playing?'Pause':'Play'} ${TRACKS[index].title}`}>
    <span className="c2-portrait-art" aria-hidden="true">
      <span className="c2-portrait-ink">
        <img className="c2-sheet" style={cropStyle('rest')} src={`${base}home-2/singing-states.webp`} alt="" width="1536" height="1024" draggable="false"/>
        <span className="c2-mouth-crop" data-mouth={visibleMouth} hidden={visibleMouth==='rest'}><img className="c2-sheet" style={cropStyle(visibleMouth)} src={`${base}home-2/singing-states.webp`} alt="" width="1536" height="1024" draggable="false"/></span>
        <img key={index} className={`c2-turn-frame ${active&&playing&&motion?'is-turning':''}`} src={`${base}home-2/portrait-turn.webp`} alt="" width="1095" height="1437" decoding="async" draggable="false"/>
      </span>
      <span className="c2-portrait-action">{active&&loading?<LoaderCircle className="c2-spin"/>:active&&playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</span>
    </span>
    <span className="c2-portrait-title">{active&&playing&&<span className="c2-portrait-meter" aria-hidden="true"><i/><i/><i/></span>}{TRACKS[index].title.replace(' (Remix)','')}</span>
  </button>;
});

export default function ConceptHome({playerFactory=createPortraitRadio}) {
  const base = window.location.pathname.replace(/home-2(?:\/(?:index\.html)?)?$/, '').replace(/\/?$/, '/');
  const radio = useRef(null), previousVolume = useRef(.8), chooseRef = useRef(null);
  const [state, setState] = useState(INITIAL), [allTracks, setAllTracks] = useState(false);
  const [motion, setMotion] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [scrub, setScrub] = useState(null);
  const track = TRACKS[state.index], seconds = scrub ?? state.elapsed;
  const visiblePortraits = PORTRAITS.map((portrait,i)=>i===3&&state.index===4?{...portrait,index:4}:portrait);
  const activeTone = visiblePortraits.find(p=>p.index===state.index)?.tone || 'paper';
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
  const choose = index => {
    setScrub(null);
    if(index===state.index)radio.current?.toggle();
    else radio.current?.play(index);
  };
  chooseRef.current=choose;
  const stableChoose=useRef(index=>chooseRef.current(index)).current;
  const seek = value => {setScrub(null);radio.current?.seek(Number(value));};
  const mute=()=>{if(state.volume){previousVolume.current=state.volume;radio.current?.volume(0);}else radio.current?.volume(previousVolume.current||.8);};
  return <div className={`c2-home ${motion?'':'c2-still'}`}>
    <a className="c2-skip" href="#c2-player">Skip to music player</a>
    <ConceptHeader base={base} onRadio={()=>radio.current?.toggle()} playing={state.playing} loading={state.loading}/>
    <main>
      <section className="c2-hero" aria-labelledby="c2-title">
        <div className="c2-container c2-hero-inner">
          <div className="c2-hero-copy">
            <h1 id="c2-title"><span>Humbled.</span><span>Honored.</span><span className="c2-repeat">On repeat.</span></h1>
            <p>The soundtrack of<br className="c2-copy-break"/> professional nonsense.</p>
            <button className="c2-hero-listen" onClick={()=>radio.current?.toggle()} aria-pressed={state.playing} aria-label={state.loading?'Cancel soundtrack loading':state.playing?'Pause the soundtrack':'Play the soundtrack'}>{state.loading?<LoaderCircle className="c2-spin"/>:state.playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}<span>{state.loading?'Tuning in…':state.playing?'Pause the soundtrack':'Play the soundtrack'}</span></button>
          </div>
          <div className="c2-choir">
            <div className={`c2-lyrics ${state.playing?'is-singing':''}`} aria-label={`Lyrics: ${state.text}`}><div aria-hidden="true">{state.text.split(/\s+/).map((word,i)=><React.Fragment key={`${state.text}-${i}`}><span className={state.playing&&i===state.word?'is-current':''}>{word}</span>{' '}</React.Fragment>)}</div></div>
            <div className="c2-portraits" style={{gridTemplateColumns:visiblePortraits.map(({index})=>index===state.index?'1.07fr':'1fr').join(' ')}}>{visiblePortraits.map(({index,tone})=><Portrait key={tone} base={base} index={index} tone={tone} active={state.index===index} playing={state.index===index&&state.playing} loading={state.index===index&&state.loading} mouth={motion&&state.index===index?state.mouth:'rest'} motion={motion} choose={stableChoose}/>)}</div>
          </div>
        </div>
      </section>
      <section className="c2-player" id="c2-player" aria-label="Circle Back Radio music player">
        <div className="c2-container c2-player-inner">
          <button className="c2-play" onClick={()=>radio.current?.toggle()} aria-label={state.loading?'Cancel loading':state.playing?'Pause':'Play'}>{state.loading?<LoaderCircle className="c2-spin"/>:state.playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button>
          <div className="c2-now-group">
            <span className={`c2-now-cover c2-${activeTone}`} aria-hidden="true"><span className="c2-portrait-art"><span className="c2-portrait-ink"><img className="c2-sheet" style={cropStyle('rest')} src={`${base}home-2/singing-states.webp`} alt="" width="1536" height="1024"/></span></span></span>
            <div className="c2-now"><strong aria-live="polite">{track.title}</strong><span>{state.loading?'Tuning in…':'Circle Back Radio'}</span></div>
          </div>
          <div className="c2-scrubber">
            <div className="c2-wave" aria-hidden="true">{(motion&&state.levels?state.levels:calmWave).map((level,i)=><i key={i} style={{height:`${3+level*34}px`}} className={i/48<seconds/track.seconds?'is-past':''}/>)}</div>
            <input type="range" aria-label="Track position" aria-valuetext={`${formatTime(seconds)} of ${formatTime(track.seconds)}`} min="0" max={track.seconds} step=".1" value={seconds} style={{'--c2-progress':`${seconds/track.seconds*100}%`}} onChange={e=>setScrub(Number(e.target.value))} onPointerUp={e=>seek(e.currentTarget.value)} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))seek(e.currentTarget.value);}} onBlur={e=>{if(scrub!==null)seek(e.currentTarget.value);}} onPointerCancel={()=>setScrub(null)}/>
          </div>
          <div className="c2-time"><time>{formatTime(seconds)}</time><span>/</span><time>{formatTime(track.seconds)}</time></div>
          <div className="c2-next-controls"><button className="c2-previous" aria-label="Previous track or restart" onClick={()=>{setScrub(null);radio.current?.previous();}}><SkipBack fill="currentColor"/></button><button aria-label="Next track" onClick={()=>{setScrub(null);radio.current?.next();}}><SkipForward fill="currentColor"/></button></div>
          <div className="c2-volume"><button onClick={mute} aria-label={state.volume?'Mute':'Unmute'}>{state.volume?<Volume2/>:<VolumeX/>}</button><input type="range" min="0" max="1" step=".01" value={state.volume} aria-label="Volume" onChange={e=>radio.current?.volume(Number(e.target.value))}/></div>
          <button className="c2-all-tracks" aria-expanded={allTracks} aria-controls="c2-track-list" onClick={()=>setAllTracks(!allTracks)}>All tracks <ChevronDown className={allTracks?'is-open':''}/></button>
        </div>
        {state.error&&<p className="c2-audio-error c2-container" role="alert">{state.error}</p>}
        <div className="c2-container" id="c2-track-list" hidden={!allTracks}><ol className="c2-track-list">{TRACKS.map((item,index)=><li key={item.title}><button aria-label={`${index===state.index&&state.playing?'Pause':'Play'} ${item.title}`} aria-current={index===state.index?'true':undefined} onClick={()=>choose(index)}><span>{index===state.index&&state.playing?<Pause size={17}/>:<Play size={17}/>}</span><strong>{item.title}</strong><span className="c2-track-genre">{item.genre}</span><time>{formatTime(item.seconds)}</time></button></li>)}</ol><button className="c2-motion-toggle" aria-pressed={motion} onClick={()=>setMotion(!motion)}>Animate portraits <span>{motion?'On':'Off'}</span></button></div>
      </section>
      <section id="c2-store" className="c2-store" aria-labelledby="c2-store-title">
        <div className="c2-container">
          <div className="c2-section-head">
            <p className="c2-eyebrow">The company store</p>
            <h2 id="c2-store-title">Wear your boundaries.</h2>
            <p className="c2-store-intro">For the life you lead outside the meeting.</p>
          </div>
          <div className="c2-products">{FEATURED.map((product,i)=><a className="c2-product" key={product.sku} href={`${base}store/?product=${product.sku}`} aria-label={`Explore ${product.name} — design preview`}>
            <div className="c2-product-image"><img src={`${base}store/${product.img}`} width="1254" height="1254" loading="lazy" alt={product.name}/></div>
            <div className="c2-product-info"><h3>{product.name}</h3><ArrowUpRight aria-hidden="true"/></div>
            <p>{CAPTIONS[i]}</p>
          </a>)}</div>
          <div className="c2-store-action">
            <a className="c2-collection-link" href={`${base}store/`}>Explore the collection <ArrowUpRight aria-hidden="true"/></a>
            <p className="c2-collection-note">Collection preview</p>
          </div>
        </div>
      </section>
      <Campaigns base={base}/>
    </main>
    <ConceptFooter base={base}/>
  </div>;
}
