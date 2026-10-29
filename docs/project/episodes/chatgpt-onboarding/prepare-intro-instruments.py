"""Cache existing instrument performances for the approved collage intro."""
from pathlib import Path
import hashlib,json,subprocess,sys
import imageio_ffmpeg
repo=Path(__file__).resolve().parents[4]
root=Path(sys.argv[1]).resolve()
records=[]
for key,source,start,duration in [('keys','keys-detail',.625,1.875),('guitar','guitar-playing',1.25,1.25),('drums','drums-playing',1.875,.625)]:
    path=repo/'public/studio/season/clips'/f'{source}.mp4'
    dest=root/'assets/instruments'/key;dest.mkdir(parents=True,exist_ok=True)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y','-ss','1','-i',str(path),'-t',str(duration),'-vf','fps=24','-q:v','2',str(dest/'%03d.jpg')],check=True)
    records.append(dict(key=key,start=start,end=2.5,source=str(path.relative_to(repo)),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),files=[str(p.relative_to(root)) for p in sorted(dest.glob('*.jpg'))]))
(root/'assets/instruments/manifest.json').write_text(json.dumps(records,indent=2)+'\n')
print('Three existing performances cached; no generation or audio changes.')
