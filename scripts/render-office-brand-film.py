"""Render the 60-second LinkedIn Beats brand opening from approved plates.

Usage: python scripts/render-office-brand-film.py WORKSPACE [--stills]
No model calls. All labels, banner print and robot LEDs are deterministic.
"""
import argparse,json,subprocess,math,hashlib
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
from scipy.io import wavfile
from scipy.signal import butter,sosfilt

ap=argparse.ArgumentParser();ap.add_argument('workspace',type=Path);ap.add_argument('--stills',action='store_true');args=ap.parse_args()
W=args.workspace;R=Path(__file__).resolve().parents[1];D=W/'brand-story';FPS=24;SR=48000;LENGTH=60
CV=R/'public/studio/season/clips';A=D/'audio';OUT=D/'LinkedIn-Beats-Welcome-to-the-Office-720p.mp4'
FONT=R/'public/home-2/fonts/tt-hoves-regular.ttf';BOLD=R/'public/home-2/fonts/tt-hoves-demibold.ttf'
IVORY=(244,240,226);BLUE=(10,76,186);INK=(27,39,52)
tracking=json.loads((R/'src/meeting-room/robot-tracking.json').read_text())
BLINK_TIMES={'synergy':[11.0,47.7],'synthia':[16.7,49.9]}

def font(size,bold=False):return ImageFont.truetype(str(BOLD if bold else FONT),size)
def audio(path,n=2):
    return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ar',str(SR),'-ac',str(n),'-f','f32le','-']),dtype='<f4').reshape(-1,n).copy()
voices={n:audio(A/(n+'.wav'),1)[:,0] for n in ['welcome','describe','humbled','honored','share-m','share-f','linda']}
for name,v in voices.items():
    nz=np.flatnonzero(abs(v)>.005);v=v[max(0,nz[0]-720):min(len(v),nz[-1]+2400)]
    v*=.115/max(.001,np.sqrt(np.mean(v*v)));v[:240]*=np.linspace(0,1,240);v[-240:]*=np.linspace(1,0,240);voices[name]=v
CUES=[('welcome','synergy',9.8),('describe','synergy',12.9),('linda','linda',36.6),('humbled','synergy',46.9),('honored','synthia',49),('share-m','synergy',51),('share-f','synthia',51.03)]

def voice_level(character,t):
    levels=[]
    for name,who,start in CUES:
        if who!=character:continue
        v=voices[name];offset=t-start
        if 0<=offset<len(v)/SR:
            l=max(0,round((offset-.022)*SR));h=min(len(v),round((offset+.022)*SR))
            levels.append(min(1.,np.sqrt(np.mean(v[l:h]**2))/.13))
    return max(levels,default=0.)

def make_audio():
    t=np.arange(SR*LENGTH)/SR;mix=np.zeros((len(t),2),np.float32)
    src=audio(R/'public/studio-2/audio/humbled-music.mp3')
    manifest=json.loads((W/'watercooler/next-clips/music-stem-manifest.json').read_text())
    duck=np.ones(len(t),np.float32)
    for name,who,start in CUES:
        end=start+len(voices[name])/SR
        envelope=np.minimum(np.clip((t-start+.12)/.12,0,1),np.clip((end+.2-t)/.2,0,1))
        duck=np.minimum(duck,1-.64*envelope)
    for name,stem in manifest['stems'].items():
        a=round(stem['start']*SR);n=round(stem['duration']*SR);s=src[a:a+n].copy();n=len(s)
        idx=np.mod(np.round((t-18)*SR).astype(np.int64),n)
        bed=s[idx];rms=np.sqrt(np.mean(bed**2));bed*=.07/max(.001,rms)
        if name=='drums':gain=np.interp(t,[0,1,17.8,18,36.4,36.6,39,39.2,59,60],[.13,.2,.2,1,.85,.35,.35,.85,.9,0])
        elif name=='bass':gain=np.interp(t,[0,5,17.8,18,59,60],[0,.3,.3,.65,.65,0])
        elif name=='keys':gain=np.interp(t,[0,.3,21.3,21.5,59,60],[0,.55,.55,.85,.75,0])
        else:gain=np.interp(t,[0,46.5,47,58.5,60],[0,0,.24,.35,0])
        mix+=bed*(gain*duck)[:,None]
    guitar=audio(R/'public/studio/season/audio/founder-guitar-e8cccb88d883.mp3')
    for start,offset,gain in [(25,0,.6),(28.5,2.72728125,.3),(53.5,5.4545625,.55),(56.227,0,.45)]:
        s=guitar[round(offset*SR):round((offset+2.72728125)*SR)].copy();s*=.06/max(.001,np.sqrt(np.mean(s*s)))
        i=round(start*SR);mix[i:i+len(s)]+=s*gain*duck[i:i+len(s),None]
    # Quiet continuous room tone and small physical sounds; no cinematic risers.
    rng=np.random.default_rng(1975);noise=rng.normal(0,1,len(t))
    room=sosfilt(butter(2,[120,1800],btype='bandpass',fs=SR,output='sos'),noise)
    mix+=room[:,None]*.0015
    def tick(start,dur=.075,freq=310,gain=.015):
        z=np.arange(round(dur*SR))/SR
        sound=(np.sin(2*np.pi*freq*z)*.7+rng.normal(0,.2,len(z)))*np.exp(-z*60)*gain
        i=round(start*SR);mix[i:i+len(sound)]+=sound[:,None]
    for start in [.3,.84,1.38,1.92,2.46,3,3.54]:tick(start,.1,95,.028)
    tick(4,.1,790,.035);tick(17.96,.08,1100,.025)
    # The printer and cart get restrained motor texture instead of dialogue.
    for start,end,freq in [(39,43,220),(43,46.5,135)]:
        a=round(start*SR);b=round(end*SR);z=np.arange(b-a)/SR
        env=np.minimum(np.clip(z/.18,0,1),np.clip((end-start-z)/.25,0,1))
        motor=(np.sin(2*np.pi*freq*z)+.25*np.sin(2*np.pi*freq*2.03*z))*.003*env
        mix[a:b]+=motor[:,None]
    for name,who,start in CUES:
        v=voices[name].copy();gain=.72 if name.startswith('share') else 1
        pan=-.16 if who=='synergy' else .16 if who=='synthia' else 0
        stereo=np.column_stack([v*(1-pan),v*(1+pan)])*gain
        i=round(start*SR);mix[i:i+len(v)]+=stereo
    mix[-round(.4*SR):]*=np.linspace(1,0,round(.4*SR))[:,None]
    peak=np.max(abs(mix));mix*=min(1.,.9/max(.001,peak))
    assert np.max(abs(mix))<.98
    wavfile.write(A/'mix.wav',SR,mix)
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(A/'mix.wav'),'-af','loudnorm=I=-18:TP=-1.5:LRA=8','-ar',str(SR),str(A/'master.wav')],check=True)
    return {'peakBeforeMaster':float(peak),'speech':[{'character':who,'line':n,'start':s,'end':s+len(voices[n])/SR}for n,who,s in CUES]}

SOURCES={
 'arrival':D/'raw/arrival.mp4','banner':D/'raw/banner.mp4','measure':D/'raw/measure.mp4','ensemble':D/'raw/ensemble.mp4',
 'synergy':CV/'synergy-camera-v2-listening.mp4','synthia':CV/'synthia-camera-v2-listening.mp4',
 'drums':CV/'drums-playing.mp4','keys':CV/'keys-full-playing.mp4','guitar':CV/'guitar-playing.mp4',
 'people':CV/'people-listening.mp4','strategy':CV/'strategy-listening.mp4','arjun':CV/'arjun-listening.mp4',
 'linda':CV/'linda-listening.mp4','printer':CV/'printer-printing.mp4','droid':W/'watercooler/closing/departure.mp4'}
readers={}
def frame(name,time):
    if name not in readers:
        c=cv2.VideoCapture(str(SOURCES[name]));readers[name]=[c,-2,None,c.get(cv2.CAP_PROP_FPS),int(c.get(cv2.CAP_PROP_FRAME_COUNT))]
    r=readers[name];c,last,f,fps,total=r;j=min(total-1,max(0,round(time*fps)))
    if last!=j:
        if j!=last+1:c.set(cv2.CAP_PROP_POS_FRAMES,j)
        ok,f=c.read();assert ok,(name,j,total)
        f=cv2.resize(f,(1280,720),interpolation=cv2.INTER_AREA);r[1]=j;r[2]=f
    return r[2].copy(),j

def transform_robot(f,character,j,t):
    values=tracking[character]['frames'];x,y,a,s=values[min(j,len(values)-1)]
    level=voice_level(character,t);phase=(t*15)%22
    # Draw in 4x resolution locally. Height NEVER depends on voice envelope.
    light=np.zeros((100*4,160*4,3),np.float32)
    for k in range(22):
        distance=(phase-k+22)%22;strength=float(.07+(max(0,1-distance/8)*(.35+.65*level) if level>.05 else 0))
        cv2.rectangle(light,(round((80-46+k*4.3)*4),47*4),(round((80-46+k*4.3+3.2)*4),53*4),(95*strength,247*strength,78*strength),-1)
    light=cv2.resize(light,(160,100),interpolation=cv2.INTER_AREA)
    light+=cv2.GaussianBlur(light,(3,3),.55)*.15
    M=np.array([[s*math.cos(a),-s*math.sin(a),x],[s*math.sin(a),s*math.cos(a),y]],np.float32)
    M[:,2]-=M[:,:2]@np.array([80,50])
    f=np.clip(f.astype(float)+cv2.warpAffine(light,M,(1280,720)),0,255).astype(np.uint8)
    # An occasional blink, restricted to the original square eye pixels.
    times=BLINK_TIMES[character]
    blink=max([max(0,1-abs(t-(b+.12))/.12) for b in times])
    if blink>.02:
        ref=values[0];a0=ref[2];s0=ref[3]
        eyes=[(588.67,207.33),(656.22,202.19)] if character=='synergy' else [(627.78,203.16),(697.12,197.83)]
        for ex,ey in eyes:
            v=np.array([ex-ref[0],ey-ref[1]])/s0
            v=np.array([[math.cos(-a0),-math.sin(-a0)],[math.sin(-a0),math.cos(-a0)]])@v
            v=np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])@v*s+np.array([x,y])
            cx,cy=np.rint(v).astype(int);x1,x2=cx-12,cx+13;y1,y2=cy-12,cy+13
            patch=f[y1:y2,x1:x2].copy();green=(patch[:,:,1]>90)&(patch[:,:,1]>patch[:,:,0]*1.4)&(patch[:,:,1]>patch[:,:,2]*1.4)
            mask=np.zeros((25,25),np.uint8);mask[1:24,1:24]=255
            plate=cv2.inpaint(patch,mask,3,cv2.INPAINT_TELEA)
            eye=np.maximum(0,patch.astype(float)-plate);h=max(2,round(25*(1-blink*.92)));small=cv2.resize(eye,(25,h),interpolation=cv2.INTER_AREA)
            plate=plate.astype(float);yy=(25-h)//2;plate[yy:yy+h]+=small;f[y1:y2,x1:x2]=np.clip(plate,0,255)
    return f

def center(draw,txt,y,ft,fill,width):
    box=draw.textbbox((0,0),txt,font=ft);draw.text(((width-(box[2]-box[0]))/2,y),txt,font=ft,fill=fill,stroke_width=0)
def banner_print(kind):
    im=Image.new('RGBA',(600,1200));d=ImageDraw.Draw(im)
    if kind=='main':
        center(d,'in',105,font(160,True),(255,255,255,235),600)
        for txt,y in [('BRING YOUR',480),('WHOLE SELF',565),('TO WORK.',650)]:center(d,txt,y,font(73,True),'white',600)
        d.line((78,944,522,944),fill=(255,255,255,110),width=2)
        center(d,'LINKEDIN BEATS',1003,font(33,True),(255,255,255,235),600)
    else:
        center(d,'in',72,font(125,True),(255,255,255,235),600)
        for txt,y in [('AUTHENTICITY',332),('STARTS',405),('HERE.',478)]:center(d,txt,y,font(57,True),'white',600)
        center(d,'LINKEDIN BEATS',1040,font(28,True),(255,255,255,230),600)
    return np.array(im)
PRINT={k:banner_print(k) for k in ['main','auth']}
QUADS={
 'banner': [('main',[[523,61],[789,59],[792,610],[521,611]]),('auth',[[233,87],[410,87],[413,484],[229,484]]),('auth',[[915,86],[1101,82],[1100,486],[918,486]])],
 'measure':[('auth',[[-15,-10],[322,32],[319,860],[-15,820]]),('auth',[[450,57],[678,84],[678,840],[448,815]])],
}
motion={}
def banner_motion(name):
    # Track the locked set, ignoring the two moving installers and instruments.
    path=D/'review'/f'{name}-motion.npy'
    if path.exists():return np.load(path)
    cap=cv2.VideoCapture(str(SOURCES[name]));frames=[]
    while True:
        ok,f=cap.read()
        if not ok:break
        frames.append(cv2.cvtColor(cv2.resize(f,(1280,720)),cv2.COLOR_BGR2GRAY))
    cap.release();ref=frames[0];mask=np.zeros_like(ref)
    mask[:48]=255;mask[450:,0:210]=255;mask[440:,1120:]=255
    if name=='banner':mask[40:650,512:530]=255;mask[40:650,785:800]=255
    elif name=='ensemble':mask[:48]=255;mask[48:95,400:750]=255
    else:mask[:,314:332]=255;mask[50:,430:451]=255
    pts=cv2.goodFeaturesToTrack(ref,250,.008,5,mask=mask)
    transforms=[]
    for f in frames:
        q,st,err=cv2.calcOpticalFlowPyrLK(ref,f,pts,None,winSize=(21,21),maxLevel=3)
        valid=st.ravel().astype(bool)&(err.ravel()<15)
        mat,ins=cv2.estimateAffinePartial2D(pts[valid],q[valid],method=cv2.RANSAC,ransacReprojThreshold=2)
        if mat is None:mat=np.array([[1,0,0],[0,1,0]],float)
        # The intentional reverse angle in measure is excluded from this edit.
        if abs(mat[0,2])>15 or abs(mat[1,2])>15:mat=np.array([[1,0,0],[0,1,0]],float)
        transforms.append(mat)
    tr=np.array(transforms)
    from scipy.signal import savgol_filter
    tr=savgol_filter(tr,13,2,axis=0);np.save(path,tr);return tr

def overlay_print(f,rgba,quad):
    h,w=rgba.shape[:2];H=cv2.getPerspectiveTransform(np.float32([[0,0],[w,0],[w,h],[0,h]]),np.float32(quad))
    ink=cv2.warpPerspective(rgba,H,(1280,720),flags=cv2.INTER_LINEAR)
    hsv=cv2.cvtColor(f,cv2.COLOR_BGR2HSV)
    blue=((hsv[:,:,0]>96)&(hsv[:,:,0]<126)&(hsv[:,:,1]>145)&(hsv[:,:,2]>110)).astype(np.float32)
    blue=cv2.GaussianBlur(blue,(3,3),.5)
    alpha=ink[:,:,3]/255*blue
    luminance=np.clip(hsv[:,:,2]/210,.68,1)*.98
    paper=ink[:,:,:3][:,:,::-1].astype(float)*luminance[:,:,None]
    return np.clip(f*(1-alpha[:,:,None])+paper*alpha[:,:,None],0,255).astype(np.uint8)

def banner_frame(name,f,j):
    if name not in motion:motion[name]=banner_motion(name)
    M=motion[name][min(j,len(motion[name])-1)]
    for kind,quad in QUADS[name]:
        q=cv2.transform(np.float32(quad)[None],M)[0];f=overlay_print(f,PRINT[kind],q)
    return f

def ensemble_print(f,j):
    if 'ensemble' not in motion:motion['ensemble']=banner_motion('ensemble')
    M=motion['ensemble'][min(j,len(motion['ensemble'])-1)]
    specs=[((680,300),[[406,48],[744,48],[744,197],[406,197]],['SOUND LIKE YOU','MEAN BUSINESS.'],52,12,62),
           ((300,470),[[168,42],[319,43],[320,279],[168,279]],['HUMBLED.','HONORED.'],32,24,45),
           ((300,470),[[794,53],[882,53],[882,200],[794,200]],['LET’S','DELVE.'],39,26,52),
           ((400,500),[[1007,28],[1218,6],[1219,270],[1008,293]],['EXCITED','TO SHARE.'],45,35,56)]
    for size,quad,lines,fs,y,leading in specs:
        im=Image.new('RGBA',size);d=ImageDraw.Draw(im)
        for k,line in enumerate(lines):center(d,line,y+k*leading,font(fs,True),(255,255,255,245),size[0])
        f=overlay_print(f,np.array(im),cv2.transform(np.float32(quad)[None],M)[0])
    return f

CROPS={'synergy':(97,0,1153,680),'synthia':(132,0,1146,680),'drums':(132,0,1146,680),'keys':(160,0,1120,656),'guitar':(0,22,1280,680),'people':(132,0,1146,680),'strategy':(132,0,1146,680),'arjun':(168,0,1114,680),'linda':(164,0,1111,680),'printer':(0,0,1280,680)}
NAMES={'synergy':('Synergy','Management'),'synthia':('Synthia','Professional development'),'drums':('Operations','Percussion'),'keys':('Keys','Enablement'),'guitar':('Kevin','Partnerships'),'people':('People &','Culture'),'strategy':('Strategy','Forward thinking'),'arjun':('Arjun','Finance'),'linda':('Linda','Institutional memory')}
cards={}
def cast_card(name,f,t,number):
    if name not in cards:
        im=Image.new('RGB',(1280,720),IVORY);d=ImageDraw.Draw(im)
        d.text((44,44),'LINKEDIN BEATS',font=font(20,True),fill=BLUE)
        d.line((44,95,355,95),fill=BLUE,width=2)
        title,role=NAMES[name];size=56 if len(title)<10 else 46
        d.text((44,273),title,font=font(size,True),fill=BLUE)
        d.text((46,347),role,font=font(23),fill=INK)
        d.text((46,611),f'{number:02d}',font=font(24,True),fill=BLUE)
        d.text((46,647),'WELCOME TO THE OFFICE',font=font(13,True),fill=INK)
        cards[name]=np.array(im)[:,:,::-1].copy()
    out=cards[name].copy();x0,y0,x1,y1=CROPS[name];crop=f[y0:y1,x0:x1];h,w=crop.shape[:2]
    # Fit every full instrument / badge inside the photograph, no arbitrary crop.
    scale=min(812/w,604/h);nw,nh=round(w*scale),round(h*scale);x=424+(812-nw)//2;y=58+(604-nh)//2
    out[y+7:y+nh+7,x+7:x+nw+7]=np.array(BLUE[::-1],np.uint8)
    out[y:y+nh,x:x+nw]=cv2.resize(crop,(nw,nh),interpolation=cv2.INTER_AREA)
    return out

def label(f,title,subtitle='',side='left'):
    im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).convert('RGBA');p=Image.new('RGBA',im.size);d=ImageDraw.Draw(p)
    # Brief typographic introductions are separate from the physical set print.
    x=48;d.text((x,557),title,font=font(48,True),fill='white',stroke_width=1,stroke_fill=(0,0,0,50))
    if subtitle:d.text((x,618),subtitle,font=font(22),fill='white',stroke_width=1,stroke_fill=(0,0,0,50))
    im.alpha_composite(p);return cv2.cvtColor(np.array(im.convert('RGB')),cv2.COLOR_RGB2BGR)

def object_credit(f,title,subtitle):
    im=Image.new('RGB',(1280,720),IVORY);d=ImageDraw.Draw(im)
    im.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((1152,648)),(64,0))
    d.text((64,666),title,font=font(26,True),fill=BLUE)
    d.text((700,670),subtitle,font=font(20),fill=INK)
    return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)

def duet(t):
    out=np.full((720,1280,3),IVORY[::-1],np.uint8)
    for i,name in enumerate(['synergy','synthia']):
        f,j=frame(name,6+(t-50.5));f=transform_robot(f,name,j,t);x0,y0,x1,y1=CROPS[name];crop=f[y0:y1,x0:x1]
        resized=cv2.resize(crop,(584,394),interpolation=cv2.INTER_AREA);out[139:533,40+i*616:624+i*616]=resized
    im=Image.fromarray(cv2.cvtColor(out,cv2.COLOR_BGR2RGB));d=ImageDraw.Draw(im)
    center(d,'HUMBLED. HONORED.',42,font(26,True),BLUE,1280)
    center(d,'Excited to share.',581,font(55,True),BLUE,1280)
    return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)

def endcard():
    im=Image.new('RGB',(1280,720),BLUE);d=ImageDraw.Draw(im)
    center(d,'LINKEDIN BEATS',230,font(87,True),IVORY,1280)
    center(d,'Sound like you mean business.',351,font(37),IVORY,1280)
    center(d,'linkedinbeats.com',581,font(23),IVORY,1280)
    return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)
END=endcard()
TIMELINE=[(0,4,'arrival',0,1),(4,9.5,'banner',2.5,1),(9.5,15.5,'synergy',.8,1),(15.5,18,'synthia',1,1),(18,21.5,'drums',1,1),(21.5,25,'keys',1,1),(25,28.5,'guitar',.25,1),(28.5,30.5,'people',1,1),(30.5,32.5,'strategy',.3,1),(32.5,34.5,'arjun',1,1),(34.5,36.5,'linda',1,1),(36.5,39,'measure',0,.88),(39,43,'printer',0,1),(43,46.5,'droid',2.2,1),(46.5,48.5,'synergy',9,1),(48.5,50.5,'synthia',9,1),(50.5,53.5,'duet',0,1),(53.5,58,'ensemble',.5,1),(58,60,'end',0,1)]
def render(t):
    a,b,name,offset,rate=next(s for s in TIMELINE if s[0]<=t<s[1])
    if name=='end':return END.copy()
    if name=='duet':return duet(t)
    f,j=frame(name,offset+(t-a)*rate)
    if name in ['synergy','synthia']:f=transform_robot(f,name,j,t)
    if name in NAMES:
        number=list(NAMES).index(name)+1
        if t>=46.5:
            x0,y0,x1,y1=CROPS[name];crop=f[y0:y1,x0:x1]
            # Return to full photographic closeups for the call and response.
            f=cv2.resize(crop,(1110,720));canvas=np.full((720,1280,3),IVORY[::-1],np.uint8);canvas[:,85:1195]=f
            return canvas
        return cast_card(name,f,t,number)
    if name in ['banner','measure']:f=banner_frame(name,f,j)
    if name=='ensemble':f=ensemble_print(f,j)
    if name=='arrival' and t>.4:
        f=label(f,'Welcome to the office.','A LinkedIn Beats picture')
    if name=='printer':
        f=cv2.resize(f[:680],(1280,720));f=object_credit(f,'Workflow Automation','Printing the future. Again.')
    if name=='droid':f=object_credit(f,'Delivery','Moving the conversation forward.')
    return f

def main():
    review_times=[1,5.5,10.5,11.125,14,16.83,19,23,26,29.3,31.3,33.3,35.3,37.5,39.8,44.5,47.2,49.3,51.5,54.5,58,59]
    reviews=[]
    if args.stills:
        for t in review_times:
            f=render(t);cv2.imwrite(str(D/'review'/f'edit-{t:g}.jpg'),f);reviews.append((t,f))
    else:
        proof=make_audio();silent=D/'edit-silent.mp4'
        enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)],stdin=subprocess.PIPE)
        review_frames={round(t*FPS) for t in review_times}
        for i in range(FPS*LENGTH):
            f=render(i/FPS);enc.stdin.write(f.tobytes())
            if i in review_frames:reviews.append((i/FPS,f.copy()))
            if i%240==0:print(f'Rendered {i/FPS:.0f} / {LENGTH} seconds',flush=True)
        enc.stdin.close();assert enc.wait()==0
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(silent),'-i',str(A/'master.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(LENGTH),'-movflags','+faststart',str(OUT)],check=True)
        proof.update({'resolution':[1280,720],'fps':FPS,'duration':LENGTH,'shots':TIMELINE,'credits':680,'mouth':'22 fixed-height LEDs, brightness scrolling left to right, tracked to the approved face','sha256':hashlib.sha256(OUT.read_bytes()).hexdigest()})
        (D/'edit-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(str(OUT),flush=True)
    sheet=Image.new('RGB',(1280,math.ceil(len(reviews)/4)*207),'#171717');d=ImageDraw.Draw(sheet)
    for k,(t,f) in enumerate(reviews):
        x=k%4*320;y=k//4*207;sheet.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y+23));d.text((x+8,y+5),f'{t:.2f}s',fill='white')
    sheet.save(D/'review/edit-contact.jpg')
    for r in readers.values():r[0].release()

if __name__=='__main__':main()
