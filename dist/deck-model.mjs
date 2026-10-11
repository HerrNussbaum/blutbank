import {CardSearch} from './card-search.mjs';
import {parseList} from './proxy-printer.mjs?v=3';
export const zones=['sovereign','rune','pool','spell','maybe'];
export const zoneLabels={sovereign:['Herrscher','Sovereign'],rune:['Rune','Rune'],pool:['Pool-Deck','Pool deck'],spell:['Spell-Deck','Spell deck'],maybe:['Merkliste','Considering']};
export function indexCards(cards,identities){return CardSearch.group(cards).map(g=>({...g,id:identities[g.card.id]||g.card.id}));}
export function newDeck(name='Neues Deck'){return {schemaVersion:1,id:crypto.randomUUID(),name,description:'',summary:'',coverPrintingId:'',format:'free',entries:[],updatedAt:new Date().toISOString(),trashed:false};}
export function validateDeck(d,index){
 if(!d||d.schemaVersion!==1||typeof d.id!=='string'||!/^[\w-]{1,80}$/.test(d.id)||typeof d.name!=='string'||!d.name.trim()||d.name.length>120||typeof d.description!=='string'||d.description.length>5000||!Array.isArray(d.entries)||d.entries.length>600)throw Error('Ungültige Deckdatei / Invalid deck file');
 if(d.summary!==undefined&&(typeof d.summary!=='string'||d.summary.length>300))throw Error('Invalid summary');
 if(d.coverPrintingId!==undefined&&(typeof d.coverPrintingId!=='string'||(d.coverPrintingId&&!d.entries.some(e=>e.printingId===d.coverPrintingId))))throw Error('Invalid cover card');
 const seen=new Set();let total=0;
 for(const e of d.entries){const g=index.find(g=>g.id===e.cardId),key=e.printingId+':'+e.zone;if(!g||!g.variants.some(c=>c.id===e.printingId)||!zones.includes(e.zone)||!Number.isInteger(e.quantity)||e.quantity<1||e.quantity>300||seen.has(key))throw Error('Ungültige Karte oder Anzahl / Invalid card or quantity');seen.add(key);total+=e.quantity;}
 if(total>600)throw Error('Maximal 600 Karten inklusive Merkliste / Maximum 600 cards including considering');return d;
}
export function addCard(deck,g,printingId=g.card.id,zone='spell',quantity=1){
 const d=structuredClone(deck),e=d.entries.find(e=>e.printingId===printingId&&e.zone===zone);if(e)e.quantity+=quantity;else d.entries.push({cardId:g.id,printingId,zone,quantity});return d;
}
export function importText(text,index){const entries=[],errors=[];for(const r of parseList(text)){const g=index.find(g=>g.key===CardSearch.nameKey(r.name));if(r.error||!g){errors.push({line:r.number,name:r.name});continue;}const types=g.card.text?.types||[],zone=types.includes('Sovereign')?'sovereign':types.includes('Rune')?'rune':'spell';const e=entries.find(e=>e.cardId===g.id&&e.zone===zone);if(e)e.quantity+=r.quantity;else entries.push({cardId:g.id,printingId:g.card.id,quantity:r.quantity,zone});}return {entries,errors};}
export function deckText(deck,index){return deck.entries.filter(e=>e.zone!=='maybe').map(e=>`${e.quantity}x ${index.find(g=>g.id===e.cardId)?.name||e.cardId}`).join('\n');}
export function deckStats(deck,index){
 const counts=Object.fromEntries(zones.map(z=>[z,0])),curve={},colors={},types={},rarities={},copies=new Map(),issues=[];let unknown=0,unknownRarity=0;
 const count=(obj,key,n)=>obj[key]=(obj[key]||0)+n;
 for(const e of deck.entries){counts[e.zone]+=e.quantity;if(e.zone==='maybe')continue;
  const g=index.find(g=>g.id===e.cardId),c=g?.variants.find(c=>c.id===e.printingId),d=c?.text||{};
  if(e.zone==='spell'){const n=d.stats?.asp;if(typeof n==='number')count(curve,n,e.quantity);else unknown+=e.quantity;}
  for(const key of d.colors||[])count(colors,key,e.quantity);for(const key of d.types||[])count(types,key,e.quantity);count(rarities,d.rarity||'?',e.quantity);
  const old=copies.get(e.cardId)||{name:g?.name,count:0,limits:new Set(),unknown:false};old.count+=e.quantity;const lim={K:4,N:3,L:2,F:1}[d.rarity];if(lim)old.limits.add(lim);else old.unknown=true;copies.set(e.cardId,old);
 }
 for(const r of copies.values()){if(r.unknown||r.limits.size!==1)unknownRarity++;if(r.limits.size&&r.count>Math.min(...r.limits))issues.push(`${r.name}: ${r.count} / ${Math.min(...r.limits)}`);}
 return {counts,curve,unknown,unknownRarity,issues,colors,types,rarities,total:Object.entries(counts).filter(([z])=>z!=='maybe').reduce((n,[,q])=>n+q,0)};
}
export class DeckStore{
 constructor(storage=localStorage){this.storage=storage;this.key='blutbank.decks.v1';}
 read(){const raw=this.storage.getItem(this.key);if(!raw)return [];const data=JSON.parse(raw);if(!Array.isArray(data))throw Error('Gespeicherte Decks sind beschädigt / Stored decks are damaged');return data;}
 save(deck,index){validateDeck(deck,index);const all=this.read(),d={...deck,updatedAt:new Date().toISOString()},i=all.findIndex(x=>x.id===d.id);if(i<0)all.push(d);else all[i]=d;this.storage.setItem(this.key,JSON.stringify(all));return d;}
}
