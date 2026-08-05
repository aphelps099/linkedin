import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '../components/controls/Button.jsx';
import { scorePost } from '../lessons/score.js';
import { RedactedText } from './RedactedText.jsx';

function handoff(path, key, text){
  location.href = `${path}#${key}=${encodeURIComponent(text)}`;
}

function ExhibitInspector({ exhibit, onClose }){
  const score = React.useMemo(() => scorePost(exhibit.body), [exhibit.body]);
  const closeRef = React.useRef(null);

  React.useEffect(() => {
    const onKey = event => { if(event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return <div className="museum-inspector-backdrop" role="presentation" onPointerDown={event => {
    if(event.target === event.currentTarget) onClose();
  }}>
    <article className="museum-inspector" role="dialog" aria-modal="true" aria-labelledby="museum-exhibit-title">
      <header className="museum-inspector-head">
        <div>
          <div className="museum-label">Exhibit {exhibit.no} · {exhibit.date}</div>
          <h2 id="museum-exhibit-title">{exhibit.title}</h2>
        </div>
        <button ref={closeRef} className="museum-inspector-close" type="button" aria-label="Close exhibit" onClick={onClose}>
          <X size={19} aria-hidden="true"/>
        </button>
      </header>
      <div className="museum-inspector-document">
        <RedactedText text={exhibit.body} size={15}/>
      </div>
      <div className="museum-inspector-plaque">
        <div className="museum-label" style={{ color: 'var(--text-meta)', marginBottom: 8 }}>Curator’s note</div>
        <div>{exhibit.plaque}</div>
        <div className="museum-inspector-quote">“{exhibit.quote.text}”</div>
        <div style={{ color: 'var(--text-meta)', marginTop: 4 }}>— {exhibit.quote.by}</div>
      </div>
      <footer className="museum-inspector-foot">
        <span className="museum-label" style={{ color: 'var(--text-meta)' }}>
          {exhibit.medium} · Index <b style={{ color: 'var(--blue)' }}>{score.index}</b>
        </span>
        <span className="museum-inspector-actions">
          <Button onClick={() => handoff('../roast/', 'roast', exhibit.body)}>Roast</Button>
          <Button onClick={() => handoff('../', 'beat', exhibit.body)}>Turn into a beat</Button>
        </span>
      </footer>
    </article>
  </div>;
}

function FramedExhibit({ exhibit, onInspect, active }){
  return <button className="museum-frame" type="button" onClick={() => onInspect(exhibit)}
    tabIndex={active ? 0 : -1}
    aria-label={`Inspect ${exhibit.title}`}>
    <div className="museum-frame-paper">
      <RedactedText text={exhibit.body} size={13}/>
    </div>
    <div className="museum-frame-caption">
      <strong>{exhibit.title}</strong>
      <span>{exhibit.no}</span>
    </div>
  </button>;
}

function SpatialRoom({ exhibits, page, setPage, onInspect }){
  const pages = [exhibits.slice(0, 2), exhibits.slice(2, 4), exhibits.slice(4, 6)];
  return <div className="museum-room" aria-label="Spatial gallery view">
    <div className="museum-room-track" style={{ transform: `translateX(-${page * 33.3333}%)` }}>
      {pages.map((pair, wallIndex) =>
        <section className="museum-wall" key={wallIndex} aria-hidden={wallIndex !== page}>
          {pair.map(exhibit => <FramedExhibit key={exhibit.no} exhibit={exhibit} onInspect={onInspect} active={wallIndex === page}/>)}
        </section>)}
    </div>
    <div className="museum-room-controls">
      <button type="button" aria-label="Previous wall" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>
        <ChevronLeft size={21} aria-hidden="true"/>
      </button>
      <div className="museum-room-status" aria-live="polite">
        <b>Wall {page + 1} of {pages.length}</b>
        <span>Exhibits {page * 2 + 1}–{Math.min(exhibits.length, page * 2 + 2)} of {exhibits.length}</span>
      </div>
      <button type="button" aria-label="Next wall" disabled={page === pages.length - 1} onClick={() => setPage(value => Math.min(pages.length - 1, value + 1))}>
        <ChevronRight size={21} aria-hidden="true"/>
      </button>
    </div>
  </div>;
}

function ListRoom({ exhibits, onInspect }){
  return <div className="museum-list" aria-label="Museum exhibit list">
    {exhibits.map(exhibit =>
      <article className="museum-list-card" key={exhibit.no}>
        <button type="button" onClick={() => onInspect(exhibit)} aria-label={`Inspect ${exhibit.title}`}>
          <h3>{exhibit.title}</h3>
          <RedactedText text={exhibit.body} size={13}/>
        </button>
        <div className="museum-list-meta museum-label">{exhibit.no} · {exhibit.date} · Inspect exhibit</div>
      </article>)}
  </div>;
}

export function GalleryRoom({ room, exhibits, narrow }){
  const [reducedMotion, setReducedMotion] = React.useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [view, setView] = React.useState(() => narrow || reducedMotion ? 'list' : 'room');
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState(null);

  React.useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = event => setReducedMotion(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  React.useEffect(() => {
    if(narrow || reducedMotion) setView('list');
  }, [narrow, reducedMotion]);

  return <>
    <div className="museum-gallery-header">
      <div>
        <div className="museum-label">{room.wing} · {room.room}</div>
        <h2>{room.title}</h2>
        <div style={{ marginTop: 5, color: 'var(--text-meta)', fontSize: 13 }}>{room.subtitle}</div>
      </div>
      <div className="museum-view-switch" aria-label="Gallery view">
        <button type="button" aria-pressed={view === 'room'} onClick={() => setView('room')}>Room</button>
        <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
      </div>
    </div>
    {view === 'room'
      ? <SpatialRoom exhibits={exhibits} page={page} setPage={setPage} onInspect={setSelected}/>
      : <ListRoom exhibits={exhibits} onInspect={setSelected}/>}
    {selected && <ExhibitInspector exhibit={selected} onClose={() => setSelected(null)}/>}
  </>;
}
