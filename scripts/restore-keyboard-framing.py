"""Restore keyboard footage without the original bottom crop. No generation."""
import argparse, hashlib, json, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True)
args=parser.parse_args();out=ROOT/'public/studio/season';entries=[]
def ff(*args):subprocess.run(['ffmpeg','-v','error','-y',*map(str,args)],check=True)
for state,source,start,duration in [('playing','keys-playing',.2,7.6),('listening','keys-listening-v2',.25,9.5),('speaking','keys-speaking-v2',.25,9.5)]:
    raw=args.source/f'{source}.mp4';dest=out/f'clips/keys-full-{state}.mp4'
    ff('-ss',start,'-i',raw,'-t',duration,'-vf','scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x111315,setsar=1','-an','-r','24','-c:v','libx264','-preset','fast','-crf','20','-movflags','+faststart',dest)
    ff('-i',dest,'-frames:v','1',out/f'posters/keys-full-{state}.jpg')
    entries.append({'video':str(dest.relative_to(ROOT)),'source':raw.name,
        'sourceSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),
        'note':'Entire approved camera, keyboard and hands. The compact live label covers the original small corner name.'})
dest=out/'clips/keys-detail.mp4'
ff('-ss','0.2','-i',args.source/'keys-playing.mp4','-t','7.6','-vf','crop=884:214:228:620,scale=1060:256,setsar=1','-an','-r','24','-c:v','libx264','-preset','fast','-crf','19','-movflags','+faststart',dest)
ff('-i',dest,'-frames:v','1',out/'posters/keys-detail.jpg')
(ROOT/'assets/meeting-performances/onboarding-0/keyboard-framing.json').write_text(json.dumps({
    'restored':entries,'detailCamera':str(dest.relative_to(ROOT)),'detailCrop':[228,620,884,214],
    'purpose':'Hands remain visible in a separate camera strip during exact vocal performances. Reuses approved footage; no additional generation.'},indent=2)+'\n')
