import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..');
const root=resolve(process.argv[2]),out=resolve(root,'output');
const python=resolve(repo,'../optimizing/.venv/bin/python');
const ff=execFileSync(python,['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).trim();
const data=async(p,mime)=>`data:${mime};base64,${(await readFile(p)).toString('base64')}`;
const timeline=JSON.parse(await readFile(resolve(out,'timeline.json'),'utf8'));
const photos={};for(const [who,name] of Object.entries({synergy:'synergy-camera-v2-listening',people:'people-listening',operations:'drums-listening',printer:'printer-neutral'}))photos[who]=await data(resolve(repo,`public/studio/season/posters/${name}.jpg`),'image/jpeg');
const envelopes=JSON.parse(await readFile(resolve(out,'envelopes.json'),'utf8'));
const manifest=JSON.parse(await readFile(resolve(root,'assets/motion-manifest.json'),'utf8'));
const motion={};for(const [key,m] of Object.entries(manifest)){motion[key]=await Promise.all(m.files.map(p=>data(resolve(root,p),'image/jpeg')))}
const input={motion,timeline,photos,envelopes,mark:await data(resolve(repo,'public/brand/afterbeat/wordmark-black.svg'),'image/svg+xml'),whiteMark:await data(resolve(repo,'public/brand/afterbeat/wordmark-white.svg'),'image/svg+xml'),regular:await data(resolve(repo,'public/home-2/fonts/tt-hoves-regular.ttf'),'font/ttf'),bold:await data(resolve(repo,'public/home-2/fonts/tt-hoves-demibold.ttf'),'font/ttf')};
const printer=(await readFile(resolve(repo,'src/meeting-room/printer-paper.js'),'utf8')).replace(/export /g,'');
const synergyDisplay=(await readFile(resolve(repo,'src/meeting-room/synergy-display.js'),'utf8')).replace(/export /g,'');
const html=(await readFile(resolve(here,'scene-photo-plus.html'),'utf8')).replace('__INPUT__',JSON.stringify(input)).replace('__PRINTER__',printer).replace('__SYNERGY_DISPLAY__',synergyDisplay);
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
await page.setContent(html);await page.evaluate(()=>window.ready);
await mkdir(resolve(out,'frames'),{recursive:true});
for(const t of [.2,.7,1.5,2.52,2.85,5,7.8,24.3,35.8,39.5,40.8,71,83,85.2,88]){
 if(t>=timeline.duration)continue;
 await page.evaluate(t=>window.draw(t),t);await page.screenshot({path:resolve(out,`frames/review-${t}.png`)});
}
if(process.argv.includes('--stills')){await browser.close();process.exit(0)}
const encode=spawn(ff,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','24','-vcodec','mjpeg','-i','pipe:0','-i',resolve(root,'../output/chatgpt-meeting-v1.mp4'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','copy','-t',String(timeline.duration),'-movflags','+faststart',resolve(out,'chatgpt-meeting-photo-v4.mp4')],{stdio:['pipe','inherit','inherit']});
const completion=once(encode,'close');
for(let f=0;f<Math.round(timeline.duration*24);f++){
 const jpeg=await page.evaluate(t=>{window.draw(t);return document.querySelector('canvas').toDataURL('image/jpeg',.93).split(',')[1]},f/24);
 if(!encode.stdin.write(Buffer.from(jpeg,'base64')))await once(encode.stdin,'drain');
 if(f%240===0)console.log(`Rendered ${Math.round(f/24)} / ${timeline.duration}s`);
}
encode.stdin.end();const [code]=await completion;await browser.close();if(code!==0)throw new Error(`FFmpeg exited ${code}`);
console.log('Complete: '+resolve(out,'chatgpt-meeting-photo-v4.mp4'));
