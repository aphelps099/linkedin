import { CBAudio } from './audio.js';

const endpoint = () => import.meta.env.VITE_VOICE_API_URL || '/api/voice';

function base64ToArrayBuffer(value){
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function requestRemixVoice(lines){
  const response = await fetch(endpoint(), {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({lines}),
  });
  const payload = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(payload.error || `Voice request failed (${response.status})`);
  if(!Array.isArray(payload.clips) || payload.clips.length !== lines.length){
    throw new Error('Voice contractor returned an incomplete filing');
  }
  const buffers = await Promise.all(payload.clips.map(clip=>
    CBAudio.decode(base64ToArrayBuffer(clip.audio))));
  return {buffers, provider:payload.provider || 'openai'};
}
