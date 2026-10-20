"""Restore the installation story and remove the end card. No model calls."""
import importlib.util,sys,subprocess,json
from pathlib import Path
import cv2,numpy as np
from scipy.io import wavfile
W=Path(sys.argv[1]);R=Path(__file__).resolve().parents[1];D=W/'brand-story/v6';D.mkdir(parents=True,exist_ok=True)
reuse='--reuse-plates' in sys.argv;sys.argv=[sys.argv[0],str(W)];spec=importlib.util.spec_from_file_location('base',R/'scripts/render-office-brand-film.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
(D/'review').mkdir(exist_ok=True);(W/'brand-story/review').mkdir(exist_ok=True)
FPS=24;B=240/88;V5=W/'brand-story/v5/LinkedIn-Beats-Welcome-to-the-Office-720p.mp4'
# Store full usable installation plates for reuse in the catalog.
for name,duration in ([] if reuse else [('banner',10),('measure',2.1)]):
 enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r','24','-i','-','-an','-c:v','libx264','-crf','19','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(D/(name+'-printed.mp4'))],stdin=subprocess.PIPE)
 for i in range(round(duration*FPS)):
  f,j=base.frame(name,i/FPS);f=base.banner_frame(name,f,j);enc.stdin.write(f.tobytes())
  if i in [12,24,40,70]:cv2.imwrite(str(D/'review'/f'{name}-{i}.jpg'),f)
 enc.stdin.close();assert enc.wait()==0
# Half-bar cuts preserve the musical pocket and all existing dialogue sync.
segments=[('arrival',0,B, W/'brand-story/raw/arrival.mp4',0,0),('camcorder',0,.5*B,V5,0,0),('drummer',.5*B,2*B,V5,.5*B,.5*B),('banner',0,B,D/'banner-printed.mp4',.8,2*B),('main',2.5*B,7.5*B,V5,2.5*B,2.5*B),('measure',0,.5*B,D/'measure-printed.mp4',.2,7.5*B),('main-end',8*B,20.5*B,V5,8*B,8*B)]
audio=base.audio(V5);oldAudio=base.audio(W/'brand-story/v5/source/LinkedIn-Beats-Welcome-to-the-Office-720p.mp4')
parts=[];proof=[];offset=0
for ix,(name,start,end,src,ss,aa) in enumerate(segments):
 n=round(end*FPS)-round(start*FPS);dur=n/FPS;part=D/f'part-{ix}.mp4'
 subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-ss',str(ss),'-i',str(src),'-frames:v',str(n),'-an','-vf','fps=24,scale=1280:720,setsar=1','-c:v','libx264','-threads','2','-crf','18','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(part)],check=True)
 check=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(part)]));assert abs(float(check['format']['duration'])-dur)<.06
 parts.append(part)
 a=(oldAudio if name=='arrival' else audio)[round(aa*48000):round(aa*48000)+round(dur*48000)].copy()
 if len(a)<round(dur*48000):a=np.pad(a,((0,round(dur*48000)-len(a)),(0,0)))
 # The banner extends by a half-bar: repeat the instrumental half-bar.
 if name=='banner':
  n0=round(.5*B*48000);a=np.tile(audio[round(2*B*48000):round(2*B*48000)+n0],(2,1))[:round(dur*48000)]
 a[:144]*=np.linspace(0,1,144)[:,None];a[-144:]*=np.linspace(1,0,144)[:,None]
 if ix==len(segments)-1:a[-7200:]*=np.linspace(1,0,7200)[:,None]
 wavfile.write(D/f'audio-{ix}.wav',48000,a)
 proof.append({'name':name,'start':offset,'duration':dur,'source':str(src.relative_to(W)),'sourceStart':ss});offset+=dur
 print(name,offset,flush=True)
(D/'parts.txt').write_text(''.join("file '%s'\n"%p for p in parts));mix=np.concatenate([base.audio(D/f'audio-{i}.wav') for i in range(len(parts))]);wavfile.write(D/'mix.wav',48000,mix)
out=D/'LinkedIn-Beats-Welcome-to-the-Office-720p.mp4'
subprocess.run(['ffmpeg','-nostdin','-v','error','-xerror','-y','-f','concat','-safe','0','-i',str(D/'parts.txt'),'-i',str(D/'mix.wav'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart','-shortest',str(out)],check=True)
final=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(out)]));assert abs(float(final['format']['duration'])-offset)<.06
(D/'edit-proof.json').write_text(json.dumps({'duration':offset,'newCredits':0,'shots':proof,'removed':'Final blue end card, tagline voiceover and preceding repeated Synergy reaction','restored':'Arrival, printed banner installation, banner measuring'},indent=2));print(out,flush=True)
