import {G,$,newRun} from './state.js';
import {DT} from './physics.js';
import {C} from './art.js';
import {pen,fit,begin,hud,tray,hideCard,drawParts,drawToast} from './ui.js';
import {enterFloor,stepWorld,drawWorld,recenter,floor} from './world.js';
import {enterPost,stepPost,postButton,drawPost} from './scenes.js';
import route from './preview-route.json';

document.documentElement.classList.add('game-demo');
G.demo=true;
let active=false, last=0, acc=0, elapsed=0, sceneAge=0, legIndex=0, phase='align', frame=0, waited=0, restartAt=0;
const keys=G.keys;
function start(){
  G.run=newRun();G.floor=0;G.mode='play';G.t=0;G.parts=[];G.toast=null;G.shake=0;G.fade=.8;
  hideCard();$('post').hidden=true;$('say').hidden=true;$('meet').hidden=true;
  enterFloor(0);hud();tray();
  elapsed=sceneAge=acc=legIndex=frame=waited=restartAt=0;phase='align';
}
G.go=(mode,data)=>{
  if(mode==='post'){G.mode='post';sceneAge=0;enterPost(data);}
  else if(mode==='play'){restartAt=elapsed+2;}
};
function steer(p,target){const dx=target-p.x,stop=p.vx*p.vx/3000;keys.left=dx<-(stop+.3);keys.right=dx>stop+.3;}
function pilot(){
  keys.left=keys.right=keys.jump=false;
  const F=floor(),p=F.p,L=route[legIndex];
  if(!L||restartAt)return;
  if(phase==='align'){
    if(!p.ground||p.stun>0||F.freeze)return;
    const target=L.cx*8+4;
    if(Math.round(p.y/8)!==L.cy||Math.abs(p.x-target)>14){restartAt=elapsed+1;return;}
    if(Math.abs(p.x-target)>.45||Math.abs(p.vx)>.5){steer(p,target);return;}
    const end=L.to.cx*8+4,lo=Math.min(p.x,end)-12,hi=Math.max(p.x,end)+12;
    if(L.to.cy===L.cy&&F.chairs.some(c=>Math.abs(c.y-p.y)<2&&c.x+9>lo&&c.x<hi)&&waited++<360)return;
    waited=0;phase='run';frame=0;
  }
  if(phase==='run'){
    const r=L.recipe,f=frame++,dir=f>=r.delay&&f<r.delay+r.run?r.d:0;
    keys.left=dir<0;keys.right=dir>0;keys.jump=f<r.hold;
    if(p.stun>0){restartAt=elapsed+1;return;}
    if(f>=Math.max(r.hold,r.delay+r.run)&&p.ground&&Math.abs(p.vx)<.5){
      if(Math.floor(p.x/8)!==L.to.cx||Math.round(p.y/8)!==L.to.cy){restartAt=elapsed+1;return;}
      legIndex++;phase='align';
    }else if(f>720)restartAt=elapsed+1;
  }
}
function render(dt=0){
  begin();let cam=null;
  if(G.mode==='post')drawPost();else cam=drawWorld();
  drawParts(dt,cam?.cx||0,cam?.cy||0);drawToast(dt);
  if(G.fade>0){pen.ctx.globalAlpha=Math.min(1,G.fade);pen.R(0,0,G.W,G.H,C.void);pen.ctx.globalAlpha=1;G.fade-=dt*3;}
}
function loop(now){
  requestAnimationFrame(loop);
  const dt=Math.min(.05,(now-last)/1000||0);last=now;
  if(!active||document.hidden)return;
  elapsed+=dt;sceneAge+=dt;G.t+=dt;
  if((restartAt&&elapsed>=restartAt)||elapsed>40){start();}
  if(G.mode==='play'){
    acc+=dt;
    while(acc>=DT&&G.mode==='play'){acc-=DT;pilot();stepWorld();}
  }else{
    acc=0;stepPost(dt);
    if(sceneAge>2&&$('pGo').textContent==='Skip')postButton();
    if(sceneAge>4&&$('pGo').textContent==='Post')postButton();
    if(sceneAge>9)restartAt=elapsed;
  }
  if(G.shake>0)G.shake-=dt;
  render(dt);
}
function refit(){fit();recenter();if(G.run)render();}
addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='synergy-preview-playback')return;
  active=event.data.playing===true;
});
fit();start();G.fade=0;render();
new ResizeObserver(refit).observe($('view'));
parent.postMessage({type:'synergy-preview-ready'},location.origin);
requestAnimationFrame(loop);
