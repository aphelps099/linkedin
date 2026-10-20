from pathlib import Path
from functools import lru_cache
from PIL import Image,ImageDraw,ImageFont
import numpy as np, math
R=Path('linkedin-hero');BLUE='#0866c2';INK='#1c2024';GRAY='#70757a';W=1280;H=720
@lru_cache(None)
def font(n,b=False):return ImageFont.truetype(str(R/'public/home-2/fonts'/('tt-hoves-demibold.ttf' if b else 'tt-hoves-regular.ttf')),n)
def tx(d,xy,s,n=23,c=INK,b=False):d.text(xy,s,font=font(n,b),fill=c)
def wrap(s,n,width):
 d=ImageDraw.Draw(Image.new('RGB',(1,1)));out=[];line=''
 for w in s.split():
  cand=(line+' '+w).strip()
  if d.textlength(cand,font=font(n))>width:out.append(line);line=w
  else:line=cand
 if line:out.append(line)
 return out

def avatar(im,x,y,size=50,robot=False):
 d=ImageDraw.Draw(im)
 if robot:
  ref=Image.open(R/'public/studio/season/posters/synergy-camera-v2-listening.jpg').convert('RGB').crop((460,80,800,420)).resize((size,size))
  mask=Image.new('L',(size,size));ImageDraw.Draw(mask).ellipse((0,0,size-1,size-1),fill=255);im.paste(ref,(x,y),mask)
 else:
  d.ellipse((x,y,x+size,y+size),fill='#dce5e9');d.ellipse((x+size*.34,y+size*.19,x+size*.66,y+size*.51),fill='#8299a4');d.ellipse((x+size*.20,y+size*.54,x+size*.80,y+size*.92),fill='#8299a4')
def reaction(d,x,y,kind,size=26,lit=True):
 colors=['#378fe9','#df704d','#eeb958'];r=size/2
 d.ellipse((x,y,x+size,y+size),fill=colors[kind] if lit else '#e6e8eb',outline='white',width=2)
 if kind==0:
  d.rounded_rectangle((x+r*.7,y+r*.85,x+r*1.5,y+r*1.5),radius=2,fill='white');d.polygon([(x+r*.75,y+r),(x+r*.95,y+r*.42),(x+r*1.15,y+r*.42),(x+r*1.12,y+r)],fill='white');d.rectangle((x+r*.4,y+r*.90,x+r*.62,y+r*1.48),fill='white')
 elif kind==1:
  d.ellipse((x+r*.45,y+r*.55,x+r*1.05,y+r*1.15),fill='white');d.ellipse((x+r*.95,y+r*.55,x+r*1.55,y+r*1.15),fill='white');d.polygon([(x+r*.50,y+r*.99),(x+r*1.5,y+r*.99),(x+r,y+r*1.62)],fill='white')
 else:
  d.ellipse((x+r*.64,y+r*.38,x+r*1.38,y+r*1.19),outline='white',width=2);d.line((x+r*.82,y+r*1.23,x+r*1.23,y+r*1.23),fill='white',width=2);d.line((x+r*.85,y+r*1.45,x+r*1.2,y+r*1.45),fill='white',width=2)
def base():
 im=Image.new('RGB',(W,H),'#f3f2ef');d=ImageDraw.Draw(im)
 d.rectangle((0,0,W,66),fill='white');d.line((0,65,W,65),fill='#d9dadd')
 d.rounded_rectangle((130,15,165,50),radius=3,fill=BLUE);tx(d,(135,13),'in',29,'white',True)
 d.rounded_rectangle((180,15,470,50),radius=4,fill='#edf3f8');tx(d,(196,20),'⌕   Search',17,GRAY)
 for i,s in enumerate(['Home','My Network','Jobs','Messaging','Notifications','Me']):
  x=540+i*105
  cx=x+25
  if i==0:d.polygon([(cx-11,22),(cx,11),(cx+11,22),(cx+8,22),(cx+8,29),(cx+3,29),(cx+3,23),(cx-3,23),(cx-3,29),(cx-8,29),(cx-8,22)],fill='#666a6e')
  elif i==1:
   d.ellipse((cx-6,10,cx+2,18),fill='#666a6e');d.ellipse((cx+4,12,cx+10,18),fill='#666a6e');d.rounded_rectangle((cx-10,20,cx+4,29),radius=4,fill='#666a6e');d.rounded_rectangle((cx+5,20,cx+13,29),radius=3,fill='#666a6e')
  elif i==2:
   d.rounded_rectangle((cx-11,16,cx+11,29),radius=2,fill='#666a6e');d.rectangle((cx-5,11,cx+5,16),outline='#666a6e',width=2);d.line((cx-10,20,cx+10,20),fill='#f8f8f8')
  elif i==3:
   d.rounded_rectangle((cx-11,11,cx+11,26),radius=4,fill='#666a6e');d.polygon([(cx-6,24),(cx-6,30),(cx+2,24)],fill='#666a6e');d.line((cx-6,17,cx+6,17),fill='white');d.line((cx-6,21,cx+3,21),fill='white')
  elif i==4:
   d.pieslice((cx-9,10,cx+9,34),180,360,fill='#666a6e');d.rectangle((cx-9,21,cx+9,26),fill='#666a6e');d.ellipse((cx-3,26,cx+3,30),fill='#666a6e')
  else:d.ellipse((cx-11,9,cx+11,31),fill='#bbcad2');d.ellipse((cx-4,12,cx+4,20),fill='#697d88');d.ellipse((cx-7,21,cx+7,30),fill='#697d88')
  tx(d,(x,36),s,14,GRAY)
 return im

def post(t):
 im=base();d=ImageDraw.Draw(im);x=235;y=89;w=810
 d.rounded_rectangle((x,y,x+w,702),radius=10,fill='white',outline='#d9dadd',width=1)
 avatar(im,x+24,y+21,54,True);tx(d,(x+91,y+18),'Synergy',23,INK,True);tx(d,(x+185,y+22),'· 1st',18,GRAY)
 tx(d,(x+91,y+48),'Founder & CEO | Thought Leadership | Building in Public',17,GRAY)
 tx(d,(x+91,y+72),'1m · ◉',16,GRAY);tx(d,(x+w-127,y+21),'+ Follow',19,BLUE,True)
 tx(d,(x+24,y+109),'A quick update on our roadmap.',29)
 for i in range(3):reaction(d,x+24+i*18,y+159,i,24)
 tx(d,(x+87,y+162),'42',17,GRAY);tx(d,(x+w-142,y+162),'2 comments',17,GRAY)
 d.line((x+24,y+198,x+w-24,y+198),fill='#e3e3e3')
 for i,s in enumerate(['Like','Comment','Repost','Send']):tx(d,(x+48+i*195,y+210),s,21,GRAY,True)
 d.line((x+24,y+248,x+w-24,y+248),fill='#e3e3e3')
 ay=y+268;avatar(im,x+25,ay,43)
 d.rounded_rectangle((x+82,ay-2,x+w-24,ay+88),radius=9,fill='#f2f2f2')
 tx(d,(x+98,ay+8),'Alex Morgan',20,INK,True);tx(d,(x+226,ay+10),'· 1st',17,GRAY)
 tx(d,(x+98,ay+34),'Product Operations',16,GRAY);tx(d,(x+98,ay+55),'When will it be ready?',24)
 if t<12:
  ry=ay+112;avatar(im,x+52,ry,38,True)
  d.rounded_rectangle((x+102,ry-3,x+w-24,ry+56),radius=23,outline='#a4a7aa',width=1)
  n=int(max(0,t-7.4)*9);text='Friday.'[:n]
  if t>9.6:
   d.rectangle((x+123,ry+11,x+199,ry+39),fill='#b9d8fc')
  tx(d,(x+123,ry+11),text,24)
  if int(t*2)%2==0 and t<9.6:
   a=d.textlength(text,font=font(24));d.line((x+124+a,ry+13,x+124+a,ry+39),fill=BLUE,width=2)
  if t<7:tx(d,(x+122,ry+12),'Add a reply…',21,GRAY)
 else:
  # Every written phrase appears only as Synergy says it.
  lines=["We're taking a phased approach.",'Aligning key stakeholders.','Pressure-testing the roadmap.',"We’ll share more when we have greater visibility."]
  count=1+int(t>=21.5)+int(t>=24.2)+int(t>=27)
  ry=ay+111;avatar(im,x+52,ry,38,True)
  texts=[]
  for s in lines[:count]:texts+=wrap(s,23,635)
  hh=51+len(texts)*28
  d.rounded_rectangle((x+102,ry-3,x+w-24,ry+hh),radius=9,fill='#f2f2f2')
  tx(d,(x+117,ry+6),'Synergy',20,INK,True);d.rounded_rectangle((x+203,ry+8,x+267,ry+29),radius=3,fill='#dedede');tx(d,(x+209,ry+9),'Author',15,GRAY,True)
  for j,s in enumerate(texts):tx(d,(x+117,ry+39+j*28),s,23)
  if t>=19.7:
   rcount=int(3+max(0,t-19.7)*79);r_y=ry+hh+7
   for k in range(3):reaction(d,x+116+k*19,r_y,k,23)
   tx(d,(x+182,r_y+2),f'{rcount:,}',17,GRAY);tx(d,(x+286,r_y+2),'Like   |   Reply',17,BLUE,True)
  if t>=32:
   # Switch to a tighter readable lower conversation crop for the punchline.
   crop=im.crop((235,350,1045,700)).resize((1134,490))
   im=Image.new('RGB',(W,H),'#f3f2ef');im.paste(crop,(73,30));d=ImageDraw.Draw(im)
   d.rounded_rectangle((190,535,1180,660),radius=14,fill='#e7edf3')
   avatar(im,101,545,58);tx(d,(215,550),'Alex Morgan',23,INK,True);tx(d,(215,588),'So… Friday?',37)
 return im

def gpt(t):
 im=Image.new('RGB',(1280,720),'#ffffff');d=ImageDraw.Draw(im)
 d.rectangle((0,0,250,720),fill='#f8f8f8');tx(d,(30,29),'ChatGPT',26,INK,True)
 for i,s in enumerate(['New chat','Search chats','Library','','Roadmap response','Thought leadership','My authentic voice']):tx(d,(27,110+i*46),s,18,GRAY)
 tx(d,(287,26),'ChatGPT',24,INK,True);d.ellipse((1216,20,1256,60),fill='#dbe6d7');tx(d,(1227,27),'S',22,INK,True)
 prompt='Rewrite “Friday” as a visionary LinkedIn reply.\nSound confident. Avoid committing to a date.'
 d.rounded_rectangle((527,111,1212,244),radius=24,fill='#f1f1f1')
 prompt=prompt[:int(max(0,t)*74)]
 for i,s in enumerate(prompt.split('\n')):tx(d,(552,143+i*34),s,25)
 response="We’re taking a phased approach, aligning key stakeholders, and pressure-testing the roadmap. We’ll share more when we have greater visibility."
 n=int(max(0,t-1.5)*100)
 for i,s in enumerate(wrap(response[:n],29,810)):tx(d,(325,311+i*43),s,29)
 if t>3.1:tx(d,(325,542),'Copy',19,GRAY)
 d.rounded_rectangle((303,598,1222,684),radius=27,fill='#f4f4f4',outline='#e4e4e4')
 tx(d,(330,622),'Ask anything',23,GRAY);d.ellipse((1165,616,1208,659),fill='#222');d.line((1186,646,1186,629),fill='white',width=3);d.line((1179,635,1186,628,1193,635),fill='white',width=3)
 return im

def meeting(t):
 im=Image.new('RGB',(W,H),'#edf0f4');d=ImageDraw.Draw(im)
 tx(d,(82,38),'Calendar',25,GRAY,True);tx(d,(82,92),'Friday',43,INK,True)
 for y in range(175,660,85):d.line((72,y,1208,y),fill='#d8dce2');tx(d,(20,y-12),str(9+(y-175)//85)+':00',16,GRAY)
 d.rounded_rectangle((267,78,1029,643),radius=17,fill='white',outline='#d3d6db',width=2)
 tx(d,(303,110),'New meeting',20,GRAY);tx(d,(303,169),'Timeline Alignment',43,INK,True)
 tx(d,(305,232),'Every Friday  ·  9:00–9:30 AM',25,GRAY)
 d.rounded_rectangle((305,292,679,337),radius=7,fill='#e8f1fb');tx(d,(323,302),'Weekly   ·   No end date',22,BLUE,True)
 tx(d,(305,374),'Working group',24,INK,True);tx(d,(305,413),'33 required attendees',24,GRAY)
 tx(d,(305,466),'Decision pending. Progress made.',22,GRAY)
 if t<41:
  d.rounded_rectangle((791,539,984,598),radius=29,fill=BLUE);tx(d,(840,552),'Send',26,'white',True)
 else:
  d.rounded_rectangle((745,539,984,598),radius=29,fill='#087f5b');tx(d,(772,552),'✓ Scheduled',26,'white',True)
 return im

def title(f,t):
 im=Image.fromarray(f);d=ImageDraw.Draw(im)
 d.rounded_rectangle((36,29,531,125),radius=5,fill='#095db5')
 tx(d,(53,41),'LINKEDIN BEATS / TRAINING 02',15,'#c2ddff')
 tx(d,(53,68),'How to answer without answering.',25,'white',True)
 return np.array(im)

def subtitle(f,s):
 im=Image.fromarray(f);d=ImageDraw.Draw(im);n=30;wid=d.textlength(s,font=font(n,True))+44;x=(W-wid)/2
 d.rounded_rectangle((x,638,x+wid,693),radius=6,fill='#121923');tx(d,(x+22,648),s,n,'white',True)
 return np.array(im)

if __name__=='__main__':
 for n,t in [('question',3),('friday',9),('reply',29),('followup',33)]:post(t).save(f'training-02-recut/review/ui-{n}.png')
 gpt(3.5).save('training-02-recut/review/ui-gpt.png');meeting(41).save('training-02-recut/review/ui-meeting.png')
