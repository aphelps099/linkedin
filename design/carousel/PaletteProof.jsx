import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CarouselArtwork} from '../../src/home-2/CarouselArtwork.jsx';
import {ARTWORK_PROOFS, PALETTE} from './palette-proof-data.mjs';

export function renderProof() {
  return renderToStaticMarkup(<div id="lb-palette-proof">
    <div className="proof-palette" aria-label="Proposed brand palette from Learn">
      {PALETTE.map(color => <div className="proof-swatch" key={color.name}>
        <span className="proof-chip" style={{backgroundColor:color.hex}} aria-hidden="true"/>
        <strong>{color.name}</strong><code>{color.hex}</code>
      </div>)}
    </div>
    <section className="proof-feed" aria-label="Carousel color and editable headline studies">
      <div className="proof-heading"><h2>Humbled to share.</h2></div>
      <div className="proof-rail">
        {ARTWORK_PROOFS.map((item,i) => <article id={`proof-${item.id}`} key={item.id} className={`proof-card proof-card--${item.shape}`} aria-label={`${i+1} of 6`}>
          <div className="proof-art"><CarouselArtwork artwork={item}/></div>
          <div className="proof-copy"><h3>{item.caption}</h3><div className="proof-actions" aria-hidden="true"><span><i data-lucide={['partnership','certified'].includes(item.id)?'file-text':'headphones'}/></span><span><i data-lucide="external-link"/></span></div></div>
        </article>)}
      </div>
      <div className="proof-controls"><button type="button" className="proof-prev cursor-interaction" aria-label="Previous card">‹</button><div className="proof-pagination">{ARTWORK_PROOFS.map((item,i)=><button key={item.id} type="button" className="cursor-interaction" data-index={i} aria-label={`Show ${item.id} artwork`} aria-current={i===0?'true':undefined}><span/></button>)}</div><button type="button" className="proof-next cursor-interaction" aria-label="Next card">›</button></div>
      <span className="proof-sr" role="status" aria-live="polite"/>
    </section>
  </div>);
}
