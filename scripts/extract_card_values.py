"""Recognize printed numbers and layout icons. Requires Pillow, NumPy and Tesseract.
Values stay machine-transcribed until reviewed; missing icons are not interpreted as zero.
"""
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw,ImageFont
import numpy as np,json,subprocess,re,io,concurrent.futures,sys,csv
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'.cache';OUT=CACHE/'card-values';OUT.mkdir(exist_ok=True)
def image(id):return Image.open(CACHE/'card-images'/f'{id}.img').convert('RGB').resize((744,1040))
# Documented reference fronts shipped separately from the website, already in the official import.
a=image('4bee77b4f168');r=image('7086e7323b11');s=image('f8dbbb09d20f')
template=np.asarray(a.crop((144,704,203,772)).resize((30,34)),dtype=float)/255
mask=np.ones((34,30),bool);mask[5:-5,5:-5]=False
reference=template[mask]
def gold_box(im,x):
 arr=np.asarray(im.resize((372,520)),dtype=float)/255
 best=(1,None)
 for xx in range(round(x/2)-4,round(x/2)+5):
  for yy in range(220,405):
   patch=arr[yy:yy+34,xx:xx+30]
   if patch.shape!=template.shape:continue
   err=float(np.mean((patch[mask]-reference)**2))
   if err<best[0]:best=(err,(xx*2,yy*2))
 return best
# Icons use a fixed black/white design independent of the card's faction.
def bw(im):return np.asarray(im.convert('L').resize((32,32)))>170
icons={'pool':bw(r.crop((640,43,697,100))), 'binding':bw(r.crop((640,143,697,200))), 'rise':bw(s.crop((640,43,697,100)))}
level=bw(a.crop((640,70,697,98)))
def clean_ink(crop):
 arr=np.asarray(crop).copy();seen=set();components=[]
 for y,x in zip(*np.where(arr==0)):
  if (y,x) in seen:continue
  todo=[(y,x)];seen.add((y,x));part=[]
  while todo:
   yy,xx=todo.pop();part.append((yy,xx))
   for dy,dx in [(1,0),(-1,0),(0,1),(0,-1)]:
    q=(yy+dy,xx+dx)
    if 0<=q[0]<arr.shape[0] and 0<=q[1]<arr.shape[1] and arr[q]==0 and q not in seen:seen.add(q);todo.append(q)
  components.append(part)
 if not components:return crop
 largest=max(map(len,components));out=np.full(arr.shape,255,dtype='uint8')
 for part in components:
  if len(part)>=largest*.3 and max(p[0] for p in part)-min(p[0] for p in part)>arr.shape[0]*.45:
   for y,x in part:out[y,x]=0
 return Image.fromarray(out)
def process(c):
 out=OUT/(c['id']+'.json')
 if out.exists() and not "--refresh" in sys.argv:return
 im=image(c['id']);lines=json.loads((CACHE/'card-ocr'/(c['id']+'.json')).read_text())['lines']
 header=' '.join(l['text'] for l in lines if l['y']<.13).lower()
 detected={};levelslot=None
 for slot,dy in enumerate([0,100,200,300]):
  crop=im.crop((640,43+dy,697,100+dy));sample=bw(crop)
  for key,tmp in icons.items():
   if np.mean(tmp!=sample)<.12:detected[key]=True
  if np.mean(level!=bw(im.crop((640,70+dy,697,98+dy))))<.10:levelslot=dy
 crops=[]
 if not re.search(r'\b(resource|rune|token)\b',header):
  rgb=np.asarray(im.crop((44,45,98,88) if "sovereign" in header else (50,55,90,87)));crop=Image.fromarray(np.where(np.min(rgb,axis=2)>205,0,255).astype('uint8'));crop=clean_ink(crop);crops.append(('LP' if 'sovereign' in header else 'ASP',crop))
 if levelslot is not None:
  rgb=np.asarray(im.crop((650,36+levelslot,688,67+levelslot)));crop=Image.fromarray(np.where(np.min(rgb,axis=2)>205,0,255).astype('uint8'));crops.append(('LVL',crop))
 ischar='character' in header or 'advisor' in header
 positions=({'RES':144,'INI':379,'POW':522,'HP':572} if ischar else {'MAG':95})
 scores={}
 if 'advisor' in header:positions={'RES':144}
 if not re.search(r'\b(resource|rune|sovereign)\b',header):
  for key,x in positions.items():
   err,pos=gold_box(im,x);scores[key]=round(err,4)
   if pos and err<.030:
    xx,yy=pos;crop=im.crop((xx+10,yy+12,xx+49,yy+51)).convert('L').point(lambda x:0 if x<100 else 255);crops.append((key,crop))
 canvas=Image.new('RGB',(360,max(1,len(crops))*110),'white');draw=ImageDraw.Draw(canvas);font=ImageFont.load_default(size=36)
 for i,(key,crop) in enumerate(crops):
  draw.text((10,i*110+30),key,fill='black',font=font);canvas.paste(crop.resize((crop.width*2,crop.height*2)),(160,i*110+10))
 b=io.BytesIO();canvas.save(b,format='PNG')
 run=subprocess.run(['tesseract','stdin','stdout','--psm','6','tsv'],input=b.getvalue(),capture_output=True,check=True)
 rows=list(csv.DictReader(io.StringIO(run.stdout.decode()),delimiter='\t'));values={};recognized=[]
 for row in rows:
  word=row['text'].strip();recognized.append(word)
  if int(row['left'])<145 or not re.fullmatch(r'[0-9]{1,2}|X',word):continue
  index=min(int(row['top'])//110,len(crops)-1)
  if index>=0:values[crops[index][0]]=int(word) if word.isdigit() else word
 raw=' '.join(recognized)
 out.write_text(json.dumps({'values':values,'icons':detected,'scores':scores,'raw':raw}))
 return c['id']
if __name__=='__main__':
 cards=json.loads((ROOT/'content/cards.json').read_text());cards=[c for c in cards if (CACHE/'card-ocr'/(c['id']+'.json')).exists()]
 if len(sys.argv)>1:cards=cards[:int(sys.argv[1])] if sys.argv[1].isdigit() else cards
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for i,_ in enumerate(pool.map(process,cards),1):
   if i%25==0 or i==len(cards):print(f'{i}/{len(cards)} card values',flush=True)
