import React from 'react';
import './product-visual.css';

export const isDesignPreview = product => product.previewOnly || ['CS-103','CS-201','CS-301','CS-302','CS-401','CS-402'].includes(product.sku);

export function ProductVisual({product, base='../', eager=false}){
  const src=product.img ? `${base}store/${product.img}` : product.sku==='CS-103' ? `${base}store/cs-103.webp` : product.sku==='CS-201' ? `${base}home/thought-leader-cap.webp` : null;
  if(src) return <img className={`merch-photo ${product.previewOnly?'merch-photo-preview':''}`} src={src} alt={product.name+(isDesignPreview(product)?' — design preview':'')} loading={eager?'eager':'lazy'} width="1024" height="1024"/>;
  return <div className={`merch-art merch-art-${product.sku}`} role="img" aria-label={`${product.name} — design preview`}>
    {product.sku==='CS-302' && <div className="merch-approval"><span>APPROVED — HR</span></div>}
    {product.sku==='CS-301' && <div className="merch-sheet"><span className="merch-sheet-label">THE OFFICE ESSENTIALS / CB®</span><div>{['↗','▮','®','↻','✳','→','+','↔','✓'].map((glyph,i)=><span key={i}>{glyph}</span>)}</div><small>APPLY WHERE APPROPRIATE.</small></div>}
    {product.sku==='CS-401' && <div className="merch-poster merch-poster-quote"><small>CIRCLE BACK® / PROFESSIONAL NOISE</small><strong>IT’S NOT<br/>AN INSTRUMENT.<br/><em>IT’S A<br/>JOURNEY.</em></strong><span>FORM CB–16 / PRINT DIVISION</span></div>}
    {product.sku==='CS-402' && <div className="merch-poster merch-poster-museum"><small>MUSEUM OF<br/>PROFESSIONAL COMMUNICATION</small><strong>LET<br/>THAT<br/>SINK<br/>IN.</strong><span>WING I · ADMISSION FREE</span></div>}
  </div>;
}
