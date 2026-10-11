import {symbolText,aspText,cardFlow} from './card-symbols.mjs?v=2';
import {mountDeckBuilder} from './deck-builder.mjs';
import {mountAccount,mountShared} from './deck-online.mjs';
import {CardSearch} from './card-search.mjs';
import {mountProxy} from './proxy-printer.mjs?v=3';
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let de=[],en=[],cards=[],terms=[],state={},cardFilters={},limit=48,searchTimer,cardReturn=null,pendingCardReturn=null,pendingArchiveRestore=null; const t=(a,b)=>state.lang==='en'?b:a;
const url=(view,id='',lang=state.lang)=>`#/${lang}/${view}${id?'/'+encodeURIComponent(id):''}${['cards','card'].includes(view)&&['cards','card'].includes(state.view)&&location.hash.includes('?')?'?'+location.hash.split('?')[1]:''}`;
const labels=()=>({rules:t('Turnierregeln','Tournament rules'),glossary:t('Begriffsregister','Glossary'),cards:t('Kartenarchiv','Card archive'),proxy:t('Proxy-Drucker','Proxy printer'),decks:t('Meine Decks','My decks')});
async function start() {
  try {
    [de, en, cards, terms] = await Promise.all(['rules-de','rules-en','cards','glossary'].map(async name => {
      const response = await fetch(`data/${name}.json`);
      if (!response.ok) throw new Error(`Cannot load ${name}`);
      return response.json();
    }));
    window.addEventListener('hashchange', render);
    render();
  } catch (error) {
    $('#content').innerHTML='<h1>Archiv nicht verfügbar / Archive unavailable</h1><p>Bitte die Seite erneut laden. / Please reload this page.</p>';
    console.error(error);
  }
}

function archiveFooter() {
  $('#archive-footer').innerHTML = `<div><span>© Bluthelden · ${t('Unabhängiges Regelarchiv','Independent rule archive')}</span><span>${t('Regelgrundlage: bereitgestelltes Turnierregelwerk · Revision 00','Source: supplied tournament rulebook · Revision 00')}</span></div><div><a href="TournamentRulebook_de.pdf" target="_blank" rel="noopener">${t('Original-Regelwerk (PDF)','Original rulebook (German PDF)')}</a>${state.lang==='en'?'<span>Unofficial English translation. The German source and current official card text remain authoritative.</span>':''}${state.view==='glossary'?`<span>${t('Redaktionell aufbereitete Erklärungen auf Grundlage der Anhänge I–III.','Edited explanations based on Appendices I–III.')}</span>`:''}</div>`;
}
function safeDecode(s){try{return decodeURIComponent(s)}catch{return s}}
function readState(){const p=location.hash.slice(2).split('?')[0].split('/');return {lang:p[0]==='en'?'en':'de',view:['rules','cards','card','glossary','search','proxy','decks','account','shared'].includes(p[1])?p[1]:'rules',id:safeDecode(p.slice(2).join('/'))||(p[1]==='rules'||!p[1]?'1':'')}}
function source(){return state.lang==='en'?en:de}function ruleId(id){return url('rules',id)}
// Link only complete terms. Rule identifiers remain stable in both languages.
function linkText(text, current = '') {
  text=symbolText(text);
  const aliases = new Map();
  for (const term of terms) {
    for (const alias of [term.de, term.en, ...(term.aliases || [])]) {
      if (!alias || alias.length < 2) continue;
      // English “dies” is an ordinary pronoun in German.
      if (state.lang === 'de' && alias.toLowerCase() === 'dies') continue;
      aliases.set(alias.toLowerCase(), term.id);
    }
  }
  const pattern = [...aliases.keys()].sort((a,b) => b.length-a.length)
    .map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const rx = new RegExp(`(?<![\\p{L}\\p{N}_])(${pattern || '(?!)'})(?![\\p{L}\\p{N}_])|\\b((?:[0-9]+\\.)+[0-9]+)\\b|\\b((?:Kapitel|chapter)\\s+([0-9]+)(?![.0-9]))\\b|\\b((?:Anhang|Appendix)\\s+(?:III|II|I))\\b`, 'giu');
  let out = '', last = 0;
  for (const m of text.matchAll(rx)) {
    out += esc(text.slice(last, m.index));
    const targetRule = m[2] || m[4];
    if (targetRule && de.some(s => s.id === targetRule)) {
      out += `<a href="${ruleId(targetRule)}">${esc(m[0])}</a>`;
    } else if (m[5]) {
      out += `<a href="${url('glossary')}">${esc(m[0])}</a>`;
    } else if (m[1] && aliases.get(m[1].toLowerCase()) !== current) {
      const id = aliases.get(m[1].toLowerCase());
      const term = terms.find(x => x.id === id);
      out += `<a class="term" href="${url('glossary', id)}" title="${esc(term[state.lang+'Text'] || '')}">${esc(m[0])}</a>`;
    } else out += esc(m[0]);
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}

// Content supports plain paragraphs, lists and simple Markdown tables.
function renderBody(body) {
  const chunks = body.split(/(\n?\|[^\n]+\|\n\|[ :|\-]+\|\n(?:\|[^\n]+\|(?:\n|$))+)/g);
  return chunks.map(chunk => {
    if (!chunk.trim().startsWith('|')) return linkText(chunk);
    const rows=chunk.trim().split('\n').map(line=>line.split('|').slice(1,-1).map(x=>x.trim()));
    return '<div class="table-wrap"><table><thead><tr>'+rows[0].map(x=>'<th scope="col">'+linkText(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(2).map(row=>'<tr>'+row.map(x=>'<td>'+linkText(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }).join('');
}
function render(){
  clearTimeout(searchTimer);const previous=state;state=readState();document.body.dataset.view=state.view;
  if(state.view==='cards'&&state.id){history.replaceState(history.state,'',url('card',state.id));state=readState();document.body.dataset.view=state.view}
  if(state.view==='card'){
    cardReturn=pendingCardReturn||history.state?.cardReturn||(previous.view==='card'?cardReturn:null);pendingCardReturn=null;
    if(cardReturn)history.replaceState({...history.state,cardReturn},'',location.href);
  }
  document.body.classList.toggle('deck-mode',['decks','account','shared'].includes(state.view));
  document.body.classList.toggle('card-page-mode',state.view==='card');
  document.body.classList.toggle('archive-mode',['cards','card'].includes(state.view));
  limit=48;document.documentElement.lang=state.lang;$('#tabs').setAttribute('aria-label',t('Hauptnavigation','Main navigation'));
  document.body.classList.toggle('catalog',['cards','card','proxy','decks','account','shared'].includes(state.view));
  document.title=`${labels()[state.view]||({account:t('Konto','Account'),shared:t('Geteiltes Deck','Shared deck')})[state.view]||t('Suche','Search')} · Blutbank`;$('.brand').href=url('rules','1');
  $('#tabs').innerHTML=Object.entries(labels()).map(([k,v])=>`<a href="${url(k,k==='rules'?'1':'')}" class="${state.view===k||(k==='cards'&&state.view==='card')?'active':''}" ${state.view===k?'aria-current="page"':''}>${v}</a>`).join('');
  $('#languages').innerHTML=['de','en'].map(l=>`<a href="${url(state.view,state.id,l)}" lang="${l}" aria-label="${l==='de'?'Deutsch':'English'}" class="${state.lang===l?'active':''}" ${state.lang===l?'aria-current="true"':''}>${l.toUpperCase()}</a>`).join('');
  sidebar();
  if(state.view==='rules')rules();if(state.view==='cards')catalog();if(state.view==='card')cardPage();
  if(state.view==='decks')mountDeckBuilder($('#content'),cards,state.lang,state.id);if(state.view==='shared')mountShared($('#content'),cards,state.lang,state.id);if(state.view==='account')mountAccount($('#content'),cards,state.lang);if(state.view==='proxy')mountProxy($('#content'),cards,state.lang);if(state.view==='glossary')glossary();if(state.view==='search')search();
  archiveFooter();window.scrollTo({top:0,behavior:'instant'});
  if(state.view==='rules'&&state.id.includes('.'))requestAnimationFrame(()=>document.getElementById('rule-'+state.id)?.scrollIntoView({behavior:'instant'}));
}
function sidebar(){const menuWasOpen=$('.chapters')?.classList.contains('open');$('#sidebar').innerHTML=`<div class="searchbox"><input id="search" aria-label="${t('Archiv durchsuchen','Search archive')}" placeholder="${t('Regel, Begriff oder Karte …','Rule, term or card …')}" value="${state.view==='search'?esc(state.id):''}"></div><p class="search-hint">${t('Das gesamte Archiv durchsuchen','Search the entire archive')}</p><button class="menu-button" aria-expanded="false">${t('Kapitel anzeigen','Show chapters')}</button><div class="aside-label">${t('Kapitelübersicht','Chapters')}</div><nav class="chapters" aria-label="${t('Kapitel','Chapters')}">${source().filter(s=>!s.id.includes('.')).map(s=>`<a href="${ruleId(s.id)}" class="${state.view==='rules'&&state.id.split('.')[0]===s.id?'active':''}"><span>${s.id.padStart(2,'0')}</span>${esc(s.title)}</a>${state.view==='rules'&&state.id.split('.')[0]===s.id?`<div class="chapter-sections">${source().filter(part=>part.id.startsWith(s.id+'.')).map(part=>`<a href="${ruleId(part.id)}" class="${part.id===state.id?'selected':''}" ${part.id===state.id?'aria-current="location"':''} style="--depth:${part.id.split('.').length-2}"><span>${part.id}</span>${esc(part.title)}</a>`).join('')}</div>`:''}`).join('')}<a href="${url('glossary')}"><span>A–Z</span>${t('Begriffe & Keywords','Terms & keywords')}</a></nav>`;$('#search').addEventListener('keydown',e=>{if(e.key==='Enter'){location.hash=url('search',e.target.value.trim());}});$('#search').addEventListener('input',e=>{clearTimeout(searchTimer);const q=e.target.value;searchTimer=setTimeout(()=>{history.replaceState(null,'',url('search',q));state={...state,view:'search',id:q};document.body.dataset.view='search';document.body.classList.remove('catalog');$('#languages').innerHTML=['de','en'].map(l=>`<a href="${url('search',q,l)}" lang="${l}" aria-label="${l==='de'?'Deutsch':'English'}" class="${state.lang===l?'active':''}">${l.toUpperCase()}</a>`).join('');document.querySelectorAll('#tabs a').forEach(a=>a.classList.remove('active'));document.title=t('Suche','Search')+' · Blutbank';search();archiveFooter();},200)});$('.menu-button').onclick=e=>{const open=$('.chapters').classList.toggle('open');e.target.setAttribute('aria-expanded',open)};if(menuWasOpen){$('.chapters').classList.add('open');$('.menu-button').setAttribute('aria-expanded','true')}}
function rules(){const chapter=state.id.split('.')[0];const current=source().find(s=>s.id===chapter);if(!current){$('#content').innerHTML=`<h1>${t('Regel nicht gefunden','Rule not found')}</h1><a href="${ruleId('1')}">${t('Zur Übersicht','Back to the rules')}</a>`;return}const list=source().filter(s=>s.id===chapter||s.id.startsWith(chapter+'.'));$('#content').innerHTML=`<div class="eyebrow">${t('Kapitel','Chapter')} ${chapter}</div><h1>${esc(current.title)}</h1>${list.map((s,i)=>!i&&!s.body?'':`<section class="rule" id="rule-${s.id}">${i?`<div class="rule-head"><a class="rule-number" href="${ruleId(s.id)}">${s.id}</a><h2>${esc(s.title)}</h2></div>`:''}${s.body?`<div class="rule-copy">${renderBody(s.body)}</div>`:''}${s.body?`<div class="rule-actions"><button data-copy="${ruleId(s.id)}">${t('Abschnitt verlinken','Copy section link')}</button><a href="TournamentRulebook_de.pdf#page=${de.find(x=>x.id===s.id)?.page||1}" target="_blank" rel="noopener">${t('Im Original lesen','Read the original')}</a></div>`:''}</section>`).join('')}<div class="page-links">${+chapter>1?`<a href="${ruleId(String(+chapter-1))}">${t('Vorheriges Kapitel','Previous chapter')}</a>`:'<span></span>'}${+chapter<15?`<a href="${ruleId(String(+chapter+1))}">${t('Nächstes Kapitel','Next chapter')}</a>`:''}</div>`;document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const link=location.href.split('#')[0]+b.dataset.copy;try{await navigator.clipboard.writeText(link);toast(t('Link kopiert','Link copied'))}catch{prompt(t('Link zum Abschnitt','Section link'),link)}})}
function toast(msg){$('#toast').textContent=msg;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',2000)}
function search(){const q=(state.id).trim();const norm=s=>s.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const match=s=>norm(s).includes(norm(q));const rr=q?source().filter(s=>match(s.id+' '+s.title+' '+s.body)):[];rr.sort((a,b)=>(norm(b.id)===norm(q)?100:match(b.title)?10:0)-(norm(a.id)===norm(q)?100:match(a.title)?10:0));const tt=q?terms.filter(x=>match(x.de+' '+x.en+' '+x.aliases.join(' ')+' '+x[state.lang+'Text'])):[];tt.sort((a,b)=>(norm(b[state.lang])===norm(q)?100:match(b[state.lang])?10:0)-(norm(a[state.lang])===norm(q)?100:match(a[state.lang])?10:0));const cc=q?CardSearch.group(cards,{q}):[];$('#content').innerHTML=`<div class="eyebrow">${t('ARCHIVSUCHE','ARCHIVE SEARCH')}</div><h1>${q?esc(q):t('Was möchtest du nachschlagen?','What are you looking for?')}</h1><p class="muted">${q?`${rr.length} ${t('Regeln','rules')} · ${tt.length} ${t('Begriffe','terms')} · ${cc.length} ${t('Karten','cards')}`:t('Suche nach Regelnummern, Begriffen oder Kartennamen.','Search for rule numbers, terms or card names.')}</p>${q&&!rr.length&&!tt.length&&!cc.length?`<div class="empty">${t('Keine Treffer. Versuche einen kürzeren oder englischen Begriff.','No results. Try a shorter term or a German keyword.')}</div>`:''}${tt.map(x=>`<a class="result" href="${url('glossary',x.id)}"><small>${t('BEGRIFF','TERM')}</small><h3>${esc(x[state.lang])}</h3><p>${esc(x[state.lang+'Text'].slice(0,190))}</p></a>`).join('')}${rr.map(s=>`<a class="result" href="${ruleId(s.id)}"><small>${t('REGEL','RULE')} ${s.id}</small><h3>${esc(s.title)}</h3><p>${esc(s.body.slice(Math.max(0,norm(s.body).indexOf(norm(q))-65),Math.max(0,norm(s.body).indexOf(norm(q))-65)+230))}…</p></a>`).join('')}${cc.length?`<h2>${t('Karten','Cards')}</h2><div class="card-grid">${cc.slice(0,60).map(cardHTML).join('')}</div>${cc.length>60?`<a href="${url('cards')}">${t('Weitere Karten im Archiv','More cards in the archive')}</a>`:''}`:''}`;bindCards()}
function cardHTML(group){
  const c=group.card||group,d=c.text||{},hint=`${c.id}-hint`;
  return `<a class="card" href="${url('card',c.id)}" data-card="${c.id}" aria-label="${esc(c.name)}" aria-describedby="${hint}"><img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy" decoding="async" width="750" height="1047"><span class="card-hint" id="${hint}" role="tooltip"><strong>${esc(c.name)} ${aspText(d.stats?.asp)}</strong>${d.typeLine?`<span>${esc(d.typeLine)}</span>`:''}${d.rulesText?`<span class="hint-rules">${esc(cardFlow(d.rulesText))}</span>`:''}<small>${esc(c.set)}${group.variants?.length>1?` · ${group.variants.length} ${t('Versionen','versions')}`:''}</small></span></a>`;
}
const statLabels={asp:['ASP-Kosten','ASP cost'],level:['Level','Level'],pow:['Stärke (POW)','Power (POW)'],hp:['Trefferpunkte (HP)','Health (HP)'],res:['Resistenz (RES)','Resistance (RES)'],ini:['Initiative (INI)','Initiative (INI)'],magic:['Magiewert','Magic value'],lp:['Lebenspunkte (LP)','Life (LP)']};
const cardLabel=value=>CardSearch.label(value,state.lang);
function readCardFilters(){const filters=Object.fromEntries(new URLSearchParams(location.hash.split('?')[1]||''));if(filters.color){filters.colors=filters.color;delete filters.color}if(filters.rarity){filters.rarities=filters.rarity;delete filters.rarity}return filters}
function filterSelect(key,title,values){return `<label>${esc(title)}<select class="pill" data-filter="${key}"><option value="">${t('Alle','All')}</option>${values.map(value=>`<option value="${esc(value)}" ${cardFilters[key]===value?'selected':''}>${esc(cardLabel(value))}</option>`).join('')}</select></label>`}
function filterInput(key,title,placeholder=''){return `<label>${esc(title)}<input class="pill" data-filter="${key}" value="${esc(cardFilters[key]||'')}" placeholder="${esc(placeholder)}"></label>`}
function filterChoices(key,title,values){const selected=(cardFilters[key]||'').split(',');return `<fieldset class="filter-choices"><legend>${title}</legend>${values.map(v=>`<label><input type="checkbox" data-multi="${key}" value="${esc(v)}" ${selected.includes(v)?'checked':''}>${esc(cardLabel(v))}</label>`).join('')}</fieldset>`}
function catalog(){
  cardFilters=readCardFilters();const restore=pendingArchiveRestore||history.state?.archive;pendingArchiveRestore=null;
  if(restore?.hash===location.hash)limit=restore.limit||48;
  const options=field=>[...new Set(cards.flatMap(c=>c.text?.[field]||[]))].sort((a,b)=>cardLabel(a).localeCompare(cardLabel(b),state.lang));
  $('#content').innerHTML=`<div class="catalog-heading"><h1>${t('Kartenarchiv','Card archive')}</h1></div>
    <form class="catalog-search" id="quick-search"><label class="sr-only" for="card-search">${t('Karten durchsuchen','Search cards')}</label><input id="card-search" class="pill" value="${esc(cardFilters.q||'')}" placeholder="${t('Karten durchsuchen …','Search cards …')}" type="search"><button class="pill" type="submit">${t('Suchen','Search')}</button></form>
    <details class="advanced-filters" id="advanced-search" ${restore?.advanced?'open':''}><summary>${t('Erweiterte Suche','Advanced search')}<span id="active-filters"></span></summary>
    <form id="advanced-form">
      <div class="advanced-row"><h2>${t('Name & Text','Name & text')}</h2><div class="advanced-fields">${filterInput('name',t('Kartenname','Card name'))}${filterInput('text',t('Kartentext','Rules text'),t('z. B. Flying oder {T}','e.g. Flying or {T}'))}<p class="filter-help">${t('Wörter werden kombiniert, Anführungszeichen suchen eine Wortgruppe.','Words are combined; quotation marks match a phrase.')}</p></div></div>
      <div class="advanced-row"><h2>${t('Farben','Colors')}</h2><div class="advanced-fields">${filterChoices('colors',t('Kartenfarben','Card colors'),options('colors'))}<label>${t('Farbvergleich','Color comparison')}<select class="pill" data-filter="colorMode">${[['include',t('Enthält diese Farben','Including these colors')],['exact',t('Genau diese Farben','Exactly these colors')],['atmost',t('Höchstens diese Farben','At most these colors')]].map(([v,l])=>`<option value="${v}" ${cardFilters.colorMode===v?'selected':''}>${l}</option>`).join('')}</select></label><p class="filter-help">${t('„Enthält“ erlaubt weitere Farben. „Höchstens“ erlaubt Teilmengen der ausgewählten Farben.','“Including” allows additional colors. “At most” allows subsets of your selected colors.')}</p></div></div>
      <div class="advanced-row"><h2>${t('Typ & Fähigkeiten','Type & abilities')}</h2><div class="advanced-fields filter-columns">${filterSelect('type',t('Kartentyp ist','Card type is'),options('types'))}${filterSelect('excludeType',t('Kartentyp ist nicht','Card type is not'),options('types'))}${filterSelect('subtype',t('Untertyp','Subtype'),options('subtypes'))}${filterSelect('trait',t('Zusatz','Trait'),options('traits'))}${filterSelect('keyword',t('Begriff im Kartentext','Term in card text'),options('keywords'))}${filterSelect('mechanic',t('Mechanik','Mechanic'),['pool','binding','rise'])}</div></div>
      <div class="advanced-row"><h2>${t('Werte','Stats')}</h2><div class="advanced-fields filter-columns">${CardSearch.numeric.map(k=>`<fieldset class="stat-filter"><legend>${t(...statLabels[k])}</legend><select class="pill" data-filter="${k}Op" aria-label="${t(...statLabels[k])} ${t('Vergleich','comparison')}">${['=','<=','>=','<','>','!='].map(op=>`<option value="${esc(op)}" ${cardFilters[k+'Op']===op?'selected':''}>${esc(op)}</option>`).join('')}</select><input class="pill" type="number" min="0" step="1" data-filter="${k}Value" value="${esc(cardFilters[k+'Value']||'')}" aria-label="${t(...statLabels[k])} ${t('Wert','value')}"></fieldset>`).join('')}<p class="filter-help">${t('Nur erfasste Zahlenwerte werden verglichen. Weitere Grenzen sind in der Suchleiste möglich: asp>=2 asp<=4.','Only recorded numeric values are compared. Add more bounds in the search bar: asp>=2 asp<=4.')}</p></div></div>
      <div class="advanced-row"><h2>${t('Edition & Druck','Set & printing')}</h2><div class="advanced-fields filter-columns">${filterSelect('set',t('Edition','Set'),[...new Set(cards.map(c=>c.set))])}${filterSelect('group',t('Spoiler-Gruppe','Spoiler group'),[...new Set(cards.map(c=>c.group))])}${filterSelect('language',t('Kartensprache','Card language'),options('language'))}${filterInput('artist',t('Künstler','Artist'))}${filterChoices('rarities',t('Seltenheit','Rarity'),[...new Set(cards.map(c=>c.text?.rarity).filter(Boolean))])}</div></div>
      <div class="advanced-row"><h2>${t('Weitere Optionen','More options')}</h2><div class="advanced-fields filter-columns">${filterSelect('unknown',t('Ohne erfassten Wert für','Without a recorded value for'),CardSearch.numeric)}<label>${t('Sortierung','Sort by')}<select class="pill" data-filter="sort">${[['name',t('Name','Name')],['asp',t('ASP-Kosten','ASP cost')],['level','Level'],['set',t('Edition','Set')]].map(([v,l])=>`<option value="${v}" ${cardFilters.sort===v?'selected':''}>${l}</option>`).join('')}</select></label>${filterInput('flavor',t('Flavourtext','Flavor text'))}</div></div>
      <div class="advanced-actions"><button class="pill" type="submit">${t('Mit diesen Optionen suchen','Search with these options')}</button><button class="text-button" id="reset-cards" type="button">${t('Alles zurücksetzen','Reset all')}</button></div>
    </form></details>
    <div class="catalog-results-heading"><p class="count" id="card-count" aria-live="polite"></p><button class="text-button" id="clear-filters" hidden>${t('Filter zurücksetzen','Clear filters')}</button></div><div class="card-grid" id="cards"></div><button class="pill more" id="more">${t('Weitere Karten laden','Load more cards')}</button>
    <details class="source-box"><summary>${t('Quellen & Textdaten','Sources & text data')}</summary><p>${t('Textfassungen sind teilweise maschinell erfasst. Maßgeblich sind Kartenbild und offizielle Errata.','Some text versions are machine-transcribed. Refer to the card image and official errata.')}</p><a href="data/card-texts.json" download>${t('Textdaten als JSON','Download text data (JSON)')}</a><a href="data/card-texts.csv" download>${t('Textdaten als CSV','Download text data (CSV)')}</a><p>© Bluthelden · <a href="https://bluthelden.com/pages/kartenspoiler" target="_blank" rel="noopener">Origin</a> · <a href="https://bluthelden.com/pages/2nd-edition-alliances" target="_blank" rel="noopener">Alliances</a></p></details>`;
  const quick=()=>{const q=$('#card-search').value.trim();if(q)cardFilters.q=q;else delete cardFilters.q;limit=48;saveCardFilters();fillCards()};
  $('#card-search').oninput=quick;$('#quick-search').onsubmit=e=>{e.preventDefault();quick()};
  $('#advanced-form').onsubmit=e=>{e.preventDefault();const legacy=Object.fromEntries(Object.entries(cardFilters).filter(([k])=>k==='q'||/Min$|Max$/.test(k)));cardFilters=legacy;
    document.querySelectorAll('[data-filter]').forEach(input=>{if(input.value)cardFilters[input.dataset.filter]=input.value});
    for(const key of ['colors','rarities']){const values=[...document.querySelectorAll(`[data-multi="${key}"]:checked`)].map(i=>i.value);if(values.length)cardFilters[key]=values.join(',')}
    for(const k of CardSearch.numeric)if(!cardFilters[k+'Value'])delete cardFilters[k+'Op'];
    if(!cardFilters.colors)delete cardFilters.colorMode;if(cardFilters.sort==='name')delete cardFilters.sort;
    limit=48;saveCardFilters();fillCards();$('#advanced-search').open=false;$('#advanced-search summary').focus();
  };
  const reset=()=>{cardFilters={};saveCardFilters();catalog()};$('#reset-cards').onclick=reset;$('#clear-filters').onclick=reset;
  $('#more').onclick=()=>{limit+=48;fillCards()};fillCards();
  if(restore?.hash===location.hash)requestAnimationFrame(()=>{document.querySelector(`[data-card="${CSS.escape(restore.focus||'')}"]`)?.focus({preventScroll:true});window.scrollTo({top:restore.scroll||0,behavior:'instant'})});
}
function saveCardFilters(){
  const query=new URLSearchParams(cardFilters).toString();history.replaceState(null,'',`#/${state.lang}/cards`+(query?'?'+query:''));state.id='';
  document.querySelectorAll('#languages a').forEach(a=>a.href=`#/${a.lang}/cards`+(query?'?'+query:''));
  document.querySelector('#tabs a.active')?.setAttribute('href',location.hash);
}
function fillCards(){
  const items=CardSearch.group(cards,cardFilters);
  $('#cards').innerHTML=items.length?items.slice(0,limit).map(cardHTML).join(''):`<p class="empty">${t('Keine passenden Karten. Entferne einen Filter oder ändere die Suche.','No matching cards. Remove a filter or change your search.')}</p>`;
  $('#card-count').textContent=`${items.length} ${t('Karten','cards')} · ${Math.min(limit,items.length)} ${t('angezeigt','shown')}`;
  const active=Object.keys(cardFilters).filter(k=>!['q','sort','colorMode'].includes(k)&&!k.endsWith('Op')).length;
  $('#active-filters').textContent=active?` · ${active} ${t('aktive Filter','active filters')}`:'';$('#clear-filters').hidden=!Object.keys(cardFilters).length;
  $('#more').hidden=items.length<=limit;bindCards();
}
function bindCards(){document.querySelectorAll('[data-card]').forEach(b=>b.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();openCard(cards.find(c=>c.id===b.dataset.card))});document.querySelectorAll('.card img').forEach(im=>im.onerror=()=>{im.alt=t('Bild nicht verfügbar: ','Image unavailable: ')+im.alt;im.style.objectFit='contain'})}
function openCard(c){
  pendingCardReturn={hash:location.hash,limit,scroll:window.scrollY,focus:c.id,advanced:$('#advanced-search')?.open||false};
  history.replaceState({...history.state,archive:pendingCardReturn},'',location.href);location.hash=url('card',c.id);
}
function closeCard(){const back=history.state?.cardReturn||cardReturn||{hash:`#/${state.lang}/cards${location.hash.includes('?')?'?'+location.hash.split('?')[1]:''}`};const target={...back,hash:back.hash.replace(/^#\/(de|en)\//,`#/${state.lang}/`)};pendingArchiveRestore=target;location.hash=target.hash;}
function cardTextSummary(c){const d=c.text||{};return symbolText([c.name+(d.stats?.asp!=null?' '+aspText(d.stats.asp):''),d.typeLine,...Object.entries(d.stats||{}).filter(([k,v])=>k!=='asp'&&v!==null).map(([k,v])=>`${k.toUpperCase()}: ${v}`),d.rulesText,d.additionalCostsText,d.flavorText,c.notes].filter(Boolean).join('\n\n'))}
function cardPage(){
  const c=cards.find(c=>c.id===state.id);if(!c){$('#content').innerHTML=`<h1>${t('Karte nicht gefunden','Card not found')}</h1><a href="${url('cards')}">${t('Zum Kartenarchiv','Back to card archive')}</a>`;return;}
  document.title=`${c.name} · ${c.set} · Blutbank`;
  const d=c.text||{},variants=cards.filter(x=>CardSearch.nameKey(x.name)===CardSearch.nameKey(c.name));
  const stats=CardSearch.numeric.filter(k=>k!=='asp'&&d.stats?.[k]!=null);
  const properties=[[t('Farbe','Color'),(d.colors||[]).map(cardLabel).join(', ')],[t('Typen','Types'),(d.types||[]).filter(v=>!d.typeLine?.includes(v)).map(cardLabel).join(', ')],[t('Untertypen','Subtypes'),(d.subtypes||[]).filter(v=>!d.typeLine?.includes(v)).join(', ')],[t('Zusätze','Traits'),(d.traits||[]).filter(v=>!d.typeLine?.includes(v)).join(', ')],[t('Mechaniken','Mechanics'),Object.entries(d.mechanics||{}).filter(([,v])=>v===true).map(([k])=>k[0].toUpperCase()+k.slice(1)).join(', ')]];
  $('#content').innerHTML=`<div class="card-page-toolbar"><a href="${url('cards')}">${t('Kartenarchiv','Card archive')}</a><button class="close" id="close-card" aria-label="${t('Schließen und zur Suche zurückkehren','Close and return to search')}" title="${t('Zurück zur Suche (Esc)','Return to search (Esc)')}">×</button></div>
    <article class="card-page ${c.notes?'has-notes':''}" aria-label="${esc(c.name)}">
      <div class="card-page-art"><img class="selected-card-image" src="${esc(c.original.replace('width=3200','width=1250'))}" alt="${esc(c.name)}" width="750" height="1047"><div class="card-page-tools"><button class="text-button" id="copy-card-text">${t('Text kopieren','Copy text')}</button><button class="text-button" id="copy-card-link">${t('Link kopieren','Copy link')}</button><a href="${esc(c.source)}" target="_blank" rel="noopener">${t('Offizieller Spoiler','Official spoiler')} ↗</a></div></div>
      <div class="card-page-text"><div class="card-title-line"><h1>${esc(c.name)}</h1>${d.stats?.asp!=null?`<span class="asp-cost" title="${t('ASP-Kosten','ASP cost')}">${aspText(d.stats.asp)}</span>`:''}</div>
        ${d.typeLine?`<p class="card-type-line">${esc(d.typeLine)}</p>`:''}
        ${d.rulesText?.trim()?`<div class="card-rules">${linkText(cardFlow(d.rulesText))}</div>`:''}
        ${d.additionalCostsText?`<section class="card-extra"><h2>${t('Zusatzkosten','Additional costs')}</h2><div class="card-rules">${linkText(cardFlow(d.additionalCostsText))}</div></section>`:''}
        ${d.flavorText?`<p class="card-flavor">${esc(symbolText(d.flavorText))}</p>`:''}
        ${stats.length?`<dl class="card-stats">${stats.map(k=>`<div><dt>${t(...statLabels[k])}</dt><dd>${esc(d.stats[k])}</dd></div>`).join('')}</dl>`:''}
        <dl class="card-facts">${properties.filter(([,v])=>v).map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${d.artist?`<p class="card-artist">${t('Illustration','Illustration')}: ${esc(d.artist)}</p>`:''}
      </div>
      <aside class="card-printings"><div class="printing-current"><strong>${esc(c.set)}</strong><span>${[c.code,d.collectorNumber?'#'+d.collectorNumber:'',d.rarity?cardLabel(d.rarity):'',d.language?.toUpperCase(),c.variant].filter(Boolean).map(esc).join(' · ')}</span></div>
        ${variants.length>1?`<section class="printing-list"><h2>${t('Alle Versionen','All versions')} <span>(${variants.length})</span></h2>${variants.map(v=>`<a class="printing-link ${v.id===c.id?'selected':''}" href="${url('card',v.id)}" data-version="${v.id}" ${v.id===c.id?'aria-current="page"':''}><span>${esc(v.set)}${v.variant?`<small>${esc(v.variant)}</small>`:''}</span><span>${esc(v.code||v.text?.collectorNumber||'')}</span></a>`).join('')}</section>`:''}

        <p class="transcription-status">${d.status==='reviewed'?t('Textfassung geprüft','Text reviewed'):t('Maschinelle Textfassung; Werte und Symbole mit dem Kartenbild abgleichen.','Machine transcription; check values and symbols against the card image.')}</p>
      </aside>
        ${c.notes?`<section class="card-errata"><h2>${t('Hinweise & Errata','Notes & errata')}</h2><div>${linkText(c.notes)}</div></section>`:''}
    </article>`;
  $('#close-card').onclick=closeCard;
  document.querySelectorAll('[data-version]').forEach(a=>a.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();history.replaceState({...history.state,cardReturn},'',a.href);state=readState();cardPage();document.querySelectorAll('#languages a').forEach(link=>link.href=url('card',state.id,link.lang));document.querySelector(`[data-version="${a.dataset.version}"]`)?.focus({preventScroll:true})});
  $('#copy-card-text').onclick=()=>copyText(cardTextSummary(c),t('Kartentext kopiert','Card text copied'));
  $('#copy-card-link').onclick=()=>copyText(location.href,t('Link kopiert','Link copied'));
}
async function copyText(text,message){try{await navigator.clipboard.writeText(text);toast(message)}catch{toast(t('Kopieren nicht verfügbar. Text bitte markieren.','Copy unavailable. Please select the text.'))}}

function glossary() {
  const selected = terms.find(x => x.id === state.id);
  const sorted = [...terms].sort((a,b) => a[state.lang].localeCompare(b[state.lang],state.lang));
  const shown = selected ? [selected] : sorted;
  const letters = [...new Set(sorted.map(x=>x[state.lang][0].toUpperCase()))];
  $('#content').innerHTML = `<div class="eyebrow">${t('Anhänge I–III','Appendices I–III')}</div>
    <h1>${selected ? esc(selected[state.lang]) : t('Begriffe & Keywords','Terms & keywords')}</h1>
    ${selected ? `<a href="${url('glossary')}">${t('Alle Begriffe anzeigen','View all terms')}</a>` : `<div class="alphabet">${letters.map(l=>`<a href="#letter-${l}">${l}</a>`).join('')}</div>`}
    ${shown.map((x,i)=>`<section class="glossary-item" id="term-${x.id}">
      ${!selected&&(!i||shown[i-1][state.lang][0]!==x[state.lang][0])?`<span id="letter-${x[state.lang][0].toUpperCase()}"></span>`:''}
      <div class="eyebrow">${esc(x.kind || t('BEGRIFF','TERM'))}</div>
      ${selected?'':`<h2><a href="${url('glossary',x.id)}">${esc(x[state.lang])}</a></h2>`}
      <div class="rule-copy">${linkText(x[state.lang+'Text'],x.id)}</div>
      ${x.rule?`<p class="definition-rule"><a href="${ruleId(x.rule)}">${t('Regel','Rule')} ${x.rule} · ${esc(source().find(s=>s.id===x.rule)?.title||'')}</a></p>`:''}
    </section>`).join('')}`;
  if ($('.alphabet')) $('.alphabet').onclick=e=>{const a=e.target.closest('a');if(a){e.preventDefault();document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView()}};
  if(selected){
    const names=[selected.de,selected.en,...selected.aliases].filter(x=>!(state.lang==='de'&&x==='dies')).map(x=>x.toLowerCase());
    const refs=source().filter(s=>s.id!==selected.rule&&names.some(n=>(s.title+' '+s.body).toLowerCase().includes(n))).slice(0,12);
    $('#content').innerHTML+=`<h2>${t('Erwähnt in','Mentioned in')}</h2><div class="backlinks">${refs.map(s=>`<a href="${ruleId(s.id)}">${s.id} · ${esc(s.title)}</a>`).join('')||t('Keine weiteren Verweise.','No additional references.')}</div>`;
  }
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.view==='card'){e.preventDefault();closeCard()}});
$('.skip').addEventListener('click',e=>{e.preventDefault();$('#content').focus();$('#content').scrollIntoView()});
start();
