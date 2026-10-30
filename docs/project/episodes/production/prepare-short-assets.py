"""Recover existing office plates, extract human reactions and track banner corners.
No generation API is used. Original media hashes must match the project catalog.
"""
from pathlib import Path
import subprocess,sys,json,hashlib,urllib.request
import cv2,numpy as np,imageio_ffmpeg
REPO=Path(__file__).resolve().parents[4];ROOT=REPO.parent/'optimizing/shorts/assets';ROOT.mkdir(parents=True,exist_ok=True);FF=imageio_ffmpeg.get_ffmpeg_exe()
items=[('banner-installation','banner-installation-blank-plates-226c59ad','226c59adf5c19fb7e7298f119950006f937c645aedee42e5e6a929a71a445bd8'),('synthia-clean','synthia-clean-face-plate-7e0cf1cc',None)]
catalog=json.loads((REPO/'src/cutting-room/catalog.json').read_text());entries=catalog.get('assets',catalog.get('items',[]));manifest=[]
for name,asset,expected in items:
 record=next(x for x in entries if x['id']==asset);expected=expected or record['sha256'];p=ROOT/(name+'.mp4')
 if not p.exists():urllib.request.urlretrieve('https://linkedinbeats.com'+record['src'],p)
 sha=hashlib.sha256(p.read_bytes()).hexdigest();assert sha==expected,(name,sha)
 subprocess.run([FF,'-v','error','-y','-i',str(p),'-frames:v','1',str(ROOT/(name+'.png'))],check=True)
 manifest.append({'file':p.name,'catalog_id':asset,'sha256':sha,'new_generation':False})
for who in ['strategy','linda','crew']:
 dest=ROOT/who;dest.mkdir(exist_ok=True);source=ROOT/'banner-installation.mp4' if who=='crew' else REPO/f'public/studio/season/clips/{who}-listening.mp4'
 subprocess.run([FF,'-v','error','-y','-i',str(source),'-t','4' if who=='crew' else '5','-vf','fps=12,scale=1280:720','-q:v','2',str(dest/'%03d.jpg')],check=True)
 if who!='crew':manifest.append({'file':str(source.relative_to(REPO)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'new_generation':False})
subprocess.run([sys.executable,str(Path(__file__).with_name('track-short-reactions.py'))],check=True)
quads=[]
for p in sorted((ROOT/'crew').glob('*.jpg')):
 hsv=cv2.cvtColor(cv2.imread(str(p)),cv2.COLOR_BGR2HSV);m=cv2.inRange(hsv,np.array([90,120,60]),np.array([125,255,255]));m[:40]=0;m[640:]=0;m[:,:500]=0;m[:,815:]=0
 contours,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE);pts=cv2.boxPoints(cv2.minAreaRect(max(contours,key=cv2.contourArea)))
 left=sorted(pts.tolist(),key=lambda p:p[0])[:2];right=sorted(pts.tolist(),key=lambda p:p[0])[2:];left.sort(key=lambda p:p[1]);right.sort(key=lambda p:p[1]);quads.append([left[0],right[0],right[1],left[1]])
(ROOT/'banner-quads.json').write_text(json.dumps(quads))
(ROOT/'source-manifest.json').write_text(json.dumps({'sources':manifest,'new_runway_generations':0,'human_reaction_fps':12},indent=2)+'\n')
print('Original assets verified; frame caches and tracking maps ready.')
