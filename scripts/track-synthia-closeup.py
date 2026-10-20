"""Track the planar display bezel independently of the generated face pixels."""
import sys,json
from pathlib import Path
import cv2,numpy as np
from scipy.signal import savgol_filter
source=Path(sys.argv[1]);c=cv2.VideoCapture(str(source));frames=[]
while True:
    ok,f=c.read()
    if not ok:break
    frames.append(cv2.resize(f,(1280,720)))
quad=np.array([[553,158],[681,127],[688,220],[560,236]],np.float32)
quads=[quad.copy()];counts=[]
for i in range(1,len(frames)):
    before=cv2.cvtColor(frames[i-1],cv2.COLOR_BGR2GRAY);after=cv2.cvtColor(frames[i],cv2.COLOR_BGR2GRAY)
    center=quad.mean(axis=0);outer=(quad-center)*1.25+center;inner=(quad-center)*.87+center
    mask=np.zeros(before.shape,np.uint8);cv2.fillConvexPoly(mask,np.rint(outer).astype(np.int32),255);cv2.fillConvexPoly(mask,np.rint(inner).astype(np.int32),0)
    points=cv2.goodFeaturesToTrack(before,120,.006,3,mask=mask,blockSize=5)
    nxt,ok,_=cv2.calcOpticalFlowPyrLK(before,after,points,None,winSize=(21,21),maxLevel=3,criteria=(3,50,.001))
    back,ok2,_=cv2.calcOpticalFlowPyrLK(after,before,nxt,None,winSize=(21,21),maxLevel=3,criteria=(3,50,.001))
    good=(ok[:,0]>0)&(ok2[:,0]>0)&(np.linalg.norm((back-points)[:,0],axis=1)<.6)
    a=points[good];b=nxt[good];h,inliers=cv2.findHomography(a,b,cv2.RANSAC,1.2)
    assert h is not None and sum(good)>=8,(i,sum(good))
    quad=cv2.perspectiveTransform(quad[None],h)[0];quads.append(quad.copy());counts.append(int(inliers.sum()))
quads=savgol_filter(np.array(quads),7,2,axis=0)
np.save(source.with_suffix('.quads.npy'),quads)
from PIL import Image,ImageDraw
sheet=Image.new('RGB',(1280,720),'#111');d=ImageDraw.Draw(sheet)
for k,i in enumerate(range(0,len(frames),24)):
    f=frames[i].copy();cv2.polylines(f,[np.rint(quads[i]).astype(np.int32)],True,(0,0,255),1)
    crop=f[90:280,420:840];x=k%4*320;y=k//4*240
    sheet.paste(Image.fromarray(cv2.cvtColor(crop,cv2.COLOR_BGR2RGB)).resize((320,210)),(x,y+25));d.text((x+8,y+5),f'{i/24:.1f}s',fill='white')
sheet.save(source.with_suffix('.tracking-review.jpg'))
source.with_suffix('.face.json').write_text(json.dumps({'referenceQuad':[[553,158],[681,127],[688,220],[560,236]],'mouth_cleanup':[[602,210],[648,204],[649,219],[604,226]],'mouth_line':[[593,216],[657,207]],'tracking':'Optical flow of planar bezel, RANSAC homography, forward/backward check, 7-frame smoothing','minimumInliers':min(counts)},indent=2)+'\n')
print('Minimum inliers',min(counts),'last quad',quads[-1].tolist())
