export const LINKEDIN_HOME='https://www.linkedin.com/feed/';
export function canShareClip(file,nav=navigator){
  try{return !!file&&typeof nav.share==='function'&&!!nav.canShare?.({files:[file]});}catch{return false;}
}
export function downloadClip(file){
  const href=URL.createObjectURL(file),a=document.createElement('a');a.href=href;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);
}
export function openLinkedIn(){
  const tab=window.open(LINKEDIN_HOME,'_blank');
  if(tab)tab.opener=null;
  return !!tab;
}
// All activation-sensitive calls happen synchronously in the posting tap.
// The clip already exists; no rendering or fetch is allowed in this function.
export function beginClipHandoff({file,caption,onUpdate,nav=navigator,download=downloadClip,open=openLinkedIn}){
  const native=canShareClip(file,nav);
  const state={kind:native?'native':'desktop',caption:'pending',download:false,opened:false,sharing:native};
  onUpdate({...state});
  let copy;
  try{copy=Promise.resolve(nav.clipboard.writeText(caption));}catch{copy=Promise.reject(new Error('Clipboard unavailable'));}
  const copied=copy.then(()=>{state.caption='copied';onUpdate({...state});},()=>{state.caption='failed';onUpdate({...state});});
  if(native){
    let shared;
    try{shared=Promise.resolve(nav.share({files:[file]}));}catch(error){shared=Promise.reject(error);}
    return Promise.all([copied,shared.then(()=>{state.sharing=false;onUpdate({...state});},error=>{state.sharing=false;state.cancelled=error.name==='AbortError';state.error=state.cancelled?'': 'The file could not be shared. Save the clip or post the link instead.';onUpdate({...state});})]);
  }
  try{state.opened=open();}catch{state.opened=false;}
  try{download(file);state.download=true;}catch{state.error='The download did not start. Use Save the clip to try again.';}
  onUpdate({...state});return copied;
}
