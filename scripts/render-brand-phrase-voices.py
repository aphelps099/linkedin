"""Approved local robot voices, with exact eSpeak word-event timings."""
import sys,json,ctypes as C,subprocess
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
from retro_speech import RetroSpeech

OUT=Path(sys.argv[1]);OUT.mkdir(parents=True,exist_ok=True);SR=48000
class EventId(C.Union):
    _fields_=[('number',C.c_int),('name',C.c_char_p),('string',C.c_char*8)]
class Event(C.Structure):
    _fields_=[('type',C.c_int),('unique_identifier',C.c_uint),('text_position',C.c_int),('length',C.c_int),('audio_position',C.c_int),('sample',C.c_int),('user_data',C.c_void_p),('id',EventId)]
tts=RetroSpeech();events=[]
CALLBACK=C.CFUNCTYPE(C.c_int,C.POINTER(C.c_short),C.c_int,C.c_void_p)
def capture(samples,count,pointer):
    if samples and count:tts.chunks.append(C.string_at(samples,count*2))
    if pointer:
        p=C.cast(pointer,C.POINTER(Event));i=0
        while p[i].type!=0:
            e=p[i]
            if e.type==1:events.append({'position':e.text_position,'length':e.length,'seconds':e.audio_position/1000})
            i+=1
    return 0
cb=CALLBACK(capture);tts.lib.espeak_SetSynthCallback.argtypes=[CALLBACK];tts.lib.espeak_SetSynthCallback(cb)
def finish(v):
    nz=np.flatnonzero(abs(v)>.005);a=max(0,nz[0]-720);v=v[a:min(len(v),nz[-1]+2400)].copy()
    v*=min(.12/max(.001,np.sqrt(np.mean(v*v))),.65/max(.001,np.max(abs(v))))
    v[:240]*=np.linspace(0,1,240);v[-240:]*=np.linspace(1,0,240)
    return v,a/SR
data={}
for key,text in [('humbled-phrase','Humbled and honored to share.'),('onboarding-phrase','Optimize the onboarding.')]:
    events.clear();rate,v=tts.synthesize(text,voice='en-us',rate=120,pitch=35,pitch_range=4)
    from math import gcd
    g=gcd(SR,rate);v=resample_poly(v,SR//g,rate//g);v,trim=finish(v)
    words=[{'word':text[e['position']-1:e['position']-1+e['length']],'start':max(0,e['seconds']-trim)}for e in events]
    for i,w in enumerate(words):w['end']=words[i+1]['start'] if i+1<len(words) else len(v)/SR
    wavfile.write(OUT/(key+'.wav'),SR,v.astype(np.float32));data[key]={'speaker':'synergy','text':text,'duration':len(v)/SR,'words':words}

def female(key,text):
    txt=OUT/(key+'.txt');txt.write_text(text)
    raw=subprocess.check_output(['ffmpeg','-v','error','-f','lavfi','-i',f'flite=textfile={txt}:voice=slt','-af','aresample=24000,asetrate=24960,aresample=48000,atempo=0.961538,highpass=f=180,lowpass=f=6500','-ar',str(SR),'-ac','1','-f','f32le','-'])
    return finish(np.frombuffer(raw,dtype='<f4').copy())[0]
# A deliberately rhythmic desktop-robot call: each complete word starts on its
# cue; no phonemes are cut up and timing does not depend on guessed captions.
v=np.zeros(round(2.65*SR),np.float32);words=[]
for key,word,start in [('lets',"Let's",.08),('circle','circle',.74),('back','back',1.65)]:
    part=female(key,word);i=round(start*SR);v[i:i+len(part)]+=part;words.append({'word':word,'start':start,'end':start+len(part)/SR})
wavfile.write(OUT/'circle-phrase.wav',SR,v);data['circle-phrase']={'speaker':'synthia','text':"Let's circle back.",'duration':len(v)/SR,'words':words}
for key,text in [('optimized','Optimized.'),('tagline','Sound like you mean business.')]:
    v=female(key,text);wavfile.write(OUT/(key+'.wav'),SR,v.astype(np.float32));data[key]={'speaker':'synthia','text':text,'duration':len(v)/SR}
(OUT/'phrase-timings.json').write_text(json.dumps(data,indent=2)+'\n');print(json.dumps(data,indent=2))
