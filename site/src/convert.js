// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
const MIME={SVG:'image/svg+xml',PNG:'image/png',JPG:'image/jpeg',WEBP:'image/webp',BMP:'image/bmp',ICO:'image/x-icon'};
export const MAX_BYTES=20*1024*1024;
export const MAX_PIXELS=16_000_000;
export function imageType(bytes){
 const b=new Uint8Array(bytes),s=new TextDecoder().decode(b.slice(0,256)).trim();
 if(b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)return 'PNG';
 if(b[0]===255&&b[1]===216&&b[2]===255)return 'JPG';
 if(String.fromCharCode(...b.slice(0,3))==='GIF')return 'GIF';
 if(String.fromCharCode(...b.slice(0,2))==='BM')return 'BMP';
 if(String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'WEBP';
 if(/^(?:<\?xml[^>]*>\s*)?(?:<!--[^]*?-->\s*)?<svg[\s>]/i.test(s))return 'SVG';
 throw new Error('type');
}
function dimensions(bytes,type){
 const b=new Uint8Array(bytes),v=new DataView(bytes);
 try{
  if(type==='PNG'&&b.length>=24)return [v.getUint32(16),v.getUint32(20)];
  if(type==='GIF'&&b.length>=10)return [v.getUint16(6,true),v.getUint16(8,true)];
  if(type==='BMP'&&b.length>=26)return [Math.abs(v.getInt32(18,true)),Math.abs(v.getInt32(22,true))];
  if(type==='JPG'){let i=2;while(i+8<b.length){if(b[i]!==255){i++;continue;}const marker=b[i+1];if(marker===255){i++;continue;}if(marker===217||marker===218)break;const size=v.getUint16(i+2);if(size<2)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return [v.getUint16(i+7),v.getUint16(i+5)];i+=size+2;}}
  if(type==='WEBP'&&b.length>=30){const kind=String.fromCharCode(...b.slice(12,16));if(kind==='VP8X')return [1+b[24]+(b[25]<<8)+(b[26]<<16),1+b[27]+(b[28]<<8)+(b[29]<<16)];if(kind==='VP8 ')return [v.getUint16(26,true)&16383,v.getUint16(28,true)&16383];if(kind==='VP8L'&&b[20]===47)return [1+b[21]+((b[22]&63)<<8),1+((b[22]>>6)|(b[23]<<2)|((b[24]&15)<<10))];}
 }catch{throw new Error('decode');}return null;
}
function checkSize(w,h){if(!Number.isFinite(w*h)||w<1||h<1||w*h>MAX_PIXELS||w>8192||h>8192)throw new Error('pixels');}
export function cleanSvg(text){
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('svg');
 const doc=new DOMParser().parseFromString(text,'image/svg+xml'),root=doc.documentElement;
 if(root.localName!=='svg'||doc.querySelector('parsererror'))throw new Error('svg');
 const tags=new Set(['svg','g','path','rect','circle','ellipse','polygon','polyline','line','text','tspan','defs','linearGradient','radialGradient','stop','clipPath','mask','title','desc']);
 const attrs=new Set(['xmlns','viewBox','width','height','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','d','points','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','opacity','fill-opacity','stroke-opacity','transform','id','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','clip-path','mask','font-family','font-size','font-weight','text-anchor','dominant-baseline','preserveAspectRatio']);
 for(const e of [root,...root.querySelectorAll('*')]){if(!tags.has(e.localName))throw new Error('svg');for(const a of [...e.attributes]){if(!attrs.has(a.name)){if(/^on/i.test(a.name)||/href/i.test(a.name)||a.name==='style')throw new Error('svg');e.removeAttribute(a.name);continue;}if(/url\s*\(/i.test(a.value)&&!/^url\(#[\w-]+\)$/.test(a.value))throw new Error('svg');}}
 const vb=(root.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number),w=parseFloat(root.getAttribute('width'))||(vb.length===4?vb[2]:300),h=parseFloat(root.getAttribute('height'))||(vb.length===4?vb[3]:150);
 checkSize(w,h);root.setAttribute('width',String(w));root.setAttribute('height',String(h));root.setAttribute('xmlns','http://www.w3.org/2000/svg');return new XMLSerializer().serializeToString(root);
}
export async function inspect(file){
 if(file.size>MAX_BYTES)throw new Error('size');const bytes=await file.arrayBuffer(),type=imageType(bytes);let blob=file,svg=null;
 const dims=dimensions(bytes,type);if(dims)checkSize(...dims);
 if(type==='SVG'){svg=cleanSvg(new TextDecoder().decode(bytes));blob=new Blob([svg],{type:MIME.SVG});}
 const url=URL.createObjectURL(blob),image=new Image();image.decoding='async';
 try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('decode'));image.src=url;});checkSize(image.naturalWidth,image.naturalHeight);return {type,svg,image,url,width:image.naturalWidth,height:image.naturalHeight};}catch(e){URL.revokeObjectURL(url);throw e;}
}
const canvasBlob=(canvas,type,q)=>new Promise((resolve,reject)=>canvas.toBlob(b=>b&&b.type===type?resolve(b):reject(new Error('encode')),type,q));
function bmp(canvas){const {width:w,height:h}=canvas,stride=(w*3+3)&~3,size=54+stride*h,buf=new ArrayBuffer(size),v=new DataView(buf),px=canvas.getContext('2d').getImageData(0,0,w,h).data;v.setUint16(0,0x4d42,true);v.setUint32(2,size,true);v.setUint32(10,54,true);v.setUint32(14,40,true);v.setInt32(18,w,true);v.setInt32(22,h,true);v.setUint16(26,1,true);v.setUint16(28,24,true);v.setUint32(34,stride*h,true);const b=new Uint8Array(buf);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,o=54+(h-1-y)*stride+x*3;b[o]=px[i+2];b[o+1]=px[i+1];b[o+2]=px[i];}return new Blob([buf],{type:MIME.BMP});}
async function ico(canvas){const png=await canvasBlob(canvas,MIME.PNG),data=await png.arrayBuffer(),head=new ArrayBuffer(22),v=new DataView(head);v.setUint16(2,1,true);v.setUint16(4,1,true);v.setUint8(6,canvas.width===256?0:canvas.width);v.setUint8(7,canvas.height===256?0:canvas.height);v.setUint16(10,1,true);v.setUint16(12,32,true);v.setUint32(14,data.byteLength,true);v.setUint32(18,22,true);return new Blob([head,data],{type:MIME.ICO});}
export async function convert(item,target,opts,signal){
 if(signal.aborted)throw new Error('cancelled');
 if(target==='SVG'&&item.type==='SVG')return {blob:new Blob([item.svg],{type:MIME.SVG}),extension:'svg',width:item.width,height:item.height};
 const tracing=target==='SVG',traceLimit={simple:768,balanced:1024,detailed:1536}[opts.detail],max=target==='ICO'?256:tracing?Math.min(opts.edge||traceLimit,traceLimit):opts.edge||Math.max(item.width,item.height),scale=Math.min(1,max/Math.max(item.width,item.height)),w=Math.max(1,Math.round(item.width*scale)),h=Math.max(1,Math.round(item.height*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:tracing||target==='BMP'});
 if(target==='JPG'||target==='BMP'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);}ctx.drawImage(item.image,0,0,w,h);
 try{
  if(tracing){const pixels=ctx.getImageData(0,0,w,h).data.buffer;const svg=await new Promise((resolve,reject)=>{
   const worker=new Worker(new URL('./trace.worker.js',import.meta.url),{type:'module'});let finished=false;
   const end=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();signal.removeEventListener('abort',abort);error?reject(new Error(error)):resolve(result);};
   const abort=()=>end('cancelled'),timer=setTimeout(()=>end('timeout'),45000);signal.addEventListener('abort',abort,{once:true});worker.onmessage=e=>end(e.data.error,e.data.svg);worker.onerror=()=>end('worker');worker.postMessage({pixels,width:w,height:h,detail:opts.detail,colors:opts.colors},[pixels]);
  });return {blob:new Blob([svg],{type:MIME.SVG}),extension:'svg',width:w,height:h};}
  let blob;
  if(target==='WEBP'){
   try{blob=await canvasBlob(canvas,MIME.WEBP,opts.quality);}catch{
    // Safari may report unsupported WebP only after the user has cancelled.
    // Do not start a worker with an already-aborted signal: its event has fired.
    if(signal.aborted)throw new Error('cancelled');
    const pixels=ctx.getImageData(0,0,w,h).data.buffer;
    const bytes=await new Promise((resolve,reject)=>{
     const worker=new Worker(new URL('./webp.worker.js',import.meta.url),{type:'module'});let finished=false;
     const end=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();signal.removeEventListener('abort',abort);error?reject(new Error(error)):resolve(result);};
     const abort=()=>end('cancelled'),timer=setTimeout(()=>end('timeout'),45000);signal.addEventListener('abort',abort,{once:true});worker.onmessage=e=>end(e.data.error,e.data.bytes);worker.onerror=()=>end('encode');worker.postMessage({pixels,width:w,height:h,quality:opts.quality},[pixels]);
    });blob=new Blob([bytes],{type:MIME.WEBP});
   }
  }else blob=target==='BMP'?bmp(canvas):target==='ICO'?await ico(canvas):await canvasBlob(canvas,MIME[target],opts.quality);if(signal.aborted)throw new Error('cancelled');return {blob,extension:target.toLowerCase(),width:w,height:h};
 }finally{canvas.width=1;canvas.height=1;}
}
