from pathlib import Path
import cv2,numpy as np,json
root=Path(__file__).resolve().parents[5]/'optimizing/shorts/assets';allmaps={}
for who,roi in [('strategy',(460,130,850,460)),('linda',(460,160,820,480))]:
 files=sorted((root/who).glob('*.jpg'));ref=cv2.cvtColor(cv2.imread(str(files[0])),cv2.COLOR_BGR2GRAY);mask=np.zeros_like(ref);x,y,x2,y2=roi;mask[y:y2,x:x2]=255
 points=cv2.goodFeaturesToTrack(ref,140,.01,7,mask=mask);maps=[]
 for p in files:
  frame=cv2.cvtColor(cv2.imread(str(p)),cv2.COLOR_BGR2GRAY);dst,status,err=cv2.calcOpticalFlowPyrLK(ref,frame,points,None,winSize=(25,25),maxLevel=3)
  ok=status[:,0]==1;M,inliers=cv2.estimateAffinePartial2D(points[ok],dst[ok],method=cv2.RANSAC,ransacReprojThreshold=2)
  if M is None or np.count_nonzero(inliers)<12:raise ValueError(p)
  maps.append(np.round(M,5).tolist())
 allmaps[who]=maps
(root/'reaction-maps.json').write_text(json.dumps(allmaps))
