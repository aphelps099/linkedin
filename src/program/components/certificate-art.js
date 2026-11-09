import {certificateTemplate} from './certificate-template.js';
import {nameGlyphs,unitsPerEm} from './certificate-name-glyphs.js';

export const escapeCertificateText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const certificateName = value => [...String(value || '').normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu,'').replace(/\s+/gu,' ').trim()].slice(0,60).join('') || 'Aspiring Thought Leader';

// Use the same vector lettering on the page, in print and in server-rendered PNGs.
// Names unsupported by the brand font retain their original Unicode text.
function recipientMarkup(value){
  const name=certificateName(value), letters=[...name];
  const advance=letters.reduce((sum,c)=>sum+(nameGlyphs[c]?.[0] ?? unitsPerEm),0);
  const size=Math.min(82,920*unitsPerEm/Math.max(advance,1));
  const scale=size/unitsPerEm;
  let x=0;
  const paths=letters.map(c=>{
    const glyph=nameGlyphs[c];
    const shape=glyph
      ? `<path transform="translate(${x} 0)" d="${glyph[1]}"/>`
      : `<text x="${x}" y="0" transform="scale(1 -1)" font-family="sans-serif" font-weight="900" font-size="${unitsPerEm}">${escapeCertificateText(c)}</text>`;
    x+=glyph?.[0] ?? unitsPerEm;
    return shape;
  }).join('');
  return `<g aria-label="${escapeCertificateText(name)}" fill="#20334a" transform="translate(${600-advance*scale/2} 594) scale(${scale} ${-scale})">${paths}</g>`;
}
export function certificateMarkup(value,assets={},id='lb-certificate'){
  const safeId=String(id).replace(/[^a-zA-Z0-9_-]/g,'')||'lb-certificate';
  return certificateTemplate.replaceAll('CERTIFICATE_GRID',`${safeId}-grid`).replace('<!--RECIPIENT-->',()=>recipientMarkup(value));
}
export function certificateSvg(name,assets){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 850" width="1200" height="850" role="img" aria-label="${escapeCertificateText(`Certificate of Professional Effort awarded to ${certificateName(name)}. Certified Thought Leader.`)}">${certificateMarkup(name,assets)}</svg>`;
}
