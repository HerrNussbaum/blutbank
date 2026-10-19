import {costHTML} from './card-symbols.mjs?v=3';
import {bindDeckPreview} from './deck-hover-preview.mjs';
import {aspCost,sovereignProfile,costStatistics,entryCard} from './deck-costs.mjs';
import {deckStats,zones,zoneLabels} from './deck-model.mjs?v=2';
import {CardSearch} from './card-search.mjs';
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeHTML;
export function descriptionHTML(text){
 let out='',list=false;
 for(const line of String(text||'').split('\n')){
  if(/^[-*] /.test(line)){if(!list){out+='<ul>';list=true;}out+='<li>'+esc(line.slice(2))+'</li>';continue;}
  if(list){out+='</ul>';list=false;}
  const h=/^(#{1,3})\s+(.+)$/.exec(line);
  if(h)out+=`<h${h[1].length+1}>${esc(h[2])}</h${h[1].length+1}>`;
  else if(line.trim())out+='<p>'+esc(line)+'</p>';
 }
 return out+(list?'</ul>':'');
}
export function rarityLabel(card,lang){return CardSearch.label(card?.text?.rarity|| (lang==='en'?'Unknown rarity':'Seltenheit unbekannt'),lang);}
export function mountPresentation(root,deck,index,lang){
 const t=(d,e)=>lang==='en'?e:d,stats=deckStats(deck,index),profile=sovereignProfile(deck,index);
 let view='images',group='type',sort='name',adjusted=false;
 root.innerHTML=`<div class="deck-view-controls"><label>${t('Ansicht','View')}<select id="deck-view"><option value="images">${t('Kartenbilder','Card images')}</option><option value="text">${t('Textliste','Text list')}</option></select></label><label>${t('Gruppierung','Group by')}<select id="deck-group"><option value="type">${t('Kartentyp','Card type')}</option><option value="rarity">${t('Seltenheit','Rarity')}</option><option value="color">${t('Farbe','Color')}</option><option value="none">${t('Nur Deckbereiche','Deck zones only')}</option></select></label><label>${t('Sortierung','Sort by')}<select id="deck-sort"><option value="name">Name</option><option value="asp">ASP</option><option value="quantity">${t('Anzahl','Quantity')}</option></select></label><label class="cost-toggle"><input type="checkbox" id="deck-adjusted">${t('Herrscher-Aufschläge einrechnen','Include Sovereign surcharges')}</label><p class="cost-help">${profile?esc(profile.name):t('Für diesen Herrscher ist noch keine geprüfte Farbleiste verfügbar. Angepasste Kosten bleiben unbekannt.','No reviewed color bar available for this Sovereign. Adjusted costs remain unknown.')}</p></div><div id="presented-cards"></div><section class="deck-statistics"><h2>${t('Statistiken','Statistics')}</h2><div id="deck-cost-statistics"></div><div class="statistics-grid"><section><h3>${t('Deckbereiche','Deck zones')}</h3><dl>${zones.map(z=>`<div><dt>${zoneLabels[z][lang==='en'?1:0]}</dt><dd>${stats.counts[z]}</dd></div>`).join('')}</dl></section>${[['colors',t('Farben','Colors')],['types',t('Kartentypen','Card types')],['rarities',t('Seltenheiten','Rarities')]].map(([k,label])=>`<section><h3>${label}</h3><div class="stat-distribution">${Object.entries(stats[k]).sort((a,b)=>b[1]-a[1]).map(([name,q])=>`<div><span>${esc(CardSearch.label(name,lang))}</span><b>${q}</b><small>${stats.total?Math.round(q/stats.total*100):0}%</small><meter min="0" max="${Math.max(1,stats.total)}" value="${q}">${q}</meter></div>`).join('')||'—'}</div></section>`).join('')}</div><p class="muted">${t('Ohne Merkliste. Karten mit mehreren Farben oder Typen zählen in jeder passenden Kategorie.','Excluding considering. Cards with multiple colors or types count in each matching category.')}</p></section><section class="deck-check"><h2>${t('Deckbauprüfung','Deck checks')}</h2><p>${t('Kopienlimits zählen über alle Versionen und Deckbereiche, ohne Merkliste. Formatgrenzen und Verbotslisten werden noch nicht vollständig geprüft.','Copy limits combine all printings and deck zones, excluding considering. Format sizes and banned lists are not fully checked yet.')}</p>${stats.issues.length?`<ul>${stats.issues.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:`<p>${t('Keine Überschreitung der bekannten Kopienlimits.','No known copy limits exceeded.')}</p>`}<p>${stats.unknownRarity} ${t('Kartennamen mit unbekannter oder widersprüchlicher Seltenheit.','card names with unknown or conflicting rarity.')}</p><a href="#/${lang}/rules/2.4">${t('Deckbauregeln','Deck building rules')}</a></section>`;
 // Controls may be moved into the right rail; keep references, not root queries.
 const list=root.querySelector('#presented-cards'),metrics=root.querySelector('#deck-cost-statistics');
 const summary=document.createElement('dl');summary.className='deck-summary';summary.setAttribute('aria-label',t('Deckübersicht','Deck summary'));list.before(summary);
 const costHelp=root.querySelector('.cost-help');costHelp.id='deck-cost-help';costHelp.classList.toggle('visually-hidden',!!profile);root.querySelector('#deck-adjusted').setAttribute('aria-describedby',costHelp.id);
 for(const [id,change] of [['deck-view',v=>view=v],['deck-group',v=>group=v],['deck-sort',v=>sort=v]])root.querySelector('#'+id).onchange=e=>{change(e.target.value);draw();};
 root.querySelector('#deck-adjusted').onchange=e=>{adjusted=e.target.checked;draw();};
 const hidePreview=bindDeckPreview(root);
 function draw(){
  hidePreview();
  root.classList.toggle('deck-text-view',view==='text');
  let reveal=0;
  const renderZone=z=>{
   const entries=deck.entries.filter(e=>e.zone===z).map(e=>({...e,card:entryCard(e,index)}));if(!entries.length)return '';
   entries.sort((a,b)=>{const ac=aspCost(a.card,profile,adjusted),bc=aspCost(b.card,profile,adjusted);return (sort==='asp'?(ac.value??Infinity)-(bc.value??Infinity):sort==='quantity'?b.quantity-a.quantity:0)||a.card.name.localeCompare(b.card.name);});
   const groups=new Map();for(const e of entries){const d=e.card.text||{},key=group==='type'?(d.types||[]).map(x=>CardSearch.label(x,lang)).join(' / '):group==='rarity'?rarityLabel(e.card,lang):group==='color'?(d.colors||[]).map(x=>CardSearch.label(x,lang)).join(' / '):'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
   return `<section class="presented-zone"><h2>${zoneLabels[z][lang==='en'?1:0]} <small>${entries.reduce((n,e)=>n+e.quantity,0)}</small></h2><div class="presentation-groups ${view==='images'?'image-groups':''}">${[...groups].map(([key,items])=>`<section${key?` aria-label="${esc(key)}"`:''} style="--group-size:${Math.min(items.length,5)}"><div class="${view==='images'?'presentation-images':'presentation-text'}">${items.map(e=>{
    return `<a class="presentation-card ${view==='images'?'deck-glass deck-reveal':'deck-card-name'}" style="--reveal-index:${Math.min(reveal++,10)}" href="#/${lang}/card/${e.card.id}">${view==='images'?`<img src="${esc(e.card.image)}" alt="${esc(e.card.name)}" loading="lazy">`:''}<span class="presentation-quantity">${e.quantity}×</span><span class="presentation-name" title="${esc(e.card.name)}">${esc(e.card.name)}</span>${view==='text'?`<img class="deck-hover" src="${esc(e.card.image)}" alt="" loading="lazy">`:''}</a>`;
   }).join('')}</div></section>`).join('')}</div></section>`;
  };
  const leaders=renderZone('sovereign')+renderZone('rune');
  list.innerHTML=deck.entries.length?`<div class="deck-top-zones">${leaders?`<div class="leader-zones ${view==='text'?'leader-text':''}">${leaders}</div>`:''}${renderZone('pool')}</div>`+['spell','maybe'].map(renderZone).join(''):`<p>${t('Dieses Deck enthält noch keine Karten. Wähle „Bearbeiten“, um loszulegen.','This deck has no cards yet. Choose “Edit” to get started.')}</p>`;
  const c=costStatistics(deck,index,adjusted),number=n=>n===null?'—':n.toLocaleString(lang,{maximumFractionDigits:1}),max=Math.max(1,...Object.values(c.curve));
  summary.innerHTML=[[stats.total,t('Karten','Cards')],[c.unique,t('Verschiedene','Distinct')],[number(c.average),t('Ø ASP · Spell','Average spell ASP')],[stats.issues.length,t('Limit-Hinweise','Limit issues')]].map(([value,label])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  metrics.innerHTML=`<section class="cost-chart"><h3>${t('ASP-Kurve · Spell-Deck','ASP curve · Spell deck')}${adjusted?' · '+t('mit Aufschlägen','with surcharges'):''}</h3><div class="asp-histogram">${Object.entries(c.curve).sort((a,b)=>a[0]-b[0]).map(([n,q])=>`<div aria-label="{${n}}: ${q} ${t('Karten','cards')}"><b>${q}</b><span class="asp-bar" style="--bar-height:${Math.max(3,q/max*100)}%"></span><span>${costHTML(n)}</span></div>`).join('')||'<p>—</p>'}</div><p class="muted">${c.known} / ${c.total} ${t('Spell-Karten berechnet','spell cards calculated')} · ${c.unknown} ${t('unbekannt','unknown')}${adjusted?` · ${c.increased} ${t('mit Aufschlag','with surcharge')} · ${c.forbidden} ${t('ausgeschlossen','forbidden')}`:''}</p><p class="muted">${t('Aufgedruckte ASP-Kosten; optional mit der geprüften Farbleiste des Herrschers. Weitere Karteneffekte sind nicht eingerechnet. Unbekannte und ausgeschlossene Karten zählen nicht zum Mittelwert.','Printed ASP costs, optionally with the reviewed Sovereign color bar. Other card effects are not included. Unknown and forbidden cards are excluded from the average.')}</p></section>`;
 }
 draw();
}
