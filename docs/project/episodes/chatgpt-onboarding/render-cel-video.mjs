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
const input={timeline,art:await data(resolve(repo,'docs/project/art/cel-meeting-plates-v1.png'),'image/png'),reactions:await data(resolve(repo,'docs/project/art/cel-meeting-reactions-v1.png'),'image/png'),mark:await data(resolve(repo,'public/brand/afterbeat/wordmark-black.svg'),'image/svg+xml'),whiteMark:await data(resolve(repo,'public/brand/afterbeat/wordmark-white.svg'),'image/svg+xml'),regular:await data(resolve(repo,'public/home-2/fonts/tt-hoves-regular.ttf'),'font/ttf'),bold:await data(resolve(repo,'public/home-2/fonts/tt-hoves-demibold.ttf'),'font/ttf')};
const html=(await readFile(resolve(here,'scene-cel.html'),'utf8')).replace('__INPUT__',JSON.stringify(input));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
await page.setContent(html);await page.evaluate(()=>window.ready);
await mkdir(resolve(out,'frames'),{recursive:true});
for(const t of [1,2.8,5,8.5,18.1,21.8,38.5,40,48,65,71,83,88]){
 if(t>=timeline.duration)continue;
 await page.evaluate(t=>window.draw(t),t);await page.screenshot({path:resolve(out,`frames/review-${t}.png`)});
}
if(process.argv.includes('--stills')){await browser.close();process.exit(0)}
const encode=spawn(ff,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','24','-vcodec','mjpeg','-i','pipe:0','-i',resolve(root,'../output/chatgpt-meeting-v1.mp4'),'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','copy','-t',String(timeline.duration),'-movflags','+faststart',resolve(out,'chatgpt-meeting-cel-v2.mp4')],{stdio:['pipe','inherit','inherit']});
const completion=once(encode,'close');
for(let f=0;f<Math.round(timeline.duration*24);f++){
 const jpeg=await page.evaluate(t=>{window.draw(t);return document.querySelector('canvas').toDataURL('image/jpeg',.93).split(',')[1]},f/24);
 if(!encode.stdin.write(Buffer.from(jpeg,'base64')))await once(encode.stdin,'drain');
 if(f%240===0)console.log(`Rendered ${Math.round(f/24)} / ${timeline.duration}s`);
}
encode.stdin.end();const [code]=await completion;await browser.close();if(code!==0)throw new Error(`FFmpeg exited ${code}`);
await writeFile(resolve(root,'index.html'),`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>The onboarding update · Cel edit — LinkedIn Beats</title><style>@font-face{font-family:Hoves;src:url('${input.regular}')}*{box-sizing:border-box}body{margin:0;padding:40px;background:#f3efdf;color:#102c45;font:18px Hoves,Arial}main{max-width:1280px;margin:auto}h1{font-size:clamp(28px,4vw,52px);font-weight:500;margin:20px 0}video{display:block;width:100%;border-radius:24px;background:#102c45}p{max-width:800px;line-height:1.5}a{color:inherit}</style><main><h1>A more intentional first day.</h1><video controls playsinline preload="metadata" poster="output/frames/review-5.png" src="output/chatgpt-meeting-cel-v2.mp4"><track kind="captions" label="English" srclang="en" src="output/captions.vtt"></video><p>Cel-animation edit · Ken Burns moves · Watercolor / ink transitions · Original audio unchanged</p><a href="output/chatgpt-meeting-cel-v2.mp4" download>Download video</a> · <a href="../">Compare original paper cut</a></main>`);
console.log('Complete: '+resolve(out,'chatgpt-meeting-cel-v2.mp4'));
