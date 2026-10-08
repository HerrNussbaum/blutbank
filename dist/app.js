import {CardSearch} from './card-search.mjs';
const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let de=[],en=[],cards=[],terms=[],state={},cardFilters={},limit=48,searchTimer; const t=(a,b)=>state.lang==='en'?b:a;
const url=(view,id='',lang=state.lang)=>`#/${lang}/${view}${id?'/'+encodeURIComponent(id):''}${view==='cards'&&state.view==='cards'&&location.hash.includes('?')?'?'+location.hash.split('?')[1]:''}`;
const labels=()=>({rules:t('Turnierregeln','Tournament rules'),glossary:t('Begriffsregister','Glossary'),cards:t('Kartenarchiv','Card archive')});
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
function readState(){const p=location.hash.slice(2).split('?')[0].split('/');return {lang:p[0]==='en'?'en':'de',view:['rules','cards','glossary','search'].includes(p[1])?p[1]:'rules',id:safeDecode(p.slice(2).join('/'))||(p[1]==='rules'||!p[1]?'1':'')}}
function source(){return state.lang==='en'?en:de}function ruleId(id){return url('rules',id)}
// Link only complete terms. Rule identifiers remain stable in both languages.
function linkText(text, current = '') {
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
function render(){clearTimeout(searchTimer);if($('#card-dialog').open)$('#card-dialog').close();state=readState();limit=48;document.documentElement.lang=state.lang;$('#tabs').setAttribute('aria-label',t('Hauptnavigation','Main navigation'));document.body.classList.toggle('catalog',state.view==='cards');document.title=`${labels()[state.view]||t('Suche','Search')} · blutbank`;$('#brand-sub').textContent=t('DAS REGELARCHIV','THE RULE ARCHIVE');$('.brand').href=url('rules','1');$('#tabs').innerHTML=Object.entries(labels()).map(([k,v])=>`<a href="${url(k,k==='rules'?'1':'')}" class="${state.view===k?'active':''}" ${state.view===k?'aria-current="page"':''}>${v}</a>`).join('');$('#languages').innerHTML=['de','en'].map(l=>`<a href="${url(state.view,state.id,l)}" lang="${l}" aria-label="${l==='de'?'Deutsch':'English'}" class="${state.lang===l?'active':''}" ${state.lang===l?'aria-current="true"':''}>${l.toUpperCase()}</a>`).join('');sidebar();$('#context').innerHTML='';if(state.view==='rules')rules();if(state.view==='cards')catalog();if(state.view==='glossary')glossary();if(state.view==='search')search();archiveFooter();window.scrollTo({top:0,behavior:"instant"});if(state.view==='rules'&&state.id.includes('.'))requestAnimationFrame(()=>document.getElementById('rule-'+state.id)?.scrollIntoView({behavior:'instant'}));}
function sidebar(){$('#sidebar').innerHTML=`<div class="searchbox"><input id="search" aria-label="${t('Archiv durchsuchen','Search archive')}" placeholder="${t('Regel, Begriff oder Karte …','Rule, term or card …')}" value="${state.view==='search'?esc(state.id):''}"></div><p class="search-hint">${t('Das gesamte Archiv durchsuchen','Search the entire archive')}</p><button class="menu-button" aria-expanded="false">${t('Kapitel anzeigen','Show chapters')}</button><div class="aside-label">${t('TURNIERREGELWERK','TOURNAMENT RULEBOOK')}</div><nav class="chapters" aria-label="${t('Kapitel','Chapters')}">${source().filter(s=>!s.id.includes('.')).map(s=>`<a href="${ruleId(s.id)}" class="${state.view==='rules'&&state.id.split('.')[0]===s.id?'active':''}"><span>${s.id.padStart(2,'0')}</span>${esc(s.title)}</a>`).join('')}<a href="${url('glossary')}"><span>A–Z</span>${t('Begriffe & Keywords','Terms & keywords')}</a></nav>`;$('#search').addEventListener('keydown',e=>{if(e.key==='Enter'){location.hash=url('search',e.target.value.trim());}});$('#search').addEventListener('input',e=>{clearTimeout(searchTimer);const q=e.target.value;searchTimer=setTimeout(()=>{history.replaceState(null,'',url('search',q));state={...state,view:'search',id:q};document.body.classList.remove('catalog');$('#context').innerHTML='';$('#languages').innerHTML=['de','en'].map(l=>`<a href="${url('search',q,l)}" lang="${l}" aria-label="${l==='de'?'Deutsch':'English'}" class="${state.lang===l?'active':''}">${l.toUpperCase()}</a>`).join('');document.querySelectorAll('#tabs a').forEach(a=>a.classList.remove('active'));document.title=t('Suche','Search')+' · blutbank';search();archiveFooter();},200)});$('.menu-button').onclick=e=>{const open=$('.chapters').classList.toggle('open');e.target.setAttribute('aria-expanded',open)};}
function rules(){const chapter=state.id.split('.')[0];const current=source().find(s=>s.id===chapter);if(!current){$('#content').innerHTML=`<h1>${t('Regel nicht gefunden','Rule not found')}</h1><a href="${ruleId('1')}">${t('Zur Übersicht','Back to the rules')}</a>`;return}const list=source().filter(s=>s.id===chapter||s.id.startsWith(chapter+'.'));$('#content').innerHTML=`<div class="eyebrow">${t('TURNIERREGELN','TOURNAMENT RULES')} / ${t('KAPITEL','CHAPTER')} ${chapter.padStart(2,'0')}</div><h1>${esc(current.title)}</h1>${list.map((s,i)=>!i&&!s.body?'':`<section class="rule" id="rule-${s.id}">${i?`<div class="rule-head"><a class="rule-number" href="${ruleId(s.id)}">${s.id}</a><h2>${esc(s.title)}</h2></div>`:''}${s.body?`<div class="rule-copy">${renderBody(s.body)}</div>`:''}${s.body?`<div class="rule-actions"><button data-copy="${ruleId(s.id)}">${t('Abschnitt verlinken','Copy section link')}</button><a href="TournamentRulebook_de.pdf#page=${de.find(x=>x.id===s.id)?.page||1}" target="_blank" rel="noopener">${t('Im Original lesen','Read the original')}</a></div>`:''}</section>`).join('')}<div class="page-links">${+chapter>1?`<a href="${ruleId(String(+chapter-1))}">${t('Vorheriges Kapitel','Previous chapter')}</a>`:'<span></span>'}${+chapter<15?`<a href="${ruleId(String(+chapter+1))}">${t('Nächstes Kapitel','Next chapter')}</a>`:''}</div>`;$('#context').innerHTML=`<div class="aside-label">${t('IN DIESEM KAPITEL','IN THIS CHAPTER')}</div><nav class="toc">${list.slice(1).map(s=>`<a href="${ruleId(s.id)}">${s.id} &nbsp;${esc(s.title)}</a>`).join('')}</nav>`;document.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{const link=location.href.split('#')[0]+b.dataset.copy;try{await navigator.clipboard.writeText(link);toast(t('Link kopiert','Link copied'))}catch{prompt(t('Link zum Abschnitt','Section link'),link)}})}
function toast(msg){$('#toast').textContent=msg;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',2000)}
function search(){const q=(state.id).trim();const norm=s=>s.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const match=s=>norm(s).includes(norm(q));const rr=q?source().filter(s=>match(s.id+' '+s.title+' '+s.body)):[];rr.sort((a,b)=>(norm(b.id)===norm(q)?100:match(b.title)?10:0)-(norm(a.id)===norm(q)?100:match(a.title)?10:0));const tt=q?terms.filter(x=>match(x.de+' '+x.en+' '+x.aliases.join(' ')+' '+x[state.lang+'Text'])):[];tt.sort((a,b)=>(norm(b[state.lang])===norm(q)?100:match(b[state.lang])?10:0)-(norm(a[state.lang])===norm(q)?100:match(a[state.lang])?10:0));const cc=q?CardSearch.group(cards,{q}):[];$('#content').innerHTML=`<div class="eyebrow">${t('ARCHIVSUCHE','ARCHIVE SEARCH')}</div><h1>${q?esc(q):t('Was möchtest du nachschlagen?','What are you looking for?')}</h1><p class="muted">${q?`${rr.length} ${t('Regeln','rules')} · ${tt.length} ${t('Begriffe','terms')} · ${cc.length} ${t('Karten','cards')}`:t('Suche nach Regelnummern, Begriffen oder Kartennamen.','Search for rule numbers, terms or card names.')}</p>${q&&!rr.length&&!tt.length&&!cc.length?`<div class="empty">${t('Keine Treffer. Versuche einen kürzeren oder englischen Begriff.','No results. Try a shorter term or a German keyword.')}</div>`:''}${tt.map(x=>`<a class="result" href="${url('glossary',x.id)}"><small>${t('BEGRIFF','TERM')}</small><h3>${esc(x[state.lang])}</h3><p>${esc(x[state.lang+'Text'].slice(0,190))}</p></a>`).join('')}${rr.map(s=>`<a class="result" href="${ruleId(s.id)}"><small>${t('REGEL','RULE')} ${s.id}</small><h3>${esc(s.title)}</h3><p>${esc(s.body.slice(Math.max(0,norm(s.body).indexOf(norm(q))-65),Math.max(0,norm(s.body).indexOf(norm(q))-65)+230))}…</p></a>`).join('')}${cc.length?`<h2>${t('Karten','Cards')}</h2><div class="card-grid">${cc.slice(0,60).map(cardHTML).join('')}</div>${cc.length>60?`<a href="${url('cards')}">${t('Weitere Karten im Archiv','More cards in the archive')}</a>`:''}`:''}`;bindCards()}
function cardHTML(group){const c=group.card||group;return `<button class="card" data-card="${c.id}" aria-label="${esc(c.name)}"><img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy" decoding="async"><h3>${esc(c.name)}</h3>${group.variants?.length>1?`<span class="variant-count">${group.variants.length} ${t('Versionen','versions')}</span>`:''}<small>${esc(c.set)}${c.code?' / '+esc(c.code):''}</small><span class="card-caption">${esc(c.text?.typeLine||'')}${c.text?.stats?.asp!=null?' · '+esc(c.text.stats.asp)+' ASP':''}</span></button>`}
const statLabels={asp:['ASP-Kosten','ASP cost'],level:['Level','Level'],pow:['Stärke (POW)','Power (POW)'],hp:['Trefferpunkte (HP)','Health (HP)'],res:['Resistenz (RES)','Resistance (RES)'],ini:['Initiative (INI)','Initiative (INI)'],magic:['Magiewert','Magic value'],lp:['Lebenspunkte (LP)','Life (LP)']};
const cardLabel=value=>CardSearch.label(value,state.lang);
function readCardFilters(){return Object.fromEntries(new URLSearchParams(location.hash.split('?')[1]||''))}
function filterSelect(key,title,values){return `<label>${esc(title)}<select class="pill" data-filter="${key}"><option value="">${t('Alle','All')}</option>${values.map(value=>`<option value="${esc(value)}" ${cardFilters[key]===value?'selected':''}>${esc(cardLabel(value))}</option>`).join('')}</select></label>`}
function catalog(){
  cardFilters=readCardFilters();const wanted=cards.find(c=>c.id===state.id);
  const options=field=>[...new Set(cards.flatMap(c=>c.text?.[field]||[]))].sort((a,b)=>cardLabel(a).localeCompare(cardLabel(b),state.lang));
  $('#content').innerHTML=`<h1>${t('Das Kartenarchiv','The card archive')}</h1>
    <div class="card-search-row"><label class="card-search-label"><span>${t('Name, Kartentext oder Eigenschaft','Name, card text or property')}</span><input id="card-search" class="pill" data-filter="q" value="${esc(cardFilters.q||'')}" placeholder="${t('z. B. Flying asp<=4','e.g. Flying asp<=4')}"></label><button class="pill" id="reset-cards">${t('Zurücksetzen','Reset')}</button></div>
    <div class="card-filters">${filterSelect('set',t('Edition','Edition'),[...new Set(cards.map(c=>c.set))])}${filterSelect('color',t('Farbe','Color'),options('colors'))}${filterSelect('type',t('Kartentyp','Card type'),options('types'))}${filterSelect('subtype',t('Untertyp','Subtype'),options('subtypes'))}${filterSelect('rarity',t('Seltenheit','Rarity'),[...new Set(cards.map(c=>c.text?.rarity).filter(Boolean))])}${filterSelect('keyword',t('Begriff im Kartentext','Term in card text'),options('keywords'))}</div>
    <details class="advanced-filters" ${CardSearch.numeric.some(k=>cardFilters[k+'Min']||cardFilters[k+'Max'])||cardFilters.mechanic||cardFilters.trait||cardFilters.group||cardFilters.unknown?'open':''}><summary>${t('Werte & weitere Eigenschaften','Values & more properties')}</summary><div class="card-filters">${CardSearch.numeric.map(key=>`<fieldset><legend>${t(...statLabels[key])}</legend><div class="range-inputs"><input class="pill" type="number" min="0" step="1" data-filter="${key}Min" value="${esc(cardFilters[key+'Min']||'')}" aria-label="${t(...statLabels[key])} ${t('mindestens','minimum')}" placeholder="${t('von','min')}"><span>–</span><input class="pill" type="number" min="0" step="1" data-filter="${key}Max" value="${esc(cardFilters[key+'Max']||'')}" aria-label="${t(...statLabels[key])} ${t('höchstens','maximum')}" placeholder="${t('bis','max')}"></div></fieldset>`).join('')}${filterSelect('trait',t('Zusatz','Trait'),options('traits'))}${filterSelect('mechanic',t('Erkanntes Symbol / Mechanik','Detected icon / mechanic'),['pool','binding','rise'])}${filterSelect('group',t('Spoiler-Gruppe','Spoiler group'),[...new Set(cards.map(c=>c.group))])}${filterSelect('unknown',t('Ohne erfassten Wert für','Without a recorded value for'),CardSearch.numeric)}</div>
    <p class="muted">${t('Mehrere Suchwörter werden kombiniert. Anführungszeichen suchen eine Wortgruppe. Zahlen gehen auch direkt: asp<=4 pow>=3. Nicht erfasste Werte gelten nicht als 0 und werden bei Wertefiltern ausgeschlossen.','Search words are combined. Use quotes for a phrase, or numeric queries such as asp<=4 pow>=3. Unrecorded values are not zero and are excluded by numeric filters.')}</p></details>
    <p class="count" id="card-count" aria-live="polite"></p><div class="card-grid" id="cards"></div><button class="pill more" id="more">${t('Weitere Karten laden','Load more cards')}</button>
    <div class="source-box"><p>${t('Textfassungen der erfassten Abbildungen und Varianten: maschinell erfasst, noch nicht vollständig redaktionell geprüft. Kleine Zahlen und Symbole können falsch oder unvollständig erkannt sein. Maßgeblich sind Kartenbild und offizielle Errata. „Begriff im Kartentext“ findet auch erwähnte oder verliehene Fähigkeiten.','Text versions of the catalogued images and variants: machine-transcribed, not fully reviewed. Small numbers and symbols may be incorrect or incomplete. Refer to the image and official errata. “Term in card text” also matches mentioned or granted abilities.')}</p><a href="data/card-texts.json" download>${t('Textdaten als JSON','Download text data (JSON)')}</a><a href="data/card-texts.csv" download>${t('Textdaten als CSV','Download text data (CSV)')}</a><p>© Bluthelden · <a href="https://bluthelden.com/pages/kartenspoiler" target="_blank" rel="noopener">Origin</a> · <a href="https://bluthelden.com/pages/2nd-edition-alliances" target="_blank" rel="noopener">Alliances</a></p></div>`;
  document.querySelectorAll('[data-filter]').forEach(input=>input.addEventListener(input.tagName==='SELECT'?'change':'input',()=>{
    const key=input.dataset.filter;if(input.value)cardFilters[key]=input.value;else delete cardFilters[key];limit=48;saveCardFilters();fillCards();
  }));
  $('#reset-cards').onclick=()=>{cardFilters={};saveCardFilters();catalog()};
  $('#more').onclick=()=>{limit+=48;fillCards()};fillCards();if(wanted)showCard(wanted);
}
function saveCardFilters(){
  const query=new URLSearchParams(cardFilters).toString();const base=`#/${state.lang}/cards`;
  history.replaceState(null,'',base+(query?'?'+query:''));state.id='';
  document.querySelectorAll('#languages a').forEach(a=>a.href=`#/${a.lang}/cards`+(query?'?'+query:''));
}
function fillCards(){
  const items=CardSearch.group(cards,cardFilters);
  $('#cards').innerHTML=items.length?items.slice(0,limit).map(cardHTML).join(''):`<p class="empty">${t('Keine passenden Karten. Entferne einen Filter oder prüfe auch Karten ohne erfasste Zahlenwerte.','No matching cards. Remove a filter or also check cards with unrecorded values.')}</p>`;
  $('#card-count').textContent=`${items.length} ${t('Karten','cards')} · ${Math.min(limit,items.length)} ${t('angezeigt','shown')}`;
  $('#more').hidden=items.length<=limit;bindCards();
}
function bindCards(){document.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>showCard(cards.find(c=>c.id===b.dataset.card)));document.querySelectorAll('.card img').forEach(im=>im.onerror=()=>{im.alt=t('Bild nicht verfügbar: ','Image unavailable: ')+im.alt;im.style.objectFit='contain'})}
function cardTextSummary(c){
  const d=c.text||{};return [c.name,d.typeLine,...Object.entries(d.stats||{}).filter(([,v])=>v!==null).map(([k,v])=>`${k.toUpperCase()}: ${v}`),d.rulesText,d.additionalCostsText,c.notes].filter(Boolean).join('\n\n');
}
function showCard(c){
  const d=$('#card-dialog'),data=c.text||{};const variants=cards.filter(x=>CardSearch.nameKey(x.name)===CardSearch.nameKey(c.name));
  const rows=[[t('Farbe','Color'),(data.colors||[]).map(cardLabel).join(', ')],[t('Typen','Types'),(data.types||[]).map(cardLabel).join(', ')],[t('Untertypen','Subtypes'),(data.subtypes||[]).join(', ')],[t('Zusätze','Traits'),(data.traits||[]).join(', ')],[t('Seltenheit','Rarity'),cardLabel(data.rarity||'')],...CardSearch.numeric.map(k=>[t(...statLabels[k]),data.stats?.[k]]),['Pool / Binding / Rise',Object.entries(data.mechanics||{}).filter(([,v])=>v===true).map(([k])=>k).join(', ')],[t('Künstler','Artist'),data.artist],[t('Kartennummer','Collector number'),data.collectorNumber],[t('Sprache','Language'),data.language]];
  d.innerHTML=`<button class="close" aria-label="${t('Schließen','Close')}">×</button><div class="dialog-grid"><div class="card-art"><img class="selected-card-image" src="${esc(c.original.replace('width=3200','width=1250'))}" alt="${esc(c.name)}">${variants.length>1?`<section class="card-versions" aria-label="${t('Kartenversionen','Card versions')}"><h3>${t('Alle Versionen','All versions')} <span class="muted">(${variants.length})</span></h3><div class="version-grid">${variants.map((v,i)=>`<button class="version-option" data-version="${v.id}" aria-pressed="${v.id===c.id}" aria-label="${esc(v.name)} · ${esc(v.set)} · ${esc(v.code||v.text?.collectorNumber||String(i+1))}${v.variant?' · '+esc(v.variant):''}"><img src="${esc(v.image)}" alt="" loading="lazy"><span>${esc(v.set)}${v.code||v.text?.collectorNumber?' · '+esc(v.code||v.text.collectorNumber):''}</span>${v.variant?`<small>${esc(v.variant)}</small>`:''}</button>`).join('')}</div></section>`:''}</div><div><div class="eyebrow">${esc(c.set)}${c.code?' / '+esc(c.code):''}</div><h2>${esc(c.name)}</h2>${c.variant?`<p>${esc(c.variant)}</p>`:''}
    <p class="transcription-status">${data.status==='reviewed'?t('Textfassung geprüft','Text reviewed'):t('Maschinelle Textfassung · noch nicht vollständig geprüft','Machine transcription · not fully reviewed')}</p>
    <dl class="card-properties">${rows.filter(([,value])=>value!==''&&value!=null).map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
    ${data.flavorText?`<p class="muted"><em>${esc(data.flavorText)}</em></p>`:''}${data.rulesText?.trim()?`<h3>${t('Kartentext','Card text')}</h3><div class="notes card-rules">${linkText(data.rulesText)}</div>`:''}
    ${data.additionalCostsText?`<h3>${t('Zusatzkosten des Herrschers','Sovereign additional costs')}</h3><div class="notes">${esc(data.additionalCostsText)}</div>`:''}
    <button class="pill" id="copy-card-text">${t('Text kopieren','Copy text')}</button>
    ${c.notes?`<h3>${t('Offizielle Hinweise & Errata','Official notes & errata')}</h3><div class="notes">${linkText(c.notes)}</div>`:''}
    ${data.rawText?.trim()?`<details class="ocr-original"><summary>${t('Vollständige Texterkennung anzeigen','Show full OCR transcription')}</summary><pre>${esc(data.rawText)}</pre></details>`:''}
    <p><a href="${esc(c.source)}" target="_blank" rel="noopener">${t('Im offiziellen Spoiler ansehen','View official spoiler')}</a></p><p><a href="${url('cards',c.id)}">${t('Direktlink zur Karte','Card permalink')}</a></p><p class="source-box">© Bluthelden · ${t('Kartentext in Originalsprache. Symbole und Werte mit der Abbildung abgleichen.','Card text in its original language. Check symbols and values against the image.')}</p></div></div>`;
  d.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>{showCard(cards.find(v=>v.id===b.dataset.version));d.querySelector('[data-version="'+b.dataset.version+'"]')?.focus({preventScroll:true})});
  $('#copy-card-text').onclick=async()=>{try{await navigator.clipboard.writeText(cardTextSummary(c));toast(t('Kartentext kopiert','Card text copied'))}catch{toast(t('Kopieren nicht verfügbar. Text bitte markieren.','Copy unavailable. Please select the text.'))}};
  d.querySelector('.close').onclick=()=>d.close();d.querySelectorAll('a[href^="#"]').forEach(a=>a.onclick=()=>d.close());d.onclick=e=>{if(e.target===d)d.close()};if(!d.open)d.showModal();
}

function glossary() {
  const selected = terms.find(x => x.id === state.id);
  const sorted = [...terms].sort((a,b) => a[state.lang].localeCompare(b[state.lang],state.lang));
  const shown = selected ? [selected] : sorted;
  const letters = [...new Set(sorted.map(x=>x[state.lang][0].toUpperCase()))];
  $('#content').innerHTML = `<div class="eyebrow">A–Z / ${t('ANHÄNGE I–III','APPENDICES I–III')}</div>
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
$('.skip').addEventListener('click',e=>{e.preventDefault();$('#content').focus();$('#content').scrollIntoView()});
start();
