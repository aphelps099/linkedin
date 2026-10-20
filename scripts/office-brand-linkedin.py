"""Deterministic LinkedIn parody screen and human-operated monitor composite.

Actual reaction pictograms referenced from LinkedIn Help. Fictional post and
comments use the film's established cast. No browser or live account writes.
"""
import json,math
from pathlib import Path
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont
from scipy.signal import savgol_filter

SIZE=(1600,900)
QUAD=np.float32([[614,125],[1238,91],[1217,516],[595,452]])
SOURCE=np.float32([[0,0],[1599,0],[1599,899],[0,899]])
FONTS=Path('/usr/share/fonts/opentype/urw-base35')
INK='#191919';GRAY='#666666';BLUE='#0a66c2';PAGE='#f3f2ef'
POST=['I booked a meeting.','Humbled and honored to unlock a','new era of alignment.','The invite is only the beginning.']
COMMENTS=[
 {'name':'Kevin','role':'Strategic Partnerships','text':'This is what courageous leadership looks like.','media':'guitar','time':2.1,'likes':38},
 {'name':'Linda','role':'Leadership Development','text':'The calendar invite gave me chills.','media':'linda','time':5.8,'likes':67},
 {'name':'Arjun','role':'Finance & Operations','text':'Huge milestone. Already shared with my cohort.','media':'arjun','time':6.95,'likes':105},
]
ICONS=['Like','Celebrate','Support','Love','Insightful','Funny']
ICON_BOXES=[(20,10,98,108),(121,10,216,108),(257,10,347,108),(365,10,445,108),(476,10,557,108),(587,10,671,108)]
avatars={};icons={};tracking=None

def setup(base,workspace):
    global B,W,D,PLATE,STILL
    B=base;W=workspace;D=W/'brand-story/v4';PLATE=D/'raw/people-linkedin.mp4'
    STILL=W/'generated_images/exec-37e99bf6-88b9-48d5-8313-68935f556199.png'
    B.SOURCES['people-linkedin']=PLATE
    ref=Image.open(D/'review/linkedin-reactions-reference.png').convert('RGB')
    for name,box in zip(ICONS,ICON_BOXES):
        im=ref.crop(box);a=np.array(im);mask=255-np.min(a,axis=2)
        # Keep the official colored pictograms; remove only their white field.
        rgba=im.convert('RGBA');alpha=np.where(np.min(a,axis=2)>245,0,255).astype('uint8');rgba.putalpha(Image.fromarray(alpha))
        icons[name]=rgba

def ft(n,bold=False):return ImageFont.truetype(str(FONTS/('NimbusSans-Bold.otf' if bold else 'NimbusSans-Regular.otf')),n)
def text(d,xy,s,n=28,fill=INK,bold=False):d.text(xy,s,font=ft(n,bold),fill=fill)
def rr(d,box,r=12,fill='white',outline=None,width=1):d.rounded_rectangle(box,r,fill,outline,width)
def avatar(name,size):
    key=(name,size)
    if key in avatars:return avatars[key]
    f,j=B.frame(name,.25)
    box=(470,100,790,420) if name in ['synergy','synthia'] else (430,35,850,455)
    im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).crop(box).resize((size,size),Image.Resampling.LANCZOS)
    mask=Image.new('L',(size,size));ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255);im.putalpha(mask)
    avatars[key]=im;return im
def face(im,name,xy,size):im.paste(avatar(name,size),xy,avatar(name,size))
def icon(im,name,x,y,size):
    p=icons[name];w,h=p.size;s=min(size/w,size/h);p=p.resize((round(w*s),round(h*s)),Image.Resampling.LANCZOS)
    im.paste(p,(round(x-p.width/2),round(y-p.height/2)),p)
def lineicon(d,kind,x,y,s=28,color=GRAY):
    if kind=='comment':
        rr(d,(x-s/2,y-s/2,x+s/2,y+s/3),5,fill=None,outline=color,width=2)
        d.line((x-s/5,y+s/3,x-s/5,y+s*.65,x+s/7,y+s/3),fill=color,width=2)
    elif kind=='repost':
        d.line((x-13,y+7,x-13,y-8,x+14,y-8),fill=color,width=2);d.line((x+9,y-13,x+14,y-8,x+9,y-3),fill=color,width=2)
        d.line((x+13,y-2,x+13,y+13,x-14,y+13),fill=color,width=2);d.line((x-9,y+8,x-14,y+13,x-9,y+18),fill=color,width=2)
    elif kind=='send':d.polygon([(x-15,y-11),(x+17,y-15),(x+5,y+17),(x-1,y+2)],outline=color,width=2);d.line((x-1,y+2,x+17,y-15),fill=color,width=2)
    elif kind=='home':d.polygon([(x-12,y),(x,y-12),(x+12,y),(x+9,y),(x+9,y+12),(x-9,y+12),(x-9,y)],fill=color)
    elif kind=='bell':d.arc((x-10,y-12,x+10,y+10),180,360,fill=color,width=3);d.line((x-10,y-2,x-10,y+9,x+10,y+9,x+10,y-2),fill=color,width=3);d.ellipse((x-3,y+12,x+3,y+17),fill=color)

def ui(local,comments_view=False):
    # A real desktop feed layout: standard four-action row and six-item tray.
    page=Image.new('RGB',(1600,1550),PAGE);d=ImageDraw.Draw(page)
    x=365;right=1245
    rr(d,(x,93,right,1460),13,outline='#d6d6d6')
    face(page,'synergy',(x+27,120),73)
    text(d,(x+117,117),'Synergy',30,bold=True);text(d,(x+238,122),'• 1st',24,GRAY)
    text(d,(x+117,154),'Founder & Chief Alignment Officer',24,GRAY)
    text(d,(x+117,187),'1h •',23,GRAY);d.ellipse((x+172,190,x+187,205),outline=GRAY,width=1);d.arc((x+177,190,x+182,205),0,360,fill=GRAY,width=1)
    text(d,(right-76,116),'•••',28,GRAY)
    text(d,(x+28,238),POST[0],39,bold=True)
    text(d,(x+28,310),POST[1],34)
    text(d,(x+28,354),POST[2],34)
    text(d,(x+28,420),POST[3],32)
    text(d,(x+28,474),'#Leadership  #FutureOfWork',25,BLUE)
    # Engagement is incoming from the network. The viewer may change their own
    # selected reaction, but the large count is never presented as repeated votes.
    count=round(np.interp(local,[0,1.3,1.35,2.7,4.2,5.45,6.9,8.9,10],[124,124,125,268,611,927,1354,1834,1834]))
    for i,name in enumerate(['Like','Love','Insightful']):
        d.ellipse((x+27+i*22,532,x+60+i*22,565),fill='white',outline='white',width=2);icon(page,name,x+44+i*22,548,29)
    text(d,(x+118,531),f'{count:,}',26,GRAY)
    nc=round(np.interp(local,[0,2.1,5.8,6.95,9.4],[0,1,8,16,23]));text(d,(right-256,533),f'{nc} comments · 18 reposts',23,GRAY)
    d.line((x+25,582,right-25,582),fill='#dddddd',width=1)
    # A slight depression/illumination signifies the physical mouse clicks.
    events=[(1.3,'Like'),(3.2,'Love'),(4.25,'Insightful')]
    active=next((name for start,name in reversed(events) if local>=start),'Like')
    selected=local>=1.3;press=max(max(0,1-abs(local-a)/.13) for a,_ in events)
    colors={'Like':BLUE,'Love':'#b94b25','Insightful':'#916b16'}
    if selected:rr(d,(x+16,594,x+229,650),6,fill=tuple(round(243-p*press)for p in [17,5,0]))
    icon(page,active,x+53,621,32*(1-.08*press));text(d,(x+81,602),active,28,colors[active] if selected else GRAY,True)
    for xx,label,kind in [(x+279,'Comment','comment'),(x+509,'Repost','repost'),(x+706,'Send','send')]:
        lineicon(d,kind,xx,619);text(d,(xx+26,601),label,28,GRAY,True)
    d.line((x+25,663,right-25,663),fill='#eeeeee',width=1)
    face(page,'people',(x+27,682),49);rr(d,(x+90,679,right-26,739),31,outline='#999999')
    text(d,(x+112,695),'Add a comment…',26,GRAY)
    text(d,(x+27,759),'Most recent',24,GRAY,True);text(d,(x+176,755),'⌄',26,GRAY)
    # Comments arrive at the top, with restrained smooth pushes in the thread.
    visible=[c for c in COMMENTS if local>=c['time']]
    for c in visible:
        shift=sum(np.clip((local-n['time'])/.22,0,1) for n in visible if n['time']>c['time'])
        yy=802+round(137*shift)
        alpha=float(np.clip((local-c['time'])/.18,0,1))
        layer=Image.new('RGBA',page.size);ld=ImageDraw.Draw(layer)
        p=avatar(c['media'],52);layer.paste(p,(x+27,yy+4),p)
        rr(ld,(x+93,yy,right-27,yy+96),13,fill='#f2f2f2')
        text(ld,(x+110,yy+10),c['name'],27,bold=True);text(ld,(x+110+ft(27,True).getlength(c['name'])+10,yy+14),'• 1st',20,GRAY)
        text(ld,(right-81,yy+13),'now',19,GRAY)
        text(ld,(x+110,yy+49),c['text'],27)
        cl=round(c['likes']*np.clip((local-c['time'])/2.4,0,1))
        text(ld,(x+110,yy+106),f'Like   ·   {cl}     |     Reply',20,GRAY,True)
        layer.putalpha(layer.getchannel('A').point(lambda v:round(v*alpha)))
        page=Image.alpha_composite(page.convert('RGBA'),layer).convert('RGB');d=ImageDraw.Draw(page)
    # Hover tray opens without a distracting cursor travelling between buttons.
    if 2.85<=local<4.65:
        rr(d,(x+9,499,x+474,583),42,fill='white',outline='#d5d5d5',width=2)
        for i,name in enumerate(ICONS):
            pulse=0
            if name=='Love':pulse=max(0,1-abs(local-3.2)/.28)
            elif name=='Insightful':pulse=max(0,1-abs(local-4.25)/.28)
            icon(page,name,x+49+i*75,542-pulse*5,52+pulse*9)
        label='Love' if local<3.65 else 'Insightful';lx=x+49+(3 if label=='Love' else 4)*75
        tw=ft(22).getlength(label);rr(d,(lx-tw/2-11,455,lx+tw/2+11,489),7,fill='#282828');text(d,(lx-tw/2,459),label,22,'white')
    # Supporting real feed furniture, kept quiet around the central post.
    rr(d,(70,93,338,429),13,outline='#d6d6d6');rr(d,(71,94,337,163),12,fill='#bfd3d6')
    face(page,'people',(91,132),75);text(d,(93,224),'People & Culture',25,bold=True);text(d,(93,263),'Building better teams.',20,GRAY)
    d.line((90,312,318,312),fill='#dddddd');text(d,(93,332),'Profile viewers',20,GRAY);text(d,(282,332),'83',20,BLUE,True)
    text(d,(93,372),'Post impressions',20,GRAY);text(d,(272,372),'412',20,BLUE,True)
    rr(d,(1271,93,1540,402),13,outline='#d6d6d6');text(d,(1295,117),'LinkedIn News',27,bold=True)
    text(d,(1295,169),'Top stories',22,GRAY,True)
    for i,(a,b) in enumerate([('The future of work','3h ago · 2,481 readers'),('A new era of alignment','5h ago · 1,203 readers'),('Leadership in practice','7h ago · 984 readers')]):
        text(d,(1295,211+i*65),a,20,bold=True);text(d,(1295,239+i*65),b,16,GRAY)
    scroll=420 if comments_view else 0
    im=page.crop((0,scroll,1600,scroll+900));d=ImageDraw.Draw(im)
    # Fixed LinkedIn masthead remains recognisable in every screen view.
    d.rectangle((0,0,1600,65),fill='white');d.line((0,64,1600,64),fill='#dedede')
    rr(d,(71,12,112,53),3,fill=BLUE);text(d,(76,8),'in',39,'white',True)
    rr(d,(127,12,486,53),4,fill='#edf3f8');d.ellipse((147,23,162,38),outline='#4c5967',width=2);d.line((160,36,168,44),fill='#4c5967',width=2);text(d,(183,20),'Search',23,'#596775')
    for xx,label,kind in [(628,'Home','home'),(766,'My Network','network'),(907,'Jobs','jobs'),(1047,'Messaging','comment'),(1192,'Notifications','bell')]:
        if kind in ['home','comment','bell']:lineicon(d,kind,xx,22,20,color='#666666')
        elif kind=='jobs':rr(d,(xx-12,16,xx+12,32),2,fill='#666666');d.rectangle((xx-6,11,xx+6,16),outline='#666666',width=2)
        else:d.ellipse((xx-5,10,xx+5,20),fill='#666666');d.ellipse((xx-12,23,xx+12,34),fill='#666666')
        text(d,(xx-ft(17).getlength(label)/2,42),label,17,GRAY)
    face(im,'people',(1304,6),29);text(d,(1307,42),'Me',17,GRAY);d.line((1369,0,1369,64),fill='#eeeeee')
    text(d,(1398,23),'For Business',21,GRAY)
    return cv2.cvtColor(np.array(im),cv2.COLOR_RGB2BGR)

def build_tracking():
    global tracking
    cache=D/'review/people-screen-tracking.npy'
    if cache.exists():tracking=np.load(cache);return
    cap=cv2.VideoCapture(str(PLATE));ok,first=cap.read();assert ok
    gray=cv2.cvtColor(cv2.resize(first,(1280,720)),cv2.COLOR_BGR2GRAY)
    inside=np.zeros_like(gray);cv2.fillConvexPoly(inside,QUAD.astype(int),255)
    ring=cv2.dilate(inside,np.ones((25,25),np.uint8))-cv2.erode(inside,np.ones((7,7),np.uint8))
    pts=cv2.goodFeaturesToTrack(gray,130,.015,7,mask=ring);assert pts is not None and len(pts)>=4
    values=[QUAD.copy()];fails=0
    while True:
        ok,f=cap.read()
        if not ok:break
        nxt=cv2.cvtColor(cv2.resize(f,(1280,720)),cv2.COLOR_BGR2GRAY)
        p1,st,err=cv2.calcOpticalFlowPyrLK(gray,nxt,pts,None,winSize=(31,31),maxLevel=3)
        valid=(st.ravel()==1)&(err.ravel()<20)
        mat,_=cv2.estimateAffinePartial2D(pts[valid],p1[valid],method=cv2.RANSAC,ransacReprojThreshold=1.6) if sum(valid)>=4 else (None,None)
        if mat is not None and .97<np.linalg.norm(mat[:,0])<1.03:values.append(cv2.transform(QUAD[None],mat)[0])
        else:values.append(values[-1]);fails+=1
    cap.release();tracking=savgol_filter(np.array(values),11,2,axis=0).astype(np.float32);np.save(cache,tracking)
    (D/'review/people-tracking-qa.json').write_text(json.dumps({'features':len(pts),'frames':len(values),'failedFrames':fails,'maxCornerDisplacementPixels':float(np.max(np.linalg.norm(tracking-QUAD,axis=2)))},indent=2))

def human(local):
    if PLATE.exists():
        if tracking is None:build_tracking()
        f,j=B.frame('people-linkedin',.3+local);q=tracking[min(j,len(tracking)-1)]
    else:
        assert B.args.stills,'Human source video is required for the final master.'
        f=cv2.resize(cv2.imread(str(STILL)),(1280,720));q=QUAD
    display=ui(local);display=np.clip(display.astype(float)*.89+7,0,255).astype('uint8')
    H=cv2.getPerspectiveTransform(SOURCE,q);screen=cv2.warpPerspective(display,H,(1280,720))
    mask=cv2.warpPerspective(np.full((900,1600),255,np.uint8),H,(1280,720)).astype(float)/255
    return np.clip(f*(1-mask[:,:,None])+screen,0,255).astype('uint8')

def screen(local,comments=False):
    # Straight-on screen insert makes the post and comments readable at 720p.
    out=ui(local,comments)
    return cv2.resize(out,(1280,720),interpolation=cv2.INTER_AREA)
