import {createPostBeat} from './audio.js';
import {createAudioEngine} from '../audio.js';
import {supportsOfflineClip,encodeOfflineClip} from './encode.js';
import {SLEEVE_THEMES} from './share.js';
import {VIDEO_MIMES,pickMime,extFor,mp4Support,startMp4Capture} from '../exporter.js';

const LENGTH=10,cache=new Map();
export const clipKey=(recipe,cover)=>JSON.stringify(['release-v4',recipe,cover.id,cover.artist||'']);
export const cachedClip=(recipe,cover)=>cache.get(clipKey(recipe,cover));
const aborted=()=>new DOMException('Cancelled','AbortError');

function lines(ctx,text,width){
  const result=[];let row='';
  for(const word of text.split(/\s+/)){const next=row?`${row} ${word}`:word;if(row&&ctx.measureText(next).width>width){result.push(row);row=word;}else row=next;}
  if(row)result.push(row);return result;
}
// A typographic sleeve. No stock thumbnail/personal-title collage.
export function drawShareArtwork(canvas,_image,recipe,elapsed=0,spectrum=null,cover={}){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const [base,stripe,ink,accent]=SLEEVE_THEMES[cover.id]||SLEEVE_THEMES['paper-jam'];
  c.fillStyle=base;c.fillRect(0,0,w,h);c.save();c.translate(w/2,h/2);c.rotate(-Math.PI/4);c.fillStyle=stripe;for(let x=-w*2;x<w*2;x+=64)c.fillRect(x,-h*2,30,h*4);c.restore();
  c.fillStyle=accent;c.font='600 25px C2Hoves, Arial';c.fillText(`${(cover.name||'Paper Jam').toUpperCase()} SERIES`,64,83);
  c.font='19px C2Hoves, Arial';c.textAlign='right';c.fillText('LINKEDIN BEATS',w-64,83);c.textAlign='left';
  let size=220,rows;
  do{c.font=`${size}px Anton, Impact, sans-serif`;rows=lines(c,recipe.chorus.toUpperCase(),w-128);if(rows.length*size*.94<=645&&rows.every(row=>c.measureText(row).width<=w-128))break;size-=2;}while(size>48);
  const top=880-rows.length*size*.94;c.fillStyle=ink;rows.forEach((row,i)=>c.fillText(row,64,top+size*.85+i*size*.94));
  c.font='600 32px C2Hoves, Arial';c.fillText(cover.artist||'LinkedIn Beats',68,973);
  if(spectrum){
    const bins=62,gap=5,bw=(w-136-gap*(bins-1))/bins;
    for(let i=0;i<bins;i++){const energy=spectrum[Math.floor(i*spectrum.length*.7/bins)]||0;const bh=3+Math.min(31,energy*.13);c.fillStyle=i/bins<elapsed/LENGTH?accent:ink;c.globalAlpha=.8;c.fillRect(68+i*(bw+gap),1030-bh/2,bw,bh);}c.globalAlpha=1;
  }
  if(elapsed>8.5){c.fillStyle=base;c.fillRect(58,938,w-116,63);c.fillStyle=ink;c.font='600 32px C2Hoves, Arial';c.fillText('linkedinbeats.com',68,978);}
}
// Start inside the original user tap so audio can unlock before any await.
export function startShareClip({recipe,cover}){
  const job={controller:new AbortController(),progress:0,listeners:new Set()};
  job.promise=createShareClip({recipe,cover,signal:job.controller.signal,quiet:true,onProgress:p=>{job.progress=p;job.listeners.forEach(fn=>fn(p));}});
  job.promise.catch(()=>{});return job;
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
export async function createShareClip({recipe,cover,signal,onProgress=()=>{},quiet=false}){
  const existing=cachedClip(recipe,cover);if(existing)return existing;
  const player=createPostBeat();player.unlock();if(quiet)player.monitor(false); // keep mobile unlock in the tap
  let capture,raf,stopped=false;
  try{
    const image=null;
    const [buffers]=await Promise.all([player.prepare(recipe,signal),document.fonts.load('60px Anton'),document.fonts.load('24px C2Hoves')]);
    if(signal?.aborted)throw aborted();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1080;
    drawShareArtwork(canvas,image,recipe,0,null,cover);
    if(await supportsOfflineClip(player.sampleRate())){
      const sampleRate=player.sampleRate();player.dispose();onProgress(.04);
      const context=new OfflineAudioContext(2,Math.round(LENGTH*sampleRate),sampleRate);
      const offline=createPostBeat({engineFactory:()=>createAudioEngine({context})});
      let audio;
      try{offline.schedule(recipe,buffers,{offset:5,duration:LENGTH});audio=await context.startRendering();}finally{offline.dispose();}
      if(signal?.aborted)throw aborted();
      // Smooth ending without tying automation to a live browser clock.
      for(let c=0;c<audio.numberOfChannels;c++){const pcm=audio.getChannelData(c);for(let i=Math.floor((LENGTH-.5)*sampleRate);i<pcm.length;i++)pcm[i]*=(pcm.length-i)/(.5*sampleRate);}
      onProgress(.12);
      const blob=await encodeOfflineClip({canvas,audio,signal,onProgress,draw:(time,wave)=>drawShareArtwork(canvas,image,recipe,time,wave,cover)});
      const file=new File([blob],`linkedin-beats-${cover.id}.mp4`,{type:'video/mp4'});
      if(cache.size>=3)cache.delete(cache.keys().next().value);cache.set(clipKey(recipe,cover),file);return file;
    }
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
        const t=Math.max(0,player.elapsed()-5);if(t>9.5)player.volume(.75*Math.max(0,(LENGTH-t)/.5));drawShareArtwork(canvas,image,recipe,t,player.spectrum(),cover);onProgress(Math.min(1,t/LENGTH));
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
