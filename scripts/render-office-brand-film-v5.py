"""V5: correct screen occlusion, outward printing, clean Synthia, office applause.

python scripts/render-office-brand-film-v5.py WORKSPACE [--stills]
Requires the retained V4 master and five V5 source takes. Interfaces reuse the
approved renderer; every remaining picture and the musical timing stays in V4.
"""
import importlib.util,json,math,subprocess,hashlib
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw
from scipy.signal import savgol_filter,butter,sosfilt
from scipy.io import wavfile

spec=importlib.util.spec_from_file_location('screen_v3',Path(__file__).with_name('render-office-brand-film-v3.py'))
S=importlib.util.module_from_spec(spec);spec.loader.exec_module(S)
B=S.B;V=S.V;W=B.W;R=B.R
D=W/'brand-story/v5';REVIEW=D/'review';A=D/'audio'
for p in [D,REVIEW,A]:p.mkdir(exist_ok=True,parents=True)
BAR=240/88;FPS=24;SR=48000;LENGTH=60
BASE=D/'source/LinkedIn-Beats-Welcome-to-the-Office-720p.mp4'
OUT=D/'LinkedIn-Beats-Welcome-to-the-Office-720p.mp4'
SOURCES={'base':BASE,**{n:D/'raw'/f'{n}.mp4' for n in ['laptop','printer','synthia','celebration_wide','applause_close']}}
READERS={};TRACKS={};QA={}
B.CUES=[('humbled-phrase','synergy',4.5*BAR+.15),('describe','synergy',6.5*BAR+.15),('circle-phrase','synthia',8.5*BAR+.15),('onboarding-phrase','synergy',15*BAR+.15),('optimized','synthia',16*BAR+.25),('tagline','synthia',21*BAR+.25)]
B.BLINK_TIMES={'synergy':[7*BAR+.85],'synthia':[16*BAR+.9]}
B.SOURCES['zoom-1']=SOURCES['synthia'];B.SOURCES['zoom-8']=SOURCES['printer']

def frame(name,t):
    if name not in READERS:
        c=cv2.VideoCapture(str(SOURCES[name]));assert c.isOpened(),str(SOURCES[name])
        READERS[name]=[c,-1,None,c.get(cv2.CAP_PROP_FPS),int(c.get(cv2.CAP_PROP_FRAME_COUNT))]
    c,last,f,fps,total=READERS[name];j=min(total-1,max(0,round(t*fps)))
    if last!=j:
        if j!=last+1:c.set(cv2.CAP_PROP_POS_FRAMES,j)
        ok,f=c.read();assert ok,(name,j)
        f=cv2.resize(f,(1280,720),interpolation=cv2.INTER_AREA);READERS[name][1:3]=[j,f]
    return f.copy(),j

# Coordinates strictly inside physical glass, with bezel left untouched.
QUADS={'laptop':np.float32([[348,87],[1220,83],[1217,544],[325,525]]),
       'synthia':np.float32([[589,180],[758,144],[768,272],[600,287]])}

def build_track(name):
    cache=REVIEW/f'{name}-tracking.npy'
    if cache.exists():TRACKS[name]=np.load(cache);return
    cap=cv2.VideoCapture(str(SOURCES[name]));ok,f=cap.read();assert ok
    f=cv2.resize(f,(1280,720));g0=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY);q=QUADS[name]
    fill=np.zeros((720,1280),np.uint8);cv2.fillConvexPoly(fill,q.astype(int),255)
    # Only fixed bezel/metal features, never the LEDs or typing fingers.
    ring=cv2.dilate(fill,np.ones((27,27),np.uint8))-cv2.erode(fill,np.ones((7,7),np.uint8))
    if name=='laptop':ring[490:]=0
    pts=cv2.goodFeaturesToTrack(g0,150,.006,5,mask=ring)
    assert pts is not None and len(pts)>=5,(name,'insufficient rigid features')
    positions=[q.copy()];errors=[];failures=[];i=1
    while True:
        ok,f=cap.read()
        if not ok:break
        gray=cv2.cvtColor(cv2.resize(f,(1280,720)),cv2.COLOR_BGR2GRAY)
        p1,st,err=cv2.calcOpticalFlowPyrLK(g0,gray,pts,None,winSize=(35,35),maxLevel=4,criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,45,.005))
        good=(st.ravel()==1)&(err.ravel()<22)
        H=None
        if good.sum()>=6:
            if name=='laptop':
                M,inliers=cv2.estimateAffinePartial2D(pts[good],p1[good],method=cv2.RANSAC,ransacReprojThreshold=1.3)
                if M is not None:H=np.vstack([M,[0,0,1]])
            else:
                H,inliers=cv2.findHomography(pts[good],p1[good],cv2.RANSAC,1.3)
        if H is None:positions.append(positions[-1]);failures.append(i)
        else:
            out=cv2.perspectiveTransform(q[None],H)[0]
            if np.max(np.linalg.norm(out-q,axis=1))>70:positions.append(positions[-1]);failures.append(i)
            else:
                positions.append(out)
                pred=cv2.perspectiveTransform(pts[good],H)
                errors.append(float(np.median(np.linalg.norm(pred-p1[good],axis=2))))
        i+=1
    cap.release();track=np.float32(positions)
    track=savgol_filter(track,7,2,axis=0).astype(np.float32)
    TRACKS[name]=track;np.save(cache,track)
    QA[name]={'frames':len(track),'rigidFeatures':len(pts),'fallbackFrames':failures,'medianReprojectionError':float(np.median(errors)),'maximumDisplacement':float(np.max(np.linalg.norm(track-q,axis=2)))}
    (REVIEW/f'{name}-tracking-qa.json').write_text(json.dumps(QA[name],indent=2)+'\n')

def quad(name,j):
    if name not in TRACKS:build_track(name)
    return TRACKS[name][min(j,len(TRACKS[name])-1)]

def perspective(f,canvas,q,occlusion=None):
    h,w=canvas.shape[:2];src=np.float32([[0,0],[w-1,0],[w-1,h-1],[0,h-1]])
    H=cv2.getPerspectiveTransform(src,q)
    overlay=cv2.warpPerspective(canvas,H,(1280,720),flags=cv2.INTER_LINEAR)
    mask=cv2.warpPerspective(np.ones((h,w),np.float32),H,(1280,720))
    if occlusion is not None:mask*=1-occlusion
    out=f.astype(np.float32)*(1-mask[:,:,None])+overlay.astype(np.float32)*mask[:,:,None]
    return np.clip(out,0,255).astype(np.uint8)

def hand_matte(f,q):
    # Original hands are a foreground holdout. Bright ivory and metallic edges
    # against the blank charcoal screen yield a stable source-derived matte.
    gray=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY)
    roi=np.zeros((720,1280),np.uint8);cv2.fillConvexPoly(roi,q.astype(int),255);roi[:430]=0
    bright=((gray>64)&(roi>0)).astype(np.uint8)*255
    bright=cv2.morphologyEx(bright,cv2.MORPH_CLOSE,np.ones((11,11),np.uint8))
    contours,_=cv2.findContours(bright,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    holdout=np.zeros_like(bright)
    for c in contours:
        if cv2.contourArea(c)>12:
            cv2.drawContours(holdout,[cv2.convexHull(c)],-1,255,-1)
    holdout=cv2.dilate(holdout,np.ones((5,5),np.uint8))
    return cv2.GaussianBlur(holdout,(3,3),.5).astype(np.float32)/255

def laptop(mode,local,t,offset):
    f,j=frame('laptop',offset+local);q=quad('laptop',j)
    ui=S.zoom_ui(local,t) if mode=='zoom' else S.gpt_ui(local,t)
    ui=np.clip(ui.astype(np.float32)*.91+4,0,255).astype(np.uint8)
    holdout=hand_matte(f,q)
    return perspective(f,ui,q,holdout)

def synthia_face(f,j,t):
    q=quad('synthia',j);w,h=360,260
    # Stable face animation is composited only inside the real glass. The mouth
    # has six pixels of fixed height in face space, independent of amplitude.
    canvas=np.zeros((h,w,3),np.float32);canvas[:]=[3,5,3]
    blink=max(0,1-abs(t-(16*BAR+.91))/.10)
    eye_strength=1-blink*.93
    for cx in [101,256]:
        for row in range(4):
            for col in range(4):
                x=cx-12+col*7;y=133-12+row*7
                cv2.rectangle(canvas,(x,y),(x+4,y+4),(43*eye_strength,219*eye_strength,54*eye_strength),-1)
    level=B.voice_level('synthia',t);phase=(t*24)%28
    for k in range(28):
        distance=(phase-k+28)%28
        strength=float(.12+(max(0,1-distance/10)*(.34+.66*level) if level>.03 else 0))
        x=82+k*7
        cv2.rectangle(canvas,(x,211),(x+4,216),(48*strength,250*strength,62*strength),-1)
    glow=cv2.GaussianBlur(canvas,(7,7),1.1)*.12
    canvas=np.clip(canvas+glow,0,255).astype(np.uint8)
    return perspective(f,canvas,q)

original_robot=B.transform_robot
def robot_dispatch(f,character,j,t):
    return synthia_face(f,j,t) if character=='synthia' else original_robot(f,character,j,t)
B.transform_robot=robot_dispatch

# The same 60 seconds and spoken-word timing. Printer gets a complete bar so
# the leading/trailing edges can clear the slot visibly. Three applause angles.
REPLACEMENTS=[
 (0,.5*BAR,'camcorder',.3),
 (5.5*BAR,7*BAR,'zoom',1.5),
 (9.5*BAR,11*BAR,'chatgpt',5.5),
 (14*BAR,15*BAR,'printer',3.4),
 (16*BAR,16.5*BAR,'synthia',.15),
 (19*BAR,19.5*BAR,'applause-wide',4.1),
 (19.5*BAR,20.5*BAR,'applause-close',1.1),
 (20.5*BAR,21*BAR,'synergy-reaction',5.1),
]

def render(t):
    for a,b,name,offset in REPLACEMENTS:
        if not a<=t<b:continue
        local=t-a
        if name in ['zoom','chatgpt']:return laptop(name,local,t,offset)
        if name=='synthia':
            f,j=frame(name,offset+local);return synthia_face(f,j,t)
        if name in ['camcorder','applause-wide']:return frame('celebration_wide',offset+local)[0]
        if name=='applause-close':return frame('applause_close',offset+local)[0]
        if name=='synergy-reaction':
            f,j=frame('applause_close',offset+local)
            return V.cover_crop(f,(3,0,731,409))
        return frame(name,offset+local)[0]
    return frame('base',t)[0]

def make_audio():
    mix=B.audio(BASE);mix=mix[:LENGTH*SR].copy();rng=np.random.default_rng(1995)
    # Four individual, modest clappers; small stochastic differences prevent
    # the applause from becoming another identical electronic drum pattern.
    def claps(a,b,gain):
        for person in range(4):
            step=.51+person*.037;pan=-.65+person*.43
            for start in np.arange(a+person*.087,b-.12,step):
                start+=rng.uniform(-.035,.035);z=np.arange(round(.17*SR))/SR
                burst=sosfilt(butter(2,[500,6200],btype='bandpass',fs=SR,output='sos'),rng.normal(0,1,len(z)))
                env=(1-np.exp(-z*2800))*np.exp(-z*(65+rng.uniform(-10,10)))
                dry=burst*env
                room=np.zeros_like(dry)
                for delay,g in [(.026,.23),(.049,.15),(.081,.07)]:
                    n=round(delay*SR);room[n:]+=dry[:-n]*g
                sound=(dry+room)*gain*rng.uniform(.7,1.2)
                i=max(0,round(start*SR));n=min(len(sound),len(mix)-i)
                mix[i:i+n]+=np.column_stack([sound[:n]*(1-pan*.35),sound[:n]*(1+pan*.35)])
    claps(.05,1.3,.021);claps(19*BAR,21*BAR-.08,.025)
    # Quiet camcorder start/transport texture under opening music.
    z=np.arange(round(.055*SR))/SR;tick=rng.normal(0,1,len(z))*np.exp(-z*130)*.012
    i=round(.06*SR);mix[i:i+len(tick)]+=tick[:,None]
    wavfile.write(A/'mix.wav',SR,mix)
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(A/'mix.wav'),'-af','loudnorm=I=-16:TP=-1.5:LRA=8','-ar',str(SR),str(A/'master.wav')],check=True)
    return {'source':'Approved V4 music, speech and effects; timing unchanged','additionalFoley':'quiet four-person applause and camcorder start','targetLUFS':-16,'targetTruePeak':-1.5,'sampleRate':SR,'channels':2}

TIMES=[.35,1,3,8,10,13.5,15.15,16,17.5,18.8,19.8,24,26.2,27.5,29.4,31.5,33.7,36,37.8,38.3,39,39.6,40.5,42,43.8,44.1,44.5,44.9,46,49,51,52.3,53.5,54.5,55.6,56.2,57,58.8]

def main():
    build_track('laptop');build_track('synthia');frames=[]
    if B.args.stills:
        for t in TIMES:
            f=render(t);frames.append((t,f));cv2.imwrite(str(REVIEW/f'frame-{t:g}.jpg'),f)
    else:
        audio=make_audio();silent=D/'edit-silent.mp4'
        enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','18','-preset','medium','-threads','4','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)],stdin=subprocess.PIPE)
        chosen={round(t*FPS) for t in TIMES}
        for i in range(FPS*LENGTH):
            t=i/FPS;f=render(t);enc.stdin.write(f.tobytes())
            if i in chosen:frames.append((t,f.copy()));cv2.imwrite(str(REVIEW/f'frame-{t:g}.jpg'),f)
            if i%240==0:print(f'Rendered {t:.0f} / 60 seconds',flush=True)
        enc.stdin.close();assert enc.wait()==0
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(silent),'-i',str(A/'master.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t','60','-movflags','+faststart',str(OUT)],check=True)
        proof={'revision':'V5 outward printing, foreground-safe laptop, clean Synthia, corporate applause','duration':LENGTH,'width':1280,'height':720,'fps':FPS,'frameCount':FPS*LENGTH,'replacements':REPLACEMENTS,'audio':audio,'newRunwayCredits':850,'totalProjectCredits':2720,'authorizedMaximumCredits':10000,'sourceSpeed':1,'editorialLowerThirds':False,'robotMouth':'28 LEDs, fixed six-pixel height in face coordinates; brightness moves horizontally left to right','screenOcclusion':'source-derived foreground holdout for physical fingers and knuckles','sha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'fileSizeBytes':OUT.stat().st_size}
        (D/'edit-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(str(OUT),flush=True)
    sheet=Image.new('RGB',(1280,math.ceil(len(frames)/4)*205),'#151515');draw=ImageDraw.Draw(sheet)
    for k,(t,f) in enumerate(frames):
        x=k%4*320;y=k//4*205;sheet.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y));draw.text((x+8,y+184),f'{t:.2f}s',fill='white')
    sheet.save(REVIEW/'v5-contact.jpg')

if __name__=='__main__':main()
