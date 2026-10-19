"""Render the authored meeting season locally. No paid voice or generation APIs.

Uses the same Flite voice family and original stem recordings as Studio 2.
Run after `node --input-type=module -e "import {library} from './src/meeting-room/scripts.js';
import {writeFileSync} from 'node:fs';writeFileSync('/tmp/meeting-scripts.json',JSON.stringify(library))"`.
"""
import json, math, subprocess, tempfile
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, resample

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/studio/season/audio'
SR=24000
LIB=json.loads(Path('/tmp/meeting-scripts.json').read_text())
STEMS=json.loads((ROOT/'src/studio-2/audio-manifest.json').read_text())['tracks']
BEDS={'standup':'offline','onboarding':'circle-back','unlock':'alignment','paperless':'no-action','founder':'humbled','offline':'offline','quarterly':'synergy'}
# Stable voices belong to characters, never to their position in the grid.
VOICES={'synergy':('kal16',.91),'synthia':('slt',1.04),'people':('slt',.94),
        'strategy':('rms',1.02),'guitar':('kal16',1.05),'keys':('slt',1),
        'operations':('awb',.98),'accountant':('rms',.94),'linda':('slt',.89)}
CACHE={}

def ff(*args):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)

def encode(x,path,tmp,stereo=False):
    wavfile.write(tmp/'mix.wav',SR,(np.clip(x,-.96,.96)*32767).astype(np.int16))
    ff('-i',tmp/'mix.wav','-c:a','libmp3lame','-b:a','128k' if stereo else '96k',tmp/'encoded.mp3')
    path.write_bytes((tmp/'encoded.mp3').read_bytes())

def speech(text,character,tmp):
    key=(text,character)
    if key in CACHE:return CACHE[key].copy()
    voice,pitch=VOICES[character]
    (tmp/'line.txt').write_text(text.replace('’',"'"))
    ff('-f','lavfi','-i',f'flite=textfile={tmp}/line.txt:voice={voice}',
       '-af',f'aresample={SR},asetrate={SR*pitch},aresample={SR},atempo={1/pitch}',
       '-ar',SR,'-ac',1,tmp/'line.wav')
    _,x=wavfile.read(tmp/'line.wav');x=x.astype(np.float64)/32768
    active=np.flatnonzero(np.abs(x)>.006)
    if len(active):x=x[max(0,active[0]-600):min(len(x),active[-1]+1800)]
    x=sosfilt(butter(2,[180,6500],btype='bandpass',fs=SR,output='sos'),x)
    # Clear, deliberately dry computer speech; no fuzz, distortion or chorus FX.
    x*=.15/max(.001,np.sqrt(np.mean(x*x)))
    x*=min(1,.78/max(.001,np.max(np.abs(x))))
    fade=min(120,len(x)//2)
    x[:fade]*=np.linspace(0,1,fade);x[-fade:]*=np.linspace(1,0,fade)
    CACHE[key]=x.copy()
    return x

def envelope(x):
    step=SR//25
    levels=np.array([np.sqrt(np.mean(x[i:i+step]**2)) for i in range(0,len(x),step)])
    levels=np.minimum(1,levels/max(.02,np.percentile(levels,93)))
    return np.round(levels*100).astype(int).tolist()

def chorus(text,roster,beat,tmp):
    # The cast says the hook together, phrase by phrase on the beat.
    ids=[p for p in roster if p in VOICES]
    phrases=[t.strip()+'.' for t in text.split('.') if t.strip()]
    parts=[]
    for phrase in phrases:
        takes=[speech(phrase,p,tmp) for p in ids]
        duration=math.ceil(max(map(len,takes))/SR/beat)*beat
        n=round(duration*SR);mix=np.zeros(n)
        for take in takes:
            target=max(1,n-round(.12*SR))
            mix[:target]+=resample(take,target)/math.sqrt(len(takes))
        mix*=min(1,.82/max(.001,np.max(abs(mix))))
        parts.append(mix)
    return np.concatenate(parts)

OUT.mkdir(parents=True,exist_ok=True)
result={'version':1,'sampleRate':SR,'envelopeHz':25,'meetings':{}}
with tempfile.TemporaryDirectory(prefix='meeting-season-') as directory:
    tmp=Path(directory)
    for agenda,variants in LIB.items():
        bed=STEMS[BEDS[agenda]]['music']
        ff('-i',ROOT/'public/studio-2/audio'/bed['file'],'-ar',SR,'-ac',2,tmp/'stems.wav')
        _,packed=wavfile.read(tmp/'stems.wav');packed=packed.astype(float)/32768
        n=round(bed['duration']*SR);mix=np.zeros((n,2))
        for name,segment in bed['stems'].items():
            start=round(segment['start']*SR);part=packed[start:start+n]
            mix[:len(part)]+=part*({'drums':1,'bass':.92,'keys':.85,'lift':.35}[name])
        encode(mix,OUT/f'{agenda}-bed.mp3',tmp,True)
        for vi,meeting in enumerate(variants):
            beat=60/meeting['bpm'];bar=beat*4;cursor=bar
            cues=[];events=[]
            for index,(who,text) in enumerate(meeting['lines']):
                x=chorus(text,meeting['roster'],beat,tmp) if who=='all' else speech(text,who,tmp)
                duration=len(x)/SR
                cues.append({'speaker':who,'text':text,'start':round(cursor,4),'duration':round(duration,4),'level':envelope(x)})
                events.append((round(cursor*SR),x))
                # Short pauses keep the joke moving. Chorus starts on a full bar.
                cursor=math.ceil((cursor+duration+.22)/beat)*beat
                if index==6:cursor=math.ceil(cursor/bar)*bar
            duration=math.ceil((cursor+bar)/bar)*bar
            track=np.zeros(round(duration*SR))
            for start,x in events:track[start:start+len(x)]+=x
            key=f'{agenda}-{vi}'
            encode(track,OUT/f'{key}-voice.mp3',tmp)
            result['meetings'][key]={'duration':round(duration,4),'voice':f'{key}-voice.mp3','bed':f'{agenda}-bed.mp3','loopDuration':bed['duration'],'cues':cues}
            print(key,round(duration,1),'seconds /',len(cues),'cues',flush=True)
(ROOT/'src/meeting-room/audio-manifest.json').write_text(json.dumps(result,separators=(',',':'))+'\n')
print('Season rendered. No external generation credits used.',flush=True)
