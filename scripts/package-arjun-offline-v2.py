"""Bind the revised Arjun closing and final Arjun/Synthia duet to exact audio."""
import json,hashlib,subprocess
from pathlib import Path
import numpy as np
from scipy.io import wavfile
from scipy.signal import correlate,correlation_lags
ROOT=Path(__file__).resolve().parents[1];directory=ROOT/'assets/meeting-performances/offline-0-arjun-v2'
job=json.loads((directory/'accountant.json').read_text());source=directory/'accountant-performance.mp4'
rate,x=wavfile.read(directory/job['audio']);x=x.astype(float);assert rate==24000
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-ac','1','-ar','24000','-f','s16le','-']);y=np.frombuffer(raw,dtype='<i2').astype(float)
lag=int(correlation_lags(len(y),len(x))[np.argmax(correlate(y,x))]);n=min(len(x),len(y));correlation=float(np.corrcoef(x[:n],y[:n])[0,1]);assert lag==0 and correlation>.999
out=ROOT/'public/studio/performances/accountant-offline-exact-v2.mp4'
subprocess.run(['ffmpeg','-v','error','-y','-i',str(source),'-vf','crop=936:702:76:0,scale=720:540,setsar=1','-c:v','libx264','-crf','21','-g','24','-keyint_min','24','-sc_threshold','0','-bf','0','-an','-movflags','+faststart','-f','mp4',str(out)+'.tmp'],check=True)
Path(str(out)+'.tmp').replace(out)
video='/'+str(out.relative_to(ROOT/'public'))
module=ROOT/'src/meeting-room/offline-performances.js';original=module.read_text()
solos=json.loads(original.split('export const offlineSolos=')[1].split(';\n')[0]);chorus=json.loads(original.split('export const offlineChorus=')[1].split(';\n')[0])
for solo in job['solos']:
 take=solo['sources'][0];solos[take['take']]={'character':'accountant','masterSha256':take['masterSha256'],'video':video,'offset':solo['offset'],'duration':solo['duration']}
group=job['choruses'][0];chorus['performances']['accountant']={'character':'accountant','video':video,'offset':group['offset'],'duration':group['duration']}
module.write_text('// Exact offline performances; Arjun v2 packaged by scripts/package-arjun-offline-v2.py.\nexport const offlineSolos='+json.dumps(solos,separators=(',',':'))+';\nexport const offlineChorus='+json.dumps(chorus,separators=(',',':'))+';\n')
job.update(status='reviewed-integrated',taskId='11627c49-6eea-46e7-a925-4594b9539bc5',assetId='c819695a-f931-49f3-afcc-a535649a17a5',creditsSpent=2,output=source.name,outputSha256=hashlib.sha256(source.read_bytes()).hexdigest(),runtimeVideo=str(out.relative_to(ROOT)),runtimeSha256=hashlib.sha256(out.read_bytes()).hexdigest(),audioLagSeconds=0,audioWaveformCorrelation=correlation,reviewNotes='Revised exact recording supplies Arjun’s solo button, shared final line and isolated chorus. Synthia joins only the final line, animated from her own envelope. No generic talking loop is substituted for these words.')
(directory/'accountant.json').write_text(json.dumps(job,indent=2,ensure_ascii=False)+'\n');print('Arjun v2',correlation,lag,out.stat().st_size)
