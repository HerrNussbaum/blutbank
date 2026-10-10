import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {CardSearch} from '../dist/card-search.mjs';
const path=new URL('../dist/data/card-identities.json',import.meta.url),cards=JSON.parse(readFileSync(new URL('../dist/data/cards.json',import.meta.url))),ids=existsSync(path)?JSON.parse(readFileSync(path)):{};
for(const g of CardSearch.group(cards)){const existing=[...new Set(g.variants.map(c=>ids[c.id]).filter(Boolean))];if(existing.length>1)throw Error('Conflicting stable card identities: '+g.name);const id=existing[0]||'card-'+g.variants.map(c=>c.id).sort()[0];for(const c of g.variants)ids[c.id]=id;}
writeFileSync(path,JSON.stringify(ids,null,2)+'\n');
