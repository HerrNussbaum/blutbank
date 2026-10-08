"""Compile editable English Markdown and glossary TSV into the static site's JSON data."""
import re,json,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def save(n,data): (ROOT/'dist/data'/n).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
source=json.loads((ROOT/'dist/data/rules-de.json').read_text())
pages={s['id']:s.get('page') for s in source}
de=[]
for part in re.split(r'^# ',(ROOT/'content/rules-de.md').read_text(),flags=re.M)[1:]:
 head,_,body=part.partition('\n');id,title=head.split(' ',1);de.append(dict(id=id,title=title,body=body.strip(),page=pages.get(id)))
save('rules-de.json',de)
source=de
en=[]
for part in re.split(r'^# ',(ROOT/'content/rules-en.md').read_text(),flags=re.M)[1:]:
 head,_,body=part.partition('\n');id,title=head.split(' ',1);en.append(dict(id=id,title=title,body=body.strip()))
assert [s['id'] for s in source]==[s['id'] for s in en], 'English section IDs differ from German source'
save('rules-en.json',en)
terms=[]
for line in (ROOT/'content/glossary.tsv').read_text().splitlines():
 if not line or line.startswith('#'):continue
 id,de,en,rule,aliases,deText,enText=line.split('\t')
 terms.append(dict(id=id,de=de,en=en,rule=rule,aliases=aliases.split('|') if aliases else [],deText=deText,enText=enText,kind='Keyword' if id.startswith('kw-') else ''))
assert len({t['id'] for t in terms})==len(terms)
assert all(not t['rule'] or t['rule'] in {s['id'] for s in source} for t in terms)
save('glossary.json',terms)
print(f'{len(source)} bilingual sections; {len(terms)} glossary entries')

cards=json.loads((ROOT/'content/cards.json').read_text())
texts=json.loads((ROOT/'content/card-texts.json').read_text())
assert set(texts)=={c['id'] for c in cards}, 'Every card needs a text record'
overrides=json.loads((ROOT/'content/card-overrides.json').read_text())
assert set(overrides)<=set(texts), 'Correction references an unknown card ID'
for id, patch in overrides.items():
 for key,value in patch.items():
  if isinstance(value,dict): texts[id][key].update(value)
  else: texts[id][key]=value
for c in cards:
 d=texts[c['id']]
 d['keywords']=[t['en'] for t in terms if t['kind']=='Keyword' and re.search(r'(?<!\w)'+re.escape(t['en'])+r'(?!\w)',d['rulesText'],re.I)]
 c['text']=d
save('cards.json',cards)
save('card-texts.json',[{'id':c['id'],'name':c['name'],'set':c['set'],**texts[c['id']]} for c in cards])
import csv
with (ROOT/'dist/data/card-texts.csv').open('w',newline='',encoding='utf-8-sig') as f:
 columns=['id','name','set','typeLine','colors','rarity','asp','level','pow','hp','res','ini','magic','lp','rulesText','additionalCostsText','status','source']
 writer=csv.DictWriter(f,fieldnames=columns);writer.writeheader()
 for c in cards:
  d=texts[c['id']];row={k:d.get(k,'') for k in columns};row.update(id=c['id'],name=c['name'],set=c['set'],colors=', '.join(d['colors']),**d['stats'])
  # Spreadsheet-safe export for source text beginning with formula characters.
  row={k:("'"+v if isinstance(v,str) and v.startswith(('=','+','-','@')) else v) for k,v in row.items()}
  writer.writerow(row)
