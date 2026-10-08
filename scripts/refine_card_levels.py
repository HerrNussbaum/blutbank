"""A focused second OCR pass for small level numerals in the top-right icon stack."""
from extract_card_values import *
import concurrent.futures

def refine(c):
 p=OUT/(c['id']+'.json');record=json.loads(p.read_text())
 if record.get('levelPass'):return
 im=image(c['id']);lines=json.loads((CACHE/'card-ocr'/(c['id']+'.json')).read_text())['lines'];header=' '.join(l['text'] for l in lines if l['y']<.14)
 if not re.search(r'Character|Resource',header) or 'Rune' in header:return
 candidates=[]
 for dy in [0,100,200,300]:
  arr=np.asarray(im.crop((640,43+dy,697,100+dy)))
  if np.mean(np.max(arr,axis=2)<90)<.35:continue # genuine dark icon interior
  # Recognized Pool, Binding and Rise are not level numerals.
  if any(np.mean(bw(Image.fromarray(arr))!=tmp)<.18 for tmp in icons.values()):continue
  rgb=np.asarray(im.crop((650,32+dy,688,70+dy)))
  crop=clean_ink(Image.fromarray(np.where(np.min(rgb,axis=2)>195,0,255).astype('uint8')))
  crop=ImageOps.expand(crop.resize((152,152)),border=20,fill='white');b=io.BytesIO();crop.save(b,format='PNG')
  o=subprocess.run(['tesseract','stdin','stdout','--psm','10'],input=b.getvalue(),capture_output=True,check=True).stdout.decode().strip()
  if o in ['1','2','3','4','5']:candidates.append(int(o))
  elif o in ['I','l','|'] and np.mean(level!=bw(im.crop((640,70+dy,697,98+dy))))<.15:candidates.append(1)
 if len(candidates)==1:record['values']['LVL']=candidates[0]
 record['levelPass']=True;record['levelCandidates']=candidates;p.write_text(json.dumps(record))

if __name__=='__main__':
 cards=json.loads((ROOT/'content/cards.json').read_text())
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for i,_ in enumerate(pool.map(refine,cards),1):
   if i%100==0 or i==len(cards):print(f'{i}/{len(cards)} level checks',flush=True)
