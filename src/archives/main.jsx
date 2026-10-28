import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowLeft, ArrowUpRight, LoaderCircle, Pause, Play, Search} from 'lucide-react';
import {SiteHeader} from '../brand/SiteHeader.jsx';
import {SiteFooter} from '../brand/SiteFooter.jsx';
import {CarouselArtwork} from '../home-2/CarouselArtwork.jsx';
import {createRadio} from '../home/radio.js';
import {TRACKS, formatTime} from '../home/tracks.js';
import {ARCHIVE_ITEMS, CATEGORIES, filterArchive} from './catalog.js';
import '../brand/fonts.css';
import '../home-2/concept.css';
import '../brand/type-system.css';
import './archives.css';

const params=new URLSearchParams(window.location.search);
const storyId=params.get('story');
const story=ARCHIVE_ITEMS.find(item=>item.id===storyId);
const selectedCategory=CATEGORIES.some(([key])=>key===params.get('category'))?params.get('category'):'all';
const actions={feature:'Explore', video:'Watch film', song:'Listen now', press:'Read release', post:'Read post', blog:'Read story', roast:'Read the roast'};
const storyHref=item=>item.href?`/${item.href}`:`?story=${item.id}`;

function Artwork({item}) {
  return <div className={`archive-art archive-art--${item.shape}`} aria-hidden="true">
    {item.artwork?<CarouselArtwork artwork={item.artwork}/>:<div className="archive-roast-art"><span>THE HALL OF FAME / {item.exhibit.no}</span><strong>“{item.exhibit.quote.text}”</strong><span>{item.exhibit.quote.by}</span></div>}
  </div>;
}
function Story({item, state, player}) {
  const current=item.type==='song'&&state.index===item.track;
  const [videoError,setVideoError]=useState(false);
  return <article className="archive-story">
    <a className="archive-back" href={`?category=${item.category}`}><ArrowLeft size={18}/> Back to {CATEGORIES.find(([id])=>id===item.category)?.[1]}</a>
    <header><p className="archive-kicker">{item.label}{['post','blog','press','roast'].includes(item.type)&&' / Corporate fiction'}</p><h1>{item.title}</h1></header>
    {item.type==='video'?<><video controls playsInline preload="metadata" poster={`/${item.image}`} src={`/${item.video}`} aria-label={item.title} onError={()=>setVideoError(true)}/>{videoError&&<p role="alert">This film couldn’t load. Please refresh to try again.</p>}</>:<Artwork item={item}/>}
    {item.type==='song'&&<div className="archive-audio">
      <button type="button" onClick={()=>current?player.current?.toggle():player.current?.play(item.track)} aria-label={current&&state.loading?'Cancel song loading':current&&state.playing?'Pause song':'Play song'}>{current&&state.loading?<LoaderCircle/>:current&&state.playing?<Pause/>:<Play/>}</button>
      <div><strong>{TRACKS[item.track].title}</strong><input type="range" min="0" max={TRACKS[item.track].seconds} value={current?Math.floor(state.elapsed):0} disabled={!current} onChange={event=>player.current?.seek(Number(event.target.value))} aria-label="Song position"/><span>{formatTime(current?state.elapsed:0)} / {formatTime(TRACKS[item.track].seconds)}</span></div>
      {state.error&&<p role="alert">The song couldn’t load. Please try again.</p>}
    </div>}
    <div className="archive-prose">
      {item.description&&<p className="archive-intro">{item.description}</p>}
      {item.type==='roast'&&<h2>The specimen</h2>}
      {item.body?.map((paragraph,index)=><p key={index}>{paragraph}</p>)}
      {item.exhibit&&<><blockquote>“{item.exhibit.quote.text}”<cite>— {item.exhibit.quote.by}</cite></blockquote><p className="archive-fiction">A fictional post from the Museum’s permanent collection.</p><a href="/museum/">Visit the Museum <ArrowUpRight size={18}/></a></>}
      {item.link&&<a href={`/${item.link.href}`}>{item.link.label}<ArrowUpRight size={18}/></a>}
    </div>
  </article>;
}
function Archives() {
  const [query,setQuery]=useState(params.get('q')||'');
  const [state,setState]=useState({index:story?.track??0,playing:false,loading:false,elapsed:0,error:''});
  const player=useRef(null);
  useEffect(()=>{const radio=createRadio({phraseBase:'/phrases/',initialIndex:story?.track??0,onState:setState});player.current=radio;return()=>radio.dispose();},[]);
  useEffect(()=>{document.title=story?`${story.title} — LinkedIn Beats Archives`:'The Archives — LinkedIn Beats';},[]);
  const items=filterArchive(selectedCategory,query);
  return <div className="archive-page"><SiteHeader onRadio={()=>player.current?.toggle()} playing={state.playing} loading={state.loading} radioError={state.error}/>
    <main id="main-content">
      {story?<Story item={story} state={state} player={player}/>:<>
        <section className="archive-heading"><p className="archive-kicker">On the record. For the record.</p><h1>The archives<span>.</span></h1><p>Press releases, field notes, and career-defining nonsense.<br/>Filed under: humbled to share.</p><a href="/studio/#meetings">Looking for the meetings? Watch them all <ArrowUpRight size={18}/></a></section>
        {storyId&&<p className="archive-missing" role="status">That story isn’t in the archives. Explore the collection below.</p>}
        <section className="archive-collection" aria-label="Archive collection">
          <div className="archive-tools"><nav aria-label="Archive categories">{CATEGORIES.map(([key,label])=><a key={key} href={`?category=${key}${query?`&q=${encodeURIComponent(query)}`:''}`} aria-current={selectedCategory===key?'page':undefined}>{label}</a>)}</nav><label className="archive-search"><Search size={18}/><input type="search" placeholder="Search the archives" aria-label="Search the archives" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
          <p className="archive-count" role="status">{items.length} {items.length===1?'entry':'entries'}{query&&` matching “${query}”`}</p>
          <div className="archive-grid">{items.map(item=><article className="archive-card" key={item.id}><a href={storyHref(item)}><Artwork item={item}/><div className="archive-card-copy"><p className="archive-kicker">{item.label}</p><h2>{item.title}</h2><span>{actions[item.type]}<ArrowUpRight size={18}/></span></div></a></article>)}</div>
          {!items.length&&<div className="archive-empty"><h2>No paperwork found.</h2><p>Try another search or browse everything.</p><a href="/archives/">Show all entries</a></div>}
        </section>
      </>}
    </main><SiteFooter/></div>;
}
createRoot(document.getElementById('root')).render(<Archives/>);
