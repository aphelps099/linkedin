import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {relative} from 'node:path';
import sharp from 'sharp';

const root=fileURLToPath(new URL('../',import.meta.url));
// The built site: dist/ by default; check-all.mjs points this at its own scratch build.
const dist=(process.env.CHECK_DIST||root+'dist').replace(/\/$/,'');
const htmlRoot=process.env.CHECK_HTML_ROOT||dist;
const imageRoot=process.env.CHECK_IMAGE_ROOT||dist;
const icon='/home-2/brand/favicon.svg?v=brand-20261022';
const cards=JSON.parse(await readFile(root+(process.env.CHECK_SOCIAL_MANIFEST||'assets/social-share/published-20261109.json'),'utf8'));
for(const card of cards)for(const page of card.pages){
  const html=await readFile(htmlRoot+'/'+page,'utf8');
  const image='https://linkedinbeats.com'+card.image;
  for(const key of ['og:image','twitter:image']){
    const matches=[...html.matchAll(new RegExp(`<meta (?:property|name)="${key}" content="([^"]+)"`,'g'))];
    assert.equal(matches.length,1,`${page}: one ${key} declaration`);
    assert.equal(matches[0][1],image);
  }
  const escapedAlt=card.alt.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  for(const key of ['og:image:alt','twitter:image:alt'])assert(html.includes(`="${key}" content="${escapedAlt}"`),`${page}: current character artwork description`);
  const file=imageRoot+card.image;
  const info=await sharp(file).metadata();
  assert.equal(info.width,1200);assert.equal(info.height,630);
  assert((await stat(file)).size<1_000_000,'crawler image stays under 1 MB');
  for(const [key,value] of [['og:image:width','1200'],['og:image:height','630'],['og:image:type','image/jpeg'],['twitter:card','summary_large_image']]){
    assert(html.includes(`="${key}" content="${value}"`));
  }
}
async function checkIcons(directory){
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=directory+'/'+entry.name;
    if(entry.isDirectory())await checkIcons(path);
    else if(entry.name.endsWith('.html')){
      const html=await readFile(path,'utf8');
      const icons=[...html.matchAll(/<link\b[^>]*rel="icon"[^>]*>/g)];
      assert.equal(icons.length,1,`${path}: one favicon declaration`);
      const href=icons[0][0].match(/href="([^"]+)"/)[1];
      const resolved=new URL(href,'https://linkedinbeats.com/'+relative(dist,path));
      assert.equal(resolved.pathname+resolved.search,icon,`${path}: homepage brand favicon`);
    }
  }
}
if(!process.env.CHECK_HTML_ROOT)await checkIcons(dist);
console.log('Social cards passed: published destinations, crawler metadata, actual image dimensions and image sizes. Built-site runs also verify favicons.');
