// Small image-only PDF writer. Reuses image objects for repeated copies.
export function createPDF(items, images, width=63, height=88){
 if(!items.length||items.length>300||!Number.isFinite(width)||!Number.isFinite(height)||width<40||width>63||height<60||height>88)throw Error('Invalid print job');
 const enc=new TextEncoder(),objects=[null],reserve=()=>{objects.push(null);return objects.length-1;},put=s=>{const id=reserve();objects[id]=enc.encode(s);return id;};
 const stream=(header,bytes)=>{const id=reserve(),a=enc.encode(`<< ${header} /Length ${bytes.length} >>\nstream\n`),b=enc.encode('\nendstream');objects[id]=new Uint8Array(a.length+bytes.length+b.length);objects[id].set(a);objects[id].set(bytes,a.length);objects[id].set(b,a.length+bytes.length);return id;};
 const catalog=reserve(),pages=reserve(),imageIds=new Map();
 for(const key of new Set(items)){const img=images.get(key);if(!img)throw Error('Missing image');imageIds.set(key,stream(`/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,img.bytes));}
 const mm=72/25.4,pw=210*mm,ph=297*mm,w=width*mm,h=height*mm,kids=[];
 for(let start=0;start<items.length;start+=9){
  const page=items.slice(start,start+9),resources=[],commands=['0.55 G 0.4 w [2 2] 0 d'];
  page.forEach((key,i)=>{const img=images.get(key),scale=Math.min(w/img.width,h/img.height),iw=img.width*scale,ih=img.height*scale,x=(pw-3*w)/2+(i%3)*w,y=ph-(ph-3*h)/2-(Math.floor(i/3)+1)*h;resources.push(`/I${i} ${imageIds.get(key)} 0 R`);commands.push(`q ${iw} 0 0 ${ih} ${x+(w-iw)/2} ${y+(h-ih)/2} cm /I${i} Do Q`,`${x} ${y} ${w} ${h} re S`);});
  const content=stream('',enc.encode(commands.join('\n')));kids.push(put(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << ${resources.join(' ')} >> >> /Contents ${content} 0 R >>`));
 }
 objects[catalog]=enc.encode(`<< /Type /Catalog /Pages ${pages} 0 R >>`);objects[pages]=enc.encode(`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(id=>`${id} 0 R`).join(' ')}] >>`);
 const chunks=[enc.encode('%PDF-1.4\n')],offsets=[0];let offset=chunks[0].length;
 for(let id=1;id<objects.length;id++){offsets.push(offset);const a=enc.encode(`${id} 0 obj\n`),b=enc.encode('\nendobj\n');chunks.push(a,objects[id],b);offset+=a.length+objects[id].length+b.length;}
 chunks.push(enc.encode(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${offset}\n%%EOF`));return new Blob(chunks,{type:'application/pdf'});
}
export async function loadPDFImage(url){
 const img=new Image();img.crossOrigin='anonymous';
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Image timeout')),30000);img.onload=()=>{clearTimeout(timer);resolve()};img.onerror=()=>{clearTimeout(timer);reject(Error('Image unavailable'))};img.src=url;});
 const canvas=document.createElement('canvas'),scale=Math.min(1,1100/img.naturalHeight);canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if(!blob)throw Error('Image conversion failed');return {width:canvas.width,height:canvas.height,bytes:new Uint8Array(await blob.arrayBuffer())};
}
