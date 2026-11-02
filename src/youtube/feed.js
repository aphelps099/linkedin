import {useEffect, useState} from 'react';
import catalog from './catalog.json';

export const CHANNEL_URL='https://www.youtube.com/@linkedinbeats';
export const thumbnailFor=item=>`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
export const videoUrl=item=>item.kind==='short'?`https://www.youtube.com/shorts/${item.id}`:`https://www.youtube.com/watch?v=${item.id}`;
let request;
export function useYouTubeFeed() {
  const [feed,setFeed]=useState({items:catalog,loading:true,stale:false});
  useEffect(()=>{
    let active=true;
    request ||= fetch('/api/youtube',{signal:AbortSignal.timeout(10000)}).then(response=>{
      if(!response.ok) throw new Error('Feed unavailable');
      return response.json();
    }).then(data=>{
      if(!Array.isArray(data.items)) throw new Error('Invalid feed');
      return {...data,items:data.items.filter(item=>/^[\w-]{11}$/.test(item.id)&&typeof item.title==='string')};
    }).catch(()=>({items:catalog,stale:true}));
    request.then(data=>{if(active)setFeed({...data,loading:false});});
    return ()=>{active=false;};
  },[]);
  return feed;
}

// One upload after every two existing cards, keeping both kinds represented.
export function interleaveUploads(existing, uploads) {
  const shorts=uploads.filter(item=>item.kind==='short');
  const videos=uploads.filter(item=>item.kind!=='short');
  const featured=[];
  while(featured.length<4 && (shorts.length||videos.length)) {
    const queue=featured.length%2===0?shorts:videos;
    featured.push((queue.length?queue:shorts.length?shorts:videos).shift());
  }
  return existing.flatMap((item,index)=>[item,...(index%2===0&&featured.length?[{...featured.shift(),youtube:true}]:[])]);
}
