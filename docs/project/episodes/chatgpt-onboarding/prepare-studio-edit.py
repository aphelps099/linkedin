"""Prepare the studio edit: original voices, shorter spoken ending, HD source media."""
from pathlib import Path
import sys,json,subprocess,math,hashlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter,sosfilt,savgol_filter
import imageio_ffmpeg,cv2
ROOT=Path(sys.argv[1]).resolve();BASE=ROOT.parent;OUT=ROOT/'output';AS=ROOT/'assets';OUT.mkdir(exist_ok=True);AS.mkdir(exist_ok=True);FF=imageio_ffmpeg.get_ffmpeg_exe();SR=24000;DURATION=96

def ff(*a):subprocess.run([FF,'-v','error','-y',*map(str,a)],check=True)
def read(p):
 r,x=wavfile.read(p);assert r==SR;return x.astype(float)/32768
# Preserve every existing voice take through the last practical meeting line.
timeline=json.loads((BASE/'output/timeline.json').read_text());timeline['events']=[e for e in timeline['events'] if e['index']<=22];timeline['duration']=DURATION;timeline['visualEnding']='After meeting: ChatGPT draft, copy, LinkedIn paste, hashtags';timeline['voiceStatus']='Original eSpeak Synergy retained; ElevenLabs alternatives rejected.'
(OUT/'timeline.json').write_text(json.dumps(timeline,indent=2));(OUT/'envelopes.json').write_bytes((BASE/'photo/output/envelopes.json').read_bytes())
n=DURATION*SR;voice=np.zeros(n);duck=np.ones(n)
for e in timeline['events']:
 x=read(BASE/f'source/take-{e["index"]}.wav');start=round(e['start']*SR);voice[start:start+len(x)]=x
 lo=max(0,start-2400);hi=min(n,start+len(x)+4800);a=np.full(hi-lo,.56);a[:2400]=np.linspace(1,.56,2400);a[-2400:]=np.linspace(.56,1,2400);duck[lo:hi]=np.minimum(duck[lo:hi],a)
bed=read(BASE/'source/bed.wav');loop=bed[5*SR:45*SR].copy();loop[:192]*=np.linspace(0,1,192)[:,None];loop[-192:]*=np.linspace(1,0,192)[:,None];music=np.tile(loop,(math.ceil(n/len(loop)),1))[:n];music*=.047/np.sqrt(np.mean(music**2));music*=duck[:,None];fade=np.ones(n);fade[:SR]=np.linspace(0,1,SR);fade[-3*SR:]=np.linspace(1,0,3*SR);music*=fade[:,None]
fx=np.zeros(n);original=read(BASE/'output/paper-fx.wav');fx[:len(original)]=original
# Quiet mechanical key taps, confined to the visible typing action; no vocal punchline.
rng=np.random.default_rng(41)
for t in [77.0,77.18,77.37,77.53,77.72,77.95,78.13,78.28,78.54,78.71,78.89,79.06,79.24,79.42,79.61,83.25,84.42]:
 count=600;x=rng.normal(0,.008,count)*np.exp(-np.arange(count)/85);x=sosfilt(butter(2,1200,fs=SR,btype='highpass',output='sos'),x);start=int(t*SR);fx[start:start+count]+=x
mix=music+voice[:,None]+fx[:,None];wavfile.write(OUT/'premix.wav',SR,np.int16(np.clip(mix,-.999,.999)*32767));wavfile.write(OUT/'dialogue.wav',SR,np.int16(voice*32767));ff('-i',OUT/'premix.wav','-af','loudnorm=I=-16:TP=-1.5:LRA=9','-ar',48000,OUT/'mix.wav')
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
(OUT/'captions.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(f'{stamp(e["start"])} --> {stamp(e["end"])}\n{e["text"]}' for e in timeline['events'])+'\n')
# Real camera frames: enhanced sources are held at 2560 wide for clean 1080p speaker views.
for who in ['people','operations','synergy']:
 ff('-i',AS/f'{who}-4k.mp4','-frames:v',1,'-vf','scale=2560:1440',AS/f'{who}-hd.png')
segments=[{'key':'blink','who':'people','start':7.55,'end':8.205,'sourceStart':.6,'source':str(AS/'people-4k.mp4')},{'key':'coffee','who':'synergy','start':39.27,'end':41.07,'sourceStart':0,'source':str(BASE/'photo-plus/assets/coffee-0.mp4')},{'key':'drums','who':'operations','start':23.91,'end':24.81,'sourceStart':0,'source':str(AS/'operations-4k.mp4')},{'key':'laptop','who':'laptop','start':76.5,'end':86.5,'sourceStart':0,'source':str(AS/'laptop.mp4')}]
for s in segments:
 folder=AS/s['key'];folder.mkdir(exist_ok=True);vf='fps=24,scale=1920:-2,format=yuvj420p';ff('-ss',s['sourceStart'],'-i',s['source'],'-t',s['end']-s['start'],'-vf',vf,'-q:v',2,folder/'%03d.jpg');s['files']=[str(p.relative_to(ROOT)) for p in sorted(folder.glob('*.jpg'))]
# Track the established laptop screen from fixed bezel features, and retain foreground fingers.
cap=cv2.VideoCapture(str(AS/'laptop.mp4'));ok,f=cap.read();assert ok
f=cv2.resize(f,(1280,720));g0=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY);q=np.float32([[348,87],[1220,83],[1217,544],[325,525]])
fill=np.zeros((720,1280),np.uint8);cv2.fillConvexPoly(fill,q.astype(int),255);ring=cv2.dilate(fill,np.ones((27,27),np.uint8))-cv2.erode(fill,np.ones((7,7),np.uint8));ring[490:]=0
pts=cv2.goodFeaturesToTrack(g0,150,.006,5,mask=ring);positions=[q.copy()];errors=[]
while True:
 ok,f=cap.read()
 if not ok:break
 gray=cv2.cvtColor(cv2.resize(f,(1280,720)),cv2.COLOR_BGR2GRAY);p1,st,err=cv2.calcOpticalFlowPyrLK(g0,gray,pts,None,winSize=(35,35),maxLevel=4,criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,45,.005));good=(st.ravel()==1)&(err.ravel()<22);M,ins=cv2.estimateAffinePartial2D(pts[good],p1[good],method=cv2.RANSAC,ransacReprojThreshold=1.3)
 if M is None:positions.append(positions[-1]);continue
 H=np.vstack([M,[0,0,1]]);positions.append(cv2.perspectiveTransform(q[None],H)[0]);pred=cv2.perspectiveTransform(pts[good],H);errors.append(float(np.median(np.linalg.norm(pred-p1[good],axis=2))))
cap.release();positions=savgol_filter(np.float32(positions),7,2,axis=0);(AS/'screen-track.json').write_text(json.dumps(np.round(positions,3).tolist()))
# Native plate is 24fps; mask extracts original brighter fingers only in the lower screen.
for i,path in enumerate(segments[-1]['files']):
 im=cv2.imread(str(ROOT/path));h,w=im.shape[:2];qq=positions[min(i,len(positions)-1)]*(w/1280);gray=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY);roi=np.zeros((h,w),np.uint8);cv2.fillConvexPoly(roi,qq.astype(int),255);roi[:round(430*h/720)]=0;bright=((gray>64)&(roi>0)).astype(np.uint8)*255;bright=cv2.morphologyEx(bright,cv2.MORPH_CLOSE,np.ones((15,15),np.uint8));contours,_=cv2.findContours(bright,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);mask=np.zeros_like(bright)
 for c in contours:
  if cv2.contourArea(c)>25:cv2.drawContours(mask,[cv2.convexHull(c)],-1,255,-1)
 mask=cv2.dilate(mask,np.ones((7,7),np.uint8));mask=cv2.GaussianBlur(mask,(3,3),.5);rgba=cv2.cvtColor(im,cv2.COLOR_BGR2BGRA);rgba[:,:,3]=mask;cv2.imwrite(str(AS/'laptop'/f'holdout-{i+1:03d}.png'),rgba)
(AS/'segments.json').write_text(json.dumps(segments,indent=2));(OUT/'preparation.json').write_text(json.dumps({'duration':DURATION,'voiceEvents':len(timeline['events']),'lastSpokenLine':timeline['events'][-1]['text'],'lastSpokenEnd':timeline['events'][-1]['end'],'screenTrackingMedianError':float(np.median(errors)),'sourceUpscales':'AI enhanced existing video; not new camera detail'},indent=2));print('Prepared studio picture, screen track and audio')
