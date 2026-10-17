export const FACE_WIDTH=960, FACE_HEIGHT=540;
export const FACE_POSES={
  drums:{mouth:[439,228,86,55],eyes:[415,139,122,40],offsets:[[0,0],[-1,-2],[0,-1],[-1,-1],[0,0]],blinkOffset:1.1},
  keys:{mouth:[389,270,119,63],eyes:[361,172,177,42],offsets:[[0,0],[0,0],[0,-1],[0,0],[0,0]],blinkOffset:3.6},
};

// Four deliberately stepped poses. Silence always resolves to closed lips.
export function mouthPose(level) {
  if(level<.09)return 0;
  if(level<.30)return 1;
  if(level<.62)return 2;
  return 3;
}
export function blinkAmount(seconds,offset=0) {
  const cycle=(seconds+offset)%7.3;
  if(cycle<4.7||cycle>4.88)return 0;
  return cycle<4.75?(cycle-4.7)/.05:cycle<4.82?1:(4.88-cycle)/.06;
}

// Only mouth and eyelid patches change; the rest of the photograph is immutable.
export function createPortraitRenderer(canvas,atlas,id,createCanvas) {
  const config=FACE_POSES[id],ctx=canvas.getContext('2d');
  if(!config||!ctx)return null;
  canvas.width=FACE_WIDTH;canvas.height=FACE_HEIGHT;
  const patchCanvas=createCanvas(210,90),patch=patchCanvas.getContext('2d');
  function overlay(frame,rect,alpha=1) {
    const [x,y,w,h]=rect,[dx,dy]=config.offsets[frame];
    patch.clearRect(0,0,210,90);
    patch.globalCompositeOperation='source-over';
    patch.drawImage(atlas,frame*FACE_WIDTH+x+dx,y+dy,w,h,0,0,w,h);
    patch.globalCompositeOperation='destination-in';
    patch.save();patch.translate(w/2,h/2);patch.scale(w/2,h/2);
    const edge=patch.createRadialGradient(0,0,0,0,0,1);
    edge.addColorStop(0,'#fff');edge.addColorStop(.70,'#fff');edge.addColorStop(1,'#fff0');
    patch.fillStyle=edge;patch.fillRect(-1,-1,2,2);patch.restore();
    ctx.globalAlpha=alpha;ctx.drawImage(patchCanvas,0,0,w,h,x,y,w,h);ctx.globalAlpha=1;
  }
  let previous='';
  return (pose=0,blink=0)=>{
    const key=`${pose}:${Math.round(blink*4)}`;
    if(key===previous)return;previous=key;
    ctx.drawImage(atlas,0,0,FACE_WIDTH,FACE_HEIGHT,0,0,FACE_WIDTH,FACE_HEIGHT);
    if(pose)overlay(pose,config.mouth);
    if(blink)overlay(4,config.eyes,blink);
  };
}
