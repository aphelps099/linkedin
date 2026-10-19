"""Clean the approved Synthia plate and make its restrained motion loop continuous.

No generation or redesign. Keep eyes, cup, headset, name badge and metal intact.
The original video stays available; only decorative green mouth pixels are masked.
"""
import hashlib,json,subprocess
from pathlib import Path
import cv2,numpy as np

ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'public/studio/season/clips/synthia-listening.mp4'
target=ROOT/'public/studio/season/clips/synthia-camera-v2-listening.mp4'
tracking_path=ROOT/'src/meeting-room/robot-tracking.json'
tracking=json.loads(tracking_path.read_text())
archive=ROOT/'assets/meeting-performances/synthia-v2';archive.mkdir(parents=True,exist_ok=True)
original_path=archive/'source-tracking.json'
if not original_path.exists():original_path.write_text(json.dumps(tracking['synthia'],separators=(',',':'))+'\n')
track=json.loads(original_path.read_text())
cap=cv2.VideoCapture(str(source));frames=[];changed=0
for x,y,angle,scale in track['frames']:
    ok,frame=cap.read();assert ok
    rotation=np.array([[np.cos(angle),-np.sin(angle)],[np.sin(angle),np.cos(angle)]])
    polygon=np.array([[-38,-10],[38,-10],[38,10],[-38,10]])@rotation.T*scale+[x,y]
    region=np.zeros(frame.shape[:2],np.uint8);cv2.fillConvexPoly(region,np.rint(polygon).astype(np.int32),255)
    b,g,r=cv2.split(frame.astype(float))
    dots=(((g>r*1.4)&(g>b*1.3)&(g>55))&(region>0)).astype(np.uint8)*255
    dots=cv2.dilate(dots,np.ones((5,5),np.uint8))
    dots=cv2.bitwise_and(dots,region)
    clean=cv2.inpaint(frame,dots,3,cv2.INPAINT_TELEA)
    assert np.array_equal(clean[dots==0],frame[dots==0]),'Pixels outside the mouth must be unchanged'
    changed+=int(np.count_nonzero(dots));frames.append(clean)
cap.release()
indices=list(range(len(frames)))+list(range(len(frames)-2,0,-1))
encoder=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r','24','-i','-',
    '-an','-c:v','libx264','-crf','21','-preset','medium','-g','24','-keyint_min','24','-sc_threshold','0','-bf','0','-movflags','+faststart',str(target)],stdin=subprocess.PIPE)
for i in indices:encoder.stdin.write(frames[i].tobytes())
encoder.stdin.close();assert encoder.wait()==0
tracking['synthia']={'fps':24,'frames':[track['frames'][i] for i in indices]}
tracking_path.write_text(json.dumps(tracking,separators=(',',':'))+'\n')
subprocess.run(['ffmpeg','-v','error','-y','-ss','0.25','-i',str(target),'-frames:v','1',str(ROOT/'public/studio/season/posters/synthia-camera-v2-listening.jpg')],check=True)
(archive/'production.json').write_text(json.dumps({'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
    'target':str(target.relative_to(ROOT)),'targetSha256':hashlib.sha256(target.read_bytes()).hexdigest(),
    'frames':len(indices),'fps':24,'credits':0,'sourceFrames':len(frames),'mouthOnlyMaskPixels':changed,
    'loop':'Forward, then reverse without duplicate end frames. Matching source/tracking order.',
    'face':'Original green mouth pixels removed offline. Runtime has no opaque patch. Same fixed 6px horizontal row as Synergy.',
    'continuity':'Same Synthia, scarf, cup, headset, badge, voice and original green eyes. Synergy media unchanged.'},indent=2)+'\n')
print('Synthia:',len(indices),'frames; mouth-only cleanup; zero credits; bytes',target.stat().st_size)
