import {g as peg9,e as normalize,J as layout} from './stage-CDrfDtUj.js';
const NS='http://www.w3.org/2000/svg';
function svgNode(tag,attrs){const el=document.createElementNS(NS,tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el}
// Use the original PEG-9 glyph data, without substituting a similar display font.
const heading=document.querySelector('#test-beats-title');
if(heading){
 const shape=layout('BEATS',{font:normalize(peg9),k:1,maxCols:100,maxLines:1});
 const svg=svgNode('svg',{viewBox:`0 0 ${(shape.width+1)*2} ${(shape.height+1)*2}`,'aria-hidden':'true',class:'beats-peg9 beats-eq',focusable:'false'});
 for(const line of shape.pages[0].lines)for(const glyph of line.chars)for(let i=0;i<glyph.pegs.length;i+=2)for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)svg.append(svgNode('circle',{cx:glyph.pegs[i]*2+dx+1,cy:glyph.pegs[i+1]*2+dy+1,r:.29}));
 heading.replaceChildren(svg);heading.setAttribute('aria-label','BEATS');heading.dataset.typeface='PEG-9';
}
// The gallery heading uses the original PEG-9 glyphs on one compact line.
const galleryHeading=document.querySelector('#humbledTitle');
if(galleryHeading){
 const shape=layout('HUMBLED TO SHARE.',{font:normalize(peg9),k:1,maxCols:240,maxLines:1});
 const svg=svgNode('svg',{viewBox:`-.5 -.5 ${shape.width+1} ${shape.height+1}`,'aria-hidden':'true',focusable:'false'});
 for(const line of shape.pages[0].lines)for(const glyph of line.chars)for(let i=0;i<glyph.pegs.length;i+=2)svg.append(svgNode('circle',{cx:glyph.pegs[i]+.5,cy:glyph.pegs[i+1]+.5,r:.28,class:'lit-dot',style:`--delay:${glyph.pegs[i]*.004}s`}));
 galleryHeading.replaceChildren(svg);galleryHeading.dataset.typeface='PEG-9';
}
// Fit a single continuous row of pegs to each thumbnail; leave its content untouched.
const frames=new Map();
const resize=new ResizeObserver(entries=>{for(const {target} of entries){const width=Math.round(target.clientWidth),height=Math.round(target.clientHeight),record=frames.get(target);if(!record||!width||!height||record.key===`${width}:${height}`)continue;record.key=`${width}:${height}`;const svg=record.svg;svg.setAttribute('viewBox',`0 0 ${width} ${height}`);const points=[],inset=4,nx=Math.max(2,Math.round((width-2*inset)/9)),ny=Math.max(2,Math.round((height-2*inset)/9));for(let i=0;i<=nx;i++)points.push([inset+i*(width-2*inset)/nx,inset]);for(let i=1;i<=ny;i++)points.push([width-inset,inset+i*(height-2*inset)/ny]);for(let i=nx-1;i>=0;i--)points.push([inset+i*(width-2*inset)/nx,height-inset]);for(let i=ny-1;i>0;i--)points.push([inset,inset+i*(height-2*inset)/ny]);svg.replaceChildren(...points.map(([x,y],i)=>svgNode('circle',{cx:x,cy:y,r:2.65,class:'border-peg',style:`--spark-delay:${-((i*37)%180)/100}s`})))} });
for(const frame of document.querySelectorAll('#humbled .film-image')){const svg=svgNode('svg',{class:'film-dot-border','aria-hidden':'true',focusable:'false'});frame.append(svg);frames.set(frame,{svg,key:''});resize.observe(frame)}

for(const card of document.querySelectorAll('#humbled .film-card'))card.dataset.category=card.querySelector('.film-type').textContent.split('·')[0].trim().toLowerCase();

// A white stepped marquee follows the panel; PEG-9 lights on each scroll arrival.
const beatsPanel=document.querySelector('#c2-player');
if(beatsPanel){
  const edge=svgNode('svg',{class:'beats-marquee-edge','aria-hidden':'true',focusable:'false'});
  beatsPanel.append(edge);
  new ResizeObserver(()=>{
    const w=beatsPanel.clientWidth,h=beatsPanel.clientHeight,pitch=8;
    const panelRect=beatsPanel.getBoundingClientRect(),boardRect=beatsPanel.closest('.shared-peg-field').getBoundingClientRect();
    const phase=(value)=>(value%pitch+pitch)%pitch;
    const x=phase(boardRect.left-panelRect.left+3.4)+8,y=phase(boardRect.top-panelRect.top+3)+8;
    const nx=Math.floor((w-8-x)/pitch),ny=Math.floor((h-8-y)/pitch);
    edge.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const corners=[[3,0],[nx-3,0],[nx-3,1],[nx-2,1],[nx-2,2],[nx-1,2],[nx-1,3],[nx,3],[nx,ny-3],[nx-1,ny-3],[nx-1,ny-2],[nx-2,ny-2],[nx-2,ny-1],[nx-3,ny-1],[nx-3,ny],[3,ny],[3,ny-1],[2,ny-1],[2,ny-2],[1,ny-2],[1,ny-3],[0,ny-3],[0,3],[1,3],[1,2],[2,2],[2,1],[3,1],[3,0]];
    const points=new Map();
    for(let i=1;i<corners.length;i++){
      const [ax,ay]=corners[i-1],[bx,by]=corners[i],steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));
      for(let k=0;k<=steps;k++){const cx=ax+Math.sign(bx-ax)*k,cy=ay+Math.sign(by-ay)*k;points.set(`${cx}:${cy}`,[cx,cy])}
    }
    edge.replaceChildren(...[...points.values()].map(([cx,cy])=>svgNode('circle',{cx:x+cx*pitch,cy:y+cy*pitch,r:1.7,fill:'#fff'})));
  }).observe(beatsPanel);
  const pegs=beatsPanel.querySelectorAll('.beats-peg9 circle');
  pegs.forEach(peg=>peg.style.setProperty('--peg-on',`${140+Number(peg.getAttribute('cx'))*23+Number(peg.getAttribute('cy'))*12}ms`));
  beatsPanel.classList.add('beats-billboard-ready');
  const reveal=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.intersectionRatio>=.22)beatsPanel.classList.add('is-lit');else if(entry.intersectionRatio<=.02)beatsPanel.classList.remove('is-lit')}},{threshold:[0,.02,.22]});
  reveal.observe(beatsPanel);
}

// Load the equalizer after the PEG-9 SVG exists, including production module loading.
import('./beats-type-eq.js?v=1');
