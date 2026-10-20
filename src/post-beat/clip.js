import {createPostBeat} from './audio.js';
import {VIDEO_MIMES,pickMime,extFor,mp4Support,startMp4Capture} from '../exporter.js';

const LENGTH=10,cache=new Map();
export const clipKey=(recipe,cover)=>JSON.stringify([recipe,cover.id]);
export const cachedClip=(recipe,cover)=>cache.get(clipKey(recipe,cover));
const aborted=()=>new DOMException('Cancelled','AbortError');

function lines(ctx,text,width){
  const result=[];let row='';
  for(const word of text.split(/\s+/)){const next=row?`${row} ${word}`:word;if(row&&ctx.measureText(next).width>width){result.push(row);row=word;}else row=next;}
  if(row)result.push(row);return result;
}
function artwork(canvas,image,recipe,elapsed,spectrum){
  const c=canvas.getContext('2d');c.fillStyle='#0757ec';c.fillRect(0,0,1080,1080);
  c.fillStyle='#fbf6e8';c.font='600 23px C2Hoves, Arial';c.fillText('LINKEDIN BEATS / YOUR DEBUT SINGLE',52,68);
  let size=78,rows;
  do{c.font=`${size}px Anton, Impact, sans-serif`;rows=lines(c,recipe.chorus.toUpperCase(),976);size-=2;}while(rows.length>3&&size>40);
  rows.forEach((row,i)=>c.fillText(row,52,164+i*(size+11)));
  const h=1000*image.height/image.width;c.drawImage(image,40,390+(476-h)/2,1000,h);
  const bins=52,gap=7,w=(976-gap*(bins-1))/bins;
  for(let i=0;i<bins;i++){
    const energy=spectrum?.[Math.floor(i*(spectrum.length*.7)/bins)]||0;
    const height=7+Math.min(86,energy*.34);c.fillStyle=i/bins<elapsed/LENGTH?'#fff349':'#a2c2fa';
    c.fillRect(52+i*(w+gap),940-height/2,w,height);
  }
  c.font='23px C2Hoves, Arial';c.fillStyle='#fbf6e8';c.fillText('linkedinbeats.com',52,1040);c.textAlign='right';c.fillText(`0:${String(Math.min(10,Math.floor(elapsed))).padStart(2,'0')} / 0:10`,1028,1040);c.textAlign='left';
  if(elapsed>8.6){
    c.fillStyle=`rgba(7,87,236,${Math.min(1,(elapsed-8.6)/.22)})`;c.fillRect(0,0,1080,1080);
    c.fillStyle='#fbf6e8';c.font='88px Anton, Impact, sans-serif';c.fillText('MAKE YOUR OWN.',60,493);
    c.font='40px C2Hoves, Arial';c.fillText('linkedinbeats.com',64,570);
    c.fillStyle='#fff349';c.font='25px C2Hoves, Arial';c.fillText('Send it to someone who gets it.',64,664);
  }
}
function mediaCapture(canvas,audio){
  const mime=pickMime(VIDEO_MIMES);if(!mime)throw new Error('This browser can share the listening link, but cannot make a video clip.');
  const video=canvas.captureStream(30),stream=new MediaStream([...video.getVideoTracks(),...audio.getAudioTracks()]);
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4_000_000,audioBitsPerSecond:192_000});
  const chunks=[];let failure;recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onerror=e=>{failure=e.error||new Error('The clip could not be recorded.');};
  recorder.start(250);
  return {stop(discard){return new Promise((resolve,reject)=>{
    const done=()=>{video.getTracks().forEach(t=>t.stop());if(failure)reject(failure);else resolve(discard?null:new Blob(chunks,{type:recorder.mimeType}));};
    if(recorder.state==='inactive')done();else{recorder.onstop=done;recorder.stop();}
  });}};
}

// Records the personalized chorus and the same band heard in the player.
// No microphone, account login, or third-party upload is requested.
export async function createShareClip({recipe,cover,signal,onProgress=()=>{}}){
  const existing=cachedClip(recipe,cover);if(existing)return existing;
  const player=createPostBeat();player.unlock(); // keep mobile unlock in the tap
  let capture,raf,stopped=false;
  try{
    const image=new Image();image.src=cover.image;
    const [buffers]=await Promise.all([player.prepare(recipe,signal),image.decode(),document.fonts.load('60px Anton'),document.fonts.load('24px C2Hoves')]);
    if(signal?.aborted)throw aborted();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1080;
    artwork(canvas,image,recipe,0,null);
    const mp4=await mp4Support(player.sampleRate());
    if(signal?.aborted)throw aborted();
    // Keep the graph unlocked by the original tap for mobile capture.
    player.play(recipe,buffers,{offset:5,reuseGraph:true});
    capture=mp4?startMp4Capture({canvas,audioTrack:player.audioTrack(),sampleRate:player.sampleRate()}):mediaCapture(canvas,player.stream());
    await new Promise((resolve,reject)=>{
      const cancel=()=>{cleanup();reject(aborted());};
      const hidden=()=>{if(document.hidden){cleanup();reject(new Error('Keep this window open while your clip is made. Your listening link is ready to share.'));}};
      const cleanup=()=>{signal?.removeEventListener('abort',cancel);document.removeEventListener('visibilitychange',hidden);cancelAnimationFrame(raf);};
      signal?.addEventListener('abort',cancel,{once:true});document.addEventListener('visibilitychange',hidden);
      const tick=()=>{
        const t=Math.max(0,player.elapsed()-5);if(t>9.5)player.volume(.75*Math.max(0,(LENGTH-t)/.5));artwork(canvas,image,recipe,t,player.spectrum());onProgress(Math.min(1,t/LENGTH));
        if(t>=LENGTH){cleanup();resolve();}else raf=requestAnimationFrame(tick);
      };tick();
    });
    const blob=await capture.stop();stopped=true;
    if(signal?.aborted)throw aborted();
    if(!blob||blob.size<10000)throw new Error('The clip could not be completed. Your listening link is ready to share.');
    const file=new File([blob],`linkedin-beats-${cover.id}.${extFor(blob.type)}`,{type:blob.type.split(';')[0]});
    if(cache.size>=3)cache.delete(cache.keys().next().value);cache.set(clipKey(recipe,cover),file);
    return file;
  }finally{cancelAnimationFrame(raf);if(capture&&!stopped)await capture.stop(true).catch(()=>{});player.dispose();}
}
