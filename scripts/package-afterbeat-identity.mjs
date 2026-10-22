// Render transparent PNG companions, the identity guide and a portable ZIP.
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';
import sharp from 'sharp';
const root=fileURLToPath(new URL('../',import.meta.url)),dir=root+'public/brand/afterbeat/';
await mkdir(dir+'png',{recursive:true});
for(const file of (await readdir(dir)).filter(f=>f.endsWith('.svg')&&!f.startsWith('identity-guide'))){
 const width=file.startsWith('icon-')?512:file.startsWith('monogram-')?1000:2400;
 await sharp(await readFile(dir+file)).resize({width}).png().toFile(dir+'png/'+file.replace('.svg','.png'));
}
await sharp(await readFile(dir+'identity-guide.svg')).resize({width:1800}).png().toFile(dir+'identity-guide.png');
for(const size of [16,24,32,180])await sharp(await readFile(dir+'icon-blue.svg')).resize(size,size).png().toFile(dir+`png/icon-${size}.png`);
// Keep existing application URLs compatible while all consumers adopt Afterbeat.
for(const [from,to] of [['wordmark-color.svg','wordmark-horizontal.svg'],['stacked-color.svg','wordmark-stacked.svg'],['monogram-black.svg','monogram.svg'],['icon-blue.svg','favicon.svg']])await writeFile(root+'public/home-2/brand/'+to,await readFile(dir+from));
await writeFile(root+'public/apple-touch-icon.png',await readFile(dir+'png/icon-180.png'));
for(const size of [16,32,192,512])await sharp(await readFile(dir+'icon-blue.svg')).resize(size,size).png().toFile(root+'public/'+(size<100?`favicon-${size}.png`:`icon-${size}.png`));
// A small standard ZIP archive; build-time export needs only Node and Sharp.
const crcTable=Array.from({length:256},(_,n)=>{
 for(let bit=0;bit<8;bit++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;
 return n>>>0;
});
function crc32(bytes){
 let crc=0xffffffff;
 for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
}
async function listFiles(path=''){
 const files=[];
 for(const item of await readdir(dir+path,{withFileTypes:true})){
  const name=path+item.name;
  if(item.isDirectory())files.push(...await listFiles(name+'/'));
  else if(!/\.(zip|html)$/.test(name))files.push(name);
 }
 return files.sort();
}
const localParts=[],centralParts=[];
let offset=0;
for(const file of await listFiles()){
 const name=Buffer.from('linkedin-beats-afterbeat/'+file);
 const raw=await readFile(dir+file),compressed=deflateRawSync(raw,{level:9});
 const checksum=crc32(raw),local=Buffer.alloc(30),central=Buffer.alloc(46);
 local.writeUInt32LE(0x04034b50,0);
 local.writeUInt16LE(20,4); // ZIP 2.0
 local.writeUInt16LE(0x800,6); // UTF-8 filename
 local.writeUInt16LE(8,8); // DEFLATE
 local.writeUInt16LE(33,12); // Fixed 1980-01-01 timestamp for reproducibility
 local.writeUInt32LE(checksum,14);
 local.writeUInt32LE(compressed.length,18);
 local.writeUInt32LE(raw.length,22);
 local.writeUInt16LE(name.length,26);
 central.writeUInt32LE(0x02014b50,0);
 central.writeUInt16LE(20,4);
 local.copy(central,6,4,30);
 central.writeUInt32LE(offset,42);
 localParts.push(local,name,compressed);
 centralParts.push(central,name);
 offset+=local.length+name.length+compressed.length;
}
const directory=Buffer.concat(centralParts),end=Buffer.alloc(22);
end.writeUInt32LE(0x06054b50,0);
end.writeUInt16LE(centralParts.length/2,8);
end.writeUInt16LE(centralParts.length/2,10);
end.writeUInt32LE(directory.length,12);
end.writeUInt32LE(offset,16);
await writeFile(dir+'linkedin-beats-afterbeat-kit.zip',Buffer.concat([...localParts,directory,end]));
console.log('Afterbeat PNGs, compatibility assets and identity kit ZIP built.');
