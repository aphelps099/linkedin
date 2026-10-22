const aborted=()=>new DOMException('Cancelled','AbortError');

function waitFor(element,event,{signal,timeout=20000,begin=()=>{}}={}){
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(aborted());return;}
    const finish=error=>{clearTimeout(timer);element.removeEventListener(event,ready);element.removeEventListener('error',failed);signal?.removeEventListener('abort',cancel);error?reject(error):resolve(element);};
    const ready=()=>finish(),failed=()=>finish(new Error('The cover could not load. Please try again or choose another cover.')),cancel=()=>finish(aborted());
    const timer=setTimeout(()=>finish(new Error('The cover took too long to load. Please try again.')),timeout);
    element.addEventListener(event,ready,{once:true});element.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',cancel,{once:true});
    try{begin();}catch(error){finish(error);}
  });
}

export async function loadCoverImage(cover,signal){
  const image=new Image();image.crossOrigin='anonymous';
  return waitFor(image,'load',{signal,begin:()=>{image.src=cover.image;}});
}

export async function loadCoverMotion(cover,signal){
  if(!cover.video)return null;
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.crossOrigin='anonymous';
  const dispose=()=>{video.pause();video.removeAttribute('src');video.load();};
  try{await waitFor(video,'loadeddata',{signal,timeout:30000,begin:()=>{video.src=cover.video;video.load();}});}catch(error){dispose();throw error;}
  return {video,dispose,async seek(time){
    if(signal?.aborted)throw aborted();
    const target=Math.max(0,Math.min(time,video.duration-1/30));
    if(Math.abs(video.currentTime-target)<.001&&!video.seeking)return;
    await waitFor(video,'seeked',{signal,timeout:10000,begin:()=>{video.currentTime=target;}});
  }};
}
