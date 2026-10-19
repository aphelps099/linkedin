"""Render the authored meeting season locally. No paid voice or generation APIs.

Uses the approved human line bank, established robot voices, and Studio 2 stems.
Run after `node --input-type=module -e "import {library} from './src/meeting-room/scripts.js';
import {writeFileSync} from 'node:fs';writeFileSync('/tmp/meeting-scripts.json',JSON.stringify(library))"`.
"""
import json, math, subprocess, tempfile, argparse, unicodedata, hashlib
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, resample_poly
from retro_speech import RetroSpeech

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/studio/season/audio'
SR=24000
LIB=json.loads(Path('/tmp/meeting-scripts.json').read_text())
STEMS=json.loads((ROOT/'src/studio-2/audio-manifest.json').read_text())['tracks']
BEDS={'standup':'offline','onboarding':'circle-back','unlock':'alignment','paperless':'no-action','founder':'humbled','offline':'offline','quarterly':'synergy'}
# Stable voices belong to characters, never to their position in the grid.
CACHE={}
parser=argparse.ArgumentParser()
parser.add_argument('--voice-bank',required=True,help='Approved cast bank from export-meeting-voice-bank.mjs')
parser.add_argument('--meeting',help='Render only this authored meeting, preserving the rest of the season')
parser.add_argument('--metadata-only',action='store_true',help='Validate against existing audio and update envelopes only; never replace audio')
ARGS=parser.parse_args()
if ARGS.metadata_only and not ARGS.meeting:parser.error('--metadata-only requires --meeting')
if ARGS.meeting and ARGS.meeting not in {f'{a}-{i}' for a,v in LIB.items() for i in range(len(v))}:parser.error('Unknown meeting')
VOICE_BANK=json.loads(Path(ARGS.voice_bank).read_text()) if ARGS.voice_bank else None
VOICES=VOICE_BANK['robots']
RETRO=RetroSpeech()
assert VOICES['synergy']['provider']=='espeak-ng' and VOICES['synthia']['provider']=='flite'
VOICES['synergy']['engineVersion']=RETRO.version
SPEAKERS=set(VOICES)|set(VOICE_BANK['characters'])

def bank_key(character,text):
    text=' '.join(unicodedata.normalize('NFC',text).split())
    return json.dumps([character,text],ensure_ascii=False,separators=(',',':'))

# Fail before overwriting anything when an approved take is missing.
if VOICE_BANK:
    if VOICE_BANK.get('version')!=1:raise ValueError('Unknown voice-bank format')
    for variants in LIB.values():
        for meeting in variants:
            for who,text in meeting['lines']:
                people=[p for p in meeting['roster'] if p in SPEAKERS] if who=='all' else [who]
                phrases=[t.strip()+'.' for t in text.split('.') if t.strip()] if who=='all' else [text]
                for person in people:
                    if person in ('synergy','synthia'):continue
                    for phrase in phrases:
                        take=VOICE_BANK['lines'].get(bank_key(person,phrase))
                        if not take or take['status'] not in ('approved','validated') or not (ROOT/take['file']).is_file():
                            raise ValueError(f'Missing approved human recording: {person}: {phrase}')
                        if hashlib.sha256((ROOT/take['file']).read_bytes()).hexdigest()!=take['masterSha256']:
                            raise ValueError(f'Changed human master: {person}: {phrase}')

def ff(*args):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)

def encode(x,path,tmp,stereo=False):
    wavfile.write(tmp/'mix.wav',SR,(np.clip(x,-.96,.96)*32767).astype(np.int16))
    ff('-i',tmp/'mix.wav','-c:a','libmp3lame','-b:a','128k' if stereo else '96k',tmp/'encoded.mp3')
    path.write_bytes((tmp/'encoded.mp3').read_bytes())

def speech(text,character,tmp):
    key=(text,character)
    if key in CACHE:return CACHE[key].copy()
    if VOICE_BANK and character not in ('synergy','synthia'):
        take=VOICE_BANK['lines'][bank_key(character,text)]
        ff('-i',ROOT/take['file'],'-ar',SR,'-ac',1,tmp/'human.wav')
        _,x=wavfile.read(tmp/'human.wav');x=x.astype(np.float64)/32768
        # Natural timbre and pauses remain intact; no robot bandpass or pitch FX.
        # Remove only outer silence so the cue begins with the actual speaking turn.
        active=np.flatnonzero(np.abs(x)>.004)
        if len(active):x=x[max(0,active[0]-1200):min(len(x),active[-1]+3600)]
        CACHE[key]=x.copy()
        return x
    profile=VOICES[character]
    if profile['provider']=='espeak-ng':
        rate,x=RETRO.synthesize(text,voice=profile['voice'],rate=profile['rate'],pitch=profile['pitch'],pitch_range=profile['pitchRange'])
        factor=math.gcd(SR,rate);x=resample_poly(x,SR//factor,rate//factor)
    else:
        voice,pitch=profile['voice'],profile['pitch']
        (tmp/'line.txt').write_text(text.replace('’',"'"))
        ff('-f','lavfi','-i',f'flite=textfile={tmp}/line.txt:voice={voice}',
           '-af',f'aresample={SR},asetrate={SR*pitch},aresample={SR},atempo={1/pitch}',
           '-ar',SR,'-ac',1,tmp/'line.wav')
        _,x=wavfile.read(tmp/'line.wav');x=x.astype(np.float64)/32768
    active=np.flatnonzero(np.abs(x)>.006)
    if len(active):x=x[max(0,active[0]-600):min(len(x),active[-1]+1800)]
    band=[120,5000] if profile['provider']=='espeak-ng' else [180,6500]
    x=sosfilt(butter(2,band,btype='bandpass',fs=SR,output='sos'),x)
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
    ids=[p for p in roster if p in SPEAKERS]
    phrases=[t.strip()+'.' for t in text.split('.') if t.strip()]
    parts=[];individual={person:[] for person in ids}
    for phrase in phrases:
        takes=[speech(phrase,p,tmp) for p in ids]
        duration=math.ceil((max(map(len,takes))/SR+.12)/beat)*beat
        n=round(duration*SR);mix=np.zeros(n)
        for person,take in zip(ids,takes):
            # Start together, then leave space. Never resample a voice to fit a bar:
            # that shifts pitch and destroys the character's approved identity.
            mix[:len(take)]+=take/math.sqrt(len(takes))
            stem=np.zeros(n);stem[:len(take)]=take;individual[person].append(stem)
        mix*=min(1,.82/max(.001,np.max(abs(mix))))
        parts.append(mix)
    return np.concatenate(parts),{person:envelope(np.concatenate(parts)) for person,parts in individual.items()}

OUT.mkdir(parents=True,exist_ok=True)
manifest_path=ROOT/'src/meeting-room/audio-manifest.json'
previous=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'meetings':{}}
result={'version':1,'sampleRate':SR,'envelopeHz':25,'voiceCast':VOICE_BANK['characters'],
        'robotCast':VOICES,'meetings':dict(previous['meetings']) if ARGS.meeting else {}}
if ARGS.metadata_only:result=dict(previous)

def sources(who,text,roster):
    ids=[p for p in roster if p in SPEAKERS] if who=='all' else [who]
    phrases=[t.strip()+'.' for t in text.split('.') if t.strip()] if who=='all' else [text]
    return [{'character':person,'text':phrase,**(
        VOICES[person] if person in VOICES else
        {k:VOICE_BANK['lines'][bank_key(person,phrase)][k] for k in ('line','take','masterSha256')}
    )} for phrase in phrases for person in ids]

with tempfile.TemporaryDirectory(prefix='meeting-season-') as directory:
    tmp=Path(directory)
    if ARGS.metadata_only:
        # eSpeak carries synthesis state across calls. Revisit the original earlier
        # takes (in memory only) so a targeted display update uses the same timing.
        reached=False
        for agenda,variants in LIB.items():
            for vi,meeting in enumerate(variants):
                if f'{agenda}-{vi}'==ARGS.meeting:reached=True;break
                for who,text in meeting['lines']:
                    if who=='all':chorus(text,meeting['roster'],60/meeting['bpm'],tmp)
                    else:speech(text,who,tmp)
            if reached:break
    for agenda,variants in LIB.items():
        if ARGS.meeting and not ARGS.meeting.startswith(agenda+'-'):continue
        bed=STEMS[BEDS[agenda]]['music']
        if not ARGS.metadata_only:
            ff('-i',ROOT/'public/studio-2/audio'/bed['file'],'-ar',SR,'-ac',2,tmp/'stems.wav')
            _,packed=wavfile.read(tmp/'stems.wav');packed=packed.astype(float)/32768
            n=round(bed['duration']*SR);mix=np.zeros((n,2))
            for name,segment in bed['stems'].items():
                start=round(segment['start']*SR);part=packed[start:start+n]
                mix[:len(part)]+=part*({'drums':1,'bass':.92,'keys':.85,'lift':.35}[name])
            encode(mix,OUT/f'{agenda}-bed.mp3',tmp,True)
        for vi,meeting in enumerate(variants):
            key=f'{agenda}-{vi}'
            if ARGS.meeting and ARGS.meeting!=key:continue
            beat=60/meeting['bpm'];bar=beat*4;cursor=bar
            cues=[];events=[]
            for index,(who,text) in enumerate(meeting['lines']):
                if who=='all':x,speaker_levels=chorus(text,meeting['roster'],beat,tmp)
                else:x,speaker_levels=speech(text,who,tmp),None
                duration=len(x)/SR
                if speaker_levels:
                    speaker_levels={person:levels[:math.ceil(round(duration,4)*25)] for person,levels in speaker_levels.items()}
                cues.append({'speaker':who,'text':text,'start':round(cursor,4),'duration':round(duration,4),'level':envelope(x),
                             'sources':sources(who,text,meeting['roster']),
                             **({'speakerLevels':speaker_levels} if speaker_levels else {})})
                events.append((round(cursor*SR),x))
                # Short pauses keep the joke moving. Chorus starts on a full bar.
                cursor=math.ceil((cursor+duration+.22)/beat)*beat
                if index==6:cursor=math.ceil(cursor/bar)*bar
            duration=math.ceil((cursor+bar)/bar)*bar
            track=np.zeros(round(duration*SR))
            for start,x in events:track[start:start+len(x)]+=x
            if ARGS.metadata_only:
                old=previous['meetings'][key]
                assert round(duration,4)==old['duration'],'Existing duration changed'
                for new,existing in zip(cues,old['cues']):
                    for field in ('speaker','text','start','duration','sources'):
                        assert new[field]==existing[field],f'Existing {field} changed ({new[field]!r} vs {existing[field]!r}) in {new["text"]}; audio must be reviewed'
                ff('-i',OUT/old['voice'],'-ar',SR,'-ac',1,tmp/'existing.wav')
                _,decoded=wavfile.read(tmp/'existing.wav');decoded=decoded.astype(float)/32768
                assert len(decoded)==len(track),'Existing audio sample count changed'
                correlation=float(np.corrcoef(track,decoded)[0,1])
                assert correlation>.995,f'Reconstructed voices differ from approved audio: {correlation}'
                # Keep all original audio and timing. Add only the independent chorus envelopes.
                for new,existing in zip(cues,old['cues']):
                    if 'speakerLevels' in new:existing['speakerLevels']=new['speakerLevels']
                proof=ROOT/'assets/meeting-performances'/key/'display-validation.json'
                proof.parent.mkdir(parents=True,exist_ok=True)
                proof.write_text(json.dumps({'meeting':key,'voice':old['voice'],
                    'voiceSha256':hashlib.sha256((OUT/old['voice']).read_bytes()).hexdigest(),
                    'zeroOffsetCorrelation':correlation,'sampleRate':SR,'envelopeHz':25,
                    'audioReplaced':False,'generationCreditsUsed':0},indent=2)+'\n')
                print(key,'independent chorus envelopes; unchanged approved audio; correlation',correlation,flush=True)
                continue
            encode(track,tmp/'voice.mp3',tmp)
            audio=(tmp/'voice.mp3').read_bytes()
            voice=f'{key}-voice-{hashlib.sha256(audio).hexdigest()[:12]}.mp3'
            (OUT/voice).write_bytes(audio)
            result['meetings'][key]={'duration':round(duration,4),'voice':voice,'bed':f'{agenda}-bed.mp3','loopDuration':bed['duration'],'cues':cues}
            print(key,round(duration,1),'seconds /',len(cues),'cues',flush=True)
manifest_path.with_suffix('.json.tmp').write_text(json.dumps(result,separators=(',',':'))+'\n')
manifest_path.with_suffix('.json.tmp').replace(manifest_path)
current={m['voice'] for m in result['meetings'].values()}
for old in previous['meetings'].values():
    if old['voice'] not in current:(OUT/old['voice']).unlink(missing_ok=True)
print('Season rendered. No external generation credits used.',flush=True)
