"""Prepare speech envelopes for photo animation without changing any audio."""
from pathlib import Path
import sys,json,shutil
import numpy as np
from scipy.io import wavfile
base=Path(sys.argv[1]).resolve();out=base/'photo/output';out.mkdir(parents=True,exist_ok=True)
timeline=json.loads((base/'output/timeline.json').read_text())
data={'hz':50,'lines':{}}
for event in timeline['events']:
 rate,a=wavfile.read(base/f'source/take-{event["index"]}.wav')
 a=a.astype(float)/32768;step=rate//50
 levels=np.array([np.sqrt(np.mean(a[k:k+step]**2)) for k in range(0,len(a),step)])
 levels=np.minimum(1,levels/max(.03,np.percentile(levels,88)));levels[levels<.08]=0
 data['lines'][str(event['index'])]=np.round(levels,3).tolist()
(out/'envelopes.json').write_text(json.dumps(data))
for name in ['timeline.json','captions.vtt']:shutil.copy2(base/'output'/name,out/name)
