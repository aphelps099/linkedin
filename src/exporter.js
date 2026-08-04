// Clip export helpers — MediaRecorder plumbing for the Distribution bay.
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
