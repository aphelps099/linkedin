"""Repair the archived 30-second conference ending without generative pixels.
Usage: python scripts/fix-conference-followup.py SOURCE OUTPUT TRANSCRIPT
Preserves the original AAC stream, rigid head and a fixed-height sideways LED row.
"""
import sys,json,hashlib,subprocess
from pathlib import Path
import cv2,numpy as np
from scipy.signal import savgol_filter
source,out,transcript=map(Path,sys.argv[1:4]);out.parent.mkdir(parents=True,exist_ok=True)
wide_only='--wide-only' in sys.argv[4:]
cap=cv2.VideoCapture(str(source));fps=cap.get(cv2.CAP_PROP_FPS);frames=[]
while True:
    ok,f=cap.read()
    if not ok:break
    frames.append(f)
cap.release();h,w=frames[0].shape[:2]
# Track the stable metal and bezel; never track the generated changing display.
x0,y0,rw,rh=425,115,155,118
reference=frames[0][y0:y0+rh,x0:x0+rw]
gray=cv2.cvtColor(reference,cv2.COLOR_BGR2GRAY).astype(np.float32)/255
mask=np.ones((rh,rw),np.uint8)*255
mask[46:98,49:109]=0
warp=np.eye(2,3,dtype=np.float32);matrices=[];scores=[]
for i,frame in enumerate(frames):
    crop=cv2.cvtColor(frame[y0:y0+rh,x0:x0+rw],cv2.COLOR_BGR2GRAY).astype(np.float32)/255
    try:score,warp=cv2.findTransformECC(gray,crop,warp,cv2.MOTION_AFFINE,(cv2.TERM_CRITERIA_EPS|cv2.TERM_CRITERIA_COUNT,100,1e-6),mask,5)
    except cv2.error:score=0
    matrices.append(warp.copy());scores.append(float(score))
    if i%240==0:print('Tracked',i,flush=True)
matrices=savgol_filter(np.array(matrices),9,2,axis=0)
# Use the source's own clean glass and eyes. Remove only its weak old mouth.
plate=reference.copy();old=np.zeros((rh,rw),np.uint8)
cv2.fillConvexPoly(old,np.array([[492-x0,193-y0],[518-x0,192-y0],[518-x0,199-y0],[492-x0,200-y0]]),255)
# Keep the real lower metal edge; only remove the glowing old mouth from glass.
black=np.median(reference[188-y0:192-y0,496-x0:515-x0],axis=(0,1))
soft=cv2.GaussianBlur(old.astype(np.float32)/255,(3,3),.5)[...,None]
plate=np.clip(plate*(1-soft)+black*soft,0,255).astype(np.uint8)
mask=np.zeros((rh,rw),np.float32)
# Include the narrow metal cheek: the generated beam spills outside the glass.
# Restore its own neutral source metal, rather than leaving a blinking green edge.
cv2.fillConvexPoly(mask,np.array([[466-x0,169-y0],[534-x0,159-y0],[536-x0,209-y0],[468-x0,213-y0]]),1)
mask=cv2.GaussianBlur(mask,(3,3),.55)
segments=json.loads(transcript.read_text());words=[word for s in segments if s['text'].strip()!='What if I’m not excited?' and 'What if' not in s['text'] for word in s['words']]
if wide_only:words=[word for word in words if word['start']<19]
audio=np.frombuffer(subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ac','1','-ar','24000','-f','f32le','-']),dtype='<f4')
silent=out.with_name(out.stem+'-silent.mp4')
enc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{w}x{h}','-r',str(fps),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',str(silent)],stdin=subprocess.PIPE)
review=[]
for i,frame in enumerate(frames):
    t=i/fps;paint=plate.copy();active=any(word['start']-.025<=t<=word['end']+.045 for word in words)
    samples=audio[max(0,int((t-.02)*24000)):int((t+.02)*24000)]
    level=min(1,float(np.sqrt(np.mean(samples*samples)))/.13) if len(samples) and active else 0
    # Subpixel rasterization gives a stable 1.4-source-pixel row, never a tall EQ.
    scale=4;light=np.zeros((rh*scale,rw*scale,3),np.float32);phase=(t*18)%18
    for led in range(18):
        distance=(phase-led+18)%18
        strength=.07+(max(0,1-distance/6)*(.35+.65*level) if active else 0)
        x=(492.8-x0+led*1.3)*scale;y=(194.7-y0-led*.055)*scale
        cv2.rectangle(light,(round(x),round(y-.7*scale)),(round(x+.85*scale),round(y+.7*scale)),(65*strength,225*strength,80*strength),-1)
    light=cv2.resize(light,(rw,rh),interpolation=cv2.INTER_AREA)
    paint=np.clip(paint.astype(float)+light+cv2.GaussianBlur(light,(3,3),.5)*.14,0,255).astype(np.uint8)
    a=matrices[i];warped=cv2.warpAffine(paint,a,(rw,rh),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
    alpha=cv2.warpAffine(mask,a,(rw,rh),flags=cv2.INTER_LINEAR)[...,None]
    fixed=frame.copy();roi=fixed[y0:y0+rh,x0:x0+rw]
    fixed[y0:y0+rh,x0:x0+rw]=np.clip(warped*alpha+roi*(1-alpha),0,255).astype(np.uint8)
    # A deliberate cut into the speaker, then back to the room after the button.
    if not wide_only and 21.35<=t<24.6:
        fixed=cv2.resize(fixed[110:110+216,280:280+384],(w,h),interpolation=cv2.INTER_LANCZOS4)
    enc.stdin.write(fixed.tobytes())
    if i in [0,120,192,336,480,516,528,552,576,600,696]:review.append((t,fixed.copy()))
enc.stdin.close();assert enc.wait()==0
subprocess.run(['ffmpeg','-v','error','-y','-i',str(silent),'-i',str(source),'-map','0:v:0','-map','1:a:0','-c','copy','-movflags','+faststart',str(out)],check=True)
def audio_hash(path):return hashlib.sha256(subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-map','0:a:0','-c','copy','-f','adts','-'])).hexdigest()
assert audio_hash(source)==audio_hash(out)
from PIL import Image,ImageDraw
sheet=Image.new('RGB',(1280,780),'#111111');draw=ImageDraw.Draw(sheet)
for j,(t,f) in enumerate(review):
    x=j%4*320;y=j//4*260;sheet.paste(Image.fromarray(cv2.cvtColor(f,cv2.COLOR_BGR2RGB)).resize((320,180)),(x,y+20));draw.text((x,y),f'{t:.2f}s',fill='white')
sheet.save(out.with_suffix('.jpg'))
proof={'sourceAsset':'6f1d11bd-024a-403f-8f7c-829100167801','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'audioUnchanged':True,'audioAacSha256':audio_hash(out),'frameCount':len(frames),'fps':fps,'closeup':[21.35,24.6],'crop':[280,110,384,216],'mouth':'18 LEDs, fixed 1.4px height at source resolution; brightness travels left to right; source eyes retained','trackingMinCorrelation':min(scores),'trackingMedianCorrelation':float(np.median(scores)),'creditsUsed':0}
if wide_only:proof.update(closeup=None,crop=None,closingSpeaker='Synthia insert supplied by separate finishing pass',sideGlow='Source-neutral metal restored with the same tracked plate as the glass')
out.with_suffix('.json').write_text(json.dumps(proof,indent=2)+'\n')
np.save(out.with_suffix('.tracking.npy'),matrices);silent.unlink();print(json.dumps(proof),flush=True)
