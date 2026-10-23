// Start both playback paths inside the original tap, before fetching samples.
// The silent media element keeps Web Audio audible on iOS with the ringer off.
export function createMobileAudio(ctx) {
 let media, url, disposed=false;
 function release() {
  media?.pause();media?.remove();media=null;
  if(url)URL.revokeObjectURL(url);url=null;
 }
 function resume() {
  if(disposed)return Promise.reject(Error('The audio session is closed. Reload the page to play.'));
  const resuming=ctx.resume();
  const source=ctx.createBufferSource();
  source.buffer=ctx.createBuffer(1,1,22050);source.connect(ctx.destination);
  source.onended=()=>source.disconnect();source.start(0);
  if(!media) {
   const buffer=new ArrayBuffer(844),view=new DataView(buffer);
   const word=(offset,text)=>[...text].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
   word(0,'RIFF');view.setUint32(4,836,true);word(8,'WAVE');word(12,'fmt ');
   view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
   view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);
   word(36,'data');view.setUint32(40,800,true);
   media=document.createElement('audio');media.hidden=true;media.loop=true;
   media.setAttribute('playsinline','');media.setAttribute('data-cb-unlock','');
   url=URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));media.src=url;
   document.body.appendChild(media);
  }
  // A denied media play must remain retryable on the next real tap.
  const active=media;
  const playing=active.play();
  playing?.catch(()=>{if(media===active)release();});
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Audio is paused by your browser. Tap Play again to enable it.')),5000);
   Promise.resolve(resuming).then(()=>{
    clearTimeout(timer);
    if(ctx.state!=='running')reject(Error('Tap Play again to enable audio.'));
    else resolve();
   },error=>{clearTimeout(timer);reject(error);});
  });
 }
 return {resume,pause(){media?.pause();},dispose(){disposed=true;release();}};
}
