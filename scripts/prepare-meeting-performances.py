"""Prepare exact approved human solo/chorus drivers for one authored meeting.

Never writes live audio. Robot synthesis measures chorus beat slots only.
Run with the same espeak-ng runtime as render-meeting-season.py.
"""
import argparse, hashlib, json, math, subprocess, tempfile
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
from retro_speech import RetroSpeech

ROOT = Path(__file__).resolve().parents[1]
SR = 24000
parser = argparse.ArgumentParser()
parser.add_argument('--meeting', required=True)
parser.add_argument('--bpm', required=True, type=float)
parser.add_argument('--character')
parser.add_argument('--revision')
args = parser.parse_args()
meeting = json.loads((ROOT/'src/meeting-room/audio-manifest.json').read_text())['meetings'][args.meeting]
out = ROOT/'assets/meeting-performances'/(args.revision or args.meeting)
out.mkdir(parents=True, exist_ok=True)
retro = RetroSpeech()
cache = {}

def take(source):
    key = json.dumps(source, sort_keys=True)
    if key in cache: return cache[key]
    if source.get('take'):
        path = ROOT/f"assets/meeting-voices/masters/{source['take']}.flac"
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source['masterSha256']
        data = subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ar',str(SR),'-ac','1','-f','s16le','-'])
        x = np.frombuffer(data, dtype='<i2').astype(float)/32768
        threshold, lead, tail = .004, 1200, 3600
    else:
        if source['provider'] == 'espeak-ng':
            assert retro.version == source['engineVersion']
            rate, x = retro.synthesize(source['text'], voice=source['voice'], rate=source['rate'],
                                      pitch=source['pitch'], pitch_range=source['pitchRange'])
            factor = math.gcd(SR, rate)
            x = resample_poly(x, SR//factor, rate//factor)
        else:
            assert source['provider'] == 'flite'
            with tempfile.TemporaryDirectory(prefix='meeting-slot-') as d:
                path = Path(d)/'line.txt'; path.write_text(source['text'].replace('’',"'"))
                pitch = source['pitch']
                data = subprocess.check_output(['ffmpeg','-v','error','-f','lavfi','-i',
                    f"flite=textfile={path}:voice={source['voice']}",'-af',
                    f'aresample={SR},asetrate={SR*pitch},aresample={SR},atempo={1/pitch}',
                    '-ar',str(SR),'-ac','1','-f','s16le','-'])
                x = np.frombuffer(data,dtype='<i2').astype(float)/32768
        threshold, lead, tail = .006, 600, 1800
    active = np.flatnonzero(np.abs(x)>threshold)
    if len(active): x=x[max(0,active[0]-lead):min(len(x),active[-1]+tail)]
    cache[key] = x
    return x

choruses = []
for index, cue in enumerate(meeting['cues']):
    if cue['speaker'] != 'all': continue
    count = len({s['character'] for s in cue['sources']})
    groups = [cue['sources'][i:i+count] for i in range(0,len(cue['sources']),count)]
    beat = 60/args.bpm
    slots = [round(math.ceil((max(len(take(s)) for s in group)/SR+.12)/beat)*beat*SR) for group in groups]
    assert abs(sum(slots)/SR-cue['duration']) < .0001
    choruses.append((index,cue,groups,slots))

characters = sorted({s['character'] for cue in meeting['cues'] for s in cue['sources'] if s.get('take')})
for character in characters:
    if args.character and args.character != character: continue
    parts=[np.zeros(round(.25*SR))]; cursor=len(parts[0]); solos=[]; hooks=[]
    for index,cue in enumerate(meeting['cues']):
        if cue['speaker'] != character: continue
        source=next(s for s in cue['sources'] if s['character']==character)
        x=take(source)
        if cue.get('speakers'):x=np.pad(x,(0,max(0,round(cue['duration']*SR)-len(x))))
        assert abs(len(x)/SR-cue['duration']) < .0001
        solos.append({'cueIndex':index,'offset':cursor/SR,'duration':len(x)/SR,'sources':[source]})
        parts.extend([x,np.zeros(round(.5*SR))]); cursor+=len(x)+round(.5*SR)
    for index,cue,groups,slots in choruses:
        offset=cursor; phrases=[]
        for group,n in zip(groups,slots):
            source=next(s for s in group if s['character']==character)
            x=take(source); part=np.zeros(n); part[:len(x)]=x
            phrases.append({'start':(cursor-offset)/SR,'duration':len(x)/SR,'slotDuration':n/SR,'source':source})
            parts.append(part); cursor+=n
        hooks.append({'cueIndex':index,'offset':offset/SR,'duration':(cursor-offset)/SR,'phrases':phrases})
    parts.append(np.zeros(round(.25*SR)))
    audio=np.concatenate(parts); path=out/f'{character}-exact-{args.meeting}.wav'
    wavfile.write(path,SR,(audio*32767).astype(np.int16))
    media={'operations':'drums','accountant':'arjun'}.get(character,character)
    job={'character':character,'meeting':args.meeting,'status':'prepared','audio':path.name,
         'audioSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'duration':len(audio)/SR,
         'characterImage':f'public/studio/season/posters/{media}-listening.jpg',
         'solos':solos,'choruses':hooks,
         'direction':'Exact approved voice. Restrained natural articulation, subtle blinks, stable attached lips and headset. Preserve face identity.',
         'workflow':'Runway Character Script to Video, uploaded Audio'}
    (out/f'{character}.json').write_text(json.dumps(job,indent=2,ensure_ascii=False)+'\n')
    print(character,round(job['duration'],3),'seconds;',len(solos),'solos;',len(hooks),'choruses')
