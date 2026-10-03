// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Wase Download contributors
export const CREDIT='Created by wase.download';
const encode=value=>new TextEncoder().encode(value);
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function pngCredit(){const content=encode('Software\0'+CREDIT),type=encode('tEXt'),chunk=new Uint8Array(12+content.length),view=new DataView(chunk.buffer);view.setUint32(0,content.length);chunk.set(type,4);chunk.set(content,8);view.setUint32(chunk.length-4,crc32(chunk.subarray(4,-4)));return chunk;}
// Locate markup without interpreting XML, resolving entities or touching
// document data. A regex can mistake '<svg>' inside a comment for the root,
// or stop at '>' inside a quoted root attribute and corrupt a valid export.
function svgOpeningEnd(text){
 let position=0;
 while(position<text.length){
  while(/[\t\n\r ]/.test(text[position]||'\0'))position++;
  if(text.startsWith('<!--',position)){const end=text.indexOf('-->',position+4);if(end<0)return -1;position=end+3;continue;}
  if(text.startsWith('<?',position)){const end=text.indexOf('?>',position+2);if(end<0)return -1;position=end+2;continue;}
  const doctype=text.startsWith('<!DOCTYPE',position);
  if(!doctype&&!/^<svg(?=[\t\n\r />])/.test(text.slice(position,position+5)))return -1;
  let quote='',subset=0,closed=false;
  for(let i=position+(doctype?9:4);i<text.length;i++){
   const char=text[i];
   if(quote){if(char===quote)quote='';continue;}
   if(char==='"'||char==="'"){quote=char;continue;}
   if(doctype&&text.startsWith('<!--',i)){const end=text.indexOf('-->',i+4);if(end<0)return -1;i=end+2;continue;}
   if(doctype&&char==='[')subset++;else if(doctype&&char===']')subset--;
   else if(char==='>'&&subset===0){if(!doctype)return i+1;position=i+1;closed=true;break;}
  }
  if(!closed)return -1;
 }
 return -1;
}
// Parts are subarray views: branding never copies a 200 MB server result.
export function brandedParts(bytes,extension){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),ext=extension.toLowerCase();
 if(ext==='png'&&b.length>=33&&b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71)return [b.subarray(0,33),pngCredit(),b.subarray(33)];
 if(['jpg','jpeg'].includes(ext)&&b[0]===255&&b[1]===216){const text=encode(CREDIT),comment=new Uint8Array(text.length+4);comment.set([255,254,(text.length+2)>>8,(text.length+2)&255]);comment.set(text,4);return [b.subarray(0,2),comment,b.subarray(2)];}
 if(ext==='svg'&&b.length<=5*1024*1024){const text=new TextDecoder().decode(b),end=svgOpeningEnd(text);if(end!==-1&&!text.includes(CREDIT)){const offset=encode(text.slice(0,end)).length+(b[0]===239&&b[1]===187&&b[2]===191?3:0);return [b.subarray(0,offset),encode('<!-- '+CREDIT+' -->'),b.subarray(offset)];}}
 if(ext==='zip'){
  // EOCD must end exactly at the file end, including its existing comment.
  const view=new DataView(b.buffer,b.byteOffset,b.byteLength);
  for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(view.getUint32(i,true)!==0x06054b50)continue;const length=view.getUint16(i+20,true);if(i+22+length!==b.length)continue;const previous=new TextDecoder().decode(b.subarray(i+22));if(previous.includes(CREDIT))return [b];const extra=encode(previous?' · '+CREDIT:CREDIT),old=b.subarray(i+22),comment=new Uint8Array(old.length+extra.length);if(comment.length>65535)return [b];comment.set(old);comment.set(extra,old.length);return [b.subarray(0,i+20),new Uint8Array([comment.length&255,comment.length>>8]),comment];}
 }
 return [b];
}
export async function brandBlob(blob,extension){
 const ext=extension.toLowerCase();
 // Only small signature/tail slices are read for large images and archives.
 if(ext==='png'||ext==='jpg'||ext==='jpeg'){
  const head=new Uint8Array(await blob.slice(0,33).arrayBuffer()),parts=brandedParts(head,ext);
  if(parts.length===1)return blob;
  const offset=ext==='png'?33:2;return new Blob([parts[0],parts[1],blob.slice(offset)],{type:blob.type});
 }
 if(ext==='zip'){
  const offset=Math.max(0,blob.size-65557),tail=new Uint8Array(await blob.slice(offset).arrayBuffer()),parts=brandedParts(tail,ext);
  return parts.length===1?blob:new Blob([blob.slice(0,offset),...parts],{type:blob.type});
 }
 if(ext==='svg'&&blob.size<=5*1024*1024)return new Blob(brandedParts(new Uint8Array(await blob.arrayBuffer()),ext),{type:blob.type});
 return blob;
}
