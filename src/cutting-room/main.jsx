import {SiteFooter} from '../brand/SiteFooter.jsx';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUpRight, Bookmark, Check, ChevronDown, Download, Film, ListMusic, LoaderCircle, Music, Pause, Play, Search, SlidersHorizontal, Square, Volume2, VolumeX, X} from 'lucide-react';
import catalog from './catalog.json';
import {PILLS, EVERYTHING, MADE_IN, kindOf, madeInOf, relatedOf, isPortrait, pretty, fmt, extOf, chipOf, inVersion, matches, heroOf, justMade, parseHash, indexById, everyGroup, itemNoun, stillAlt} from './taxonomy.js';
import './style.css';

const assets = catalog.assets, byKey = indexById(assets), PAGE = 18;
const STORE = 'lib-cutting-room-v1';
function readSaved() { try { return JSON.parse(localStorage.getItem(STORE)) || {shortlist:[], notes:{}}; } catch { return {shortlist:[], notes:{}}; } }
const join = parts => parts.filter(p => p !== undefined && p !== null && p !== '' && !Number.isNaN(p)).join(' · ');
// Row lengths: most pack items are a second or two, where "0:01" says nothing.
const clock = d => (Number(d) < 60 ? `${(Math.round(Number(d) * 10) / 10).toFixed(1)} s` : fmt(d));
const madeInLine = a => (madeInOf(a)[0] ? `Made in ${pretty(madeInOf(a)[0])}` : '');
const verb = a => ({video:'Watch', audio:'Play', pack:'Open'})[kindOf(a)];
const thumbOf = a => a.poster || a.cover;
const clearHash = () => { if (location.hash) history.replaceState(null, '', location.pathname + location.search); };
const setHash = h => history.replaceState(null, '', `${location.pathname}${location.search}#${h}`);
function stop(el) { if (!el) return; el.pause(); el.removeAttribute('src'); try { el.load(); } catch {} }
function mediaSession(meta) {
  try {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({title:meta.title, artist:'LinkedIn Beats', album:meta.album || 'The Cutting Room',
      artwork:meta.art ? [{src:new URL(meta.art, location.href).href, sizes:meta.size || '600x600', type:'image/jpeg'}] : []});
  } catch {}
}

function Chip({a}) {
  const kind = kindOf(a), Icon = kind === 'pack' ? ListMusic : kind === 'audio' ? Music : a.audio ? Volume2 : VolumeX;
  const title = kind === 'pack' ? `${a.count} ${itemNoun(a, a.count)}` : kind === 'audio' ? (a.category === 'Songs' ? 'Song' : 'Sound') : a.audio ? 'Audio included' : 'Silent footage';
  return <span className={`cr-audio cr-chip-${kind}`} title={title}><Icon size={13}/> {chipOf(a)}</span>;
}

function Card({a, saved, onOpen, onToggle, onCast, compact}) {
  const kind = kindOf(a), selected = saved.shortlist.includes(a.id);
  return <article className={`cr-card cr-card-${kind}${compact ? ' cr-card-compact' : ''}`} data-id={a.id} data-kind={kind}>
    <div className={`cr-thumb cr-thumb-${kind}`}>
      <button className="cr-open" onClick={() => onOpen(a)} aria-label={`${verb(a)} ${a.title}`}>
        <img src={thumbOf(a)} alt="" loading="lazy" decoding="async"/>
        <span className="cr-card-play">{kind === 'pack' ? <ListMusic size={22}/> : <Play size={24} fill="currentColor"/>}</span>
      </button>
      {!compact && <button className={`cr-bookmark ${selected ? 'selected' : ''}`} onClick={() => onToggle(a.id)} aria-label={`${selected ? 'Remove from' : 'Add to'} shortlist: ${a.title}`} aria-pressed={selected}><Bookmark size={17} fill={selected ? 'currentColor' : 'none'}/></button>}
      <span className="cr-duration">{fmt(a.duration)}</span>
      <Chip a={a}/>
    </div>
    <div className="cr-card-meta"><span className="cr-card-origin"><span>{a.category}</span>{madeInOf(a)[0] && <span>{pretty(madeInOf(a)[0])}</span>}</span>{a.status === 'Needs review' ? <span className="cr-warning">Review</span> : a.status === 'Earlier version' ? <span>Earlier version</span> : null}</div>
    <button className="cr-title" onClick={() => onOpen(a)}>{a.title}</button>
    {!compact && <><p>{a.description}</p><div className="cr-tags">{a.cast.slice(0, 3).map(c => <button key={c} onClick={() => onCast(c)}>{c}</button>)}{a.cast.length > 3 && <span>+{a.cast.length - 3}</span>}</div></>}
  </article>;
}

// ------------------------------------------------------------------ pack player
// The list is fetched when the pack opens (never bundled). One <audio> plays every row.
function PackPlayer({a, row, onRow, onNotice}) {
  const [load, setLoad] = useState({state:'loading', list:null, attempt:0});
  const [query, setQuery] = useState(''), [group, setGroup] = useState(''), [current, setCurrent] = useState(null);
  const [playing, setPlaying] = useState(false), [all, setAll] = useState(false), [started, setStarted] = useState(false);
  const audio = useRef(null), list = useRef(null), allRef = useRef(false), rowsRef = useRef([]), currentRef = useRef(null);
  allRef.current = all;

  useEffect(() => {
    const ctl = new AbortController();
    setLoad(l => ({...l, state:'loading'}));
    fetch(a.src, {signal:ctl.signal}).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(data => { if (!Array.isArray(data?.items)) throw new Error('not a pack list'); setLoad(l => ({...l, state:'ready', list:data})); })
      .catch(e => { if (e.name !== 'AbortError') setLoad(l => ({...l, state:'error'})); });
    return () => ctl.abort();
  }, [a.src, load.attempt]);

  // Closing the dialog (unmount) stops playback. The element is captured now: React detaches refs
  // before it runs effect cleanups, so audio.current is already null by then.
  useEffect(() => { const el = audio.current; return () => stop(el); }, []);

  const items = load.list?.items || [];
  const groups = useMemo(() => [...new Set(items.map(i => i.group).filter(Boolean))], [items]);
  const rows = useMemo(() => items.filter(i => (!group || i.group === group) && matches({title:i.text, description:`${i.n} ${i.group || ''}`}, query)), [items, group, query]);
  rowsRef.current = rows;
  const byN = useMemo(() => new Map(items.map(i => [i.n, i])), [items]);

  const cue = useCallback((item, {play = true} = {}) => {
    const el = audio.current; if (!el || !item) return;
    currentRef.current = item.n; setCurrent(item.n); setStarted(true); onRow?.(item.n);
    if (el.getAttribute('src') !== item.src) { el.src = item.src; }
    mediaSession({title:item.text || `${a.title} ${item.n}`, album:a.title, art:a.cover || a.poster});
    if (play) el.play().catch(() => {});
  }, [a, onRow]);

  // A deep link (#id/12) opens on its row, lit and cued, without playing.
  useEffect(() => {
    if (load.state !== 'ready' || !row) return;
    const item = byN.get(row);
    if (!item) { onNotice?.(`This pack has no row ${row}.`); return; }
    cue(item, {play:false});
    // Scroll the list only (scrollIntoView would also scroll the dialog past its header).
    requestAnimationFrame(() => { const box = list.current, li = box?.querySelector(`[data-n="${row}"]`); if (li) box.scrollTop = li.offsetTop - (box.clientHeight - li.offsetHeight) / 2; });
  }, [load.state, row]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleRow(item) {
    const el = audio.current;
    if (current === item.n && el && !el.paused) { el.pause(); return; }
    setAll(false);
    if (current === item.n && el?.getAttribute('src')) { el.play().catch(() => {}); return; }
    cue(item);
  }
  function playAll() {
    const el = audio.current;
    if (all && el && !el.paused) { el.pause(); setAll(false); return; }
    if (!rows.length) return;
    setAll(true); allRef.current = true;
    const from = rows.find(r => r.n === currentRef.current) || rows[0];
    cue(from);
  }
  function next() {
    if (!allRef.current) return;
    const r = rowsRef.current, i = r.findIndex(x => x.n === currentRef.current);
    if (i >= 0 && i + 1 < r.length) cue(r[i + 1]); else setAll(false);
  }
  const currentItem = current ? byN.get(current) : null;

  return <div className="cr-pack">
    <div className="cr-pack-head">
      <img className="cr-pack-cover" src={a.cover || a.poster} alt=""/>
      <div>
        <p className="cr-kicker">{join([`${a.count} ${itemNoun(a, a.count)}`, fmt(a.duration), madeInLine(a)])}</p>
        <h2>{a.title}</h2>
        <p className="cr-pack-desc">{a.description}</p>
      </div>
    </div>
    <div className="cr-pack-tools">
      <label className="cr-search cr-pack-search"><Search size={16}/><input placeholder="Search this pack" aria-label={`Search ${a.title}`} value={query} onChange={e => setQuery(e.target.value)} disabled={load.state !== 'ready'}/>{query && <button aria-label="Clear pack search" onClick={() => setQuery('')}><X size={14}/></button>}</label>
      {groups.length > 1 && <label className="cr-select cr-pack-group"><span>{a.groupLabel || 'Group'}</span><select aria-label={`${a.groupLabel || 'Group'} filter`} value={group} onChange={e => setGroup(e.target.value)}><option value="">{everyGroup(a.groupLabel)}</option>{groups.map(g => <option key={g} value={g}>{g}</option>)}</select><ChevronDown size={15}/></label>}
      <button className="cr-primary cr-play-all" onClick={playAll} disabled={load.state !== 'ready' || !rows.length} aria-pressed={all && playing}>{all && playing ? <><Square size={14} fill="currentColor"/> Stop</> : <><Play size={15} fill="currentColor"/> Play all</>}</button>
    </div>
    <div className="cr-pack-list" ref={list} aria-busy={load.state === 'loading'}>
      {load.state === 'loading' && <p className="cr-pack-state" role="status"><LoaderCircle className="cr-spin" size={16}/> Loading {a.count} {itemNoun(a, a.count)}…</p>}
      {load.state === 'error' && <p className="cr-pack-state cr-pack-error" role="alert">This list couldn’t load. <button onClick={() => setLoad(l => ({...l, attempt:l.attempt + 1}))}>Try again</button></p>}
      {load.state === 'ready' && <>
        <p className="cr-pack-count" role="status">{rows.length === items.length ? `${items.length} ${itemNoun(a, items.length)}` : `${rows.length} of ${items.length}`}</p>
        {rows.length ? <ol>{rows.map(item => {
          const lit = item.n === current, live = lit && playing;
          return <li key={item.n} data-n={item.n} className={lit ? 'lit' : ''} aria-current={lit ? 'true' : undefined}>
            <button className="cr-row" onClick={() => toggleRow(item)} aria-label={`${live ? 'Pause' : 'Play'} ${item.n}: ${item.text}`}>
              <span className="cr-row-n">{String(item.n).padStart(2, '0')}</span>
              <span className="cr-row-icon">{live ? <Pause size={13} fill="currentColor"/> : <Play size={13} fill="currentColor"/>}</span>
              <span className="cr-row-text">{item.text}</span>
              {item.group && <span className="cr-row-group">{item.group}</span>}
              <span className="cr-row-time">{clock(item.duration)}</span>
            </button>
            <a className="cr-row-dl" href={item.src} download aria-label={`Download ${item.n}: ${item.text}`}><Download size={14}/></a>
          </li>;
        })}</ol> : <p className="cr-pack-state">Nothing in this pack says that. Yet.</p>}
      </>}
    </div>
    <div className={`cr-now${started ? ' on' : ''}`}>
      <span className="cr-now-label">{currentItem ? <><b>{String(currentItem.n).padStart(2, '0')}</b> {currentItem.text}</> : 'Pick a line, or play all.'}</span>
      <audio ref={audio} controls preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); next(); }} onError={() => { if (audio.current?.getAttribute('src')) onNotice?.(`This ${itemNoun(a, 1)} couldn’t load.`); }}/>
    </div>
  </div>;
}

// ------------------------------------------------------------------ the dialog
function Player({a, row, saved, setSaved, onToggle, onClose}) {
  const kind = kindOf(a), [error, setError] = useState(false), [notice, setNotice] = useState(''), [packRow, setPackRow] = useState(row), media = useRef(null);
  useEffect(() => { setError(false); setNotice(''); setPackRow(row); }, [a.id, row]);
  // A song or film stops when the dialog closes or moves to another record.
  useEffect(() => { const el = media.current; return () => stop(el); }, [a.id]);
  const selected = saved.shortlist.includes(a.id);
  const related = relatedOf(a).map(id => byKey.get(id)).filter(Boolean);
  async function share() {
    const url = `${location.origin}${location.pathname}#${a.id}${kind === 'pack' && packRow ? `/${packRow}` : ''}`;
    try { await navigator.clipboard.writeText(url); setNotice(kind === 'pack' && packRow ? `Link to row ${packRow} copied.` : 'Link copied.'); } catch { setNotice(url); }
  }
  const kicker = kind === 'video' ? join([fmt(a.duration), a.width && a.height ? `${a.width} × ${a.height}` : '', a.fps ? `${a.fps} fps` : '', a.audio ? 'Audio included' : 'Silent footage', madeInLine(a)])
    : join([fmt(a.duration), extOf(a.src), madeInLine(a)]);
  const transcriptLabel = kind === 'audio' ? (a.category === 'Songs' ? 'Lyrics' : 'Words') : 'Dialogue / phrases';
  const download = a.download || a.src, original = kind === 'audio' && download.split('?')[0] !== a.src.split('?')[0];
  return <div className={`cr-modal cr-modal-${kind}`}>
    <div className="cr-modal-top"><span>{a.category} / {a.status}</span><button onClick={onClose} aria-label="Close player"><X/></button></div>
    {kind === 'video' && <video key={a.id} ref={media} src={a.src} poster={isPortrait(a) && a.still ? a.still : a.posterLarge || a.poster} controls playsInline preload="metadata" className={isPortrait(a) ? 'portrait' : ''} style={a.width && a.height ? {aspectRatio:`${a.width} / ${a.height}`} : undefined} onError={() => setError(true)}/>}
    {kind === 'audio' && <div className="cr-listen">
      <img className="cr-cover" src={a.cover || a.poster} alt={`${a.title}, cover`}/>
      <audio key={a.id} ref={media} src={a.src} controls preload="metadata" onPlay={() => mediaSession({title:a.title, album:madeInOf(a)[0] ? pretty(madeInOf(a)[0]) : '', art:a.cover || a.poster, size:a.cover ? '600x600' : '640x360'})} onError={() => setError(true)}/>
    </div>}
    {kind === 'pack' && <PackPlayer key={a.id} a={a} row={row} onRow={setPackRow} onNotice={setNotice}/>}
    {error && <p role="alert" className="cr-player-error">This {kind === 'audio' ? 'track' : 'clip'} couldn’t load. <a href={a.src} target="_blank" rel="noreferrer">Open it directly</a> or try again.</p>}
    <div className="cr-modal-content"><div>
      {kind !== 'pack' && <><p className="cr-kicker">{kicker}</p><h2>{a.title}</h2><p>{a.description}</p></>}
      {a.notes && <p className="cr-clip-notes">{a.notes}</p>}
      {kind !== 'pack' && a.transcript && <details><summary>{transcriptLabel}</summary><p>{a.transcript}</p></details>}
      {related.length > 0 && <div className="cr-related">{related.map(r => <a key={r.id} href={`#${r.id}`}>{kindOf(r) === 'video' ? <Film size={15}/> : kindOf(r) === 'pack' ? <ListMusic size={15}/> : <Music size={15}/>} {kindOf(r) === 'video' ? 'Watch the film' : kindOf(r) === 'pack' ? 'Open the pack' : 'Hear the song'} <span>{r.title}</span></a>)}</div>}
      <div className="cr-modal-actions">
        <button className="cr-primary" onClick={() => onToggle(a.id)}>{selected ? <Check size={16}/> : <Bookmark size={16}/>} {selected ? 'Shortlisted' : 'Add to shortlist'}</button>
        {kind === 'pack' ? <a href={a.src} download={`${a.id}.json`}><Download size={16}/> Download the list</a>
          : <a href={download} download><Download size={16}/> Download{kind === 'audio' ? ` ${extOf(download)}` : ''}</a>}
        {original && <a href={a.src} download><Download size={16}/> {extOf(a.src)}</a>}
        <button onClick={share}>Copy link <ArrowUpRight size={16}/></button>
      </div>
      <p role="status" className="cr-notice">{notice}</p>
    </div>
    <label className="cr-notes-label">YOUR EDIT NOTES<textarea value={saved.notes[a.id] || ''} onChange={e => setSaved(s => ({...s, notes:{...s.notes, [a.id]:e.target.value}}))} placeholder={kind === 'video' ? 'Great reaction at 0:06. Cut to printer. Hold the silence.' : kind === 'pack' ? 'Row 12 under the applause. Row 31 for the sign-off.' : 'Bring it in at the second chorus. Fade before the printer jams.'}/><small>Saved on this device. Included in shortlist export.</small></label></div>
  </div>;
}

function App() {
  const [saved, setSaved] = useState(readSaved), [search, setSearch] = useState(''), [category, setCategory] = useState(EVERYTHING), [cast, setCast] = useState('Everyone'), [made, setMade] = useState(''), [status, setStatus] = useState('current'), [onlySaved, setOnlySaved] = useState(false), [limit, setLimit] = useState(PAGE), [active, setActive] = useState(null);
  const dialog = useRef(null), lastFocus = useRef(null);
  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch {} }, [saved]);
  useEffect(() => { setLimit(PAGE); }, [search, category, cast, made, status, onlySaved]);
  // The # part of the URL opens a record by id or alias, and a pack on a row (#id/12).
  useEffect(() => {
    const read = () => { const {key, row} = parseHash(location.hash), a = key && byKey.get(key); setActive(a ? {a, row} : null); };
    read(); addEventListener('hashchange', read);
    return () => removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    const d = dialog.current; if (!d) return;
    if (active) { if (!d.open) { lastFocus.current = document.activeElement; d.showModal(); } }
    else if (d.open) { d.close(); lastFocus.current?.focus?.(); }
  }, [active]);
  const open = a => { setHash(a.id); setActive({a, row:null}); };
  const close = () => { clearHash(); setActive(null); };
  const toggle = id => setSaved(s => ({...s, shortlist:s.shortlist.includes(id) ? s.shortlist.filter(x => x !== id) : [...s.shortlist, id]}));
  const rows = useMemo(() => assets.filter(a =>
    (category === EVERYTHING || a.category === category) && (cast === 'Everyone' || a.cast.includes(cast)) &&
    (!made || madeInOf(a).includes(made)) && inVersion(a, status) && (!onlySaved || saved.shortlist.includes(a.id)) && matches(a, search),
  ), [search, category, cast, made, status, onlySaved, saved.shortlist]);
  const hero = useMemo(() => heroOf(assets), []), fresh = useMemo(() => justMade(assets), []);
  function exportList() {
    const clips = assets.filter(a => saved.shortlist.includes(a.id)).map(a => ({title:a.title, url:new URL(a.src, location.origin).href, duration:a.duration, cast:a.cast, notes:saved.notes[a.id] || '', status:a.status, kind:kindOf(a), madeIn:madeInOf(a)}));
    const blob = new Blob([JSON.stringify({project:'LinkedIn Beats', created:new Date().toISOString(), clips}, null, 2)], {type:'application/json'}), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = 'linkedin-beats-edit-shortlist.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  const reset = () => { setSearch(''); setCategory(EVERYTHING); setCast('Everyone'); setMade(''); setStatus('all'); setOnlySaved(false); };
  const cardProps = {saved, onOpen:open, onToggle:toggle, onCast:setCast};
  return <div className="cr-page">
    <header className="cr-nav"><a href="/" className="cr-logo">LINKEDIN BEATS<span>_</span></a><span className="cr-nav-label"><i/> CUTTING ROOM / UNLISTED</span><a href="/studio/" className="cr-studio">Go to the studio <ArrowUpRight size={17}/></a></header>
    <main>
      <div className="cr-intro"><div><p className="cr-kicker">THE OFFICE. EVERY TAKE.</p><h1>The Cutting Room<span>.</span></h1><p>Extraordinary footage and music about extremely ordinary business.</p></div><div className="cr-total"><strong>{assets.length}</strong><span>films, songs<br/>and questionable decisions</span></div></div>
      <section className="cr-feature" aria-label="Latest edit" data-id={hero.id}>
        <button className="cr-feature-image" onClick={() => open(hero)} aria-label={`Watch ${hero.title}`}><img src={hero.poster} srcSet={hero.posterLarge ? `${hero.poster} 640w, ${hero.posterLarge} 1280w` : undefined} sizes="(max-width: 600px) 92vw, 58vw" alt={stillAlt(hero.title)} fetchpriority="high"/><span className="cr-round-play"><Play fill="currentColor"/></span><span className="cr-duration">{fmt(hero.duration)}</span></button>
        <div className="cr-feature-text"><span className="cr-pill"><i/> LATEST CUT</span><h2>{hero.title}</h2><p>{hero.description}</p>{madeInOf(hero)[0] && <p className="cr-feature-made">{madeInLine(hero)}</p>}<button className="cr-primary" onClick={() => open(hero)}><Play size={17} fill="currentColor"/> Watch the new cut</button></div>
      </section>
      {fresh.length > 0 && <section className="cr-fresh" aria-label="Just made">
        <div className="cr-fresh-heading"><h2>Just made.</h2><span>The newest things on record, films and songs alike.</span></div>
        <div className="cr-fresh-grid">{fresh.map(a => <Card key={a.id} a={a} compact {...cardProps}/>)}</div>
      </section>}
      <section className="cr-library" aria-label="Media catalog">
        <div className="cr-library-heading"><h2>Everything, on record.</h2><div><button className={onlySaved ? 'cr-saved active' : 'cr-saved'} onClick={() => setOnlySaved(!onlySaved)} aria-pressed={onlySaved}><Bookmark size={16}/> Shortlist <b>{saved.shortlist.length}</b></button><button className="cr-export" onClick={exportList} disabled={!saved.shortlist.length} aria-label="Export shortlist"><Download size={18}/></button></div></div>
        <div className="cr-categories" aria-label="Categories">{PILLS.map(c => <button key={c} className={category === c ? 'active' : ''} aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}</div>
        <div className="cr-tools">
          <label className="cr-search"><Search size={18}/><input placeholder="Search a character, phrase, song or scene…" aria-label="Search the library" value={search} onChange={e => setSearch(e.target.value)}/>{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={16}/></button>}</label>
          <label className="cr-select cr-cast"><span>Cast</span><select aria-label="Cast filter" value={cast} onChange={e => setCast(e.target.value)}>{['Everyone', ...catalog.cast].map(c => <option key={c}>{c}</option>)}</select><ChevronDown size={15}/></label>
          <label className="cr-select cr-made"><span>Made in</span><select aria-label="Made in filter" value={made} onChange={e => setMade(e.target.value)}><option value="">Everywhere</option>{MADE_IN.map(m => <option key={m} value={m}>{pretty(m)}</option>)}</select><ChevronDown size={15}/></label>
          <label className="cr-select cr-version"><SlidersHorizontal size={15}/><select aria-label="Version filter" value={status} onChange={e => setStatus(e.target.value)}><option value="current">Current + source takes</option><option value="all">Include earlier versions</option><option value="review">Needs review</option></select><ChevronDown size={15}/></label>
        </div>
        <div className="cr-results"><span>{rows.length} on record{onlySaved ? ' in your shortlist' : ''}</span><span>Click to play. Packs open as a playlist.</span></div>
        <div className="cr-grid">{rows.slice(0, limit).map(a => <Card key={a.id} a={a} {...cardProps}/>)}</div>
        {!rows.length && <div className="cr-empty"><Film size={32}/><h3>Nothing on record here.</h3><p>Try a different phrase or clear the filters.</p><button onClick={reset}>Show everything</button></div>}
        {rows.length > limit && <button className="cr-more" onClick={() => setLimit(n => n + PAGE)}>Load more <ChevronDown size={18}/></button>}
      </section>
      <section className="cr-edit-note"><span>FOR THE NEXT EDIT</span><p>Start with a very small achievement.<br/>Add a very large announcement.</p><div>Save the best reactions, a musical interruption, and one unnecessary printer shot. Your shortlist and notes stay in this browser; export them to keep or share an edit plan.</div></section>
    </main>
    <p className="cr-catalog-note">Unlisted catalog · Anyone with the link can view it · {catalog.updated}</p>
    <SiteFooter base="../"/>
    <dialog ref={dialog} className="cr-dialog" aria-label={active ? active.a.title : 'Player'} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === dialog.current) close(); }}>
      {active && <Player a={active.a} row={active.row} saved={saved} setSaved={setSaved} onToggle={toggle} onClose={close}/>}
    </dialog>
  </div>;
}
const root = import.meta.hot?.data.root || createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<App/>);
