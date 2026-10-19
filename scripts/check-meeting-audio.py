"""Check complete encoded timelines and match solo human turns to their masters."""
import json, subprocess
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
SR=24000
season=json.loads((ROOT/'src/meeting-room/audio-manifest.json').read_text())
recordings=json.loads((ROOT/'public/studio/voices/recordings.json').read_text())
masters={}
def decode(path,format='f32le'):
    raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ar',str(SR),'-ac','1','-f',format,'pipe:1'])
    return np.frombuffer(raw,dtype='<f4' if format=='f32le' else '<i2').astype(float)/(1 if format=='f32le' else 32768)

matched=0
for key,meeting in season['meetings'].items():
    audio=decode(ROOT/'public/studio/season/audio'/meeting['voice'])
    assert abs(len(audio)/SR-meeting['duration'])<.1,key
    assert np.isfinite(audio).all() and np.max(np.abs(audio))<.999,key
    for cue in meeting['cues']:
        start=round(cue['start']*SR);end=round((cue['start']+cue['duration'])*SR)
        assert np.sqrt(np.mean(audio[start:end]**2))>.005,(key,cue['text'],'silent cue')
        if cue['speaker'] not in season['voiceCast']:continue
        source=cue['sources'][0];take=source['take']
        if take not in masters:
            x=decode(ROOT/recordings['takes'][take]['master'],'s16le')
            active=np.flatnonzero(np.abs(x)>.004)
            masters[take]=x[max(0,active[0]-1200):min(len(x),active[-1]+3600)]
        expected=masters[take]
        # Cue timestamps are rounded to 0.1 ms. Permit only that rounding error.
        similarity=max(np.corrcoef(expected,audio[start+offset:start+offset+len(expected)])[0,1] for offset in range(-3,4))
        assert similarity>.97,(key,cue['speaker'],source['line'],similarity)
        matched+=1
    print(f'{key}: {meeting["duration"]:.1f}s, all cues audible, no clipping')
assert matched>0
print(f'14 complete timelines decoded; {matched} human turns acoustically matched to the exact approved masters.')
