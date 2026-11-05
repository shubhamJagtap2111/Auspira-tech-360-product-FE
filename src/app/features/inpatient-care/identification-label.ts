/** Opens the print window during the user gesture; label content never becomes HTML. */
export async function printIdentificationLabel(title:string,lines:string[],value:string):Promise<void>{
  const popup=window.open('','_blank','width=600,height=650');
  if(!popup)throw new Error('Allow the label window to open.');
  popup.opener=null;const doc=popup.document;doc.title=title;doc.body.style.fontFamily=getComputedStyle(document.body).fontFamily;
  const box=doc.createElement('main');const heading=doc.createElement('h1');heading.textContent=title;box.append(heading);
  for(const text of [...lines,value]){const p=doc.createElement('p');p.textContent=text;box.append(p);}
  doc.body.append(box);
  try{const qr=await import('qrcode');const data=await qr.toDataURL(value,{margin:2,width:220});if(popup.closed)return;const image=doc.createElement('img');image.src=data;image.alt='Identification QR code';box.append(image);const button=doc.createElement('button');button.textContent='Print label';button.onclick=()=>popup.print();box.append(button);}
  catch(error){popup.close();throw error;}
}
