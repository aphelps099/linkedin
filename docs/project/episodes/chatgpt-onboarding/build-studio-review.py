from pathlib import Path
import sys,shutil,json
from html import escape
root=Path(sys.argv[1]).resolve();repo=Path(__file__).resolve().parents[4];shutil.copy2(repo/'public/home-2/fonts/tt-hoves-regular.ttf',root/'assets/hoves.ttf')
(root/'index.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>A more intentional first day · Studio cut</title><style>@font-face{font-family:Hoves;src:url('assets/hoves.ttf')}*{box-sizing:border-box}body{margin:0;background:#101114;color:#f5f6f8;font:18px Hoves,Arial,sans-serif}main{max-width:1440px;margin:auto;padding:36px 28px 60px}h1{font-size:clamp(32px,4.5vw,60px);font-weight:400;letter-spacing:-.04em;margin:18px 0}p{color:#bdc4d0;line-height:1.5;max-width:860px}video{display:block;width:100%;aspect-ratio:16/9;background:#17181c;border-radius:12px}a{color:#a8c6ff;text-underline-offset:4px}.chapters{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0 28px}button{border:1px solid #4b5260;border-radius:6px;background:#272b34;color:#f0f3f7;padding:12px 18px;font:16px Hoves;cursor:pointer}button:hover{background:#35435a}button:focus-visible,a:focus-visible{outline:3px solid #92b9ff;outline-offset:4px}footer{border-top:1px solid #323640;margin-top:36px;padding-top:24px;color:#9d9fa8;font-size:16px;line-height:1.6}@media(max-width:600px){main{padding:22px 14px}.chapters{gap:8px}button{padding:10px 12px}}</style><main><a href="../photo-plus/">Previous cut</a><h1>A more intentional first day.</h1><p>The band joins the paper collage. The original Synergy voice and quiet post afterwards.</p><video id="episode" controls playsinline preload="metadata" poster="output/frames/review-5.png" src="output/chatgpt-meeting-studio-v10.mp4"><track kind="captions" label="English" srclang="en" src="output/captions.vtt"></video><div class="chapters"><button data-time="0">Collage intro</button><button data-time="2.5">Meeting</button><button data-time="57.9">Synergy EQ</button><button data-time="76.5">After the meeting</button><button data-time="90.5">Hashtags</button></div><p>96 seconds · 1080p · Enhanced original camera sources<br>The spoken announcement is gone. Synergy drafts, copies and pastes the post after leaving the meeting.</p><a href="output/chatgpt-meeting-studio-v10.mp4" download>Download this cut</a><footer>linkedinbeats.com<br>Not affiliated with LinkedIn.<br>A project by Aaron Phelps at Look-Serious.com</footer></main><script>const video=document.querySelector('video');document.querySelectorAll('[data-time]').forEach(b=>b.addEventListener('click',()=>{video.currentTime=Number(b.dataset.time);video.play().catch(()=>{})}));</script></html>''')
# The production slate is separate from finished films and release dates.
queue_path=repo/'docs/project/episodes/production-queue.json'
if queue_path.exists():
 queue=json.loads(queue_path.read_text());cards=[]
 for item in queue['episodes']:
  brief=json.loads((queue_path.parent/item['brief']).read_text())
  duration=brief['target_seconds'];minutes,seconds=divmod(duration,60)
  cast_names={'synergy':'Synergy','guitar':'Kevin','people':'People & Culture','accountant':'Arjun','operations':'Operations','printer':'Printer'}
  cast=', '.join(cast_names.get(w,w) for w in brief['cast'])
  beats=''.join('<li>'+escape(b)+'</li>' for b in brief['beats'])
  status='First cut ready' if item['status']=='review-cut-ready' else 'Queued'
  review=f"<p><a href='{escape(item['review_url'])}'>Watch the first cut ↗</a></p>" if item.get('review_url') else ''
  cards.append(f"<li class='queued-episode'><span class='queue-status'>Episode {escape(brief['episode'])} · {status}</span><h3>{escape(brief['title'])}</h3><p>{escape(brief['premise'])}</p>{review}<details><summary>Production brief</summary><p>Target: about {minutes}:{seconds:02d}<br>Cast: {escape(cast)}</p><ol>{beats}</ol><p><strong>Next:</strong> {escape(brief['next_step'])}.</p></details></li>")
 section="<section class='production-queue' aria-labelledby='up-next'><h2 id='up-next'>Up next</h2><p>Three 90-second first cuts are ready for review. <a href='/youtube/'>YouTube channel art and downloads ↗</a></p><ol class='queue-list'>"+''.join(cards)+"</ol></section>"
 style=".production-queue{margin-top:48px;border-top:1px solid #323640;padding-top:24px}.production-queue h2{font-size:32px;font-weight:400}.queue-list{list-style:none;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.queued-episode{background:#1b1e25;border:1px solid #353b47;border-radius:12px;padding:22px}.queue-status{font-size:16px;color:#b9d0fa}.queued-episode h3{font-size:27px;font-weight:400;margin:16px 0}.queued-episode p,.queued-episode li{font-size:17px;line-height:1.55}.queued-episode details{border-top:1px solid #353b47;padding-top:14px}.queued-episode summary{cursor:pointer;color:#b9d0fa}.queued-episode summary:focus-visible{outline:3px solid #92b9ff;outline-offset:4px}.queued-episode ol{padding-left:22px}.queued-episode li+li{margin-top:12px}@media(max-width:900px){.queue-list{grid-template-columns:1fr}}"
 page=(root/'index.html').read_text().replace('</style>',style+'</style>',1).replace('<footer>',section+'<footer>',1)
 (root/'index.html').write_text(page)
# Preserve the historic cut, but remove rejected voice auditions from its active page.
old=root.parent/'photo-plus/index.html'
if old.exists():
 s=old.read_text();start=s.find('<h2 id="voices">');end=s.find('<h2 id="cast">')
 if start>=0 and end>start:s=s[:start]+s[end:]
 s=s.replace(' · <a href="#voices">Compare Synergy voices</a>','')
 if 'New studio cut: steady meeting and quiet LinkedIn ending' not in s:s=s.replace('<main>','<main><p><a href="../studio/">New studio cut: steady meeting and quiet LinkedIn ending</a></p>',1)
 old.write_text(s)
print('Studio review saved; rejected auditions removed from the previous review')
