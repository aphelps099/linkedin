"""Build the four room anthems from Runway instrumental MP3s + vintage robots.

Usage: python scripts/render-room-anthems.py /path/to/room-production
Keeps instrumental beds separate from speech; no generated singer reaches the site.
Requires the same numpy/scipy/FFmpeg environment as render-studio2.py.
"""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(sys.argv[1])
OUT=ROOT/'public/studio/rooms/audio'
OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('renderer',ROOT/'scripts/render-studio2.py')
renderer=importlib.util.module_from_spec(spec);spec.loader.exec_module(renderer)
renderer.OUT=OUT
SR=renderer.SR
rooms=json.loads((ROOT/'src/meeting-studio/rooms.json').read_text())

def decode(path):
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ar',str(SR),'-ac','2','-f','f32le','-'])
    return np.frombuffer(raw,dtype=np.float32).reshape(-1,2)

def grid(x,target):
    # Estimate one steady drum grid near the requested tempo, from spectral flux.
    mono=x.mean(axis=1)
    _,t,z=signal.stft(mono,fs=SR,nperseg=1024,noverlap=896)
    flux=np.maximum(np.diff(np.abs(z),axis=1),0).sum(axis=0)
    flux=signal.sosfilt(signal.butter(2,22,fs=SR/128,output='sos'),flux)
    t=t[1:];best=(-1,None,None)
    for bpm in np.arange(target*.94,target*1.06,.05):
        beat=60/bpm
        for phase in np.arange(.025,beat,.008):
            ticks=np.arange(phase,min(len(x)/SR,27),beat)
            score=np.mean(np.interp(ticks,t,flux))
            if score>best[0]:best=(score,float(bpm),float(phase))
    return best[1],best[2]

original_speech=renderer.speech
cache={}
def robot_speech(text,speaker,temp):
    key=(text,speaker)
    if key in cache:return cache[key]
    x=original_speech(text,speaker,temp)
    t=np.arange(len(x))/SR
    carrier=signal.sawtooth(2*np.pi*(112 if speaker=='M' else 188)*t)
    y=np.zeros_like(x)
    edges=np.geomspace(140,4200,19)
    for low,high in zip(edges[:-1],edges[1:]):
        filt=signal.butter(2,[low,high],fs=SR,btype='bandpass',output='sos')
        voice=signal.sosfilt(filt,x)
        env=signal.sosfilt(signal.butter(2,28,fs=SR,output='sos'),np.abs(voice))
        tone=signal.sosfilt(filt,carrier)
        y+=tone/(np.sqrt(np.mean(tone*tone))+1e-8)*env
    y*=np.sqrt(np.mean(x*x))/(np.sqrt(np.mean(y*y))+1e-8)
    y=.72*y+.28*x # retain consonants; the carrier fixes the apparent pitch
    y*=.115/(np.sqrt(np.mean(y*y))+1e-8)
    y=np.tanh(y*1.1)*.80
    ramp=min(160,len(y)//2)
    y[:ramp]*=np.linspace(0,1,ramp);y[-ramp:]*=np.linspace(1,0,ramp)
    cache[key]=y
    return y
renderer.speech=robot_speech

result={'sampleRate':SR,'tracks':{}}
with tempfile.TemporaryDirectory(prefix='room-anthems-') as folder:
    temp=Path(folder)
    for track in rooms['tracks']:
        name=track['id'];x=decode(SOURCE/(name+'.mp3'))
        bpm,phase=grid(x,track['bpm'])
        # Keep onsets at the musical downbeat; the STFT analysis has a small lag.
        start=max(0,phase-.012)
        target=round(32*60/track['bpm']*SR)
        wav=temp/(name+'.wav')
        subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-i',str(SOURCE/(name+'.mp3')),'-af',f'aresample={SR},atempo={track["bpm"]/bpm},apad,atrim=end_sample={target}','-ar',str(SR),'-ac','2',str(wav)],check=True)
        _,bed=wavfile.read(wav);bed=bed.astype(float)/32768
        # Guard the exact eight-bar sample count after tempo correction.
        bed=bed[:target]
        if len(bed)<target:bed=np.pad(bed,((0,target-len(bed)),(0,0)))
        bed*=.64/max(.01,float(np.max(abs(bed))))
        fade=round(.006*SR)
        bed[:fade]*=np.linspace(0,1,fade)[:,None];bed[-fade:]*=np.linspace(1,0,fade)[:,None]
        renderer.encode(bed,OUT/(name+'-music.mp3'),temp)
        pairs=track['pairs']+track['visionary']
        vocal=renderer.voices(name,[line for pair in pairs for line in pair],temp)
        renderer.validate_pairs(pairs,vocal,track['bpm'])
        vocal['file']='/studio/rooms/audio/'+vocal['file']
        result['tracks'][name]={'music':{'file':f'/studio/rooms/audio/{name}-music.mp3','mode':'bed','duration':target/SR,'stems':{'bed':{'start':0,'duration':target/SR}},'sourceTaskId':track['sourceTaskId'],'measuredSourceBpm':round(bpm,2),'sourceStart':round(start,4)},'voice':vocal}
        print(f'{name}: source grid {bpm:.2f} BPM, loop {target/SR:.3f}s, independent flat-pitch robot phrases',flush=True)
    (ROOT/'src/meeting-studio/room-audio.json').write_text(json.dumps(result,indent=2)+'\n')
