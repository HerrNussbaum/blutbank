"""Resume local Apple Vision OCR. Requires the compiled recognize-cards helper."""
from pathlib import Path
import subprocess,time,json
ROOT=Path(__file__).resolve().parents[1]
helper=ROOT/'.cache/recognize-cards'
helper.parent.mkdir(parents=True,exist_ok=True)
(ROOT/'.cache/card-ocr').mkdir(parents=True,exist_ok=True)
if not helper.exists():
 subprocess.run(['swiftc',str(ROOT/'scripts/recognize_cards.swift'),'-o',str(helper)],check=True)
cards=json.loads((ROOT/'content/cards.json').read_text())
for i,c in enumerate(cards,1):
 image=ROOT/'.cache/card-images'/(c['id']+'.img');out=ROOT/'.cache/card-ocr'/(c['id']+'.json')
 if out.exists():continue
 # Downloads may still be in progress; allow the concurrent cache job to finish.
 for _ in range(120):
  if image.exists() and image.stat().st_size>1000:break
  time.sleep(2)
 if not image.exists():raise RuntimeError('Missing image '+c['id'])
 subprocess.run([str(ROOT/'.cache/recognize-cards'),str(image)],check=True,cwd=ROOT,stdout=subprocess.DEVNULL,timeout=120)
 if not out.exists():raise RuntimeError('OCR failed '+c['id'])
 if i%25==0 or i==len(cards):print(f'{i}/{len(cards)} transcribed',flush=True)
