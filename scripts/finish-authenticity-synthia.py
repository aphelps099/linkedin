"""Finish the 30-second Authenticity Rollout ending with Synthia's own reply.

Inputs: original source, wide repair, generated laptop close-up, voice, output.
The fixed-height LED row is composited after animation, never generated speech.
"""
import sys,json,hashlib,subprocess
from pathlib import Path
import cv2,numpy as np
from scipy.io import wavfile
from scipy.signal import savgol_filter

source,wide,closeup,voice,out=map(Path,sys.argv[1:6])
SR=48000;FPS=24;CUT_IN=19.;CUT_OUT=26.;VOICE_IN=23.8;CLIP_IN=1.5;CLIP_RATE=1.2

def decode_audio(path,channels):
    return np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ar',str(SR),'-ac',str(channels),'-f','f32le','-']),dtype='<f4').reshape(-1,channels).copy()

audio=decode_audio(source,2);vo=decode_audio(voice,1)[:,0]
nonzero=np.flatnonzero(abs(vo)>.006)
vo=vo[max(0,nonzero[0]-1200):min(len(vo),nonzero[-1]+3600)]
vo*=.09/max(.001,np.sqrt(np.mean(vo*vo)))
fade=240;vo[:fade]*=np.linspace(0,1,fade);vo[-fade:]*=np.linspace(1,0,fade)
# Replace the old male reply with one preceding instrumental bar at 92 BPM.
# Both crossfades are outside the old spoken phrase (21.68–23.72 seconds).
a=round(21.57*SR);b=round(24.23*SR);shift=round((240/92)*SR)
patch=audio[a-shift:b-shift].copy();blend=np.ones(b-a,np.float32)
fade=round(.045*SR);blend[:fade]=np.linspace(0,1,fade);blend[-fade:]=np.linspace(1,0,fade)
audio[a:b]=patch*blend[:,None]+audio[a:b]*(1-blend[:,None])
start=round(VOICE_IN*SR);audio[start:start+len(vo)]+=vo[:,None]
assert np.max(abs(audio))<1,'Audio would clip'
mix=out.with_suffix('.wav');wavfile.write(mix,SR,audio)

# Close-up tracking and mouth parameters are approved against its first frame.
config=json.loads(closeup.with_suffix('.face.json').read_text())
x0,y0,rw,rh=535,110,170,145
screen=np.array(config['referenceQuad'],np.float32)-[x0,y0]
cap=cv2.VideoCapture(str(closeup));clip_fps=cap.get(cv2.CAP_PROP_FPS);frames=[]
while True:
    ok,frame=cap.read()
    if not ok:break
    frames.append(cv2.resize(frame,(1280,720),interpolation=cv2.INTER_AREA))
cap.release();assert len(frames)/clip_fps>=CLIP_IN+(CUT_OUT-CUT_IN)*CLIP_RATE
reference=frames[0][y0:y0+rh,x0:x0+rw].copy()
quads=np.load(closeup.with_suffix('.quads.npy'))
plate=reference.copy();old=np.zeros((rh,rw),np.uint8)
cv2.fillConvexPoly(old,np.array(config['mouth_cleanup'],np.int32)-[x0,y0],255)
plate=cv2.inpaint(plate,old,5,cv2.INPAINT_TELEA)
display=np.zeros((rh,rw),np.float32);cv2.fillConvexPoly(display,np.rint(screen).astype(np.int32),1)
display=cv2.GaussianBlur(display,(3,3),.5)
mouth=np.array(config['mouth_line'],float)-[x0,y0]
silent=out.with_name(out.stem+'-silent.mp4')
enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','1280x720','-r',str(FPS),'-i','-','-an','-c:v','libx264','-crf','17','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)],stdin=subprocess.PIPE)
cap=cv2.VideoCapture(str(wide));i=0;reviews=[]
while True:
    ok,frame=cap.read()
    if not ok:break
    t=i/FPS
    if CUT_IN<=t<CUT_OUT:
        j=min(len(frames)-1,round((CLIP_IN+(t-CUT_IN)*CLIP_RATE)*clip_fps));frame=frames[j].copy()
        offset=t-VOICE_IN;lo=max(0,round((offset-.025)*SR));hi=min(len(vo),round((offset+.025)*SR))
        level=min(1,np.sqrt(np.mean(vo[lo:hi]**2))/.15) if 0<=offset<len(vo)/SR and hi>lo else 0
        active=level>.045;paint=plate.astype(np.float32).copy()
        scale=4;light=np.zeros((rh*scale,rw*scale,3),np.float32);phase=(offset*23)%22
        for led in range(22):
            xy=mouth[0]+(mouth[1]-mouth[0])*led/21
            distance=(phase-led+22)%22
            strength=float(.05+(max(0,1-distance/7)*(.45+.55*level) if active else 0))
            x,y=xy*scale
            cv2.rectangle(light,(round(x),round(y-1.5*scale)),(round(x+2.1*scale),round(y+1.5*scale)),(60*strength,240*strength,75*strength),-1)
        light=cv2.resize(light,(rw,rh),interpolation=cv2.INTER_AREA)
        paint=np.clip(paint+light+cv2.GaussianBlur(light,(3,3),.55)*.12,0,255).astype(np.uint8)
        mat=cv2.getPerspectiveTransform(screen.astype(np.float32),quads[j].astype(np.float32))
        warped=cv2.warpPerspective(paint,mat,(1280,720),flags=cv2.INTER_LINEAR)
        alpha=cv2.warpPerspective(display,mat,(1280,720),flags=cv2.INTER_LINEAR)[...,None]
        frame=np.clip(warped*alpha+frame*(1-alpha),0,255).astype(np.uint8)
    elif t>=CUT_OUT:
        # Finish on the continuously printing tray. Do not cut back to a wide
        # angle whose original Synthia position has no newly opened laptop.
        frame=cv2.resize(frame[400:709,730:1280],(1280,720),interpolation=cv2.INTER_LANCZOS4)
    enc.stdin.write(frame.tobytes())
    if i in [0,120,408,456,480,504,528,540,552,564,576,600,624,648,696]:reviews.append((t,frame.copy()))
    i+=1
cap.release();enc.stdin.close();assert enc.wait()==0
subprocess.run(['ffmpeg','-v','error','-y','-i',str(silent),'-i',str(mix),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t',str(i/FPS),'-movflags','+faststart',str(out)],check=True)
from PIL import Image,ImageDraw
sheet=Image.new('RGB',(1280,840),'#161616');draw=ImageDraw.Draw(sheet)
for k,(t,f) in enumerate(reviews):
    x=k%4*320;y=k//4*210;sheet.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y+25));draw.text((x+8,y+5),f'{t:.2f}s',fill='white')
sheet.save(out.with_suffix('.jpg'))
proof={'sourceAsset':'6f1d11bd-024a-403f-8f7c-829100167801','synthiaTask':'8816c3c6-0bcb-4404-a3d1-6c05cda0bfb5','credits':170,'purpose':'Closing movement of longer Authenticity Rollout, not a new opening','resolution':[1280,720],'fps':FPS,'frames':i,'closeup':[CUT_IN,CUT_OUT],'voice':{'character':'Synthia','text':'Then we will schedule a follow-up.','provider':'flite','voice':'slt','pitch':1.04,'start':VOICE_IN,'end':VOICE_IN+len(vo)/SR},'audioReplacement':[a/SR,b/SR],'mouth':'22 LEDs, fixed 3px height, brightness scrolls left to right, aligned to Synthia voice only; original eyes and glass retained','trackingMinInliers':config['minimumInliers'],'clipSourceIn':CLIP_IN,'clipRate':CLIP_RATE,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'closeupSha256':hashlib.sha256(closeup.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest()}
out.with_suffix('.json').write_text(json.dumps(proof,indent=2)+'\n');np.save(out.with_suffix('.tracking.npy'),quads)
print(json.dumps(proof),flush=True)
