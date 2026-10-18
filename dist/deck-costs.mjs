// Printed Sovereign color bars, visually checked against official card images.
// A null surcharge means forbidden, not a free spell. See docs/DESIGN.md.
const profiles={
 white:[["green","blue"],["brown","purple"],["red","orange"],"black"],
 green:[["white","blue"],["brown","purple"],["red","black"],"orange"],
 black:[["red","orange"],["brown","purple"],["green","blue"],"white"],
 orange:[["red","black"],["brown","purple"],["white","blue"],"green"],
 blue:[["green","white"],["brown","purple"],["orange","black"],"red"],
 brown:[["red","green"],["black","white"],["orange","blue"],"purple"],
 red:[["black","orange"],["brown","purple"],["green","white"],"blue"],
 purple:[["orange","blue"],["black","white"],["red","green"],"brown"]
};
// Match identities by name so alternate printings share their reviewed color bar.
const reviewedNames=new Set(['Sirunian Seehoff, King of Falkenheim','KingLomeling, Guardian of the Forest','Barabas Ulfaran, Prince of Nachtheim','Kaela al Shamal, Shaman King','Airell the Blue, Chairman of the Mages of Glimmertal','Krador, Sovereign of Stone and Soil','Pyrana, the Ember-Priestress', 'Lysera, The Last Light Fairy', 'Valdar Stormwing, General of the Falcon Guard', 'Elaria Windwhisper, Keeper of the Gale', 'Vorathis, Demonlord General', 'Noctara, Queen of the Moths', "Rha'Velkor, Tribal Chief", 'Thordrin Rockaxe, the Lerium Guardian', "Grak'Nar, the Bloodrage", 'Miralyn Windblade, Bearer of the Covenant'].map(n=>n.toLowerCase()));
export const entryCard=(entry,index)=>index.find(g=>g.id===entry.cardId)?.variants.find(c=>c.id===entry.printingId);
export function sovereignProfile(deck,index){
 const entries=deck.entries.filter(e=>e.zone==='sovereign');
 if(entries.length!==1||entries[0].quantity!==1)return null;
 const card=entryCard(entries[0],index),colors=card?.text?.colors||[];
 if(colors.length!==1||!reviewedNames.has(card.name.toLowerCase())||!profiles[colors[0]])return null;
 return {name:card.name,color:colors[0],bar:profiles[colors[0]]};
}
export function aspCost(card,profile,adjusted=false){
 const base=card?.text?.stats?.asp;
 if(!Number.isFinite(base))return {status:'unknown',base:null,value:null};
 if(!adjusted)return {status:'known',base,value:base,surcharge:0};
 const colors=card.text?.colors||[];
 if(!profile||colors.length!==1)return {status:'unknown',base,value:null};
 const color=colors[0];
 if(color===profile.bar[3])return {status:'forbidden',base,value:null};
 const surcharge=color===profile.color||color==='grey'?0:profile.bar.slice(0,3).findIndex(row=>row.includes(color));
 return surcharge<0?{status:'unknown',base,value:null}:{status:'known',base,value:base+surcharge,surcharge};
}
export function costStatistics(deck,index,adjusted=false){
 const profile=sovereignProfile(deck,index),curve={},names=new Set();let total=0,known=0,sum=0,unknown=0,forbidden=0,increased=0;
 for(const entry of deck.entries){if(entry.zone==='maybe')continue;names.add(entry.cardId);if(entry.zone!=='spell')continue;
 total+=entry.quantity;const cost=aspCost(entryCard(entry,index),profile,adjusted);
 if(cost.status==='forbidden'){forbidden+=entry.quantity;continue;}
 if(cost.status!=='known'){unknown+=entry.quantity;continue;}
 known+=entry.quantity;sum+=cost.value*entry.quantity;curve[cost.value]=(curve[cost.value]||0)+entry.quantity;
 if(cost.surcharge>0)increased+=entry.quantity;
 }
 const costs=Object.keys(curve).map(Number).sort((a,b)=>a-b);
 return {profile,curve,total,known,unknown,forbidden,increased,unique:names.size,average:known?sum/known:null,min:costs[0]??null,max:costs.at(-1)??null};
}
