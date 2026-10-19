import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {ArrowUpRight, ChevronDown, LoaderCircle, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX} from 'lucide-react';
import {TRACKS, LINES, formatTime} from '../home/tracks.js';
import {PRODUCTS} from '../store/products.js';
import {ConceptHeader} from './ConceptHeader.jsx';
import {HeroVideo} from './HeroVideo.jsx';
import {Campaigns} from './Campaigns.jsx';
import {ConceptFooter} from './ConceptFooter.jsx';
import {NewsletterSignup} from './NewsletterSignup.jsx';
import {createPortraitRadio} from './portraitRadio.js';
import {PixelSpectrum} from './PixelSpectrum.jsx';
import {FeedScene, ExperimentLinks} from '../home-experiments/FeedScene.jsx';
import {ProfileConversation} from '../home-experiments/ProfileConversation.jsx';
import {DevelopmentRadio} from '../home-experiments/DevelopmentRadio.jsx';
import '../brand/fonts.css';
import './concept.css';
import './player.css';
import './header.css';
import './campaigns.css';
import './footer.css';
import '../home-experiments/feed-scene.css';
import '../home-experiments/profile-conversation.css';
import '../home-experiments/development-radio.css';

const INITIAL = {index:0, playing:false, loading:false, elapsed:0, volume:.8, text:LINES[1], word:-1, mouth:'rest', levels:null, error:''};
const PORTRAITS = [{index:2,tone:'ice'}, {index:0,tone:'paper'}, {index:1,tone:'pink'}, {index:3,tone:'navy'}];
const FEATURED = ['CS-104','CS-203','CS-501'].map(sku => PRODUCTS.find(p => p.sku === sku));
// Singing frames replace only the feathered lip area. A separate, brief
// illustrated head turn introduces the selected singer when playback starts.
const CROPS = {rest:[142,80], ah:[618,81], ee:[1094,80], oh:[144,540], oo:[621,540], closed:[1096,538]};
const cropStyle = name => ({left:`${-CROPS[name][0] / 300 * 100}%`, top:`${-CROPS[name][1] / 394 * 100}%`});

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

export default function ConceptHome({playerFactory=createPortraitRadio, variant='portraits'}) {
  const experiment=['laptop','screenless','conversation'].includes(variant);
  const base = window.location.pathname.replace(/home-[2345](?:\/(?:index\.html)?)?$/, '').replace(/index\.html$/, '').replace(/\/?$/, '/');
  const radio = useRef(null), previousVolume = useRef(.8), chooseRef = useRef(null);
  const [state, setState] = useState(INITIAL), [allTracks, setAllTracks] = useState(false);
  const [motion, setMotion] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [scrub, setScrub] = useState(null), [pressedKey, setPressedKey] = useState('');
  const pressTimer = useRef(null);
  useEffect(()=>()=>clearTimeout(pressTimer.current),[]);
  const track = TRACKS[state.index], seconds = scrub ?? state.elapsed;
  const visiblePortraits = PORTRAITS.map((portrait,i)=>i===3&&state.index===4?{...portrait,index:4}:portrait);
  const activeTone = visiblePortraits.find(p=>p.index===state.index)?.tone || 'paper';
  useEffect(() => {
    // Keep earlier homepage section links useful after promoting this design.
    const anchors = {'#listen':'c2-player', '#store':'c2-store', '#about':'c2-footer'};
    const followAnchor = (initial=false) => {
      const hash = window.location.hash;
      const target = anchors[hash] || (initial && ['#c2-title','#c2-player','#c2-store','#c2-tools','#c2-footer','#newsletter'].includes(hash) ? hash.slice(1) : null);
      if (!target) return;
      if (anchors[hash]) window.history.replaceState(null,'',`${window.location.pathname}${window.location.search}#${target}`);
      document.getElementById(target)?.scrollIntoView({behavior:'instant', block:'start'});
    };
    followAnchor(true);
    const onHashChange = () => followAnchor();
    window.addEventListener('hashchange',onHashChange);
    return () => window.removeEventListener('hashchange',onHashChange);
  }, []);
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
  const skip = direction => {
    setScrub(null); setPressedKey(direction); clearTimeout(pressTimer.current);
    pressTimer.current=setTimeout(()=>setPressedKey(''),420);
    radio.current?.[direction]();
  };
  const mute=()=>{if(state.volume){previousVolume.current=state.volume;radio.current?.volume(0);}else radio.current?.volume(previousVolume.current||.8);};
  const pauseRadio=useCallback(()=>{
    const status=radio.current?.getState();
    if(status?.playing||status?.loading)radio.current.toggle();
  },[]);
  return <div className={`c2-home ${motion?'':'c2-still'}${experiment?` c2-home--experiment c2-home--${variant}`:''}`}>
    <a className="c2-skip" href="#c2-player">Skip to music player</a>
    <ConceptHeader base={base} overlay onRadio={()=>radio.current?.toggle()} playing={state.playing} loading={state.loading}/>
    <main>
      <HeroVideo radioActive={state.playing||state.loading} onSoundEnable={pauseRadio}/>
      <section className="c2-hero" aria-labelledby="c2-title">
        {variant==='conversation'?<ProfileConversation motion={motion} base={base}/>:experiment?<FeedScene variant={variant} motion={motion} base={base}/>:<div className="c2-container c2-hero-inner">
          <div className="c2-hero-copy">
            <h1 id="c2-title"><span>Humbled.</span><span>Honored.</span><span className="c2-repeat">On repeat.</span></h1>
            <p>The soundtrack of<br className="c2-copy-break"/> professional nonsense.</p>
          </div>
          <div className="c2-choir">
            <div className={`c2-lyrics ${state.playing?'is-singing':''}`} aria-label={`Lyrics: ${state.text}`}><div aria-hidden="true">{state.text.split(/\s+/).map((word,i)=><React.Fragment key={`${state.text}-${i}`}><span className={state.playing&&i===state.word?'is-current':''}>{word}</span>{' '}</React.Fragment>)}</div></div>
            <div className="c2-portraits" style={{gridTemplateColumns:visiblePortraits.map(({index})=>index===state.index?'1.07fr':'1fr').join(' ')}}>{visiblePortraits.map(({index,tone})=><Portrait key={tone} base={base} index={index} tone={tone} active={state.index===index} playing={state.index===index&&state.playing} loading={state.index===index&&state.loading} mouth={motion&&state.index===index?state.mouth:'rest'} motion={motion} choose={stableChoose}/>)}</div>
          </div>
        </div>}
      {variant!=='conversation'&&<section className="c2-player" id="c2-player" aria-label="Circle Back Radio music player">
        <div className="c2-container c2-player-inner">
          <button type="button" className={`c2-key c2-play ${state.playing||state.loading?'is-active':''}`} aria-pressed={state.playing} onClick={()=>radio.current?.toggle()} aria-label={state.loading?'Cancel loading':state.playing?'Pause':'Play'}>{state.loading?<LoaderCircle className="c2-spin"/>:state.playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button>
          <div className="c2-now-group">
            {experiment?<span className="c2-now-cover c2-now-cover--feed" aria-hidden="true"><span>in</span><b>BEATS</b></span>:<span className={`c2-now-cover c2-${activeTone}`} aria-hidden="true"><span className="c2-portrait-art"><span className="c2-portrait-ink"><img className="c2-sheet" style={cropStyle('rest')} src={`${base}home-2/singing-states.webp`} alt="" width="1536" height="1024"/></span></span></span>}
            <div className="c2-now"><strong aria-live="polite">{track.title}</strong><span>{state.loading?'Tuning in…':experiment?'LinkedIn Beats':'Circle Back Radio'}</span></div>
          </div>
          <div className="c2-player-screen">
          <div className="c2-scrubber" style={{'--c2-progress':`${seconds/track.seconds*100}%`}}>
            <PixelSpectrum levels={state.levels} active={motion&&state.playing}/>
            <span className="c2-seek-rail" aria-hidden="true"/>
            <input type="range" aria-label="Track position" aria-valuetext={`${formatTime(seconds)} of ${formatTime(track.seconds)}`} min="0" max={track.seconds} step=".1" value={seconds} onChange={e=>setScrub(Number(e.target.value))} onPointerUp={e=>seek(e.currentTarget.value)} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))seek(e.currentTarget.value);}} onBlur={e=>{if(scrub!==null)seek(e.currentTarget.value);}} onPointerCancel={()=>setScrub(null)}/>
          </div>
          <div className="c2-time" aria-hidden="true"><time>{formatTime(seconds)}</time><span>/</span><time>{formatTime(track.seconds)}</time></div>
          </div>
          <div className="c2-next-controls" role="group" aria-label="Track controls"><button type="button" className={`c2-key c2-previous ${pressedKey==='previous'?'is-active':''}`} aria-label="Previous track or restart" onClick={()=>skip('previous')}><SkipBack fill="currentColor"/></button><button type="button" className={`c2-key ${pressedKey==='next'?'is-active':''}`} aria-label="Next track" onClick={()=>skip('next')}><SkipForward fill="currentColor"/></button></div>
          <div className="c2-volume"><button type="button" onClick={mute} aria-pressed={state.volume===0} aria-label={state.volume?'Mute':'Unmute'}>{state.volume?<Volume2/>:<VolumeX/>}</button><input type="range" min="0" max="1" step=".01" value={state.volume} style={{'--c2-volume':`${state.volume*100}%`}} aria-label="Volume" onChange={e=>radio.current?.volume(Number(e.target.value))}/></div>
          <button type="button" className="c2-key c2-all-tracks" aria-expanded={allTracks} aria-controls="c2-track-list" onClick={()=>setAllTracks(!allTracks)}>Playlist <ChevronDown className={allTracks?'is-open':''}/></button>
        </div>
        {state.error&&<p className="c2-audio-error c2-container" role="alert">{state.error}</p>}
        <div className="c2-container" id="c2-track-list" hidden={!allTracks}><ol className="c2-track-list">{TRACKS.map((item,index)=><li key={item.title}><button aria-label={`${index===state.index&&state.playing?'Pause':'Play'} ${item.title}`} aria-current={index===state.index?'true':undefined} onClick={()=>choose(index)}><span>{index===state.index&&state.playing?<Pause size={17}/>:<Play size={17}/>}</span><strong>{item.title}</strong><span className="c2-track-genre">{item.genre}</span><time>{formatTime(item.seconds)}</time></button></li>)}</ol><button className="c2-motion-toggle" aria-pressed={motion} onClick={()=>setMotion(!motion)}>Animate {variant==='conversation'?'conversation':experiment?'feed':'portraits'} <span>{motion?'On':'Off'}</span></button></div>
      </section>}
      {experiment&&variant!=='conversation'&&<ExperimentLinks variant={variant} base={base}/>}
      </section>
      {variant==='conversation'&&<>
        <DevelopmentRadio base={base} state={state} track={track} seconds={seconds} motion={motion} onToggle={()=>radio.current?.toggle()} onSkip={skip} onSeek={seek} onSelect={stableChoose}/>
      </>}
      <section id="c2-store" className="c2-store" aria-labelledby="c2-store-title">
        <div className="c2-container">
          <div className="c2-section-head">
            <p className="c2-eyebrow">The company store</p>
            <h2 id="c2-store-title">Wear your boundaries.</h2>
            <p className="c2-store-intro">Threads and wares for when you take it offline.</p>
          </div>
          <div className="c2-products">{FEATURED.map(product=><a className="c2-product" key={product.sku} href={`${base}store/?product=${product.sku}`} aria-label={`Explore ${product.name} — design preview`}>
            <div className="c2-product-image"><img src={`${base}store/${product.img}`} width="1254" height="1254" loading="lazy" alt={product.name}/></div>
            <div className="c2-product-info"><h3>{product.name}</h3><ArrowUpRight aria-hidden="true"/></div>
          </a>)}</div>
          <div className="c2-store-action">
            <a className="c2-collection-link" href={`${base}store/`}>Explore the collection <ArrowUpRight aria-hidden="true"/></a>
          </div>
        </div>
      </section>
      <Campaigns base={base}/>
      <NewsletterSignup/>
    </main>
    <ConceptFooter base={base}/>
  </div>;
}
