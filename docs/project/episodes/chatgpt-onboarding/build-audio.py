"""New dialogue, unchanged cast identities, reused original 96 BPM instrumental."""
from pathlib import Path
import sys, json, math, subprocess, hashlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly, butter, sosfilt
import imageio_ffmpeg
HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]
sys.path.insert(0,str(REPO/'scripts'))
from retro_speech import RetroSpeech
OUT=Path(sys.argv[1]);SRC=OUT/'source';DEST=OUT/'output'
SR=24000;FF=imageio_ffmpeg.get_ffmpeg_exe();retro=RetroSpeech()
script=json.loads((HERE/'script.json').read_text());events=[];takes=[];cursor=3.1
def save(p,a):wavfile.write(p,SR,(np.clip(a,-.999,.999)*32767).astype(np.int16))
def rms(a):return max(1e-8,np.sqrt(np.mean(a*a)))
def ff(*args):subprocess.run([FF,'-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)
for i,line in enumerate(script['lines']):
 if line['who']=='synergy':
  rate,a=retro.synthesize(line['text'].replace('ChatGPT','Chat G P T'),voice='en-us',rate=154,pitch=35,pitch_range=4)
  g=math.gcd(SR,rate);a=resample_poly(a,SR//g,rate//g)
  a=sosfilt(butter(2,[120,5000],btype='bandpass',fs=SR,output='sos'),a)
 else:
  rate,a=wavfile.read(SRC/f'voice-{i}.wav');a=a.astype(float)/(32768 if a.dtype==np.int16 else 1)
  assert rate==SR
 active=np.flatnonzero(np.abs(a)>.004)
 a=a[max(0,active[0]-720):min(len(a),active[-1]+1800)]
 a*=.115/rms(a);a*=min(1,.78/max(.001,np.max(abs(a))))
 a[:120]*=np.linspace(0,1,120);a[-120:]*=np.linspace(1,0,120)
 save(SRC/f'take-{i}.wav',a)
 end=cursor+len(a)/SR
 event={**line,'start':round(cursor,4),'end':round(end,4),'index':i}
 # Phrase cuts for the three-sentence text passage follow measured voice pauses.
 if line['text'].startswith('Streamlined onboarding.'):
  step=240;energy=np.array([rms(a[j:j+step]) for j in range(0,len(a),step)])
  pauses=[];j=10
  while j<len(energy)-10:
   if energy[j]<.012:
    k=j
    while k<len(energy) and energy[k]<.012:k+=1
    if k-j>=12:pauses.append((j+k)/2*.01)
    j=k
   else:j+=1
  event['phraseCuts']=pauses[:2]
 events.append(event);takes.append(a);cursor=end+line['gap']
duration=math.ceil(max(90,cursor+2.5)*24)/24
n=round(duration*SR);voice=np.zeros(n);duck=np.ones(n)
for e,a in zip(events,takes):
 start=round(e['start']*SR);voice[start:start+len(a)]+=a
 lo=max(0,start-2400);hi=min(n,start+len(a)+4800);r=2400
 env=np.full(hi-lo,.56);env[:r]=np.linspace(1,.56,r);env[-r:]=np.linspace(.56,1,r);duck[lo:hi]=np.minimum(duck[lo:hi],env)
score=REPO.parent/'optimizing/paper-droid-song/output/tempo.wav'
# tempo.wav is the established score conformed to 96 BPM, before fade or dialogue duck.
ff('-i',score,'-ar',SR,'-ac',2,SRC/'bed.wav')
_,bed=wavfile.read(SRC/'bed.wav');bed=bed.astype(float)/32768
# Loop an interior 16-bar phrase at the same tempo; overlap only 8ms at the seam.
loop=bed[round(5*SR):round(45*SR)].copy();assert len(loop)==40*SR
edge=192;loop[:edge]*=np.linspace(0,1,edge)[:,None];loop[-edge:]*=np.linspace(1,0,edge)[:,None]
music=np.tile(loop,(math.ceil(n/len(loop)),1))[:n].copy();music*=.047/rms(music)
music*=duck[:,None];fade=np.ones(n);fade[:SR]=np.linspace(0,1,SR);fade[-3*SR:]=np.linspace(1,0,3*SR);music*=fade[:,None]
fx=np.zeros(n);rng=np.random.default_rng(31)
# Brief dry paper shuffles at the meeting assembly and a quiet printer motor callback.
for start in [2.6,2.72,2.84,2.96]:
 count=2400;t=np.arange(count)/SR;x=rng.normal(0,.018,count)*np.sin(np.pi*np.arange(count)/count)**2
 x=sosfilt(butter(2,[700,4500],btype='bandpass',fs=SR,output='sos'),x)
 j=round(start*SR);fx[j:j+count]+=x
motor_start=next(e['end'] for e in events if e['text']=="I'll use that.")+.25;count=round(1.25*SR);t=np.arange(count)/SR
motor=(.009*np.sin(2*np.pi*118*t)+.003*np.sin(2*np.pi*236*t)+rng.normal(0,.002,count))*np.sin(np.pi*np.arange(count)/count)**2
j=round(motor_start*SR);fx[j:j+count]+=motor
save(DEST/'dialogue.wav',voice);save(DEST/'music.wav',music);save(DEST/'paper-fx.wav',fx)
save(DEST/'premix.wav',music+voice[:,None]+fx[:,None])
ff('-i',DEST/'premix.wav','-af','loudnorm=I=-16:TP=-1.5:LRA=9','-ar',48000,DEST/'mix.wav')
timeline={**script,'duration':duration,'events':events,'voiceEngine':retro.version,'scoreSource':str(score),'scoreSha256':hashlib.sha256(score.read_bytes()).hexdigest(),'musicBpm':96,'reviewStatus':'new scene awaiting listening and creative review'}
(DEST/'timeline.json').write_text(json.dumps(timeline,indent=2)+'\n')
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
(DEST/'captions.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(f'{stamp(e["start"])} --> {stamp(e["end"])}\n{e["text"]}' for e in events)+'\n')
print(json.dumps({'duration':duration,'spokenEnd':events[-1]['end'],'textPhraseCuts':next(e.get('phraseCuts') for e in events if e['text'].startswith('Streamlined onboarding.'))},indent=2))
