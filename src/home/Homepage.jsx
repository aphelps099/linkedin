import {Header} from '../brand/Header.jsx';
import React, {useEffect, useRef, useState} from 'react';
import {ArrowUpRight, Play, Pause, SkipBack, SkipForward, Shuffle, Volume2, VolumeX, LoaderCircle} from 'lucide-react';
import {createRadio} from './radio.js';
import {TRACKS, LINES, formatTime, siteBase} from './tracks.js';
import {PRODUCTS} from '../store/products.js';
import {ProductVisual} from '../store/ProductVisual.jsx';
import {Footer} from '../brand/Footer.jsx';
import '../brand/fonts.css';
import './home.css';

const FEATURED = ['CS-106','CS-203','CS-501'].map(sku=>PRODUCTS.find(p=>p.sku===sku));
const initial={index:0,playing:false,loading:false,elapsed:0,volume:.8,shuffle:false,text:LINES[1],word:-1,error:''};

export default function Homepage(){
  const base=siteBase(), toolsBase=import.meta.env.VITE_TOOL_BASE_URL || base, studioUrl=import.meta.env.VITE_STUDIO_URL || `${toolsBase}studio/`, radio=useRef(null), lastVolume=useRef(.8);
  const [state,setState]=useState(initial), [post,setPost]=useState('');
  const [scrub,setScrub]=useState(null);
  const track=TRACKS[state.index];
  const seconds=scrub===null?state.elapsed:scrub;
  useEffect(()=>{
    const player=createRadio({phraseBase:`${base}phrases/`,onState:setState});
    radio.current=player;
    const onKey=e=>{
      if(e.code!=='Space'||e.repeat||e.metaKey||e.ctrlKey||e.altKey) return;
      if(e.target.closest('input,textarea,button,a,select,[contenteditable="true"]')) return;
      e.preventDefault();player.toggle();
    };
    window.addEventListener('keydown',onKey);
    return ()=>{window.removeEventListener('keydown',onKey);player.dispose();radio.current=null;};
  },[base]);
  const playHero=()=>{
    if(!state.playing && !state.loading) radio.current?.toggle();
    document.getElementById('listen').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
  };
  const submit=e=>{e.preventDefault();if(post.trim()) window.location.assign(`${toolsBase}roast/#roast=${encodeURIComponent(post.trim())}`);};
  const mute=()=>{
    if(state.volume){lastVolume.current=state.volume;radio.current?.volume(0);}
    else radio.current?.volume(lastVolume.current||.8);
  };
  const commitSeek=value=>{setScrub(null);radio.current?.seek(value);};
  return <div className="pop-home">
    <a className="pop-skip" href="#listen">Skip to music player</a>
    <Header base={base} active="Listen" onRadio={()=>radio.current?.toggle()} playing={state.playing} loading={state.loading}/>
    <main>
      <section className="pop-hero" aria-labelledby="hero-title">
        <div className="pop-hero-copy">
          <div className="pop-eyebrow">Independent music for dependent employees.</div>
          <h1 id="hero-title"><span>HUMBLED.</span><span>HONORED.</span><span>ON REPEAT.</span></h1>
          <p>The soundtrack of professional nonsense.</p>
          <div className="pop-hero-actions"><button className="pop-cta" onClick={playHero}><Play fill="currentColor"/>PLAY THE HITS</button><a className="pop-link" href="#roast">Roast my post <ArrowUpRight size={18}/></a></div>
        </div>
        <div className="pop-portrait">
          <img src={`${base}home/corporate-portraits.webp`} width="1376" height="1152" fetchpriority="high" alt="The same bespectacled corporate headshot repeated six times in blue, pink, yellow, cream and red screen prints."/>
          <span className="pop-sticker">ALL BUSINESS.<br/>NO SKIPS.</span>
        </div>
      </section>

      <section className="pop-listening pop-concert" aria-labelledby="hits-title">
      <div className="pop-listening-inner">
      <h2 id="hits-title" className="pop-listening-title"><span className="pop-heading-print">THE<br/>CORPORATE</span><img src={`${base}home/hits-marker.webp`} width="1536" height="1024" loading="lazy" alt="hits."/></h2>
      <section id="listen" className={`pop-radio ${state.playing?'is-playing':''}`} aria-label="Circle Back Radio">
        <div className="pop-concert-stage">
        <div className="pop-radio-meta"><h3><span className="pop-live-dot"/>CIRCLE BACK RADIO<span className="pop-radio-signal" aria-hidden="true"><i/><i/><i/><i/></span></h3></div>
        <div className={`pop-lyrics ${state.text.length>35?'is-long':''}`} aria-label={`Lyrics: ${state.text}`}>
          <div aria-hidden="true">{state.text.split(/\s+/).map((word,i)=><React.Fragment key={`${state.text}-${i}`}><span className={i===state.word?'is-current':''}>{word}</span>{' '}</React.Fragment>)}</div>
        </div>
        <div className={`pop-radio-caption ${state.error||state.loading?'has-notice':''}`} aria-live="polite">{state.error|| (state.loading?'Tuning in…':'')}</div>
        </div>
        <div className="pop-controls">
          <div className="pop-transport">
            <button className={`pop-icon ${state.shuffle?'is-active':''}`} aria-label="Shuffle tracks" aria-pressed={state.shuffle} title="Shuffle tracks" onClick={()=>radio.current?.shuffle()}><Shuffle/></button>
            <button className="pop-icon" aria-label="Previous track or restart" title="Previous track or restart" onClick={()=>radio.current?.previous()}><SkipBack fill="currentColor"/></button>
            <button className="pop-play" aria-label={state.loading?'Cancel loading':state.playing?'Pause':'Play'} onClick={()=>radio.current?.toggle()}>{state.loading?<LoaderCircle className="pop-spinner"/>:state.playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button>
            <button className="pop-icon" aria-label="Next track" title="Next track" onClick={()=>radio.current?.next()}><SkipForward fill="currentColor"/></button>
          </div>
          <div className="pop-current-track"><strong>{track.title}</strong><span>{state.loading?'TUNING IN':state.playing?'NOW PLAYING':'READY WHEN YOU ARE'}</span></div>
          <div className="pop-seek"><time>{formatTime(seconds)}</time><input type="range" min="0" max={track.seconds} step=".1" value={seconds} style={{'--progress':`${seconds/track.seconds*100}%`}} aria-label="Track position" aria-valuetext={`${formatTime(seconds)} of ${formatTime(track.seconds)}`} onChange={e=>setScrub(Number(e.target.value))} onPointerUp={e=>commitSeek(e.currentTarget.value)} onKeyUp={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))commitSeek(e.currentTarget.value);}} onBlur={e=>{if(scrub!==null)commitSeek(e.currentTarget.value);}} onPointerCancel={()=>setScrub(null)}/><time>{formatTime(track.seconds)}</time></div>
          <div className="pop-volume"><button className="pop-icon" onClick={mute} aria-label={state.volume?'Mute':'Unmute'}>{state.volume?<Volume2/>:<VolumeX/>}</button><input type="range" min="0" max="1" step=".01" value={state.volume} style={{'--progress':`${state.volume*100}%`}} aria-label="Volume" onChange={e=>radio.current?.volume(e.target.value)}/></div>
        </div>
      </section>

      <section className="pop-hits" aria-labelledby="hits-title">

        <ol className="pop-tracklist">{TRACKS.map((item,i)=><li key={item.title}><button className={`pop-track ${i===state.index?'is-selected':''}`} onClick={()=>i===state.index?radio.current?.toggle():radio.current?.play(i)} aria-label={`${i===state.index&&state.playing?'Pause':'Play'} ${item.title}`} aria-current={i===state.index?'true':undefined}>
          <span className="pop-track-number">{String(i+1).padStart(2,'0')}</span>
          <span className="pop-track-symbol" aria-hidden="true">{i===state.index&&state.playing?<span className="pop-equalizer"><i/><i/><i/></span>:<Play size={17} fill="currentColor"/>}</span>
          <span className="pop-track-name">{item.title}<small>{item.genre}</small></span><span className="pop-track-genre">{item.genre}</span><time>{formatTime(item.seconds)}</time>
        </button></li>)}</ol>
        <div className="pop-track-footnote"><span>5 ORIGINAL MIXES / ZERO ACTION ITEMS</span><a className="pop-link" href={studioUrl}>Open the studio <ArrowUpRight size={18}/></a></div>
      </section>

      </div>
      </section>

      <section id="roast" className="pop-roast" aria-labelledby="roast-title">
        <div className="pop-roast-copy"><span className="pop-eyebrow">Department of unsolicited feedback</span><h2 id="roast-title">ROAST<br/>MY POST.</h2><p>Your personal brand has been<br/>selected for review.</p></div>
        <form onSubmit={submit} className="pop-roast-form"><label className="pop-sr" htmlFor="roast-post">Your LinkedIn post</label><textarea id="roast-post" value={post} onChange={e=>setPost(e.target.value)} placeholder="Paste your post. Yes, that one." required maxLength={10000} rows={5}/><button type="submit" className="pop-submit">SUBMIT FOR REVIEW <ArrowUpRight size={20}/></button><span>Confidential. Cathartic. Probably overdue.</span></form>
        <div className="pop-receipt" aria-hidden="true"><div className="pop-receipt-head"><b>CB®</b><span>CIRCLE BACK<br/>SOCIAL REVIEW</span></div><p>FORM RM-01 / SPECIMEN</p><dl><div><dt>TONE</dt><dd>OOF</dd></div><div><dt>CLICHÉS</dt><dd>PLENTY</dd></div><div><dt>CRINGE</dt><dd>CONFIRMED</dd></div><div><dt>VERDICT</dt><dd>SEE BELOW</dd></div></dl><strong>ROASTED</strong><small>PLEASE RETAIN FOR YOUR RECORDS.</small></div>
      </section>

      <section id="store" className="pop-store" aria-labelledby="store-title">
        <div className="pop-merch-head"><h2 id="store-title">WEAR YOUR<br/>BOUNDARIES.</h2><a className="pop-merch-cta" href={`${toolsBase}store/`}>Explore the store <ArrowUpRight aria-hidden="true"/></a></div>
        <div className="pop-products">{FEATURED.map((p,i)=><a className={`pop-product pop-product-${i}`} href={`${toolsBase}store/?product=${p.sku}`} key={p.sku} aria-label={`Explore ${p.name} — design preview`}>
          <div className={`pop-product-image product-${i}`}><ProductVisual product={p} base={base}/></div>
          <div className="pop-merch-title"><h3>{['OUT OF OFFICE.','CIRCLE BACK.','COULD’VE BEEN AN EMAIL.'][i]}</h3><ArrowUpRight aria-hidden="true"/></div>
        </a>)}</div>
      </section>

    </main>
    <Footer/>
  </div>;
}
