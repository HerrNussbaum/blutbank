"""Cache official card fronts for offline transcription; never ships the image cache."""
import concurrent.futures,json,time,sys,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'.cache/card-images';folder.mkdir(parents=True,exist_ok=True)
cards=json.loads((ROOT/'content/cards.json').read_text())
if len(sys.argv)>1:cards=cards[:int(sys.argv[1])]
def fetch(c):
 p=folder/(c['id']+'.img')
 if p.exists() and p.stat().st_size>1000:return True
 url=c['original'].replace('width=3200','width=1250')
 for attempt in range(3):
  try:
   subprocess.run(['curl','-fsSL','--max-time','60','--output',str(p),url],check=True,capture_output=True)
   return True
  except Exception as e:
   if attempt==2:return {'id':c['id'],'error':str(e)}
   time.sleep(2*(attempt+1))
failed=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,result in enumerate(pool.map(fetch,cards),1):
  if result is not True:
   failed.append(result);print(result,flush=True)
  if i%25==0 or i==len(cards):print(f'{i}/{len(cards)} images cached',flush=True)

if failed:raise SystemExit(f"{len(failed)} image downloads failed; rerun to resume")
