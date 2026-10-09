import assert from 'node:assert/strict';
import {parseList,paginate,printDocument} from '../dist/proxy-printer.mjs';
assert.deepEqual(parseList('4 Zayas Ritual\n2x Amazon Rider\nThe Lie\n\n').map(r=>[r.quantity,r.name,r.error]),[[4,'Zayas Ritual',false],[2,'Amazon Rider',false],[1,'The Lie',false]]);
assert(parseList('0 The Lie')[0].error);assert(parseList('-2 The Lie')[0].error);assert(parseList('301 The Lie')[0].error);assert(parseList('2.5 The Lie')[0].error);
assert.deepEqual(paginate(Array(19).fill(1)).map(p=>p.length),[9,9,1]);assert.equal(paginate(Array(9).fill(1)).length,1);
const c={name:'<img onerror=alert(1)>',original:'https://example.org/card.png'};
const doc=printDocument(Array(10).fill(c));assert.equal((doc.match(/<section/g)||[]).length,2);assert.equal((doc.match(/<img src=/g)||[]).length,10);assert(doc.includes('size:A4 portrait'));assert(doc.includes('63mm'));assert(!doc.includes('alt="<img'));
assert.throws(()=>printDocument([c],64,88));assert.throws(()=>printDocument([c],63,NaN));
console.log('Proxy printer: quantities, invalid input, 9-up pagination, A4 dimensions and escaping passed.');
