"""Masterclass picture recut. Original 44-second AAC soundtrack is copied unchanged."""
from pathlib import Path
import sys,json,subprocess,hashlib,math
import cv2,numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
sys.path.insert(0,str(Path('linkedin-hero/scripts/training_02').resolve()))
import render as R
import graphics as G
D=Path('masterclass-recut');FPS=24;LENGTH=44
ORIGINAL=Path('catalog/source/library/LinkedIn-Masterclass-Realistic-Post.mp4')
R.CUES=[];R.TRACK['wide']=np.load('training-02-recut/review/wide-face-tracking.npy');R.TRACK['close']=np.load('training-02-recut/review/close-face-tracking.npy');R.TRACK['laptop']=np.load('brand-story/v5/review/laptop-tracking.npy')
R.SOURCES['original']=ORIGINAL
VOICE=[(1.1,2.65),(5.15,6.75),(13.05,15.2),(17,19),(21.3,23.5),(24.8,25.4),(26.25,27.75),(29.15,31.2),(33.4,35.7)]
a=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(ORIGINAL),'-ar','48000','-ac','1','-f','f32le','-']),np.float32)
level=np.array([np.sqrt(np.mean(a[i*2000:(i+1)*2000]**2)) for i in range(LENGTH*FPS)]);level=np.clip(level/.12,0,1).astype(float)
R.LEVEL=level
BLUE=(12,96,183)

def speech(t):return any(a<=t<=b for a,b in VOICE)

def face(name,local,t,reflection=False):
 f,j=R.frame(name,local)
 # Initializes the canonical photographed glass and eye layers only once.
 if name not in R.FACES:R.mouth(f,j,t,name)
 clean,eyes=R.FACES[name]
 blink=max(max(0,1-abs(t-b)/.10) for b in [4.1,12.65,19.15,25.9,31.45,34.9,42.7])
 glass=clean.copy()+eyes*(1-blink)
 amp=level[min(len(level)-1,int(t*FPS))] if speech(t) else 0
 lights=np.zeros_like(glass)
 for k in range(28):
  distance=(t*20-k)%28
  strength=.23+max(0,1-distance/9)*(.45+.55*amp) if amp else .12
  cv2.rectangle(lights,(48+k*8,164),(53+k*8,170),(65*strength,245*strength,58*strength),-1)
 glass+=lights+cv2.GaussianBlur(lights,(5,5),.7)*.12
 if reflection:
  # A faint mirrored loading window stays fixed to the glass plane, away from the mouth.
  ref=Image.new('RGB',(320,200));d=ImageDraw.Draw(ref)
  d.rounded_rectangle((15,10,302,153),radius=4,outline=(81,133,184),width=2)
  d.rectangle((17,12,300,39),fill=(14,45,77))
  d.rounded_rectangle((22,16,49,43),radius=2,fill='#0a66c2')
  d.text((26,14),'in',font=G.font(23,True),fill='#e6f0ff')
  d.line((61,25,198,25),fill=(126,160,190),width=2)
  d.line((61,34,273,34),fill=(68,109,152),width=1)
  progress=min(1,max(0,(t-3)/1.65));d.rectangle((62,47,62+int(218*progress),49),fill=(169,204,229))
  ref=ref.transpose(Image.Transpose.FLIP_LEFT_RIGHT).filter(ImageFilter.GaussianBlur(.7))
  reflect=np.array(ref)[:,:,::-1].astype(float)
  gain=.43*min(1,(t-3)/.20,(5-t)/.20)
  glass+=reflect*max(0,gain)
 f=R.perspective(f,np.clip(glass,0,255).astype('uint8'),R.TRACK[name][j])
 return cv2.cvtColor(f,cv2.COLOR_BGR2RGB)

AVATAR=None
def avatar():
 global AVATAR
 if AVATAR is None:
  f=face('close',0,0);im=Image.fromarray(f).crop((325,110,950,690));AVATAR=im
 return AVATAR

def paste_avatar(im,xy,size):
 a=avatar().resize((size,size));mask=Image.new('L',(size,size));ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255);im.paste(a,xy,mask)

def source_ui(t):
 f,j=R.frame('original',t);im=Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB))
 if t>=38:
  # The original layout tightens at 42 seconds. Locate the actual avatar,
  # instead of pinning a second face to a fixed screen coordinate.
  region=f[390:580,55:115];mask=(region.min(axis=2)<170).astype('uint8')*255
  mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
  count,labels,stats,centers=cv2.connectedComponentsWithStats(mask)
  matches=[v for v in stats[1:] if v[2]>=25 and v[3]>=30]
  if matches:
   x,y,w,h,area=min(matches,key=lambda v:v[1]);size=min(43,w,h)
   paste_avatar(im,(int(x)+55,int(y)+390),int(size))
 return im

def post_card(t):
 im=source_ui(t);arr=np.array(im)
 white=np.mean(np.all(arr[134:695,55:759]>225,axis=2),axis=1)>.50
 end=134+np.flatnonzero(white)[-1]+1
 card=Image.new('RGB',(731,end-143),'white');card.paste(im.crop((43,143,742,end)),(0,0))
 # A clean, consistent author header replaces the original animated crop.
 d=ImageDraw.Draw(card);d.rectangle((0,0,730,89),fill='white');paste_avatar(card,(21,17),50)
 G.tx(d,(88,14),'Synergy',22,'#262626',True);G.tx(d,(185,17),'· 1st',17,'#677079')
 G.tx(d,(88,43),'Founder & CEO | Thought Leadership | Building in Public',17,'#677079')
 G.tx(d,(88,65),'1m · public',14,'#677079');G.tx(d,(626,17),'+ Follow',21,'#0a66c2',True)
 return card

def monitor(t,composer=False):
 im=G.base();d=ImageDraw.Draw(im)
 if composer:
  d.rectangle((0,66,1280,720),fill='#dce1e4')
  d.rounded_rectangle((147,91,1133,655),radius=12,fill='white',outline='#d3d6d8')
  paste_avatar(im,(182,117),60);G.tx(d,(259,121),'Synergy',27,b=True);G.tx(d,(259,154),'Post to anyone',18,'#677079')
  G.tx(d,(1081,112),'×',30,'#677079')
  text='Humbled and honored to share\nthat we held a meeting.'
  count=min(len(text),int(max(0,t-5)*24));typed=text[:count]
  y=246
  for line in typed.split('\n'):G.tx(d,(185,y),line,36);y+=51
  if t<7.55 and int(t*3)%2==0:
   last=typed.split('\n')[-1];x=185+d.textlength(last,font=G.font(36));d.rectangle((x,y-47,x+2,y-13),fill='#262626')
  d.line((178,570,1101,570),fill='#e7e7e7');G.tx(d,(184,603),'Photo       Video       Event',18,'#657078')
  d.rounded_rectangle((981,590,1099,634),radius=22,fill='#0a66c2');G.tx(d,(1018,599),'Post',22,'white',True)
 else:
  card=post_card(t);w,h=card.size;x=(1280-w)//2;y=112
  shadow=Image.new('RGBA',im.size);sd=ImageDraw.Draw(shadow);sd.rounded_rectangle((x,y+3,x+w,y+h+5),radius=8,fill=(0,0,0,24));shadow=shadow.filter(ImageFilter.GaussianBlur(8));im=Image.alpha_composite(im.convert('RGBA'),shadow).convert('RGB')
  mask=Image.new('L',card.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,w,h),radius=8,fill=255);im.paste(card,(x,y),mask)
 return np.array(im)

def laptop(t):
 f,j=R.frame('laptop',.6+(t-5)*1.1);q=R.TRACK['laptop'][min(j,len(R.TRACK['laptop'])-1)]
 ui=cv2.cvtColor(monitor(t,True),cv2.COLOR_RGB2BGR);ui=np.clip(ui*.91+4,0,255).astype('uint8')
 gray=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY);roi=np.zeros((720,1280),np.uint8);cv2.fillConvexPoly(roi,q.astype(int),255);roi[:430]=0
 bright=((gray>64)&(roi>0)).astype('uint8')*255;bright=cv2.morphologyEx(bright,cv2.MORPH_CLOSE,np.ones((11,11),np.uint8));contours,_=cv2.findContours(bright,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);hold=np.zeros_like(bright)
 for c in contours:
  if cv2.contourArea(c)>12:cv2.drawContours(hold,[cv2.convexHull(c)],-1,255,-1)
 hold=cv2.GaussianBlur(cv2.dilate(hold,np.ones((5,5),np.uint8)),(3,3),.5)/255
 return cv2.cvtColor(R.perspective(f,ui,q,hold),cv2.COLOR_BGR2RGB)

def split(t,local):
 # Preserve the original post wording, reactions, counts and comment timing.
 im=source_ui(t);blue=im.getpixel((10,110));d=ImageDraw.Draw(im);d.rectangle((43,125,1279,648),fill=blue);d.rectangle((779,0,1279,719),fill=blue);im.paste(post_card(t),(43,143))
 shot=Image.fromarray(face('close',local,t)).crop((255,0,1040,720)).resize((472,433),Image.Resampling.LANCZOS)
 im.paste(shot,(792,138));d=ImageDraw.Draw(im);d.rectangle((792,138,1264,571),outline='#72a3ce',width=1)
 G.tx(d,(797,593),'LEARN TO SOUND LIKE LINKEDIN.',15,'#c1dcf3',True)
 if 33.4<t<35.9:
  G.tx(d,(796,626),'“The framework is scalable.”',22,'white')
 return np.array(im)

def hands(t,local):
 f=face('wide',local,t);return R.crop(f,(240,360,800,450))

def shot(t):
 if t<3:return face('wide',t,t)
 if t<5:return face('close',t-3,t,True)
 if t<7.6:return laptop(t)
 if t<8.5:return monitor(t,True)
 if t<11.5:return monitor(t)
 if t<15.5:return split(t,1.4+t-11.5)
 if t<17:return hands(t,.8+(t-15.5)*1.2)
 if t<20:return split(t,4+t-17)
 if t<23.8:return monitor(t)
 if t<26.8:return split(t,.8+t-23.8)
 if t<28.5:return hands(t,3.1+(t-26.8)*1.2)
 if t<32:
  f=face('close',5.2+t-28.5,t)
  return G.subtitle(f,"We haven't measured it yet.") if 29.2<t<31.7 else f
 if t<36:return split(t,5.8+t-32)
 if t<40:return monitor(t)
 if t<42:return face('wide',6.8+t-40,t)
 return split(t,7.2+t-42)

if __name__=='__main__':
 D.joinpath('review').mkdir(parents=True,exist_ok=True)
 times=[0,2,3.4,4.1,5.8,8.1,10,13.8,16,18,22,25,27.5,30,34,38.5,41,43]
 if '--stills' in sys.argv:
  sheet=Image.new('RGB',(1280,1080),'#111')
  for i,t in enumerate(times):
   im=Image.fromarray(shot(t));im.save(D/'review'/f'recut-{t:g}.jpg');small=im.resize((320,180));ImageDraw.Draw(small).text((4,4),str(t),fill='red');sheet.paste(small,((i%4)*320,(i//4)*180))
  sheet.save(D/'review/recut-sheet.jpg');print('Stills ready');sys.exit()
 p=D/'review/picture.mp4';enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r','24','-i','-','-an','-c:v','libx264','-threads','3','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(p)],stdin=subprocess.PIPE)
 for i in range(FPS*LENGTH):
  enc.stdin.write(shot(i/FPS).tobytes())
  if i%240==0:print('Rendered',i/FPS,flush=True)
 enc.stdin.close();assert enc.wait()==0
 final=D/'LinkedIn-Masterclass-Realistic-Post.mp4'
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(p),'-i',str(ORIGINAL),'-map','0:v','-map','1:a','-c','copy','-movflags','+faststart',str(final)],check=True)
 print(final,final.stat().st_size,hashlib.sha256(final.read_bytes()).hexdigest())
