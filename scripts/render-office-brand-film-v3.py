"""Add a joining meeting and ChatGPT writing session to the approved 60s cut.

python scripts/render-office-brand-film-v3.py WORKSPACE [--stills]
Screen graphics are composited onto a tracked, stationary physical display.
"""
import importlib.util,json,math,subprocess,hashlib
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw
from scipy.signal import savgol_filter

spec=importlib.util.spec_from_file_location('brand_v2',Path(__file__).with_name('render-office-brand-film-v2.py'))
V=importlib.util.module_from_spec(spec);spec.loader.exec_module(V)
B=V.B;W=V.W;R=V.R;D=W/'brand-story/v3';REVIEW=D/'review';REVIEW.mkdir(parents=True,exist_ok=True)
BAR=V.BAR;FPS=24;LENGTH=60;SW,SH=1200,760
OUT=D/'LinkedIn-Beats-Welcome-to-the-Office-720p.mp4'
PLATE=D/'raw/synergy-laptop.mp4'
STILL=W/'generated_images/exec-48b1441a-9429-4ccc-a074-a5b8baf8574c.png'
QUAD=np.float32([[616,168],[1186,174],[1155,552],[579,489]])
SOURCE=np.float32([[0,0],[SW-1,0],[SW-1,SH-1],[0,SH-1]])
B.SOURCES['laptop']=PLATE
CAST=[('Synergy','synergy-camera-v2-listening.mp4','synergy'),('Synthia','synthia-camera-v2-listening.mp4','synthia'),('People & Culture','people-listening.mp4',None),('Kevin','guitar-listening.mp4',None),('Keys','keys-full-listening.mp4',None),('Operations','drums-listening.mp4',None),('Arjun','arjun-listening.mp4',None),('Linda','linda-listening.mp4',None),('Workflow Automation','printer-printing.mp4',None)]
for i,(name,file,robot) in enumerate(CAST):B.SOURCES[f'zoom-{i}']=R/'public/studio/season/clips'/file
ZOOM_START=7*BAR;ZOOM_END=8.5*BAR
GPT_START=12.5*BAR;GPT_END=14*BAR

# These replacement intervals preserve every musical and phrase cue.
REPLACEMENTS=[
 (ZOOM_START,ZOOM_END,'laptop-zoom',.4),
 (ZOOM_END,9*BAR,'synergy',2.364),
 (GPT_START,GPT_END,'laptop-chatgpt',5.),
 (GPT_END,14.5*BAR,'printer',1.614),
 (18*BAR,18.5*BAR,'droid',2.2),
 (18.5*BAR,19*BAR,'banner',5.)
]

def txt(d,xy,s,size=24,color='#eeeeee',bold=False):d.text(xy,s,font=B.font(size,bold),fill=color)
def rr(d,box,rad=12,fill=None,outline=None,width=1):d.rounded_rectangle(box,rad,fill,outline,width)
def microphone(d,x,y,size=20,color='white',muted=False):
    d.rounded_rectangle((x-size*.18,y-size*.43,x+size*.18,y+size*.12),radius=size*.16,outline=color,width=2)
    d.arc((x-size*.31,y-size*.1,x+size*.31,y+size*.4),0,180,fill=color,width=2)
    d.line((x,y+size*.4,x,y+size*.6),fill=color,width=2)
    if muted:d.line((x-size*.45,y-size*.45,x+size*.45,y+size*.5),fill='#f77272',width=3)
def camera(d,x,y,size=20,color='white'):
    rr(d,(x-size*.48,y-size*.32,x+size*.2,y+size*.28),4,outline=color,width=2)
    d.polygon([(x+size*.2,y-size*.17),(x+size*.5,y-size*.35),(x+size*.5,y+size*.3),(x+size*.2,y+size*.14)],outline=color)
def avatar(d,x,y,r):
    d.ellipse((x-r,y-r,x+r,y+r),fill='#3c3d40');d.ellipse((x-r*.25,y-r*.53,x+r*.25,y-r*.03),fill='#a5a6a9');d.ellipse((x-r*.53,y+r*.04,x+r*.53,y+r*.76),fill='#a5a6a9')

def contain_tile(frame,width,height):
    h,w=frame.shape[:2];ar=width/height
    if w/h>ar:
        nw=round(h*ar);x=(w-nw)//2;frame=frame[:,x:x+nw]
    else:
        nh=round(w/ar);y=(h-nh)//2;frame=frame[y:y+nh]
    return Image.fromarray(cv2.cvtColor(cv2.resize(frame,(width,height),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2RGB))

def zoom_ui(local,global_t):
    im=Image.new('RGB',(SW,SH),'#101112');d=ImageDraw.Draw(im)
    rr(d,(0,0,SW,53),0,fill='#202123');txt(d,(25,13),'zoom',27,'white',True);txt(d,(450,14),'Weekly Alignment',26,'#e8e8e8')
    d.ellipse((1138,20,1148,30),fill='#5fd15b')
    if local<.83:
        a=local*330
        d.arc((571,256,629,314),a,a+265,fill='#4c96ff',width=5)
        txt(d,(433,345),'Joining meeting…',40,'#f4f4f4')
        txt(d,(445,407),'Connecting to audio',27,'#a4a5aa')
        return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)
    tile_w,tile_h=374,210;gx,gy=31,65
    for i,(name,file,robot) in enumerate(CAST):
        x=gx+(i%3)*(tile_w+8);y=gy+(i//3)*(tile_h+8)
        ready=.83+i*.105;fade=float(np.clip((local-ready)/.14,0,1))
        tile=Image.new('RGB',(tile_w,tile_h),'#202124');td=ImageDraw.Draw(tile);avatar(td,tile_w/2,tile_h/2,45)
        if fade>0:
            f,j=B.frame(f'zoom-{i}',.4+local)
            if robot:
                f=B.transform_robot(f,robot,j,global_t)
                # Camera headshots keep hand props out of the laptop self-view.
                f=V.cover_crop(f,(390,20,1030,380))
            tile=Image.blend(tile,contain_tile(f,tile_w,tile_h),fade)
        im.paste(tile,(x,y));d=ImageDraw.Draw(im)
        d.rectangle((x+7,y+tile_h-33,x+tile_w-7,y+tile_h-7),fill='#151515')
        microphone(d,x+20,y+tile_h-22,13,muted=i!=0)
        txt(d,(x+35,y+tile_h-33),name,21,'white')
        if i==0 and global_t>=22.068:
            d.rectangle((x,y,x+tile_w-1,y+tile_h-1),outline='#64d35c',width=4)
    d.rectangle((0,718,SW,SH),fill='#252527')
    for x,label,kind in [(52,'Mute','mic'),(162,'Stop Video','camera'),(304,'Participants','people'),(465,'Chat','chat'),(600,'Share Screen','share'),(790,'More','more')]:
        if kind=='mic':microphone(d,x,735,16)
        elif kind=='camera':camera(d,x,735,18)
        elif kind=='people':
            d.ellipse((x-9,724,x+1,734),outline='white',width=2);d.arc((x-16,735,x+9,751),180,360,fill='white',width=2)
        elif kind=='chat':rr(d,(x-13,724,x+11,745),3,outline='white',width=2)
        elif kind=='share':rr(d,(x-14,724,x+13,745),4,fill='#54c875');d.line((x,741,x,729),fill='#17251b',width=2);d.line((x-5,734,x,729,x+5,734),fill='#17251b',width=2)
        else:txt(d,(x-15,719),'•••',22)
        txt(d,(x+22,726),label,20,'#ededed')
    rr(d,(1050,724,1180,752),7,fill='#bc3334');txt(d,(1083,726),'Leave',21,'white',True)
    return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)

# A faithful, simplified ChatGPT desktop conversation with readable large type.
PROMPT='Turn this into a LinkedIn post:'
RESPONSE=['Humbled and honored to','unlock a new era of','alignment.']

def gpt_ui(local,global_t):
    im=Image.new('RGB',(SW,SH),'#ffffff');d=ImageDraw.Draw(im)
    d.rectangle((0,0,SW,47),fill='#f3f3f3');txt(d,(22,10),'ChatGPT',23,'#656565');txt(d,(1103,8),'−  ×',24,'#8a8a8a')
    # Collapsed sidebar leaves the conversation itself large on a laptop.
    d.line((27,86,53,86),fill='#555555',width=3);d.line((27,94,45,94),fill='#555555',width=3)
    txt(d,(78,70),'ChatGPT',34,'#353535',True);txt(d,(231,77),'⌄',25,'#888888')
    d.line((1116,78,1140,78,1140,102,1116,102,1116,78),fill='#777777',width=2)
    d.line((1123,96,1145,73),fill='#555555',width=3)
    rr(d,(251,143,1123,262),24,fill='#f1f1f1')
    txt(d,(283,160),PROMPT,31,'#242424')
    phrase='I booked a meeting.'
    n=min(len(phrase),14+round(local*16))
    txt(d,(283,205),phrase[:n],34,'#171717',True)
    if local<.35:d.line((283+B.font(34,True).getlength(phrase[:n])+2,211,283+B.font(34,True).getlength(phrase[:n])+2,242),fill='#303030',width=2)
    if local<.65:
        for i in range(3):
            a=round(130+70*math.sin(local*10-i));d.ellipse((135+i*18,333,144+i*18,342),fill=(a,a,a))
    else:
        # Reveal whole words rather than rapidly flickering individual letters.
        words=[w for line in RESPONSE for w in line.split()];shown=min(len(words),max(1,math.floor((local-.65)/.115)+1));idx=0
        for row,line in enumerate(RESPONSE):
            x=133;y=312+row*64
            for word in line.split():
                if idx<shown:txt(d,(x,y),word,47,'#212121',False)
                x+=B.font(47).getlength(word+' ');idx+=1
        if local>=2.25:
            d.rectangle((139,532,156,551),outline='#777777',width=2);d.rectangle((145,526,162,545),outline='#777777',width=2)
            copied=local>=3.05
            if copied:
                d.line((141,539,148,546,162,528),fill='#098554',width=3);txt(d,(178,522),'Copied',25,'#098554')
            else:txt(d,(178,522),'Copy',25,'#666666')
    rr(d,(98,604,1128,714),31,fill='#ffffff',outline='#dedede',width=2)
    txt(d,(125,622),'Ask anything',27,'#9a9a9a');txt(d,(127,668),'+',29,'#777777')
    for x,label,w in [(186,'Search',118),(321,'Deep research',217)]:rr(d,(x,661,x+w,701),20,outline='#e6e6e6');txt(d,(x+17,665),label,22,'#686868')
    d.ellipse((1059,653,1104,698),fill='#141414');d.line((1082,685,1082,664),fill='white',width=3);d.line((1073,673,1082,664,1091,673),fill='white',width=3)
    txt(d,(350,731),'ChatGPT can make mistakes. Check important info.',17,'#888888')
    return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)

track=None

def build_tracking():
    global track
    cache=REVIEW/'laptop-screen-tracking.npy'
    if cache.exists():track=np.load(cache);return
    cap=cv2.VideoCapture(str(PLATE));ok,first=cap.read();assert ok;first=cv2.resize(first,(1280,720));gray0=cv2.cvtColor(first,cv2.COLOR_BGR2GRAY)
    # Track only the rigid bezel. Hands, moving body and blank display are excluded.
    outer=np.zeros((720,1280),np.uint8);cv2.fillConvexPoly(outer,QUAD.astype(int),255)
    ring=cv2.dilate(outer,np.ones((41,41),np.uint8))-cv2.erode(outer,np.ones((9,9),np.uint8));ring[555:]=0
    p0=cv2.goodFeaturesToTrack(gray0,130,.015,8,mask=ring)
    assert p0 is not None and len(p0)>=4
    points=[QUAD.copy()];errors=[0.]
    while True:
        ok,f=cap.read()
        if not ok:break
        g=cv2.cvtColor(cv2.resize(f,(1280,720)),cv2.COLOR_BGR2GRAY)
        p1,status,err=cv2.calcOpticalFlowPyrLK(gray0,g,p0,None,winSize=(41,41),maxLevel=3,criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,35,.01))
        good=(status.ravel()==1)&(err.ravel()<18)
        if good.sum()>=4:
            M,inliers=cv2.estimateAffinePartial2D(p0[good],p1[good],method=cv2.RANSAC,ransacReprojThreshold=1.5)
        else:M=None
        if M is not None and .97<np.linalg.norm(M[:,0])<1.03:
            q=cv2.transform(QUAD[None],M)[0];points.append(q);errors.append(float(np.median(err[good])))
        else:points.append(points[-1]);errors.append(-1.)
    cap.release();track=np.array(points,dtype=np.float32)
    track=savgol_filter(track,11,2,axis=0).astype(np.float32)
    np.save(cache,track)
    (REVIEW/'tracking-qa.json').write_text(json.dumps({'frames':len(track),'features':len(p0),'maxCornerDisplacementPixels':float(np.max(np.linalg.norm(track-QUAD,axis=2))),'failedFrames':sum(e<0 for e in errors)},indent=2))

def plate(t):
    if PLATE.exists():
        global track
        if track is None:build_tracking()
        f,j=B.frame('laptop',t);q=track[min(j,len(track)-1)]
    else:
        assert B.args.stills,'New laptop video must be present for final rendering.'
        f=cv2.resize(cv2.imread(str(STILL)),(1280,720));q=QUAD
    return f,q

def screen_shot(mode,local,global_t,offset):
    f,q=plate(offset+local)
    ui=zoom_ui(local,global_t) if mode=='laptop-zoom' else gpt_ui(local,global_t)
    # Modest screen brightness and soft optics preserve the live-action exposure.
    ui=np.clip(ui.astype(float)*.91+5,0,255).astype(np.uint8)
    H=cv2.getPerspectiveTransform(SOURCE,q);screen=cv2.warpPerspective(ui,H,(1280,720),flags=cv2.INTER_LINEAR)
    matte=cv2.warpPerspective(np.full((SH,SW),255,np.uint8),H,(1280,720)).astype(float)/255
    out=np.clip(f*(1-matte[:,:,None])+screen,0,255).astype('uint8')
    # The ChatGPT insert moves closer in the edit, making the actual post readable.
    zoom=(1.03+.035*np.clip(local/4.09,0,1)) if mode=='laptop-zoom' else (1.17+.10*np.clip(local/4.09,0,1))
    cx,cy=825,360;M=cv2.getRotationMatrix2D((cx,cy),0,zoom)
    return cv2.warpAffine(out,M,(1280,720),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)

def render(t):
    for a,b,name,offset in REPLACEMENTS:
        if a<=t<b:
            if name.startswith('laptop-'):return screen_shot(name,t-a,t,offset)
            f,j=B.frame(name,offset+t-a)
            if name=='synergy':f=B.transform_robot(f,name,j,t);f=V.cover_crop(f,B.CROPS[name]);f=V.lower_name(f,'Synergy','Management',t,a,a+1.35)
            elif name=='printer':f=V.cover_crop(f,(0,0,1280,680))
            elif name=='banner':f=B.banner_frame(name,f,j)
            return f
    return V.render(t)

TIMES=[19.3,20.15,21.5,22.5,23.6,34.2,34.9,35.7,36.7,37.7,38.7,50.9]

def main():
    frames=[]
    if B.args.stills:
        for t in TIMES:
            f=render(t);frames.append((t,f));cv2.imwrite(str(REVIEW/f'frame-{t:g}.jpg'),f)
    else:
        assert PLATE.exists()
        build_tracking();silent=D/'edit-silent.mp4'
        enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','18','-preset','medium','-threads','4','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)],stdin=subprocess.PIPE)
        chosen={round(t*FPS) for t in TIMES}
        for i in range(FPS*LENGTH):
            t=i/FPS;f=render(t);enc.stdin.write(f.tobytes())
            if i in chosen:frames.append((t,f.copy()))
            if i%240==0:print(f'Rendered {t:.0f} / 60 seconds',flush=True)
        enc.stdin.close();assert enc.wait()==0
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(silent),'-i',str(V.A/'master.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t','60','-movflags','+faststart',str(OUT)],check=True)
        proof={'revision':'V3 Synergy laptop: meeting and ChatGPT','duration':60,'width':1280,'height':720,'fps':24,'audio':'Approved V2 stereo music/voice master preserved','replacements':REPLACEMENTS,'newRunwayCredits':170,'totalProjectCredits':1700,'authorizedMaximumCredits':10000,'screenText':{'meeting':'Weekly Alignment','prompt':PROMPT+' I booked a meeting.','reply':' '.join(RESPONSE)},'sha256':hashlib.sha256(OUT.read_bytes()).hexdigest()}
        (D/'edit-proof.json').write_text(json.dumps(proof,indent=2)+'\n');print(str(OUT),flush=True)
    sheet=Image.new('RGB',(1280,math.ceil(len(frames)/3)*264),'#181818');d=ImageDraw.Draw(sheet)
    for i,(t,f) in enumerate(frames):
        x=i%3*426;y=i//3*264;sheet.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((426,240)),(x,y+24));txt(d,(x+8,y+3),f'{t:.2f}s',16)
    sheet.save(REVIEW/'screen-contact.jpg')
    for reader in B.readers.values():reader[0].release()

if __name__=='__main__':main()
