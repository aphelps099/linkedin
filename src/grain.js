// Film grain. A single monochrome noise tile composited in 'overlay', so it
// adds texture without shifting the blue underneath it, jittered each frame so
// it moves like real grain instead of sitting there like a screen door.
let tile = null;
const patterns = new WeakMap();

function makeTile(size = 128){
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const img = x.createImageData(size, size);
  for(let i=0;i<img.data.length;i+=4){
    // gaussian-ish noise around mid grey: two rolls beat one for a softer grain
    const n = ((Math.random() + Math.random()) - 1) * 74;
    const v = Math.max(0, Math.min(255, 128 + n));
    img.data[i] = img.data[i+1] = img.data[i+2] = v;
    img.data[i+3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

export function drawGrain(ctx, w, h, alpha = .06){
  if(!tile) tile = makeTile();
  let p = patterns.get(ctx);
  if(!p){ p = ctx.createPattern(tile, 'repeat'); patterns.set(ctx, p); }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.translate(-Math.floor(Math.random()*128), -Math.floor(Math.random()*128));
  ctx.fillStyle = p;
  ctx.fillRect(0, 0, w + 128, h + 128);
  ctx.restore();
}
