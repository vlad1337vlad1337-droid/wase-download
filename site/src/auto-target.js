// SPDX-License-Identifier: MIT
// AUTO resolves to a real, shared output; the API never receives "auto".
const preferences={image:['PNG','WEBP','JPG'],vector:['PNG','PDF','SVG'],document:['PDF','TXT','DOCX'],ebook:['PDF','EPUB','TXT'],presentation:['PDF','PPTX','PNG'],audio:['MP3','WAV','FLAC'],video:['MP4','WEBM','MOV'],archive:['ZIP','TAR','7Z'],font:['WOFF2','TTF','OTF'],cad:['STL','OBJ','GLB']};
const canonical=value=>({JPEG:'JPG',TIF:'TIFF'}[value]||value);
export function chooseAutoTarget(inputs,outputs,categories={}){
 const types=inputs.map(value=>value.toUpperCase()),available=[...new Set(outputs.map(value=>value.toUpperCase()))].filter(value=>value!=='AUTO');
 if(!available.length)return null;
 const alternate=available.filter(output=>!types.some(input=>canonical(input)===canonical(output)));
 let choices=alternate.length?alternate:available;
 const groups=types.map(type=>categories[type.toLowerCase()]||(/^(PNG|JPG|JPEG|GIF|WEBP|BMP|ICO|AVIF|HEIC|HEIF|TIF|TIFF)$/.test(type)?'image':type==='SVG'?'vector':null));
 const group=groups.every(value=>value===groups[0])?groups[0]:null;
 // Never turn a raster upload into vector tracing merely to avoid a same-format export.
 if(group==='image'&&!preferences.image.some(value=>choices.includes(value))&&preferences.image.some(value=>available.includes(value)))choices=available;
 return (preferences[group]||['PNG','PDF','MP3','MP4','ZIP']).find(value=>choices.includes(value))||choices.slice().sort()[0];
}
