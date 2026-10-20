"""Build a catalog from recovered media; originals stay in object storage."""
import json,re,hashlib,subprocess,sys,concurrent.futures
from pathlib import Path
import cv2
W=Path(sys.argv[1]);R=Path(__file__).resolve().parents[1];OUT=R/'public/cutting-room/posters';OUT.mkdir(parents=True,exist_ok=True)
assets=[];uploads=[];seen={}
castmap={'guitar':'Kevin','kevin':'Kevin','keys':'Keys','drums':'Operations','operations':'Operations','people':'People & Culture','strategy':'Strategy','arjun':'Arjun','accountant':'Arjun','linda':'Linda','synergy':'Synergy','synthia':'Synthia','printer':'Printer','droid':'Paper droid'}
lib=json.load(open(W/'catalog/download-input.json'))['result']['items']
libmeta={x['name']:x for x in lib if 'name' in x}
manifest=json.load(open(R/'src/meeting-room/media-manifest.json'))['assets'];mediameta={Path(a['video']).stem:a for a in manifest}
def slug(t):return re.sub('[^a-z0-9]+','-',t.lower()).strip('-')[:95]
def add(p,title,cat,desc,cast=[],status='Source take',notes='',tags=[],transcript='',rank=5,task=None,source=None):
 p=Path(p)
 if not p.exists():print('MISSING',p,flush=True);return
 sha=hashlib.sha256(p.read_bytes()).hexdigest()
 if sha in seen:return
 ident=slug(title)+'-'+sha[:8];seen[sha]=ident
 a={'id':ident,'title':title,'category':cat,'description':desc,'cast':cast,'status':status,'notes':notes,'tags':tags,'transcript':transcript,'rank':rank,'_path':str(p),'sha256':sha}
 if p.is_relative_to(R/'public'):a['src']='/'+str(p.relative_to(R/'public'));a['download']=a['src']
 else:
  key=ident+'.mp4';a['src']='/api/cutting-room/media/'+key;a['download']=a['src']+'?download=1';uploads.append({'path':str(p),'key':key,'sha256':sha})
 if task:a['sourceTaskId']=task
 if source:a['sourceReference']=source
 assets.append(a)
add(W/'brand-story/v6/LinkedIn-Beats-Welcome-to-the-Office-720p.mp4','Welcome to the Office — V6','Finished films','The banner crew returns. Instruments, robot jargon, and a corporate round of applause.',['Synergy','Synthia','Kevin','Keys','Operations','People & Culture','Banner crew','Printer','Paper droid'],'Current edit','End card and tagline removed. Restores arrival, installation, and measuring footage. Full music and dialogue.',['brand story','signs','humbled and honored','optimize onboarding','circle back'],rank=0)
add(W/'brand-story/v5/LinkedIn-Beats-Welcome-to-the-Office-720p.mp4','Welcome to the Office — V5','Finished films','Previous brand edit with the final blue end card.',['Synergy','Synthia','Kevin','Keys','Printer'],'Earlier version','Superseded by V6. Retained for comparison.',rank=8)
add(W/'brand-story/v5/source/LinkedIn-Beats-Welcome-to-the-Office-720p.mp4','Welcome to the Office — V4','Finished films','Earlier screen interaction edit, before printer and Synthia corrections.',['Synergy','Synthia','People & Culture','Printer'],'Earlier version','Known issues: printer direction, laptop foreground overlap, Synthia face patch. Use V6 for current footage.',rank=9)
full={'Office-Band-Hero-720p':'The Office Band — original hero','LinkedIn-Beats-Good-to-Disconnect-Full-With-Audio':'Good to Disconnect — full music mix','LinkedIn-Beats-Good-to-Disconnect-Full-Dialogue-Only':'Good to Disconnect — dialogue only','Going-Paperless-Synthia-Opening-30s':'Going Paperless — Synthia opening','Circle-Back-Complete-720p':'Let’s Circle Back — complete','One-Mind-Many-Perspectives-Debra-Voice-Fixed-720p':'One Mind, Many Perspectives — corrected voice','Make-It-Sound-Like-Me-Windows-Voice-720p':'Make It Sound Like Me — Windows voice','LinkedIn-Beats-We-Added-Other-720p':'We Added Other','LinkedIn-Masterclass-Realistic-Post':'Learn to Speak LinkedIn — masterclass','Training-02-Final-Mix':'Training 02 — How to Answer Without Answering','Authenticity-Rollout-Full-90s-720p':'Authenticity Rollout — 90-second version','Authenticity-Rollout-Synthia-Closeup-720p':'Authenticity Rollout — Synthia close-up','Synergy-and-Synthia-Quick-Sync':'Synergy & Synthia — Quick Sync'}
for p in sorted((W/'catalog/source/library').glob('*.mp4')):
 stem=p.stem;title=full.get(stem,stem.replace('LinkedIn-Beats-','').replace('-',' ').replace('720p','').strip());cat='Finished films' if stem in full else 'Office scenes';status='Available edit';rank=2;cast=[];desc='';notes='Sampled frames reviewed. Check the complete clip before a new final edit.'
 if 'Good-to-Disconnect' in stem:
  cast=['Kevin','Operations','People & Culture','Paper droid','Printer'];desc='A bookshelf becomes a LinkedIn lesson at the break-room table. The conversation creates paperwork.'
  if 'Preview' in stem or 'Opening' in stem:status='Earlier version';rank=8
 if 'Office-Band' in stem:cast=['Kevin','Keys','Operations','Printer','Paper droid'];desc='The original office band: drums, cubicles, a conference room, and the paper delivery droid.'
 if 'Concept' in stem or 'Loop-Silent' in stem:status='Earlier version';rank=8
 if 'Circle-Back' in stem:cast=['Synergy','Keys','People & Culture','Operations','Arjun','Printer'];desc='A musical Zoom meeting finds an entire chorus in “let’s circle back.”'
 if 'One-Mind' in stem:cast=['Synergy','Synthia','Kevin','People & Culture','Keys','Linda','Arjun','Printer'];desc='Corporate training on singularity equality, with the corrected closing voice.'
 if 'Make-It' in stem:cast=['Synergy','Printer'];desc='A deadpan robot post about writing posts, plus a ChatGPT typing sequence.'
 if 'Authenticity' in stem:cast=['Synergy','Synthia','Kevin','Keys','People & Culture','Operations','Arjun','Printer'];desc='The conference-room authenticity training, with continual LinkedIn paperwork.';status='Needs review';notes='Continuity has previously needed repair. Check robot mouths, paper stability, laptop action, and voice assignment before reusing.'
 if 'Synthia-Closeup' in stem:status='Available edit';notes='Revised 30-second edit with Synthia’s conference-room close-up.'
 if 'Paperless' in stem:cast=['Synthia','Synergy','People & Culture','Operations','Paper droid','Printer'];desc='Synthia introduces paperless working as the paper cart fills up.'
 if 'Quick-Sync' in stem:cast=['Synergy','Synthia'];desc='A brief office exchange between the two robots.'
 if 'Masterclass' in stem or 'Training-02' in stem:cast=['Synergy'];desc='Blue-screen robot vocabulary training with a realistic post and reaction activity.';cat='Finished films'
 if 'Dropdown' in stem or 'We-Added' in stem:cast=['Synergy','Kevin','Keys','Strategy'];desc='A tiny onboarding change is inflated into an extraordinary professional accomplishment.'
 if 'Animatic' in stem:cat='Experiments';status='Earlier version'
 if 'Scene-4' in stem:cat='Screen inserts';desc='The onboarding post fills the screen while the chorus plays.'
 if 'Scene-3' in stem:status='Needs review';notes='Robot mouth and restrained human motion were discussed as issues. Review before reuse.'
 if 'Office-Copier' in stem:cast=['Printer','Paper droid'];desc='Copier overflow and a passing delivery droid in the original office.'
 if 'Office-Droid' in stem:cast=['Paper droid','Operations'];desc='The paper cart returns to the drummer’s desk.'
 if 'Printer-Stack' in stem:cast=['Printer','Kevin','People & Culture','Operations'];desc='Printer output and break-room paper-stack continuity review.';status='Needs review'
 if 'Meeting-Assets' in stem:cat='Experiments';desc='A contact-sheet-style motion preview of the meeting cast.';cast=['Synergy','Synthia','Kevin','Keys','Operations','People & Culture','Arjun','Linda','Strategy'];status='Earlier version'
 if stem.startswith('aaron'):title='Circle Back collection — model motion';cat='Experiments';desc='The original apparel group in motion.';status='Earlier version'
 add(p,title,cat,desc,cast,status,notes,rank=rank,source=libmeta.get(p.name,{}).get('library_file_id'))
for n,title,desc in [('arrival','The professionals arrive','The suited installer and Circle Back-shirt colleague walk through the cubicles carrying banner hardware.'),('banner','Banner installation — blank plates','Full-body installation shot with clean blue banners for custom print.'),('measure','Measuring authenticity — blank plates','The crew measures the placement of the blue office banners. Includes a reverse angle.')]:
 add(W/f'brand-story/raw/{n}.mp4',title,'Office scenes',desc,['Banner crew'],tags=['signs','installation','linkedin takeover','banners'],rank=1)
for n,title in [('banner','Bring Your Whole Self to Work — banner installation'),('measure','Authenticity Starts Here — measuring')]:
 add(W/f'brand-story/v6/{n}-printed.mp4',title,'Office scenes','The installation crew with finished, tracked banner typography.',['Banner crew'],notes='Printed version. Use the blank plate if you need different banner copy.',tags=['signs','installation','banners','authenticity'],rank=1)
rawinfo={
 'printer':('Printer — outward feed','Printer',['Printer'],'New output direction: pages move out onto the desk. Inspect full page release when choosing a cut.'),
 'synthia':('Synthia — clean face plate','Character performances',['Synthia'],'Clean black face for tracked horizontal LED speech. This raw plate does not contain the finished mouth animation.'),
 'laptop':('Synergy — close laptop plate','Screen inserts',['Synergy'],'Close over-the-shoulder laptop angle. Blank screen; final ChatGPT and Zoom composites are in V6.'),
 'celebration_wide':('Corporate applause — VHS cameraman','Office scenes',['Synergy','Kevin','Keys','Operations','People & Culture'],'The office applauds Synergy while a camcorder operator documents the achievement.'),
 'applause_close':('Corporate applause — closer reaction','Office scenes',['Synergy','Kevin','People & Culture'],'A closer, mildly uncomfortable round of corporate celebration.')}
for n,(title,cat,cast,desc) in rawinfo.items():add(W/f'brand-story/v5/raw/{n}.mp4',title,'Office scenes' if cat=='Printer' else cat,desc,cast,rank=1)
for p in sorted((W/'catalog/source/runway').glob('*.mp4')):
 title=p.stem.replace('-',' ').title();cast=[];cat='Office scenes';notes='Silent source footage. Blank screens or banners may need a tracked graphic for final use.';status='Source take'
 for token,name in castmap.items():
  if token in p.stem and name not in cast:cast.append(name)
 if 'guitar' in p.stem or 'drum' in p.stem or 'keys' in p.stem:cat='Instruments'
 if 'laptop' in p.stem:cat='Screen inserts';status='Earlier version';notes='Older camera angle had foreground-hand problems in the composite. Prefer the close laptop plate.'
 if 'computer' in p.stem:cat='Screen inserts'
 add(p,title,cat,'Reusable office performance or cutaway from the brand film.',cast,status,notes,rank=3)
for p in sorted((R/'public').rglob('*.mp4')):
 s=p.stem;cast=[]
 for token,name in castmap.items():
  if s.startswith(token):cast=[name];break
 title=s.replace('-',' ').replace('exact','—').title();cat='Character performances';status='Source take';notes='';transcript='';rank=5;desc=''
 if '/performances/' in str(p):
  parts=s.split('-');who=parts[0];mt=parts[1];d=R/f'assets/meeting-performances/{mt}-0/{who}.json'
  if 'offline-exact-v2' in s:d=R/'assets/meeting-performances/offline-0-arjun-v2/accountant.json'
  if d.exists():
   data=json.loads(d.read_text());lines=[]
   def walk(x):
    if isinstance(x,dict):
     if 'text' in x and isinstance(x['text'],str) and x['text'] not in lines:lines.append(x['text'])
     for v in x.values():walk(v)
    elif isinstance(x,list):
     for v in x:walk(v)
   walk(data);transcript='\n'.join(lines)
  title=f'{cast[0] if cast else "Kevin"} — {mt.title()} ({parts[-1]})';desc='Scripted meeting performance. '+(transcript.split('\n')[0] if transcript else '')
  if s.endswith('v1') and p.with_name(s[:-2]+'v2.mp4').exists():status='Earlier version'
  notes='Meeting playback supplies the approved voice separately when this file is silent. This is a performance plate, not a complete song.'
 elif '/season/clips/' in str(p):
  state=s.split('-',1)[-1].replace('camera-v2-','').replace('full-','')
  title=f'{cast[0] if cast else s.title()} — {state.replace("-"," ")}'
  if 'camera-v2' in s:title+=' (camera v2)'
  if 'full-' in s:title+=' (wide keys)'
  desc='Subtle listening motion, natural blinks and restrained office presence.' if 'listening' in s else 'Instrument or speaking motion for the meeting studio.'
  if 'playing' in s or 'detail' in s:cat='Instruments'
  m=mediameta.get(s,{});notes=m.get('interfaceNotes','')+' '+('Generic mouth motion. Use an exact scripted performance for dialogue sync.' if 'speaking' in s else 'Silent plate; sound is supplied by the meeting engine.')
  if s=='printer-printing':status='Needs review';notes='Older printer plate had inward feed. Prefer “Printer — outward feed” from the brand-film corrections.'
  if s=='synthia-camera-v2-listening':status='Needs review';notes='Earlier face treatment has a light patch at the bottom of the screen. Prefer the clean Synthia plate for new edits.'
  if s in ['synergy-listening','synthia-listening']:status='Earlier version'
 else:
  cat='Experiments';status='Earlier version';desc='Earlier website motion treatment retained for reference.'
  if s=='profile-conversation':title='Talking Heads — profile conversation'
  if s=='linkedin-beats-campaign-motion':title='Store — original motion hero'
 add(p,title,cat,desc,cast,status,notes,transcript=transcript,rank=rank)
# Keep the clean Synergy master, and original voiced character takes, as reusable source takes.
for p in sorted((R/'assets/meeting-performances').rglob('*.mp4')):
 who=p.stem.split('-')[0];meeting=p.parent.name;cast=[castmap[who]] if who in castmap else ['Synergy'] if 'synergy' in meeting else []
 add(p,f'{cast[0] if cast else who.title()} — {meeting} original take','Character performances','Original performance master, before the meeting-ready trim and interface treatment.',cast,notes='Source master. Compare with the matching trimmed meeting performance before cutting.',tags=['source','original'],rank=7)
# Screen inserts extracted from the finished master are useful without rebuilding the compositor.
insert=W/'catalog/source/inserts';insert.mkdir(parents=True,exist_ok=True)
for name,title,start,end,cast in [('humbled','Humbled and honored to share — phrase card',12.272727,15,['Synergy']),('circle-back','Let’s circle back — phrase card',23.181818,25.90909,['Synthia']),('onboarding','Optimize the onboarding — phrase card',40.90909,43.63636,['Synergy']),('linkedin-reactions','The post, reactions, and comments',30,38.181818,['People & Culture']),('chatgpt','Synergy types into ChatGPT — finished insert',25.90909,30,['Synergy']),('zoom','The meeting loads — finished insert',15,19.090909,['Synergy'])]:
 p=insert/(name+'.mp4')
 if not p.exists():subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-ss',str(start),'-i',str(W/'brand-story/v5/LinkedIn-Beats-Welcome-to-the-Office-720p.mp4'),'-t',str(end-start),'-c:v','libx264','-threads','2','-crf','18','-preset','fast','-c:a','aac','-movflags','+faststart',str(p)],check=True)
 add(p,title,'Screen inserts','Finished typography or screen interaction from the brand film, with the original audio mix.',cast,notes='Extracted from the finished V5 master; graphics are baked in.',rank=3)
def inspect(a):
 p=Path(a['_path']);v=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]));s=next(s for s in v['streams'] if s['codec_type']=='video');a.update(width=s['width'],height=s['height'],duration=round(float(v['format']['duration']),3),audio=any(s['codec_type']=='audio' for s in v['streams']),bytes=p.stat().st_size)
 c=cv2.VideoCapture(str(p));c.set(cv2.CAP_PROP_POS_MSEC,min(a['duration']*.35,3)*1000);ok,f=c.read();c.release()
 if ok:
  h,w=f.shape[:2];f=cv2.resize(f,(640,round(h*640/w)));cv2.imwrite(str(OUT/(a['id']+'.jpg')),f,[cv2.IMWRITE_JPEG_QUALITY,78])
 a['poster']='/cutting-room/posters/'+a['id']+'.jpg';return a
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:assets=list(ex.map(inspect,assets))
assets.sort(key=lambda a:(a['rank'],a['title']));private=[dict(a) for a in assets]
for a in assets:a.pop('_path');a.pop('rank')
data={'updated':'October 20, 2026','coverage':'Recovered finished edits, repo media, and recent Runway source takes. Older unreferenced generations may still require recovery.','cast':sorted(set(c for a in assets for c in a['cast'])),'assets':assets}
(R/'src/cutting-room/catalog.json').write_text(json.dumps(data,indent=2)+'\n');(W/'catalog/upload-manifest.json').write_text(json.dumps(uploads,indent=2));(W/'catalog/private-manifest.json').write_text(json.dumps(private,indent=2));print(json.dumps({'clips':len(assets),'uploads':len(uploads),'uploadMB':sum(Path(x['path']).stat().st_size for x in uploads)/1e6,'postersMB':sum(p.stat().st_size for p in OUT.glob('*.jpg'))/1e6},indent=2))
