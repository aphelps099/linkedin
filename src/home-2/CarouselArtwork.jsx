import React from 'react';
import './carousel-artwork-palette.css';
import './carousel-artwork.css';

/** Artwork-only replacement for DispatchCarousel's Artwork.
 * The parent owns dimensions, card radius, copy, controls, and all interactions.
 * Raster assets must contain no headlines, logos, card chrome, or controls.
 * Shared by the live homepage and the saved palette review.
 */
export function CarouselArtwork({artwork, base = '/'}) {
  const {tone = 'cobalt', texture, image, imagePosition, lines, highlight,
    placement = 'center', motif, kicker, footer, layout = 'standard'} = artwork;
  return <div className={[
    'lb-editorial-art', `lb-editorial-art--${tone}`, `lb-editorial-art--${placement}`,
    texture && `lb-editorial-art--${texture}`, motif && `lb-editorial-art--${motif}`,
    highlight && `lb-editorial-art--highlight-${highlight}`,
    `lb-editorial-art--layout-${layout}`,
  ].filter(Boolean).join(' ')}>
    {image && <img className="lb-editorial-art__image" src={`${base}${image}`} alt="" loading="lazy" decoding="async" style={{objectPosition: imagePosition}}/>}
    <img className="lb-editorial-art__mark" src={`${base}brand/afterbeat/wordmark-${['cobalt','black'].includes(tone) ? 'white' : 'black'}.svg`} alt="LinkedIn Beats"/>
    {motif === 'orbit' && <div className="lb-editorial-art__orbit" aria-hidden="true">{Array.from({length: 56}, (_, i) => <i key={i} style={{'--angle': `${i * 360 / 56}deg`}}/>)}</div>}
    {motif === 'wave' && <div className="lb-editorial-art__wave" aria-hidden="true">{Array.from({length: 58}, (_, i) => <i key={i} style={{height: `${8 + (Math.sin(i * 1.31) ** 2) * (20 + 68 * Math.sin(i / 57 * Math.PI) ** 4)}%`}}/>)}</div>}
    {motif === 'vinyl' && <div className="lb-editorial-art__vinyl" aria-hidden="true"><i/></div>}
    {motif === 'steps' && <div className="lb-editorial-art__steps" aria-hidden="true"><i/><i/><i/><i/></div>}
    {motif === 'fold' && <img className="lb-editorial-art__fold" src={`${base}home-2/artwork/unpack-fold.svg`} alt="" aria-hidden="true" loading="lazy" decoding="async"/>}
    <div className="lb-editorial-art__copy">
      {kicker && <span className="lb-editorial-art__kicker">{kicker}</span>}
      <div className="lb-editorial-art__title">{lines.map((line, i) => <React.Fragment key={`${i}-${line}`}><span>{highlight ? <span className="lb-editorial-art__highlight-text">{line}</span> : line}</span>{i < lines.length - 1 && <br/>}</React.Fragment>)}</div>
    </div>
    {footer && <span className="lb-editorial-art__footer">{footer}</span>}
  </div>;
}
