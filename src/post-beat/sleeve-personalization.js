import {PEG5} from '../pegboard/fonts/peg5.js';
import {normalize} from '../pegboard/font.js';
// Shared by the social preview and exported video, so the sleeve is the release.
export function sleevePersonalization(artist=''){
  const name=normalize(artist.trim().slice(0,48)||'LinkedIn Beats').text||'LINKEDIN BEATS';
  const width=t=>[...t].reduce((n,c)=>n+(PEG5.glyphs[c]?.w??PEG5.space)+PEG5.tracking,0);
  const words=name.split(' '),rows=[];let row='';
  for(const word of words){if(row&&width(row+' '+word)>145){rows.push(row);row=word;}else row=row?row+' '+word:word;}if(row)rows.push(row);
  const pitch=Math.min(5.5,490/Math.max(...rows.map(width)),64/(rows.length*(PEG5.rows+3)));
  let dots='';rows.forEach((line,j)=>{let x=851-width(line)*pitch/2;for(const ch of line){const g=PEG5.glyphs[ch];if(g)g.bits.forEach((bits,y)=>[...bits].forEach((v,col)=>{if(v==='#')dots+=`<circle cx="${x+(col+.5)*pitch}" cy="${459+j*(PEG5.rows+3)*pitch+(y+.5)*pitch}" r="${pitch*.39}"/>`;}));x+=((g?.w??PEG5.space)+PEG5.tracking)*pitch;}});
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><path d="M586 420H1116L1132 436V518L1116 534H586L570 518V436Z" fill="#24394b"/><text x="851" y="445" text-anchor="middle" font-family="monospace" font-size="13" letter-spacing="3" fill="#ffae99">A DEBUT BY</text><g fill="#fff0c4">${dots}</g></svg>`;
}
export function personalizeSleeve(svg,artist){const overlay=sleevePersonalization(artist).replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');const end=svg.lastIndexOf('</svg>');return svg.slice(0,end)+overlay+svg.slice(end);}
