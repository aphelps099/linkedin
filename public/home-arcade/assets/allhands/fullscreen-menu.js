import {g as peg9,e as normalize,J as layout} from './stage-CDrfDtUj.js';
const menu=document.querySelector('#departmentMenu'),trigger=document.querySelector('#menuToggle');
const title=document.querySelector('#menuPegTitle'),stage=document.querySelector('.menu-stage');
const choices={
 game:{lines:['CAREER','MODE.'],color:'#ffe14a',copy:'Climb the office. Catch the language. Post your way up.'},
 beats:{lines:['MAKE','BEATS.'],color:'#4776ff',copy:'Turn office noise into a very good beat.'},
 optimize:{lines:['SMALL NEWS.','BIG DEAL.'],color:'#557dff',copy:'Give your perfectly ordinary day an extraordinary announcement.'},
 roast:{lines:['FEEL','THE BURN.'],color:'#fa8758',copy:'A performance review for your personal brand.'},
 learn:{lines:['LOOK','QUALIFIED.'],color:'#e7d461',copy:'Professional development. Questionable credentials.'},
 meetings:{lines:['LET’S','ALIGN.'],color:'#57d9c7',copy:'This meeting could have been a musical.'},
 archives:{lines:['FOR THE','RECORD.'],color:'#d3a2ed',copy:'Films, shorts, and other evidence of productivity.'}
};
const defaultChoice=Object.hasOwn(choices,menu.dataset.menuDefault)?menu.dataset.menuDefault:'beats';
let active='';
function showChoice(key){
 if(active===key)return;active=key;const choice=choices[key];
 menu.querySelectorAll('[data-menu-view]').forEach(link=>link.classList.toggle('is-current',link.dataset.menuView===key));
 stage.dataset.view=key;menu.style.setProperty('--menu-accent',choice.color);stage.style.setProperty('--menu-accent',choice.color);
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 const lines=matchMedia('(max-width:700px)').matches?choice.lines:[choice.lines.join(' ')];
 const rows=lines.map(text=>layout(text,{font:normalize(peg9),k:1,maxCols:240,maxLines:1}));
 const width=Math.max(...rows.map(row=>row.width));let height=0;
 rows.forEach(row=>{for(const line of row.pages[0].lines)for(const glyph of line.chars)for(let i=0;i<glyph.pegs.length;i+=2){const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',glyph.pegs[i]+.5);dot.setAttribute('cy',glyph.pegs[i+1]+height+.5);dot.setAttribute('r','.31');dot.style.setProperty('--peg-x',glyph.pegs[i]);svg.append(dot)}height+=row.height+4});
 svg.setAttribute('viewBox',`0 0 ${width+1} ${height-3}`);svg.setAttribute('preserveAspectRatio','xMinYMid meet');svg.setAttribute('aria-hidden','true');title.replaceChildren(svg);title.setAttribute('aria-label',choice.lines.join(' '));
}
const meter=document.querySelector('.menu-meter');for(let i=0;i<27;i++){const bar=document.createElement('i');bar.style.setProperty('--bar-height',`${18+((i*17+13)%47)}px`);bar.style.setProperty('--bar-delay',`${-i*.17}s`);meter.append(bar)}
menu.querySelectorAll('[data-menu-view]').forEach(link=>{link.addEventListener('pointerenter',()=>showChoice(link.dataset.menuView));link.addEventListener('focus',()=>showChoice(link.dataset.menuView));});
// A native modal keeps keyboard focus inside and makes the page behind it inert.
document.body.append(menu);
// Anchor the overlay to the exact header geometry that opened it.
function alignMenuHeader(){
 const header=trigger.closest('header'),logo=header?.querySelector('a img');
 if(!header||!logo)return;
 const mark=logo.getBoundingClientRect(),button=trigger.getBoundingClientRect(),box=header.getBoundingClientRect();
 const font=getComputedStyle(trigger);
 const values={
  'header-height':`${Math.max(64,box.bottom,button.bottom)}px`,
  'logo-x':`${mark.left}px`,'logo-y':`${Math.max(0,mark.top)}px`,
  'logo-width':`${mark.width}px`,'logo-height':`${mark.height}px`,
  'control-right':`${innerWidth-button.right}px`,'control-y':`${Math.max(0,button.top)}px`,
  'control-height':`${button.height}px`,'control-font-size':font.fontSize,
  'control-line-height':font.lineHeight,'control-font-family':font.fontFamily,
  'control-font-weight':font.fontWeight,'control-letter-spacing':font.letterSpacing
 };
 Object.entries(values).forEach(([key,value])=>menu.style.setProperty(`--anchor-${key}`,value));
 menu.classList.add('menu-header-anchored');
}
function closeMenu(){menu.close()}
trigger.addEventListener('click',()=>{alignMenuHeader();showChoice(defaultChoice);menu.showModal();document.body.classList.add('menu-is-open');trigger.setAttribute('aria-expanded','true');document.querySelector('#closeFullMenu').focus()});
document.querySelector('#closeFullMenu').addEventListener('click',closeMenu);
menu.addEventListener('close',()=>{document.body.classList.remove('menu-is-open');trigger.setAttribute('aria-expanded','false');trigger.focus()});
menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
showChoice(defaultChoice);

// A shared-field ripple: expanding rings dissolve through six opacity steps.
const hoverCanvas=document.createElement('canvas');hoverCanvas.className='menu-hover-field';hoverCanvas.setAttribute('aria-hidden','true');menu.prepend(hoverCanvas);
const brush=hoverCanvas.getContext('2d'),quiet=matchMedia('(prefers-reduced-motion: reduce)');
let hoverFrame=0,lastHoverPaint=0,bursts=[],lastPointer={x:0,y:0,time:0};
function sizeHover(){const dpr=Math.min(devicePixelRatio||1,2);hoverCanvas.width=Math.round(innerWidth*dpr);hoverCanvas.height=Math.round(innerHeight*dpr);brush.setTransform(dpr,0,0,dpr,0,0)}
function lightChoice(link,event){
 if(!menu.open)return;
 const r=link.getBoundingClientRect(),now=performance.now();
 const x=event?.clientX??r.left+r.width/2,y=event?.clientY??r.top+r.height/2;
 lastPointer={x,y,time:now};
 bursts.push({x,y,start:now,color:choices[link.dataset.menuView].color,reach:Math.min(350,innerWidth*.48)});
 bursts=bursts.slice(-4);if(!hoverFrame)hoverFrame=requestAnimationFrame(paintHover);
}
function paintHover(now){
 hoverFrame=0;if(!menu.open)return;
 if(now-lastHoverPaint<32){hoverFrame=requestAnimationFrame(paintHover);return}lastHoverPaint=now;
 brush.clearRect(0,0,innerWidth,innerHeight);
 bursts=bursts.filter(b=>quiet.matches||now-b.start<1700);
 const visible=quiet.matches?bursts.slice(-1):bursts;
 for(const b of visible){
  const t=quiet.matches?.35:Math.min(1,(now-b.start)/1700),radius=18+b.reach*t,spread=38+65*t,fade=Math.pow(1-t,1.15);
  const bound=quiet.matches?80:Math.min(b.reach+100,radius+spread*2);
  for(let y=Math.max(4,Math.floor((b.y-bound)/8)*8+4);y<Math.min(innerHeight,b.y+bound);y+=8)for(let x=Math.max(4,Math.floor((b.x-bound)/8)*8+4);x<Math.min(innerWidth,b.x+bound);x+=8){
   const distance=Math.hypot(x-b.x,y-b.y),seed=((x*13+y*7)%59)/59;
   const ring=Math.exp(-Math.pow((distance-radius)/spread,2)),echo=.32*Math.exp(-Math.pow((distance-radius+75)/(spread*.65),2));
   const light=quiet.matches?Math.max(0,1-distance/80)*.5:Math.min(1,(ring+echo)*fade*(.8+seed*.35));
   const alpha=Math.floor(light*6)/6;if(alpha<=0)continue;
   brush.globalAlpha=alpha;brush.fillStyle=b.color;brush.beginPath();brush.arc(x,y,1.85,0,Math.PI*2);brush.fill();
   if(alpha>.65&&seed>.88){brush.globalAlpha=alpha*.45;brush.fillStyle='#e4f1ff';brush.beginPath();brush.arc(x,y,1.5,0,Math.PI*2);brush.fill()}
  }
 }
 brush.globalAlpha=1;if(bursts.length&&!quiet.matches)hoverFrame=requestAnimationFrame(paintHover);
}
menu.querySelectorAll('[data-menu-view]').forEach(link=>{
 link.addEventListener('pointerenter',event=>lightChoice(link,event));
 link.addEventListener('focus',()=>lightChoice(link));
 link.addEventListener('pointermove',event=>{if(!quiet.matches&&performance.now()-lastPointer.time>450&&Math.hypot(event.clientX-lastPointer.x,event.clientY-lastPointer.y)>40)lightChoice(link,event)});
});
trigger.addEventListener('click',()=>{sizeHover();lightChoice(menu.querySelector('.dept-item.is-current'))});
menu.addEventListener('close',()=>{cancelAnimationFrame(hoverFrame);hoverFrame=0;bursts=[];brush.clearRect(0,0,innerWidth,innerHeight)});
window.addEventListener('resize',()=>{if(menu.open)alignMenuHeader();const key=active;active='';showChoice(key);sizeHover();bursts=[];brush.clearRect(0,0,innerWidth,innerHeight)});
menu.addEventListener('scroll',()=>{bursts=[];brush.clearRect(0,0,innerWidth,innerHeight)},{passive:true});

// A single short glint on entry. No looping flashes or movement of the controls.
const hoverInks={game:'#ffe14a',beats:'#91acff',optimize:'#91acff',roast:'#ffad85',learn:'#f2df82',meetings:'#82e7d4',archives:'#dfbbf4'};
const glintTimers=new Map();let openingTimer=0;
function sparkle(link){
 if(quiet.matches)return;
 clearTimeout(glintTimers.get(link));link.classList.remove('is-sparkling');link.querySelectorAll('.menu-glint').forEach(e=>e.remove());
 const box=link.getBoundingClientRect(),icon=link.querySelector('.icon').getBoundingClientRect(),label=link.querySelector('strong').getBoundingClientRect();
 const points=[[icon.right-2,icon.top+3],[icon.left+4,icon.bottom-3],[label.left+label.width*.3,label.top-4],[label.right+5,label.bottom-3]];
 points.forEach(([x,y],i)=>{const dot=document.createElement('i');dot.className='menu-glint';dot.setAttribute('aria-hidden','true');dot.style.left=`${x-box.left}px`;dot.style.top=`${y-box.top}px`;dot.style.setProperty('--glint-delay',`${i*45}ms`);link.append(dot)});
 link.classList.add('is-sparkling');glintTimers.set(link,setTimeout(()=>{link.classList.remove('is-sparkling');link.querySelectorAll('.menu-glint').forEach(e=>e.remove());glintTimers.delete(link)},620));
}
menu.querySelectorAll('[data-menu-view]').forEach((link,i)=>{link.style.setProperty('--hover-ink',hoverInks[link.dataset.menuView]);link.style.setProperty('--entry-delay',`${i*18}ms`);link.addEventListener('pointerenter',()=>sparkle(link));link.addEventListener('focus',()=>sparkle(link));link.addEventListener('pointerleave',()=>{if(document.activeElement!==link){clearTimeout(glintTimers.get(link));glintTimers.delete(link);link.classList.remove('is-sparkling');link.querySelectorAll('.menu-glint').forEach(e=>e.remove())}})});
trigger.addEventListener('click',()=>{clearTimeout(openingTimer);if(!quiet.matches){menu.classList.add('is-opening');openingTimer=setTimeout(()=>menu.classList.remove('is-opening'),420)}});
menu.addEventListener('close',()=>{clearTimeout(openingTimer);menu.classList.remove('is-opening');for(const timer of glintTimers.values())clearTimeout(timer);glintTimers.clear();menu.querySelectorAll('.is-sparkling').forEach(e=>e.classList.remove('is-sparkling'));menu.querySelectorAll('.menu-glint').forEach(e=>e.remove())});
