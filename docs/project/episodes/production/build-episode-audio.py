"""Produce canonical voice stems, speech envelopes and original-score mix."""
from pathlib import Path
import sys,json,math,hashlib,subprocess
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly,butter,sosfilt
import imageio_ffmpeg
REPO=Path(__file__).resolve().parents[4];sys.path.insert(0,str(REPO/'scripts'))
from retro_speech import RetroSpeech
script_path=Path(sys.argv[1]).resolve();ROOT=Path(sys.argv[2]).resolve();SRC=ROOT/'source';OUT=ROOT/'output'
SRC.mkdir(parents=True,exist_ok=True);OUT.mkdir(exist_ok=True)
script=json.loads(script_path.read_text());SR=24000;FF=imageio_ffmpeg.get_ffmpeg_exe();retro=RetroSpeech()
def rms(a):return max(1e-8,float(np.sqrt(np.mean(a*a))))
def save(p,a):wavfile.write(p,SR,np.int16(np.clip(a,-.999,.999)*32767))
def read(p):
 rate,a=wavfile.read(p);den=32768 if a.dtype==np.int16 else 1;return rate,a.astype(float)/den
cursor=3.1;events=[];takes=[];envelopes={'hz':50,'lines':{}}
for i,line in enumerate(script['lines']):
 if line['who']=='synergy':
  rate,a=retro.synthesize(line['text'].replace('ChatGPT','Chat G P T'),voice='en-us',rate=154,pitch=35,pitch_range=4)
  g=math.gcd(SR,rate);a=resample_poly(a,SR//g,rate//g);a=sosfilt(butter(2,[120,5000],btype='bandpass',fs=SR,output='sos'),a)
 else:rate,a=read(SRC/f'voice-{i}.wav');assert rate==SR
 active=np.flatnonzero(np.abs(a)>.004);assert len(active)>0
 a=a[max(0,active[0]-720):min(len(a),active[-1]+1800)];a*=.115/rms(a);a*=min(1,.78/max(.001,np.max(abs(a))))
 a[:120]*=np.linspace(0,1,120);a[-120:]*=np.linspace(1,0,120);save(SRC/f'take-{i}.wav',a)
 end=cursor+len(a)/SR;events.append({**line,'index':i,'start':round(cursor,4),'end':round(end,4)});takes.append(a);cursor=end+line['gap']
 levels=np.array([rms(a[k:k+480]) for k in range(0,len(a),480)]);levels=np.minimum(1,levels/max(.03,np.percentile(levels,88)));levels[levels<.08]=0;envelopes['lines'][str(i)]=np.round(levels,3).tolist()
meeting_end=math.ceil((events[-1]['end']+1.5)*24)/24;duration=math.ceil(max(90,meeting_end+15.5)*24)/24;outro_start=duration-5.5
n=round(duration*SR);voice=np.zeros(n);duck=np.ones(n)
for event,a in zip(events,takes):
 start=round(event['start']*SR);voice[start:start+len(a)]+=a;lo=max(0,start-2400);hi=min(n,start+len(a)+4800);e=np.full(hi-lo,.56);e[:2400]=np.linspace(1,.56,2400);e[-2400:]=np.linspace(.56,1,2400);duck[lo:hi]=np.minimum(duck[lo:hi],e)
score=REPO.parent/'optimizing/paper-meeting-chatgpt/source/bed.wav';_,bed=read(score);loop=bed[5*SR:45*SR].copy();assert len(loop)==40*SR
loop[:192]*=np.linspace(0,1,192)[:,None];loop[-192:]*=np.linspace(1,0,192)[:,None];music=np.tile(loop,(math.ceil(n/len(loop)),1))[:n];music*=.047/rms(music);music*=duck[:,None];fade=np.ones(n);fade[:SR]=np.linspace(0,1,SR);fade[-3*SR:]=np.linspace(1,0,3*SR);music*=fade[:,None]
fx=np.zeros(n);rng=np.random.default_rng(31)
for time in [2.6,2.72,2.84,2.96]:
 count=2400;x=rng.normal(0,.018,count)*np.sin(np.pi*np.arange(count)/count)**2;x=sosfilt(butter(2,[700,4500],btype='bandpass',fs=SR,output='sos'),x);j=round(time*SR);fx[j:j+count]+=x
save(OUT/'dialogue.wav',voice);save(OUT/'music.wav',music);save(OUT/'premix.wav',music+voice[:,None]+fx[:,None])
subprocess.run([FF,'-hide_banner','-loglevel','error','-y','-i',str(OUT/'premix.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=9','-ar','48000',str(OUT/'mix.wav')],check=True)
subprocess.run([FF,'-v','error','-y','-i',str(OUT/'mix.wav'),'-b:a','192k',str(OUT/'audio-review.mp3')],check=True)
timeline={**script,'events':events,'duration':duration,'meetingEnd':meeting_end,'outroStart':outro_start,'voiceEngine':retro.version,'musicBpm':96,'scoreSha256':hashlib.sha256(score.read_bytes()).hexdigest(),'reviewStatus':'first production cut; awaiting listening and creative review'}
(OUT/'timeline.json').write_text(json.dumps(timeline,indent=2,ensure_ascii=False)+'\n');(OUT/'envelopes.json').write_text(json.dumps(envelopes))
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
(OUT/'captions.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(f'{stamp(e["start"])} --> {stamp(e["end"])}\n{e["text"]}' for e in events)+'\n')
script_path.with_name('timeline.json').write_text(json.dumps(timeline,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'episode':script['id'],'duration':duration,'dialogueEnd':events[-1]['end'],'meetingEnd':meeting_end}))
