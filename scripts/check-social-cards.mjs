import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {relative} from 'node:path';
import sharp from 'sharp';

const root=fileURLToPath(new URL('../',import.meta.url));
const icon='/home-2/brand/favicon.svg?v=brand-20261022';
const pages=[['index.html','synergy-team'],['optimizer/index.html','optimizer-printer'],['studio/index.html','synergy-team'],['synth/index.html','synth']];
for(const [page,name] of pages){
  const html=await readFile(root+'dist/'+page,'utf8');
  const image=`https://linkedinbeats.com/share/${name}-20261022.jpg`;
  for(const key of ['og:image','twitter:image']){
    assert.equal(html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]+)"`))?.[1],image);
  }
  const file=root+`dist/share/${name}-20261022.jpg`;
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
      const resolved=new URL(href,'https://linkedinbeats.com/'+relative(root+'dist',path));
      assert.equal(resolved.pathname+resolved.search,icon,`${path}: homepage brand favicon`);
    }
  }
}
await checkIcons(root+'dist');
console.log('Social cards passed: crawler metadata, actual image dimensions, image sizes, and one homepage brand favicon on every built HTML page.');
