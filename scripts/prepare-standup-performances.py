"""Prepare exact approved voice inputs; never change the live meeting audio.

One upload per human: their remaining solo line, a gap, then their isolated
beat-aligned chorus. Run with the same eSpeak runtime as render-meeting-season.
"""
import hashlib, json, math, subprocess
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly
from retro_speech import RetroSpeech

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/meeting-performances/standup-0'
SR = 24000
manifest = json.loads((ROOT/'src/meeting-room/audio-manifest.json').read_text())
meeting = manifest['meetings']['standup-0']
hook = meeting['cues'][7]
beat = 60/92
retro = RetroSpeech()
cache = {}

def take(source):
    key = source.get('take') or source['text']
    if key in cache: return cache[key]
    if source['character'] == 'synergy':
        rate, x = retro.synthesize(source['text'], voice=source['voice'], rate=source['rate'],
                                  pitch=source['pitch'], pitch_range=source['pitchRange'])
        gcd = math.gcd(SR, rate)
        x = resample_poly(x, SR//gcd, rate//gcd)
        active = np.flatnonzero(np.abs(x)>.006)
        if len(active): x = x[max(0,active[0]-600):min(len(x),active[-1]+1800)]
    else:
        path = ROOT/f"assets/meeting-voices/masters/{source['take']}.flac"
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source['masterSha256']
        data = subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ar',str(SR),'-ac','1','-f','s16le','-'])
        x = np.frombuffer(data,dtype='<i2').astype(float)/32768
        active = np.flatnonzero(np.abs(x)>.004)
        if len(active): x = x[max(0,active[0]-1200):min(len(x),active[-1]+3600)]
    cache[key] = x
    return x

OUT.mkdir(parents=True,exist_ok=True)
groups = [hook['sources'][i:i+4] for i in range(0,len(hook['sources']),4)]
phrase_samples = [round(math.ceil((max(len(take(s)) for s in group)/SR+.12)/beat)*beat*SR) for group in groups]
assert abs(sum(phrase_samples)/SR-hook['duration']) < .0001
jobs=[]
for character, cue_index in [('guitar',5),('keys',3),('operations',4)]:
    cue = meeting['cues'][cue_index]
    solo = take(cue['sources'][0])
    assert abs(len(solo)/SR-cue['duration']) < .0001
    parts=[]; timing=[]; cursor=0
    for group,n in zip(groups,phrase_samples):
        source=next(s for s in group if s['character']==character)
        x=take(source); part=np.zeros(n); part[:len(x)]=x; parts.append(part)
        timing.append({'start':cursor/SR,'duration':len(x)/SR,'slotDuration':n/SR,'source':source})
        cursor+=n
    lead=round(.25*SR); gap=round(.5*SR); tail=round(.25*SR)
    chorus_offset=(lead+len(solo)+gap)/SR
    audio=np.concatenate([np.zeros(lead),solo,np.zeros(gap),*parts,np.zeros(tail)])
    path=OUT/f'{character}-exact-standup.wav'
    wavfile.write(path,SR,(audio*32767).astype(np.int16))
    job={'character':character,'meeting':'standup-0','status':'prepared','audio':path.name,
         'audioSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'duration':len(audio)/SR,
         'characterImage':f"public/studio/season/posters/{'drums' if character=='operations' else character}-listening.jpg",
         'solo':{'cueIndex':cue_index,'offset':lead/SR,'duration':len(solo)/SR,'sources':cue['sources']},
         'chorus':{'cueIndex':7,'offset':chorus_offset,'duration':cursor/SR,'phrases':timing},
         'direction':'Same approved face and voice. Restrained natural articulation. Stable lips, eyes and headset. No new words or voices.',
         'workflow':'Runway Character Script to Video, uploaded Audio'}
    (OUT/f'{character}.json').write_text(json.dumps(job,indent=2,ensure_ascii=False)+'\n')
    jobs.append({'character':character,'duration':job['duration'],'soloOffset':.25,'chorusOffset':chorus_offset})
print(json.dumps(jobs,indent=2))
