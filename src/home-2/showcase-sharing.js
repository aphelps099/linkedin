import {showcaseSelection} from './showcase-selection.js';
export const SHOWCASE_ORIGIN='https://linkedinbeats.com';
export function sharedFilm(search=''){
  const id=new URLSearchParams(search).get('film');
  return showcaseSelection.find(item=>item.film&&item.id===id)||null;
}
export function showcaseShareUrl(item){
  const url=new URL(item.film?'/':'/studio/',SHOWCASE_ORIGIN);
  url.searchParams.set(item.film?'film':'meeting',item.film?item.id:item.meeting);
  if(item.film)url.hash='c2-dispatch';
  return url.href;
}
export function showcaseShareTargets(item,{appleMobile=false}={}){
  const url=showcaseShareUrl(item),text=`${item.title} — LinkedIn Beats`,body=`${text}\n\n${url}`;
  return {
    url,text,
    facebook:`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x:`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    email:`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(body)}`,
    sms:`sms:${appleMobile?'&':'?'}body=${encodeURIComponent(body)}`,
  };
}
