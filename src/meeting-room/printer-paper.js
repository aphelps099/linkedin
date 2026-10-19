// Real page artwork travels over a fixed photograph of the approved printer.
export const PRINT_CYCLE=3.6;
const lerp=(a,b,t)=>a+(b-a)*t;
const point=(a,b,t)=>a.map((value,i)=>lerp(value,b[i],t));
const smooth=t=>t*t*(3-2*t);
export const paperSource=[[491,489],[834,510],[713,601],[310,568]];
const curve=(points,t)=>points[0].map((_,i)=>(1-t)**3*points[0][i]+3*(1-t)**2*t*points[1][i]+3*(1-t)*t*t*points[2][i]+t**3*points[3][i]);
export function printerPhase(time){
  const elapsed=Math.max(0,time),completed=Math.floor(elapsed/PRINT_CYCLE),phase=elapsed%PRINT_CYCLE;
  return {completed,feed:Math.min(1,phase/2.7),settle:smooth(Math.max(0,Math.min(1,(phase-2.7)/.55)))};
}
export function paperRow(v,feed,settle,stackHeight=0){
  const distance=v-(1-feed);
  const left=curve([[515,409],[502,464],[435,537],[310,568-stackHeight]],distance);
  const right=curve([[865,421],[854,477],[806,572],[713,601-stackHeight]],distance);
  const landedLeft=point(paperSource[0],paperSource[3],v),landedRight=point(paperSource[1],paperSource[2],v);
  landedLeft[1]-=stackHeight;landedRight[1]-=stackHeight;
  return [point(left,landedLeft,settle),point(right,landedRight,settle)];
}
const sourceRow=v=>[point(paperSource[0],paperSource[3],v),point(paperSource[1],paperSource[2],v)];
function triangle(ctx,image,src,dst){
  const [s0,s1,s2]=src,[d0,d1,d2]=dst;
  const sx1=s1[0]-s0[0],sy1=s1[1]-s0[1],sx2=s2[0]-s0[0],sy2=s2[1]-s0[1];
  const dx1=d1[0]-d0[0],dy1=d1[1]-d0[1],dx2=d2[0]-d0[0],dy2=d2[1]-d0[1];
  const det=sx1*sy2-sx2*sy1;if(Math.abs(det)<.001)return;
  const a=(dx1*sy2-dx2*sy1)/det,c=(dx2*sx1-dx1*sx2)/det;
  const b=(dy1*sy2-dy2*sy1)/det,d=(dy2*sx1-dy1*sx2)/det;
  // Offset every edge, including the long thin strip edges, to cover canvas
  // antialiasing seams. Radial expansion leaves visible bands across the logo.
  const winding=Math.sign(dx1*dy2-dx2*dy1);
  const normals=dst.map((p,i)=>{const q=dst[(i+1)%3],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);return [winding*dy/length,-winding*dx/length];});
  const expanded=dst.map((p,i)=>{const a=normals[(i+2)%3],b=normals[i],scale=.65/Math.max(.02,1+a[0]*b[0]+a[1]*b[1]);return [p[0]+(a[0]+b[0])*scale,p[1]+(a[1]+b[1])*scale];});
  ctx.save();ctx.beginPath();ctx.moveTo(...expanded[0]);ctx.lineTo(...expanded[1]);ctx.lineTo(...expanded[2]);ctx.closePath();ctx.clip();
  ctx.transform(a,b,c,d,d0[0]-a*s0[0]-c*s0[1],d0[1]-b*s0[0]-d*s0[1]);
  ctx.drawImage(image,0,0,1280,720);ctx.restore();
}
function sheet(ctx,image,feed,settle,height){
  const start=1-feed,steps=32;
  const outline=[...paperRow(start,feed,settle,height),...paperRow(1,feed,settle,height).reverse()];
  ctx.save();ctx.beginPath();outline.forEach(([x,y],i)=>i?ctx.lineTo(x,y+4):ctx.moveTo(x,y+4));ctx.closePath();
  ctx.fillStyle='#19171620';ctx.shadowColor='#17131255';ctx.shadowBlur=9;ctx.fill();ctx.restore();
  const rows=Array.from({length:steps+1},(_,i)=>paperRow(lerp(start,1,i/steps),feed,settle,height));
  ctx.beginPath();[...rows.map(row=>row[0]),...rows.map(row=>row[1]).reverse()].forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle='#f4f3f8';ctx.fill();
  for(let i=0;i<steps;i++){
    const v0=lerp(start,1,i/steps),v1=lerp(start,1,(i+1)/steps);
    const s0=sourceRow(v0),s1=sourceRow(v1),d0=paperRow(v0,feed,settle,height),d1=paperRow(v1,feed,settle,height);
    triangle(ctx,image,[s0[0],s0[1],s1[0]],[d0[0],d0[1],d1[0]]);
    triangle(ctx,image,[s0[1],s1[1],s1[0]],[d0[1],d1[1],d1[0]]);
  }
}
export function drawPrinterPaper(ctx,image,time){
  ctx.clearRect(0,0,1280,720);
  const {completed,feed,settle}=printerPhase(time),height=Math.min(completed,30)*.65;
  if(completed){
    // The output stack persists between cycles; no disappearing or reversed pages.
    for(let i=0;i<Math.min(completed,30);i++){
      const y=i*.65;ctx.beginPath();ctx.moveTo(310,568-y);ctx.lineTo(713,601-y);ctx.lineTo(834,510-y);
      ctx.strokeStyle=i%2?'#a9aab9':'#eeedf4';ctx.lineWidth=.7;ctx.stroke();
    }
    sheet(ctx,image,1,1,height);
  }
  if(feed>.004)sheet(ctx,image,feed,settle,height+.65);
  const light=.22+.45*(.5+.5*Math.sin(time*8));
  ctx.save();ctx.fillStyle=`rgba(211,255,102,${light})`;ctx.shadowColor='#ddff8b';ctx.shadowBlur=7;ctx.fillRect(957,271,10,8);ctx.restore();
}
