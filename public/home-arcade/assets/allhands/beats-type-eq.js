const panel=document.querySelector('#c2-player');
const audio=document.querySelector('#radioAudio');
const svg=panel?.querySelector('.beats-eq');
if(svg && audio){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const dots=[...svg.querySelectorAll('circle')].map(el=>({el,x:+el.getAttribute('cx'),y:+el.getAttribute('cy')}));
 const width=svg.viewBox.baseVal.width,height=svg.viewBox.baseVal.height;
 const columns=new Float32Array(Math.ceil(width)+1);
 let context,analyser,bins,source,raf=0,visible=false,intro=0,last=0;
 const solid=()=>dots.forEach(({el})=>el.style.fill='#fffdf1');
 function setup(){
  if(!context){
   const AudioEngine=window.AudioContext||window.webkitAudioContext;
   if(!AudioEngine)return;
   context=new AudioEngine();analyser=context.createAnalyser();analyser.fftSize=256;analyser.smoothingTimeConstant=.7;
   bins=new Uint8Array(analyser.frequencyBinCount);
   source=context.createMediaElementSource(audio);source.connect(analyser);analyser.connect(context.destination);
  }
  context.resume().catch(()=>{});
 }
 function draw(now){
  raf=0;
  if(!visible||document.hidden||reduced.matches){solid();return}
  const playing=!audio.paused&&!audio.ended;
  const age=now-intro;
  if(!playing&&age>1700){solid();return}
  if(now-last<32){raf=requestAnimationFrame(draw);return}last=now;
  if(playing&&analyser)analyser.getByteFrequencyData(bins);
  for(let x=0;x<columns.length;x++){
   let level;
   if(playing&&bins){
    const bin=2+Math.floor(Math.pow(x/width,1.7)*70);
    level=Math.min(1,(bins[bin]+bins[bin+1])/(255*2)*1.35);
   }else{
    const rise=Math.min(1,age/280),settle=Math.max(0,(age-1050)/650);
    level=(.35+.55*(.5+.5*Math.sin(age*.008-x*.42)))*rise;
    level=level*(1-settle)+settle;
   }
   columns[x]+=(level-columns[x])*(level>columns[x]?.68:.24);
  }
  for(const dot of dots){
   const level=columns[Math.round(dot.x)],row=(height-dot.y)/height;
   const color=row<=level?(row>level-.10?'#9cbdff':'#fffdf1'):'#46546c';
   if(dot.el.style.fill!==color)dot.el.style.fill=color;
  }
  raf=requestAnimationFrame(draw);
 }
 function start(){if(!raf&&visible&&!document.hidden&&!reduced.matches)raf=requestAnimationFrame(draw);else if(reduced.matches)solid()}
 audio.addEventListener('play',()=>{setup();start()});
 audio.addEventListener('pause',()=>{intro=-2000;solid()});
 audio.addEventListener('ended',solid);
 document.addEventListener('visibilitychange',start);
 reduced.addEventListener('change',()=>{solid();start()});
 new IntersectionObserver(entries=>{
  const next=entries[0].isIntersecting;
  if(next&&!visible){intro=performance.now();columns.fill(0)}
  visible=next;start();
 },{threshold:.15}).observe(panel);
 solid();
}
