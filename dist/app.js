const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let de=[],en=[],cards=[],terms=[],state={},limit=48,searchTimer; const t=(a,b)=>state.lang==='en'?b:a;
const url=(view,id='',lang=state.lang)=>`#/${lang}/${view}${id?'/'+encodeURIComponent(id):''}`;
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
function readState(){const p=location.hash.slice(2).split('/');return {lang:p[0]==='en'?'en':'de',view:['rules','cards','glossary','search'].includes(p[1])?p[1]:'rules',id:safeDecode(p.slice(2).join('/'))||(p[1]==='rules'||!p[1]?'1':'')}}
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
function search(){const q=(state.id).trim();const norm=s=>s.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');const match=s=>norm(s).includes(norm(q));const rr=q?source().filter(s=>match(s.id+' '+s.title+' '+s.body)):[];rr.sort((a,b)=>(norm(b.id)===norm(q)?100:match(b.title)?10:0)-(norm(a.id)===norm(q)?100:match(a.title)?10:0));const tt=q?terms.filter(x=>match(x.de+' '+x.en+' '+x.aliases.join(' ')+' '+x[state.lang+'Text'])):[];tt.sort((a,b)=>(norm(b[state.lang])===norm(q)?100:match(b[state.lang])?10:0)-(norm(a[state.lang])===norm(q)?100:match(a[state.lang])?10:0));const cc=q?cards.filter(c=>match(c.name+' '+c.code+' '+c.set)):[];$('#content').innerHTML=`<div class="eyebrow">${t('ARCHIVSUCHE','ARCHIVE SEARCH')}</div><h1>${q?esc(q):t('Was möchtest du nachschlagen?','What are you looking for?')}</h1><p class="muted">${q?`${rr.length} ${t('Regeln','rules')} · ${tt.length} ${t('Begriffe','terms')} · ${cc.length} ${t('Karten','cards')}`:t('Suche nach Regelnummern, Begriffen oder Kartennamen.','Search for rule numbers, terms or card names.')}</p>${q&&!rr.length&&!tt.length&&!cc.length?`<div class="empty">${t('Keine Treffer. Versuche einen kürzeren oder englischen Begriff.','No results. Try a shorter term or a German keyword.')}</div>`:''}${tt.map(x=>`<a class="result" href="${url('glossary',x.id)}"><small>${t('BEGRIFF','TERM')}</small><h3>${esc(x[state.lang])}</h3><p>${esc(x[state.lang+'Text'].slice(0,190))}</p></a>`).join('')}${rr.map(s=>`<a class="result" href="${ruleId(s.id)}"><small>${t('REGEL','RULE')} ${s.id}</small><h3>${esc(s.title)}</h3><p>${esc(s.body.slice(Math.max(0,norm(s.body).indexOf(norm(q))-65),Math.max(0,norm(s.body).indexOf(norm(q))-65)+230))}…</p></a>`).join('')}${cc.length?`<h2>${t('Karten','Cards')}</h2><div class="card-grid">${cc.slice(0,60).map(cardHTML).join('')}</div>${cc.length>60?`<a href="${url('cards')}">${t('Weitere Karten im Archiv','More cards in the archive')}</a>`:''}`:''}`;bindCards()}
function cardHTML(c){return `<button class="card" data-card="${c.id}" aria-label="${esc(c.name)}"><img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy" decoding="async"><h3>${esc(c.name)}</h3><small>${esc(c.set)}${c.code?' / '+esc(c.code):''}</small></button>`}
function catalog(){const wanted=cards.find(c=>c.id===state.id);$('#content').innerHTML=`<h1>${t('Das Kartenarchiv','The card archive')}</h1><div class="filters"><input id="card-search" class="pill" placeholder="${t('Kartennamen suchen …','Search card names …')}" aria-label="${t('Kartensuche','Card search')}"><select id="set-filter" class="pill" aria-label="${t('Edition','Edition')}"><option value="">${t('Alle Editionen','All editions')}</option><option>Origin</option><option>Alliances</option></select><select id="group-filter" class="pill" aria-label="${t('Kartengruppe','Card group')}"><option value="">${t('Alle Gruppen','All groups')}</option></select></div><p class="count" id="card-count" aria-live="polite"></p><div class="card-grid" id="cards"></div><button class="pill more" id="more">${t('Weitere Karten laden','Load more cards')}</button><div class="source-box">${t('Kartenbilder und Kartentexte © Bluthelden. Kartennamen bleiben in ihrer Originalsprache. Stand des Imports: 03.10.2026. Varianten werden einzeln geführt.','Card images and card text © Bluthelden. Card names retain their original language. Imported 3 October 2026. Variants are listed separately.')} <a href="https://bluthelden.com/pages/kartenspoiler" target="_blank" rel="noopener">Origin · ${t('Offizieller Spoiler','Official spoiler')}</a><a href="https://bluthelden.com/pages/2nd-edition-alliances" target="_blank" rel="noopener">Alliances · ${t('Offizielle Edition','Official edition')}</a></div>`;groups();$('#card-search').oninput=()=>{limit=48;fillCards()};$('#set-filter').onchange=()=>{limit=48;groups();fillCards()};$('#group-filter').onchange=()=>{limit=48;fillCards()};$('#more').onclick=()=>{limit+=48;fillCards()};fillCards();if(wanted)showCard(wanted)}
function groups(){$('#group-filter').innerHTML=`<option value="">${t('Alle Gruppen','All groups')}</option>`+[...new Set(cards.filter(c=>!$('#set-filter').value||c.set===$('#set-filter').value).map(c=>c.group))].map(g=>`<option>${esc(g)}</option>`).join('')}
function fillCards(){const q=$('#card-search').value.toLowerCase();const items=cards.filter(c=>(c.name+' '+c.code).toLowerCase().includes(q)&&(!$('#set-filter').value||c.set===$('#set-filter').value)&&(!$('#group-filter').value||c.group===$('#group-filter').value));$('#cards').innerHTML=items.length?items.slice(0,limit).map(cardHTML).join(''):`<p class="empty">${t('Keine passenden Karten gefunden.','No matching cards found.')}</p>`;$('#card-count').textContent=`${items.length} ${t('Karten und Varianten','cards and variants')} · ${Math.min(limit,items.length)} ${t('angezeigt','shown')}`;$('#more').hidden=items.length<=limit;bindCards()}
function bindCards(){document.querySelectorAll('[data-card]').forEach(b=>b.onclick=()=>showCard(cards.find(c=>c.id===b.dataset.card)));document.querySelectorAll('.card img').forEach(im=>im.onerror=()=>{im.alt=t('Bild nicht verfügbar: ','Image unavailable: ')+im.alt;im.style.objectFit='contain'})}
function showCard(c){const d=$('#card-dialog');d.innerHTML=`<button class="close" aria-label="${t('Schließen','Close')}">×</button><div class="dialog-grid"><img src="${esc(c.original.replace('width=3200','width=1250'))}" alt="${esc(c.name)}"><div><div class="eyebrow">${esc(c.set)} / ${esc(c.code)}</div><h2>${esc(c.name)}</h2>${c.variant?`<p>${esc(c.variant)}</p>`:''}${c.nameFromFilename?`<p class="muted">${t('Name aus der Bilddatei übernommen.','Name taken from the image filename.')}</p>`:''}${c.notes?`<h3>${t('Hinweise & Errata','Notes & errata')}</h3>${state.lang==='en'?'<p class="muted">Official source notes (original language).</p>':''}<div class="notes">${linkText(c.notes)}</div>`:''}<p><a href="${esc(c.source)}" target="_blank" rel="noopener">${t('Im offiziellen Spoiler ansehen','View in official spoiler')}</a></p><p><a href="${url('cards',c.id)}" data-permalink>${t('Direktlink zur Karte','Card permalink')}</a></p><p class="source-box">© Bluthelden · ${t('Originalabbildung','Original card image')}</p></div></div>`;d.querySelector('.close').onclick=()=>d.close();d.querySelectorAll('a[href^="#"]').forEach(a=>a.onclick=()=>d.close());d.onclick=e=>{if(e.target===d)d.close()};if(!d.open)d.showModal()}
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
