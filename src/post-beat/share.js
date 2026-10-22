import {decodeRecipe,encodeRecipe} from './composition.js';

export const COVERS=[
  {id:'paper-jam',name:'Paper Jam',title:'Paper Jam. Now printing absolute bangers.',image:'/share/optimizer-printer-20261022-v2.jpg',width:1200,height:630,alt:'A printer with built-in speakers prints LinkedIn images beside yellow headphones.'},
  {id:'synergy-team',name:'Office band',title:'Let’s circle back. Synergy & the office band.',image:'/share/synergy-team-20261022-v2.jpg',video:'/post-beat/covers/office-band-performance-20261022.mp4',width:1200,height:630,alt:'Synergy and four office colleagues in headsets play guitar, keyboards, drums and bass in front of LinkedIn banners.'},
  {id:'synth',name:'Sound business',title:'Sound business decisions.',image:'/share/synth-20261022-v2.jpg',width:1200,height:630,alt:'An ivory synthesizer with eight yellow pads, a blue waveform display and a piano keyboard.'},
];
export const DEFAULT_COVER=COVERS[0].id;
export const getCover=id=>COVERS.find(cover=>cover.id===id)||COVERS[0];
export const SLEEVE_THEMES={'paper-jam':['#0c1222','#222838','#ffffff','#fff349'],'synergy-team':['#0b1017','#222838','#ffffff','#fff349'],synth:['#06132c','#133562','#ffffff','#fff349']};

// Query parameters are visible to social crawlers. Old #mix links still play.
// The URL carries the frozen recipe: no database, video export, or expiry needed.
export function shareUrl(origin,recipe,coverId=DEFAULT_COVER,artist=''){
  const url=new URL('/optimizer',origin);
  url.searchParams.set('beat',encodeRecipe(recipe));
  url.searchParams.set('cover',getCover(coverId).id);
  if(artist.trim())url.searchParams.set('artist',artist.trim().slice(0,48));
  return url.href;
}
export function coverPreviewUrl(origin,recipe,coverId=DEFAULT_COVER,artist=''){
  const url=new URL(shareUrl(origin,recipe,coverId,artist));url.pathname='/api/beat/cover.png';url.searchParams.set('art','3');return url.href;
}
export function readSharedBeat(href){
  const url=new URL(href,'https://linkedinbeats.com');
  const recipe=decodeRecipe(url.searchParams.has('beat')?url.searchParams.get('beat'):url.hash);
  const artist=(url.searchParams.get('artist')||'').trim().slice(0,48);
  return recipe?{recipe,cover:getCover(url.searchParams.get('cover')),...(artist?{artist}:{})}:null;
}
export const suggestedCaption=recipe=>`“${recipe.chorus}”\n\nAn update from the studio.\nlinkedinbeats.com`;
export function shareDestinations(url,caption){
  return {
    linkedin:`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    facebook:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x:`https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(url)}`,
    email:`mailto:?subject=${encodeURIComponent('My latest deliverable has a bassline')}&body=${encodeURIComponent(`${caption}\n\nListen: ${url}`)}`,
  };
}
