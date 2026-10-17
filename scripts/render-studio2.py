"""Render the Studio 2 multitracks and vintage robot phrase sprites.

python scripts/render-studio2.py
Requires numpy, scipy, FFmpeg (libmp3lame + flite). No API keys or paid calls.
Derived from our approved Office Anthems / Mutual Alignment production recipes.
Every asset is original synthesized audio; kal16/slt are the same PA voices.
"""
from pathlib import Path
import json, subprocess, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/studio-2/audio'
OUT.mkdir(parents=True, exist_ok=True)
SCORE = json.loads((ROOT / 'src/studio-2/score.json').read_text())
SR = 32000
RNG = np.random.default_rng(1994)

def filt(x, lo, hi):
    return signal.sosfilt(signal.butter(3, [lo, hi], btype='bandpass', fs=SR, output='sos'), x)

def hz(note):
    return 440 * 2 ** ((note - 69) / 12)

def envelope(t, attack, decay, end):
    return np.minimum(t / attack, 1) * np.exp(-t * decay) * np.minimum(np.maximum(end-t, 0) / .03, 1)

def drum(kind, style):
    dur = dict(kick=.48, snare=.28, hat=.07, open=.28, rim=.1, clap=.3, tom=.19)[kind]
    t = np.arange(round(dur * SR)) / SR
    n = RNG.normal(size=len(t))
    if kind == 'kick':
        floor = 43 if style in ['hiphop', 'downtempo'] else 49
        phase = 2*np.pi*np.cumsum(floor + 115*np.exp(-t*48))/SR
        return np.tanh(1.3*np.sin(phase))*np.exp(-t*10)*.78 + n*np.exp(-t*320)*.035
    if kind == 'snare':
        return .40*filt(n, 1000, 11500)*np.exp(-t*22) + .27*np.sin(2*np.pi*184*t)*np.exp(-t*31)
    if kind in ['hat', 'open']:
        return filt(n, 7200, 15000)*np.exp(-t*(70 if kind == 'hat' else 22))*.18
    if kind == 'rim':
        return (np.sin(2*np.pi*1780*t)+.4*np.sin(2*np.pi*820*t))*np.exp(-t*85)*.2
    if kind == 'tom':
        return np.sin(2*np.pi*np.cumsum(112+88*np.exp(-t*35))/SR)*np.exp(-t*23)*.27
    x = filt(n, 650, 7500)
    return x * sum(np.exp(-np.maximum(0,t-o)*42)*(t>=o) for o in [0,.012,.025])*.16

def tone(kind, note, duration, style):
    t = np.arange(round(duration*SR))/SR
    f = hz(note)
    if kind == 'bass':
        decay = 2.8 if style in ['rhodes','downtempo'] else 5
        body = np.sin(2*np.pi*f*t) + .22*np.sin(2*np.pi*2*f*t)*np.exp(-t*12)
        if style in ['funk','electro','synth']:
            body += .16*signal.sawtooth(2*np.pi*f*t, width=.5)*np.exp(-t*8)
        return body*envelope(t,.008,decay,duration)*.34
    if kind == 'keys':
        # Rounded FM electric piano; a little bell in the attack, no sharp top end.
        body = np.sin(2*np.pi*f*t + .65*np.exp(-t*4)*np.sin(2*np.pi*f*2*t))
        return body*envelope(t,.008,1.8,duration)*.13
    if kind == 'pad':
        body = (np.sin(2*np.pi*f*t)+.35*np.sin(2*np.pi*f*1.002*t)+.15*np.sin(2*np.pi*2*f*t))/1.5
        return body*envelope(t,.24,.35,duration)*.08
    body = np.sin(2*np.pi*f*t + .8*np.exp(-t*14)*np.sin(2*np.pi*2*f*t))
    return body*envelope(t,.004,7,duration)*.13

def add(buf, x, at, gain=1, pan=0, wrap=True):
    if x.ndim == 1:
        x = x[:,None]*np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)])
    x = x*gain
    at = round(at*SR)
    if wrap:
        at %= len(buf)
    count = min(len(x),len(buf)-at)
    if count>0: buf[at:at+count] += x[:count]
    if wrap and count<len(x):
        remain=x[count:]
        buf[:min(len(remain),len(buf))] += remain[:len(buf)]

def encode(x, path, temp, mono=False):
    wav = temp / (path.stem + '.wav')
    wavfile.write(wav, SR, np.int16(np.clip(x,-1,1)*32767))
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-c:a','libmp3lame','-b:a','80k' if mono else '160k',str(path)],check=True)

def music(track, temp):
    beat=60/track['bpm']; step=beat/4; length=round(32*beat*SR)
    buses={k:np.zeros((length,2)) for k in ['drums','bass','keys','lift']}
    sounds={k:drum(k,track['style']) for k in ['kick','snare','hat','open','rim','clap','tom']}
    style=track['style']
    for bar in range(8):
        start=bar*4*beat
        chord=track['progression'][bar//2]
        root=track['root']+chord[0]
        # Keep the sub in the same useful octave across the four chords.
        if root<31: root+=12
        when=lambda s: start+(s+(track['swing'] if s%2 else 0))*step
        for s in track['kicks']:
            add(buses['drums'],sounds['kick'],when(s),.9 if s%8==0 else .73)
        for s in [4,12]:
            add(buses['drums'],sounds['snare'],when(s)+.009,.82)
            if style in ['funk','synth','electro']: add(buses['drums'],sounds['clap'],when(s)+.013,.36)
        for s in range(0,16,2):
            add(buses['drums'],sounds['hat'],when(s),.68 if s%4==0 else .44,.22)
        for s in [3,7,11,15]:
            add(buses['lift'],sounds['hat'],when(s),.43 if s==15 else .26,-.25)
        if bar%2:
            add(buses['drums'],sounds['rim'],when(11),.24,-.25)
            add(buses['lift'],sounds['open'],when(14),.4,.28)
        if bar%4==3:
            # Small descending drum stairs. These replace the final hat flourish.
            for n,s in enumerate([13,14,15]):
                tom=signal.resample(sounds['tom'],round(len(sounds['tom'])*(0.72+n*.22)))
                add(buses['lift'],tom,when(s),.42+n*.09,-.3+n*.3)
            add(buses['drums'],sounds['snare'],when(15),.17)
        for s,offset,dur in track['bass']:
            # The final bass pickup walks toward the next chord.
            if bar%2==1 and s==track['bass'][-1][0]:
                next_root=track['root']+track['progression'][((bar+1)//2)%4][0]
                note=next_root-1 if style=='funk' else root+offset
            else: note=root+offset
            add(buses['bass'],tone('bass',note,dur*step,style),when(s),.94)
        tones=[root+12+n for n in chord[1:]]
        positions=[0,7,10] if style=='funk' else [0,10] if style in ['hiphop','rhodes'] else [2,6,10,14] if style in ['synth','electro'] else [0]
        for s in positions:
            duration=(3.2 if style in ['rhodes','downtempo'] else 1.6 if style=='hiphop' else .8)*beat
            for n,pitch in enumerate(tones):
                add(buses['keys'],tone('keys',pitch,duration,style),when(s),.72/np.sqrt(len(tones)),(n-2)*.18)
        if bar%2==0:
            for n,pitch in enumerate(tones[:4]):
                add(buses['keys'],tone('pad',pitch,8.5*beat,style),start,.5,(-1 if n%2 else 1)*.6)
        # A recognizable answer motif, left out while the first vocal line lands.
        for n,offset in enumerate(track['motif']):
            s=[2,6,10,14][n] if style in ['synth','electro'] else [8,11,13,15][n]
            gain=.45 if style in ['synth','electro'] else .29
            note=tone('pluck',root+24+offset,.6,style)
            add(buses['lift'],note,when(s),gain,(-.4 if n%2 else .4))
            add(buses['lift'],note,when(s)+beat*.75,gain*.18,(.4 if n%2 else -.4))
    # Mix to a fixed peak with headroom for voices and all-hands mode.
    summed=sum(buses.values())
    scale=.70/max(.01,np.max(abs(summed)))
    # Each bus is stored as an exact eight-bar segment in one gapless MP3 sprite.
    offsets={}; chunks=[]
    for i,(name,x) in enumerate(buses.items()):
        x*=scale
        offsets[name]={'start':i*length/SR,'duration':length/SR}
        chunks.append(x)
    packed=np.concatenate(chunks)
    encode(packed,OUT/(track['id']+'-music.mp3'),temp)
    print(f"{track['title']}: {track['bpm']} BPM / four 8-bar stems / peak {np.max(abs(summed*scale)):.3f}",flush=True)
    return {'file':track['id']+'-music.mp3','stems':offsets,'duration':length/SR,'peak':round(float(np.max(abs(summed*scale))),4)}

SPEECH_CACHE={}
def speech(text, speaker, temp):
    key=(text,speaker)
    if key in SPEECH_CACHE:return SPEECH_CACHE[key]
    txt=temp/'speech.txt'; wav=temp/'speech.wav';txt.write_text(text)
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','lavfi','-i',f'flite=textfile={txt}:voice={"kal16" if speaker=="M" else "slt"}','-ar',str(SR),'-ac','1',str(wav)],check=True)
    _,x=wavfile.read(wav);x=x.astype(float)/32768
    active=np.flatnonzero(abs(x)>.007)
    if len(active):x=x[max(0,active[0]-round(.025*SR)):min(len(x),active[-1]+round(.10*SR))]
    x=filt(x,340,3300)
    t=np.arange(len(x))/SR;depth=.10 if speaker=='M' else .18
    x*=1-depth+depth*np.cos(2*np.pi*37*t)
    x=np.round(x*1024)/1024
    x*=.105/(np.sqrt(np.mean(x*x))+1e-9)
    x=np.tanh(x*1.2)*.85
    ramp=min(round(.005*SR),len(x)//2)
    x[:ramp]*=np.linspace(0,1,ramp);x[-ramp:]*=np.linspace(1,0,ramp)
    SPEECH_CACHE[key]=x
    return x

def voices(name, texts, temp):
    chunks=[np.zeros(round(.1*SR))]; cursor=len(chunks[0]); clips={}
    for text in dict.fromkeys(texts):
        clips[text]={}
        for speaker in ['M','F']:
            x=speech(text,speaker,temp)
            clips[text][speaker]={'start':cursor/SR,'duration':len(x)/SR}
            chunks.extend([x,np.zeros(round(.12*SR))]);cursor+=len(x)+round(.12*SR)
    encode(np.concatenate(chunks),OUT/(name+'-voices.mp3'),temp,mono=True)
    return {'file':name+'-voices.mp3','clips':clips}

def validate_pairs(pairs, manifest, bpm):
    bar=240/bpm
    for pair in pairs:
        for mode in ['M','duet']:
            a=manifest['clips'][pair[0]]['M']['duration']
            b=manifest['clips'][pair[1]]['F' if mode=='duet' else 'M']['duration']
            response=max(bar,np.ceil((a+.18)/(bar/4))*(bar/4))
            if response+b+.18>bar*4:
                raise ValueError(f'Pair cannot fit its four-bar slot: {pair}')

if __name__=='__main__':
    result={'sampleRate':SR,'tracks':{},'vocabulary':{}}
    with tempfile.TemporaryDirectory(prefix='studio2_') as folder:
        temp=Path(folder)
        for track in SCORE['tracks']:
            pairs=track['pairs']+track['visionary']
            vocal=voices(track['id'],[line for pair in pairs for line in pair],temp)
            validate_pairs(pairs,vocal,track['bpm'])
            result['tracks'][track['id']]={'music':music(track,temp),'voice':vocal}
        vocab=voices('vocabulary',[line for item in SCORE['vocabulary'] for line in item['pair']],temp)
        validate_pairs([v['pair'] for v in SCORE['vocabulary']],vocab,max(t['bpm'] for t in SCORE['tracks']))
        result['vocabulary']=vocab
    (ROOT/'src/studio-2/audio-manifest.json').write_text(json.dumps(result,indent=2)+'\n')
    print('Rendered six multitracks, both robot voices, and six connected vocabulary pairs. Timing checks passed.',flush=True)
