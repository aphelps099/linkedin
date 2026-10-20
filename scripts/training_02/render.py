from pathlib import Path
import json,subprocess,sys,hashlib
import cv2,numpy as np
from PIL import Image,ImageDraw
from scipy.signal import savgol_filter
import graphics as G
D=Path('training-02-recut');FPS=24;LENGTH=50
LEVEL=np.array(json.loads((D/'audio/levels.json').read_text()))
CUES=json.loads((D/'audio/cues.json').read_text())
SOURCES={'wide':D/'source/synergy-wide.mp4','close':D/'source/synergy-close.mp4','laptop':Path('brand-story/v5/raw/laptop.mp4')}
READ={};TRACK={};FACES={}

def frame(name,t):
 if name not in READ:
  c=cv2.VideoCapture(str(SOURCES[name]));assert c.isOpened(),name
  READ[name]=[c,-1,None,c.get(cv2.CAP_PROP_FPS),int(c.get(cv2.CAP_PROP_FRAME_COUNT))]
 c,last,f,fps,total=READ[name];j=max(0,min(total-1,int(t*fps)))
 if last!=j:
  if j!=last+1:c.set(cv2.CAP_PROP_POS_FRAMES,j)
  ok,f=c.read();assert ok,(name,j)
  f=cv2.resize(f,(1280,720));READ[name][1:3]=[j,f]
 return f.copy(),j

def track_robot(name):
 path=D/'source'/f'{name}-face-quad.json';q=np.float32(json.loads(path.read_text()))
 c=cv2.VideoCapture(str(SOURCES[name]));ok,f=c.read();assert ok
 gray=cv2.cvtColor(cv2.resize(f,(1280,720)),cv2.COLOR_BGR2GRAY)
 fill=np.zeros((720,1280),np.uint8);cv2.fillConvexPoly(fill,q.astype(int),255)
 ring=cv2.dilate(fill,np.ones((27,27),np.uint8))-cv2.erode(fill,np.ones((5,5),np.uint8))
 pts=cv2.goodFeaturesToTrack(gray,150,.006,4,mask=ring)
 assert pts is not None and len(pts)>8
 first=gray;positions=[q.copy()];errors=[];fallback=[];idx=1
 while True:
  ok,f=c.read()
  if not ok:break
  now=cv2.cvtColor(cv2.resize(f,(1280,720)),cv2.COLOR_BGR2GRAY)
  dest,status,err=cv2.calcOpticalFlowPyrLK(first,now,pts,None,winSize=(41,41),maxLevel=4,criteria=(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,60,.005))
  good=(status.ravel()==1)&(err.ravel()<25)
  M=None
  if good.sum()>=8:M,mask=cv2.findHomography(pts[good],dest[good],cv2.RANSAC,2)
  if M is None:positions.append(positions[-1]);fallback.append(idx)
  else:
   mapped=cv2.perspectiveTransform(q[None],M)[0]
   if np.max(abs(mapped-q))>180:positions.append(positions[-1]);fallback.append(idx)
   else:
    positions.append(mapped)
    pred=cv2.perspectiveTransform(pts[good],M)
    errors.append(float(np.median(np.linalg.norm(pred-dest[good],axis=2))))
  idx+=1
 c.release();out=savgol_filter(np.float32(positions),5,2,axis=0).astype(np.float32)
 np.save(D/'review'/f'{name}-face-tracking.npy',out)
 (D/'review'/f'{name}-tracking-qa.json').write_text(json.dumps({'frames':len(out),'fallbackFrames':fallback,'medianPixelError':float(np.median(errors))},indent=2))
 return out

def perspective(f,im,q,hold=None):
 h,w=im.shape[:2];src=np.float32([[0,0],[w-1,0],[w-1,h-1],[0,h-1]]);H=cv2.getPerspectiveTransform(src,q)
 layer=cv2.warpPerspective(im,H,(1280,720));alpha=cv2.warpPerspective(np.ones((h,w),np.float32),H,(1280,720))
 if hold is not None:alpha*=1-hold
 return np.clip(f*(1-alpha[:,:,None])+layer*alpha[:,:,None],0,255).astype('uint8')

def mouth(f,j,t,name='wide'):
 q=TRACK[name][j];w,h=320,200
 src=np.float32([[0,0],[319,0],[319,199],[0,199]])
 if name not in FACES:
  cap=cv2.VideoCapture(str(SOURCES[name]));ok,first=cap.read();cap.release();assert ok
  first=cv2.resize(first,(1280,720));q0=np.float32(json.loads((D/'source'/f'{name}-face-quad.json').read_text()))
  base=cv2.warpPerspective(first,cv2.getPerspectiveTransform(q0,src),(w,h))
  x=base.astype(float);green=((x[:,:,1]>x[:,:,0]*1.28)&(x[:,:,1]>x[:,:,2]*1.16)&(x[:,:,1]>50)).astype('uint8')*255
  clean=cv2.inpaint(base,cv2.dilate(green,np.ones((5,5),np.uint8)),4,cv2.INPAINT_TELEA).astype(float)
  eyes=np.zeros_like(base,dtype=float);mask=green.astype(float)/255;mask[135:]=0
  eyes=(base.astype(float)-clean)*mask[:,:,None]
  FACES[name]=(clean,eyes)
 clean,eyes=FACES[name];blink=max([max(0,1-abs(t-b)/.11) for b in ([1.9,44.8] if name=='wide' else [5.6,22.1,36.3])])
 canvas=clean.copy()+eyes*(1-blink)
 amp=LEVEL[min(len(LEVEL)-1,int(t*24))];active=amp>.04
 light=np.zeros_like(canvas)
 for k in range(28):
  dist=((t*20)-k)%28;strength=(.23+max(0,1-dist/9)*(.45+.55*amp)) if active else .12
  cv2.rectangle(light,(48+k*8,164),(53+k*8,170),(65*strength,245*strength,58*strength),-1)
 canvas+=light+cv2.GaussianBlur(light,(5,5),.7)*.12
 return perspective(f,np.clip(canvas,0,255).astype('uint8'),q)

def crop(f,box):
 x,y,w,h=box;return cv2.resize(f[y:y+h,x:x+w],(1280,720),interpolation=cv2.INTER_CUBIC)

def office(t,offset,close=False,hands=False):
 name='close' if close else 'wide'
 f,j=frame(name,offset);f=mouth(f,j,t,name)
 if hands:f=crop(f,tuple(json.loads((D/'source/hands-crop.json').read_text())))
 f=cv2.cvtColor(f,cv2.COLOR_BGR2RGB)
 for c in CUES:
  if c['start']<=t<=c['end']+.25 and len(c['text'])<54:f=G.subtitle(f,c['text'])
 return f

def laptop(t):
 local=t-14;f,j=frame('laptop',.8+local*1.45)
 q=TRACK['laptop'][min(j,len(TRACK['laptop'])-1)]
 ui=cv2.cvtColor(np.array(G.gpt(local+.3)),cv2.COLOR_RGB2BGR)
 ui=np.clip(ui*.91+4,0,255).astype('uint8')
 # Protect physical hands if they rise into the display plane.
 gray=cv2.cvtColor(f,cv2.COLOR_BGR2GRAY);roi=np.zeros((720,1280),np.uint8);cv2.fillConvexPoly(roi,q.astype(int),255);roi[:430]=0
 bright=((gray>64)&(roi>0)).astype('uint8')*255
 bright=cv2.morphologyEx(bright,cv2.MORPH_CLOSE,np.ones((11,11),np.uint8));contours,_=cv2.findContours(bright,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);hold=np.zeros_like(bright)
 for c in contours:
  if cv2.contourArea(c)>12:cv2.drawContours(hold,[cv2.convexHull(c)],-1,255,-1)
 hold=cv2.GaussianBlur(cv2.dilate(hold,np.ones((5,5),np.uint8)),(3,3),.5)/255
 f=perspective(f,ui,q,hold)
 return cv2.cvtColor(f,cv2.COLOR_BGR2RGB)

def render(t):
 if t<3:return G.title(office(t,t),t)
 if t<4:return np.array(G.post(t))
 if t<7:return office(t,t-4,True)
 if t<10.5:return np.array(G.post(t))
 if t<12:return office(t,7.5+(t-10.5),True)
 if t<14:return office(t,.5+(t-12)*1.2,hands=True)
 if t<16.8:return laptop(t)
 if t<18:return np.array(G.gpt(t-14+.3))
 if t<21:return np.array(G.post(t))
 if t<23.5:return office(t,3+(t-21),True)
 if t<30.5:return np.array(G.post(t))
 if t<32:return office(t,3.2+(t-30.5)*1.3,hands=True)
 if t<35.5:return np.array(G.post(t))
 if t<38.5:return office(t,5.6+(t-35.5),True)
 if t<42.5:return np.array(G.meeting(t))
 if t<47:return office(t,5.4+(t-42.5))
 im=Image.new('RGB',(1280,720),'#0a63bf');d=ImageDraw.Draw(im)
 G.tx(d,(83,72),'LINKEDIN BEATS / TRAINING 02',21,'#b4d9ff')
 G.tx(d,(80,236),'Question: unanswered.',61,'white',True)
 G.tx(d,(80,317),'Meeting: scheduled.',61,'white',True)
 G.tx(d,(83,595),'Learn to sound like LinkedIn.',25,'white');G.tx(d,(917,598),'linkedinbeats.com',22,'#b4d9ff')
 return np.array(im)

if __name__=='__main__':
 TRACK['wide']=track_robot('wide');TRACK['close']=track_robot('close');TRACK['laptop']=np.load('brand-story/v5/review/laptop-tracking.npy')
 if '--stills' in sys.argv:
  for t in [0,2,4.8,8.5,11.2,12.5,15,17,19,22,25,28,31,33,36.8,40,41.5,44,46,48]:Image.fromarray(render(t)).save(D/'review'/f'new-{t:g}.jpg')
  print('Review stills ready');sys.exit()
 out=D/'review/picture.mp4'
 enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r',str(FPS),'-i','-','-an','-c:v','libx264','-threads','3','-preset','fast','-crf','18','-pix_fmt','yuv420p',str(out)],stdin=subprocess.PIPE)
 for i in range(FPS*LENGTH):
  f=render(i/FPS);enc.stdin.write(f.tobytes())
  if i%240==0:print('Rendered',i/FPS,flush=True)
 enc.stdin.close();assert enc.wait()==0
 final=D/'Training-02-Final-Mix.mp4'
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(out),'-i',str(D/'audio/mix.wav'),'-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-movflags','+faststart',str(final)],check=True)
 print(final,final.stat().st_size,hashlib.sha256(final.read_bytes()).hexdigest())
