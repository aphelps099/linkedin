// The ASCII horizon — the beat machine as character weather.
// Columns are sequencer steps, rows drift around a vanishing line, density
// comes off the spectrum analyser. Rows are painted as whole strings, so a
// full field costs a few dozen draws rather than a few thousand.
import { CBAudio } from './audio.js';

const RAMP = ' ·░▒▓█';
const MONO = '"IBM Plex Mono", Menlo, Consolas, monospace';

export function drawAsciiField(ctx, st, now, opts){
  const o = opts || {};
  const W = o.width, H = o.height;
  const alpha = o.alpha === undefined ? .16 : o.alpha;
  const cell = o.cell || 19;                 // character cell width in px
  const cols = Math.max(8, Math.ceil(W/cell));
  const rows = Math.max(6, Math.ceil(H/(cell*1.85)));
  const cw = W/cols, ch = H/rows;
  const spec = CBAudio.spectrum();
  const pattern = st.pattern || [];
  const steps = (pattern[0] && pattern[0].length) || 16;
  const drums = Math.max(0, pattern.length - 1);
  const t = now/1000;

  // per-column energy: the step's hits plus what the mix is doing up there
  const colE = new Array(cols);
  for(let c=0;c<cols;c++){
    const step = Math.floor(c/cols*steps);
    let hit = 0;
    for(let r=0;r<drums;r++) hit = Math.max(hit, pattern[r] ? pattern[r][step] : 0);
    let e = 0;
    if(spec){ const bin = Math.floor(c/cols * spec.length*.72); e = (spec[bin]||0)/255; }
    colE[c] = e*.62 + (hit === 2 ? .34 : hit ? .2 : 0) + (step === st.pos ? .42 : 0);
  }

  ctx.save();
  ctx.font = `${Math.round(ch*.94)}px ${MONO}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for(let r=0;r<rows;r++){
    const d = Math.abs(r/Math.max(1,rows-1) - .5) * 2;
    const horizon = Math.pow(1 - d, 1.7);          // dense at the vanishing line
    const drift = .5 + .5*Math.sin(t*.55 + r*.42);
    let line = '', rowSum = 0;
    for(let c=0;c<cols;c++){
      const v = Math.max(0, Math.min(1, colE[c]*(.45 + horizon*.85) + horizon*.34*drift));
      rowSum += v;
      line += RAMP[Math.min(RAMP.length-1, Math.floor(v*(RAMP.length-1) + .12))];
    }
    const rowA = alpha * (.42 + (rowSum/cols)*1.15);
    ctx.fillStyle = `rgba(255,255,255,${Math.min(.9, rowA).toFixed(3)})`;
    ctx.fillText(line, 0, r*ch + ch/2);
  }
  if(st.pos != null && steps && o.playhead !== false){
    const c = Math.floor(st.pos/steps*cols);
    ctx.fillStyle = `rgba(159,200,234,${Math.min(.5, alpha*2.4).toFixed(3)})`;
    ctx.fillRect(c*cw, 0, Math.max(cw, 3), H);
  }
  ctx.restore();
}

// The ramp that makes the room read: the field burns brightest behind the
// stage and falls away into flat corporate blue at the edges.
export function drawFocusRamp(ctx, {width, height, cx, cy, inner, outer, blue = '#0a66c2'}){
  const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  g.addColorStop(0, 'rgba(10,102,194,0)');
  g.addColorStop(.34, 'rgba(10,102,194,.28)');
  g.addColorStop(.68, 'rgba(10,102,194,.78)');
  g.addColorStop(1, blue);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
}
