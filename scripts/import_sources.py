"""Rebuild the German rule data and card snapshot using only Python's standard library."""
import re,json,html,hashlib,sys
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote,urlsplit
ROOT=Path(__file__).resolve().parents[1]
def save(name,value):
 (ROOT/'dist/data'/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
text=(ROOT/'sources/rules-de.txt').read_text()
body=text[text.index('\f1 Allgemeine Bestimmungen')+1:]
body=body[:body.index('Anhang I - Regelbegriffe')]
sections=[]
for line in body.replace('\f','\n').splitlines():
 m=re.match(r'^(\d+(?:\.\d+)*)\s+([A-ZÄÖÜ].+)$',line)
 if m and ('.' in m[1] or (int(m[1])<=15 and not m[2].startswith(('Karte','Platz','Bestimmung','Ansage','Bezahlung','Ermittlung')))):
  sections.append(dict(id=m[1],title=m[2].strip(),lines=[]));continue
 if sections:sections[-1]['lines'].append(line)
for s in sections:
 s['body']='\n'.join(s.pop('lines')).strip()
 if s['id']=='8.3.5':
  s['title']+=' Spielmaterial';s['body']=s['body'].removeprefix('Spielmaterial').strip()
 if s['id']=='12.5.2':
  s['title']+=' Trigger)';s['body']=s['body'].removeprefix('Trigger)').strip()
 # Reflow PDF line wraps, retaining paragraph and list boundaries.
 s['body']=re.sub(r'(?<!\n)\n(?!\n|\s*(?:[•▪o]|\d+[.)]|[a-z][.)])\s)', ' ',s['body'])
 s['body']=re.sub(r' {2,}',' ',s['body'])
 s['body']=re.sub(r'\n{3,}','\n\n',s['body'])
 s['page']=next((i+1 for i,p in enumerate(text.split('\f')) if i>=7 and re.search(r'^'+re.escape(s['id'])+r'\s+'+re.escape(s['title'][:15]),p,re.M)),None)
if '--rules' in sys.argv or not (ROOT/'content/rules-de.md').exists():
 save('rules-de.json',sections)
 (ROOT/'content/rules-de.md').write_text('\n\n'.join('# '+s['id']+' '+s['title']+'\n'+s['body'] for s in sections)+'\n')
class Node:
 def __init__(self,tag='',attrs=(),parent=None):self.tag=tag;self.attrs=dict(attrs);self.parent=parent;self.children=[]
 def all(self,p):
  return ([self] if p(self) else [])+[x for c in self.children if isinstance(c,Node) for x in c.all(p)]
 def text(self):return ' '.join(c.text() if isinstance(c,Node) else c for c in self.children).strip()
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.root=Node();self.current=self.root
 def handle_starttag(self,t,a):
  n=Node(t,a,self.current);self.current.children.append(n)
  if t not in ['img','br','hr','input','meta','link','source','area','wbr','embed','param','col']:self.current=n
 def handle_endtag(self,t):
  n=self.current
  while n.parent and n.tag!=t:n=n.parent
  if n.parent:self.current=n.parent
 def handle_data(self,d):self.current.children.append(d)
 def handle_startendtag(self,t,a):self.handle_starttag(t,a);self.handle_endtag(t)
cards=[];seen=set()
for file,setname,slug in [('origin','Origin','kartenspoiler'),('alliances-spoiler','Alliances','alliances-spoiler'),('alliances-starters','Alliances','alliances-spoiler-starter-decks')]:
 p=Parser();p.feed((ROOT/'sources'/f'{file}.html').read_text())
 for n in p.root.all(lambda n:'multicolumn-card' in n.attrs.get('class','').split()):
  imgs=n.all(lambda n:n.tag=='img')
  if not imgs:continue
  src=imgs[0].attrs.get('src','')
  if not src:continue
  if src.startswith('//'):src='https:'+src
  key=src.split('?')[0]
  if key in seen:continue
  seen.add(key)
  filename=unquote(urlsplit(key).path.split('/')[-1]);stem=re.sub(r'\.[^.]+$','',filename)
  titles=n.all(lambda n:n.tag=='h3');name=titles[0].text() if titles else ''
  inferred=not name or name in ['Regular Card','Collector Edition','Serial Number 1 of 1','Foil']
  variant=name if inferred else ''
  cleaned=re.sub(r'_[0-9a-f]{8}-[0-9a-f-]{27,}$','',stem)
  code=re.match(r'^((?:BL_)?[A-Z]{1,3}[_-]?\d+(?:[_-]\d+)?|BL_[A-Z]+-\d+)_(.+)',cleaned)
  if inferred:name=re.sub(r'^(?:F|K|N|L)_+', '', code[2] if code else cleaned).replace('_',' ')
  infos=n.all(lambda n:'rte' in n.attrs.get('class','').split())
  notes='\n\n'.join(i.text() for i in infos)
  parent=n
  while parent.parent and parent.tag!='section':parent=parent.parent
  hs=parent.all(lambda n:n.tag=='h2');group=hs[0].text() if hs else setname
  cards.append(dict(id=hashlib.sha1(key.encode()).hexdigest()[:12],name=name,code=code[1] if code else '',set=setname,group=group,variant=variant,image=src.replace('width=3200','width=750'),original=src,notes=notes,source='https://bluthelden.com/pages/'+slug,nameFromFilename=inferred))
save('cards.json',cards)
(ROOT/'content/cards.json').write_text(json.dumps(cards,ensure_ascii=False,indent=2)+'\n')
print('Rules:',len(sections),'Cards:',len(cards))
