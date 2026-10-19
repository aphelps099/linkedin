"""Remove only the generated decorative mouth dots before drawing live speech.

Usage: python scripts/clean-synergy-plate.py INPUT.mp4 OUTPUT.mp4
Tracking must describe INPUT. No eyes, glass border, headset or chassis are
altered. A tiny dot mask is reconstructed from surrounding glass pixels; no
opaque runtime patch is needed. Keep the original source master in the repo.
"""
import json, subprocess, sys
from pathlib import Path
import cv2
import numpy as np

root = Path(__file__).resolve().parents[1]
track = json.loads((root/'src/meeting-room/robot-tracking.json').read_text())['synergy']
cap = cv2.VideoCapture(sys.argv[1])
encoder = subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24',
    '-s','1280x720','-r',str(track['fps']),'-i','-','-an','-c:v','libx264','-crf','20',
    '-preset','medium','-movflags','+faststart',sys.argv[2]],stdin=subprocess.PIPE)
count = 0
for x,y,angle,scale in track['frames']:
    ok,frame = cap.read()
    if not ok: raise ValueError('Plate shorter than tracking')
    rotation = np.array([[np.cos(angle),-np.sin(angle)],[np.sin(angle),np.cos(angle)]])
    polygon = np.array([[-36,-9],[36,-9],[36,9],[-36,9]])@rotation.T*scale+[x,y]
    region = np.zeros(frame.shape[:2],np.uint8)
    cv2.fillConvexPoly(region,np.rint(polygon).astype(np.int32),255)
    b,g,r = cv2.split(frame.astype(float))
    dots = (((g>r*1.4)&(g>b*1.3)&(g>60))& (region>0)).astype(np.uint8)*255
    dots = cv2.dilate(dots,np.ones((5,5),np.uint8))
    frame = cv2.inpaint(frame,dots,3,cv2.INPAINT_TELEA)
    encoder.stdin.write(frame.tobytes())
    count += 1
encoder.stdin.close()
if encoder.wait(): raise RuntimeError('Video encode failed')
cap.release()
print(f'Cleaned {count} frames; all eyes and metal preserved.')
