/** Verify the content graph and actual link renderer, without browser dependencies. */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {CardSearch} from '../dist/card-search.mjs';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>JSON.parse(readFileSync(resolve(root,'dist/data',name+'.json'),'utf8'));
const de=read('rules-de'),en=read('rules-en'),terms=read('glossary'),cards=read('cards');
assert.deepEqual(de.map(x=>x.id),en.map(x=>x.id),'Translation sections must match');
for(const [name,items] of Object.entries({de,en,terms,cards})){
 assert.equal(new Set(items.map(x=>x.id)).size,items.length,`${name}: duplicate IDs`);
}
assert.equal(de.filter(x=>!x.id.includes('.')).length,15);
for(const r of de)assert(r.page>=8&&r.page<=78,`PDF reference: ${r.id}`);
for(const t of terms){assert(t.de&&t.en&&t.deText&&t.enText,`Missing translation: ${t.id}`);assert(!t.rule||de.some(r=>r.id===t.rule),`Broken rule: ${t.id}`)}
for(const c of cards){assert(c.name&&c.id&&c.source,`Incomplete card: ${c.id}`);for(const key of ['image','original','source'])assert.equal(new URL(c[key]).protocol,'https:')}
assert(cards.some(c=>c.set==='Origin')&&cards.some(c=>c.set==='Alliances'));
let script=readFileSync(resolve(root,'dist/app.js'),'utf8');
script=script.slice(0,script.indexOf("$('.skip')"));
const context=vm.createContext({console,CardSearch,document:{querySelector:()=>null}});
vm.runInContext(script.replace(/^import .*;\n/gm,''),context);
context.data={de,en,terms,cards};
vm.runInContext('de=data.de;en=data.en;terms=data.terms;cards=data.cards;state={lang:"de"};',context);
const render=(text,lang='de')=>{context.input=text;context.language=lang;return vm.runInContext('state.lang=language;linkText(input)',context)};
assert(render('HP und ASP und Priorität').includes('/glossary/hp'));
assert(render('Kapitel 4.9.3 und 3.2.1').includes('/rules/4.9.3'));
assert(render('Kapitel 4.9.3 und 3.2.1').includes('/rules/3.2.1'));
assert(!render('dies ist so').includes('/glossary/dies'));
assert(render('this Character dies','en').includes('/en/glossary/dies'));
assert(!render('Kapitel 12.1.4').includes('/rules/12.1.4'));
assert(!render('<img onerror="alert(1)">').includes('<img'));
let links=0;
for(const lang of ['de','en']){
 for(const item of [...(lang==='de'?de:en).map(r=>r.body),...terms.map(t=>t[lang+'Text'])]){
  const html=render(item,lang);
  for(const m of html.matchAll(/href="#\/(de|en)\/(rules|glossary)\/?([^"\s]*)"/g)){
   links++;assert.equal(m[1],lang);const target=decodeURIComponent(m[3]);
   assert(!target||(m[2]==='rules'?de:terms).some(x=>x.id===target),`Dangling link ${m[0]}`);
  }
 }
}
context.input=de.find(r=>r.id==='13.3').body;
const table=vm.runInContext('renderBody(input)',context);
assert.equal((table.match(/<table>/g)||[]).length,2,'REL tables must render semantically');
console.log(`Validated ${de.length} bilingual sections, ${terms.length} terms, ${cards.length} card variants and ${links} internal references.`);
