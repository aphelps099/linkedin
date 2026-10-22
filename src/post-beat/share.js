import {decodeRecipe,encodeRecipe} from './composition.js';

export const COVERS=[
  {id:'paper-jam',name:'Paper Jam',title:'Paper Jam. Now printing absolute bangers.',image:'/post-beat/covers/paper-jam-v1.png',width:1820,height:864,alt:'A vintage printer turned into a sound system, with yellow headphones and LinkedIn posts spilling onto the table.'},
  {id:'printer-overload',name:'Out of Control',title:'Thought leadership. Out of control.',image:'/post-beat/covers/printer-overload-v1.png',width:1816,height:866,alt:'A beige office printer overwhelmed by stacks of LinkedIn announcements covering a conference table.'},
  {id:'hr-paper-storm',name:'Overprinted',title:'Humbled. Honored. Overprinted.',image:'/post-beat/covers/hr-paper-storm-v1.png',width:1733,height:908,alt:'A deadpan HR executive in yellow headphones surrounded by a printer and mountains of LinkedIn announcements.'},
];
export const DEFAULT_COVER=COVERS[0].id;
export const getCover=id=>COVERS.find(cover=>cover.id===id)||COVERS[0];
export const SLEEVE_THEMES={'paper-jam':['#0c1222','#222838','#ffffff','#fff349'],'printer-overload':['#fff349','#e8d832','#111827','#111827'],'hr-paper-storm':['#f5f1e6','#e5e0d5','#1649e7','#1649e7']};

// Query parameters are visible to social crawlers. Old #mix links still play.
// The URL carries the frozen recipe: no database, video export, or expiry needed.
export function shareUrl(origin,recipe,coverId=DEFAULT_COVER,artist=''){
  const url=new URL('/lessons/',origin);
  url.searchParams.set('beat',encodeRecipe(recipe));
  url.searchParams.set('cover',getCover(coverId).id);
  if(artist.trim())url.searchParams.set('artist',artist.trim().slice(0,48));
  return url.href;
}
export function coverPreviewUrl(origin,recipe,coverId=DEFAULT_COVER,artist=''){
  const url=new URL(shareUrl(origin,recipe,coverId,artist));url.pathname='/api/beat/cover.png';url.searchParams.set('art','2');return url.href;
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
