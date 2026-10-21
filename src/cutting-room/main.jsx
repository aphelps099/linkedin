import {SiteFooter} from '../brand/SiteFooter.jsx';
import React, {useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUpRight,Bookmark,Check,ChevronDown,Download,Film,Play,Search,SlidersHorizontal,Volume2,VolumeX,X} from 'lucide-react';
import catalog from './catalog.json';
import './style.css';

const categories=['All footage','Finished films','Office scenes','Character performances','Instruments','Screen inserts','Experiments'];
const fmt=n=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;
function readSaved(){try{return JSON.parse(localStorage.getItem('lib-cutting-room-v1'))||{shortlist:[],notes:{}}}catch{return{shortlist:[],notes:{}}}}
function App(){
  const [saved,setSaved]=useState(readSaved),[search,setSearch]=useState(''),[category,setCategory]=useState('All footage'),[cast,setCast]=useState('Everyone'),[status,setStatus]=useState('current'),[onlySaved,setOnlySaved]=useState(false),[limit,setLimit]=useState(18),[active,setActive]=useState(null),[error,setError]=useState(false),[notice,setNotice]=useState('');
  const dialog=useRef(null),lastFocus=useRef(null);
  useEffect(()=>{try{localStorage.setItem('lib-cutting-room-v1',JSON.stringify(saved))}catch{}},[saved]);
  useEffect(()=>{setLimit(18)},[search,category,cast,status,onlySaved]);
  useEffect(()=>{if(active){lastFocus.current=document.activeElement;dialog.current?.showModal();setError(false);setNotice('')}else{dialog.current?.close();lastFocus.current?.focus()}},[active]);
  const toggle=id=>setSaved(s=>({...s,shortlist:s.shortlist.includes(id)?s.shortlist.filter(x=>x!==id):[...s.shortlist,id]}));
  const rows=useMemo(()=>catalog.assets.filter(a=>
    (category==='All footage'||a.category===category)&&
    (cast==='Everyone'||a.cast.includes(cast))&&
    (status==='all'||(status==='review'?a.status==='Needs review':a.status!=='Earlier version'))&&
    (!onlySaved||saved.shortlist.includes(a.id))&&
    `${a.title} ${a.description} ${a.transcript||''} ${a.tags.join(' ')} ${a.cast.join(' ')}`.toLowerCase().includes(search.toLowerCase())
  ),[search,category,cast,status,onlySaved,saved.shortlist]);
  const featured=catalog.assets[0];
  function exportList(){
    const entries=catalog.assets.filter(a=>saved.shortlist.includes(a.id)).map(a=>({title:a.title,url:new URL(a.src,location.origin).href,duration:a.duration,cast:a.cast,notes:saved.notes[a.id]||'',status:a.status}));
    const blob=new Blob([JSON.stringify({project:'LinkedIn Beats',created:new Date().toISOString(),clips:entries},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='linkedin-beats-edit-shortlist.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  async function share(a){const url=`${location.origin}${location.pathname}#${a.id}`;try{await navigator.clipboard.writeText(url);setNotice('Clip link copied.')}catch{setNotice(url)}}
  useEffect(()=>{const id=location.hash.slice(1);if(id)setActive(catalog.assets.find(a=>a.id===id)||null)},[]);
  return <div className="cr-page">
    <header className="cr-nav"><a href="/" className="cr-logo">LINKEDIN BEATS<span>_</span></a><span className="cr-nav-label"><i/> CUTTING ROOM / UNLISTED</span><a href="/studio/" className="cr-studio">Go to the studio <ArrowUpRight size={17}/></a></header>
    <main>
      <div className="cr-intro"><div><p className="cr-kicker">THE OFFICE. EVERY TAKE.</p><h1>The Cutting Room<span>.</span></h1><p>Extraordinary footage of extremely ordinary business.</p></div><div className="cr-total"><strong>{catalog.assets.length}</strong><span>films, performances<br/>and questionable decisions</span></div></div>
      <section className="cr-feature" aria-label="Latest edit">
        <button className="cr-feature-image" onClick={()=>setActive(featured)} aria-label={`Watch ${featured.title}`}><img src={featured.poster} alt="A VHS cameraman records the office applauding Synergy" fetchpriority="high"/><span className="cr-round-play"><Play fill="currentColor"/></span><span className="cr-duration">{fmt(featured.duration)}</span></button>
        <div className="cr-feature-text"><span className="cr-pill"><i/> LATEST CUT · V6</span><h2>Welcome to<br/>the office.</h2><p>The professionals arrive. The banners go up. Business becomes a band.</p><ul><li>More of the banner installation crew</li><li>Full music and dialogue mix</li><li>End card removed; finishes on applause</li></ul><button className="cr-primary" onClick={()=>setActive(featured)}><Play size={17} fill="currentColor"/> Watch the new cut</button></div>
      </section>
      <section className="cr-library" aria-label="Video catalog">
        <div className="cr-library-heading"><h2>Everything, on record.</h2><div><button className={onlySaved?'cr-saved active':'cr-saved'} onClick={()=>setOnlySaved(!onlySaved)} aria-pressed={onlySaved}><Bookmark size={16}/> Shortlist <b>{saved.shortlist.length}</b></button><button className="cr-export" onClick={exportList} disabled={!saved.shortlist.length} aria-label="Export shortlist"><Download size={18}/></button></div></div>
        <div className="cr-categories" aria-label="Footage categories">{categories.map(c=><button key={c} className={category===c?'active':''} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
        <div className="cr-tools"><label className="cr-search"><Search size={18}/><input placeholder="Search a character, phrase, or scene…" aria-label="Search footage" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button aria-label="Clear search" onClick={()=>setSearch('')}><X size={16}/></button>}</label><label className="cr-select"><span>Cast</span><select value={cast} onChange={e=>setCast(e.target.value)}>{['Everyone',...catalog.cast].map(c=><option key={c}>{c}</option>)}</select><ChevronDown size={15}/></label><label className="cr-select"><SlidersHorizontal size={15}/><select aria-label="Version filter" value={status} onChange={e=>setStatus(e.target.value)}><option value="current">Current + source takes</option><option value="all">Include earlier versions</option><option value="review">Needs review</option></select><ChevronDown size={15}/></label></div>
        <div className="cr-results"><span>{rows.length} clips {onlySaved?'in your shortlist':''}</span><span>Click to play. Sound stays with each clip.</span></div>
        <div className="cr-grid">{rows.slice(0,limit).map(a=><article className="cr-card" key={a.id}>
          <div className="cr-thumb"><button className="cr-open" onClick={()=>setActive(a)} aria-label={`Watch ${a.title}`}><img src={a.poster} alt="" loading="lazy" decoding="async"/><span className="cr-card-play"><Play size={24} fill="currentColor"/></span></button><button className={`cr-bookmark ${saved.shortlist.includes(a.id)?'selected':''}`} onClick={()=>toggle(a.id)} aria-label={`${saved.shortlist.includes(a.id)?'Remove from':'Add to'} shortlist: ${a.title}`} aria-pressed={saved.shortlist.includes(a.id)}><Bookmark size={17} fill={saved.shortlist.includes(a.id)?'currentColor':'none'}/></button><span className="cr-duration">{fmt(a.duration)}</span><span className="cr-audio" title={a.audio?'Audio included':'Silent footage'}>{a.audio?<Volume2 size={13}/>:<VolumeX size={13}/>} {a.audio?'AUDIO':'SILENT'}</span></div>
          <div className="cr-card-meta"><span>{a.category}</span>{a.status==='Needs review'?<span className="cr-warning">Review</span>:a.status==='Earlier version'?<span>Earlier version</span>:null}</div><button className="cr-title" onClick={()=>setActive(a)}>{a.title}</button><p>{a.description}</p><div className="cr-tags">{a.cast.slice(0,3).map(c=><button key={c} onClick={()=>setCast(c)}>{c}</button>)}{a.cast.length>3&&<span>+{a.cast.length-3}</span>}</div>
        </article>)}</div>
        {!rows.length&&<div className="cr-empty"><Film size={32}/><h3>No footage in this view.</h3><p>Try a different phrase or clear the filters.</p><button onClick={()=>{setSearch('');setCategory('All footage');setCast('Everyone');setStatus('all');setOnlySaved(false)}}>Show all footage</button></div>}
        {rows.length>limit&&<button className="cr-more" onClick={()=>setLimit(n=>n+18)}>Load more footage <ChevronDown size={18}/></button>}
      </section>
      <section className="cr-edit-note"><span>FOR THE NEXT EDIT</span><p>Start with a very small achievement.<br/>Add a very large announcement.</p><div>Save the best reactions, a musical interruption, and one unnecessary printer shot. Your shortlist and notes stay in this browser; export them to keep or share an edit plan.</div></section>
    </main>
    <p className="cr-catalog-note">Unlisted catalog · Anyone with the link can view it · {catalog.updated}</p>
    <SiteFooter base="../"/>
    <dialog ref={dialog} className="cr-dialog" onCancel={()=>setActive(null)} onClick={e=>{if(e.target===dialog.current)setActive(null)}}>{active&&<div className="cr-modal"><div className="cr-modal-top"><span>{active.category} / {active.status}</span><button onClick={()=>setActive(null)} aria-label="Close player"><X/></button></div><video key={active.id} src={active.src} poster={active.poster} controls playsInline preload="metadata" onError={()=>setError(true)}/>{error&&<p role="alert" className="cr-player-error">This clip couldn’t load. <a href={active.src} target="_blank" rel="noreferrer">Open the video directly</a> or try again.</p>}<div className="cr-modal-content"><div><p className="cr-kicker">{fmt(active.duration)} · {active.width} × {active.height} · {active.audio?'Audio included':'Silent footage'}</p><h2>{active.title}</h2><p>{active.description}</p>{active.notes&&<p className="cr-clip-notes">{active.notes}</p>}{active.transcript&&<details><summary>Dialogue / phrases</summary><p>{active.transcript}</p></details>}<div className="cr-modal-actions"><button className="cr-primary" onClick={()=>toggle(active.id)}>{saved.shortlist.includes(active.id)?<Check size={16}/>:<Bookmark size={16}/>} {saved.shortlist.includes(active.id)?'Shortlisted':'Add to shortlist'}</button><a href={active.download||active.src} download><Download size={16}/> Download</a><button onClick={()=>share(active)}>Copy link <ArrowUpRight size={16}/></button></div><p role="status" className="cr-notice">{notice}</p></div><label className="cr-notes-label">YOUR EDIT NOTES<textarea value={saved.notes[active.id]||''} onChange={e=>setSaved(s=>({...s,notes:{...s.notes,[active.id]:e.target.value}}))} placeholder="Great reaction at 0:06. Cut to printer. Hold the silence."/><small>Saved on this device. Included in shortlist export.</small></label></div></div>}</dialog>
  </div>
}
const root = import.meta.hot?.data.root || createRoot(document.getElementById('root'));
if(import.meta.hot) import.meta.hot.data.root = root;
root.render(<App/>);
