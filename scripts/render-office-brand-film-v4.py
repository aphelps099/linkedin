"""Clean, performance-led 60-second brand film: no editorial lower thirds.

python scripts/render-office-brand-film-v4.py WORKSPACE [--stills]
Reuses the approved V1–V3 footage, tracked screens, robot faces and voices.
One new human-computer plate; all interfaces and editing are local.
"""
import importlib.util,json,math,subprocess,hashlib
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw
from scipy.io import wavfile
from scipy.signal import butter,sosfilt

spec=importlib.util.spec_from_file_location('brand_v3',Path(__file__).with_name('render-office-brand-film-v3.py'))
S=importlib.util.module_from_spec(spec);spec.loader.exec_module(S)
V=S.V;B=S.B;W=S.W;R=S.R
D=W/'brand-story/v4';A=D/'audio';REVIEW=D/'review'
for p in [D,A,REVIEW]:p.mkdir(parents=True,exist_ok=True)
BAR=240/88;FPS=24;SR=48000;LENGTH=22*BAR;FRAMES=round(LENGTH*FPS)
DURATION=FRAMES/FPS
OUT=D/'LinkedIn-Beats-Welcome-to-the-Office-720p.mp4'

# Musical cuts, never accelerated performances. Every source offset remains
# inside its approved take; the drummer still walks to his desk before playing.
EDIT=[
 (0,.5,'arrival',.5),(.5,2,'drummer-arrival',.9),(2,2.5,'drum-detail',5.6),
 (2.5,3.5,'guitar-performance',.6),(3.5,4,'keys-performance',2.2),(4,4.5,'keys-close',6),
 (4.5,5.5,'humbled-phrase',0),(5.5,7,'laptop-zoom',.4),(7,7.5,'synergy',2.364),
 (7.5,8,'guitar-detail',4),(8,8.5,'drum-detail',7),(8.5,9.5,'circle-phrase',0),
 (9.5,11,'laptop-chatgpt',5),(11,12,'human-linkedin',0),(12,13,'linkedin-post',0),
 (13,14.5,'linkedin-comments',0),(14.5,15,'printer',.25),(15,16,'onboarding-phrase',0),
 (16,16.5,'synthia',2),(16.5,17,'guitar-performance',6),(17,17.5,'guitar-detail',6),
 (17.5,18,'keys-performance',4.9),(18,18.5,'drum-detail',8.1),(18.5,19,'droid',2.2),
 (19,19.5,'banner',5),(19.5,21,'ensemble',.15),(21,22,'end',0),
]
SHOTS=[(a*BAR,b*BAR,name,offset) for a,b,name,offset in EDIT]
B.CUES=[
 ('humbled-phrase','synergy',4.5*BAR+.15),
 ('describe','synergy',6.5*BAR+.15),
 ('circle-phrase','synthia',8.5*BAR+.15),
 ('onboarding-phrase','synergy',15*BAR+.15),
 ('optimized','synthia',16*BAR+.25),
 ('tagline','synthia',21*BAR+.25),
]
B.BLINK_TIMES={'synergy':[7*BAR+.85],'synthia':[16*BAR+.9]}
li_spec=importlib.util.spec_from_file_location('brand_linkedin',Path(__file__).with_name('office-brand-linkedin.py'))
LI=importlib.util.module_from_spec(li_spec);li_spec.loader.exec_module(LI);LI.setup(B,W)

def render(t):
    a,b,name,offset=next(s for s in SHOTS if s[0]<=t<s[1])
    local=t-a
    if name in V.WORD_LAYOUTS:return V.phrase_frame(name,t)
    if name=='end':
        # Only the final brand card and requested full-frame phrases are titles.
        im=Image.new('RGB',(1280,720),tuple(V.BLUE[::-1].astype(int)));d=ImageDraw.Draw(im)
        B.center(d,'LINKEDIN BEATS',223,B.font(88,True),'white',1280)
        B.center(d,'Sound like you mean business.',356,B.font(39),'white',1280)
        B.center(d,'linkedinbeats.com',596,B.font(23),(205,222,255),1280)
        return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)
    if name=='human-linkedin':return LI.human(t-11*BAR)
    if name=='linkedin-post':return LI.screen(t-11*BAR)
    if name=='linkedin-comments':return LI.screen(t-11*BAR,True)
    if name.startswith('laptop-'):return S.screen_shot(name,local,t,offset)
    source='drummer-arrival' if name=='drum-detail' else 'keys-performance' if name=='keys-close' else name
    f,j=B.frame(source,offset+local)
    if name=='drum-detail':return V.cover_crop(f,(605,340,1220,686))
    if name=='keys-close':return V.cover_crop(f,(335,295,1250,720))
    if name in ['synergy','synthia']:return V.cover_crop(B.transform_robot(f,name,j,t),B.CROPS[name])
    if name=='printer':return V.cover_crop(f,(0,0,1280,680))
    if name=='banner':return B.banner_frame(name,f,j)
    if name=='ensemble':return B.ensemble_print(f,j)
    # Deliberately no lower_name(), cast_card(), label() or object_credit().
    return f

def make_audio():
    t=np.arange(round(DURATION*SR))/SR;mix=np.zeros((len(t),2),np.float32)
    source=B.audio(R/'public/studio-2/audio/humbled-music.mp3')
    stems=json.loads((W/'watercooler/next-clips/music-stem-manifest.json').read_text())['stems']
    duck=np.ones(len(t),np.float32)
    for n,who,start in B.CUES:
        v=B.voices[n];audible=np.flatnonzero(abs(v)>.005)
        end=start+(audible[-1]+1)/SR if len(audible) else start+len(v)/SR
        env=np.minimum(np.clip((t-start+.08)/.08,0,1),np.clip((end+.16-t)/.16,0,1))
        duck=np.minimum(duck,1-.53*env)
    for name,s in stems.items():
        lo=round(s['start']*SR);hi=round((s['start']+s['duration'])*SR)
        stem=source[lo:hi].copy();bed=stem[np.mod(np.arange(len(t)),len(stem))]
        target={'drums':.076,'bass':.055,'keys':.049,'lift':.009}[name]
        bed*=target/max(.001,np.sqrt(np.mean(bed*bed)))
        if name=='drums':
            gain=np.interp(t,[0,.008,.5*BAR,2*BAR,21*BAR,DURATION-.35,DURATION],[.82,.82,1,1.14,1.14,.88,0])
        elif name=='bass':
            gain=np.interp(t,[0,.012,.5*BAR,21*BAR,DURATION],[.55,.55,1,1,0])
        elif name=='keys':
            gain=np.interp(t,[0,.02,4*BAR,21*BAR,DURATION],[.55,.55,1,1,0])
        else:
            gain=np.interp(t,[0,16.5*BAR,19.5*BAR,21*BAR,DURATION],[0,0,.7,.7,0])
        mix+=bed*(gain*duck)[:,None]
    guitar=B.audio(R/'public/studio/season/audio/founder-guitar-e8cccb88d883.mp3')
    guitar_cues=[(2.5,0,1.05),(3.5,1,.35),(7.5,2,1.05),(9.5,0,.25),
                 (12,1,.3),(13.5,0,.25),(16.5,1,1.05),(17.5,2,.5),(19.5,0,.9),(20.5,1,.9)]
    for bar,variant,gain in guitar_cues:
        lo=round(variant*BAR*SR);hi=round((variant+1)*BAR*SR);s=guitar[lo:hi].copy()
        s*=.086/max(.001,np.sqrt(np.mean(s*s)))
        edge=round(.007*SR);s[:edge]*=np.linspace(0,1,edge)[:,None];s[-edge:]*=np.linspace(1,0,edge)[:,None]
        i=round(bar*BAR*SR);n=min(len(s),len(mix)-i);mix[i:i+n]+=s[:n]*gain*duck[i:i+n,None]
    # The final half-beat before the end card gives the tag a clean downbeat.
    # A brief musical breath is applied only to the instrumental bed.
    tag=21*BAR;breath=1-.33*np.minimum(np.clip((t-(tag-.17))/.025,0,1),np.clip((tag-t)/.018,0,1))
    mix*=breath[:,None]
    rng=np.random.default_rng(1988)
    room=sosfilt(butter(2,[120,1700],btype='bandpass',fs=SR,output='sos'),rng.normal(0,1,len(t)))
    mix+=room[:,None]*.0012
    for start in [1.5,2.02,2.57,3.11]:
        z=np.arange(round(.09*SR))/SR;v=(np.sin(2*np.pi*90*z)+rng.normal(0,.2,len(z)))*np.exp(-z*60)*.022
        i=round(start*SR);mix[i:i+len(v)]+=v[:,None]
    for local in [1.3,3.2,4.25]:
        z=np.arange(round(.025*SR))/SR
        click=sosfilt(butter(2,[1300,5600],btype='bandpass',fs=SR,output='sos'),rng.normal(0,1,len(z)))*np.exp(-z*150)*.018
        i=round((11*BAR+local)*SR);mix[i:i+len(click)]+=click[:,None]
    for a,b,freq in [(14.5*BAR,15*BAR,220),(18.5*BAR,19*BAR,135)]:
        i=round(a*SR);j=round(b*SR);z=np.arange(j-i)/SR
        env=np.minimum(np.clip(z/.15,0,1),np.clip((b-a-z)/.2,0,1))
        v=np.sin(2*np.pi*freq*z)*.003*env;mix[i:j]+=v[:,None]
    for name,who,start in B.CUES:
        v=B.voices[name].copy();v*=min(.12/max(.001,np.sqrt(np.mean(v*v))),.6/max(.001,np.max(abs(v))))
        i=round(start*SR);mix[i:i+len(v)]+=v[:,None]
    mix[-round(.35*SR):]*=np.linspace(1,0,round(.35*SR))[:,None]
    peak=float(np.max(abs(mix)));mix*=min(1,.88/max(.001,peak))
    wavfile.write(A/'mix.wav',SR,mix)
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(A/'mix.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=8','-ar',str(SR),str(A/'master.wav')],check=True)
    return {'bpm':88,'drumsFromSeconds':0,'loudnessTargetLUFS':-16,'peakBeforeMaster':peak,
            'guitarCues':[{'start':bar*BAR,'variant':variant,'gain':gain}for bar,variant,gain in guitar_cues],
            'speech':[{'line':n,'speaker':who,'start':s,'end':s+len(B.voices[n])/SR}for n,who,s in B.CUES]}

TIMES=[.5,2.3,4.8,6,8,10,11.5,12.4,13.6,14.7,15.8,17.7,19.7,21.2,22.5,23.5,25.6,26.7,28.2,29.7,30.5,31.8,33,34.2,35.1,35.7,36.4,37.3,38.9,40.2,41.2,42.8,44.2,45.8,47,48.3,49.8,51.2,52.7,54,56.5,58.8]

def main():
    frames=[]
    if B.args.stills:
        for t in TIMES:
            f=render(t);frames.append((t,f));cv2.imwrite(str(REVIEW/f'frame-{t:g}.jpg'),f)
    else:
        proof=make_audio();silent=D/'edit-silent.mp4'
        enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','18','-preset','medium','-threads','4','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)],stdin=subprocess.PIPE)
        chosen={round(t*FPS) for t in TIMES}
        for i in range(FRAMES):
            t=i/FPS;f=render(t);enc.stdin.write(f.tobytes())
            if i in chosen:frames.append((t,f.copy()))
            if i%240==0:print(f'Rendered {t:.0f} / {DURATION:.2f} seconds',flush=True)
        enc.stdin.close();assert enc.wait()==0
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(silent),'-i',str(A/'master.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(DURATION),'-movflags','+faststart',str(OUT)],check=True)
        proof.update({'revision':'V4 clean footage and musical energy','duration':DURATION,'width':1280,'height':720,'fps':FPS,'frameCount':FRAMES,
          'shots':[{'start':a,'end':min(b,DURATION),'source':name,'sourceOffset':off}for a,b,name,off in SHOTS],
          'editorialLowerThirds':False,'sourceSpeed':1,'screenGraphics':'V3 tracked laptop preserved; active speaker follows retimed voice',
          'newRunwayCredits':170,'totalProjectCredits':1870,'authorizedMaximumCredits':10000,
          'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'fileSizeBytes':OUT.stat().st_size})
        (D/'edit-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(str(OUT),flush=True)
    sheet=Image.new('RGB',(1280,math.ceil(len(frames)/4)*207),'#171717');d=ImageDraw.Draw(sheet)
    for k,(t,f) in enumerate(frames):
        x=k%4*320;y=k//4*207;sheet.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y+23));d.text((x+8,y+4),f'{t:.2f}s',fill='white')
    sheet.save(REVIEW/'edit-contact.jpg')
    for reader in B.readers.values():reader[0].release()

if __name__=='__main__':main()
