import {Muxer,ArrayBufferTarget} from 'mp4-muxer';

const AVC='avc1.640028',AAC='mp4a.40.2',FPS=24;
export async function supportsOfflineClip(sampleRate){
  if(typeof OfflineAudioContext==='undefined'||typeof VideoEncoder==='undefined'||typeof AudioEncoder==='undefined'||typeof AudioData==='undefined')return false;
  try{
    const [v,a]=await Promise.all([
      VideoEncoder.isConfigSupported({codec:AVC,width:1080,height:1080,bitrate:4_000_000,framerate:FPS}),
      AudioEncoder.isConfigSupported({codec:AAC,sampleRate,numberOfChannels:2,bitrate:192_000}),
    ]);return !!(v.supported&&a.supported);
  }catch{return false;}
}
// Every frame/sample has an explicit media timestamp. Render speed, background
// scheduling and the wall clock cannot lengthen the resulting ten-second file.
export async function encodeOfflineClip({canvas,audio,draw,signal,onProgress}){
  const muxer=new Muxer({target:new ArrayBufferTarget(),video:{codec:'avc',width:1080,height:1080},audio:{codec:'aac',sampleRate:audio.sampleRate,numberOfChannels:2},fastStart:'in-memory',firstTimestampBehavior:'offset'});
  let failure;
  const check=()=>{if(signal?.aborted)throw new DOMException('Cancelled','AbortError');if(failure)throw failure;};
  const v=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:e=>{failure=e;}});
  const a=new AudioEncoder({output:(chunk,meta)=>muxer.addAudioChunk(chunk,meta),error:e=>{failure=e;}});
  try{
    v.configure({codec:AVC,width:1080,height:1080,bitrate:4_000_000,framerate:FPS});
    a.configure({codec:AAC,sampleRate:audio.sampleRate,numberOfChannels:2,bitrate:192_000});
    const channels=[audio.getChannelData(0),audio.getChannelData(1)];
    for(let start=0;start<audio.length;start+=1024){
      check();const count=Math.min(1024,audio.length-start),data=new Float32Array(count*2);
      for(let c=0;c<2;c++)data.set(channels[c].subarray(start,start+count),c*count);
      const block=new AudioData({format:'f32-planar',sampleRate:audio.sampleRate,numberOfFrames:count,numberOfChannels:2,timestamp:Math.round(start/audio.sampleRate*1e6),data});
      a.encode(block);block.close();if(a.encodeQueueSize>24)await a.flush();
    }
    await a.flush();check();
    const frames=Math.round(audio.duration*FPS),wave=new Uint8Array(128);
    for(let i=0;i<frames;i++){
      check();const time=i/FPS,sample=Math.floor(time*audio.sampleRate);
      for(let bin=0;bin<wave.length;bin++){
        let peak=0;for(let n=0;n<24;n++)peak=Math.max(peak,Math.abs(channels[0][Math.max(0,Math.min(audio.length-1,sample-1536+bin*24+n))]));
        wave[bin]=Math.min(255,peak*600);
      }
      // Motion covers seek to this exact timestamp before the frame is encoded.
      await draw(time,wave);
      const frame=new VideoFrame(canvas,{timestamp:Math.round(i/FPS*1e6),duration:Math.round((i+1)/FPS*1e6)-Math.round(i/FPS*1e6)});
      v.encode(frame,{keyFrame:i%(FPS*2)===0});frame.close();
      if(v.encodeQueueSize>=4)await v.flush();
      onProgress(.12+.86*(i+1)/frames);
    }
    await v.flush();check();muxer.finalize();onProgress(1);
    return new Blob([muxer.target.buffer],{type:'video/mp4'});
  }finally{if(v.state!=='closed')v.close();if(a.state!=='closed')a.close();}
}
