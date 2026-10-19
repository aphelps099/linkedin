"""Three original, understated plucked-string guitar answers in F-sharp minor.
One bar at 88 BPM, mild amp/cabinet coloration, short slapback. No external API.
"""
import hashlib,json,subprocess,tempfile
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter,sosfilt
ROOT=Path(__file__).resolve().parents[1];SR=32000;beat=60/88;length=round(4*beat*SR)
rng=np.random.default_rng(1988)
def string(note,duration):
    frequency=440*2**((note-69)/12);delay=round(SR/frequency)
    n=round(duration*SR);x=np.zeros(n);x[:delay]=rng.uniform(-1,1,delay)
    x[:delay]-=np.mean(x[:delay])
    for i in range(delay,n):x[i]=.996*(x[i-delay]+x[i-delay+1])*.5
    t=np.arange(n)/SR;x*=np.exp(-t*1.7)
    x=sosfilt(butter(2,[100,5000],btype='bandpass',fs=SR,output='sos'),x)
    x=np.tanh(x*2.4)/2.4
    x[:80]*=np.linspace(0,1,80);x[-240:]*=np.linspace(1,0,240)
    return x
phrases=[[(0,66),(.5,69),(.75,73),(1.25,69),(1.75,66)],
         [(0,73),(.5,69),(1,66),(1.75,64),(2.25,66)],
         [(0,66),(.75,66),(1,69),(1.5,73),(2,69)]]
parts=[]
for phrase in phrases:
    x=np.zeros((length,2))
    for i,(when,note) in enumerate(phrase):
        at=round((when*beat+(.008 if i%2 else 0))*SR)
        pluck=string(note,min(.85,(length-at)/SR))*(.55 if i==0 else .46)
        n=min(len(pluck),length-at);x[at:at+n]+=pluck[:n,None]*np.array([.75,.65])
        echo=at+round(.105*SR);n=min(len(pluck),length-echo)
        if n>0:x[echo:echo+n]+=pluck[:n,None]*np.array([.10,.17])
    x[-640:]*=np.linspace(1,0,640)[:,None];parts.append(x)
audio=np.concatenate(parts);audio*=.55/max(.001,np.max(abs(audio)))
out=ROOT/'public/studio/season/audio'
with tempfile.TemporaryDirectory() as d:
    wav=Path(d)/'guitar.wav';mp3=Path(d)/'guitar.mp3'
    wavfile.write(wav,SR,(audio*32767).astype(np.int16))
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','128k',str(mp3)],check=True)
    data=mp3.read_bytes();name=f'founder-guitar-{hashlib.sha256(data).hexdigest()[:12]}.mp3';(out/name).write_bytes(data)
meta={'file':name,'key':'F-sharp minor','bpm':88,'variants':[{'offset':i*length/SR,'duration':length/SR} for i in range(3)]}
(ROOT/'src/meeting-room/guitar-fills.json').write_text(json.dumps(meta,separators=(',',':'))+'\n')
print(name,len(data),'bytes; three original one-bar guitar fills')
