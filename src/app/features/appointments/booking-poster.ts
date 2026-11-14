import * as QRCode from 'qrcode';

export interface BookingPosterDetails { title:string;hospitalName:string;address:string;phone:string;url:string;format:string;logo?:string; }
export const escapeBookingText=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export async function bookingPosterSvg(details:BookingPosterDetails):Promise<string> {
 const escape=escapeBookingText;
 const height=details.format==='STAND'?1600:1414;
 const qr=await QRCode.toString(details.url,{type:'svg',width:560,margin:4,errorCorrectionLevel:'M'});
 const nested=qr.replace('<svg ','<svg x="220" y="350" ');
 const wrap=(value:string,max:number)=>{const lines:string[]=[];let line='';for(const word of value.split(/\s+/)){if((line+' '+word).trim().length>max&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);return lines;};
 const lines=(value:string,y:number,size:number,max:number)=>wrap(value,max).slice(0,3).map((line,i)=>`<text x="500" y="${y+i*(size+12)}" font-size="${size}">${escape(line)}</text>`).join('');
 let logo=details.logo;
 if(!logo){const response=await fetch(new URL('assets/brand/auspira-logo.webp',document.baseURI));if(response.ok)logo=await dataUrl(await response.blob());}
 let font='';
 for(const sheet of Array.from(document.styleSheets)){try{for(const rule of Array.from(sheet.cssRules)){if(!(rule instanceof CSSFontFaceRule))continue;const source=rule.style.getPropertyValue('src');if(!source.includes('auspira-font-6'))continue;const match=source.match(/url\(["']?([^"')]+)/);if(match){const url=new URL(match[1],sheet.href||document.baseURI);if(url.origin===location.origin){const response=await fetch(url);if(response.ok)font=await dataUrl(await response.blob());}}}}catch{/* Optional external stylesheet is not read. */}}
 const fontStyle=font?'<style>@font-face{font-family:Inter;font-style:normal;font-weight:100 900;src:url('+font+') format("woff2")}</style>':'';
 // Print stays on a white surface; use the shared brand gradient's blue rather than dark-mode control colours.
 const primary=getComputedStyle(document.documentElement).getPropertyValue('--ac-brand-gradient').match(/#[\da-f]{6}/i)?.[0]||'#2563eb';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${height}" viewBox="0 0 1000 ${height}"><rect width="1000" height="${height}" fill="white"/><rect x="24" y="24" width="952" height="${height-48}" rx="28" fill="white" stroke="${escape(primary)}" stroke-width="4"/>${fontStyle}<g text-anchor="middle" font-family="Inter,Arial,sans-serif" fill="#0f172a">${logo?`<image href="${escape(logo)}" x="350" y="48" width="300" height="90" preserveAspectRatio="xMidYMid meet"/>`:''}${lines(details.hospitalName,175,26,60)}<text x="500" y="320" fill="${escape(primary)}" font-size="38" font-weight="700">Scan to book an appointment</text>${nested}${lines(details.title,960,28,50)}<text x="500" y="1100" font-size="25">1. Scan · 2. Choose a time · 3. Confirm booking</text>${lines(details.address,1150,20,70)}<text x="500" y="1260" font-size="24">Reception: ${escape(details.phone)}</text><text x="500" y="1300" font-size="16">${escape(details.url)}</text><text x="500" y="${height-50}" font-size="18">Appointment booking · Registration at reception</text></g></svg>`;
}

export async function bookingPosterPng(svg:string,format:string):Promise<string>{
 const image=new Image();const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Poster image could not be rendered.'));image.src=url;});const canvas=document.createElement('canvas');canvas.width=format==='A4'?2480:1748;canvas.height=Math.round(canvas.width*(format==='STAND'?1.6:1.414));const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Poster image export is unavailable.');ctx.drawImage(image,0,0,canvas.width,canvas.height);return URL.createObjectURL(await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Poster image export is unavailable.')),'image/png')));}finally{URL.revokeObjectURL(url);}
}
function dataUrl(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});}
