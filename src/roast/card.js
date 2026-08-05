// The roast card — a 1080×1080 share-ready verdict, drawn in the house
// canvas vocabulary. This is the artifact people post.

const BLUE = '#0a66c2', TINT = '#9fc8ea', WHITE = '#fff';
const SANS = '"Helvetica Neue",Helvetica,Arial,sans-serif';
const MONO = '"IBM Plex Mono",Menlo,Consolas,monospace';

function wrap(ctx, text, maxW){
  const words = text.split(' '); const lines = []; let cur = '';
  for(const w of words){
    const t = cur ? cur + ' ' + w : w;
    if(ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; }
    else cur = t;
  }
  if(cur) lines.push(cur);
  return lines;
}

export function drawRoastCard(canvas, { personaName, intensityName, score, lines }){
  const S = 1080;
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d');
  const M = 72;

  ctx.fillStyle = BLUE; ctx.fillRect(0, 0, S, S);

  // masthead
  ctx.fillStyle = WHITE; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 44px ${SANS}`; ctx.letterSpacing = '-1px';
  ctx.fillText('Roast My LinkedIn', M, 104);
  const lw = ctx.measureText('Roast My LinkedIn').width;
  ctx.font = `700 20px ${SANS}`; ctx.letterSpacing = '0px';
  ctx.fillText('™', M + lw + 5, 84);
  ctx.textAlign = 'right'; ctx.fillStyle = TINT;
  ctx.font = `500 19px ${MONO}`; ctx.letterSpacing = '1px';
  ctx.fillText('FORM RM-1 · OFFICIAL VERDICT', S - M, 100);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = WHITE; ctx.fillRect(M, 128, S - 2 * M, 5);

  // the score
  ctx.textAlign = 'left';
  ctx.font = `700 190px ${SANS}`; ctx.letterSpacing = '-9px';
  ctx.fillText(String(score.index), M - 6, 330);
  const nw = ctx.measureText(String(score.index)).width;
  ctx.letterSpacing = '0px';
  ctx.font = `700 34px ${SANS}`;
  ctx.fillText(score.rank, M + nw + 26, 268);
  ctx.fillStyle = TINT; ctx.font = `500 19px ${MONO}`; ctx.letterSpacing = '1.6px';
  ctx.fillText('THOUGHT LEADERSHIP INDEX · 0–100', M + nw + 26, 302);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(M, 366, S - 2 * M, 2);

  // the roast lines
  ctx.font = `400 33px ${SANS}`;
  let y = 434;
  for(const line of lines.slice(0, 4)){
    if(y > 800) break;
    ctx.fillStyle = TINT; ctx.font = `700 33px ${SANS}`;
    ctx.fillText('→', M, y);
    ctx.fillStyle = WHITE; ctx.font = `400 33px ${SANS}`;
    const wrapped = wrap(ctx, line.replace(/\n+/g, ' '), S - 2 * M - 54);
    for(const l of wrapped.slice(0, 3)){
      if(y > 820) break;
      ctx.fillText(l, M + 54, y);
      y += 44;
    }
    y += 20;
  }

  // attribution
  ctx.fillStyle = TINT; ctx.font = `700 26px ${SANS}`;
  ctx.fillText(`— ${personaName}`, M, Math.min(y + 16, 866));
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = `500 18px ${MONO}`; ctx.letterSpacing = '1.2px';
  ctx.fillText(`SETTING: ${intensityName.toUpperCase()}`, M, Math.min(y + 52, 900));
  ctx.letterSpacing = '0px';

  // stamp
  ctx.save();
  ctx.translate(S - M - 170, S - 150); ctx.rotate(-5 * Math.PI / 180);
  ctx.font = `700 24px ${SANS}`; ctx.letterSpacing = '4px'; ctx.textAlign = 'center';
  const sw = ctx.measureText('ROASTED — OFFICIAL').width + 36;
  ctx.strokeStyle = WHITE; ctx.lineWidth = 4; ctx.strokeRect(-sw / 2, -28, sw, 54);
  ctx.fillStyle = WHITE; ctx.fillText('ROASTED — OFFICIAL', 0, 8);
  ctx.restore();
  ctx.letterSpacing = '0px';

  // footer
  ctx.textAlign = 'left';
  ctx.fillStyle = WHITE; ctx.fillRect(M, S - 96, S - 2 * M, 3);
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = `500 19px ${MONO}`; ctx.letterSpacing = '1.4px';
  ctx.fillText('GET ROASTED · LINKEDINBEATS.COM/ROAST', M, S - 52);
  ctx.letterSpacing = '0px';
}

export function downloadCanvas(canvas, name = 'roast-card.png'){
  canvas.toBlob(blob => {
    if(!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}
