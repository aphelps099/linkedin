"""60-second performance-led revision with word-synchronized blue phrases.

python scripts/render-office-brand-film-v2.py WORKSPACE [--stills]
Reuses the approved face compositor and exact physical banner artwork from V1.
"""
import sys,importlib.util,json,subprocess,math,hashlib
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw
from scipy.io import wavfile
from scipy.signal import butter,sosfilt

spec=importlib.util.spec_from_file_location('brand_base',Path(__file__).with_name('render-office-brand-film.py'))
B=importlib.util.module_from_spec(spec);spec.loader.exec_module(B)
cv2.setNumThreads(2)
W=B.W;R=B.R;D=W/'brand-story/v2';A=D/'audio';REVIEW=D/'review';REVIEW.mkdir(exist_ok=True)
FPS=24;SR=48000;LENGTH=60;BAR=240/88;HALF=BAR/2
OUT=D/'LinkedIn-Beats-Welcome-to-the-Office-720p.mp4'
timings=json.loads((A/'phrase-timings.json').read_text())
BLUE=np.array([225,77,5],np.float32) # BGR, saturated LinkedIn Beats cobalt.
for name in ['drummer-arrival','drum-detail','guitar-performance','guitar-detail','keys-performance']:
    B.SOURCES[name]=D/'raw'/f'{name}.mp4'
# A close crop of the continuous take keeps the drummer's exact identity and
# pad layout. The independently commissioned detail take is optional.
USE_SEPARATE_DRUM_DETAIL=(D/'raw/drum-detail.mp4').exists()
for name in timings:B.voices[name]=B.audio(A/(name+'.wav'),1)[:,0]
B.CUES=[('humbled-phrase','synergy',15.3),('describe','synergy',8*BAR+.25),('circle-phrase','synthia',11*BAR+.3),('onboarding-phrase','synergy',14.5*BAR+.3),('optimized','synthia',16*BAR+.25),('tagline','synthia',21*BAR+.25)]
B.BLINK_TIMES={'synergy':[8*BAR+2.15],'synthia':[16*BAR+1.5]}

# Cuts fall on bars or half-bars. The longer cast cards have been removed.
SHOTS=[
 (0,HALF,'arrival',.5,1),
 (HALF,2.5*BAR,'drummer-arrival',.12,1),
 (2.5*BAR,3*BAR,'drum-detail',.5,1),
 (3*BAR,4*BAR,'guitar-performance',.6,1),
 (4*BAR,5.5*BAR,'keys-performance',.4,1),
 (5.5*BAR,7*BAR,'humbled-phrase',0,1),
 (7*BAR,7.5*BAR,'banner',5,1),
 (7.5*BAR,8*BAR,'measure',.4,1),
 (8*BAR,9*BAR,'synergy',1,1),
 (9*BAR,10*BAR,'guitar-detail',1,1),
 (10*BAR,11*BAR,'keys-close',6,1),
 (11*BAR,12.5*BAR,'circle-phrase',0,1),
 (12.5*BAR,13.5*BAR,'drum-detail',4.3,1),
 (13.5*BAR,14.5*BAR,'printer',.25,1),
 (14.5*BAR,16*BAR,'onboarding-phrase',0,1),
 (16*BAR,17*BAR,'synthia',2,1),
 (17*BAR,18*BAR,'guitar-performance',6,1),
 (18*BAR,19*BAR,'droid',2.2,1),
 (19*BAR,21*BAR,'ensemble',.15,1),
 (21*BAR,22*BAR,'end',0,1),
]

def make_audio():
    t=np.arange(SR*LENGTH)/SR;mix=np.zeros((len(t),2),np.float32)
    source=B.audio(R/'public/studio-2/audio/humbled-music.mp3')
    stems=json.loads((W/'watercooler/next-clips/music-stem-manifest.json').read_text())['stems']
    duck=np.ones(len(t),np.float32)
    for n,who,start in B.CUES:
        end=start+len(B.voices[n])/SR
        env=np.minimum(np.clip((t-start+.1)/.1,0,1),np.clip((end+.18-t)/.18,0,1))
        duck=np.minimum(duck,1-.55*env)
    for name,s in stems.items():
        a=round(s['start']*SR);b=round((s['start']+s['duration'])*SR);stem=source[a:b].copy()
        bed=stem[np.mod(np.arange(len(t)),len(stem))]
        targets={'drums':.071,'bass':.052,'keys':.052,'lift':.009}
        bed*=targets[name]/max(.001,np.sqrt(np.mean(bed*bed)))
        if name=='drums':gain=np.interp(t,[0,5.2,2.5*BAR-.04,2.5*BAR,58.8,60],[0,0,0,1.15,1.15,0])
        elif name=='bass':gain=np.interp(t,[0,HALF,2.5*BAR,58.8,60],[.12,.45,1,1,0])
        elif name=='keys':gain=np.interp(t,[0,.12,4*BAR,58.8,60],[0,.6,1,1,0])
        else:gain=np.interp(t,[0,18*BAR,19*BAR,58.8,60],[0,0,.7,.7,0])
        mix+=bed*(gain*duck)[:,None]
    guitar=B.audio(R/'public/studio/season/audio/founder-guitar-e8cccb88d883.mp3')
    # Original guitar becomes an audible lead whenever Kevin is on camera.
    for bar,variant,gain in [(3,0,1),(4,1,.35),(7,0,.3),(9,2,1),(10,1,.45),(12.5,0,.45),(16,2,.3),(17,1,1),(18,2,.55),(19,0,.8),(20,1,.9)]:
        off=variant*BAR;s=guitar[round(off*SR):round((off+BAR)*SR)].copy();s*=.083/max(.001,np.sqrt(np.mean(s*s)))
        i=round(bar*BAR*SR);n=min(len(s),len(mix)-i);mix[i:i+n]+=s[:n]*gain*duck[i:i+n,None]
    # Compact office foley, never louder than the music.
    rng=np.random.default_rng(1988);noise=rng.normal(0,1,len(t));room=sosfilt(butter(2,[120,1700],btype='bandpass',fs=SR,output='sos'),noise)
    mix+=room[:,None]*.0012
    for start in [1.5,2.02,2.57,3.11]:
        z=np.arange(round(.09*SR))/SR;v=(np.sin(2*np.pi*90*z)+rng.normal(0,.2,len(z)))*np.exp(-z*60)*.025;i=round(start*SR);mix[i:i+len(v)]+=v[:,None]
    for a,b,freq in [(13.5*BAR,14.5*BAR,220),(18*BAR,19*BAR,135)]:
        i=round(a*SR);j=round(b*SR);z=np.arange(j-i)/SR;env=np.minimum(np.clip(z/.15,0,1),np.clip((b-a-z)/.2,0,1));v=np.sin(2*np.pi*freq*z)*.003*env;mix[i:j]+=v[:,None]
    for name,who,start in B.CUES:
        v=B.voices[name].copy();v*=min(.12/max(.001,np.sqrt(np.mean(v*v))),.6/max(.001,np.max(abs(v))))
        i=round(start*SR);mix[i:i+len(v)]+=v[:,None]
    mix[-round(.45*SR):]*=np.linspace(1,0,round(.45*SR))[:,None]
    peak=float(np.max(abs(mix)));mix*=min(1,.88/max(.001,peak));assert abs(mix).max()<.95
    wavfile.write(A/'mix.wav',SR,mix)
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(A/'mix.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=8','-ar',str(SR),str(A/'master.wav')],check=True)
    return {'peakBeforeMaster':peak,'loudnessTargetLUFS':-16,'bpm':88,'guitarLeadBars':[3,9,17],'speech':[{'line':n,'speaker':who,'start':s,'end':s+len(B.voices[n])/SR}for n,who,s in B.CUES]}

WORD_LAYOUTS={
 'humbled-phrase':([['HUMBLED'],['AND','HONORED'],['TO','SHARE.']],139),
 'circle-phrase':([["LET’S"],['CIRCLE'],['BACK.']],178),
 'onboarding-phrase':([['OPTIMIZE'],['THE'],['ONBOARDING.']],147)
}
phrase_cache={}
def build_phrase(name):
    lines,size=WORD_LAYOUTS[name];ft=B.font(size,True);items=[];line_height=160;top=98
    for row,words in enumerate(lines):
        widths=[ft.getlength(w) for w in words];gap=ft.getlength(' ');total=sum(widths)+gap*(len(words)-1);x=(1280-total)/2
        for word,w in zip(words,widths):
            mask=Image.new('L',(1280,720));d=ImageDraw.Draw(mask);d.text((round(x),top+row*line_height),word,font=ft,fill=255)
            box=mask.getbbox();items.append({'text':word,'mask':np.array(mask,dtype=np.float32)/255,'box':box});x+=w+gap
    assert len(items)==len(timings[name]['words'])
    for item,event in zip(items,timings[name]['words']):item.update(event)
    # A calm full-frame type stage. All words remain fixed in position.
    bg=np.empty((720,1280,3),np.float32);bg[:]=BLUE
    bg[::4]*=.985
    im=Image.fromarray(cv2.cvtColor(bg.astype('uint8'),cv2.COLOR_BGR2RGB));d=ImageDraw.Draw(im)
    d.text((48,38),'LINKEDIN BEATS',font=B.font(18,True),fill=(168,196,248))
    d.text((1164,38),f'0{list(WORD_LAYOUTS).index(name)+1}',font=B.font(19),fill=(168,196,248))
    base=cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR).astype(np.float32)
    return items,base

def phrase_frame(name,t):
    if name not in phrase_cache:phrase_cache[name]=build_phrase(name)
    items,base=phrase_cache[name];out=base.copy();start=next(s for n,w,s in B.CUES if n==name);local=t-start
    for item in items:
        opacity=.16+.84*np.clip((local-item['start'])/.075,0,1)
        # The opacity reaches exactly 100%; there is no drifting type or glow.
        alpha=item['mask']*opacity;out=out*(1-alpha[:,:,None])+255*alpha[:,:,None]
    # A very small horizontal signal beneath the text, echoing the robot face.
    level=B.voice_level(timings[name]['speaker'],t);phase=(t*15)%30
    for k in range(30):
        strength=.12+(max(0,1-(phase-k+30)%30/8)*.65*level)
        x=490+k*10;out[659:663,x:x+6]=BLUE*(1-strength)+255*strength
    return np.clip(out,0,255).astype('uint8')

labels={}
def lower_name(f,name,role,t,a,b):
    alpha=min(1,max(0,(t-a)/.14),max(0,(b-t)/.18))
    if alpha<=0:return f
    key=(name,role)
    if key not in labels:
        im=Image.new('RGBA',(1280,720));d=ImageDraw.Draw(im)
        d.rectangle((38,614,290,690),fill=(5,77,225,225))
        d.text((53,622),name,font=B.font(27,True),fill='white');d.text((54,658),role,font=B.font(16),fill=(216,230,255))
        labels[key]=np.array(im)
    im=labels[key];mask=im[:,:,3]/255*alpha;return np.clip(f*(1-mask[:,:,None])+im[:,:,:3][:,:,::-1]*mask[:,:,None],0,255).astype('uint8')

def cover_crop(f,box=None):
    if box is not None:
        x0,y0,x1,y1=box;f=f[y0:y1,x0:x1]
    h,w=f.shape[:2];ratio=1280/720
    if w/h>ratio:nw=round(h*ratio);x=(w-nw)//2;f=f[:,x:x+nw]
    else:nh=round(w/ratio);f=f[:nh]
    return cv2.resize(f,(1280,720),interpolation=cv2.INTER_LANCZOS4)

def render(t):
    a,b,name,offset,rate=next(s for s in SHOTS if s[0]<=t<s[1]+1e-8)
    if name in WORD_LAYOUTS:return phrase_frame(name,t)
    if name=='end':
        im=Image.new('RGB',(1280,720),tuple(BLUE[::-1].astype(int)));d=ImageDraw.Draw(im)
        B.center(d,'LINKEDIN BEATS',223,B.font(88,True),'white',1280)
        B.center(d,'Sound like you mean business.',356,B.font(39),'white',1280)
        B.center(d,'linkedinbeats.com',596,B.font(23),(205,222,255),1280)
        return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)
    if name=='drum-detail' and not USE_SEPARATE_DRUM_DETAIL:
        source_start=5.6 if a<10 else 7.0
        f,j=B.frame('drummer-arrival',source_start+t-a)
        return cover_crop(f,(605,340,1220,686))
    if name=='keys-close':
        f,j=B.frame('keys-performance',offset+(t-a)*rate)
        # The source camera has already moved toward the real hands. A small
        # editorial punch-in uses those same moving pixels, never a still.
        return cover_crop(f,(335,295,1250,720))
    f,j=B.frame(name,offset+(t-a)*rate)
    if name in ['banner','measure']:f=B.banner_frame(name,f,j)
    elif name=='ensemble':f=B.ensemble_print(f,j)
    elif name in ['synergy','synthia']:
        f=B.transform_robot(f,name,j,t);f=cover_crop(f,B.CROPS[name]);f=lower_name(f,name.title(),'Management' if name=='synergy' else 'Professional development',t,a,a+1.35)
    elif name=='printer':f=cover_crop(f,(0,0,1280,680))
    elif name=='drummer-arrival':f=lower_name(f,'Operations','Percussion',t,a+.2,a+1.7)
    elif name=='guitar-performance' and a<12:f=lower_name(f,'Kevin','Partnerships',t,a+.1,a+1.5)
    elif name=='keys-performance':f=lower_name(f,'Keys','Enablement',t,a+.1,a+1.5)
    return f

times=[.6,2.5,5.5,7.2,9,12,15.15,15.7,16.3,17.6,19.7,20.8,22.7,25.6,28.6,30.15,31.1,32.4,34.7,37.6,39.7,40.6,41.8,44.5,47.5,50.3,53.2,56.5,58.5]
reviews=[]
if B.args.stills:
    for t in times:
        f=render(t);reviews.append((t,f));cv2.imwrite(str(REVIEW/f'frame-{t:g}.jpg'),f)
else:
    proof=make_audio();silent=D/'edit-silent.mp4'
    enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','18','-preset','medium','-threads','4','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)],stdin=subprocess.PIPE)
    wanted={round(t*FPS) for t in times}
    for i in range(LENGTH*FPS):
        f=render(i/FPS);enc.stdin.write(f.tobytes())
        if i in wanted:reviews.append((i/FPS,f.copy()))
        if i%240==0:print(f'Rendered {i/FPS:.0f} / {LENGTH} seconds',flush=True)
    enc.stdin.close();assert enc.wait()==0
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(silent),'-i',str(A/'master.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t','60','-movflags','+faststart',str(OUT)],check=True)
    proof.update({'width':1280,'height':720,'fps':FPS,'duration':60,'shots':SHOTS,'drumDetailSource':'separate generated take' if USE_SEPARATE_DRUM_DETAIL else 'continuous drummer-arrival take, editorial crop','phraseWords':timings,'revisionCredits':850,'totalProjectCredits':1530,'maximumCredits':10000,'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest()})
    (D/'edit-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(str(OUT),flush=True)
sheet=Image.new('RGB',(1280,math.ceil(len(reviews)/4)*207),'#171717');d=ImageDraw.Draw(sheet)
for k,(t,f) in enumerate(reviews):
    x=k%4*320;y=k//4*207;sheet.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y+23));d.text((x+8,y+4),f'{t:.2f}s',fill='white')
sheet.save(REVIEW/'edit-contact.jpg')
for r in B.readers.values():r[0].release()
