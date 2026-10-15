import {mkdirSync, writeFileSync} from 'node:fs';

// Original outlined lettering drawn for the approved record-label direction.
// Paths keep the identity sharp and independent of webfont loading.
const letters = {
  L: [67, 'M0 0H29V73H67V100H0Z'],
  I: [29, 'M0 0H29V100H0Z'],
  N: [88, 'M0 100V0H28L60 48V0H88V100H61L28 52V100Z'],
  K: [85, 'M0 0H29V36L52 0H85L53 48L87 100H53L29 62V100H0Z'],
  E: [68, 'M0 0H68V26H29V37H62V62H29V74H68V100H0Z'],
  D: [87, 'M0 0H43C73 0 87 17 87 50S73 100 43 100H0ZM29 26V74H40C53 74 58 68 58 50S53 26 40 26Z'],
  B: [88, 'M0 0H50C74 0 85 10 85 27C85 38 80 45 72 49C83 52 89 60 89 73C89 91 76 100 52 100H0ZM29 25V40H47C54 40 57 38 57 32.5S54 25 47 25ZM29 60V75H49C57 75 60 73 60 67.5S57 60 49 60Z'],
  A: [92, 'M0 100L28 0H64L92 100H62L58 83H32L28 100ZM38 59H52L45 28Z'],
  T: [80, 'M0 0H80V28H54V100H26V28H0Z'],
  S: [84, 'M82 31H54C54 24 51 21 43 21C36 21 33 24 33 28C33 33 38 35 49 38C74 44 84 52 84 69C84 90 69 102 43 102C14 102 0 90 0 67H29C29 76 34 81 43 81C51 81 55 78 55 74C55 69 51 67 39 64C14 58 3 50 3 32C3 11 17 -2 43 -2C68 -2 82 10 82 31Z'],
};
function word(text, x=0, y=0, scaleX=1, scaleY=1) {
  let cursor=0;
  const paths=[...text].map(letter=>{
    const [width,path]=letters[letter];
    const result=`<path transform="translate(${cursor} 0)" d="${path}"/>`;
    cursor+=width+3;
    return result;
  }).join('');
  return {width:cursor-3,svg:`<g transform="translate(${x} ${y}) scale(${scaleX} ${scaleY})" fill-rule="evenodd">${paths}</g>`};
}
const folder=new URL('../public/home-2/brand/',import.meta.url);
mkdirSync(folder,{recursive:true});
const save=(file,box,body)=>writeFileSync(new URL(file,folder),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" fill="#11110e"><title>LinkedIn Beats</title>${body}</svg>\n`);
const top=word('LINKEDIN'), bottom=word('BEATS');
const horizontalSecond=word('BEATS',top.width+29);
const tabX=top.width+29+bottom.width+12;
save('wordmark-horizontal.svg',`0 -2 ${tabX+60} 104`,`${top.svg}${horizontalSecond.svg}<path fill="#164be0" d="M${tabX} 72h60v28h-60z"/>`);
const lowerWidth=top.width-66;
save('wordmark-stacked.svg',`0 -2 ${top.width} 252`,`${top.svg}${word('BEATS',0,110,lowerWidth/bottom.width,1.36).svg}<path fill="#164be0" d="M${top.width-57} 214h57v32h-57z"/>`);
const monogram='<path d="M8 7H28V73H87V94H8Z"/><g transform="translate(32 22) scale(.66)" fill-rule="evenodd"><path d="'+letters.B[1]+'"/></g>';
save('monogram.svg','0 0 100 100',monogram);
save('favicon.svg','0 0 100 100',`<path fill="#164be0" d="M0 0h100v100H0z"/><g fill="#fff">${monogram}</g>`);
console.log('Wrote four outlined record-label logo assets.');
