"""Track the existing display LEDs; the speech strip never changes vertical size.
Requires OpenCV only to prepare the metadata, not on the production server.
"""
from pathlib import Path
import json, cv2, numpy as np
from scipy.signal import savgol_filter
ROOT=Path(__file__).resolve().parents[1]
result={}
for who in ['synergy','synthia']:
    cap=cv2.VideoCapture(str(ROOT/f'public/studio/season/clips/{who}-listening.mp4'))
    positions=[];anchor=None
    while True:
        ok,im=cap.read()
        if not ok:break
        b,g,r=cv2.split(im.astype(float))
        mask=((g>r*1.4)&(g>b*1.3)&(g>75)).astype('uint8')
        mask[:130]=0;mask[340:]=0;mask[:,:520]=0;mask[:,820:]=0
        mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,5),np.uint8))
        _,_,stats,centers=cv2.connectedComponentsWithStats(mask)
        pieces=[(s,c) for s,c in zip(stats[1:],centers[1:]) if s[4]>70]
        mouths=[(s,c) for s,c in pieces if s[2]>s[3]*2]
        eyes=sorted([(s,c) for s,c in pieces if .55<s[2]/s[3]<1.7],key=lambda x:x[1][0])
        if len(eyes)!=2:
            positions.append([float('nan')]*4)
            continue
        delta=eyes[1][1]-eyes[0][1]
        midpoint=(eyes[1][1]+eyes[0][1])/2
        angle=np.arctan2(delta[1],delta[0]);scale=np.linalg.norm(delta)/70
        rot=np.array([[np.cos(angle),-np.sin(angle)],[np.sin(angle),np.cos(angle)]])
        if anchor is None:
            if not mouths:raise ValueError('First frame must have a mouth reference')
            _,mouth=max(mouths,key=lambda x:x[1][1])
            anchor=rot.T@(mouth-midpoint)/scale
        mouth=midpoint+rot@anchor*scale
        positions.append([*mouth,angle,scale])
    positions=np.array(positions)
    missing=np.isnan(positions[:,0]);print(who,'blink frames:',int(missing.sum()))
    if missing.sum()>len(positions)*.10:raise ValueError('Too many untracked frames')
    for column in range(4):
        positions[:,column]=np.interp(np.arange(len(positions)),np.flatnonzero(~missing),positions[~missing,column])
    smooth=savgol_filter(np.array(positions),9,2,axis=0)
    result[who]={'fps':24,'frames':np.round(smooth,4).tolist()}
    print(who,len(positions),'tracked frames')
(ROOT/'src/meeting-room/robot-tracking.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
