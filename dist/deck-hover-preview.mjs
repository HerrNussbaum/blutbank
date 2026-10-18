// A single viewport-bound preview lives outside scrolling/column containers.
let disposePrevious=()=>{};
export function bindDeckPreview(root){
 disposePrevious();
 const events=new AbortController(),image=document.createElement('img');
 image.className='deck-floating-preview';image.alt='';image.hidden=true;
 image.setAttribute('aria-hidden','true');document.body.append(image);
 let active=null;
 const hide=()=>{active=null;image.hidden=true;};
 function show(link){
  const source=link?.querySelector('.deck-hover');if(!source)return;
  active=link;image.src=source.src;
  const rect=link.getBoundingClientRect(),width=Math.min(280,innerWidth-24,(innerHeight-24)*63/88),height=width*88/63;
  let left=rect.right+16;if(left+width>innerWidth-12)left=rect.left-width-16;
  image.style.width=width+'px';image.style.height=height+'px';
  image.style.left=Math.max(12,Math.min(left,innerWidth-width-12))+'px';
  image.style.top=Math.max(12,Math.min(rect.top,innerHeight-height-12))+'px';
  image.hidden=false;
 }
 root.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const link=e.target.closest('.presentation-text .deck-card-name');if(link&&link!==active)show(link);},{signal:events.signal});
 root.addEventListener('pointerout',e=>{if(active&&!active.contains(e.relatedTarget))hide();},{signal:events.signal});
 root.addEventListener('focusin',e=>show(e.target.closest('.presentation-text .deck-card-name')),{signal:events.signal});
 root.addEventListener('focusout',hide,{signal:events.signal});
 window.addEventListener('scroll',hide,{capture:true,passive:true,signal:events.signal});
 window.addEventListener('resize',hide,{signal:events.signal});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();},{signal:events.signal});
 const dispose=()=>{events.abort();image.remove();};
 window.addEventListener('hashchange',dispose,{once:true,signal:events.signal});
 disposePrevious=dispose;
 return hide;
}
