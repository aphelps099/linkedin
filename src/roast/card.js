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
export function drawRoastCard(canvas, { personaName, intensityName, score, lines }) {
  canvas.width = 1080; canvas.height = 1080;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Canvas unavailable');
  c.fillStyle = '#e5effb'; c.fillRect(0, 0, 1080, 1080);
  c.fillStyle = '#fffefa'; c.beginPath(); c.roundRect(48, 48, 984, 984, 30); c.fill();
  c.fillStyle = '#142b3d'; c.font = `600 27px ${SANS}`; c.fillText('linkedinbeats_', 88, 108);
  c.textAlign = 'right'; c.font = `400 19px ${SANS}`; c.fillText('FORM RM-01 / SATIRICAL REVIEW', 992, 108); c.textAlign = 'left';
  c.fillStyle = '#0757ec'; c.fillRect(48, 144, 984, 285);
  c.fillStyle = '#fff'; c.font = `600 148px ${SANS}`; c.fillText(String(score.index), 88, 325);
  c.font = `400 26px ${SANS}`; c.fillText('/ 100', 88, 377);
  c.font = `400 24px ${SANS}`; c.fillText('THOUGHT LEADERSHIP INDEX', 390, 220);
  c.font = `600 43px ${SANS}`;
  linesWithin(c, score.rank, 565, 2).forEach((line, i) => c.fillText(line, 390, 285 + i * 48));
  c.font = `400 22px ${SANS}`; c.fillText('Your professional presence is under review.', 390, 383);
  c.fillStyle = '#142b3d'; c.font = `600 36px ${SANS}`; c.fillText('The findings.', 88, 490);
  let y = 550;
  lines.slice(0, 2).forEach((text, i) => {
    c.fillStyle = '#0757ec'; c.font = `600 20px ${SANS}`; c.fillText(`0${i + 1}`, 88, y);
    c.fillStyle = '#142b3d'; c.font = `400 29px ${SANS}`;
    const wrapped = linesWithin(c, text, 824, 3);
    wrapped.forEach(line => { c.fillText(line, 145, y); y += 38; }); y += 26;
  });
  c.fillStyle = '#526b7e'; c.font = `600 24px ${SANS}`; c.fillText(personaName, 88, 876);
  c.font = `400 19px ${SANS}`; c.fillText(`Setting: ${intensityName} · A joke about writing, not a professional assessment.`, 88, 911);
  c.strokeStyle = '#cbd9e5'; c.beginPath(); c.moveTo(88, 943); c.lineTo(992, 943); c.stroke();
  c.fillStyle = '#0757ec'; c.font = `600 25px ${SANS}`; c.fillText('Get your verdict → linkedinbeats.com/roast', 88, 989);
}
export function downloadCanvas(canvas, name = 'roast-card.png') {
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (!blob) { reject(new Error('Image export failed')); return; }
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); resolve();
  }, 'image/png'));
}
