// SPDX-License-Identifier: MIT
const mime = {
 png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',bmp:'image/bmp',ico:'image/x-icon',svg:'image/svg+xml',avif:'image/avif',
 mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',opus:'audio/ogg',m4a:'audio/mp4',aac:'audio/aac',flac:'audio/flac',
 mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',ogv:'video/ogg',
 txt:'text/plain',csv:'text/csv',json:'application/json',xml:'application/xml',html:'text/html',htm:'text/html',md:'text/markdown',css:'text/css',js:'text/javascript',yaml:'text/plain',yml:'text/plain',log:'text/plain',srt:'text/plain',vtt:'text/vtt',
 zip:'application/zip',pdf:'application/pdf'
};
export function outputMime(extension){return mime[String(extension).toLowerCase()]||'application/octet-stream';}
export function previewKind(extension){
 if(String(extension).toLowerCase()==='pdf')return 'pdf';
 const type=outputMime(extension);
 if(type.startsWith('image/'))return 'image';
 if(type.startsWith('audio/'))return 'audio';
 if(type.startsWith('video/'))return 'video';
 // HTML, SVG and code are never executed or injected into the document.
 if(type.startsWith('text/')||['json','xml'].includes(String(extension).toLowerCase()))return 'text';
 return 'unavailable';
}
export function previewLimit(kind){return kind==='text'?1024*1024:['image','pdf'].includes(kind)?32*1024*1024:Infinity;}
export function resultsComplete(items){return items.length>0&&items.every(item=>item.status==='done'&&item.result);}
