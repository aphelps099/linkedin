import React from 'react';
import { ArrowUp, X } from 'lucide-react';
import { TIMELINE } from './timeline.js';

function removeArchiveHash(){
  const next = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', next);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function HistoricalArchive({ open, onClose }){
  const closeRef = React.useRef(null);
  const corridorRef = React.useRef(null);

  React.useEffect(() => {
    if(!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    corridorRef.current?.scrollTo({ top: 0 });
    closeRef.current?.focus();

    const onKeyDown = event => {
      if(event.key === 'Escape'){
        removeArchiveHash();
        onClose();
      }
      if(event.key === 'Tab'){
        const focusable = corridorRef.current?.querySelectorAll('button, a[href]');
        if(!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if(event.shiftKey && document.activeElement === first){
          event.preventDefault();
          last.focus();
        } else if(!event.shiftKey && document.activeElement === last){
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if(!open) return null;

  return <aside className="archive-experience" role="dialog" aria-modal="true"
    aria-labelledby="archive-title" ref={corridorRef}>
    <div className="archive-grain" aria-hidden="true"/>
    <header className="archive-header">
      <div className="archive-kicker">
        <span>The Museum of Professional Communication</span>
        <span>Historical Archive · Wing III</span>
      </div>
      <button ref={closeRef} type="button" className="archive-close" aria-label="Close historical archive"
        onClick={() => {
          removeArchiveHash();
          onClose();
        }}>
        <span>Return to collection</span>
        <X size={18} aria-hidden="true"/>
      </button>
    </header>

    <main className="archive-main">
      <section className="archive-hero" aria-describedby="archive-intro">
        <div className="archive-accession">MM-1 / ARCHIVE 2003—2026</div>
        <h1 id="archive-title">A brief history of professional communication.</h1>
        <p id="archive-intro">
          From the quiet résumé years to the industrial production of thought leadership.
          The events are real. The interpretation has been approved by Human Resources.
        </p>
        <div className="archive-scroll-cue" aria-hidden="true">
          <span>Proceed through the collection</span>
          <i/>
        </div>
      </section>

      <section className="archive-timeline" aria-label="Professional internet timeline">
        {TIMELINE.map((event, index) =>
          <article className="archive-entry" key={`${event.year}-${event.title}`}>
            <div className="archive-entry-number">{String(index + 1).padStart(2, '0')}</div>
            <time dateTime={event.year}>{event.year}</time>
            <div className="archive-entry-copy">
              <div className="archive-entry-rule" aria-hidden="true"/>
              <h2>{event.title}</h2>
              <p>{event.note}</p>
            </div>
          </article>)}
      </section>

      <section className="archive-terminal">
        <div className="archive-accession">END OF ACCESSION</div>
        <h2>You are here.</h2>
        <p>The genre remains active. Additional evidence is being generated as you read this.</p>
        <button type="button" onClick={() => corridorRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
          <ArrowUp size={17} aria-hidden="true"/>
          Return to 2003
        </button>
      </section>
    </main>

    <footer className="archive-footer">
      <span>© Digital Creative 2026</span>
      <span>Authors anonymized. Clichés immortal.</span>
    </footer>
  </aside>;
}
