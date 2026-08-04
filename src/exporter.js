// Clip export — two pipelines for the Distribution bay.
//
// Preferred: WebCodecs + mp4-muxer → a real H.264 + AAC .mp4 that LinkedIn,
// Twitter/X, QuickTime, and phones all accept. MediaRecorder's "mp4" is often
// VP9/Opus in an mp4 shell, which plays in Chrome and almost nowhere else.
//
// Fallback: MediaRecorder with the best mime the browser admits to supporting.
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export const VIDEO_MIMES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];
export const AUDIO_MIMES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
];

export function pickMime(candidates){
  if(typeof MediaRecorder === 'undefined') return undefined;
  return candidates.find(m => { try{ return MediaRecorder.isTypeSupported(m); }catch(e){ return false; } });
}

export function extFor(mime){
  if(!mime) return 'webm';
  if(mime.includes('mp4')) return mime.startsWith('audio') ? 'm4a' : 'mp4';
  if(mime.includes('ogg')) return 'ogg';
  return 'webm';
}

export function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  return url;
}

const AVC = 'avc1.640028'; // High@4.0 — comfortable for 1080×1080@30
const AAC = 'mp4a.40.2';

export async function mp4Support(sampleRate){
  if(typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined'
    || typeof MediaStreamTrackProcessor === 'undefined') return false;
  try{
    const v = await VideoEncoder.isConfigSupported({codec:AVC, width:1080, height:1080, bitrate:8_000_000, framerate:30});
    const a = await AudioEncoder.isConfigSupported({codec:AAC, sampleRate, numberOfChannels:2, bitrate:192_000});
    return !!(v.supported && a.supported);
  }catch(e){ return false; }
}

// Live capture of a canvas + an audio MediaStreamTrack into H.264/AAC mp4.
// Construct to start capturing; stop() returns the finished Blob.
export function startMp4Capture({canvas, audioTrack, sampleRate}){
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {codec:'avc', width:1080, height:1080},
    audio: {codec:'aac', sampleRate, numberOfChannels:2},
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => console.warn('mp4 video encode', e),
  });
  videoEncoder.configure({codec:AVC, width:1080, height:1080, bitrate:8_000_000, framerate:30});
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: e => console.warn('mp4 audio encode', e),
  });
  audioEncoder.configure({codec:AAC, sampleRate, numberOfChannels:2, bitrate:192_000});

  const videoTrack = canvas.captureStream(30).getVideoTracks()[0];
  const vReader = new MediaStreamTrackProcessor({track: videoTrack}).readable.getReader();
  const aReader = new MediaStreamTrackProcessor({track: audioTrack}).readable.getReader();
  let running = true, lastKey = -Infinity;

  (async ()=>{
    while(running){
      const {done, value: frame} = await vReader.read();
      if(done || !frame) break;
      if(videoEncoder.state === 'configured' && videoEncoder.encodeQueueSize < 4){
        const key = frame.timestamp - lastKey > 2_000_000; // keyframe every 2s
        if(key) lastKey = frame.timestamp;
        videoEncoder.encode(frame, {keyFrame: key});
      }
      frame.close();
    }
  })().catch(e=> console.warn('mp4 video capture', e));
  (async ()=>{
    while(running){
      const {done, value: data} = await aReader.read();
      if(done || !data) break;
      if(audioEncoder.state === 'configured') audioEncoder.encode(data);
      data.close();
    }
  })().catch(e=> console.warn('mp4 audio capture', e));

  return {
    async stop(discard){
      running = false;
      try{ await vReader.cancel(); }catch(e){}
      try{ await aReader.cancel(); }catch(e){}
      try{ videoTrack.stop(); }catch(e){}
      if(discard){
        try{ videoEncoder.close(); audioEncoder.close(); }catch(e){}
        return null;
      }
      try{ await videoEncoder.flush(); }catch(e){}
      try{ await audioEncoder.flush(); }catch(e){}
      muxer.finalize();
      return new Blob([muxer.target.buffer], {type:'video/mp4'});
    },
  };
}
