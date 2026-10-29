from pathlib import Path
import subprocess,imageio_ffmpeg,json,sys
from scipy.io import wavfile
import numpy as np
p=Path(sys.argv[1]).resolve()/'assets';ff=imageio_ffmpeg.get_ffmpeg_exe()
for n in ['brodie','xylar']:
 subprocess.run([ff,'-loglevel','error','-y','-i',str(p/f'voice-{n}-source.mp3'),'-ar','48000','-ac','1',str(p/f'voice-{n}-decoded.wav')],check=True)
 sr,x=wavfile.read(p/f'voice-{n}-decoded.wav');x=x.astype(float)/32768
 if n=='brodie':x=x*(.94+.06*np.cos(2*np.pi*72*np.arange(len(x))/sr))
 wavfile.write(p/f'voice-{n}-treated.wav',sr,np.int16(np.clip(x,-1,1)*32767))
 subprocess.run([ff,'-loglevel','error','-y','-i',str(p/f'voice-{n}-treated.wav'),'-af','highpass=f=90,loudnorm=I=-18:TP=-2:LRA=7','-ar','48000',str(p/f'voice-{n}.wav')],check=True)
subprocess.run([ff,'-loglevel','error','-y','-i',str(p/'voice-current.wav'),'-af','loudnorm=I=-18:TP=-2:LRA=7','-ar','48000',str(p/'voice-current-levelled.wav')],check=True)
(p/'voice-auditions.json').write_text(json.dumps({'text':'Today, I used ChatGPT to optimize our onboarding checklist. A more intentional first day. About staying human in the age of AI.','A':{'voice':'Brodie','task':'dc281d53-9bdf-433a-9741-5ed76a7e2bd4','treatment':'94% dry carrier plus 6% 72Hz amplitude modulation; highpass 90Hz; no echo'},'B':{'voice':'Xylar','task':'c2a4c415-3055-4659-a733-d1cb0962e6aa','treatment':'Preset modulated character; highpass 90Hz; no added echo'},'normalization':'All comparison files target -18 LUFS, -2 dBTP','episode':'Existing canonical Synergy audio retained'},indent=2))
