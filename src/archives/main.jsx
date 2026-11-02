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
import {useYouTubeFeed, videoUrl, CHANNEL_URL} from '../youtube/feed.js';
import {YouTubeArtwork} from '../youtube/YouTubeArtwork.jsx';

const params=new URLSearchParams(window.location.search);
const storyId=params.get('story');
const story=ARCHIVE_ITEMS.find(item=>item.id===storyId);
const primaryCategories=[['all','All'],['shorts','Shorts'],['youtube','Videos']];
const otherCategories=CATEGORIES.filter(([key])=>!primaryCategories.some(([primary])=>primary===key));
const selectedCategory=CATEGORIES.some(([key])=>key===params.get('category'))?params.get('category'):'all';
const actions={feature:'Explore', video:'Watch film', song:'Listen now', press:'Read release', post:'Read post', blog:'Read story', roast:'Read the roast'};
const storyHref=item=>item.type==='youtube'?videoUrl(item):item.href?`/${item.href}`:`?story=${item.id}`;

function Artwork({item}) {
  if(item.type==='youtube') return <YouTubeArtwork item={item}/>;
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
  const feed=useYouTubeFeed();
  const uploads=feed.items.map(item=>({...item,type:'youtube',category:item.kind==='short'?'shorts':'youtube',label:item.kind==='short'?'YouTube Short':'YouTube video'}));
  const [query,setQuery]=useState(params.get('q')||'');
  const [state,setState]=useState({index:story?.track??0,playing:false,loading:false,elapsed:0,error:''});
  const player=useRef(null);
  useEffect(()=>{const radio=createRadio({phraseBase:'/phrases/',initialIndex:story?.track??0,onState:setState});player.current=radio;return()=>radio.dispose();},[]);
  useEffect(()=>{document.title=story?`${story.title} — LinkedIn Beats Archives`:'The Archives — LinkedIn Beats';},[]);
  const items=filterArchive(selectedCategory,query,[...uploads,...ARCHIVE_ITEMS]);
  return <div className="archive-page"><SiteHeader onRadio={()=>player.current?.toggle()} playing={state.playing} loading={state.loading} radioError={state.error}/>
    <main id="main-content">
      {story?<Story item={story} state={state} player={player}/>:<>
        <header className="archive-heading"><h1>Archives</h1><a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">YouTube <ArrowUpRight size={16}/></a></header>
        {storyId&&<p className="archive-missing" role="status">That story isn’t in the archives. Explore the collection below.</p>}
        <section className="archive-collection" aria-label="Archive collection">
          <div className="archive-tools">
            <nav aria-label="Archive categories">
              {primaryCategories.map(([key,label])=><a key={key} href={`?category=${key}${query?`&q=${encodeURIComponent(query)}`:''}`} aria-current={selectedCategory===key?'page':undefined}>{label}</a>)}
              <select aria-label="More archive categories" value={otherCategories.some(([key])=>key===selectedCategory)?selectedCategory:''} onChange={event=>{window.location.href=`?category=${event.target.value}${query?`&q=${encodeURIComponent(query)}`:''}`;}}>
                <option value="" disabled>More</option>{otherCategories.map(([key,label])=><option key={key} value={key}>{label}</option>)}
              </select>
            </nav>
            <div className="archive-search-group"><span className="archive-count" role="status">{items.length} {items.length===1?'entry':'entries'}</span><label className="archive-search"><Search size={17} aria-hidden="true"/><input type="search" placeholder="Search" aria-label="Search the archives" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
          </div>
          {feed.stale&&<p className="archive-feed-note" role="status">Showing saved uploads while YouTube reconnects. <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">Visit the channel for the latest.</a></p>}
          <div className="archive-grid">{items.map((item,index)=><article className="archive-card" key={item.id} style={{'--upload-color':['#21ceff','#fff000','#ff5fbd','#c5ff20','#a47aff'][index%5]}}><a href={storyHref(item)} target={item.type==='youtube'?'_blank':undefined} rel={item.type==='youtube'?'noopener noreferrer':undefined}><Artwork item={item}/><div className="archive-card-copy"><p className="archive-kicker">{item.label}</p><h2>{item.title}</h2><span>{item.type==='youtube'?'Watch on YouTube':actions[item.type]}<ArrowUpRight size={18}/></span></div></a></article>)}</div>
          {!items.length&&<div className="archive-empty"><h2>No paperwork found.</h2><p>Try another search or browse everything.</p><a href="/archives/">Show all entries</a></div>}
        </section>
      </>}
    </main><SiteFooter/></div>;
}
createRoot(document.getElementById('root')).render(<Archives/>);
