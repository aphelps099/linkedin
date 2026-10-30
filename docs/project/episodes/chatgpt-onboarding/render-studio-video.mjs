import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {chromium} from 'playwright-core';
const here=dirname(fileURLToPath(import.meta.url)),repo=resolve(here,'../../../..'),root=resolve(process.argv[2]),out=resolve(root,'output');
const python=resolve(repo,'../optimizing/.venv/bin/python'),ff=execFileSync(python,['-c','import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'],{encoding:'utf8'}).trim();
const data=async(p,mime)=>`data:${mime};base64,${(await readFile(p)).toString('base64')}`;
const timeline=JSON.parse(await readFile(resolve(out,'timeline.json'),'utf8')),envelopes=JSON.parse(await readFile(resolve(out,'envelopes.json'),'utf8'));
const photos={};for(const who of ['synergy','people','operations'])photos[who]=await data(resolve(root,`assets/${who}-hd.png`),'image/png');photos.printer=await data(resolve(repo,'public/studio/season/posters/printer-neutral.jpg'),'image/jpeg');
const instrumentSegments=JSON.parse(await readFile(resolve(root,'assets/instruments/manifest.json'),'utf8'));
const segments=JSON.parse(await readFile(resolve(root,'assets/segments.json'),'utf8'));
const input={timeline,envelopes,photos,track:JSON.parse(await readFile(resolve(root,'assets/screen-track.json'),'utf8')),mark:await data(resolve(repo,'public/brand/afterbeat/wordmark-black.svg'),'image/svg+xml'),whiteMark:await data(resolve(repo,'public/brand/afterbeat/wordmark-white.svg'),'image/svg+xml'),regular:await data(resolve(repo,'public/home-2/fonts/tt-hoves-regular.ttf'),'font/ttf'),bold:await data(resolve(repo,'public/home-2/fonts/tt-hoves-demibold.ttf'),'font/ttf')};
const printer=(await readFile(resolve(repo,'src/meeting-room/printer-paper.js'),'utf8')).replace(/export /g,'');
const synergyDisplay=(await readFile(resolve(repo,'src/meeting-room/synergy-display.js'),'utf8')).replace(/export /g,'');
const html=(await readFile(resolve(here,'scene-studio.html'),'utf8')).replace('__INPUT__',JSON.stringify(input)).replace('__PRINTER__',printer).replace('__SYNERGY_DISPLAY__',synergyDisplay);
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setContent(html);await page.evaluate(()=>window.ready);
let lastKey='';async function draw(t){if(t<2.5){const assets={};for(const segment of instrumentSegments){if(t>=segment.start){const index=Math.min(segment.files.length-1,Math.floor((t-segment.start)*24+1e-6));assets[segment.key]=await data(resolve(root,segment.files[index]),'image/jpeg')}}await page.evaluate(a=>window.setInstruments(a),assets)}const segment=segments.find(s=>t>=s.start&&t<s.end);const index=segment?Math.min(segment.files.length-1,Math.floor((t-segment.start)*24+1e-6)):-1,key=segment?segment.key+index:'';
 if(key!==lastKey){let asset=null;if(segment){asset={who:segment.who,key:segment.key,image:await data(resolve(root,segment.files[index]),'image/jpeg')};if(segment.key==='laptop')asset.holdout=await data(resolve(root,`assets/laptop/holdout-${String(index+1).padStart(3,'0')}.png`),'image/png')}await page.evaluate(a=>window.setMotion(a),asset);lastKey=key}
 await page.evaluate(t=>window.draw(t),t);
}
await mkdir(resolve(out,'frames'),{recursive:true});
for(const t of [.3,.8,1.5,2.25,2.55,5,10.5,18.3,26,35.8,40,62,73,76.6,78.3,80.8,83.5,84.5,86,88,91.5,95]){await draw(t);await page.screenshot({path:resolve(out,`frames/review-${t}.png`)})}
if(process.argv.includes('--stills')){await browser.close();console.log('Stills complete');process.exit(0)}
const encode=spawn(ff,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','24','-vcodec','mjpeg','-i','pipe:0','-i',resolve(out,'mix.wav'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t',String(timeline.duration),'-movflags','+faststart',resolve(out,'chatgpt-meeting-studio-v10.mp4')],{stdio:['pipe','inherit','inherit']});const completion=once(encode,'close');
for(let f=0;f<timeline.duration*24;f++){await draw(f/24);const jpeg=await page.evaluate(()=>document.querySelector('canvas').toDataURL('image/jpeg',.96).split(',')[1]);if(!encode.stdin.write(Buffer.from(jpeg,'base64')))await once(encode.stdin,'drain');if(f%240===0)console.log(`Rendered ${f/24} / ${timeline.duration}s`)}encode.stdin.end();const [code]=await completion;await browser.close();if(code!==0||errors.length)throw Error(JSON.stringify({code,errors}));console.log('Studio cut complete');
