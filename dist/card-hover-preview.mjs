// Keep the original accessible tooltip outside the card/grid clipping context.
let disposePrevious=()=>{};
export function bindCardPreview(){
 disposePrevious();
 const events=new AbortController();
 let active=null,hint=null,timer;
 const hide=()=>{
  clearTimeout(timer);
  if(hint){hint.classList.remove('card-hint-floating');hint.removeAttribute('style');if(active?.isConnected)active.append(hint);else hint.remove();}
  active=null;hint=null;
 };
 const scheduleHide=()=>{clearTimeout(timer);timer=setTimeout(hide,120);};
 function show(card){
  clearTimeout(timer);if(card===active)return;
  hide();
  const source=card.querySelector('.card-hint');if(!source)return;
  const rect=card.getBoundingClientRect(),gap=16,margin=12;
  const right=innerWidth-rect.right-gap-margin,left=rect.left-gap-margin;
  // Small touch layouts use the full card page, never cover the card with a tooltip.
  if(Math.max(right,left)<220)return;
  const useRight=right>=Math.min(340,Math.max(right,left));
  const width=Math.min(340,useRight?right:left);
  active=card;hint=source;document.body.append(hint);
  hint.classList.add('card-hint-floating');
  hint.style.width=width+'px';hint.style.maxHeight=(innerHeight-2*margin)+'px';
  hint.style.left=(useRight?rect.right+gap:rect.left-gap-width)+'px';
  hint.style.top=Math.max(margin,Math.min(rect.top,innerHeight-hint.getBoundingClientRect().height-margin))+'px';
 }
 for(const card of document.querySelectorAll('.card[data-card]')){
  card.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')show(card);},{signal:events.signal});
  card.addEventListener('pointerleave',scheduleHide,{signal:events.signal});
  card.addEventListener('focus',()=>show(card),{signal:events.signal});
  card.addEventListener('blur',scheduleHide,{signal:events.signal});
 }
 document.addEventListener('pointerover',e=>{if(hint?.contains(e.target))clearTimeout(timer);},{signal:events.signal});
 document.addEventListener('pointerout',e=>{if(hint?.contains(e.target)&&!hint.contains(e.relatedTarget))scheduleHide();},{signal:events.signal});
 window.addEventListener('scroll',e=>{if(hint?.contains(e.target))return;const focused=active===document.activeElement?active:null;hide();if(focused)show(focused);},{capture:true,passive:true,signal:events.signal});
 window.addEventListener('resize',hide,{signal:events.signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();},{signal:events.signal});
 const dispose=()=>{hide();events.abort();};
 window.addEventListener('hashchange',dispose,{once:true,signal:events.signal});
 disposePrevious=dispose;
}
