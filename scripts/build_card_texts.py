"""Compile machine transcriptions; keep reviewed corrections separate from imports.
Run offline after run_card_ocr.py and extract_card_values.py. No images are published.
"""
import json,re,collections
from pathlib import Path
from urllib.parse import unquote,urlsplit
ROOT=Path(__file__).resolve().parents[1]
COLORS={'WH':'white','GR':'green','BK':'black','OR':'orange','BL':'blue','PU':'purple','BR':'brown','RD':'red','EQ':'grey'}
TYPES=['Character','Resource','Rune','Sovereign','Training','Artifact','Ritual','Spell','Miracle','Token']
STATS={'ASP':'asp','LVL':'level','RES':'res','INI':'ini','POW':'pow','HP':'hp','MAG':'magic','LP':'lp'}
def read(path):return json.loads(path.read_text())
def lines_text(lines):
 rows=[]
 for l in sorted(lines,key=lambda l:l['y']):
  if rows and abs(rows[-1][0]-l['y'])<.014:rows[-1][1].append(l)
  else:rows.append((l['y'],[l]))
 return '\n'.join(' '.join(l['text'] for l in sorted(row,key=lambda l:l['x'])) for _,row in rows)
def build():
 cards=read(ROOT/'content/cards.json');terms=read(ROOT/'dist/data/glossary.json');result={}
 overrides=read(ROOT/'content/card-overrides.json')
 for c in cards:
  p=ROOT/'.cache/card-ocr'/(c['id']+'.json')
  if not p.exists():raise ValueError('Missing transcription: '+c['id'])
  lines=read(p)['lines'];vpath=ROOT/'.cache/card-values'/(c['id']+'.json');vision=read(vpath) if vpath.exists() else {'values':{},'icons':{}}
  top=[l for l in lines if .048<l['y']<.14 and .15<l['x']<.86 and (re.search(r'Character|Resource|Rune|Sovereign|Soverelgn|Training|Artifact|Ritual|Spell|Miracle|Token|Advisor|Elf',l['text']) or l['text'].strip() in ['MIRACLE','SPELL','TOKEN'])]
  typeline=lines_text(top).replace('Soverelgn','Sovereign').replace('Spelli','Spell').replace('Adivsor','Advisor')
  types=[t for t in TYPES if re.search(r'\b'+t+r'\b',typeline,re.I)]
  if 'Miracle' in types and 'Spell' not in types:types.append('Spell')
  if 'Rune' in types and 'Resource' not in types:types.append('Resource')
  if 'Advisor' in typeline and 'Character' not in types:types.append('Character')
  traits=[t for t in ['Mythic','Epic','Token','Advisor','Fundamental','Martial'] if re.search(r'\b'+t+r'\b',typeline,re.I)]
  subtype=re.sub(r'\b('+ '|'.join(TYPES+['Mythic','Epic','Equilibra']) +r')\b','',typeline,flags=re.I)
  subtypes=[s for s in re.split(r'[,\s]+',subtype) if re.fullmatch(r'[A-Za-z][A-Za-z-]+',s) and s.lower() not in ['white','green','black','orange','blue','purple','brown','red','grey']]
  name=unquote(urlsplit(c['original']).path).split('/')[-1]
  prefix=re.match(r'(WH|GR|BK|OR|BL|PU|BR|RD|EQ)(?=[_\d-])',name)
  color=COLORS[prefix[1]] if prefix else None
  if not color:
   code=re.search(r'\b(WH|GR|BK|OR|BL|PU|BR|RD)[ -]*(?:PR|TK|[0-9])',lines_text([l for l in lines if l['y']>.925]))
   if code:color=COLORS[code[1]]
  group=c['group'].lower()
  for word,value in [('weiß','white'),('grün','green'),('schwarz','black'),('orange','orange'),('blue','blue'),('blau','blue'),('purple','purple'),('brown','brown'),('red','red'),('equilibra','grey')]:
   if word in group:color=value
  if 'Equilibra' in typeline:color='grey'
  footer=lines_text([l for l in lines if l['y']>.925]);m=re.search(r'(?:^|\n)\s*([KNLFT])\b\s*([^\n]*?)(?:\s+ORI|\s+ALI|\s+Art|\s+[©O]|$)',footer)
  rarity=m[1] if m else None
  number=m[2].strip() if m else c['code']
  artist=re.search(r'Art[.:]?\s*(.+)',footer,re.I)
  body=lines_text([l for l in lines if .48<l['y']<.925 and (len(l['text'])>8 or l['width']>.22)])
  body=re.sub(r'(?<=\w)-\n(?=[a-z])','',body)
  body=re.sub(r'©(?=\s*[,.:])','[Turn]',body)
  nums={value:vision['values'].get(key) for key,value in STATS.items()}
  for l in lines:
   if not re.fullmatch(r'\d{1,2}|X',l['text']):continue
   n=int(l['text']) if l['text'].isdigit() else l['text']
   if l['x']<.15 and l['y']<.11:
    k='lp' if 'Sovereign' in types else 'asp'
    if 'Resource' not in types and 'Token' not in types and nums[k] is None:nums[k]=n
   if .84<l['x']<.94 and l['y']<.42 and nums['level'] is None:nums['level']=n
   if 'Character' in types and .45<l['y']<.78:
    for k,lo,hi in [('res',.20,.245),('ini',.52,.57),('pow',.70,.77),('hp',.78,.84)]:
     if lo<l['x']<hi and nums[k] is None:nums[k]=n
  # An absent printed value is not zero. Optional values remain null.
  if 'Resource' in types or 'Token' in types:nums['asp']=None
  if 'Sovereign' in types:nums['asp']=None
  else:nums['lp']=None
  if 'Character' not in types:
   for k in ['pow','hp','res','ini']:nums[k]=None
  if 'Advisor' in traits:
   for k in ['pow','hp','ini']:nums[k]=None
  if not any(t in types for t in ['Character','Resource']):nums['level']=None
  for k,n in list(nums.items()):
   if isinstance(n,int) and (n<0 or n>(60 if k=='lp' else 30)):nums[k]=None
  mechanics={k:True if vision['icons'].get(k) or re.search(pat,body,re.I) else None for k,pat in [('pool',r'(?!)'),('binding',r'\bBinding\b|remains Bound'),('rise',r'\bRise\b')]}
  if 'Resource' in types and 'Rune' not in types:mechanics.update(pool=True,binding=True)
  if c['group']=='Pool Deck':mechanics['pool']=True
  keywords=[t['en'] for t in terms if t['kind']=='Keyword' and re.search(r'(?<!\w)'+re.escape(t['en'])+r'(?!\w)',body,re.I)]
  additional=lines_text([l for l in lines if l['x']<.25 and .12<l['y']<.57 and re.search(r'\+\d',l['text'])]) if 'Sovereign' in types else ''
  result[c['id']]={'typeLine':typeline,'types':types,'subtypes':list(dict.fromkeys(subtypes)),'traits':traits,'colors':[color] if color else [],'rarity':rarity,'collectorNumber':number,'artist':artist[1] if artist else '', 'language':'en','stats':nums,'mechanics':mechanics,'keywords':keywords,'rulesText':body,'additionalCostsText':additional,'rawText':lines_text(lines),'status':'machine','source':c['original'],'method':'Apple Vision OCR + layout/Tesseract; source group and filename for color','reviewedFields':[]}
  for key,value in overrides.get(c['id'],{}).items():
   if isinstance(value,dict):result[c['id']][key].update(value)
   else:result[c['id']][key]=value
 # Share only an unambiguous source color across exact-name variants; never numeric values.
 by_name=collections.defaultdict(set)
 def normal(n):return re.sub(r'[^a-z0-9]','',n.lower())
 for c in cards:
  by_name[(c['set'],normal(c['name']))].update(result[c['id']]['colors'])
 for c in cards:
  colors=by_name[(c['set'],normal(c['name']))]
  if not result[c['id']]['colors'] and len(colors)==1:
   result[c['id']]['colors']=sorted(colors)
   result[c['id']]['method']+='; color shared with same-name variant'
 (ROOT/'content/card-texts.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(f'{len(result)} card transcriptions compiled')
 print('Missing types:',sum(not c['types'] for c in result.values()),'Missing colors:',sum(not c['colors'] for c in result.values()))
 print('Numeric coverage:',{key:sum(c['stats'][key] is not None for c in result.values()) for key in STATS.values()})
if __name__=='__main__':build()
