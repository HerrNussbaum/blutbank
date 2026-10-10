import {createPDF,loadPDFImage} from './proxy-pdf.mjs';
import {CardSearch} from './card-search.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parseList(input){
 return input.replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').replace(/\\r\\n|\\n/g,'\n').replace(/(^|[\r\n\u2028\u2029])[\t ]*[-*•·][\t ]+/g,'$1').replace(/[\t ]+(?=\d+\s*[x×✕]\s)/gi,'\n').split(/\r\n|[\r\n\u2028\u2029]/).map((line,i)=>({line:line.trim().replace(/^(?:[-*•·]\s+|[☐□]\s*)/,'').trim(),number:i+1})).filter(x=>x.line).map(({line,number})=>{
  const m=/^(\d+)\s*(?:[x×✕]\s*|\s+)(.+)$/i.exec(line);
  const quantity=m?Number(m[1]):1,name=m?m[2].trim():line;
  return {number,name,quantity,error:!name||!Number.isSafeInteger(quantity)||quantity<1||quantity>300||/^[-+\d]/.test(name)};
 });
}
export function paginate(items,size=9){const pages=[];for(let i=0;i<items.length;i+=size)pages.push(items.slice(i,i+size));return pages;}
export function printDocument(items,width=63,height=88){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<40||width>63||height<60||height>88)throw Error('Invalid dimensions');
 return `<!doctype html><html><head><meta charset="utf-8"><title>blutbank · Proxies</title><style>
 @page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#ddd;font-family:Arial,sans-serif}.sheet{width:210mm;height:297mm;padding:10mm;display:grid;grid-template-columns:repeat(3,${width}mm);grid-template-rows:repeat(3,${height}mm);justify-content:center;align-content:center;break-after:page;page-break-after:always;background:white;margin:12px auto}.sheet:last-child{break-after:auto;page-break-after:auto}.card{width:${width}mm;height:${height}mm;border:.15mm dashed #888;overflow:hidden}.card img{display:block;width:100%;height:100%;object-fit:contain}@media print{body{background:white}.sheet{margin:0}img{print-color-adjust:exact;-webkit-print-color-adjust:exact}}@media screen and (max-width:800px){.sheet{zoom:.65}}@media screen and (max-width:530px){.sheet{zoom:.38}}
 </style></head><body>${paginate(items).map(page=>`<section class="sheet">${page.map(c=>`<div class="card"><img src="${esc(c.original)}" alt="${esc(c.name)}"></div>`).join('')}</section>`).join('')}</body></html>`;
}
let draft='',rows=[],width=63,height=88;
export function setProxyDeck(entries,cards){rows=entries.map((e,i)=>({number:i+1,name:cards.find(c=>c.id===e.id).name,quantity:e.quantity,id:e.id,error:false}));draft=rows.map(r=>`${r.quantity}x ${r.name}`).join('\n');}
export function mountProxy(root,cards,lang){
 const t=(de,en)=>lang==='en'?en:de,groups=CardSearch.group(cards),byKey=new Map(groups.map(g=>[g.key,g]));
 let generation=0,frame;
 const resolve=name=>byKey.get(CardSearch.nameKey(name))||groups.find(g=>g.variants.some(c=>c.id===name||c.code&&c.code.toLowerCase()===name.toLowerCase()));
 root.innerHTML=`<h1>${t('Proxy-Drucker','Proxy printer')}</h1><p>${t('Eine Karte pro Zeile, mit Anzahl davor. Ohne Anzahl wird eine Kopie verwendet.','One card per line, preceded by its quantity. Without a quantity, one copy is used.')}</p>
 <label for="proxy-list">${t('Kartenliste','Card list')}</label><textarea id="proxy-list" rows="7" placeholder="4 Zayas Ritual&#10;2x Amazon Rider&#10;The Lie">${esc(draft)}</textarea>
 <div class="proxy-actions"><button class="pill" id="proxy-resolve">${t('Liste übernehmen','Resolve list')}</button><span>${t('Bis zu 300 Karten · 9 pro A4-Seite','Up to 300 cards · 9 per A4 page')}</span></div>
 <div id="proxy-rows"></div><datalist id="proxy-names">${groups.map(g=>`<option value="${esc(g.name)}"></option>`).join('')}</datalist>
 <details class="advanced-filters"><summary>${t('Druckformat','Print size')}</summary><p>${t('Voreinstellung: 63 × 88 mm. Bilder werden vollständig eingepasst. Bei Bedarf kleinere Maße wählen.','Default: 63 × 88 mm. Images are fitted without cropping. Choose smaller dimensions if needed.')}</p><div class="proxy-actions"><label>${t('Breite (mm)','Width (mm)')} <input id="proxy-width" type="number" min="40" max="63" step="0.1" value="${width}"></label><label>${t('Höhe (mm)','Height (mm)')} <input id="proxy-height" type="number" min="60" max="88" step="0.1" value="${height}"></label></div></details>
 <div class="proxy-actions"><button class="pill" id="proxy-preview">${t('Druckvorschau erstellen','Prepare print preview')}</button><button class="pill" id="proxy-pdf">${t('PDF herunterladen','Download PDF')}</button><button class="pill" id="proxy-print" disabled>${t('Drucken / als PDF speichern','Print / save as PDF')}</button></div>
 <p id="proxy-status" role="status" aria-live="polite"></p><p class="muted">${t('Im Druckdialog: A4, Hochformat, 100 % / tatsächliche Größe, keine Ränder sowie Kopf- und Fußzeilen ausschalten. Als Ziel „Als PDF speichern“ wählen. Die gestrichelten Linien helfen beim Ausschneiden.','In the print dialog: A4 portrait, 100% / actual size, no margins, and disable headers and footers. Select “Save as PDF” as the destination. Dashed lines guide cutting.')}</p><div id="proxy-preview-area"></div><p class="source-box">© Bluthelden · ${t('Proxy-Ausdrucke für private Testspiele. Kartenbilder werden von der offiziellen Quelle geladen.','Proxy prints for private playtesting. Card images load from the official source.')}</p>`;
 const $=s=>root.querySelector(s),status=message=>$('#proxy-status').textContent=message;
 function invalidate(){generation++;$('#proxy-print').disabled=true;$('#proxy-preview-area').replaceChildren();frame=null;}
 function renderRows(){
  $('#proxy-rows').innerHTML=rows.length?`<h2>${t('Karten & Versionen','Cards & versions')}</h2>${rows.map((r,i)=>{
   const g=resolve(r.name);if(g&&!g.variants.some(c=>c.id===r.id))r.id=g.card.id;if(!g)r.id=null;
   return `<div class="proxy-row"><span>${r.quantity}×</span><label><span class="sr-only">${t('Karte','Card')} ${i+1}</span><input data-name="${i}" list="proxy-names" value="${esc(r.name)}" aria-invalid="${!!r.error||!g}"></label>${g?`<select data-printing="${i}" aria-label="${t('Version','Version')} ${i+1}">${g.variants.map((c,j)=>`<option value="${c.id}" ${r.id===c.id?'selected':''}>${esc(c.set)} · ${esc(c.code||c.text?.collectorNumber||j+1)}${c.variant?' · '+esc(c.variant):''} (${j+1})</option>`).join('')}</select>`:`<span class="proxy-error">${t('Name nicht gefunden – bitte korrigieren.','Name not found — please correct.')}</span>`}${r.error?`<span class="proxy-error">${t('Ungültige Zeile: Anzahl 1–300 und Kartenname erforderlich.','Invalid line: quantity 1–300 and card name required.')}</span>`:''}</div>`;
  }).join('')}`:'';
  root.querySelectorAll('[data-name]').forEach(el=>el.onchange=()=>{rows[Number(el.dataset.name)].name=el.value.trim();invalidate();renderRows();status('')});
  root.querySelectorAll('[data-printing]').forEach(el=>el.onchange=()=>{rows[Number(el.dataset.printing)].id=el.value;invalidate();status('')});
 }
 $('#proxy-list').oninput=e=>{draft=e.target.value;rows=[];invalidate();renderRows();status(t('Liste geändert. Bitte erneut übernehmen.','List changed. Please resolve it again.'))};
 $('#proxy-resolve').onclick=()=>{draft=$('#proxy-list').value;rows=parseList(draft);invalidate();renderRows();status(rows.length?t('Versionen prüfen, dann die Druckvorschau erstellen.','Check the versions, then prepare the preview.'):t('Bitte mindestens eine Karte eingeben.','Please enter at least one card.'))};
 for(const key of ['width','height'])$('#proxy-'+key).oninput=()=>{width=Number($('#proxy-width').value);height=Number($('#proxy-height').value);invalidate();status('')};
 $('#proxy-preview').onclick=async()=>{
  invalidate();const token=generation;
  if(!rows.length||rows.some(r=>r.error||!r.id)){status(t('Bitte die Liste übernehmen und alle unbekannten oder ungültigen Zeilen korrigieren.','Resolve the list and correct all unknown or invalid lines.'));return;}
  const total=rows.reduce((n,r)=>n+r.quantity,0);if(total>300){status(t('Maximal 300 Karten pro Druckauftrag.','Maximum 300 cards per print job.'));return;}
  const items=rows.flatMap(r=>Array(r.quantity).fill(cards.find(c=>c.id===r.id)));let html;
  try{html=printDocument(items,width,height)}catch{status(t('Breite muss 40–63 mm, Höhe 60–88 mm betragen.','Width must be 40–63 mm, height 60–88 mm.'));return;}
  status(t('Kartenbilder werden geladen …','Loading card images …'));
  frame=document.createElement('iframe');frame.title=t('A4-Druckvorschau','A4 print preview');frame.className='proxy-frame';const current=frame;
  current.onload=async()=>{
   const imgs=[...current.contentDocument.images];const results=await Promise.all(imgs.map(img=>new Promise(resolve=>{
    if(img.complete)return resolve(img.naturalWidth>0);
    const timer=setTimeout(()=>resolve(false),30000);img.onload=()=>{clearTimeout(timer);resolve(true)};img.onerror=()=>{clearTimeout(timer);resolve(false)};
   })));
   if(token!==generation||!current.isConnected)return;
   const failed=results.filter(x=>!x).length;
   if(failed){status(t(`${failed} Bilder konnten nicht geladen werden. Bitte die Vorschau erneut erstellen; Drucken bleibt gesperrt.`,`${failed} images failed to load. Please prepare the preview again; printing remains disabled.`));return;}
   $('#proxy-print').disabled=false;status(t(`${total} Karten · ${Math.ceil(total/9)} A4-Seiten · bereit zum Drucken.`,`${total} cards · ${Math.ceil(total/9)} A4 pages · ready to print.`));
  };
  current.srcdoc=html;$('#proxy-preview-area').append(current);
 };
 $('#proxy-pdf').onclick=async()=>{
  if(!rows.length){$('#proxy-resolve').click();}
  if(!rows.length||rows.some(r=>r.error||!r.id)){status(t('Bitte alle unbekannten oder ungültigen Zeilen korrigieren.','Please correct all unknown or invalid lines.'));return;}
  const ids=rows.flatMap(r=>Array(r.quantity).fill(r.id));
  if(ids.length>300){status(t('Maximal 300 Karten pro Druckauftrag.','Maximum 300 cards per print job.'));return;}
  try{printDocument([],width,height)}catch{status(t('Breite muss 40–63 mm, Höhe 60–88 mm betragen.','Width must be 40–63 mm, height 60–88 mm.'));return;}
  const token=generation,button=$('#proxy-pdf'),jobWidth=width,jobHeight=height;button.disabled=true;
  status(t('PDF wird erstellt …','Creating PDF …'));
  try{
   const images=new Map();for(const id of new Set(ids)){const card=cards.find(c=>c.id===id);try{images.set(id,await loadPDFImage(card.original))}catch{throw Error(t('Bild konnte nicht geladen werden: ','Could not load image: ')+card.name)}}
   if(token!==generation||!button.isConnected)return;
   const blob=createPDF(ids,images,jobWidth,jobHeight),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='blutbank-proxies.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
   status(t(`${ids.length} Karten · ${Math.ceil(ids.length/9)} A4-Seiten · PDF erstellt.`,`${ids.length} cards · ${Math.ceil(ids.length/9)} A4 pages · PDF created.`));
  }catch(error){if(token===generation&&button.isConnected)status(error.message)}finally{button.disabled=false;}
 };
 $('#proxy-print').onclick=()=>{if(frame&&!$('#proxy-print').disabled){frame.contentWindow.focus();frame.contentWindow.print()}};
 renderRows();
}
