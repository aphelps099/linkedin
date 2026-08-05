import { CBAudio } from './audio.js';

const endpoint = () => import.meta.env.VITE_VOICE_API_URL || '/api/voice';

function base64ToArrayBuffer(value){
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

const wait = ms => new Promise(resolve=>setTimeout(resolve, ms));

export async function requestRemixVoiceClip(clip, {signal, retries=1, timeout=15000}={}){
  let lastError;
  for(let attempt=0;attempt<=retries;attempt++){
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort('timeout'), timeout);
    const abort = ()=>controller.abort(signal?.reason || 'cancelled');
    if(signal) signal.addEventListener('abort', abort, {once:true});
    try{
      const response = await fetch(endpoint(), {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        // `lines` keeps the currently deployed v1 Worker speaking during the
        // v2 rollout. The v2 Worker prefers `clips` so it can honor voice roles.
        body: JSON.stringify({clips:[clip], lines:[clip.text]}),
        signal:controller.signal,
      });
      const payload = await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(payload.error || `Voice request failed (${response.status})`);
      if(!Array.isArray(payload.clips) || payload.clips.length !== 1){
        throw new Error('Voice contractor returned an incomplete filing');
      }
      const result = payload.clips[0];
      return {
        buffer:await CBAudio.decode(base64ToArrayBuffer(result.audio)),
        provider:payload.provider || 'openai',
        role:result.role || clip.role,
      };
    }catch(error){
      lastError = error;
      if(signal?.aborted || attempt >= retries) break;
      await wait(250 * (attempt + 1));
    }finally{
      clearTimeout(timer);
      if(signal) signal.removeEventListener('abort', abort);
    }
  }
  throw lastError || new Error('Voice request failed');
}

export async function requestRemixVoice(clips, options){
  const results = await Promise.all(clips.map(clip=>requestRemixVoiceClip(
    typeof clip === 'string' ? {text:clip, role:'robot'} : clip,
    options,
  )));
  return {
    buffers:results.map(result=>result.buffer),
    provider:results[0]?.provider || 'openai',
    roles:results.map(result=>result.role),
  };
}
