import { PEG5 } from '../pegboard/fonts/peg5.js';
// A self-contained 1080px receipt. No submitted text is included in exports.
const SANS = 'C2Hoves,Arial,sans-serif';
function linesWithin(ctx, text, width, limit) {
  const words = String(text).replace(/\s+/g, ' ').split(' ');
  const lines = []; let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > limit) {
    lines.length = limit;
    while (ctx.measureText(lines[limit - 1] + '…').width > width) lines[limit - 1] = lines[limit - 1].slice(0, -1);
    lines[limit - 1] += '…';
  }
  return lines;
}
function peg(ctx, text, x, y, pitch) {
  for (const ch of String(text).toUpperCase()) {
    const glyph = PEG5.glyphs[ch];
    if (!glyph) { x += PEG5.space * pitch; continue; }
    glyph.bits.forEach((row, j) => [...row].forEach((bit, i) => {
      if (bit !== '#') return;
      ctx.beginPath(); ctx.arc(x + i*pitch, y + j*pitch, pitch*.38, 0, Math.PI*2); ctx.fill();
    }));
    x += (glyph.w + PEG5.tracking) * pitch;
  }
}
export function drawRoastCard(canvas, { personaName, intensityName, score, lines }) {
  canvas.width = 1080; canvas.height = 1080;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas unavailable');
  c.fillStyle = '#192b38'; c.fillRect(0, 0, 1080, 1080);
  c.fillStyle = '#34505f';
  for(let x=8;x<1080;x+=12) for(let y=8;y<1080;y+=12){c.beginPath();c.arc(x,y,1.4,0,Math.PI*2);c.fill();}
  c.fillStyle = '#e9f0f3'; c.font = `600 27px ${SANS}`; c.fillText('linkedinbeats_', 60, 78);
  c.fillStyle = '#ff9b85'; peg(c, 'ROASTED', 63, 125, 16);
  c.beginPath();c.moveTo(80, 255);c.lineTo(1020,255);c.lineTo(1020,733);c.lineTo(995,758);c.lineTo(60,758);c.lineTo(60,275);c.closePath();c.fill();
  c.fillStyle = '#263538'; c.font = `600 23px ${SANS}`; c.fillText(personaName, 94, 308);
  c.font = `500 41px ${SANS}`;
  const lead = linesWithin(c, lines[0], 875, 5);
  lead.forEach((line, i) => c.fillText(line, 94, 380 + i*48));
  if(lines[1]) {
    c.font = `400 27px ${SANS}`;
    const nextY = 410 + lead.length*48;
    linesWithin(c, lines[1], 875, Math.max(1, Math.floor((727-nextY)/35))).forEach((line,i)=>c.fillText(line,94,nextY+i*35));
  }
  c.fillStyle = '#bfe4d7'; peg(c, String(score.index), 68, 813, 13);
  c.font = `400 24px ${SANS}`;c.fillText('/100', 225, 861);
  c.fillStyle = '#e9f0f3';c.font = `500 26px ${SANS}`;c.fillText('Thought Leadership Index', 350, 837);
  c.fillStyle = '#adc1d0';c.font = `400 20px ${SANS}`;c.fillText(`${score.rank} · ${intensityName}`,350,875);
  c.font = `400 18px ${SANS}`;c.fillText('A joke about writing. Career advancement not included.',60,947);
  c.fillStyle = '#ff9b85';c.font = `500 26px ${SANS}`;c.fillText('Take the heat → linkedinbeats.com/roast',60,1010);
}
export function downloadCanvas(canvas, name = 'roast-card.png') {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) { reject(new Error('Image export failed')); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); resolve();
  }, 'image/png'));
}
