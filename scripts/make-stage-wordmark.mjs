import {writeFileSync} from 'node:fs';

// Original angular outlines, extending the site's Get LinkedInified emblem.
// Each letter uses a 60-unit cap height; no runtime font or raster text.
const glyphs = {
  A:[40,'M0 60V12L12 0H28L40 12V60H27V38H13V60ZM13 25H27V17L23 13H17L13 17Z'],
  B:[40,'M0 0H28L40 12V22L33 29L40 36V48L28 60H0ZM13 13V23H23L27 19V17L23 13ZM13 36V47H23L27 43V40L23 36Z'],
  D:[40,'M0 0H28L40 12V48L28 60H0ZM13 13V47H22L27 42V18L22 13Z'],
  E:[34,'M0 0H34V13H13V23H31V36H13V47H34V60H0Z'],
  I:[14,'M0 0H14V60H0Z'],
  K:[40,'M0 0H13V22L25 0H40L23 29L40 60H25L13 37V60H0Z'],
  L:[32,'M0 0H13V47H32V60H0Z'],
  M:[48,'M0 60V0H13L24 24L35 0H48V60H35V28L24 48L13 28V60Z'],
  N:[40,'M0 60V0H13L27 31V0H40V60H27L13 29V60Z'],
  O:[40,'M12 0H28L40 12V48L28 60H12L0 48V12ZM13 17V43L17 47H23L27 43V17L23 13H17Z'],
  S:[38,'M12 0H38V13H17L13 17V23H27L38 34V48L26 60H0V47H21L25 43V36H12L0 24V12Z'],
  U:[40,'M0 0H13V43L17 47H23L27 43V0H40V48L28 60H12L0 48Z'],
  Y:[40,'M0 0H14L20 21L26 0H40L27 36V60H13V36Z'],
};

function line(text,y) {
  let x=0;
  const paths=[];
  for(const letter of text){
    if(letter===' '){x+=18;continue;}
    const [width,path]=glyphs[letter];
    paths.push(`<path transform="translate(${x})" d="${path}"/>`);
    x+=width+3;
  }
  return `<g transform="translate(101 ${y}) skewX(-14) scale(${(590/(x-3)).toFixed(5)} 1.08)">${paths.join('')}</g>`;
}

const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 170" width="700" height="170" role="img" aria-labelledby="title">
<title id="title">Sound like you mean business</title>
<path fill="#fff349" transform="translate(0 2) scale(.83 .98)" d="M70 4 7 87H42L20 157 96 67H59Z"/>
<g fill="#fbf6e8" fill-rule="evenodd">${line('SOUND LIKE YOU',7)}${line('MEAN BUSINESS',82)}</g>
<path fill="#0757ec" d="M84 158H682L679 170H81Z"/>
</svg>\n`;
writeFileSync(new URL('../public/home-experiments/sound-like-business.svg',import.meta.url),svg);
