/** Pure card search shared by the catalogue, archive search and regression tests. */
const names = {
  white:['Weiß','White'], black:['Schwarz','Black'], orange:['Orange','Orange'], green:['Grün','Green'],
  blue:['Blau','Blue'], purple:['Lila','Purple'], brown:['Braun','Brown'], red:['Rot','Red'], grey:['Grau / Equilibra','Grey / Equilibra'],
  Character:['Charakter','Character'], Resource:['Ressource','Resource'], Rune:['Rune','Rune'], Sovereign:['Herrscher','Sovereign'],
  Training:['Training','Training'], Artifact:['Artefakt','Artifact'], Ritual:['Ritual','Ritual'], Spell:['Zauberspruch','Spell'], Miracle:['Wunder','Miracle'], Token:['Token','Token'], Reference:['Regelkarte','Reference card'],
  K:['K · Known (4×)','K · Known (4×)'], N:['N · Noted (3×)','N · Noted (3×)'], L:['L · Legendary (2×)','L · Legendary (2×)'], F:['F · Fabulous (1×)','F · Fabulous (1×)'], T:['Token','Token']
};
const numeric = ['asp','level','pow','hp','res','ini','magic','lp'];
const normalize = value => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'");
const label = (value,lang='de') => names[value]?.[lang==='en'?1:0] || value;
function text(card) {
  const d=card.text || {};
  return normalize([card.name,card.code,card.set,card.notes,d.typeLine,d.rawText,d.rulesText,d.additionalCostsText,d.collectorNumber,d.artist,
    ...(d.types||[]).flatMap(x=>[x,...(names[x]||[])]),...(d.colors||[]).flatMap(x=>[x,...(names[x]||[])]),
    ...(d.subtypes||[]),...(d.traits||[]),...(d.keywords||[]),d.rarity,...(names[d.rarity]||[]),
    ...Object.entries(d.mechanics||{}).filter(([,v])=>v===true).map(([k])=>k)].join(' '));
}
function compare(value,operator,expected) {
  if(typeof value!=='number')return false;
  return ({'=':value===expected,'>':value>expected,'>=':value>=expected,'<':value<expected,'<=':value<=expected})[operator] || false;
}
function query(card,q) {
  const hay=text(card);
  const parts=String(q||'').match(/"[^"]+"|\S+/g)||[];
  return parts.every(part=>{
    const match=/^(asp|level|lvl|pow|hp|res|ini|magic|mag|lp)(<=|>=|=|<|>)(\d+)$/i.exec(part);
    if(match){const key=({lvl:'level',mag:'magic'})[match[1].toLowerCase()]||match[1].toLowerCase();return compare(card.text?.stats?.[key],match[2],Number(match[3]));}
    return hay.includes(normalize(part.replace(/^"|"$/g,'')));
  });
}
function matches(card,filters={}) {
  const d=card.text||{};
  if(!query(card,filters.q))return false;
  for(const key of ['set','group'])if(filters[key]&&card[key]!==filters[key])return false;
  for(const [key,field] of [['color','colors'],['type','types'],['subtype','subtypes'],['trait','traits'],['keyword','keywords']]){
    if(filters[key]&&!(d[field]||[]).includes(filters[key]))return false;
  }
  if(filters.rarity&&d.rarity!==filters.rarity)return false;
  if(filters.mechanic&&d.mechanics?.[filters.mechanic]!==true)return false;
  if(filters.status==='reviewed'&&d.status!=='reviewed')return false;
  if(filters.status==='machine'&&d.status==='reviewed')return false;
  if(filters.unknown&&d.stats?.[filters.unknown]!=null)return false;
  for(const key of numeric){
    for(const [suffix,operator] of [['Min','>='],['Max','<=']]){
      const input=filters[key+suffix];
      if(input!==undefined&&input!==''&&(!/^\d+$/.test(input)||!compare(d.stats?.[key],operator,Number(input))))return false;
    }
  }
  return true;
}
// Keep distinct names distinct; ignore case, spacing and typographic punctuation only.
const nameKey = name => normalize(name).replace(/[^\p{L}\p{N}]/gu,'');
function group(cards,filters={}) {
  const groups=new Map();
  for(const card of cards){
    const key=nameKey(card.name)||card.id;
    if(!groups.has(key))groups.set(key,{key,name:card.name,variants:[]});
    groups.get(key).variants.push(card);
  }
  return [...groups.values()].map(g=>{
    const hits=g.variants.filter(c=>matches(c,filters));
    // Prefer a regular printing when it matches, while preserving every variant.
    const card=hits.find(c=>!c.variant&&!/promo|organized|winner/i.test(c.group||''))||hits[0];
    return {...g,card,matches:hits};
  }).filter(g=>g.card);
}
export const CardSearch={names,numeric,normalize,label,text,query,matches,nameKey,group};
