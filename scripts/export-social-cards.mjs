import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(root+'public/share',{recursive:true});
for(const name of ['optimizer-printer','synergy-team','synth']){
  // Retain the original PNG masters; only downsample the crawler deliverables.
  const output=root+`public/share/${name}-20261022.jpg`;
  const info=await sharp(root+`assets/social-share/2026-10/${name}-master.png`)
    .resize(1200,630,{fit:'cover',position:'centre',withoutEnlargement:true})
    .jpeg({quality:95,chromaSubsampling:'4:4:4',mozjpeg:true}).toFile(output);
  console.log(`${name}: ${info.width} × ${info.height}, ${Math.round(info.size/1024)} KB`);
}
