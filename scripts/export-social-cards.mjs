import sharp from 'sharp';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(root+'assets/social-share/2026-10/manifest.json','utf8'));
const version=manifest.exports.version;
const masterDirectory=root+`output/social-share-cards-${version}`;
await mkdir(root+'public/share',{recursive:true});
await mkdir(masterDirectory,{recursive:true});
async function wordmark(width){
  const scale=width/1200;
  return {
    input:await sharp(root+manifest.wordmark.source)
      .resize({width:Math.round(manifest.wordmark.width*scale)}).png().toBuffer(),
    left:Math.round(manifest.wordmark.left*scale),
    top:Math.round(manifest.wordmark.top*scale),
  };
}
for(const {name} of manifest.cards){
  // Clean artwork stays separate from the exact approved vector wordmark.
  const source=root+`assets/social-share/2026-10/${name}-master.png`;
  const native=await sharp(source).metadata();
  await sharp(source).composite([await wordmark(native.width)])
    .png().toFile(`${masterDirectory}/${name}-master.png`);
  const output=root+`public/share/${name}-${version}.jpg`;
  const info=await sharp(source)
    .resize(1200,630,{fit:'cover',position:'centre',withoutEnlargement:true})
    .composite([await wordmark(1200)])
    .jpeg({quality:95,chromaSubsampling:'4:4:4',mozjpeg:true}).toFile(output);
  console.log(`${name}: ${info.width} × ${info.height}, ${Math.round(info.size/1024)} KB`);
}
