from pathlib import Path
import subprocess,json,shutil,imageio_ffmpeg,sys
from scipy.io import wavfile
import numpy as np
root=Path(sys.argv[1]).resolve();base=root.parent;repo=Path(__file__).resolve().parents[4];ff=imageio_ffmpeg.get_ffmpeg_exe();out=root/'output';out.mkdir(exist_ok=True);assets=root/'assets';assets.mkdir(exist_ok=True)
for n in ['brodie','xylar']:shutil.copy2(Path(__file__).parent/f'voice-audition-sources/voice-{n}-source.mp3',assets/f'voice-{n}-source.mp3')
for n in ['timeline.json','captions.vtt','envelopes.json']:shutil.copy2(base/'photo/output'/n,out/n)
sources=json.loads((Path(__file__).parent/'coffee-sources.json').read_text())
# Keep every unique user source available; originals remain untouched.
seen={}
for r in sources:
 if r['sha256'] not in seen:
  name=f'coffee-{r["index"]}.mp4';shutil.copy2(r['path'],assets/name);seen[r['sha256']]=name
 r['asset']=seen[r['sha256']]
(assets/'coffee-manifest.json').write_text(json.dumps(sources,indent=2))
clips={'coffee':(assets/'coffee-0.mp4',0,3),'people':(repo/'public/studio/season/clips/people-listening.mp4',.25,2.5),'operations':(repo/'public/studio/season/clips/drums-listening.mp4',0,2.5),'instrument':(repo/'public/studio/season/clips/drums-playing.mp4',0,2.5),'backdrop':(repo/'public/studio/season/clips/strategy-listening.mp4',0,2.5)}
manifest={}
for key,(p,start,duration) in clips.items():
 folder=assets/key;folder.mkdir(exist_ok=True)
 subprocess.run([ff,'-loglevel','error','-y','-ss',str(start),'-i',str(p),'-t',str(duration),'-vf','fps=12,scale=960:-2,format=yuvj420p','-q:v','3',str(folder/'%03d.jpg')],check=True)
 manifest[key]={'source':str(p),'sourceStart':start,'duration':duration,'fps':12,'files':[str(p.relative_to(root)) for p in sorted(folder.glob('*.jpg'))]}
(assets/'motion-manifest.json').write_text(json.dumps(manifest,indent=2))
# Reusable human performances: do not invent instrumental roles for HR, Finance, or Governance.
for n in ['people-listening','drums-listening','drums-playing','guitar-listening','guitar-playing','keys-full-listening','keys-full-playing','strategy-listening','arjun-listening','linda-listening']:
 shutil.copy2(repo/f'public/studio/season/clips/{n}.mp4',assets/f'{n}.mp4')
# Same spoken content as the two new auditions, from the established dry robot.
a=[]
for i in [0,3,25]:
 sr,x=wavfile.read(base/f'source/take-{i}.wav');a.extend([x,np.zeros(int(sr*.35),dtype=x.dtype)])
wavfile.write(assets/'voice-current.wav',sr,np.concatenate(a))
print('Prepared media and current voice reference')
