import {Blob} from 'node:buffer';
globalThis.Blob=Blob;
import assert from 'node:assert/strict';
import {parseList,paginate,printDocument} from '../dist/proxy-printer.mjs';
assert.deepEqual(parseList('4 Zayas Ritual\n2x Amazon Rider\nThe Lie\n\n').map(r=>[r.quantity,r.name,r.error]),[[4,'Zayas Ritual',false],[2,'Amazon Rider',false],[1,'The Lie',false]]);
assert(parseList('0 The Lie')[0].error);assert(parseList('-2 The Lie')[0].error);assert(parseList('301 The Lie')[0].error);assert(parseList('2.5 The Lie')[0].error);
assert.deepEqual(paginate(Array(19).fill(1)).map(p=>p.length),[9,9,1]);assert.equal(paginate(Array(9).fill(1)).length,1);
const c={name:'<img onerror=alert(1)>',original:'https://example.org/card.png'};
const doc=printDocument(Array(10).fill(c));assert.equal((doc.match(/<section/g)||[]).length,2);assert.equal((doc.match(/<img src=/g)||[]).length,10);assert(doc.includes('size:A4 portrait'));assert(doc.includes('63mm'));assert(!doc.includes('alt="<img'));
assert.throws(()=>printDocument([c],64,88));assert.throws(()=>printDocument([c],63,NaN));
console.log('Proxy printer: quantities, invalid input, 9-up pagination, A4 dimensions and escaping passed.');
const {createPDF}=await import('../dist/proxy-pdf.mjs');
const input='3x Cursed Command\n 3x Illuminated Fairy\n2x Pixie Trickster\n 1x Vindariell, Protector of the Gates\n 3x Member of the Winged Blades\n 2x Oracle\n 2x Fraya, Baroness of Truth\n 3x Mother of the Spectral Moth Swarm\n 3x The Invisible Ones';
const rows=parseList(input);assert(rows.every(r=>!r.error));assert.equal(rows.reduce((n,r)=>n+r.quantity,0),22);
const ids=rows.flatMap(r=>Array(r.quantity).fill(r.name)),images=new Map(rows.map(r=>[r.name,{width:630,height:880,bytes:new Uint8Array([255,216,255,217])}]));
const pdf=await createPDF(ids,images).text();assert(pdf.startsWith('%PDF-1.4'));assert(pdf.includes('/Count 3'));assert.equal((pdf.match(/\/Subtype \/Image/g)||[]).length,9);assert.equal((pdf.match(/ Do Q/g)||[]).length,22);assert.equal((pdf.match(/\/MediaBox/g)||[]).length,3);assert.throws(()=>createPDF(ids,images,64));
console.log('Direct PDF: supplied 22-card list, three pages and reused image objects passed.');

assert.deepEqual(parseList('• 3x Cursed Command\r- 3x Illuminated Fairy\u2028\u200b2x Pixie Trickster').map(r=>[r.quantity,r.name,r.error]),[[3,'Cursed Command',false],[3,'Illuminated Fairy',false],[2,'Pixie Trickster',false]]);

assert.deepEqual(parseList(input.replace(/\n/g,' ')).map(r=>[r.quantity,r.name,r.error]),rows.map(r=>[r.quantity,r.name,r.error]));
