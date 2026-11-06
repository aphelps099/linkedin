import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowLeft, ArrowUpRight, LoaderCircle, Pause, Play, Search, ThumbsUp, X} from 'lucide-react';
import {SiteFooter} from '../brand/SiteFooter.jsx';
import {CarouselArtwork} from '../home-2/CarouselArtwork.jsx';
import {createRadio} from '../home/radio.js';
import {TRACKS, formatTime} from '../home/tracks.js';
import {ARCHIVE_ITEMS, CATEGORIES, filterArchive} from './catalog.js';
import {useYouTubeFeed, videoUrl, thumbnailFor, CHANNEL_URL} from '../youtube/feed.js';
import PegLabel from '../synth/PegLabel.jsx';
import VideoModal from './VideoModal.jsx';
import {DotIcon, PegFrame, CandyPaint} from './ArchiveGraphics.jsx';
import '../brand/fonts.css';
import '../brand/type-system.css';
import './archives.css';

const params=new URLSearchParams(window.location.search);
const storyId=params.get('story');
const story=ARCHIVE_ITEMS.find(item=>item.id===storyId);
const primaryCategories=[['all','Everything'],['films','Films'],['youtube','Videos'],['shorts','Shorts'],['music','Music']];
const otherCategories=CATEGORIES.filter(([key])=>!primaryCategories.some(([primary])=>primary===key));
const validCategory=value=>CATEGORIES.some(([key])=>key===value)?value:'all';
const actions={feature:'Explore',video:'Watch film',song:'Listen now',press:'Read release',post:'Read post',blog:'Read story',roast:'Read the roast'};
const storyHref=item=>item.type==='youtube'?videoUrl(item):item.href?`/${item.href}`:`?story=${item.id}`;
const colors={films:'#b7f5d5',youtube:'#d5c3ff',shorts:'#ffc2af',music:'#fff0a6',press:'#e3c4ff',posts:'#e3c4ff',roasts:'#ffc2af',features:'#b7f5d5'};
const tagFor=item=>item.type==='youtube'?(item.kind==='short'?'SHORT':'VIDEO'):item.type==='video'?'FILM':item.type==='song'?'MUSIC':item.label;
const displayTitle=item=>item.title.replace(/\s+#\w+/g,'');
const featured=[
  {id:'musical-meeting',title:'Let’s circle back.',note:'A meeting that finally goes somewhere. The whole team. One very good chorus.'},
  {id:'office-band',title:'Business unusual.',note:'The office has a band. Productivity has officially left the building.'},
  {id:'synergy-single',title:'Synergy in B2B minor.',note:'Boardroom house. An unreasonable amount of stakeholder buy-in.'},
].map(pick=>({...ARCHIVE_ITEMS.find(item=>item.id===pick.id),featureTitle:pick.title,featureNote:pick.note}));

function Artwork({item,priority=false}) {
  if(item.type==='youtube')return <div className={`archive-art archive-art--upload ${item.kind==='short'?'archive-art--short':''}`} aria-hidden="true"><img src={thumbnailFor(item)} alt="" loading={priority?'eager':'lazy'} decoding="async" onError={e=>{e.currentTarget.hidden=true;}}/><span className="archive-art-fallback">LinkedIn Beats</span><span className="archive-media-mark"><DotIcon kind="play"/></span></div>;
  if(item.type==='video')return <div className="archive-art archive-art--film" aria-hidden="true"><img src={`/${item.image}`} alt="" loading={priority?'eager':'lazy'} decoding="async"/><span className="archive-media-mark"><DotIcon kind="play"/></span></div>;
  return <div className={`archive-art archive-art--${item.shape}`} aria-hidden="true">
    {item.artwork?<CarouselArtwork artwork={item.artwork}/>:<div className="archive-roast-art"><span>THE HALL OF FAME / {item.exhibit.no}</span><strong>“{item.exhibit.quote.text}”</strong><span>{item.exhibit.quote.by}</span></div>}
  </div>;
}

function Featured({onWatch}){
  const [index,setIndex]=useState(0), item=featured[index];
  return <section className="archive-feature" aria-label="From the collection" style={{'--accent':colors[item.category]}}>
    <a className="archive-feature-picture" href={storyHref(item)} onClick={event=>onWatch(event,item)} aria-haspopup={item.type==='video'?'dialog':undefined} aria-label={`${actions[item.type]}: ${item.featureTitle}`}><Artwork item={item} priority/><PegFrame/></a>
    <div className="archive-feature-copy">
      <div className="archive-feature-label"><span className="archive-tag">{tagFor(item)}</span></div>
      <div className="archive-feature-description" key={item.id} aria-live="polite"><h2>{item.featureTitle}</h2><p>{item.featureNote}</p><a className="archive-feature-cta" href={storyHref(item)} onClick={event=>onWatch(event,item)} aria-haspopup={item.type==='video'?'dialog':undefined}>{actions[item.type]}<DotIcon/></a></div>
      <div className="archive-feature-controls"><div className="archive-feature-picks" aria-label="Featured selections">{featured.map((pick,i)=><button key={pick.id} onClick={()=>setIndex(i)} aria-label={`Feature ${i+1}: ${pick.featureTitle}`} aria-pressed={index===i}><span/></button>)}</div><div className="archive-feature-arrows"><button onClick={()=>setIndex((index+featured.length-1)%featured.length)} aria-label="Previous feature"><DotIcon reverse/></button><button onClick={()=>setIndex((index+1)%featured.length)} aria-label="Next feature"><DotIcon/></button></div></div>
    </div>
  </section>;
}

function ArchiveCard({item,index,placement='',onWatch}){
  const [liked,setLiked]=useState(false);
  const external=item.type==='youtube';
  const href=storyHref(item);
  const linkProps={href,onClick:event=>onWatch(event,item),'aria-haspopup':external||item.type==='video'?'dialog':undefined};
  return <article className={`archive-card archive-card--${external?item.kind:item.type} ${placement}`} style={{'--accent':colors[item.category]||'#afd8be','--arrival-delay':`${Math.min(index,8)*35}ms`}}>
    <div className="archive-card-shell">
      {placement==='archive-card--lead'&&<div className="archive-post-byline"><span className="archive-like-medallion" aria-hidden="true"><ThumbsUp/></span><span>Humbled to share.</span></div>}
      <a className="archive-card-content" {...linkProps}>
        <div className="archive-card-picture"><Artwork item={item}/><PegFrame/></div>
        <div className="archive-card-copy"><div className="archive-card-meta"><span className="archive-tag">{tagFor(item)}</span></div><h3>{displayTitle(item)}</h3></div>
      </a>
      <div className="archive-social-actions">
        <button type="button" className="archive-like-action" aria-pressed={liked} aria-label={`${liked?'Remove like from':'Like'} ${displayTitle(item)}`} onClick={()=>setLiked(value=>!value)}><ThumbsUp aria-hidden="true"/><span>{liked?'Aligned':'Like'}</span></button>
        <a className="archive-card-action" {...linkProps}>{external?'Watch':actions[item.type]}<DotIcon/></a>
      </div>
    </div>
  </article>;
}
// Each spread leads with a moving-image piece, then a portrait where available.
// Keep every item once; DOM order is the same as the visual reading order.
function ArchiveGallery({items,onWatch}){
  const spreads=[];
  for(let start=0;start<items.length;start+=5){
    const group=items.slice(start,start+5);
    const leadIndex=group.length>=4?group.findIndex(item=>item.type==='video'||(item.type==='youtube'&&item.kind==='video')):-1;
    const lead=leadIndex>=0?group.splice(leadIndex,1)[0]:null;
    const sideIndex=lead?group.findIndex(item=>item.kind==='short'):-1;
    const side=lead?group.splice(sideIndex>=0?sideIndex:0,1)[0]:null;
    const ordered=lead?[lead,side,...group]:group;
    spreads.push(<div className={`archive-spread ${lead?'archive-spread--featured':''}`} key={items[start].id}>{ordered.map((item,index)=><ArchiveCard onWatch={onWatch} key={item.id} item={item} index={start+index} placement={lead&&index===0?'archive-card--lead':lead&&index===1?'archive-card--companion':''}/>)}</div>);
  }
  return spreads;
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
  const [watching,setWatching]=useState(null);
  function watch(event,item){
    if(!['video','youtube'].includes(item.type)||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();setWatching(item);
  }
  const pageRef=useRef(null);
  useLayoutEffect(()=>{
    if(story)return;
    const page=pageRef.current, collection=page.querySelector('.archive-collection');
    const measure=()=>page.style.setProperty('--collection-start',`${Math.round(collection.getBoundingClientRect().top-page.getBoundingClientRect().top)}px`);
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(page.querySelector('main'));
    return()=>observer.disconnect();
  },[]);
  const [category,setCategory]=useState(validCategory(params.get('category')));
  const [query,setQuery]=useState(params.get('q')||'');
  const [view,setView]=useState('grid');
  const [state,setState]=useState({index:story?.track??0,playing:false,loading:false,elapsed:0,error:''});
  const player=useRef(null);
  useEffect(()=>{const radio=createRadio({phraseBase:'/phrases/',initialIndex:story?.track??0,onState:setState});player.current=radio;return()=>radio.dispose();},[]);
  useEffect(()=>{document.title=story?`${story.title} — LinkedIn Beats Archives`:'The Archives — LinkedIn Beats';},[]);
  useEffect(()=>{function restore(){const search=new URLSearchParams(window.location.search);setCategory(validCategory(search.get('category')));setQuery(search.get('q')||'');}window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);},[]);
  const collection=useMemo(()=>{
    const uploads=feed.items.map(item=>({...item,type:'youtube',category:item.kind==='short'?'shorts':'youtube',label:item.kind==='short'?'YouTube Short':'YouTube video'}));
    // Mix the house collection and uploads without hiding older entries.
    const house=[...ARCHIVE_ITEMS].sort((a,b)=>Number(b.type==='video')-Number(a.type==='video'));
    const mixed=[];
    for(let i=0;i<Math.max(uploads.length,house.length);i++){if(uploads[i])mixed.push(uploads[i]);if(house[i])mixed.push(house[i]);}
    return mixed;
  },[feed.items]);
  const items=filterArchive(category,query,collection);
  function updateFilters(nextCategory,nextQuery,push=false){
    setCategory(nextCategory);setQuery(nextQuery);
    const url=new URL(window.location.href);url.searchParams.delete('story');
    if(nextCategory==='all')url.searchParams.delete('category');else url.searchParams.set('category',nextCategory);
    if(nextQuery)url.searchParams.set('q',nextQuery);else url.searchParams.delete('q');
    window.history[push?'pushState':'replaceState']({},'',url);
  }
  return <div ref={pageRef} className={`archive-page ${story?'':'archive-page--index'}`}><CandyPaint/><a className="archive-skip" href="#main-content">Skip to archives</a>
    <main id="main-content">
      {story?<Story item={story} state={state} player={player}/>:<>
        <header className="archive-heading">

          <h1><PegLabel text="ARCHIVES" face={9} pitch={14}/></h1>
          <div className="archive-heading-bottom"><p>Great moments.<br/><span>Questionable business value.</span></p></div>
        </header>
        {storyId&&<p className="archive-missing" role="status">That story isn’t in the archives. Explore the collection below.</p>}
        <Featured onWatch={watch}/>
        <section className="archive-collection" aria-labelledby="collection-title">
          <div className="archive-collection-heading"><h2 id="collection-title"><PegLabel text="TAKE A LOOK AROUND." face={5} pitch={4}/></h2><span className="archive-count archive-sr" role="status">{items.length} {items.length===1?'entry':'entries'}{query&&` for “${query}”`}</span></div>
          <div className="archive-tools">
            <nav aria-label="Archive categories">{primaryCategories.map(([key,label])=><button type="button" key={key} onClick={()=>updateFilters(key,query,true)} aria-pressed={category===key}>{label}</button>)}
              <label className={`archive-more ${otherCategories.some(([key])=>key===category)?'is-selected':''}`}><select aria-label="More archive categories" value={otherCategories.some(([key])=>key===category)?category:''} onChange={e=>updateFilters(e.target.value,query,true)}><option value="" disabled>More +</option>{otherCategories.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
            </nav>
            <div className="archive-search-group"><label className="archive-search"><Search size={17} aria-hidden="true"/><input type="search" placeholder="Find something good" aria-label="Search the archives" value={query} onChange={e=>updateFilters(category,e.target.value)}/></label>{query&&<button className="archive-clear" aria-label="Clear search" onClick={()=>updateFilters(category,'')}><X size={16}/></button>}<div className="archive-view" aria-label="Collection view">{['grid','list'].map(mode=><button key={mode} type="button" onClick={()=>setView(mode)} aria-label={`${mode==='grid'?'Grid':'List'} view`} aria-pressed={view===mode}><DotIcon kind={mode}/></button>)}</div></div>
          </div>
          {feed.stale&&<p className="archive-feed-note" role="status">Showing saved uploads. <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer">Visit YouTube for the latest <ArrowUpRight size={14}/></a></p>}
          <div className={`archive-grid ${view==='list'?'archive-grid--list':''}`}>{view==='list'?items.map((item,index)=><ArchiveCard onWatch={watch} item={item} index={index} key={item.id}/>):<ArchiveGallery items={items} onWatch={watch}/>}</div>
          {!items.length&&<div className="archive-empty"><PegLabel text="NOTHING ON FILE." face={5} pitch={4}/><h3>A rare case of no paperwork.</h3><p>Try another search, or open the whole collection.</p><button onClick={()=>updateFilters('all','',true)}>Show everything <DotIcon/></button></div>}
          {items.length>0&&<div className="archive-end"><span className="archive-end-dots" aria-hidden="true">•••</span><a href="#main-content">Back to the top <ArrowUpRight size={16}/></a></div>}
        </section>
      </>}
    </main><SiteFooter/>{watching&&<VideoModal key={watching.id} item={watching} onClose={()=>setWatching(null)}/>}</div>;
}
const root=import.meta.hot?.data.root??createRoot(document.getElementById('root'));
if(import.meta.hot)import.meta.hot.data.root=root;
root.render(<Archives/>);
