export const PLAIN_POST='I made coffee.';
export const OPTIMIZED_POST='Humbled to share a small but meaningful milestone.\n\nToday, I transformed coffee beans into a catalyst for connection and growth.\n\nOne cup. Endless possibilities. #Grateful';
export const POST_DEMO_DURATION=18000;
export function postDemoFrame(elapsed){
  const time=elapsed%POST_DEMO_DURATION;
  if(time<3000)return {phase:'draft',text:PLAIN_POST.slice(0,Math.floor(time/85)),status:'The actual update',typing:time<PLAIN_POST.length*85};
  if(time<3900)return {phase:'optimizing',text:PLAIN_POST,status:'Adding professional significance…',typing:false};
  const text=OPTIMIZED_POST.slice(0,Math.floor((time-3900)/27));
  if(time<10400)return {phase:'writing',text,status:'Optimizing your announcement…',typing:text.length<OPTIMIZED_POST.length};
  return {phase:'approved',text:OPTIMIZED_POST,status:'Optimized. Approved. Slightly excessive.',typing:false};
}
