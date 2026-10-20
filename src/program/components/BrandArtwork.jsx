import React from 'react';
import wordmark from '../../../public/home-2/brand/wordmark-horizontal.svg?raw';
import monogram from '../../../public/home-2/brand/monogram.svg?raw';

// Local, trusted brand paths stay embedded in SVG/PNG exports. No font or
// external image fetch is needed when the certificate is downloaded.
const paths = raw => raw.replace(/<svg[^>]*>|<\/svg>|<title>.*?<\/title>/g, '').replace(/fill="#[a-f0-9]+"/gi, 'fill="currentColor"');
const artwork = {wordmark:paths(wordmark), monogram:paths(monogram)};
export function BrandArtwork({variant='wordmark', x=0, y=0, width=400, height=40, color='#10182f'}){
  return <svg x={x} y={y} width={width} height={height} viewBox={variant==='wordmark' ? '0 -2 1087 104' : '0 0 100 100'} fill="currentColor" color={color} aria-hidden="true" dangerouslySetInnerHTML={{__html:artwork[variant]}}/>;
}
