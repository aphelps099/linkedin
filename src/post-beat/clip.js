import {createPostBeat,makeTimedCues} from './audio.js';
import {createAudioEngine} from '../audio.js';
import {supportsOfflineClip,encodeOfflineClip} from './encode.js';
import {SLEEVE_THEMES} from './share.js';
import {VIDEO_MIMES,pickMime,extFor,mp4Support,startMp4Capture} from '../exporter.js';

const LENGTH=10,cache=new Map();
export const clipKey=(recipe,cover)=>JSON.stringify(['release-v5',recipe,cover.id,cover.artist||'']);
export const cachedClip=(recipe,cover)=>cache.get(clipKey(recipe,cover));
const aborted=()=>new DOMException('Cancelled','AbortError');

function lines(ctx,text,width){
  const result=[];let row='';
  for(const word of text.split(/\s+/)){const next=row?`${row} ${word}`:word;if(row&&ctx.measureText(next).width>width){result.push(row);row=word;}else row=next;}
  if(row)result.push(row);return result;
}
// One vocal phrase at a time, with timing derived from the same voice buffers
// used in the export. The waveform comes from the rendered audio, not a loop.
export function drawShareArtwork(canvas,_image,recipe,elapsed=0,spectrum=null,cover={},cues=[]){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const [base,stripe,ink,accent]=SLEEVE_THEMES[cover.id]||SLEEVE_THEMES['paper-jam'];
  c.fillStyle=base;c.fillRect(0,0,w,h);
  c.strokeStyle=stripe;c.lineWidth=1;
  if(cover.id==='hr-paper-storm'){
    for(let x=0;x<w;x+=48){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
    for(let y=0;y<h;y+=48){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  }else{
    c.save();c.beginPath();c.rect(0,740,w,340);c.clip();c.translate(w/2,h/2);c.rotate(-Math.PI/4);c.fillStyle=stripe;for(let x=-w*2;x<w*2;x+=95)c.fillRect(x,-h*2,38,h*4);c.restore();
  }
  c.fillStyle=accent;c.font='600 23px C2Hoves, Arial';c.fillText('LINKEDIN BEATS / STUDIO RELEASE',64,86);
  const time=elapsed+5,active=cues.find(cue=>time>=cue.start&&time<cue.end),phrase=active?.text||recipe.chorus;
  let size=152,rows;
  do{c.font=`600 ${size}px C2Hoves, Arial`;rows=lines(c,phrase,w-136);if(rows.length*size*1.04<=520&&rows.every(row=>c.measureText(row).width<=w-136))break;size-=2;}while(size>40);
  const top=210+(520-rows.length*size*1.04)/2;let wordIndex=0;
  rows.forEach((row,i)=>{let x=64;const y=top+size*.85+i*size*1.04;
    for(const word of row.split(/\s+/)){
      const width=c.measureText(word).width,timing=active?.words[wordIndex++];
      const sung=timing&&time>=timing.start&&time<timing.end;
      if(sung){c.fillStyle=accent;c.fillRect(x-6,y-size*.8,width+12,size*1.02);}
      c.fillStyle=sung?base:ink;c.fillText(word,x,y);x+=width+c.measureText(' ').width;
    }
  });
  const bins=56,gap=7,bw=(w-128-gap*(bins-1))/bins;
  for(let i=0;i<bins;i++){const energy=spectrum?.[Math.floor(i*spectrum.length*.7/bins)]||0,bh=5+Math.min(90,energy*.5);c.fillStyle=accent;c.globalAlpha=.9;c.fillRect(64+i*(bw+gap),838-bh/2,bw,bh);}c.globalAlpha=1;
  c.fillStyle=ink;c.font='600 27px C2Hoves, Arial';c.fillText(cover.artist||'LinkedIn Beats',64,950);
  c.font='22px C2Hoves, Arial';c.fillText('linkedinbeats.com',64,1004);
  c.textAlign='right';c.fillStyle=accent;c.fillText(`${String(Math.min(10,Math.floor(elapsed))).padStart(2,'0')} / 10`,w-64,1004);c.textAlign='left';
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
    const [buffers]=await Promise.all([player.prepare(recipe,signal),document.fonts.load('600 152px C2Hoves'),document.fonts.load('24px C2Hoves')]);
    if(signal?.aborted)throw aborted();
    const cues=makeTimedCues(recipe,buffers);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1080;
    drawShareArtwork(canvas,image,recipe,0,null,cover,cues);
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
      const blob=await encodeOfflineClip({canvas,audio,signal,onProgress,draw:(time,wave)=>drawShareArtwork(canvas,image,recipe,time,wave,cover,cues)});
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
        const t=Math.max(0,player.elapsed()-5);if(t>9.5)player.volume(.75*Math.max(0,(LENGTH-t)/.5));drawShareArtwork(canvas,image,recipe,t,player.spectrum(),cover,cues);onProgress(Math.min(1,t/LENGTH));
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
