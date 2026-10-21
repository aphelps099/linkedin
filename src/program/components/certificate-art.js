// One vector source for the learner's certificate, PNG download and public share.
// Only the name is user supplied; escape it before including it in SVG or HTML.
export const escapeCertificateText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const certificateName = value => [...String(value || '').normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu,'').replace(/\s+/gu,' ').trim()].slice(0,60).join('') || 'Aspiring Thought Leader';
const fleur = (transform, color='#a18443') => `<g transform="${transform}" fill="${color}"><path d="M0-23C-8-14-8-7-3 2H3C8-7 8-14 0-23ZM-3 2C-5-13-20-15-20-5C-20 2-13 5-8 0C-10-5-14-4-14-1C-12-3-8-1-7 3ZM3 2C5-13 20-15 20-5C20 2 13 5 8 0C10-5 14-4 14-1C12-3 8-1 7 3Z"/><rect x="-9" y="3" width="18" height="3" rx="1"/><path d="M-4 7C-4 12-8 15-12 15C-7 19-2 15 0 12C2 15 7 19 12 15C8 15 4 12 4 7Z"/></g>`;
const rosette = Array.from({length:144}, (_,i) => {const a=i*Math.PI/72,r=i%2?108:114;return `${i?'L':'M'}${(Math.cos(a)*r).toFixed(2)} ${(Math.sin(a)*r).toFixed(2)}`;}).join(' ')+'Z';
const brand = (raw,x,y,width,height,color) => `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${raw.match(/viewBox="([^"]+)"/)[1]}" fill="${color}">${raw.replace(/<svg[^>]*>|<\/svg>|<title>.*?<\/title>/g,'').replace(/fill="#[a-f0-9]+"/gi,`fill="${color}"`)}</svg>`;

function border(){
  // All decoration stays in the 18–63px frame; content begins at x78/y76.
  // The same corner is reflected about both axes, including its scroll and fleur.
  return `<g aria-hidden="true"><g fill="none" stroke="#a18443"><rect x="18" y="18" width="1164" height="814" stroke-width="1.5"/><rect x="25" y="25" width="1150" height="800" stroke-width=".65" stroke-dasharray="1 3"/><path d="M73 36H550M650 36H1127M73 814H550M650 814H1127M36 73V777M1164 73V777" stroke-width=".8"/></g>
  ${['translate(36 36)','translate(1164 36) scale(-1 1)','translate(36 814) scale(1 -1)','translate(1164 814) scale(-1 -1)'].map(t=>`<g transform="${t}"><path d="M0 36V0H36M6 31V6H31M12 28C24 28 28 24 28 12" fill="none" stroke="#a18443" stroke-width=".85"/>${fleur('translate(16 16) rotate(-45) scale(.39)')}</g>`).join('')}
  <path d="M550 36C566 23 580 49 590 36M610 36C620 49 634 23 650 36M550 814C566 801 580 827 590 814M610 814C620 827 634 801 650 814" fill="none" stroke="#a18443" stroke-width=".8"/>
  ${fleur('translate(600 36) scale(.48)')}${fleur('translate(600 814) scale(.48)')}
  ${fleur('translate(36 425) rotate(-90) scale(.35)')}${fleur('translate(1164 425) rotate(90) scale(.35)')}</g>`;
}
// Position letters individually: SVG textPath is not supported by every PNG renderer.
function arcText(text,radius,start,end){
  return [...text].map((char,i)=>{const angle=start+(end-start)*i/(text.length-1),a=angle*Math.PI/180;return `<text transform="translate(${(Math.cos(a)*radius).toFixed(2)} ${(Math.sin(a)*radius).toFixed(2)}) rotate(${angle+(start<0?90:-90)})" text-anchor="middle">${char}</text>`;}).join('');
}
function seal(monogram,id){
  return `<g transform="translate(990 635)" aria-hidden="true"><defs><linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#a17831"/><stop offset=".26" stop-color="#f2dfaa"/><stop offset=".51" stop-color="#c7a15a"/><stop offset=".74" stop-color="#f8e8b8"/><stop offset="1" stop-color="#9b722e"/></linearGradient></defs>
  <path d="M-70 64L-84 140L-52 123L-25 143L-16 76M16 76L25 143L52 123L84 140L70 64" fill="#10182f" stroke="#b08b46" stroke-width="1.5"/><path d="M-62 80L-69 120M62 80L69 120" fill="none" stroke="#e4c782" stroke-width="2"/>
  <path d="${rosette}" fill="url(#${id}-gold)" stroke="#92703a"/><circle r="102" fill="none" stroke="#fff0c6" stroke-width="2"/><circle r="98" fill="none" stroke="#98733b" stroke-width=".8"/><circle r="92" fill="none" stroke="#98733b" stroke-width=".6" stroke-dasharray="1 3"/>
  <g font-family="Arial, Liberation Sans, sans-serif" font-size="10" font-weight="700" fill="#493819">${arcText('EFFORT VERIFIED',83,-132,-48)}${arcText('LINKEDIN BEATS',87,130,50)}</g>
  <g fill="#83652e">${[-1,1].map(side=>`<g transform="scale(${side} 1)"><path d="M-23 66C-65 48-76 4-54-37" fill="none" stroke="#83652e" stroke-width="1.1"/>${[-42,-24,-6,12,30,48].map((a,i)=>`<g transform="translate(${-59-Math.sin(i/5*Math.PI)*11} ${a}) rotate(${-30+i*13})"><ellipse rx="3" ry="8"/><ellipse cx="8" cy="5" rx="3" ry="7" transform="rotate(60 8 5)"/></g>`).join('')}</g>`).join('')}</g>
  <circle r="54" fill="#10182f" stroke="#f4dda1" stroke-width="2"/><circle r="48" fill="none" stroke="#cfad69" stroke-width=".7"/>${brand(monogram,-32,-32,64,64,'#f5e5bc')}${fleur('translate(0 67) scale(.25)','#765824')}</g>`;
}
export function certificateMarkup(value,{wordmark,monogram},id='lb-certificate'){
  const name=certificateName(value), nameSize=Math.min(86,1030/Math.max([...name].length,1));
  return `<rect width="1200" height="850" fill="#fbf8ef"/>${border()}
  <rect x="78" y="76" width="1044" height="98" fill="#10182f"/><rect x="78" y="171" width="1044" height="3" fill="#b79a5d"/>${brand(wordmark,98,91,586,67,'#fff')}
  <g fill="#10182f" font-family="Arial, Liberation Sans, sans-serif">
    <text x="1096" y="116" text-anchor="end" font-size="23" letter-spacing="5" fill="#f4df9d">ACADEMY</text><text x="1096" y="142" text-anchor="end" font-size="11" fill="#d6dfef">PROFESSIONAL DEVELOPMENT, ALLEGEDLY.</text>
    <text x="85" y="214" fill="#0757ec" font-size="12" font-weight="700" letter-spacing="2">OFFICIAL RECORD OF COMPLETION</text>
    <g font-weight="900" font-size="59" letter-spacing="-2.6"><text x="81" y="277">CERTIFICATE OF</text><text x="81" y="343">PROFESSIONAL EFFORT</text></g>
    <path d="M85 359C281 353 514 355 746 358" stroke="#ffe65c" stroke-width="10" stroke-linecap="round"/>
    <text x="85" y="398" font-size="11" letter-spacing="2">AWARDED WITH APPROPRIATE ENTHUSIASM TO</text><text x="82" y="473" font-family="Georgia, Liberation Serif, serif" font-size="${nameSize}">${escapeCertificateText(name)}</text>
    <path d="M85 491H1115" stroke="#a18443" stroke-opacity=".6"/>
    <g font-size="21"><text x="85" y="529">For completing five lessons in strategic self-importance,</text><text x="85" y="559">demonstrating advanced synergy, and remaining</text><text x="85" y="589">humbled throughout.</text></g>
    <text x="85" y="628" font-size="11" letter-spacing="2">AND NOW OFFICIALLY RECOGNIZED AS A</text><text x="83" y="666" font-size="33" font-weight="900" fill="#0757ec" letter-spacing="-1">CERTIFIED THOUGHT LEADER</text>
    <text x="85" y="718" font-family="Georgia, Liberation Serif, serif" font-style="italic" font-size="28">Synergy</text><path d="M85 729H365" stroke="#10182f"/><text x="85" y="749" font-size="9" letter-spacing=".7">HEAD OF PROFESSIONAL DEVELOPMENT OPTIMIZATION</text>
    <g text-anchor="middle" font-size="10" letter-spacing="1.2"><text x="650" y="719">FIVE LESSONS. ONE MILESTONE.</text><text x="650" y="741" fill="#0757ec" font-weight="700">CONSIDERABLE EFFORT. VERIFIED.</text></g>
    ${seal(monogram,id)}<path d="M85 775H830" stroke="#a18443" stroke-opacity=".6"/>
    <g font-size="10"><text x="85" y="795">Considerable effort. Unclear business impact.</text><text x="1115" y="795" text-anchor="end" fill="#0757ec" font-weight="700" letter-spacing="1">LINKEDINBEATS.COM / LEARN</text></g>
  </g>`;
}
export function certificateSvg(name,assets){return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1200 850" width="1200" height="850">${certificateMarkup(name,assets)}</svg>`;}
