from pathlib import Path
import sys,json,subprocess,math
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter,sosfilt,resample_poly
sys.path.insert(0,str(Path('linkedin-hero/scripts').resolve()))
from retro_speech import RetroSpeech
ROOT=Path('training-02-recut');SR=48000;D=50
cues=[(4.0,'An excellent opportunity to demonstrate leadership.'),(10.8,'Too measurable.'),(18.1,"We're taking a phased approach."),(21.5,'Aligning key stakeholders.'),(24.2,'Pressure-testing the roadmap.'),(27.0,"We will share more when we have greater visibility."),(36.0,"Let's establish a working group."),(43.1,'Excellent.'),(45.0,"We've moved this forward.")]
r=RetroSpeech();vo=np.zeros(SR*D);meta=[]
for i,(t,text) in enumerate(cues):
 sr,x=r.synthesize(text,rate=154,pitch=35,pitch_range=4)
 g=math.gcd(sr,SR);x=resample_poly(x,SR//g,sr//g)
 active=np.flatnonzero(abs(x)>.006);x=x[max(0,active[0]-400):active[-1]+1500]
 x=sosfilt(butter(2,[120,5000],btype='bandpass',fs=SR,output='sos'),x)
 x*=.17/max(.001,np.sqrt(np.mean(x*x)));x*=min(1,.78/max(abs(x)))
 x[:150]*=np.linspace(0,1,150);x[-150:]*=np.linspace(1,0,150)
 a=round(t*SR);vo[a:a+len(x)]+=x
 meta.append({'start':t,'end':round(t+len(x)/SR,3),'text':text})
 print(meta[-1],flush=True)
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(ROOT/'source/jazz.mp3'),'-ac','2','-ar',str(SR),'-f','f32le','-'])
music=np.frombuffer(raw,dtype='<f4').reshape(-1,2)[:D*SR].copy()
music*=.10/np.sqrt(np.mean(music*music))
# Smooth speech-led gain, with a fast lead-in and a relaxed musical recovery.
frames=24*D
level=np.array([np.sqrt(np.mean(vo[i*2000:(i+1)*2000]**2)) for i in range(frames)])
duck=np.ones(frames)
for c in meta:
 a=int((c['start']-.12)*24);b=int((c['end']+.18)*24)
 duck[max(0,a):min(frames,b)]=.40
kernel=np.ones(9)/9;duck=np.convolve(np.pad(duck,(4,4),mode='edge'),kernel,mode='valid')
gain=np.interp(np.arange(SR*D)/SR,np.arange(frames)/24,duck)
mix=music*gain[:,None]+vo[:,None]
# Quiet physical keyboard texture, only under the office/ChatGPT typing cuts.
rng=np.random.default_rng(29);sfx=np.zeros(SR*D)
for start,end in [(0,3),(12.2,18.1),(30.5,32.0),(39.5,41.2)]:
 for t in np.arange(start,end,.091):
  a=int((t+rng.uniform(0,.02))*SR);n=900;tt=np.arange(n)/SR
  click=(rng.normal(0,1,n)*.6+np.sin(tt*2*np.pi*1700)*.4)*np.exp(-tt*340)*.020
  sfx[a:a+n]+=click
mix+=sfx[:,None];mix[-int(1.2*SR):]*=np.linspace(1,0,int(1.2*SR))[:,None]
peak=np.max(abs(mix));mix*=min(1,.92/peak)
for name,x in [('voice',vo),('mix',mix)]:wavfile.write(ROOT/'audio'/f'{name}.wav',SR,(np.clip(x,-1,1)*32767).astype('int16'))
(ROOT/'audio/cues.json').write_text(json.dumps(meta,indent=2))
(ROOT/'audio/levels.json').write_text(json.dumps(np.clip(level/.16,0,1).round(3).tolist()))
print('Audio prepared',D,SR,peak)
